// PR27 — Slides Refine 端到端 inngest function
//
// 触发:POST /api/tasks/[taskId]/refine-deck 收到用户的整 deck 修改意见后
// 发 event `task/slides.refine`,本函数接管。
//
// 流程:
//   1. load task + 取当前最新 deck.html(L1 模板填充模式存 pageNo=1)
//   2. 调 planRefineDeck() 让 LLM 决定改哪几页 + 每页 instruction
//   3. 对每条 edit 串行调 refineL1Section() 改写对应 section(deck html 渐进式累加)
//   4. 全部改完后写新 task_file(pageVersion + 1),SSE diff 推前端
//   5. 扣 1 积分(generate),失败 onFailure 退款
//
// 设计要点:
//   - concurrency.key=taskId limit=1 — 同 task 同时刻只允许一个 refine
//   - 单 task_file 多 pageVersion — 复用 refine-slide 的存储模型,前端 SSE 已支持
//   - 串行 LLM 调用 — 不并发(deckHtml 是滚动状态,并发会丢更新)
//   - 改完后 task status 仍为 done(不是 confirming) — 用户已经 done 过一次,不再回 confirming
//
// 失败兜底(onFailure):
//   - LLM 返回格式错 → throw → onFailure 退 1 积分 + 把 task.status 改回 done
//     (不改 failed,因为旧 deck 还在,用户体验上"什么都没发生")

