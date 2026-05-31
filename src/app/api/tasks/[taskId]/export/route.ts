// SPEC §2.1 Step 9 + §6.2.6 — 任务导出 ZIP
//
// GET /api/tasks/[taskId]/export
//   ?pages=1,3,5     → 仅打包指定 page(M1.8d 右键单张/选中下载),不传则全量
//   ?format=html     → (默认 for L1 deck)直接返 .html
//   ?format=pptx     → L1 deck 走 playwright 截图嵌 PPTX(图片版,不可编辑)
//   ?format=pdf      → L1 deck 走 playwright print PDF
//
// 2026-05-17 PR41:加 PPTX/PDF 格式分支 — 让现有所有 task 都能下新格式
//   - PPTX 走截图嵌方案(因为现有 L1 deck 是 HTML 字符串没 blueprint)
//   - PDF 走 playwright pdf API
//   - 长期 Phase 2 续:每模板专属 pptxgenjs 实现 → 真 native 可编辑 PPTX

import { NextRequest } from "next/server";
import JSZip from "jszip";
import { getTask, listTaskImageFiles } from "@/lib/tasks/repo";
import { requireUser } from "@/lib/auth/require";
import {
  htmlDeckToPptx,
  htmlDeckToPdf,
} from "@/lib/slides/exporters/html-deck-to-pptx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// PPTX 截图嵌 5-10 页 deck 约 30-60s,PDF 5-10s,加大 maxDuration
export const maxDuration = 120;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;
  // 解析 ?pages=1,3,5 子集
  const pagesParam = req.nextUrl.searchParams.get("pages");
  const pageFilter: Set<number> | null = pagesParam
    ? new Set(
        pagesParam
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n) && n > 0),
      )
    : null;

  const task = await getTask(taskId);
  if (!task) {
    return Response.json({ error: "任务不存在" }, { status: 404 });
  }
  if (task.userId !== userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  // M5+:单张可即时下载,不等整个 task done(用户体验:看到一张就能下一张)
  // 仅打全包 ZIP 时(无 pages 参数)才要求 task done
  const isFullZip = !pagesParam;
  if (isFullZip && task.status !== "done") {
    return Response.json(
      { error: `任务尚未完成,无法整包下载;请等待生成完毕后重试` },
      { status: 409 },
    );
  }

  const allFiles = await listTaskImageFiles(taskId);
  if (allFiles.length === 0) {
    return Response.json({ error: "无可下载图片" }, { status: 404 });
  }

  // 同 pageNo 取最高 pageVersion(M2 起多版本时用)
  const byPage = new Map<number, (typeof allFiles)[number]>();
  for (const f of allFiles) {
    if (pageFilter && !pageFilter.has(f.pageNo)) continue;
    const cur = byPage.get(f.pageNo);
    if (!cur || f.pageVersion > cur.pageVersion) byPage.set(f.pageNo, f);
  }
  const files = Array.from(byPage.values()).sort((a, b) => a.pageNo - b.pageNo);
  if (files.length === 0) {
    return Response.json(
      { error: "指定的 pages 在该任务中无对应图片" },
      { status: 404 },
    );
  }

  // 单张直接返 PNG,多张才打 zip
  if (files.length === 1) {
    const f = files[0];

    // L1 模板填充模式:单文件,data:text/html URL
    if (f.storageUrl.startsWith("data:text/html")) {
      const m = f.storageUrl.match(/^data:text\/html(?:;[^,]*)?;base64,(.+)$/);
      if (!m) {
        return Response.json({ error: "data URL 格式异常" }, { status: 500 });
      }
      const html = Buffer.from(m[1], "base64").toString("utf-8");

      // 2026-05-17 PR41:format 分支
      const format = req.nextUrl.searchParams.get("format") ?? "html";
      const slugBase = task.slug || task.id;

      if (format === "pptx") {
        try {
          const pptxBuf = await htmlDeckToPptx(html, task.title);
          const filename = `${slugBase}-deck.pptx`;
          const encoded = encodeURIComponent(filename);
          return new Response(new Uint8Array(pptxBuf), {
            headers: {
              "Content-Type":
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              "Content-Disposition": `attachment; filename="${task.id}-deck.pptx"; filename*=UTF-8''${encoded}`,
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          return Response.json(
            { error: `PPTX 生成失败: ${e instanceof Error ? e.message : "unknown"}` },
            { status: 500 },
          );
        }
      }

      if (format === "pdf") {
        try {
          const pdfBuf = await htmlDeckToPdf(html);
          const filename = `${slugBase}-deck.pdf`;
          const encoded = encodeURIComponent(filename);
          return new Response(new Uint8Array(pdfBuf), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${task.id}-deck.pdf"; filename*=UTF-8''${encoded}`,
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          return Response.json(
            { error: `PDF 生成失败: ${e instanceof Error ? e.message : "unknown"}` },
            { status: 500 },
          );
        }
      }

      // 默认 html
      const filename = `${slugBase}-deck.html`;
      const encoded = encodeURIComponent(filename);
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${task.id}-deck.html"; filename*=UTF-8''${encoded}`,
          "Cache-Control": "no-store",
        },
      });
    }

    let upstream: Response;
    try {
      upstream = await fetch(f.storageUrl);
    } catch (err) {
      console.error("[export] upstream fetch threw:", err);
      return Response.json(
        { error: "图片源不可达,请稍后重试" },
        { status: 502 },
      );
    }
    if (!upstream.ok || !upstream.body) {
      return Response.json(
        { error: `图片下载失败 HTTP ${upstream.status}` },
        { status: 502 },
      );
    }
    const filename = `${task.slug || task.id}-${f.pageNo}.png`;
    const encoded = encodeURIComponent(filename);
    // 流式 pipe upstream → response,不全量缓存,防大图慢加载
    const headers: Record<string, string> = {
      "Content-Type": upstream.headers.get("content-type") || "image/png",
      "Content-Disposition": `attachment; filename="${task.id}-${f.pageNo}.png"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "no-store",
    };
    const len = upstream.headers.get("content-length");
    if (len) headers["Content-Length"] = len;
    return new Response(upstream.body, { headers });
  }

  // 多张:打包 zip
  const zip = new JSZip();
  await Promise.all(
    files.map(async (f) => {
      const filename = `${task.slug}-${f.pageNo}-v${f.pageVersion}.png`;
      try {
        const res = await fetch(f.storageUrl);
        if (!res.ok) {
          zip.file(
            `${filename}.error.txt`,
            `下载失败 HTTP ${res.status}\n源 URL:${f.storageUrl}\n`,
          );
          return;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        zip.file(filename, buf);
      } catch (e) {
        zip.file(
          `${filename}.error.txt`,
          `下载异常:${(e as Error).message}\n源 URL:${f.storageUrl}\n`,
        );
      }
    }),
  );

  // 加一份 manifest.json,方便用户对照
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        taskId: task.id,
        title: task.title,
        slug: task.slug,
        mode: task.mode,
        styleId: task.styleId,
        ratio: task.ratio,
        totalCards: files.length,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  const zipBuffer = await zip.generateAsync({ type: "uint8array" });
  // 中文文件名要 RFC 5987 编码
  const encodedName = encodeURIComponent(`${task.slug || task.id}.zip`);

  return new Response(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${task.id}.zip"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "no-store",
    },
  });
}
