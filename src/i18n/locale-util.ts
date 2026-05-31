// M9 多语言 — 跨前后端共享的 locale 工具
//
// 用途:
//   1. 模板 i18n JSONB 字段的 fallback 链解析(pickLocalized)
//   2. 服务端从 cookie / Accept-Language 检测 locale(detectRequestLocale)
//   3. 给 LLM prompt 注入 locale 相关指令(语言名 + 字体栈 + 排版铁律)
//
// fallback 链原则(2026-05-09):
//   先取 i18n[locale] → 缺则取 i18n.en → 缺则取 i18n.zh → 还缺就用旧字段(单语言)
//   en 是 defaultLocale,所以 en 永远兜底;zh 是 dev 期最完整的,做次级兜底
//
// 字体策略(SPEC §5.7.4):
//   每种语言用对应国家的 Noto Sans 或系统字体,确保 CJK 正确渲染。
//   AI 在生成 HTML 时收到这套字体提示,自动用 font-family 写入 <style>。

import type { Locale } from "./routing";

export const ALL_LOCALES: readonly Locale[] = ["en", "zh", "zh-TW", "ja", "ko"] as const;

/**
 * 从 i18n JSONB 对象取本 locale 的值,带 fallback 链
 *
 * @example
 *   pickLocalized({ en: "Hello", zh: "你好" }, "ja") // → "Hello"(fallback en)
 *   pickLocalized({ zh: "你好" }, "en", "fallback") // → "fallback"(en/zh 都有但不命中,见用法)
 *   pickLocalized(null, "en", "fallback") // → "fallback"
 */
export function pickLocalized(
  i18n: Partial<Record<Locale, string>> | null | undefined,
  locale: Locale,
  fallback: string = "",
): string {
  if (!i18n || typeof i18n !== "object") return fallback;
  // 1. 命中目标 locale
  if (i18n[locale] && i18n[locale]!.trim()) return i18n[locale]!;
  // 2. fallback 到 en
  if (i18n.en && i18n.en.trim()) return i18n.en;
  // 3. fallback 到 zh(dev 期最完整)
  if (i18n.zh && i18n.zh.trim()) return i18n.zh;
  // 4. 取任意非空值
  for (const v of Object.values(i18n)) {
    if (v && v.trim()) return v;
  }
  return fallback;
}

/**
 * 从 NextRequest 的 cookie 或 Accept-Language header 解析 locale。
 * 走和 next-intl middleware 一致的逻辑(优先 NEXT_LOCALE cookie),
 * 用于 API 路由(POST /api/tasks 等)在没有 locale path segment 时确定语言。
 */
export function detectRequestLocale(req: {
  cookies: { get(name: string): { value: string } | undefined };
  headers: { get(name: string): string | null };
}): Locale {
  // 1. NEXT_LOCALE cookie(用户在 UI 上切语言时由前端写入,优先级最高)
  const cookie = req.cookies.get("NEXT_LOCALE")?.value;
  if (cookie && (ALL_LOCALES as readonly string[]).includes(cookie)) {
    return cookie as Locale;
  }
  // 2. Accept-Language header(浏览器自带)
  const accept = req.headers.get("accept-language") ?? "";
  // 简化解析:挨个看 ALL_LOCALES 里哪个先在 header 里出现
  // zh-CN / zh-Hans 都映射到 zh;zh-TW / zh-Hant 映射到 zh-TW
  const lower = accept.toLowerCase();
  if (lower.includes("zh-tw") || lower.includes("zh-hant")) return "zh-TW";
  if (lower.includes("zh")) return "zh";
  if (lower.includes("ja")) return "ja";
  if (lower.includes("ko")) return "ko";
  if (lower.includes("en")) return "en";
  // 3. fallback 到 zh(老用户大多中文,与现有 schema default 对齐)
  return "zh";
}

/** 给 LLM prompt 注入用:本 locale 的本族语言名(中文叫"中文",英文叫"English",etc.) */
export const LOCALE_NATIVE_NAME: Record<Locale, string> = {
  en: "English",
  zh: "Simplified Chinese (简体中文)",
  "zh-TW": "Traditional Chinese (繁體中文)",
  ja: "Japanese (日本語)",
  ko: "Korean (한국어)",
};

/** AI 渲染 HTML 时的 font-family 推荐栈(按 locale 选合适的 CJK 字体)*/
export const LOCALE_FONT_STACK: Record<Locale, { heading: string; body: string }> = {
  en: {
    heading: '"Inter", "Helvetica Neue", system-ui, sans-serif',
    body: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  },
  zh: {
    heading: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    body: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  },
  "zh-TW": {
    heading: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif',
    body: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif',
  },
  ja: {
    heading: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", "Yu Gothic", system-ui, sans-serif',
    body: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", "Yu Gothic", system-ui, sans-serif',
  },
  ko: {
    heading: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif',
    body: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif',
  },
};

