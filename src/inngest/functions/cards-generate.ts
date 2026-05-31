// SPEC §2.1 Step 4-8 — 图文笔记生成主流程
//
// 接收事件:`task/cards.generate` { taskId, userId }
// 流程:
//   1. load task / mark analyzing
//   2. analyze + outline(调 DeepSeek 文本)→ 写 task_versions
//   3. outline 确认
//   4. 用本地 HTML/CSS 渲染每张图文笔记
//   5. Playwright 截成 PNG,落 task_files
//   6. mark done
//
// 2026-05-28:cards 重新上线为「图文笔记」,不再走 gpt-image-2 / Anchor Chain。

import { nanoid } from "nanoid";
import { staticSchema } from "inngest";
import { inngest, type CardsGeneratePayload } from "../client";

import { ai } from "@/lib/ai";
import {
  buildAnalyzeMessages,
  parseAnalyzeOutput,
} from "@/lib/cards/agents";
import { getCardStyle } from "@/lib/cards/styles";
import type { CardStyleId, RatioId } from "@/lib/cards/styles/types";
import { renderNoteCardsAsPngDataUrls } from "@/lib/cards/notes-renderer";
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
  InsufficientCreditsError,
} from "@/lib/credits";

const CARDS_RATIOS: RatioId[] = ["3:4", "4:5", "1:1", "9:16", "16:9", "3:2"];

/**
 * "auto" / 未识别值都走默认 3:4(cards 默认)。
 * M2 增强:LLM 在 analyze 阶段输出 recommended_ratio,这里换成读 outline.ratio。
 */
function asRatio(s: string): RatioId {
  if (s === "auto") return "3:4";
  if ((CARDS_RATIOS as string[]).includes(s)) return s as RatioId;
  return "3:4";
}

/**
 * "auto" / 未识别值都走默认 xiaohongshu_fresh(cards 高频风格)。
 * M2 增强:让 analyze 阶段 LLM 基于内容主题在 6 风格中推荐一个,
 * 输出到 outline.recommended_style,这里读出来用。
 */
function asStyleId(s: string): CardStyleId {
  if (s === "auto") return "xiaohongshu_fresh";
  try {
    getCardStyle(s as CardStyleId);
    return s as CardStyleId;
  } catch {
    return "xiaohongshu_fresh";
  }
}

