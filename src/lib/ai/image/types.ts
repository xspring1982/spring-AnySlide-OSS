// SPEC §5.3.3 ImageProvider 抽象接口
//
// 唯一实现(用户决策 2026-05-02 简化为单模型):
//   - apimart-gpt-image-2.ts(异步模式,原生 CJK,$0.006/张 1K)
//
// 移除 nano-banana / Flux 中低档 —— apimart 上 nano-banana 反而更贵,Flux 不支持中文。
// 接口保留 submit + poll 两步,以便未来需要切换异步 / 同步 provider。

import type { RatioId } from "@/lib/cards/styles/types";

/** 提交一次出图请求的参数 */
export interface ImageSubmitInput {
  /** 已经拼装好的最终 prompt(SPEC §2.6.3 5 段)*/
  prompt: string;
  /** 比例(provider 内部映射 size 字符串) */
  ratio: RatioId;
  /** 张数,默认 1。anchor chain 里始终是 1 */
  n?: number;
  /**
   * 参考图 URL 列表(SPEC §2.7 Anchor Chain):
   *   - 图 1 不传(建立锚点)
   *   - 图 2-N 传图 1 的 URL,保持视觉一致
   *   - 用户上传的 ref 也只对图 1 生效(放第一项)
   * apimart 支持最多 16 张。
   */
  refImageUrls?: string[];
}

export interface ImageSubmitResult {
  /** provider 返回的任务 ID,用来后续 poll */
  taskId: string;
}

/** 轮询返回的状态 */
export type ImagePollResult =
  | { status: "pending" | "processing" }
  | { status: "completed"; imageUrls: string[] }
  | { status: "failed"; error: string };

/** Image provider 通用接口 */
export interface ImageProvider {
  /** provider id,日志/账单用 */
  id: "apimart-gpt-image-2";
  /** 提交任务,返回 taskId */
  submit(input: ImageSubmitInput): Promise<ImageSubmitResult>;
  /** 轮询任务状态 */
  poll(taskId: string): Promise<ImagePollResult>;
}
