// SPEC §4 — Image 端到端生成(单步轻 agent,无 anchor chain)
//
// 流程:
//   1. load task / mark analyzing
//   2. (可选) Enhance LLM 把用户输入清洗成 image-friendly prompt
//   3. mark generating
//   4. charge credits (image_count × tier 系数,SPEC §5.4.1)
//   5. 并发调 apimart-gpt-image-2 出 N 张(无 anchor chain;每张独立 prompt)
//   6. mark done(任意一张失败 → mark failed + 退款剩余未出图部分)

import { nanoid } from "nanoid";
import { staticSchema, type GetStepTools } from "inngest";
import { inngest, type ImageGeneratePayload } from "../client";
import { ai } from "@/lib/ai";
import { buildEnhanceMessages, cleanEnhanced } from "@/lib/image/agents/enhance";
import { assembleImagePrompt } from "@/lib/image/prompt-assembly";
import { findImageStyle, DEFAULT_IMAGE_STYLE, type ImageStyleId } from "@/lib/styles/image";
import { ApimartGptImage2Provider } from "@/lib/ai/image/apimart-gpt-image-2";
import type { RatioId } from "@/lib/cards/styles/types";
import {
  getTask,
  updateTaskStatus,
  setImageModelUsed,
  appendTaskVersion,
  appendTaskFile,
} from "@/lib/tasks/repo";
import {
  chargeCredits,
  refundCredits,
  estimateCreditsForRegenerate,
  InsufficientCreditsError,
} from "@/lib/credits";

type StepTools = GetStepTools<typeof inngest>;

const VALID_IMAGE_RATIOS: RatioId[] = [
  "3:4",
  "4:5",
  "1:1",
  "9:16",
  "3:2",
  "16:9",
  "4:3",
];
function asImageRatio(s: string): RatioId {
  if (s === "auto") return "1:1";
  if ((VALID_IMAGE_RATIOS as string[]).includes(s)) return s as RatioId;
  return "1:1";
}
function asImageStyleId(s: string): ImageStyleId {
  if (findImageStyle(s)) return s as ImageStyleId;
  return DEFAULT_IMAGE_STYLE;
}

export const imageGenerate = inngest.createFunction(
  {
    id: "image-generate",
    name: "Image 端到端生成",
    retries: 0, // 失败直接 mark failed,onFailure 退款(对齐 cards/slides 模式)
    concurrency: { limit: 5 },
    triggers: [
      {
        event: "task/image.generate",
        schema: staticSchema<ImageGeneratePayload>(),
      },
    ],
    // 函数终局失败时(polling timeout / Inngest 内部异常 / NSFW throw 等),
    // 兜底退款 + mark failed,避免 task 永远卡 generating
    onFailure: async ({ event, error, logger }) => {
      const original = event.data.event as { data: { taskId: string; userId: string } };
      const { taskId, userId } = original.data;
      logger.warn("[image-generate] onFailure 触发,尝试退款 + mark failed", {
        taskId,
        error: error.message,
      });

      try {
        const { toUserFriendlyError } = await import("@/lib/tasks/error-message");
        await updateTaskStatus(taskId, "failed", null, toUserFriendlyError(error.message));
      } catch (e) {
        logger.error("[image-generate] mark failed 失败", e as Error);
      }

      // 找 generate 流水推算退款金额(charge step 跑过才有)
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
            modelUsed: "apimart-gpt-image-2",
            metadata: { error_message: error.message.slice(0, 200) },
          });
          logger.info("[image-generate] 退款成功", { taskId, refundAmount });
        }
      } catch (e) {
        logger.error("[image-generate] 退款失败", e as Error);
      }
    },
  },
  async ({ event, step }) => {
    const { taskId, userId } = event.data;
    return runImageGenerate(step, { taskId, userId });
  },
);

