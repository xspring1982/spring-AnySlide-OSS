// SPEC §2.7.2 — 单张重生
//
// 触发事件:`task/cards.regenerate-card` { taskId, userId, cardIndex }
// 流程:
//   1. load task + outline + 找到第 cardIndex 张
//   2. 找最新封面图作 anchor(图 1 的最高 version 那张)
//   3. assembleCardPrompt(card, anchorImageUrl=封面)
//   4. apimart submit + poll
//   5. 写新版本到 task_files(pageNo=cardIndex, pageVersion += 1)
//
// SPEC §2.8.5 重生成版本的画布定位:新版本画布上不替换原图,而是出现在原图右侧 +pageVersion 偏移。
//   M1.7 阶段 TaskCanvas 用 byPage Map 取最高 pageVersion 替换显示,等价于"替换"。
//   M2 后续可以加"看历史版本"按钮,但 v1 实现先做"替换"。

import { nanoid } from "nanoid";
import { staticSchema, type GetStepTools } from "inngest";
import { inngest, type CardsRegenerateCardPayload } from "../client";
import { ai } from "@/lib/ai";
import {
  assembleCardPrompt,
  type AnalyzeOutput,
  type AnalyzeCard,
} from "@/lib/cards/agents";
import { getCardStyle } from "@/lib/cards/styles";
import type { CardStyleId, RatioId } from "@/lib/cards/styles/types";
import {
  getTask,
  updateTaskStatus,
  appendTaskFile,
  listTaskImageFiles,
} from "@/lib/tasks/repo";
import {
  chargeCredits,
  refundCredits,
  estimateCreditsForRegenerate,
  InsufficientCreditsError,
} from "@/lib/credits";

type StepTools = GetStepTools<typeof inngest>;

const CARDS_RATIOS: RatioId[] = ["3:4", "4:5", "1:1", "9:16", "16:9", "3:2"];
function asRatio(s: string): RatioId {
  if (s === "auto") return "3:4";
  if ((CARDS_RATIOS as string[]).includes(s)) return s as RatioId;
  return "3:4";
}
function asStyleId(s: string): CardStyleId {
  if (s === "auto") return "xiaohongshu_fresh";
  try {
    getCardStyle(s as CardStyleId);
    return s as CardStyleId;
  } catch {
    return "xiaohongshu_fresh";
  }
}

export const cardsRegenerateCard = inngest.createFunction(
  {
    id: "cards-regenerate-card",
    name: "Cards 单张重生",
    concurrency: { key: "event.data.taskId + '-' + event.data.cardIndex", limit: 1 },
    retries: 0,
    triggers: [
      {
        event: "task/cards.regenerate-card",
        schema: staticSchema<CardsRegenerateCardPayload>(),
      },
    ],
    // M3.3:重生失败时退还本次扣的积分
    onFailure: async ({ event, error, logger }) => {
      const original = event.data.event as {
        data: { taskId: string; userId: string };
      };
      const { taskId, userId } = original.data;
      logger.warn("[cards-regenerate-card] onFailure 触发,尝试退款", {
        taskId,
        error: error.message,
      });
      // T2-51:写 errorMessage 到 task。父任务整体 OK(只是单张重生失败),
      // 因此把 status 重置回 "done" — 顺带修了 mark-regenerating 之后失败时
      // task 永远卡在 "generating" 的 pre-existing 边角问题
      try {
        const { toUserFriendlyError } = await import("@/lib/tasks/error-message");
        await updateTaskStatus(taskId, "done", "done", toUserFriendlyError(error.message));
      } catch (e) {
        logger.error("[cards-regenerate-card] 状态重置失败", e as Error);
      }
      try {
        const { sql } = await import("@/lib/db");
        // 找最近一笔重生扣费(metadata.regenerate=true)
        const rows = (await sql`
          SELECT id, delta FROM credit_transactions
          WHERE user_id = ${userId}
            AND task_id = ${taskId}
            AND reason = 'generate'
            AND metadata->>'regenerate' = 'true'
          ORDER BY created_at DESC
          LIMIT 1
        `) as Array<{ id: string; delta: number }>;
        if (rows[0]) {
          await refundCredits({
            txId: nanoid(12),
            userId,
            amount: -rows[0].delta,
            reason: "refund_failed",
            taskId,
            metadata: { regenerate_charge_id: rows[0].id },
          });
        }
      } catch (e) {
        logger.error("[cards-regenerate-card] 退款失败", e as Error);
      }
    },
  },
  async ({ event, step, logger }) => {
    const { taskId, userId, cardIndex } = event.data;
    logger.info("[cards-regenerate-card] 开始", { taskId, cardIndex });

    // ─── 1. load task + outline + 该张卡 ───
    const ctx = await step.run("load-context", async () => {
      const task = await getTask(taskId);
      if (!task) throw new Error(`task ${taskId} 不存在`);
      if (task.userId !== userId) throw new Error("用户不匹配");
      if (task.mode !== "cards") throw new Error("非 cards 模式");
      if (task.status !== "done") {
        throw new Error(
          `任务状态 ${task.status},仅 done 后可重生单张(M3 起开放更多状态)`,
        );
      }
      const outline = task.analyzeResult as AnalyzeOutput | null;
      if (!outline?.cards) throw new Error("outline 不存在");
      const card = outline.cards.find((c) => c.index === cardIndex);
      if (!card) throw new Error(`outline 中找不到 index=${cardIndex} 的卡片`);

      // 找现有图片:封面(pageNo=1)的最新版本作 anchor;该 card 的当前最高版本号 + 1 = newVersion
      const files = await listTaskImageFiles(taskId);
      const cover = files
        .filter((f) => f.pageNo === 1)
        .sort((a, b) => b.pageVersion - a.pageVersion)[0];
      const cardFiles = files.filter((f) => f.pageNo === cardIndex);
      const maxVersion = cardFiles.reduce(
        (m, f) => (f.pageVersion > m ? f.pageVersion : m),
        0,
      );
      const newVersion = maxVersion + 1;

      return {
        styleId: task.styleId,
        ratio: task.ratio,
        outline,
        card,
        anchorUrl: cover?.storageUrl,
        newVersion,
      };
    });

    // M3.3:单张重生预扣
    const chargeAmount = estimateCreditsForRegenerate({});
    await step.run("charge-credits", async () => {
      try {
        const { newBalance } = await chargeCredits({
          txId: nanoid(12),
          userId,
          amount: chargeAmount,
          reason: "generate",
          taskId,
          modelUsed: "apimart-gpt-image-2",
          metadata: { regenerate: true, cardIndex },
        });
        logger.info("[cards-regenerate-card] 预扣积分", {
          taskId,
          cardIndex,
          chargeAmount,
          newBalance,
        });
      } catch (e) {
        if (e instanceof InsufficientCreditsError) {
          throw new Error(`INSUFFICIENT_CREDITS: 需要 ${e.required},余额 ${e.balance}`);
        }
        throw e;
      }
    });

    // 标记 generating(让 SSE 推前端"重生中")
    await step.run("mark-regenerating", () =>
      updateTaskStatus(taskId, "generating", "batch"),
    );

    // ─── 2. 提交 + 轮询 + 落新版本 ───
    const imageUrl = await regenerateOne({
      step,
      taskId,
      taskRatio: ctx.ratio,
      taskStyleId: ctx.styleId,
      outline: ctx.outline,
      card: ctx.card,
      anchorImageUrl: ctx.anchorUrl,
      pageVersion: ctx.newVersion,
    });

    // 标记 done(任务整体已完成,这是单张刷新)
    await step.run("mark-done-after-regen", () =>
      updateTaskStatus(taskId, "done", "done"),
    );

    logger.info("[cards-regenerate-card] 完成", {
      taskId,
      cardIndex,
      newVersion: ctx.newVersion,
      imageUrl: imageUrl.slice(0, 80),
    });
    return { taskId, cardIndex, newVersion: ctx.newVersion };
  },
);

