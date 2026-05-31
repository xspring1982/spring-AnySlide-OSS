// Phase 3 PR38(简化版):同步 PPT 美化端点
//
// POST /api/improve-pptx
//   Content-Type: multipart/form-data
//   Fields:
//     - file: .pptx 文件
//     - instruction (可选): 用户优化指令(默认 "重新设计为简洁现代专业")
//     - format (可选): "pptx" | "pdf" | "html"(默认 pptx)
//     - templateId (**必填**): 视觉模板 — 当前仅 ext-blue-professional / ext-bold-poster
//                              用户若想"保留自己 PPT 的品牌色 / 字",后续走"上传 PPT 作自定义模板"
//                              那条独立路径(尚未做),不在本端点内通过"保留品牌"模式实现
//
// 流程(同步):
//   1. 接 .pptx → parsePptx → 草稿 blueprint
//   2. improveDeck LLM agent → 美化 blueprint
//   3. blueprintToPptx 按 template_id 路由到模板专属 renderer
//   4. return Buffer(浏览器下载)
//
// 设计取舍:
//   - 不走 inngest / 不存 DB / 不创建 task / 不接 SSE
//   - 同步执行 30-90 秒,前端用 loading 状态
//   - 没有 retry / 没有 cancel / 没有持久化
//   - 适合 MVP 单页"PPT 美化"工具,后续 Phase 演进到完整 task 流程
//
// 2026-05-17 PR51:删"保留我的品牌"模式 — templateId 改必填。
//   原 extractTheme + inheritedTheme 注入流程整段移除,因为该路径的需求
//   将通过"用户上传 PPT 作为自定义模板"独立功能解决,跟 /improve-pptx 解耦。
//   pptx-theme-extractor.ts 文件本身保留,将来给那个独立功能用。

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require";
import { chargeCredits, InsufficientCreditsError } from "@/lib/credits";
import {
  parsePptx,
  rawToBlueprintDraft,
} from "@/lib/uploads/pptx-parser";
import { improveDeck } from "@/lib/slides/agents/improve-deck";
import { blueprintToPptx } from "@/lib/slides/exporters/blueprint-to-pptx";
import { blueprintToPdf } from "@/lib/slides/exporters/blueprint-to-pdf";
import { nanoid } from "nanoid";
import { detectRequestLocale } from "@/i18n/locale-util";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120; // 部分托管平台默认超时不够,加到 120s

const IMPROVE_CREDIT_AMOUNT = 10; // 美化一次 10 积分(后续按页数动态)

/** 当前支持的模板 — 跟 src/lib/slides/exporters/blueprint-to-pptx.ts 的 TEMPLATE_RENDERERS 保持一致 */
const SUPPORTED_TEMPLATE_IDS = ["ext-blue-professional", "ext-bold-poster"];

export async function POST(req: NextRequest): Promise<Response> {
  const { error, userId } = await requireUser();
  if (error) return error;

  // 1. 解 multipart form
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return Response.json(
      { error: "multipart/form-data 解析失败", debug: (e as Error).message },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "缺少 file 字段(.pptx)" }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return Response.json(
      { error: `文件太大(${(file.size / 1024 / 1024).toFixed(1)} MB),最大 50 MB` },
      { status: 413 },
    );
  }

  const instruction = String(form.get("instruction") ?? "").trim() || undefined;
  const format = String(form.get("format") ?? "pptx") as "pptx" | "pdf" | "html";
  if (!["pptx", "pdf", "html"].includes(format)) {
    return Response.json({ error: "format 必须是 pptx/pdf/html" }, { status: 400 });
  }

  // 2026-05-17 PR51:templateId 必填
  const rawTemplateId = String(form.get("templateId") ?? "").trim();
  if (!rawTemplateId) {
    return Response.json(
      { error: "缺少 templateId(必须选一个模板)", code: "TEMPLATE_REQUIRED" },
      { status: 400 },
    );
  }
  if (!SUPPORTED_TEMPLATE_IDS.includes(rawTemplateId)) {
    return Response.json(
      {
        error: `不支持的 templateId: ${rawTemplateId}。当前支持 ${SUPPORTED_TEMPLATE_IDS.join(" / ")}`,
        code: "TEMPLATE_UNSUPPORTED",
      },
      { status: 400 },
    );
  }
  const templateId = rawTemplateId;

  // 2. 扣积分(失败直接拒)
  try {
    await chargeCredits({
      txId: nanoid(12),
      userId,
      amount: IMPROVE_CREDIT_AMOUNT,
      reason: "generate",
      taskId: null,
      modelUsed: "improve-pptx-sync",
      metadata: {
        kind: "improve_pptx_sync",
        file_name: file.name,
        format,
        template_id: templateId,
      },
    });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      return Response.json(
        {
          error: `积分不足,需 ${e.required},余额 ${e.balance}`,
          code: "INSUFFICIENT_CREDITS",
        },
        { status: 402 },
      );
    }
    throw e;
  }

  // 3. parse .pptx → 草稿 blueprint
  const buf = Buffer.from(await file.arrayBuffer());
  const raw = await parsePptx(buf);
  if (raw.total_pages === 0) {
    return Response.json({ error: "PPT 没有任何 slide" }, { status: 400 });
  }

  const locale = detectRequestLocale(req);
  const baseName = file.name.replace(/\.pptx?$/i, "");
  const draft = rawToBlueprintDraft(raw, {
    title: baseName,
    topic: baseName,
    locale,
    template_id: templateId,
  });

  // 4. LLM Improve
  let improved;
  try {
    improved = await improveDeck({
      draft,
      userInstruction: instruction,
      locale,
    });
  } catch (e) {
    return Response.json(
      {
        error: "LLM 美化失败",
        debug: (e as Error).message,
      },
      { status: 500 },
    );
  }

  // 5. 渲染 → 输出
  try {
    if (format === "pptx") {
      const out = await blueprintToPptx(improved.improved);
      const encoded = encodeURIComponent(`${baseName}-improved.pptx`);
      return new Response(new Uint8Array(out), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "Content-Disposition": `attachment; filename="improved.pptx"; filename*=UTF-8''${encoded}`,
          "Cache-Control": "no-store",
          "X-Improve-Summary": encodeURIComponent(improved.summary_for_user),
          "X-Improve-Business-Type": improved.detected_business_type,
        },
      });
    }
    if (format === "pdf") {
      const out = await blueprintToPdf(improved.improved);
      const encoded = encodeURIComponent(`${baseName}-improved.pdf`);
      return new Response(new Uint8Array(out), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="improved.pdf"; filename*=UTF-8''${encoded}`,
          "Cache-Control": "no-store",
        },
      });
    }
    // html 暂未实现端到端(需要选定具体模板 HTML),先返 blueprint JSON 给前端预览
    return Response.json({
      ok: true,
      summary_for_user: improved.summary_for_user,
      detected_business_type: improved.detected_business_type,
      blueprint: improved.improved,
    });
  } catch (e) {
    return Response.json(
      { error: "渲染失败", debug: (e as Error).message },
      { status: 500 },
    );
  }
}
