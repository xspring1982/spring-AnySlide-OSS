// Phase 3 PR36 demo:用 parser 解析一个真实 .pptx → 输出草稿 blueprint
//
// 跑法:
//   npx tsx scripts/demo-parse-pptx.ts [pptx-path]
//
// 默认用我们 PR34 生成的 /tmp/anyslide-demo.pptx 反向测试。
// 也可以传任意 .pptx 路径(比如用户桌面的真实 PPT)。

import * as fs from "node:fs";
import * as path from "node:path";
import { parsePptx, rawToBlueprintDraft } from "@/lib/uploads/pptx-parser";

const inputPath =
  process.argv[2] ?? "/tmp/anyslide-demo.pptx";

if (!fs.existsSync(inputPath)) {
  console.error(`❌ 文件不存在: ${inputPath}`);
  process.exit(1);
}

(async () => {
  console.log(`解析: ${inputPath}`);
  const buf = fs.readFileSync(inputPath);
  console.log(`文件大小: ${(buf.length / 1024 / 1024).toFixed(2)} MB`);

  const raw = await parsePptx(buf);
  console.log(`\n═══ 解析结果 ═══`);
  console.log(`页数: ${raw.total_pages}`);
  console.log(`媒体: ${raw.total_media} 个 (${(raw.total_media_bytes / 1024 / 1024).toFixed(1)} MB)`);
  if (raw.warnings.length > 0) {
    console.log(`\n⚠️ 警告(大图):`);
    raw.warnings.slice(0, 5).forEach((w) =>
      console.log(`  - ${w.name}: ${w.mb} MB`),
    );
  }

  console.log(`\n═══ 每页文字摘要 ═══`);
  raw.slides.slice(0, 10).forEach((s) => {
    console.log(`\n[Page ${s.page_no}] xml=${(s.xml_size / 1024).toFixed(1)}KB images=${s.image_refs.length} runs=${s.text_runs.length}`);
    s.text_runs.slice(0, 6).forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.slice(0, 60)}${t.length > 60 ? "..." : ""}`);
    });
    if (s.text_runs.length > 6) console.log(`  ...(还有 ${s.text_runs.length - 6} 段文字)`);
    if (s.speaker_notes) console.log(`  📝 备注: ${s.speaker_notes.slice(0, 80)}`);
  });

  // 转草稿 blueprint
  const baseName = path.basename(inputPath, ".pptx");
  const draft = rawToBlueprintDraft(raw, {
    title: baseName,
    topic: baseName,
    locale: "zh",
    template_id: "demo-mvp",
  });

  // 输出 blueprint JSON 给后续 Improve LLM agent
  const outPath = `/tmp/${baseName}-draft-blueprint.json`;
  fs.writeFileSync(outPath, JSON.stringify(draft, null, 2), "utf-8");
  console.log(`\n✅ 草稿 blueprint 输出: ${outPath}`);
  console.log(`   ↑ 这是"原内容提取出来的初版",待 Improve LLM agent 重新美化排版`);
})();
