// SPEC §4.1 Step 1 — Image Enhance prompt agent
//
// 单步轻 agent:用户输入 → LLM 微调成 image-friendly prompt(英文,适配 gpt-image-2)。
// 不做大纲澄清,不串图,纯文本调优。
//
// 调用方式:
//   const enhanced = await enhanceImagePrompt({ raw, styleHint });

const SYSTEM = `You polish a user's free-text into a single image-generation prompt for gpt-image-2.

Rules:
- Keep the user's core subject and intent intact.
- Translate Chinese into descriptive English while preserving any Chinese text the user wants rendered IN the image (wrap such text in backticks: \`text\`).
- Add concrete visual cues: lighting, composition, colors, materials, mood.
- Stay under 90 words. One paragraph. No prefix like "A photo of" — just the description.
- Never invent text that isn't in the user's input.`;

export async function buildEnhanceMessages(args: {
  raw: string;
  styleHint?: string;
}): Promise<{ system: string; user: string }> {
  const lines = [`User raw input:`, args.raw];
  if (args.styleHint) {
    lines.push("", `Target style modifier (will be appended automatically by caller, do NOT duplicate):`, args.styleHint);
  }
  return { system: SYSTEM, user: lines.join("\n") };
}

/** 把模型回的 string 简单清洗:去掉前缀 / 引号 / 多余空行 */
export function cleanEnhanced(text: string): string {
  let t = text.trim();
  t = t.replace(/^["'`]+|["'`]+$/g, "");
  t = t.replace(/\n{2,}/g, "\n").trim();
  return t;
}
