// Phase 3 PR36:.pptx 文件解析器 → 提取每页结构 + 文字 + 图片引用
//
// 跟 AnyGen 对照:
//   AnyGen: slides_convert sandbox tool(Python python-pptx + 转 Lark sml/2.0)
//   我们:   纯 Node 实现(jszip 已在 deps + xml regex,无 Python 依赖)
//
// 设计哲学:
//   - **保留每页原始文字 + 图片元数据**,不试图理解内容(那是 LLM 的活)
//   - 输出一份"原始 blueprint 草稿"(role / 文字 runs / 图片 ref)
//   - 喂给后续 Improve LLM agent,让 LLM 决定怎么重新排版(选模板版式 / 加 layout_hint)
//
// MVP 限制(后续增强):
//   - 仅提取文字 / 图片引用 / 简单 layout 信息
//   - 不解析复杂图表 / SmartArt / 嵌入对象(原 PPT 这些会保留 placeholder 提示)
//   - 不分析"原 PPT 的颜色 / 字体"(那是 Phase 5 模板继承的事)

import JSZip from "jszip";
import type {
  DeckBlueprint,
  SlideBlueprint,
} from "../slides/blueprint/schema";

/** 解析单个 slide XML 的产物 — 草稿 blueprint(role 由 LLM 后续决定) */
interface RawSlideData {
  /** 1-based */
  page_no: number;
  /** 原 slide XML 里所有 <a:t> 文字节点(顺序保留) */
  text_runs: string[];
  /** 原 slide 引用的图片文件名(ppt/media/...) */
  image_refs: string[];
  /** 演讲者备注(从 notes/notesSlide*.xml 提取) */
  speaker_notes?: string;
  /** raw XML 长度(用于调试 / 内容多寡判断) */
  xml_size: number;
}

/** 解析整个 .pptx → 提取每页文字 + 图片 + 总览 */
export async function parsePptx(buffer: Buffer): Promise<{
  total_pages: number;
  total_media: number;
  total_media_bytes: number;
  slides: RawSlideData[];
  /** 大图警告(> 5MB 单图)— 上传 AnyGen / 我们 LLM context 都吃不消 */
  warnings: Array<{ kind: "huge_image"; name: string; mb: number }>;
}> {
  const zip = await JSZip.loadAsync(buffer);

  // 1. 列所有 slide XML(ppt/slides/slide1.xml, slide2.xml, ...)
  const slidePaths = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const an = parseInt(a.match(/slide(\d+)/)?.[1] ?? "0", 10);
      const bn = parseInt(b.match(/slide(\d+)/)?.[1] ?? "0", 10);
      return an - bn;
    });

  // 2. 列所有 notes(speaker notes)
  const notesByPage = new Map<number, string>();
  const notesPaths = Object.keys(zip.files).filter((n) =>
    /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n),
  );
  for (const np of notesPaths) {
    const n = parseInt(np.match(/notesSlide(\d+)/)?.[1] ?? "0", 10);
    if (n === 0) continue;
    const xml = await zip.files[np].async("string");
    const texts = extractTextRuns(xml);
    if (texts.length > 0) notesByPage.set(n, texts.join("\n").trim());
  }

  // 3. 媒体文件清单 + 大图警告
  const mediaPaths = Object.keys(zip.files).filter((n) =>
    n.startsWith("ppt/media/"),
  );
  let totalMediaBytes = 0;
  const warnings: Array<{ kind: "huge_image"; name: string; mb: number }> = [];
  for (const mp of mediaPaths) {
    const f = zip.files[mp];
    if (f.dir) continue;
    const buf = await f.async("nodebuffer");
    totalMediaBytes += buf.length;
    const mb = buf.length / 1024 / 1024;
    if (mb > 5) {
      warnings.push({
        kind: "huge_image",
        name: mp.split("/").pop() ?? mp,
        mb: Math.round(mb * 10) / 10,
      });
    }
  }

  // 4. 解析每页 slide
  const slides: RawSlideData[] = [];
  for (let i = 0; i < slidePaths.length; i++) {
    const sp = slidePaths[i];
    const xml = await zip.files[sp].async("string");
    const text_runs = extractTextRuns(xml);
    const image_refs = extractImageRefs(xml);
    const page_no = i + 1;
    slides.push({
      page_no,
      text_runs,
      image_refs,
      speaker_notes: notesByPage.get(page_no),
      xml_size: xml.length,
    });
  }

  return {
    total_pages: slides.length,
    total_media: mediaPaths.filter((p) => !zip.files[p].dir).length,
    total_media_bytes: totalMediaBytes,
    slides,
    warnings,
  };
}

