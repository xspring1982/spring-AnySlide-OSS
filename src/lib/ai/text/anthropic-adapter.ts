// Anthropic SDK 文本 adapter
//
// 这一份适配两个真实端点:
//   1. 真 Claude(上线时)— ANTHROPIC_BASE_URL 不设,SDK 默认走 api.anthropic.com
//   2. DeepSeek Anthropic 兼容(M1 起步)— ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
//
// SPEC §5.3.2 prompt caching 的 cache_control: ephemeral 字段两边都支持,
// 切真 Claude 时只需改环境变量。

import Anthropic from "@anthropic-ai/sdk";
import type {
  TextAdapter,
  TextCompleteInput,
  TextCompleteOutput,
  TextTier,
} from "./types";

function resolveModel(tier: TextTier): string {
  // SPEC §5.3.2 三档,实际 ID 由环境变量解析(便于切换真 Claude / DeepSeek)
  if (tier === "high") {
    return process.env.ANYSLIDE_TEXT_MODEL_HIGH ?? "claude-opus-4-7";
  }
  if (tier === "low") {
    return process.env.ANYSLIDE_TEXT_MODEL_LOW ?? "deepseek-v4-flash";
  }
  return process.env.ANYSLIDE_TEXT_MODEL_DEFAULT ?? "claude-sonnet-4-6";
}

export class AnthropicAdapter implements TextAdapter {
  private readonly client: Anthropic;

  constructor(opts?: { apiKey?: string; baseUrl?: string }) {
    // 注意:这里读的是 ANYSLIDE_TEXT_API_KEY,不是 ANTHROPIC_API_KEY。
    // @anthropic-ai/sdk import 时会清空 process.env.ANTHROPIC_API_KEY
    //(安全做法,防泄露),所以我们用独立键名避免冲突,然后显式传给 SDK。
    const apiKey =
      opts?.apiKey ??
      process.env.ANYSLIDE_TEXT_API_KEY ??
      process.env.ANTHROPIC_API_KEY; // 兜底:线上切真 Claude 时仍能 fallback
    if (!apiKey) {
      throw new Error(
        "AnthropicAdapter: 未找到 ANYSLIDE_TEXT_API_KEY(也无 ANTHROPIC_API_KEY 兜底)",
      );
    }
    const baseURL =
      opts?.baseUrl ??
      process.env.ANYSLIDE_TEXT_BASE_URL ??
      process.env.ANTHROPIC_BASE_URL;
    this.client = new Anthropic({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });
  }

  async complete(input: TextCompleteInput): Promise<TextCompleteOutput> {
    const model = resolveModel(input.tier ?? "default");
    const systemBlock = input.cacheSystem
      ? [
          {
            type: "text" as const,
            text: input.system,
            cache_control: { type: "ephemeral" as const },
          },
        ]
      : input.system;

    const response = await this.client.messages.create({
      model,
      max_tokens: input.maxTokens ?? 4096,
      temperature: input.temperature ?? 0.7,
      system: systemBlock,
      messages: [{ role: "user", content: input.user }],
    });

    // 提取 text(SDK 返回 content blocks 数组,我们只用 type='text' 的)
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    const usage = response.usage as {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };

    return {
      text,
      usage: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: usage.cache_read_input_tokens,
        cacheWriteTokens: usage.cache_creation_input_tokens,
      },
      model,
    };
  }
}