async function runImageGenerate(
  step: StepTools,
  args: { taskId: string; userId: string },
) {
  // ── 1. 加载 task ──
  const task = await step.run("load-task", () => getTask(args.taskId));
  if (!task) throw new Error(`task ${args.taskId} not found`);
  if (task.mode !== "image") {
    throw new Error(`task ${args.taskId} mode=${task.mode},不是 image`);
  }

  await step.run("mark-analyzing", () =>
    updateTaskStatus(args.taskId, "analyzing", "analyze"),
  );

  // task.analyzeResult 里可能塞 { count, enhance } meta(SPEC §4.1)
  const meta = (task.analyzeResult ?? null) as
    | { count?: number; enhance?: boolean }
    | null;
  const count = meta?.count === 2 || meta?.count === 4 ? meta.count : 1;
  const enhanceFlag = meta?.enhance !== false; // 默认 true

  const styleId = asImageStyleId(task.styleId ?? DEFAULT_IMAGE_STYLE);
  const ratio = asImageRatio(task.ratio ?? "1:1");
  const raw = task.sourceText?.trim() || "";
  if (!raw) throw new Error("source_text 为空,无法生成 image");

  // ── 2. (可选) Enhance ──
  let promptCore = raw;
  if (enhanceFlag) {
    promptCore = await step.run("enhance-prompt", async () => {
      const style = findImageStyle(styleId);
      const { system, user } = await buildEnhanceMessages({
        raw,
        styleHint: style?.promptBase,
      });
      const out = await ai.text.complete({
        system,
        user,
        tier: "default",
        cacheSystem: false,
        maxTokens: 400,
      });
      return cleanEnhanced(out.text) || raw;
    });
  }

  // ── 3. mark generating ──
  await step.run("mark-generating", () =>
    updateTaskStatus(args.taskId, "generating", "batch"),
  );
  const versionId = await step.run("ensure-version", async () => {
    const id = `ver_${nanoid(10)}`;
    await appendTaskVersion({ id, taskId: args.taskId, versionNo: 1, outline: {} });
    return id;
  });

  // ── 4. 扣款 ──
  // SPEC §5.4.1 单模型 gpt-image-2:1K 默认 5 积分(2K/4K 高分辨率 Phase 2 再开)
  const perImage = estimateCreditsForRegenerate({});
  const totalCharge = perImage * count;

  await step.run("charge", async () => {
    try {
      await chargeCredits({
        txId: `gen_${args.taskId}_${nanoid(8)}`,
        userId: args.userId,
        amount: totalCharge,
        reason: "generate",
        taskId: args.taskId,
        modelUsed: "apimart-gpt-image-2",
      });
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        await updateTaskStatus(
          args.taskId,
          "failed",
          null,
          "积分余额不足,请前往「充值」页面补充积分后重试",
        );
        throw new Error(`INSUFFICIENT_CREDITS:需要 ${err.required},当前 ${err.balance}`);
      }
      throw err;
    }
  });

  await step.run("set-model", () =>
    setImageModelUsed(args.taskId, "apimart-gpt-image-2"),
  );

  // ── 5. 并发出图 ──
  const provider = new ApimartGptImage2Provider();

  const submitted = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      step.run(`submit-${i + 1}`, async () => {
        const prompt = assembleImagePrompt({ promptCore, styleId, ratio });
        return provider.submit({ prompt, ratio, n: 1 });
      }),
    ),
  );

  // 轮询(每 2s 一次,上限 60 次 = 2 分钟,失败计入 failed 张数)
  const POLL_INTERVAL_MS = 2000;
  const POLL_MAX = 60;

  const results = await Promise.all(
    submitted.map((s, i) =>
      step.run(`poll-${i + 1}`, async () => {
        for (let n = 0; n < POLL_MAX; n++) {
          const r = await provider.poll(s.taskId);
          if (r.status === "completed") return { ok: true as const, urls: r.imageUrls };
          if (r.status === "failed") return { ok: false as const, error: r.error ?? "failed" };
          await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
        }
        return { ok: false as const, error: "polling timeout" };
      }),
    ),
  );

  // 把成功结果落盘 task_files(NSFW 检测前置:违规图直接丢弃,不计成功数,自动走部分退款)
  // T2-51:全失败时要把失败原因写到 task.error_message — 跟踪 NSFW 命中分类 + 生成层错误
  let successCount = 0;
  let nsfwBlockedCount = 0;
  let lastNsfwCategories: string[] = [];
  const generationErrors: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r.ok) {
      generationErrors.push(r.error);
      continue;
    }
    const url = r.urls[0];
    if (!url) {
      generationErrors.push("provider 未返回 image URL");
      continue;
    }

    // S1 NSFW 检查(SPEC §0.5 安全审查)
    const nsfwCheck = await step.run(`nsfw-${i + 1}`, async () => {
      const { checkImageNSFW } = await import("@/lib/safety/nsfw");
      return checkImageNSFW(url);
    });
    if (!nsfwCheck.safe) {
      console.warn(
        `[image-generate] task=${args.taskId} page=${i + 1} NSFW blocked:`,
        nsfwCheck.flaggedCategories,
      );
      nsfwBlockedCount++;
      lastNsfwCategories = nsfwCheck.flaggedCategories;
      continue;
    }

    await step.run(`save-${i + 1}`, () =>
      appendTaskFile({
        id: `tf_${nanoid(10)}`,
        taskId: args.taskId,
        versionId,
        type: "image",
        pageNo: i + 1,
        pageVersion: 1,
        role: null,
        filename: `image_${i + 1}.png`,
        storageUrl: url,
        sizeBytes: null,
        mimeType: "image/png",
      }),
    );
    successCount++;
  }

  // ── 6. mark done / 部分失败 ──
  if (successCount === 0) {
    await step.run("refund-all", () =>
      refundCredits({
        txId: `refund_${args.taskId}_${nanoid(6)}`,
        userId: args.userId,
        amount: totalCharge,
        reason: "refund_failed",
        taskId: args.taskId,
        modelUsed: "apimart-gpt-image-2",
      }),
    );
    // T2-51:把失败原因落地。NSFW 优先(用户可改 prompt 自救),否则报底层错误。
    const { nsfwCategoriesToUserMessage } = await import("@/lib/safety/nsfw");
    const { toUserFriendlyError } = await import("@/lib/tasks/error-message");
    const failMessage =
      nsfwBlockedCount > 0
        ? nsfwCategoriesToUserMessage(lastNsfwCategories)
        : toUserFriendlyError(generationErrors[0] ?? "图片生成全部失败");
    await step.run("mark-failed", () =>
      updateTaskStatus(args.taskId, "failed", null, failMessage),
    );
    return { taskId: args.taskId, status: "failed", successCount: 0 };
  }

  if (successCount < count) {
    // 部分成功:退还失败那部分的钱(已有 successCount 张,所以退 (count-successCount) × perImage)
    const refundAmount = (count - successCount) * perImage;
    await step.run("refund-partial", () =>
      refundCredits({
        txId: `refund_${args.taskId}_${nanoid(6)}`,
        userId: args.userId,
        amount: refundAmount,
        reason: "refund_failed",
        taskId: args.taskId,
        modelUsed: "apimart-gpt-image-2",
      }),
    );

    // T2-44:部分成功时,把"X 张被拦原因 + 已退 Y 积分"写到 task.error_message,
    // 前端在 done 状态下看到 errorMessage 会显示警告气泡(复用 T2-51 通道,零 schema 改动)
    const failed = count - successCount;
    let partialMsg: string;
    if (nsfwBlockedCount > 0) {
      const { nsfwCategoriesToUserMessage } = await import("@/lib/safety/nsfw");
      const reason = nsfwCategoriesToUserMessage(lastNsfwCategories);
      partialMsg = `共请求 ${count} 张,${failed} 张未通过内容审查(${reason.replace(/^图片包含: /, "").replace(/,本次不扣积分。$/, "")}),已退还 ${failed * perImage} 积分。`;
    } else {
      partialMsg = `共请求 ${count} 张,${failed} 张生成失败(可能为服务繁忙),已退还 ${failed * perImage} 积分,可重试。`;
    }
    await step.run("mark-done-partial", () =>
      updateTaskStatus(args.taskId, "done", "done", partialMsg),
    );
  } else {
    await step.run("mark-done", () =>
      updateTaskStatus(args.taskId, "done", "done"),
    );
  }
  return {
    taskId: args.taskId,
    status: "done",
    successCount,
    totalRequested: count,
  };
}
