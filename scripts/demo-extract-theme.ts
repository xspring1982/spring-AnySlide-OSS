// 验证 pptx-theme-extractor 跑通
//
// 跑法:
//   npx tsx scripts/demo-extract-theme.ts [pptx-path]
//
// 默认用我们 demo .pptx,可传任意 .pptx(比如用户公司 PPT)

import * as fs from "node:fs";
import { extractTheme } from "@/lib/uploads/pptx-theme-extractor";

const path = process.argv[2] ?? "/tmp/anyslide-demo.pptx";
if (!fs.existsSync(path)) {
  console.error(`❌ 文件不存在: ${path}`);
  process.exit(1);
}

(async () => {
  console.log(`解析: ${path}`);
  const buf = fs.readFileSync(path);
  const theme = await extractTheme(buf);
  console.log("\n===提取的 theme===");
  console.log(JSON.stringify(theme, null, 2));

  console.log("\n===可视化色谱===");
  for (const [key, hex] of Object.entries(theme.colors)) {
    console.log(`  ${key.padEnd(10)} #${hex}`);
  }
})();
