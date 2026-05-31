// Cards 爆款基因 4 模块 —— SPEC §2.5
//
// 共享类型：
//  - ViralIntensity：从 §2.4 CardStyle 透传过来的 gate 维度（'high' | 'medium' | 'low'）
//    — 真相源在 @/lib/cards/styles/types，本文件仅 re-export 保持各模块就近引用习惯
//  - CardRole：§2.5.4 / §2.5.6 区分 cover / content / closing 三种位置（本模块自有）
//
// 每个模块（cover-hooks / title-patterns / content-triggers / emphasis-words）
// 各自独立维护自己的注册表 + 选择函数 + viralIntensity gate；
// 4 模块由 §2.6 三 prompt 模板统一调度。

export type { ViralIntensity } from "@/lib/cards/styles/types";

/** SPEC §2.5.6：每张卡片的角色，决定哪些模块对它生效 */
export type CardRole = "cover" | "content" | "closing";
