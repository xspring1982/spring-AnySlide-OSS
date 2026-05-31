// Phase 5 PR44 (MVP):从用户上传 .pptx 提取 theme (色谱 + 字体)
//
// 用途:
//   - 给后续 "模板继承" 功能打基础
//   - 用户上传公司 PPT → 我们提取主色 / 辅色 / 标题字体 / 正文字体
//   - 后续生成新 deck 时套用这些品牌元素(对标 AnyGen "Upload template")
//
// 当前 MVP 只提取 color + font。后续:
//   - Logo 提取(slideMaster1.xml 找定位的 picture)
//   - 整体 layout master(复杂)
//
// OOXML theme 标准结构(ppt/theme/theme1.xml):
//   <a:theme>
//     <a:themeElements>
//       <a:clrScheme>...6 accent + dk1/lt1/dk2/lt2 + hlink/folHlink</a:clrScheme>
//       <a:fontScheme>
//         <a:majorFont><a:latin typeface="..."/></a:majorFont>  ← 标题字体
//         <a:minorFont><a:latin typeface="..."/></a:minorFont>  ← 正文字体
//       </a:fontScheme>
//     </a:themeElements>
//   </a:theme>

import JSZip from "jszip";

export interface ExtractedTheme {
  /** 主色谱(6 个 accent + dk1/lt1/dk2/lt2 = 10 个标准 OOXML 颜色,16 进制无 # 前缀) */
  colors: {
    dk1?: string; // dark 1(通常文字色)
    lt1?: string; // light 1(通常背景色)
    dk2?: string; // dark 2(辅色)
    lt2?: string;
    accent1?: string;
    accent2?: string;
    accent3?: string;
    accent4?: string;
    accent5?: string;
    accent6?: string;
    hlink?: string; // 超链接
    folHlink?: string; // 已访问超链接
  };
  /** 字体方案 */
  fonts: {
    majorLatin?: string; // 标题字体(英文)
    majorEa?: string; // 标题字体(东亚 — 中日韩)
    minorLatin?: string; // 正文字体(英文)
    minorEa?: string;
  };
  /** 主题名(theme.xml 里 name 属性,通常是 "Office" / "Facet" / 用户公司名) */
  themeName?: string;
}

/** 从 .pptx Buffer 提取 theme */
export async function extractTheme(buffer: Buffer): Promise<ExtractedTheme> {
  const zip = await JSZip.loadAsync(buffer);

  // 找 theme1.xml(通常这一个,有些 PPT 有 theme2.xml 但 master 引第一个)
  const themePath = Object.keys(zip.files).find((n) =>
    /^ppt\/theme\/theme\d+\.xml$/.test(n),
  );
  if (!themePath) {
    return { colors: {}, fonts: {} };
  }
  const xml = await zip.files[themePath].async("string");
  return parseThemeXml(xml);
}

/** Parse theme XML(无外部 lib,纯 regex 抓取 — OOXML 格式稳定不易变)*/
function parseThemeXml(xml: string): ExtractedTheme {
  const result: ExtractedTheme = { colors: {}, fonts: {} };

  // theme name
  const nameMatch = xml.match(/<a:theme[^>]*name="([^"]+)"/);
  if (nameMatch) result.themeName = nameMatch[1];

  // ===== colors =====
  // <a:clrScheme>...</a:clrScheme>
  const clrSchemeMatch = xml.match(/<a:clrScheme[^>]*>([\s\S]*?)<\/a:clrScheme>/);
  if (clrSchemeMatch) {
    const inner = clrSchemeMatch[1];
    // 每个 color 块:<a:accent1>...</a:accent1> or <a:dk1>...</a:dk1>
    const COLOR_KEYS: Array<keyof ExtractedTheme["colors"]> = [
      "dk1",
      "lt1",
      "dk2",
      "lt2",
      "accent1",
      "accent2",
      "accent3",
      "accent4",
      "accent5",
      "accent6",
      "hlink",
      "folHlink",
    ];
    for (const key of COLOR_KEYS) {
      const blockMatch = inner.match(
        new RegExp(`<a:${key}[^>]*>([\\s\\S]*?)<\\/a:${key}>`),
      );
      if (!blockMatch) continue;
      const block = blockMatch[1];
      // 优先 srgbClr,fallback sysClr lastClr
      const srgbMatch = block.match(/<a:srgbClr[^>]*val="([0-9A-Fa-f]{6})"/);
      const sysClrMatch = block.match(/<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/);
      const hex = (srgbMatch?.[1] ?? sysClrMatch?.[1] ?? "").toUpperCase();
      if (hex) result.colors[key] = hex;
    }
  }

  // ===== fonts =====
  const majorMatch = xml.match(/<a:majorFont>([\s\S]*?)<\/a:majorFont>/);
  if (majorMatch) {
    const latin = majorMatch[1].match(/<a:latin[^>]*typeface="([^"]+)"/);
    const ea = majorMatch[1].match(/<a:ea[^>]*typeface="([^"]+)"/);
    if (latin?.[1]) result.fonts.majorLatin = latin[1];
    if (ea?.[1]) result.fonts.majorEa = ea[1];
  }
  const minorMatch = xml.match(/<a:minorFont>([\s\S]*?)<\/a:minorFont>/);
  if (minorMatch) {
    const latin = minorMatch[1].match(/<a:latin[^>]*typeface="([^"]+)"/);
    const ea = minorMatch[1].match(/<a:ea[^>]*typeface="([^"]+)"/);
    if (latin?.[1]) result.fonts.minorLatin = latin[1];
    if (ea?.[1]) result.fonts.minorEa = ea[1];
  }

  return result;
}
