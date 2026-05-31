import assert from "node:assert/strict";
import {
  getSlideLayoutIntent,
  normalizeLayoutIntent,
} from "@/lib/slides/blueprint/layout-intent";
import type { SlideBlueprint } from "@/lib/slides/blueprint/schema";

function slide(overrides: Partial<SlideBlueprint>): SlideBlueprint {
  return {
    page_no: 1,
    template_section_index: 1,
    role: "content",
    slots: {},
    ...overrides,
  };
}

assert.equal(normalizeLayoutIntent("big-number"), "big_number");
assert.equal(normalizeLayoutIntent("single-text"), "single_text");
assert.equal(normalizeLayoutIntent("parallel"), "two_column");
assert.equal(normalizeLayoutIntent("unknown"), undefined);

assert.equal(
  getSlideLayoutIntent(slide({ layout_intent: "comparison" })),
  "comparison",
);
assert.equal(
  getSlideLayoutIntent(slide({ slots: { big_number: "128%" } })),
  "big_number",
);
assert.equal(
  getSlideLayoutIntent(slide({ slots: { quote: "把复杂内容变清楚" } })),
  "quote",
);
assert.equal(
  getSlideLayoutIntent(slide({ role: "agenda", slots: { items: ["A"] } })),
  "agenda",
);
assert.equal(
  getSlideLayoutIntent(slide({ slots: { bullets: ["A", "B"] } })),
  "bullets",
);

console.log("blueprint layout intent checks passed");
