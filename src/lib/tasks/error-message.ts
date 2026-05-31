// T2-51:把 Inngest handler 抛出的原始 Error.message 翻译成用户友好的中文
//
// 各 inngest handler 抛错时使用形如 "NSFW_BLOCKED: <userMsg>" / "INSUFFICIENT_CREDITS: ..." 的前缀,
// 这里识别这些前缀并转成无前缀的友好文案;无前缀的也返回截断的原文,避免一刀切丢失诊断信息。
//
// 用法:
//   await updateTaskStatus(taskId, "failed", null, toUserFriendlyError(error.message));

const MAX_KEEP_RAW_CHARS = 200;

export function toUserFriendlyError(rawMessage: string | null | undefined): string {
  const raw = (rawMessage ?? "").trim();
  if (!raw) return "任务失败,请重试或联系支持";

  if (raw.startsWith("NSFW_BLOCKED:")) {
    return raw.replace(/^NSFW_BLOCKED:\s*/, "").trim();
  }
  if (raw.startsWith("INSUFFICIENT_CREDITS:")) {
    return "积分余额不足,请前往「充值」页面补充积分后重试";
  }
  if (/polling timeout|轮询超时/i.test(raw)) {
    return "图片生成超时,服务器繁忙,请稍后重试,本次失败已自动退回积分";
  }
  if (/source_text 太短|source_text 为空|内容太短/i.test(raw)) {
    return "输入内容太短,请补充更多上下文后重试";
  }
  if (/analyze 输出解析失败/i.test(raw)) {
    return "AI 分析输出格式异常,请稍后重试。若反复出现请联系支持";
  }
  if (/apimart failed|apimart-gpt-image-2|fal failed|gpt-image|Bearer/i.test(raw)) {
    return "图片生成服务暂时不可用,请稍后重试,本次失败已自动退回积分";
  }
  if (/outline\.cards 为空|outline 不存在/i.test(raw)) {
    return "AI 大纲生成失败,请补充输入内容或更换模板后重试";
  }

  // 兜底:截断原文以保留诊断价值,避免吓到用户
  const truncated = raw.length > MAX_KEEP_RAW_CHARS
    ? raw.slice(0, MAX_KEEP_RAW_CHARS) + "…"
    : raw;
  return `任务失败:${truncated}`;
}
