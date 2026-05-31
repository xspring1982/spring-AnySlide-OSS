// Inngest 客户端单例
//
// dev 模式:`npx inngest-cli@latest dev` 跑本地 dev server(默认 http://localhost:8288),
//          自动发现 next dev 暴露的 /api/inngest endpoint。
// prod 模式:托管平台 + Inngest Cloud。

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "anyslide",
  // 优先用环境变量;dev 模式留空也能跑(走 dev server)
  ...(process.env.INNGEST_EVENT_KEY
    ? { eventKey: process.env.INNGEST_EVENT_KEY }
    : {}),
});

// ─────────────────────── 事件类型表(给 step.sendEvent / inngest.send 用) ───────────────────────
//
// 命名约定:
//   - cards 模块:`task/cards.<verb>`
//   - slides 模块:`task/slides.<verb>`
//   - image 模块:`task/image.<verb>`
//   - 系统级:`system/<verb>`

// 用 type alias + Record-extending 保持 staticSchema<T extends Record<string, unknown>> 约束
export type CardsGeneratePayload = {
  /** tasks.id */
  taskId: string;
  /** users.id */
  userId: string;
} & Record<string, unknown>;

/** Slides 生成事件复用同 payload(taskId+userId);函数体内通过 task.mode 分流 */
export type SlidesGeneratePayload = CardsGeneratePayload;

/** Image 生成事件复用同 payload */
export type ImageGeneratePayload = CardsGeneratePayload;

export type CardsRegenerateCardPayload = {
  taskId: string;
  userId: string;
  /** 1-based */
  cardIndex: number;
} & Record<string, unknown>;

/** SPEC §2.1 Step 7 — 大纲确认介入点;cards-generate waitForEvent 等这个 */
export type CardsOutlineConfirmedPayload = {
  taskId: string;
  /** start = 直接开始批量出图;redo = 用户对大纲不满意,需要重做 */
  action: "start" | "redo";
} & Record<string, unknown>;
