// scripts/optimize-template-screenshots.ts
// PR5:把 32 张外部模板 cover screenshot 从 PNG 转成 WebP,大幅缩小体积。
//
// 背景:
//   PR3 接入了 32 张 1920×1080 PNG 截图,总计 12MB,前端用原生 <img>(不是
//   next/image,所以 Next.js 不会自动优化),浏览器直接加载原始 PNG。
//   12 MB / 32 张 = 平均 ~380KB/张,首页打开模板墙时网络压力较大。
//
// 改造目标:
//   1. PNG → WebP(quality 80,平均 ~80-150KB/张)
//   2. 总体积从 12MB → ~3-4MB(节省 70%+)
//   3. 视觉差异 quality 80 下肉眼基本不可分辨
//
// 用法:
//   npx tsx scripts/optimize-template-screenshots.ts
//
// 配套改动:
//   - scripts/seed-external-templates.ts 把 previewUrl 后缀从 .png 改为 .webp
//   - scripts/patch-template-preview-webp.ts 把 DB 现有 preview_url 改为 .webp
//   - 删除原 32 张 PNG 文件

import { readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC_DIR = path.resolve(process.cwd(), "public/templates/external");
const QUALITY = 80; // 80 是图片大小 / 视觉质量平衡的甜点(看不出差别)
const DELETE_PNG = process.argv.includes("--delete-png");

async function main() {
  const files = readdirSync(SRC_DIR).filter((f) => f.endsWith(".png"));
  if (files.length === 0) {
    console.log("⚠ 没找到 PNG 文件,可能已经转过");
    return;
  }

  console.log(`找到 ${files.length} 张 PNG,开始转换为 WebP(quality=${QUALITY})...\n`);

  let totalPngBytes = 0;
  let totalWebpBytes = 0;
  let success = 0;
  let failed = 0;

  for (const file of files) {
    const pngPath = path.join(SRC_DIR, file);
    const webpPath = pngPath.replace(/\.png$/, ".webp");
    try {
      const pngStat = statSync(pngPath);
      totalPngBytes += pngStat.size;

      await sharp(pngPath)
        .webp({ quality: QUALITY, effort: 6 }) // effort 6 = 最高压缩(更慢但文件更小)
        .toFile(webpPath);

      const webpStat = statSync(webpPath);
      totalWebpBytes += webpStat.size;

      const ratio = ((1 - webpStat.size / pngStat.size) * 100).toFixed(0);
      const pngKb = (pngStat.size / 1024).toFixed(0);
      const webpKb = (webpStat.size / 1024).toFixed(0);
      console.log(
        `  ✓ ${file.padEnd(28)} ${pngKb.padStart(4)}KB → ${webpKb.padStart(4)}KB (省 ${ratio}%)`,
      );

      if (DELETE_PNG) {
        unlinkSync(pngPath);
      }

      success += 1;
    } catch (err) {
      console.error(`  ✗ ${file}: ${err instanceof Error ? err.message : err}`);
      failed += 1;
    }
  }

  const totalPngMb = (totalPngBytes / 1024 / 1024).toFixed(1);
  const totalWebpMb = (totalWebpBytes / 1024 / 1024).toFixed(1);
  const totalRatio = ((1 - totalWebpBytes / totalPngBytes) * 100).toFixed(0);
  console.log(
    `\n✅ 完成 — 成功 ${success} / 失败 ${failed}\n` +
    `   总体积:${totalPngMb} MB → ${totalWebpMb} MB(省 ${totalRatio}%)`,
  );

  if (!DELETE_PNG && success > 0) {
    console.log(`\n💡 PNG 文件保留。确认 webp 没问题后,跑:`);
    console.log(`   npx tsx scripts/optimize-template-screenshots.ts --delete-png`);
    console.log(`   或手动 rm public/templates/external/*.png`);
  }
}

main().catch((err) => {
  console.error("❌ 转换失败:", err);
  process.exit(1);
});
