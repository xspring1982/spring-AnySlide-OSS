import type { SlideBlueprint, SlideLayoutIntent } from "./schema";

const LAYOUT_INTENT_ALIASES: Record<string, SlideLayoutIntent> = {
  cover: "cover",
  agenda: "agenda",
  "single-text": "single_text",
  single_text: "single_text",
  single: "single_text",
  bullets: "bullets",
  bullet: "bullets",
  "bullet-list": "bullets",
  "big-number": "big_number",
  big_number: "big_number",
  metric: "big_number",
  stat: "big_number",
  comparison: "comparison",
  compare: "comparison",
  "before-after": "comparison",
  timeline: "timeline",
  process: "timeline",
  roadmap: "timeline",
  quote: "quote",
  callout: "quote",
  parallel: "two_column",
  "two-column": "two_column",
  "two-columns": "two_column",
  two_column: "two_column",
  section: "section_divider",
  section_divider: "section_divider",
  divider: "section_divider",
  closing: "closing",
};

export function normalizeLayoutIntent(
  raw: unknown,
): SlideLayoutIntent | undefined {
  if (typeof raw !== "string") return undefined;
  return LAYOUT_INTENT_ALIASES[raw.trim().toLowerCase()];
}

export function getSlideLayoutIntent(
  slide: SlideBlueprint,
): SlideLayoutIntent {
  const explicit = normalizeLayoutIntent(slide.layout_intent);
  if (explicit) return explicit;

  if (slide.role === "cover") return "cover";
  if (slide.role === "agenda") return "agenda";
  if (slide.role === "section_divider") return "section_divider";
  if (slide.role === "closing") return "closing";

  if (slide.slots.big_number) return "big_number";
  if (slide.slots.quote || slide.slots.callout) return "quote";
  if (slide.slots.left_title || slide.slots.right_title) return "comparison";
  if (slide.slots.steps) return "timeline";
  if (slide.slots.left || slide.slots.right) return "two_column";
  if (slide.slots.bullets) return "bullets";

  return "single_text";
}