export const cardsGenerate = inngest.createFunction(
  {
    id: "cards-generate",
    name: "Cards 端到端生成",
    concurrency: { key: "event.data.taskId", limit: 1 },
    retries: 0, // 失败直接 mark failed,onFailure 退款
    triggers: [
      {
        event: "task/cards.generate",
        schema: staticSchema<CardsGeneratePayload>(),
      },
    ],
    // M3.2:函数终局失败时,退还已预扣的积分(charge-credits step 之后才会失败的场景)
    onFailure: async ({ event, error, logger }) => {
      const original = event.data.event as { data: { taskId: string; userId: string } };
      const { taskId, userId } = original.data;
      logger.warn("[cards-generate] onFailure 触发,尝试退款", {
        taskId,
        error: error.message,
      });

      // mark task failed(若尚未)+ 落 errorMessage(T2-51)
      try {
        const { toUserFriendlyError } = await import("@/lib/tasks/error-message");
        await updateTaskStatus(taskId, "failed", null, toUserFriendlyError(error.message));
      } catch (e) {
        logger.error("[cards-generate] mark failed 失败", e as Error);
      }

      // 找到 generate 流水推算退款金额(charge-credits step 跑过才有)
      try {
        const { sql } = await import("@/lib/db");
        const rows = (await sql`
          SELECT delta FROM credit_transactions
          WHERE user_id = ${userId} AND task_id = ${taskId} AND reason = 'generate'
          LIMIT 1
        `) as Array<{ delta: number }>;
        if (rows[0]) {
          const refundAmount = -rows[0].delta;
          await refundCredits({
            txId: nanoid(12),
            userId,
            amount: refundAmount,
            reason: "refund_failed",
            taskId,
            metadata: { error_message: error.message.slice(0, 200) },
          });
          logger.info("[cards-generate] 退款成功", { taskId, refundAmount });
        }
      } catch (e) {
        logger.error("[cards-generate] 退款失败", e as Error);
      }
    },
  },
  async ({ event, step, logger }) => {
    const { taskId, userId } = event.data;
    logger.info("[cards-generate] 开始", { taskId, userId });

    // ─── Step 1:load task ───
    const task = await step.run("load-task", async () => {
      const t = await getTask(taskId);
      if (!t) throw new Error(`task ${taskId} 不存在`);
      if (t.userId !== userId) throw new Error(`task ${taskId} 用户不匹配`);
      if (t.mode !== "cards") throw new Error(`task ${taskId} 不是 cards 模式`);
      return t;
    });

    if (!task.sourceText || task.sourceText.trim().length < 5) {
      await updateTaskStatus(taskId, "failed");
      throw new Error("source_text 太短或缺失");
    }

    // ─── Step 2:mark analyzing ───
    await step.run("mark-analyzing", () =>
      updateTaskStatus(taskId, "analyzing", "analyze"),
    );

    // M2.7:用户选了 "AI 推荐" 时,先用占位风格让 system prompt 注入构图库,
    // 然后让 LLM 在 outline 顶层输出 recommended_style/ratio,我们后面切换到推荐值。
    const autoStyle = task.styleId === "auto";
    const autoRatio = task.ratio === "auto";

    // ─── Step 2.5:Jina 联网调研(SPEC §5.6,M2.5)
    // 短输入 / 含 URL 时抓取补料,塞进 analyze 的 researchContext
    const researchContext = await step.run("research", async () => {
      if (!ai.research.shouldFetch(task.sourceText!)) return null;
      const ctx = await ai.research.fetch(task.sourceText!);
      logger.info("[cards-generate] research", {
        triggered: true,
        contentChars: ctx?.length ?? 0,
      });
      return ctx;
    });

    // ─── Step 3:analyze + outline ───
    const { outline, modelUsed } = await step.run("analyze", async () => {
      // 占位风格(auto 时用 xiaohongshu_fresh,真推荐由 LLM 写到 outline.recommended_style)
      const placeholderStyleId = asStyleId(task.styleId);
      const placeholderRatio = asRatio(task.ratio);
      const style = getCardStyle(placeholderStyleId);

      const messages = buildAnalyzeMessages({
        userContent: task.sourceText!,
        userIntent: task.title,
        style,
        ratio: placeholderRatio,
        autoStyle,
        autoRatio,
        researchContext: researchContext ?? undefined,
      });

      const completion = await ai.text.complete({
        system: messages.system,
        user: messages.user,
        tier: "default",
        maxTokens: 8192,
        temperature: 0.7,
        cacheSystem: true,
      });

      const parsed = parseAnalyzeOutput(completion.text, { style });
      if (!parsed.ok) {
        console.error(
          "[cards-generate] analyze parse failed; raw text:",
          completion.text.slice(0, 2000),
        );
        throw new Error(
          `analyze 输出解析失败:${parsed.error.kind} ${JSON.stringify(parsed.error).slice(0, 300)}`,
        );
      }
      return { outline: parsed.output, modelUsed: completion.model };
    });

    // M2.7:基于 LLM 推荐 + 用户选择,确定最终生效的 effective style/ratio
    const effectiveStyleId: CardStyleId =
      autoStyle && outline.recommended_style
        ? asStyleId(outline.recommended_style)
        : asStyleId(task.styleId);
    const effectiveRatio: RatioId =
      autoRatio && outline.recommended_ratio
        ? asRatio(outline.recommended_ratio)
        : asRatio(task.ratio);

    logger.info("[cards-generate] outline 拿到", {
      cards: outline.cards.length,
      task_title: outline.task_title,
      effective_style: effectiveStyleId,
      effective_ratio: effectiveRatio,
      style_reason: outline.recommended_style_reason,
    });

    // ─── Step 4:持久化 outline + 把 auto 风格/比例落到真实值 ───
    await step.run("persist-outline", async () => {
      await updateTaskAnalyzeResult(taskId, outline, modelUsed);
      // M2.7:auto 风格/比例被 LLM 推荐过的话,写回真实值,前端 GET /api/tasks/[id] 就能显示
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

    // ─── Step 4.5:基于实际卡片数预扣积分 ───
    // 图文笔记走 HTML/CSS + Playwright 截图,不调 AI 图像模型;按 L1 文本渲染路径 1 积分/张。
    const chargeAmount = outline.cards.length;
    await step.run("charge-credits", async () => {
      try {
        const { newBalance } = await chargeCredits({
          txId: nanoid(12),
          userId,
          amount: chargeAmount,
          reason: "generate",
          taskId,
          modelUsed: "html-note-renderer",
          metadata: { cardCount: outline.cards.length, path: "html_png" },
        });
        logger.info("[cards-generate] 预扣积分", { taskId, chargeAmount, newBalance });
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

    // ─── Step 5(M2.3 大纲确认介入点 SPEC §2.1 Step 7)───
    // 不直接进入批量出图,先 mark confirming 让用户在 chat 列点 ✓ 开始 / ✗ 重做。
    await step.run("mark-confirming", () =>
      updateTaskStatus(taskId, "confirming", "confirm"),
    );

    // 等待用户确认事件(最多 24h);timeout 后任务自动 cancel
    const confirm = await step.waitForEvent("wait-outline-confirm", {
      event: "task/cards.outline-confirmed",
      match: "data.taskId",
      timeout: "24h",
    });

    if (!confirm) {
      // 用户 24h 没确认 → cancel + 退还预扣积分
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
      logger.info("[cards-generate] 大纲确认超时,任务取消 + 退款", { taskId, chargeAmount });
      return { taskId, cancelled: true, reason: "outline-confirm-timeout" };
    }

    if (confirm.data.action === "redo") {
      // 用户拒绝当前大纲 → cancel + 退款
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
      logger.info("[cards-generate] 用户拒绝大纲,任务取消 + 退款", { taskId, chargeAmount });
      return { taskId, cancelled: true, reason: "user-redo" };
    }

    // ─── M9 Cancel check:出图前最后一道关卡 ───
    // 用户在 confirm phase 之前点了"停止" → tasks.status 已 set 为 'cancelled'
    // 这里 short-circuit + 退预扣积分,避免白扣
    const cancelCheck = await step.run("check-cancel-before-image", async () => {
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
      logger.info("[cards-generate] 用户主动取消,退款", { taskId, chargeAmount });
      return { taskId, cancelled: true, reason: "user-cancel" };
    }

    // ─── Step 6:mark generating ───
    await step.run("mark-generating", async () => {
      await updateTaskStatus(taskId, "generating", "batch");
      await setImageModelUsed(taskId, "html-note-renderer");
    });

    // ─── Step 7:HTML/CSS 渲染 + PNG 截图 ───
    const renderedCards = await step.run("render-note-pngs", () =>
      renderNoteCardsAsPngDataUrls({
        outline,
        ratio: effectiveRatio,
        styleId: effectiveStyleId,
      }),
    );

    for (const rendered of renderedCards) {
      await step.run(`card-${rendered.pageNo}-persist`, async () => {
        await appendTaskFile({
          id: nanoid(12),
          taskId,
          type: "image",
          pageNo: rendered.pageNo,
          pageVersion: 1,
          role: rendered.role,
          filename: rendered.filename,
          storageUrl: rendered.dataUrl,
          mimeType: "image/png",
        });
      });
    }

    // ─── Step 8:done ───
    await step.run("mark-done", () =>
      updateTaskStatus(taskId, "done", "done"),
    );

    logger.info("[cards-generate] 完成", { taskId });
    return { taskId, totalCards: outline.cards.length };
  },
);
