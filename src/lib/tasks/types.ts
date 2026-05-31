// 任务数据类型（前后端共享）
// 与 SPEC §2.9.1 tasks 表 schema 对齐，命名 camelCase

import type { Locale } from "@/i18n/routing";

export type TaskMode = "cards" | "slides" | "image";

export type TaskStatus =
  | "created"
  | "analyzing"
  | "clarifying"
  | "outlining"
  | "confirming"
  | "confirming_source"
  | "generating"
  | "done"
  | "failed"
  | "cancelled";

export type AgentPhase =
  | "analyze"
  | "clarify"
  | "outline"
  | "confirm"
  | "cover"
  | "batch"
  | "done";

export type GenerationMode = "batch" | "one-by-one";

/** 任务记录（DB 落地结构 / API 响应基础）*/
export interface TaskRecord {
  id: string;
  userId: string;
  /** M5+:每个 task 必须归属一个 project（cards/image/slides 都一样）*/
  projectId: string;
  mode: TaskMode;
  title: string;
  slug: string;
  status: TaskStatus;
  agentPhase: AgentPhase | null;

  // 输入
  sourceText: string | null;
  sourceFileUrl: string | null;
  styleId: string;
  ratio: string;
  generationMode: GenerationMode;
  templateId: string | null;
  /** slides 保真模式:true = 只分页保留原文,不让 LLM 改写内容。
   *  后端 getTask→rowToTask 始终赋值(boolean);客户端构造的 task 对象可省略(视作 false)。 */
  preserveContent?: boolean;
  /** M9 多语言:任务创建时用户的 UI 语言,生成阶段按此语言调 LLM */
  locale: Locale;

  // image mode 专属输入（SPEC §4.1 Step 1）
  enhance: boolean | null;        // ✨ 是否调 prompt 增强（image only）
  imageCount: number | null;       // 张数 1/2/4（image only）

  // agent 中间产物
  analyzeResult: AnalyzeResult | null;
  clarifyAnswers: ClarifyAnswers | null;
  researchData: unknown | null;

  // 元数据
  currentVersionNo: number;
  textModelUsed: string | null;
  imageModelUsed: string | null;
  totalCreditsCharged: number;
  totalCreditsRefunded: number;

  /** T2-51:失败原因(已转成用户友好中文),null=无错误 */
  errorMessage: string | null;

  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Step 4 analyze 输出（详 SPEC §2.6.1）*/
export interface AnalyzeResult {
  topic: string;
  contentType: string;
  audienceHint: string;
  language: string;
  recommendedCount: number;
  keyPoints: string[];
  recommendedClarifyAnswers?: ClarifyAnswers;
}

/** Step 5 澄清 chip 三个答案（详 SPEC §2.1 Step 5）*/
export interface ClarifyAnswers {
  audience: string; // 年轻女性 / 职场白领 / ...
  focus: string;    // 实用干货 / 情感共鸣 / ...
  tone: string;     // 亲切 / 专业 / ...
}
