// SPEC §5.3.2 Claude / 文本 adapter 抽象
//
// 三档(SPEC §5.3.2 模型档位):
//   - high  → claude-opus-4-7(SPEC 默认),M1 阶段我们用 deepseek-v4-pro 替代
//   - default → claude-sonnet-4-6(SPEC 默认),M1 阶段我们用 deepseek-v4-flash 替代
//   - low → deepseek-v3 / qwen-72b(SPEC 兜底,M1 暂不接)
//
// 实际 model id 由环境变量 ANYSLIDE_TEXT_MODEL_DEFAULT / ANYSLIDE_TEXT_MODEL_HIGH 决定,
// 让上线时切真 Claude 只需改环境变量。

export type TextTier = "default" | "high" | "low";

export interface TextCompleteInput {
  /** system prompt(支持 prompt caching,详 SPEC §5.3.2) */
  system: string;
  /** user message */
  user: string;
  /** 档位,默认 'default' */
  tier?: TextTier;
  /** 默认 4096 */
  maxTokens?: number;
  /** 默认 0.7 */
  temperature?: number;
  /**
   * 启用 prompt caching(SPEC §5.3.2 关键)。
   * 在 Anthropic 兼容 endpoint 下,system 前缀加 cache_control: ephemeral,
   * 5 分钟 TTL,命中后第二次起 cost ≈ 10%。
   */
  cacheSystem?: boolean;
}

export interface TextCompleteOutput {
  /** Claude 返回的纯文本(若多段拼接成一段) */
  text: string;
  /** token 用量(用于成本监控,SPEC §6.4.4 cache 命中率) */
  usage: {
    inputTokens: number;
    outputTokens: number;
    /** 缓存命中读取的 token,SPEC §6.4.4 监控目标 ≥ 70% */
    cacheReadTokens?: number;
    /** 写入缓存的 token */
    cacheWriteTokens?: number;
  };
  /** 实际用的 model id,用于日志 */
  model: string;
}

export interface TextAdapter {
  /** 单轮文本补全(JSON 输出场景下 caller 自己 JSON.parse + 重试) */
  complete(input: TextCompleteInput): Promise<TextCompleteOutput>;
}
