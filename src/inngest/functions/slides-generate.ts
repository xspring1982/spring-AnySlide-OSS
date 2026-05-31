// SPEC §3 — Slides 端到端生成(支持 L1 HTML + L2 AI 图)
//
// 流程跟 cards-generate 同形态:
//   1. load task / mark analyzing
//   2. research(Jina 联网调研 SPEC §5.6)
//   3. analyze 输出层级 outline
//   4. mark confirming + waitForEvent("task/cards.outline-confirmed")(复用 cards 的事件)
//   5. mark generating
//   6. 拍平层级 outline 为 [SlideEntry]
//   7a. L1 路径:对每张 slide 调 Claude 出 HTML 片段(无 anchor chain)
//   7b. L2 路径:对每张 slide 调 apimart(图 1 锚点 + 图 2-N ref,跟 cards 同模式)
//   8. mark done

import { nanoid } from "nanoid";
import { staticSchema, type GetStepTools } from "inngest";
import { inngest, type CardsGeneratePayload } from "../client";
import { ai } from "@/lib/ai";
import {
  buildSlidesAnalyzeMessages,
  parseSlidesAnalyzeOutput,
  assembleSlidePrompt,
  extractTargetPageCount,
  type SlideEntry,
  type SlidesAnalyzeOutput,
  type GenerationPath,
  type SlideRatio,
} from "@/lib/slides/agents";
import { getSlideStyle, findSlideStyle } from "@/lib/slides/styles";
import type { SlideStyleId, SlideStyle } from "@/lib/slides/styles/types";
import {
  getTask,
  updateTaskStatus,
  updateTaskAnalyzeResult,
  updateTaskEffectiveStyleRatio,
  setImageModelUsed,
  appendTaskVersion,
  appendTaskFile,
} from "@/lib/tasks/repo";
import {
  chargeCredits,
  refundCredits,
  estimateCreditsForCards,
  InsufficientCreditsError,
} from "@/lib/credits";
import {
  loadTemplate,
  fillL1Template,
  persistL1FilledDeck,
  buildL2BaoyuPrefix,
  buildDeckFromOutline,
} from "./slides-template-fill";
import {
  buildL1TemplatedAnalyzeMessages,
  parseL1TemplatedOutput,
  type TemplateSection,
} from "@/lib/slides/agents/templated-analyze";

type StepTools = GetStepTools<typeof inngest>;

// ─────────────────────── 辅助 ───────────────────────

const VALID_RATIOS: SlideRatio[] = ["16:9", "9:16", "4:3", "1:1", "3:2"];

function asSlideRatio(s: string): SlideRatio {
  if (s === "auto") return "16:9";
  if ((VALID_RATIOS as string[]).includes(s)) return s as SlideRatio;
  return "16:9";
}

function asSlideStyleId(s: string): SlideStyleId {
  if (s === "auto") return "modern_pro";
  if (findSlideStyle(s)) return s as SlideStyleId;
  return "modern_pro";
}

/** SPEC §3.2 双轨:用户在 §2.1 Step 1 选 L1/L2;M5 默认 L1(HTML 可编辑) */
function deriveGenerationPath(task: {
  generationMode: string;
  styleId: string;
}): GenerationPath {
  // M5 简化:generationMode='one-by-one' → L2(AI 图全屏);'batch' 默认 L1(HTML)
  // SPEC §3.2.4 路径选择推荐:全文字 / 数据型 → L1;视觉沉浸型 → L2
  // 真正基于内容推荐留给 LLM analyze 时(M6+)
  return task.generationMode === "one-by-one" ? "L2" : "L1";
}

function flattenOutline(outline: SlidesAnalyzeOutput["outline"]): SlideEntry[] {
  const out: SlideEntry[] = [outline.cover];
  if (outline.agenda) out.push(outline.agenda);
  for (const sec of outline.sections) {
    if (sec.divider) out.push(sec.divider);
    out.push(...sec.slides);
  }
  out.push(outline.closing);
  return out;
}

// ─────────────────────── 主函数 ───────────────────────

