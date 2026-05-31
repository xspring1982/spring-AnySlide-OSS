// SPEC §0.5 / §6.1 安全审查 S1 — NSFW 检测(2026-05-05)
//
// 调用 OpenAI omni-moderation-latest 模型(免费 + 多模态,接受图片 URL)
// 时机:image / cards / slides L2 出图后,appendTaskFile 之前
// 失败处理:不存图、退积分、task=failed,错误原因写 errorMessage
//
// 文档:https://platform.openai.com/docs/guides/moderation

const MODERATION_API_URL = "https://api.openai.com/v1/moderations";
const MODERATION_MODEL = "omni-moderation-latest";

const MODERATION_TIMEOUT_MS = 15_000;

export interface NSFWCheckResult {
  safe: boolean;
  /** 触发的违规分类(若 safe=true 则为空数组)*/
  flaggedCategories: string[];
  /** 各分类的置信度分数,便于审计 */
  scores?: Record<string, number>;
  /** 网络/接口错误时填,safe 默认 true(fail-open,避免接口故障阻塞业务)*/
  error?: string;
}

interface OpenAIModerationCategoryScores {
  [key: string]: number;
}

interface OpenAIModerationCategories {
  [key: string]: boolean;
}

interface OpenAIModerationResult {
  flagged: boolean;
  categories: OpenAIModerationCategories;
  category_scores: OpenAIModerationCategoryScores;
}

interface OpenAIModerationResponse {
  id: string;
  model: string;
  results: OpenAIModerationResult[];
}

/**
 * 调 OpenAI Moderation 检查图片 URL 是否含违规内容
 *
 * 失败策略:
 * - 网络错误 / API 故障:返回 safe=true,记 error 字段(fail-open,不卡业务)
 * - 真违规:返回 safe=false,flaggedCategories 列出触发的分类
 *
 * 成本:免费(Moderation API 不计 token)
 * 延迟:typically 200-800ms per image
 */
export async function checkImageNSFW(imageUrl: string): Promise<NSFWCheckResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[nsfw] OPENAI_API_KEY 未配置,跳过 NSFW 检查(fail-open)");
    return { safe: true, flaggedCategories: [], error: "OPENAI_API_KEY 未配置" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);

  try {
    const resp = await fetch(MODERATION_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        input: [{ type: "image_url", image_url: { url: imageUrl } }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.warn(
        `[nsfw] OpenAI Moderation API ${resp.status}: ${text.slice(0, 200)} — fail-open`,
      );
      return {
        safe: true,
        flaggedCategories: [],
        error: `OpenAI Moderation API ${resp.status}`,
      };
    }

    const data = (await resp.json()) as OpenAIModerationResponse;
    const result = data.results?.[0];
    if (!result) {
      console.warn("[nsfw] OpenAI Moderation API 返回空 results — fail-open");
      return { safe: true, flaggedCategories: [], error: "empty results" };
    }

    if (!result.flagged) {
      return { safe: true, flaggedCategories: [], scores: result.category_scores };
    }

    const flaggedCategories = Object.entries(result.categories)
      .filter(([, v]) => v === true)
      .map(([k]) => k);

    return {
      safe: false,
      flaggedCategories,
      scores: result.category_scores,
    };
  } catch (e) {
    clearTimeout(timeoutId);
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[nsfw] check failed: ${msg} — fail-open`);
    return { safe: true, flaggedCategories: [], error: msg };
  }
}

/**
 * T2-50:文本预审 — 任务提交时调,在 chargeCredits / 入 inngest 前秒拦违规 prompt。
 *
 * 与 checkImageNSFW 共用 omni-moderation-latest 模型 + 同一套 fail-open 策略,
 * 仅 input 类型从 image_url 换成 text。延迟 typically 100-400ms,免费。
 *
 * 用法:
 *   const r = await checkTextNSFW(sourceText);
 *   if (!r.safe) return Response.json({ error: nsfwCategoriesToUserMessage(r.flaggedCategories) }, { status: 400 });
 */
export async function checkTextNSFW(text: string): Promise<NSFWCheckResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[nsfw] OPENAI_API_KEY 未配置,跳过文本 NSFW 检查(fail-open)");
    return { safe: true, flaggedCategories: [], error: "OPENAI_API_KEY 未配置" };
  }

  // 空文本无需检测,放行
  const trimmed = text?.trim();
  if (!trimmed) return { safe: true, flaggedCategories: [] };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);

  try {
    const resp = await fetch(MODERATION_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        input: [{ type: "text", text: trimmed }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.warn(
        `[nsfw] OpenAI Moderation(text)API ${resp.status}: ${t.slice(0, 200)} — fail-open`,
      );
      return {
        safe: true,
        flaggedCategories: [],
        error: `OpenAI Moderation API ${resp.status}`,
      };
    }

    const data = (await resp.json()) as OpenAIModerationResponse;
    const result = data.results?.[0];
    if (!result) {
      console.warn("[nsfw] text moderation 返回空 results — fail-open");
      return { safe: true, flaggedCategories: [], error: "empty results" };
    }
    if (!result.flagged) {
      return { safe: true, flaggedCategories: [], scores: result.category_scores };
    }
    const flaggedCategories = Object.entries(result.categories)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    return { safe: false, flaggedCategories, scores: result.category_scores };
  } catch (e) {
    clearTimeout(timeoutId);
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[nsfw] text check failed: ${msg} — fail-open`);
    return { safe: true, flaggedCategories: [], error: msg };
  }
}

/**
 * 把违规分类翻译成用户友好的中文提示。
 * context="image" 用于出图后审(已有);context="text" 用于 T2-50 文本预审,文案换主语。
 */
export function nsfwCategoriesToUserMessage(
  categories: string[],
  context: "image" | "text" = "image",
): string {
  const subject = context === "text" ? "你的输入" : "图片";
  if (categories.length === 0) return `${subject}内容不符合内容安全政策`;
  const map: Record<string, string> = {
    sexual: "成人内容",
    "sexual/minors": "未成年人相关敏感内容",
    violence: "暴力内容",
    "violence/graphic": "血腥暴力内容",
    "self-harm": "自伤相关内容",
    "self-harm/intent": "自伤意图相关内容",
    "self-harm/instructions": "自伤教学相关内容",
    hate: "仇恨言论",
    "hate/threatening": "威胁性仇恨内容",
    harassment: "骚扰内容",
    "harassment/threatening": "威胁性骚扰内容",
    illicit: "违法内容",
    "illicit/violent": "暴力违法内容",
  };
  const labels = categories.map((c) => map[c] ?? c);
  return `${subject}包含: ${labels.join("、")},不符合内容安全政策。请调整${context === "text" ? "描述" : "提示词"}后重试,本次不扣积分。`;
}
