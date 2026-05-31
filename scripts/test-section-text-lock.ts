import assert from "node:assert/strict";
import { mergeTextIntoOriginalSection } from "@/lib/slides/html/text-lock";

const original = `
<section class="slide original" data-id="s1">
  <div class="shell" style="font-size:80px">
    <h1 class="title">Old title</h1>
    <p class="lead">Old lead</p>
  </div>
</section>`;

const candidate = `
<section class="slide mutated" style="padding:999px">
  <div class="changed">
    <h1 class="other">New title</h1>
    <p style="font-size:8px">New lead</p>
  </div>
</section>`;

const merged = mergeTextIntoOriginalSection(original, candidate);

assert.match(merged, /class="slide original"/);
assert.match(merged, /data-id="s1"/);
assert.match(merged, /class="shell"/);
assert.match(merged, /style="font-size:80px"/);
assert.doesNotMatch(merged, /padding:999px/);
assert.doesNotMatch(merged, /class="changed"/);
assert.match(merged, />New title</);
assert.match(merged, />New lead</);

console.log("section text lock checks passed");
