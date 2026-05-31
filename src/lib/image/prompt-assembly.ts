// SPEC §4.1 Step 3 — Image prompt 拼装
//
// 跟 cards/slides 不同:image 极简 — 仅 [enhanced] + [styleBase] + [negative] + [ratio]。
// 没有 anchor chain;每张图独立。

import type { ImageStyleId } from "@/lib/styles/image";
import { findImageStyle } from "@/lib/styles/image";
import type { RatioId } from "@/lib/cards/styles/types";

export interface AssembleImageInput {
  /** Enhance 后的英文 prompt;Enhance 关掉时直接是用户原文 */
  promptCore: string;
  styleId: ImageStyleId;
  ratio: RatioId;
}

const RATIO_HINT: Record<RatioId, string> = {
  "3:4": "vertical 3:4",
  "4:5": "vertical 4:5",
  "1:1": "square",
  "9:16": "tall vertical 9:16",
  "3:2": "landscape 3:2",
  "16:9": "wide 16:9",
  "4:3": "horizontal 4:3",
};

export function assembleImagePrompt(input: AssembleImageInput): string {
  const style = findImageStyle(input.styleId);
  const parts: string[] = [];
  if (style?.promptBase && !style.isAuto) {
    parts.push(style.promptBase + ".");
  }
  parts.push(input.promptCore);
  parts.push(`Aspect ratio: ${RATIO_HINT[input.ratio] ?? input.ratio}.`);
  if (style?.negative) {
    parts.push(`Avoid: ${style.negative}.`);
  }
  return parts.join("\n\n");
}
