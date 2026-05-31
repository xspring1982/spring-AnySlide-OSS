// SPEC §2.9.x — projects 表(M5+)
// cards/image/slides 全部进 project 容器,前端展示统一
//   cards/image:1 project 多 task,共享画布,可累积
//   slides:    1 project = 1 task(逻辑上一个 deck)

import type { TaskMode } from "@/lib/tasks/types";

/**
 * 画布全局状态(项目级,而非 task 级)
 * 仅 cards / image 用,slides 不用
 */
export interface CanvasState {
  zoom?: number;
  pan?: { x: number; y: number };
  /** key = `${taskId}-${pageNo}`,override 该卡的位置/尺寸 */
  positions?: Record<string, { x: number; y: number; w?: number; h?: number }>;
}

export interface ProjectRecord {
  id: string;
  userId: string;
  mode: TaskMode;
  title: string;
  canvasState: CanvasState | null;
  coverImageUrl: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 列表用,带 task 数量统计 */
export interface ProjectListItem extends ProjectRecord {
  taskCount: number;
  imageCount: number;
}