/**
 * 各语言的"排版铁律"提示,塞到 LLM system prompt 里防止常见排版问题。
 * 这是 fillL1Template / prompt-assembly 中文路径的多语言扩展。
 */
export const LOCALE_TYPOGRAPHY_RULES: Record<Locale, string> = {
  en: `# English typography rules
- Avoid orphans/widows: don't let a single word sit alone on the last line of a paragraph or a single line at the top of a column.
- Use sentence case for body text and title case for headlines (unless the brand voice dictates otherwise).
- Don't break compound terms ("New York", "AI-powered") across lines — use &nbsp; if needed.
- Numbers and units stay together: "10 MB", "5 days" should never wrap.
- Keep headlines under 8 words when possible; use <br/> at natural phrase boundaries for longer titles.`,
  zh: `# 中文排版铁律(必须遵守)
- **禁止单字孤行**:中文标题换行后,绝不能让单个汉字(尤其是「的、了、是、在、和、与、为、之」等虚词)独占最后一行。
- **手动控制断行**:超过 8 个汉字的标题,**必须**自己用 <br/> 在语义节奏点断开,不要让浏览器自动换行。
- **断行点选择原则**:在「主谓 / 动宾 / 短语」边界断,不要在助词前断。
- **数字 + 量词 + 名词必须粘在一起**:「3 个真坑」、「5 大趋势」、「10 条铁律」永远整体出现。
- **副标 / 正文同理**:超过 20 字的副标,在标点处主动 <br/> 一次。
- **保留模板原有 <br/> 节奏**:demo 文字本身用了 <br/> 断行的位置,改写时保留断行位置,只换文字。`,
  "zh-TW": `# 繁體中文排版鐵律(必須遵守)
- **禁止單字孤行**:中文標題換行後,絕不能讓單個漢字(尤其是「的、了、是、在、和、與、為、之」等虛詞)獨佔最後一行。
- **手動控制斷行**:超過 8 個漢字的標題,**必須**自己用 <br/> 在語義節奏點斷開。
- **斷行點選擇原則**:在「主謂 / 動賓 / 短語」邊界斷,不要在助詞前斷。
- **數字 + 量詞 + 名詞必須黏在一起**:「3 個真坑」、「5 大趨勢」永遠整體出現。
- **副標 / 正文同理**:超過 20 字的副標,在標點處主動 <br/> 一次。
- **保留模板原有 <br/> 節奏**:demo 文字本身用了 <br/> 斷行的位置,改寫時保留斷行位置,只換文字。`,
  ja: `# 日本語の組版ルール(必ず遵守)
- **行末禁則**:句読点(、。)・閉じ括弧・小書き仮名(っ、ゃ、ゅ、ょ)を行頭に置かない。
- **行頭禁則**:開き括弧を行末に置かない。
- **助詞の孤立を避ける**:助詞(は、が、を、に、で、と)が単独で行末・行頭に残らないよう、長いタイトルは <br/> で意味の切れ目で改行する。
- **数字と単位の一体化**:「10 MB」「3 つ」「5 日間」は必ず同じ行に。
- **タイトルは 12 字以内**を目安に、長い場合は <br/> で語句の境界で改行。
- **テンプレート元の <br/> リズムを保持**:デモ文の改行位置を維持し、文字だけを差し替える。`,
  ko: `# 한국어 조판 규칙(반드시 준수)
- **고아 글자 방지**: 제목 줄바꿈 시 조사(은/는/이/가/을/를/에/에서/와/과)나 한 글자가 마지막 줄에 단독으로 남지 않도록 한다.
- **수동 줄바꿈 조절**: 8 자 이상의 제목은 의미 단위 경계에서 <br/> 로 직접 끊어준다.
- **숫자 + 단위는 붙여 쓴다**: "10 MB", "3 가지", "5 일간"은 반드시 같은 줄에.
- **체언 + 조사는 함께**: "전략의", "결과를" 같이 체언과 조사를 떨어뜨리지 않는다.
- **부제 / 본문도 동일**: 20 자 이상의 부제는 문장 부호 위치에서 <br/> 한 번 넣는다.
- **템플릿 원본의 <br/> 리듬 유지**: 데모 문구가 <br/> 로 끊어둔 위치는 그대로 두고 글자만 교체.`,
};