export const slidesGenerate = inngest.createFunction(
  {
    id: "slides-generate",
    name: "Slides 端到端生成",
    concurrency: { key: "event.data.taskId", limit: 1 },
    retries: 0,
    triggers: [
      {
        event: "task/slides.generate",
        schema: staticSchema<CardsGeneratePayload>(), // 复用同结构
      },
    ],
    onFailure: async ({ event, error, logger }) => {
      const original = event.data.event as { data: { taskId: string; userId: string } };
      const { taskId, userId } = original.data;
      logger.warn("[slides-generate] onFailure 退款", {
        taskId,
        error: error.message,
      });
      try {
        const { toUserFriendlyError } = await import("@/lib/tasks/error-message");
        await updateTaskStatus(taskId, "failed", null, toUserFriendlyError(error.message));
      } catch (e) {
        logger.error("mark failed", e as Error);
      }
      try {
        const { sql } = await import("@/lib/db");
        const rows = (await sql`
          SELECT delta FROM credit_transactions
          WHERE user_id = ${userId} AND task_id = ${taskId} AND reason = 'generate'
          LIMIT 1
        `) as Array<{ delta: number }>;
        if (rows[0]) {
          await refundCredits({
            txId: nanoid(12),
            userId,
            amount: -rows[0].delta,
            reason: "refund_failed",
            taskId,
            metadata: { error: error.message.slice(0, 200) },
          });
        }
      } catch (e) {
        logger.error("refund", e as Error);
      }
    },
  },
  async ({ event, step, logger }) => {
    const { taskId, userId } = event.data;
    logger.info("[slides-generate] 开始", { taskId });

    let task = await step.run("load-task", async () => {
      const t = await getTask(taskId);
      if (!t) throw new Error(`task ${taskId} 不存在`);
      if (t.userId !== userId) throw new Error("用户不匹配");
      if (t.mode !== "slides") throw new Error("非 slides 模式");
      return t;
    });
    if (!task.sourceText || task.sourceText.trim().length < 5) {
      await updateTaskStatus(taskId, "failed");
      throw new Error("source_text 太短");
    }

    // ── 文稿 gate(slides 默认)── 生成大纲前先让用户(可反复)优化文稿,回复「定稿」后继续。
    await step.run("mark-confirming-source", () =>
      updateTaskStatus(taskId, "confirming_source", "confirm"),
    );
    const srcConfirm = await step.waitForEvent("wait-source-confirm", {
      event: "task/slides.source-confirmed",
      match: "data.taskId",
      timeout: "24h",
    });
    if (!srcConfirm) {
      await step.run("mark-cancelled-source-timeout", () =>
        updateTaskStatus(taskId, "cancelled"),
      );
      return { taskId, cancelled: true, reason: "source-confirm-timeout" };
    }
    // 用户在 gate 里可能优化过 sourceText(已写 DB),重读拿最新 task
    const reloaded = await step.run("reload-task-after-source-confirm", () =>
      getTask(taskId),
    );
    if (reloaded) task = reloaded;

    // ─────── M5+ 模板矩阵化:先看 task 是否带模板 ───────
    // L1 模板填充 → 单次 LLM 改写整个 deck,跳过 analyze + 逐张生成
    // L2 锁 baoyu 风格 → analyze 仍跑(需 outline),但每张 image prompt 前注入 baoyu spec
    const tplRow = task.templateId
      ? await step.run("load-template", () => loadTemplate(task.templateId!))
      : null;
    const isL1Templated = tplRow?.template_path === "l1_html";
    const isL2Templated = tplRow?.template_path === "l2_image";

    if (isL1Templated && tplRow) {
      // ─── L1 模板填充模式(PR15b 改造为完整 analyze + confirm + assemble 流程)───
      // 老路径(直接 fillL1Template 一次改写整 deck)只在 template_outline 缺失时
      // 兜底走;有 template_outline 的模板走新流程,支持页数可变 + 用户改大纲
      const tplOutlineRaw = (
        tplRow as unknown as { template_outline?: unknown }
      ).template_outline;
      const tplOutline = (Array.isArray(tplOutlineRaw)
        ? (tplOutlineRaw as TemplateSection[])
        : null);

      if (!tplOutline || tplOutline.length === 0) {
        // 兜底:模板没标注 outline 数据 → 走老的"一次改写整 deck"快速路径
        logger.info("[slides-generate] L1 模板填充(兜底快速路径)", {
          templateId: tplRow.id,
        });
        await step.run("mark-generating-l1", () =>
          updateTaskStatus(taskId, "generating", "batch"),
        );
        const chargeAmount = 10;
        try {
          await chargeCredits({
            txId: nanoid(12),
            userId,
            amount: chargeAmount,
            reason: "generate",
            taskId,
            modelUsed: "claude-template-fill",
            metadata: { templateId: tplRow.id, path: "l1_html_fallback" },
          });
        } catch (e) {
          if (e instanceof InsufficientCreditsError) {
            await updateTaskStatus(taskId, "failed");
            throw new Error(
              `INSUFFICIENT_CREDITS:需要 ${e.required},余额 ${e.balance}`,
            );
          }
          throw e;
        }
        const filled = await step.run("l1-fill", () =>
          fillL1Template({
            taskId,
            template: tplRow,
            userContent: task.sourceText!,
            userIntent: task.title,
            locale: task.locale,
          }),
        );
        await step.run("persist-l1-deck", () =>
          persistL1FilledDeck({
            taskId,
            html: filled.html,
            templateName: tplRow.name,
          }),
        );
        await step.run("mark-done-l1", () =>
          updateTaskStatus(taskId, "done", "done"),
        );
        return { taskId, templated: "l1_fallback" };
      }

      // ─── 新路径:analyze → outline-confirm → assemble ───
      logger.info("[slides-generate] L1 模板填充(完整流程)", {
        templateId: tplRow.id,
        templateSections: tplOutline.length,
      });

      await step.run("mark-analyzing-l1", () =>
        updateTaskStatus(taskId, "analyzing", "analyze"),
      );

      // 联网调研
      const researchContext = await step.run("research-l1", async () => {
        if (!ai.research.shouldFetch(task.sourceText!)) return null;
        return await ai.research.fetch(task.sourceText!);
      });

      // analyze:LLM 拿用户主题 + template_outline 池,生成动态 outline
      const { outline, modelUsedAnalyze } = await step.run(
        "l1-analyze",
        async () => {
          const targetCount = extractTargetPageCount(task.sourceText ?? "");
          const messages = buildL1TemplatedAnalyzeMessages({
            userContent: task.sourceText!,
            userIntent: task.title,
            templateName: tplRow.name,
            templateOutline: tplOutline,
            targetCount,
            locale: task.locale,
            researchContext: researchContext ?? undefined,
          });
          const completion = await ai.text.complete({
            system: messages.system,
            user: messages.user,
            tier: "default",
            maxTokens: 12288,
            temperature: 0.5,
            cacheSystem: false,
          });
          const parsed = parseL1TemplatedOutput(completion.text, {
            locale: task.locale,
            templateOutline: tplOutline,
          });
          if (!parsed.ok) {
            console.error(
              "[slides-generate] L1 analyze parse failed:",
              completion.text.slice(0, 2000),
            );
            throw new Error(`L1 templated analyze 解析失败:${parsed.error}`);
          }
          return {
            outline: parsed.output,
            modelUsedAnalyze: completion.model,
          };
        },
      );

      // 拍平算总数(给积分预扣)
      const flatLength = (() => {
        const arr = [outline.outline.cover];
        if (outline.outline.agenda) arr.push(outline.outline.agenda);
        for (const s of outline.outline.sections) {
          if (s.divider) arr.push(s.divider);
          arr.push(...s.slides);
        }
        arr.push(outline.outline.closing);
        return arr.length;
      })();

      // 持久化 outline
      await step.run("persist-l1-outline", async () => {
        await updateTaskAnalyzeResult(taskId, outline, modelUsedAnalyze);
        await appendTaskVersion({
          id: nanoid(12),
          taskId,
          versionNo: task.currentVersionNo,
          outline,
        });
      });

      // 预扣积分(L1 模板填充 1 积分/页)
      const chargeAmount = flatLength;
      await step.run("charge-credits-l1", async () => {
        try {
          await chargeCredits({
            txId: nanoid(12),
            userId,
            amount: chargeAmount,
            reason: "generate",
            taskId,
            modelUsed: "claude-l1-templated",
            metadata: {
              templateId: tplRow.id,
              path: "l1_html_outline",
              slideCount: flatLength,
            },
          });
        } catch (e) {
          if (e instanceof InsufficientCreditsError) {
            await updateTaskStatus(taskId, "failed");
            throw new Error(
              `INSUFFICIENT_CREDITS:需要 ${e.required},余额 ${e.balance}`,
            );
          }
          throw e;
        }
      });

      // outline-confirm:等用户确认(SPEC §3.5.4 / 复用 cards 事件)
      await step.run("mark-confirming-l1", () =>
        updateTaskStatus(taskId, "confirming", "confirm"),
      );
      const confirm = await step.waitForEvent("wait-l1-outline-confirm", {
        event: "task/cards.outline-confirmed",
        match: "data.taskId",
        timeout: "24h",
      });
      if (!confirm) {
        await step.run("mark-cancelled-timeout-l1", async () => {
          await updateTaskStatus(taskId, "cancelled");
          await refundCredits({
            txId: nanoid(12),
            userId,
            amount: chargeAmount,
            reason: "refund_cancelled",
            taskId,
            metadata: { cause: "outline-confirm-timeout" },
          });
        });
        return { taskId, cancelled: true, reason: "timeout" };
      }
      if (confirm.data.action === "redo") {
        await step.run("mark-cancelled-redo-l1", async () => {
          await updateTaskStatus(taskId, "cancelled");
          await refundCredits({
            txId: nanoid(12),
            userId,
            amount: chargeAmount,
            reason: "refund_cancelled",
            taskId,
            metadata: { cause: "user-redo" },
          });
        });
        return { taskId, cancelled: true, reason: "user-redo" };
      }

      // 用户确认了。从 DB 重读 task.analyzeResult 拿用户编辑后的最新 outline。
      // (PR15c:用户在 confirming 阶段可以通过 PATCH /api/tasks/[id]/outline
      //  编辑 outline,这些编辑只写到 DB,不通过 inngest event 携带,
      //  所以 confirm 后从 DB 重读才能拿到最新版)
      const confirmedOutline = await step.run("reload-outline", async () => {
        const fresh = await getTask(taskId);
        const a = fresh?.analyzeResult as unknown;
        if (
          a &&
          typeof a === "object" &&
          "outline" in a &&
          (a as { outline?: { cover?: unknown } }).outline?.cover
        ) {
          return a as typeof outline;
        }
        // 兜底用 analyze 阶段的 in-memory outline
        return outline;
      });

      // 切到 generating
      await step.run("mark-generating-l1-assemble", () =>
        updateTaskStatus(taskId, "generating", "batch"),
      );

      // 拼装 deck.html
      // step.run 把返回值 jsonify 后类型变松,这里 cast 回 SlidesAnalyzeOutput
      const filled = await step.run("l1-assemble-deck", () =>
        buildDeckFromOutline({
          template: tplRow,
          outline: confirmedOutline as unknown as typeof outline,
          locale: task.locale,
        }),
      );
      await step.run("persist-l1-deck-from-outline", () =>
        persistL1FilledDeck({
          taskId,
          html: filled.html,
          templateName: tplRow.name,
        }),
      );
      await step.run("mark-done-l1-from-outline", () =>
        updateTaskStatus(taskId, "done", "done"),
      );
      logger.info("[slides-generate] L1 模板填充(完整流程)完成", {
        taskId,
        templateId: tplRow.id,
        slides: flatLength,
      });
      return { taskId, templated: "l1_outline" };
    }

    await step.run("mark-analyzing", () =>
      updateTaskStatus(taskId, "analyzing", "analyze"),
    );

    const generationPath = deriveGenerationPath(task);
    const autoStyle = task.styleId === "auto";
    const autoRatio = task.ratio === "auto";

    // Jina 联网调研
    const researchContext = await step.run("research", async () => {
      if (!ai.research.shouldFetch(task.sourceText!)) return null;
      const ctx = await ai.research.fetch(task.sourceText!);
      logger.info("[slides-generate] research", {
        triggered: true,
        chars: ctx?.length ?? 0,
      });
      return ctx;
    });

    // analyze
    const { outline, modelUsed } = await step.run("analyze", async () => {
      const placeholderStyle = getSlideStyle(asSlideStyleId(task.styleId));
      const placeholderRatio = asSlideRatio(task.ratio);
      // 2026-05-05 Bug 4 修:从用户输入提取明确指定的页数(如"3 页"/"5 张"/"N pages")
      // 提取到则作为 hard constraint 传给 LLM,优先级高于系统软规则(8 字 → 6-10 张 等)
      const targetCount = extractTargetPageCount(task.sourceText ?? "");
      const messages = buildSlidesAnalyzeMessages({
        userContent: task.sourceText!,
        userIntent: task.title,
        style: placeholderStyle,
        generationPath,
        ratio: placeholderRatio,
        autoStyle,
        autoRatio,
        researchContext: researchContext ?? undefined,
        targetCount,
        locale: task.locale,
      });
      const completion = await ai.text.complete({
        system: messages.system,
        user: messages.user,
        tier: "default",
        maxTokens: 12288,
        temperature: 0.7,
        cacheSystem: true,
      });
      const parsed = parseSlidesAnalyzeOutput(completion.text, {
        style: placeholderStyle,
        generationPath,
        locale: task.locale,
      });
      if (!parsed.ok) {
        // eslint-disable-next-line no-console
        console.error(
          "[slides-generate] analyze parse failed:",
          completion.text.slice(0, 2000),
        );
        throw new Error(
          `analyze 解析失败:${parsed.error.kind}`,
        );
      }
      return { outline: parsed.output, modelUsed: completion.model };
    });

    // 决定 effective style/ratio
    const effectiveStyleId: SlideStyleId =
      autoStyle && outline.recommended_style
        ? asSlideStyleId(outline.recommended_style)
        : asSlideStyleId(task.styleId);
    const effectiveRatio: SlideRatio =
      autoRatio && outline.recommended_ratio
        ? asSlideRatio(outline.recommended_ratio)
        : asSlideRatio(task.ratio);
    const effectiveStyle = getSlideStyle(effectiveStyleId);

    const allSlides = flattenOutline(outline.outline);
    logger.info("[slides-generate] outline 拿到", {
      total: allSlides.length,
      narrative_arc: outline.narrative_arc,
      effective_style: effectiveStyleId,
      effective_ratio: effectiveRatio,
      path: generationPath,
    });

    // 持久化 outline + auto 写回
    await step.run("persist-outline", async () => {
      await updateTaskAnalyzeResult(taskId, outline, modelUsed);
      if (autoStyle || autoRatio) {
        await updateTaskEffectiveStyleRatio(taskId, effectiveStyleId, effectiveRatio);
      }
      await appendTaskVersion({
        id: nanoid(12),
        taskId,
        versionNo: task.currentVersionNo,
        outline,
      });
    });

    // 预扣积分:L1 = 1 积分/页(纯 LLM,DeepSeek V3 成本极低,2026-05-05 用户决策)
    //         L2 = 5 积分/页(走 gpt-image-2)
    const chargeAmount =
      generationPath === "L1"
        ? allSlides.length * 1
        : estimateCreditsForCards({ cardCount: allSlides.length });
    await step.run("charge-credits", async () => {
      try {
        await chargeCredits({
          txId: nanoid(12),
          userId,
          amount: chargeAmount,
          reason: "generate",
          taskId,
          modelUsed: generationPath === "L1" ? "deepseek-v4-flash" : "apimart-gpt-image-2",
          metadata: { slideCount: allSlides.length, path: generationPath },
        });
        logger.info("[slides-generate] 预扣", { taskId, chargeAmount });
      } catch (e) {
        if (e instanceof InsufficientCreditsError) {
          await updateTaskStatus(taskId, "failed");
          throw new Error(`INSUFFICIENT_CREDITS:需要 ${e.required},余额 ${e.balance}`);
        }
        throw e;
      }
    });

    // 大纲确认介入(M2.3 同模式,复用 cards 的事件)
    await step.run("mark-confirming", () =>
      updateTaskStatus(taskId, "confirming", "confirm"),
    );
    const confirm = await step.waitForEvent("wait-outline-confirm", {
      event: "task/cards.outline-confirmed",
      match: "data.taskId",
      timeout: "24h",
    });
    if (!confirm) {
      await step.run("mark-cancelled-timeout", async () => {
        await updateTaskStatus(taskId, "cancelled");
        await refundCredits({
          txId: nanoid(12),
          userId,
          amount: chargeAmount,
          reason: "refund_cancelled",
          taskId,
          metadata: { cause: "outline-confirm-timeout" },
        });
      });
      return { taskId, cancelled: true, reason: "timeout" };
    }
    if (confirm.data.action === "redo") {
      await step.run("mark-cancelled-redo", async () => {
        await updateTaskStatus(taskId, "cancelled");
        await refundCredits({
          txId: nanoid(12),
          userId,
          amount: chargeAmount,
          reason: "refund_cancelled",
          taskId,
          metadata: { cause: "user-redo" },
        });
      });
      return { taskId, cancelled: true, reason: "user-redo" };
    }

    // M9 Cancel check:出图(或 L1 渲染)前最后一道关卡 — 用户主动取消
    const cancelCheck = await step.run("check-cancel-before-render", async () => {
      const t = await getTask(taskId);
      return t?.status === "cancelled";
    });
    if (cancelCheck) {
      await step.run("refund-on-user-cancel", async () => {
        await refundCredits({
          txId: nanoid(12),
          userId,
          amount: chargeAmount,
          reason: "refund_cancelled",
          taskId,
          metadata: { cause: "user-cancel" },
        });
      });
      return { taskId, cancelled: true, reason: "user-cancel" };
    }

    // 切到 generating
    await step.run("mark-generating", async () => {
      await updateTaskStatus(taskId, "generating", "batch");
      await setImageModelUsed(
        taskId,
        generationPath === "L1" ? "deepseek-v4-flash" : "apimart-gpt-image-2",
      );
    });

    // 出 deck — 双路径分叉
    if (generationPath === "L1") {
      // L1:每张调 Claude 出 HTML
      for (const slide of allSlides) {
        await generateOneSlideL1({
          step,
          taskId,
          slide,
          style: effectiveStyle,
          ratio: effectiveRatio,
          locale: task.locale,
        });
      }
    } else {
      // L2:封面无 ref → 后续都用封面作 ref(Anchor Chain)
      // 模板锁定时,把 baoyu 风格 spec 注入到每张 prompt 前
      const baoyuPrefix = isL2Templated && tplRow ? buildL2BaoyuPrefix(tplRow) : undefined;
      const anchorUrl = await generateOneSlideL2({
        step,
        taskId,
        slide: allSlides[0],
        style: effectiveStyle,
        ratio: effectiveRatio,
        anchorImageUrl: undefined,
        baoyuPrefix,
        locale: task.locale,
      });
      for (let i = 1; i < allSlides.length; i++) {
        await generateOneSlideL2({
          step,
          taskId,
          slide: allSlides[i],
          style: effectiveStyle,
          ratio: effectiveRatio,
          anchorImageUrl: anchorUrl,
          baoyuPrefix,
          locale: task.locale,
        });
      }
    }

    await step.run("mark-done", () => updateTaskStatus(taskId, "done", "done"));
    logger.info("[slides-generate] 完成", { taskId, total: allSlides.length });
    return { taskId, total: allSlides.length };
  },
);

