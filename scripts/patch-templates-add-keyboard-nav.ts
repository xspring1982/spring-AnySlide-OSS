// scripts/patch-templates-add-keyboard-nav.ts
// PR19 — 给完全没有键盘翻页 listener 的 8 个外部模板注入 universal handler
//
// 32 个模板里:
//   - 16 个完整支持 ↑↓←→(不动)
//   - 8 个只支持 ←→(SlideDeckView parent 端的 ↑↓→←→ 转发已覆盖,不动)
//   - 8 个完全没 keydown listener:creative-mode / editorial-tri-tone /
//     neo-grid-bold / peoples-platform / pin-and-paper / pink-script /
//     soft-editorial / stencil-tablet — 这些原始设计是「长滚动页面」,本 patch
//     给它们注入 universal keyboard nav,让 ↑↓←→ + 空格 + PageUp/Down +
//     Home/End 都能翻页(用 scrollIntoView,跟原 stacked 布局兼容)
//
// 用法:
//   npx tsx scripts/patch-templates-add-keyboard-nav.ts
//
// 跑完后 seed-external-templates.ts 重 seed 时会自动读到更新后的 HTML。
// 生产部署后必须跑:
//   npx tsx --env-file=.env.local scripts/seed-external-templates.ts

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const TEMPLATES_DIR = path.resolve(
  process.cwd(),
  "src/lib/slides/templates/external",
);

// 8 个目标 slug(自动检测 = 没 keydown listener,但写死避免 patch 错的)
const TARGETS = [
  "creative-mode",
  "editorial-tri-tone",
  "neo-grid-bold",
  "peoples-platform",
  "pin-and-paper",
  "pink-script",
  "soft-editorial",
  "stencil-tablet",
];

// 注入的 universal keyboard handler
// 设计:
//   - section selector chain 跟 annotate-template-outlines.ts 一致
//   - scrollIntoView 走原生平滑滚动,对 stacked layout 友好
//   - textarea / input 内不拦截
//   - 标记 [data-anyslide-kbnav] 防止重复注入
const INJECT_SCRIPT = `
<script data-anyslide-kbnav="1">
(function(){
  if (window.__anyslideKbNav) return;
  window.__anyslideKbNav = 1;
  function findSections() {
    var selectors = [
      'section.slide',
      '.slide:not(.slides):not(.slide-deck):not(.slide-meta)',
      '[data-slide]',
      'section[data-screen-label]',
      'section.chapter, .chapter',
      'section[class*="s-cover"], section[class^="s-"]'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var found = document.querySelectorAll(selectors[i]);
      if (found.length >= 2) return Array.prototype.slice.call(found);
    }
    var top = document.querySelectorAll('body > section, body > main > section');
    if (top.length >= 2) return Array.prototype.slice.call(top);
    var all = document.querySelectorAll('body *');
    var matched = [];
    for (var j = 0; j < all.length; j++) {
      var el = all[j];
      var cls = el.className || '';
      if (typeof cls !== 'string') continue;
      if (!/\\bs\\d+\\b/.test(cls)) continue;
      if (/(meta|label|hint|footer|header|nav|button|btn|icon|deco)/i.test(cls)) continue;
      matched.push(el);
    }
    return matched;
  }
  var sections = findSections();
  if (sections.length < 2) return;
  var current = 0;
  function go(n) {
    current = Math.max(0, Math.min(sections.length - 1, n));
    try {
      sections[current].scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      sections[current].scrollIntoView();
    }
  }
  document.addEventListener('keydown', function(e) {
    var t = e.target;
    var tag = (t && t.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input' || (t && t.isContentEditable)) return;
    var k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowRight' || k === ' ' || k === 'PageDown') {
      e.preventDefault(); go(current + 1);
    } else if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'PageUp') {
      e.preventDefault(); go(current - 1);
    } else if (k === 'Home') { e.preventDefault(); go(0); }
    else if (k === 'End') { e.preventDefault(); go(sections.length - 1); }
  });
})();
</script>
`;

function patchOne(slug: string): "patched" | "already" | "no-body" {
  const filePath = path.join(TEMPLATES_DIR, `${slug}.html`);
  const html = readFileSync(filePath, "utf-8");
  // 已注入过(脚本带 data-anyslide-kbnav)
  if (html.includes('data-anyslide-kbnav="1"')) return "already";
  // 没 </body>(理论不该,但 robust 处理)
  if (!html.includes("</body>")) return "no-body";
  // 在 </body> 前注入
  const newHtml = html.replace("</body>", `${INJECT_SCRIPT}\n</body>`);
  writeFileSync(filePath, newHtml, "utf-8");
  return "patched";
}

function main() {
  const allFiles = readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".html"));
  const allSlugs = allFiles.map((f) => f.replace(/\.html$/, ""));
  const missingTargets = TARGETS.filter((s) => !allSlugs.includes(s));
  if (missingTargets.length > 0) {
    console.warn(
      `⚠ 部分目标 slug 不在文件夹:${missingTargets.join(", ")}`,
    );
  }

  let patched = 0;
  let already = 0;
  let noBody = 0;
  for (const slug of TARGETS) {
    if (!allSlugs.includes(slug)) continue;
    const result = patchOne(slug);
    if (result === "patched") {
      patched += 1;
      console.log(`  ✓ ${slug}`);
    } else if (result === "already") {
      already += 1;
      console.log(`  ↻ ${slug}(已注入,跳过)`);
    } else {
      noBody += 1;
      console.warn(`  ✗ ${slug}(没 </body>)`);
    }
  }
  console.log(
    `\n✅ 完成 — 注入 ${patched} / 已存在 ${already} / 失败 ${noBody} / 目标 ${TARGETS.length}`,
  );
  console.log(
    `\n下一步:跑 seed-external-templates.ts 把更新后的 HTML 同步到 DB`,
  );
  console.log(`  npx tsx --env-file=.env.local scripts/seed-external-templates.ts`);
}

main();
