// scripts/screenshot-l1-templates.ts — 给 10 个 L1 HTML 模板自动截首页缩略图
//
// 用法:
//   npx tsx scripts/screenshot-l1-templates.ts
//
// 数据流:
//   1. 从 templates 表查所有 template_path='l1_html' 的模板,拿 template_html
//   2. 对每个模板:启动 playwright chromium,渲染 1600×900,截首页(第一张 .slide)
//   3. 输出 .webp 到 public/templates/<id>.webp(质量 75)
//   4. UPDATE templates SET preview_url = '/templates/<id>.webp'

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright";

interface TplRow {
  id: string;
  name: string;
  template_html: string;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ 缺 DATABASE_URL");
    process.exit(1);
  }
  const sql = neon(url);

  // 查 L1 模板
  // 跳过 guizang 系列(WebGL 流体背景 Playwright 截不出效果,
  // 截图反而是黑色乱纹 → 不如不截走占位组)
  const rows = (await sql`
    SELECT id, name, template_html
    FROM templates
    WHERE owner_user_id IS NULL
      AND mode = 'slides'
      AND template_path = 'l1_html'
      AND template_html IS NOT NULL
      AND id NOT LIKE 'l1-guizang-%'
    ORDER BY id
  `) as unknown as TplRow[];

  console.log(`\n═══ 找到 ${rows.length} 个 L1 模板,开截 ═══\n`);

  const previewDir = path.resolve(process.cwd(), "public/templates");
  mkdirSync(previewDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1.5,
  });

  for (const row of rows) {
    process.stdout.write(`  ${row.id}  `);
    try {
      const page = await context.newPage();
      // setContent 而不是 srcdoc,直接吃完整 HTML
      await page.setContent(row.template_html, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      // 给 Google Fonts + WebGL 一秒钟收尾
      await page.waitForTimeout(1500);

      // 截全屏(默认就在第一张 slide,因为模板的 idx=0)
      const buf = await page.screenshot({
        type: "jpeg",
        quality: 80,
        fullPage: false,
      });
      await page.close();

      // 用 sharp 压一下成 webp(可选,先保 jpeg)
      const localPath = path.join(previewDir, `${row.id}.webp`);
      // playwright 不直接出 webp,先存 jpeg 再让 sharp 转
      // 简化:直接存 .jpg 也行,前端 <img> 都吃
      const jpgPath = path.join(previewDir, `${row.id}.jpg`);
      writeFileSync(jpgPath, buf);
      const previewUrl = `/templates/${row.id}.jpg`;

      await sql`
        UPDATE templates
        SET preview_url = ${previewUrl}, updated_at = NOW()
        WHERE id = ${row.id}
      `;
      console.log(`✓  (${(buf.length / 1024).toFixed(0)}KB → ${previewUrl})`);
      // localPath 占位以避免 lint warning
      void localPath;
    } catch (err) {
      console.log(`✗  ${(err as Error).message?.slice(0, 100)}`);
    }
  }

  await context.close();
  await browser.close();
  console.log("\n✅ 完成");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