// ─────────────────────── L1 单 slide ───────────────────────

async function generateOneSlideL1(args: {
  step: StepTools;
  taskId: string;
  slide: SlideEntry;
  style: SlideStyle;
  ratio: SlideRatio;
  locale?: import("@/i18n/routing").Locale;
}): Promise<void> {
  const { step, taskId, slide, style, ratio, locale } = args;
  const prefix = `slide-l1-${slide.index}`;

  const assembled = assembleSlidePrompt({
    slide,
    style,
    ratio,
    generationPath: "L1",
    locale,
  });
  if (!assembled.htmlPrompt) throw new Error(`L1 assembly missing htmlPrompt for slide ${slide.index}`);

  const html = await step.run(`${prefix}-claude`, async () => {
    const completion = await ai.text.complete({
      system: assembled.htmlPrompt!.system,
      user: assembled.htmlPrompt!.user,
      tier: "default",
      maxTokens: 4096,
      temperature: 0.4,
      cacheSystem: true,
    });
    // 剥 markdown 围栏(LLM 偶尔会包)
    return completion.text
      .trim()
      .replace(/^```(?:html)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();
  });

  await step.run(`${prefix}-persist`, async () => {
    // M5.C 简化:HTML 直接存 storage_url 字段(< 8KB 单条 row 够,M7 改 R2 文件)
    await appendTaskFile({
      id: nanoid(12),
      taskId,
      type: "image", // schema v2 type 限 'source/prompt/image/ref/export';HTML 暂归 image,M6+ 加 'slide_html'
      pageNo: slide.index,
      pageVersion: 1,
      role: slide.role === "content" ? "content" : slide.role === "closing" ? "closing" : "cover",
      filename: `slide-${slide.index}-${slide.layout_id ?? "unknown"}.html`,
      storageUrl: `data:text/html;base64,${Buffer.from(html, "utf-8").toString("base64")}`,
      mimeType: "text/html",
    });
  });
}

// ─────────────────────── L2 单 slide ───────────────────────

async function generateOneSlideL2(args: {
  step: StepTools;
  taskId: string;
  slide: SlideEntry;
  style: SlideStyle;
  ratio: SlideRatio;
  anchorImageUrl?: string;
  /** M5+ T2-30:L2 模板锁 baoyu 风格时,把 spec 前置到每张 image prompt */
  baoyuPrefix?: string;
  locale?: import("@/i18n/routing").Locale;
}): Promise<string> {
  const { step, taskId, slide, style, ratio, anchorImageUrl, baoyuPrefix, locale } = args;
  const prefix = `slide-l2-${slide.index}`;

  const assembled = assembleSlidePrompt({
    slide,
    style,
    ratio,
    generationPath: "L2",
    anchorImageUrl,
    locale,
  });
  if (!assembled.imagePrompt) throw new Error(`L2 assembly missing imagePrompt for slide ${slide.index}`);

  // L2 模板:把 baoyu 风格 spec 注入到 image prompt 前
  const finalPrompt = baoyuPrefix
    ? `${baoyuPrefix}\n\n${assembled.imagePrompt}`
    : assembled.imagePrompt;

  const submitted = await step.run(`${prefix}-submit`, async () => {
    const provider = ai.image.pick();
    return provider.submit({
      prompt: finalPrompt,
      ratio,
      n: 1,
      refImageUrls: anchorImageUrl ? [anchorImageUrl] : undefined,
    });
  });
  await step.sleep(`${prefix}-wait`, "15s");

  let imageUrl: string | null = null;
  for (let i = 0; i < 12; i++) {
    const result = await step.run(`${prefix}-poll-${i}`, async () => {
      const provider = ai.image.pick();
      return provider.poll(submitted.taskId);
    });
    if (result.status === "completed") {
      imageUrl = result.imageUrls[0];
      break;
    }
    if (result.status === "failed") throw new Error(`L2 失败: ${result.error}`);
    await step.sleep(`${prefix}-poll-wait-${i}`, "5s");
  }
  if (!imageUrl) throw new Error(`L2 轮询超时 slide ${slide.index}`);

  // S1 NSFW 检查(SPEC §0.5 安全审查):违规图抛错
  const nsfwCheck = await step.run(`${prefix}-nsfw`, async () => {
    const { checkImageNSFW } = await import("@/lib/safety/nsfw");
    return checkImageNSFW(imageUrl);
  });
  if (!nsfwCheck.safe) {
    console.warn(
      `[slides-generate L2] task=${taskId} slide=${slide.index} NSFW blocked:`,
      nsfwCheck.flaggedCategories,
    );
    const { nsfwCategoriesToUserMessage } = await import("@/lib/safety/nsfw");
    throw new Error(`NSFW_BLOCKED: ${nsfwCategoriesToUserMessage(nsfwCheck.flaggedCategories)}`);
  }

  await step.run(`${prefix}-persist`, async () => {
    await appendTaskFile({
      id: nanoid(12),
      taskId,
      type: "image",
      pageNo: slide.index,
      pageVersion: 1,
      role: slide.role === "content" ? "content" : slide.role === "closing" ? "closing" : "cover",
      filename: `slide-${slide.index}-${slide.visual_pattern ?? "unknown"}.png`,
      storageUrl: imageUrl,
      mimeType: "image/png",
    });
  });
  return imageUrl;
}
