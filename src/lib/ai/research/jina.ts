// SPEC §5.6 — Jina Reader 联网调研
//
// 用法:
//   const ctx = await jinaResearch(input);  // input 是用户原始文本
//   if (ctx) addToAnalyzePrompt({ researchContext: ctx });
//
// 触发条件(可由 caller 决定):
//   - 用户输入 < 100 字  → 不够 LLM 写大纲,联网搜补
//   - 输入是纯 URL       → 直接抓正文
//   - 输入含 URL         → 抓 URL 内容补到 prompt
//
// Jina Reader API:
//   GET https://r.jina.ai/{URL}     → 返回 markdown 格式正文
//   免费档:不带 key 限速;带 Authorization: Bearer <JINA_API_KEY> 限额提升 100x

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const MAX_RESEARCH_LENGTH = 4000; // 截断到 4000 字符,避免 prompt 爆炸
const FETCH_TIMEOUT_MS = 25_000;

export interface JinaResearchResult {
  /** 抓到的 markdown 正文,已截断 */
  content: string;
  /** 原始 URL */
  sourceUrl: string;
  /** 截断前长度 */
  rawLength: number;
}

/**
 * 提取用户输入里的 URL 列表(若有)
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  // 去重 + 限 5 个(避免一次抓太多)
  return Array.from(new Set(matches)).slice(0, 5);
}

/**
 * 判断用户输入是否需要联网补内容
 * - 纯 URL(整段 trim 后是单个 URL)→ true
 * - 含 URL → true
 * - 字数 < 100 → true(可能是简短主题描述)
 */
export function shouldResearch(text: string): boolean {
  const t = text.trim();
  if (extractUrls(t).length > 0) return true;
  return t.length < 100;
}

/**
 * 抓单个 URL,返回截断后的 markdown 内容
 */
export async function fetchOne(url: string): Promise<JinaResearchResult | null> {
  const apiKey = process.env.JINA_API_KEY;
  const headers: Record<string, string> = {
    Accept: "text/plain",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[jina] HTTP ${res.status} for ${url}`);
      return null;
    }
    const raw = await res.text();
    return {
      content: raw.slice(0, MAX_RESEARCH_LENGTH),
      sourceUrl: url,
      rawLength: raw.length,
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[jina] fetch ${url} failed:`, (e as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 主入口:基于用户输入决定要不要抓,返回 researchContext 字符串
 *
 * - 没 URL + 字数充足 → 返回 null(不需联网)
 * - 有 URL → 抓最多 3 个 URL,拼合后返回
 * - 短文本无 URL → 返回 null(目前不做"基于关键词搜索",M3 接 SerpAPI 时再加)
 */
export async function jinaResearch(text: string): Promise<string | null> {
  if (!shouldResearch(text)) return null;
  const urls = extractUrls(text);
  if (urls.length === 0) return null; // M2 暂不做关键词搜索,只抓显式 URL

  const results = await Promise.all(urls.slice(0, 3).map(fetchOne));
  const ok = results.filter((r): r is JinaResearchResult => r !== null);
  if (ok.length === 0) return null;

  return ok
    .map(
      (r) =>
        `## 抓自 ${r.sourceUrl}(原文 ${r.rawLength} 字符,已截到 ${MAX_RESEARCH_LENGTH})\n\n${r.content}`,
    )
    .join("\n\n---\n\n");
}