/** 从 OOXML 提取所有 <a:t> 文字节点 — slide / notes 通用 */
function extractTextRuns(xml: string): string[] {
  const matches = xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g);
  return Array.from(matches, (m) => m[1].trim()).filter((t) => t.length > 0);
}

/** 提取 slide 里引用的图片 relationship id(简化:抓 <a:blip r:embed="rIdN"/>) */
function extractImageRefs(xml: string): string[] {
  const matches = xml.matchAll(/<a:blip[^>]+r:embed="([^"]+)"/g);
  return Array.from(matches, (m) => m[1]);
}

/** 启发式:根据 page_no + 文字内容猜 role(给 LLM 一个 hint,不强制)
 *  - page 1 → cover
 *  - last page → closing
 *  - 含"目录/议程/Agenda/Contents"标题 → agenda
 *  - 其他 → content
 */
function guessRole(
  page_no: number,
  total: number,
  text_runs: string[],
): SlideBlueprint["role"] {
  if (page_no === 1) return "cover";
  if (page_no === total) return "closing";
  const joined = text_runs.join(" ").slice(0, 100);
  if (/目录|议程|Agenda|Contents|Outline|大纲/i.test(joined)) return "agenda";
  return "content";
}

/**
 * 把解析结果转成"草稿 DeckBlueprint" — 给 Improve LLM agent 用。
 * LLM 会基于此重新分配 layout_hint / 优化文字 / 重排 bullets,最终输出"美化版" blueprint。
 */
export function rawToBlueprintDraft(
  raw: Awaited<ReturnType<typeof parsePptx>>,
  meta: {
    title: string;
    topic: string;
    locale: "zh" | "en" | "zh-TW" | "ja" | "ko";
    template_id: string;
  },
): DeckBlueprint {
  const total = raw.total_pages;
  const slides: SlideBlueprint[] = raw.slides.map((s) => {
    const role = guessRole(s.page_no, total, s.text_runs);
    // 把 text_runs 第一条当 title,剩下当 bullets(粗暴 MVP,LLM 后续重新分配)
    const [title = "", ...rest] = s.text_runs;
    const slots: Record<string, string | string[]> = {};
    if (role === "cover") {
      slots.title = title;
      if (rest[0]) slots.subtitle = rest[0];
      if (rest[1]) slots.byline = rest.slice(1).join(" · ");
    } else if (role === "agenda") {
      slots.title = title;
      slots.items = rest;
    } else if (role === "closing") {
      slots.title = title;
      if (rest.length > 0) slots.contact = rest.join(" · ");
    } else {
      // content
      slots.title = title;
      if (rest.length > 0) slots.bullets = rest;
    }
    return {
      page_no: s.page_no,
      template_section_index: s.page_no, // MVP:直接 1:1 对应,LLM 后续可重排
      role,
      layout_intent: role === "content" ? "bullets" : role,
      slots,
      speaker_notes: s.speaker_notes,
    };
  });

  return {
    meta: {
      title: meta.title,
      topic: meta.topic,
      template_id: meta.template_id,
      locale: meta.locale,
      ratio: "16:9",
    },
    slides,
  };
}