// ─────────────────────── 单卡 submit + poll + 落 task_files ───────────────────────

interface RegenerateArgs {
  step: StepTools;
  taskId: string;
  taskRatio: string;
  taskStyleId: string;
  outline: AnalyzeOutput;
  card: AnalyzeCard;
  anchorImageUrl?: string;
  pageVersion: number;
}

async function regenerateOne(args: RegenerateArgs): Promise<string> {
  const {
    step,
    taskId,
    taskRatio,
    taskStyleId,
    outline,
    card,
    anchorImageUrl,
    pageVersion,
  } = args;
  const styleId = asStyleId(taskStyleId);
  const ratio = asRatio(taskRatio);
  const style = getCardStyle(styleId);
  const prefix = `regen-${card.index}-v${pageVersion}`;

  const prompt = assembleCardPrompt({
    card,
    style,
    ratio,
    totalCount: outline.cards.length,
    anchorImageUrl,
  });

  const submitted = await step.run(`${prefix}-submit`, async () => {
    const provider = ai.image.pick();
    return provider.submit({
      prompt,
      ratio,
      n: 1,
      refImageUrls: anchorImageUrl ? [anchorImageUrl] : undefined,
    });
  });

  await step.sleep(`${prefix}-initial-wait`, "15s");

  let imageUrl: string | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const result = await step.run(`${prefix}-poll-${attempt}`, async () => {
      const provider = ai.image.pick();
      return provider.poll(submitted.taskId);
    });
    if (result.status === "completed") {
      imageUrl = result.imageUrls[0];
      break;
    }
    if (result.status === "failed") {
      throw new Error(`重生失败: ${result.error}`);
    }
    await step.sleep(`${prefix}-poll-wait-${attempt}`, "5s");
  }

  if (!imageUrl) {
    throw new Error(`重生轮询超时,card ${card.index}`);
  }

  // S1 NSFW 检查(SPEC §0.5 安全审查):违规图抛错,上层 catch 后退积分 + task=failed
  const nsfwCheck = await step.run(`${prefix}-nsfw`, async () => {
    const { checkImageNSFW } = await import("@/lib/safety/nsfw");
    return checkImageNSFW(imageUrl);
  });
  if (!nsfwCheck.safe) {
    console.warn(
      `[cards-regenerate] task=${taskId} card=${card.index} NSFW blocked:`,
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
      pageNo: card.index,
      pageVersion,
      role: card.role,
      filename: `${card.index}-${card.composition}-v${pageVersion}.png`,
      storageUrl: imageUrl,
      mimeType: "image/png",
    });
  });

  return imageUrl;
}