import { nanoid } from "nanoid";
import { staticSchema } from "inngest";
import { inngest } from "../client";
import {
  getTask,
  updateTaskStatus,
  appendTaskFile,
  listTaskImageFiles,
} from "@/lib/tasks/repo";
import {
  chargeCredits,
  refundCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import { refineL1Section } from "./slides-template-fill";
import { planRefineDeck } from "@/lib/slides/agents/refine-deck";
import type { SlidesAnalyzeOutput } from "@/lib/slides/agents/types";

const REFINE_CREDIT_AMOUNT = 1;

export type SlidesRefinePayload = {
  taskId: string;
  userId: string;
  /** 用户的修改意见原文 */
  feedback: string;
} & Record<string, unknown>;

export const slidesRefine = inngest.createFunction(
  {
    id: "slides-refine",
    name: "Slides Refine(已生成 deck 的整体修改)",
    concurrency: { key: "event.data.taskId", limit: 1 },
    retries: 0,
    triggers: [
      {
        event: "task/slides.refine",
        schema: staticSchema<SlidesRefinePayload>(),
      },
    ],
    onFailure: async ({ event, error, logger }) => {
      const original = event.data.event as {
        data: { taskId: string; userId: string };
      };
      const { taskId, userId } = original.data;
      logger.warn("[slides-refine] onFailure 退款", {
        taskId,
        error: error.message,
      });
      try {
        // refine 失败:不改 failed,因为旧 deck 还在 — 用户看不到任何变化
        // 只把 status 拉回 done(refine 启动时改成了 generating)
        await updateTaskStatus(taskId, "done");
      } catch (e) {
        logger.error("[slides-refine] mark done 失败", e as Error);
      }
      try {
        const { sql } = await import("@/lib/db");
        const rows = (await sql`
          SELECT delta FROM credit_transactions
          WHERE user_id = ${userId} AND task_id = ${taskId} AND reason = 'generate'
          ORDER BY created_at DESC
          LIMIT 1
        `) as Array<{ delta: number }>;
        if (rows[0] && rows[0].delta < 0) {
          await refundCredits({
            txId: nanoid(12),
            userId,
            amount: -rows[0].delta,
            reason: "refund_failed",
            taskId,
            metadata: {
              error: error.message.slice(0, 200),
              source: "slides-refine",
            },
          });
        }
      } catch (e) {
        logger.error("[slides-refine] 退款失败", e as Error);
      }
    },
  },
  async ({ event, step, logger }) => {
    const { taskId, userId, feedback } = event.data;
    logger.info("[slides-refine] 开始", { taskId, feedbackLen: feedback.length });

    // 1. load + 校验
    const task = await step.run("load-task", async () => {
      const t = await getTask(taskId);
      if (!t) throw new Error(`task ${taskId} 不存在`);
      if (t.userId !== userId) throw new Error("user 不匹配");
      if (t.mode !== "slides") throw new Error("非 slides 任务,不支持 refine");
      if (!t.templateId)
        throw new Error("非模板填充任务,不支持 refine(L2 / 无模板路径)");
      return t;
    });

    // 2. 取最新 deck.html
    const initialDeck = await step.run("load-latest-deck", async () => {
      const files = await listTaskImageFiles(taskId);
      const deckFiles = files.filter(
        (f) => f.pageNo === 1 && f.storageUrl.startsWith("data:text/html"),
      );
      if (deckFiles.length === 0) {
        throw new Error("找不到 deck.html(可能是 L2 模式或未完成生成)");
      }
      deckFiles.sort((a, b) => b.pageVersion - a.pageVersion);
      const latest = deckFiles[0];
      const m = latest.storageUrl.match(/^data:text\/html;base64,(.+)$/);
      if (!m) throw new Error("deck.html 格式异常");
      const html = Buffer.from(m[1], "base64").toString("utf-8");
      return { html, basePageVersion: latest.pageVersion };
    });

    // 3. 切到 generating 触发前端 SSE 重连
    await step.run("mark-generating", () =>
      updateTaskStatus(taskId, "generating"),
    );

    // 4. 扣 1 积分(失败抛 InsufficientCredits)
    await step.run("charge-credits-refine", async () => {
      try {
        await chargeCredits({
          txId: nanoid(12),
          userId,
          amount: REFINE_CREDIT_AMOUNT,
          reason: "generate",
          taskId,
          modelUsed: "claude-refine-deck",
          metadata: {
            kind: "slides-refine",
            feedback: feedback.slice(0, 500),
          },
        });
      } catch (e) {
        if (e instanceof InsufficientCreditsError) {
          throw new Error(
            `INSUFFICIENT_CREDITS:需要 ${e.required},余额 ${e.balance}`,
          );
        }
        throw e;
      }
    });

    // 5. 计算 deck section 数量(给 LLM 做边界)
    //    简单粗暴 split <section>(只看开标签,够用) — 跟 parseDeckShell 的策略一致
    const totalPages =
      (initialDeck.html.match(/<section\b/gi) ?? []).length || 1;

    // 6. 调指挥层 LLM:决定改哪几页 + 每页指令
    const plan = await step.run("plan-refine", async () => {
      const outline = (task.analyzeResult ?? {}) as SlidesAnalyzeOutput;
      // outline 可能没有 cover(老 task / loadAnalyze 失败) — refine-deck agent 内部已兜底
      return planRefineDeck({
        outline,
        totalPages,
        feedback,
        locale: task.locale,
      });
    });

    logger.info("[slides-refine] LLM 计划", {
      editCount: plan.edits.length,
      skippedCount: plan.skipped.length,
      reasoning: plan.reasoning.slice(0, 100),
    });

    // 7. 没有 edits 直接结束(LLM 判断超能力 → reasoning 已存日志,前端可 toast)
    if (plan.edits.length === 0) {
      await step.run("mark-done-no-op", () =>
        updateTaskStatus(taskId, "done"),
      );
      // 注意:此时已扣 1 积分。这是设计选择 — LLM 也做了真实推理,扣费合理。
      // 用户能看到 reasoning(通过 task.errorMessage 字段?MVP 暂不展示,前端只看 status)
      return {
        taskId,
        edits: 0,
        skipped: plan.skipped,
        reasoning: plan.reasoning,
        noOp: true,
      };
    }

    // 8. 串行改写每页(deckHtml 渐进式累加)
    let currentDeck = initialDeck.html;
    for (let i = 0; i < plan.edits.length; i++) {
      const edit = plan.edits[i];
      const stepLabel = `refine-section-${edit.pageNo}-${i}`;
      const result = await step.run(stepLabel, async () => {
        return refineL1Section({
          deckHtml: currentDeck,
          pageNo: edit.pageNo,
          instruction: edit.instruction,
          locale: task.locale,
        });
      });
      currentDeck = result.html;
      logger.info("[slides-refine] 已改 section", {
        pageNo: edit.pageNo,
        model: result.modelUsed,
      });
    }

    // 9. 写新 task_file(pageVersion + 1),SSE diff 自动推前端 reload deck
    const newPageVersion = initialDeck.basePageVersion + 1;
    await step.run("persist-refined-deck", async () => {
      const dataUrl = `data:text/html;base64,${Buffer.from(currentDeck, "utf-8").toString("base64")}`;
      await appendTaskFile({
        id: nanoid(12),
        taskId,
        type: "image",
        pageNo: 1,
        pageVersion: newPageVersion,
        role: "cover",
        filename: `deck-refined-v${newPageVersion}.html`,
        storageUrl: dataUrl,
        mimeType: "text/html",
      });
    });

    // 10. 回到 done
    await step.run("mark-done-after-refine", () =>
      updateTaskStatus(taskId, "done"),
    );

    return {
      taskId,
      edits: plan.edits.length,
      skipped: plan.skipped,
      reasoning: plan.reasoning,
      newPageVersion,
    };
  },
);
