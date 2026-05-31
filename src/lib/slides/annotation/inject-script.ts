// Phase 6 PR40 — 元素级标注修改的核心:iframe 内注入的 click overlay 脚本
//
// 对标 AnyGen 的"在 deck 上点元素改"UX:
//   - hover 任何文字元素 → outline 高亮
//   - click → 阻止默认 + 生成稳定 selector + postMessage 给 parent
//   - parent 弹输入框 "怎么改?" → 用户输 instruction → 累积到 annotations[]
//   - 顶部 "应用所有修改" 按钮 → 一次性发后端 LLM 改
//
// 设计要点:
//   - 注入脚本是**字符串模板**(buildAnnotationInjectScript),由 parent 决定何时注入
//   - 只在"标注模式"激活时注入(不影响普通浏览体验)
//   - selector 生成用 section nth-of-type + 元素在 section 内的 nth-child 路径
//   - 用 :first-of-type 等保证稳定(避免 nth-child 因为兄弟元素插入而失效)
//
// 安全:
//   - inject 字符串里不能有反引号 / ${} (这就在 template literal 里),用普通字符串拼
//   - 用 IIFE 包,不污染全局
//   - postMessage 不带敏感数据,只发 selector / text / rect

/** parent ↔ iframe 之间的 message 类型(用 type 字段区分) */
export const ANNOTATION_MESSAGE_TYPE = "anyslide:annotate-element";

export interface AnnotationMessage {
  type: typeof ANNOTATION_MESSAGE_TYPE;
  /** 当前是 deck 里第几页(1-based,iframe 自己算) */
  pageNo: number;
  /** 元素 selector(parent 用来定位 / 后端 LLM 用来改) */
  selector: string;
  /** 元素当前文字 */
  currentText: string;
  /** 元素在 iframe viewport 里的位置(parent 用来定位浮层输入框) */
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  /** 元素所在 section 的 role(如果模板加了 data-section-role) */
  sectionRole?: string;
}

/**
 * 构造要注入 iframe 的 JS(字符串)。
 * Parent 在准备 srcdoc 时,把这段 JS 在 </body> 前插入。
 * 仅在 annotation mode 激活时注入。
 *
 * @returns 一段 <script> 字符串
 */
export function buildAnnotationInjectScript(): string {
  // 注:整段是字符串(不在 template literal 里取变量),iframe 内执行
  // postMessage 类型常量也硬编码 — 跟 parent 一致
  return `
<script>
(function() {
  // ====== 配置 ======
  var TEXT_TAGS = ['H1','H2','H3','H4','H5','H6','P','LI','SPAN','DIV','TD','TH','BLOCKQUOTE','STRONG','EM','A','LABEL','BUTTON'];
  var HIGHLIGHT_COLOR = '#3b82f6';
  var POSTMSG_TYPE = 'anyslide:annotate-element';
  var activeEl = null;
  var originalStyles = new WeakMap();

  // ====== 工具:生成稳定 selector ======
  function getStableSelector(el) {
    var sectionEl = el.closest('section');
    if (!sectionEl) return null;
    var sections = Array.from(document.querySelectorAll('section'));
    var sectionIdx = sections.indexOf(sectionEl) + 1;

    // 元素在 section 内的 path(用 nth-of-type 更稳定)
    var path = [];
    var cur = el;
    while (cur && cur !== sectionEl) {
      var parent = cur.parentElement;
      if (!parent) break;
      var tagName = cur.tagName.toLowerCase();
      // 同 parent 同 tagName 的兄弟
      var sameTagSiblings = Array.from(parent.children).filter(function(c) {
        return c.tagName === cur.tagName;
      });
      if (sameTagSiblings.length === 1) {
        path.unshift(tagName);
      } else {
        var idx = sameTagSiblings.indexOf(cur) + 1;
        path.unshift(tagName + ':nth-of-type(' + idx + ')');
      }
      cur = parent;
    }
    return 'section:nth-of-type(' + sectionIdx + ') > ' + path.join(' > ');
  }

  // ====== 工具:推算当前 page no(用 .slide / [data-slide] / .active 类) ======
  function getCurrentPageNo(el) {
    var sectionEl = el.closest('section');
    if (!sectionEl) return 0;
    var sections = Array.from(document.querySelectorAll('section'));
    return sections.indexOf(sectionEl) + 1;
  }

  // ====== Hover 高亮 ======
  function applyHighlight(el) {
    if (originalStyles.has(el)) return;
    originalStyles.set(el, {
      outline: el.style.outline,
      outlineOffset: el.style.outlineOffset,
      cursor: el.style.cursor,
    });
    el.style.outline = '2px solid ' + HIGHLIGHT_COLOR;
    el.style.outlineOffset = '2px';
    el.style.cursor = 'pointer';
  }
  function removeHighlight(el) {
    var s = originalStyles.get(el);
    if (!s) return;
    el.style.outline = s.outline || '';
    el.style.outlineOffset = s.outlineOffset || '';
    el.style.cursor = s.cursor || '';
    originalStyles.delete(el);
  }

  function isTextNode(el) {
    if (!el || el.nodeType !== 1) return false;
    if (TEXT_TAGS.indexOf(el.tagName) === -1) return false;
    var text = (el.textContent || '').trim();
    if (text.length === 0) return false;
    if (text.length > 800) return false; // 过滤 root / 大容器
    // 必须是叶子文本元素(没有更细的 text 子元素)
    var hasTextChild = false;
    for (var i = 0; i < el.children.length; i++) {
      if (TEXT_TAGS.indexOf(el.children[i].tagName) !== -1) {
        hasTextChild = true;
        break;
      }
    }
    if (hasTextChild) return false;
    return true;
  }

  // ====== Mouseover ======
  document.addEventListener('mouseover', function(e) {
    var el = e.target;
    if (!isTextNode(el)) return;
    if (activeEl && activeEl !== el) removeHighlight(activeEl);
    activeEl = el;
    applyHighlight(el);
  }, true);

  document.addEventListener('mouseout', function(e) {
    if (e.target === activeEl) {
      removeHighlight(activeEl);
      activeEl = null;
    }
  }, true);

  // ====== Click → postMessage ======
  document.addEventListener('click', function(e) {
    var el = e.target;
    if (!isTextNode(el)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var selector = getStableSelector(el);
    if (!selector) return;
    var pageNo = getCurrentPageNo(el);
    var rect = el.getBoundingClientRect();
    var sectionEl = el.closest('section');
    var sectionRole = sectionEl ? (sectionEl.getAttribute('data-section-role') || '') : '';

    try {
      window.parent.postMessage({
        type: POSTMSG_TYPE,
        pageNo: pageNo,
        selector: selector,
        currentText: (el.textContent || '').trim(),
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        sectionRole: sectionRole,
      }, '*');
    } catch (err) {
      // postMessage 失败静默
    }
  }, true);

  // ====== 给 parent 一个 ready 信号 ======
  try {
    window.parent.postMessage({ type: 'anyslide:annotation-ready' }, '*');
  } catch (err) {}
})();
</script>`;
}
