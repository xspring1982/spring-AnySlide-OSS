// SPEC §3.5.2 — Slides outline-refine prompt
//
// 5 模式:regenerate_slide / change_layout / restructure_arc / add_slide / delete_slide
// 与 analyze 共享 system prefix(命中 prompt cache)。

import { buildSlidesAnalyzeSystemPrompt, parseSlidesAnalyzeOutput } from "./analyze";
import type { SlideStyle } from "../styles/types";
import type {
  GenerationPath,
  SlidesAnalyzeOutput,
  SlidesAnalyzeParseError,
  SlidesRefineInput,
  SlidesRefineMode,
} from "./types";

export function buildSlidesRefineSystemPrompt(
  style: SlideStyle,
  generationPath: GenerationPath,
): string {
  return buildSlidesAnalyzeSystemPrompt(style, generationPath);
}

export function buildSlidesRefineUserPrompt(input: SlidesRefineInput): string {
  const lines: string[] = [
    "# 当前 outline(只修改你被指示的部分,其他保持不变)",
    "<currentOutline>",
    JSON.stringify(input.currentOutline, null, 2),
    "</currentOutline>",
    "",
    `# 修改模式: ${input.mode}`,
    "",
  ];

  switch (input.mode) {
    case "regenerate_slide":
      lines.push(
        "## regenerate_slide",
        `仅重写 index=${input.targetIndex} 的 slide。`,
        "保留 index / role / layout_id(或 visual_pattern)不变。",
        "title / bullets / body / callout / visual_hint / speaker_notes 全部重写。",
      );
      break;
    case "change_layout":
      lines.push(
        "## change_layout",
        `切 index=${input.targetIndex} 的版式 → ${
          input.newLayoutId ?? input.newVisualPattern ?? "(未指定,你来选)"
        }`,
        "**内容字段必须自适应新版式的 contentSlots 上限**(双栏 → 三栏:bullets 拆 3 组;bullets → quote:合并单段;数据网格 → 标题页:仅留主标题)。",
      );
      break;
    case "restructure_arc":
      lines.push(
        "## restructure_arc",
        `把 narrative_arc 改为 ${input.newNarrativeArc ?? "(未指定)"}`,
        "重新拆分 sections 数组,cover / closing 不动。slides 内容尽量不变,只改归属 section。",
      );
      break;
    case "add_slide":
      lines.push(
        "## add_slide",
        `在 index=${input.insertAfter} 后插入 1 张新 slide。`,
        "role 自动判断(在 sections 内 → content;cover 后 → agenda 或 section_divider)。",
        "后续 slide 的 index 全部 +1。",
      );
      break;
    case "delete_slide":
      lines.push(
        "## delete_slide",
        `移除 index=${input.targetIndex} 的 slide。后续 index 全部 -1。`,
        "**不允许**删除 role=cover 或 role=closing。",
      );
      break;
  }

  if (input.userInstruction) {
    lines.push(
      "",
      `# 用户附加说明`,
      `<userInstruction>${input.userInstruction}</userInstruction>`,
    );
  }

  lines.push(
    "",
    "现在输出修改后的完整 outline JSON(schema 同 SlidesAnalyzeOutput,顶层不包裹 wrapper)。",
  );

  return lines.join("\n");
}

export function buildSlidesRefineMessages(input: SlidesRefineInput): {
  system: string;
  user: string;
} {
  return {
    system: buildSlidesRefineSystemPrompt(input.style, input.generationPath),
    user: buildSlidesRefineUserPrompt(input),
  };
}

export function parseSlidesRefineOutput(
  raw: string,
  ctx: { style: SlideStyle; generationPath: GenerationPath; mode: SlidesRefineMode },
):
  | { ok: true; output: SlidesAnalyzeOutput }
  | { ok: false; error: SlidesAnalyzeParseError } {
  // refine 输出形态跟 analyze 相同(整个 outline JSON),复用 parseSlidesAnalyzeOutput
  return parseSlidesAnalyzeOutput(raw, {
    style: ctx.style,
    generationPath: ctx.generationPath,
  });
}

export const SLIDES_REFINE_CALL_CONFIG = {
  model: { default: "claude-sonnet-4-6", high: "claude-opus-4-7" } as const,
  maxTokens: 12288,
  temperature: 0.6,
  cacheSystem: true,
} as const;
