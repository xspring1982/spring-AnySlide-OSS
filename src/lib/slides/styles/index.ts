// SPEC §3.3 — Slides 风格库注册表

import type { SlideStyle, SlideStyleId } from "./types";
import { modern_pro } from "./modern_pro";
import { elegant_dark } from "./elegant_dark";
import { academic_serif } from "./academic_serif";
import { ink_classic } from "./ink_classic";
import { pink_girl } from "./pink_girl";
import { swiss_grid } from "./swiss_grid";

export const SLIDE_STYLES_FULL: Record<SlideStyleId, SlideStyle> = {
  modern_pro,
  elegant_dark,
  academic_serif,
  ink_classic,
  pink_girl,
  swiss_grid,
};

export const DEFAULT_SLIDE_STYLE_ID: SlideStyleId = "modern_pro";

export function getSlideStyle(id: SlideStyleId): SlideStyle {
  const style = SLIDE_STYLES_FULL[id];
  if (!style) throw new Error(`Unknown slide style: ${id}`);
  return style;
}

export function findSlideStyle(id: string): SlideStyle | undefined {
  return (SLIDE_STYLES_FULL as Record<string, SlideStyle>)[id];
}

export type {
  SlideStyle,
  SlideStyleId,
  SupportedPath,
  SlideEmojiPolicy,
  BackgroundType,
} from "./types";
