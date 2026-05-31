// 验证 htmlDeckToPptx + htmlDeckToPdf 跑通
//
// 用 demo-template.html(Phase 1 的) + mock blueprint 填值后的 HTML 跑测试
// 跑法:npx tsx scripts/demo-html-deck-to-pptx.ts

import * as fs from "node:fs";
import {
  htmlDeckToPptx,
  htmlDeckToPdf,
} from "@/lib/slides/exporters/html-deck-to-pptx";

// 用 demo-template.html(已经填好 PLACEHOLDER 的话效果更好,这里直接用原模板)
const html = fs.readFileSync(
  "src/lib/slides/blueprint/demo-template.html",
  "utf-8",
);

(async () => {
  console.log("===HTML deck → PPTX (截图嵌入)===");
  const pptxBuf = await htmlDeckToPptx(html, "AnySlide Demo Deck");
  fs.writeFileSync("/tmp/deck-from-html.pptx", pptxBuf);
  console.log(`✅ /tmp/deck-from-html.pptx (${(pptxBuf.length / 1024).toFixed(1)} KB)`);

  console.log("\n===HTML deck → PDF (playwright print)===");
  const pdfBuf = await htmlDeckToPdf(html);
  fs.writeFileSync("/tmp/deck-from-html.pdf", pdfBuf);
  console.log(`✅ /tmp/deck-from-html.pdf (${(pdfBuf.length / 1024).toFixed(1)} KB)`);
})();
