// task.slug 生成：从用户输入或 AI 生成的标题里取关键词，转 URL 友好串
// MVP 版本：纯字符串处理，未引入分词。Phase 2 接 Claude 后由 analyze.ts 输出更准的 slug。

const STOPWORDS = new Set([
  "的", "了", "和", "是", "在", "我", "有", "不", "也", "就", "都", "要", "啊",
  "the", "a", "an", "of", "in", "on", "for", "to", "and", "or", "with",
]);

export function makeSlug(input: string, fallback = "untitled"): string {
  if (!input) return fallback;
  // 1. 取首段（避免太长）
  const first = input.split(/[\n\r]/)[0].trim().slice(0, 80);
  // 2. 拆词（中文按字 + 英文按空格）
  const tokens: string[] = [];
  let buf = "";
  for (const ch of first) {
    if (/[a-z0-9]/i.test(ch)) {
      buf += ch.toLowerCase();
    } else {
      if (buf) tokens.push(buf);
      buf = "";
      // 中文/日文/韩文 按字
      if (/[぀-ヿ㐀-鿿가-힯]/.test(ch)) {
        tokens.push(ch);
      }
    }
  }
  if (buf) tokens.push(buf);

  // 3. 去停用词 + 取前 6 个
  const useful = tokens.filter((t) => !STOPWORDS.has(t)).slice(0, 6);
  const slug = useful.join("-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug || fallback;
}
