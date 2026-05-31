// Image 12 风格 — SPEC §4.2 定型
//
// SPEC §4.2.1 ImageStyleId 已是真相源；本文件只是把数据从 PromptComposer 抽出来
// 单独维护。完整 promptBase 在 P0-3 实测时拆 src/lib/styles/image/{id}.ts。
//
// 状态：ghibli 是 §4.2.3 唯一 complete 的；其余 11 个 stub（id 'auto' 是特殊"不指定"）。

export type ImageStyleId =
  | "auto"
  | "ghibli"
  | "ultra-realism"
  | "anime"
  | "watercolor"
  | "3d-cartoon"
  | "oil-painting"
  | "chinese-ink"
  | "flat-design"
  | "cyberpunk"
  | "vintage"
  | "minimalist";

export type ImageRatio = "1:1" | "3:4" | "4:5" | "16:9" | "9:16";

export interface ImageStyleMeta {
  id: ImageStyleId;
  name: string;
  emoji: string;
  oneLineDesc: string;
  swatch: string;
  /** auto 是特殊：选 auto 表示不指定风格，prompt 直接喂模型 */
  isAuto?: boolean;
  status: "complete" | "stub";
  /**
   * 风格化前缀,M6 实测时拼到用户内容前。
   * 留空 / 不存在 = 不加风格修饰(auto 行为)。
   */
  promptBase?: string;
  /** 反向限制(negative cues),阻止模型走偏 */
  negative?: string;
}

export const IMAGE_STYLES: ImageStyleMeta[] = [
  {
    id: "auto",
    name: "自动匹配",
    emoji: "✨",
    oneLineDesc: "不指定风格，把原文直接喂模型",
    swatch: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    isAuto: true,
    status: "complete",
  },
  {
    id: "ghibli",
    name: "吉卜力",
    emoji: "🌳",
    oneLineDesc: "宫崎骏暖意手绘 · 自然光 · 田园",
    swatch: "linear-gradient(135deg, #a8edea, #59c9a5)",
    status: "complete",
    promptBase:
      "Studio Ghibli style, hand-drawn animation, warm natural lighting, soft watercolor textures, lush greenery, gentle pastoral atmosphere, painterly detail, Hayao Miyazaki aesthetic",
    negative: "no harsh shadows, no photorealism, no 3D render look, no cyberpunk neon",
  },
  {
    id: "ultra-realism",
    name: "超写实",
    emoji: "📸",
    oneLineDesc: "照片级 · 自然光影 · 细节锐利",
    swatch: "linear-gradient(135deg, #232526, #414345)",
    status: "complete",
    promptBase:
      "Ultra-realistic photography, 50mm lens, shallow depth of field, natural lighting, sharp micro-detail, professional color grading, magazine cover quality",
    negative: "no illustration, no cartoon style, no painterly brushstrokes",
  },
  {
    id: "anime",
    name: "日漫风格",
    emoji: "🎌",
    oneLineDesc: "日本动漫线条 + 细腻彩色",
    swatch: "linear-gradient(135deg, #f093fb, #f5576c)",
    status: "complete",
    promptBase:
      "Modern Japanese anime illustration, clean line art, vibrant cel-shaded colors, expressive characters, soft gradient skies, detailed eye highlights, Makoto Shinkai inspired backgrounds",
    negative: "no photorealism, no 3D, no western cartoon proportions",
  },
  {
    id: "watercolor",
    name: "水彩插画",
    emoji: "💧",
    oneLineDesc: "晕染 · 留白 · 透明叠色",
    swatch: "linear-gradient(135deg, #4facfe, #00f2fe)",
    status: "complete",
    promptBase:
      "Watercolor illustration, soft wet-on-wet bleeding edges, transparent layered washes, generous white space on textured paper, delicate brush strokes",
    negative: "no hard outlines, no flat fills, no digital airbrush",
  },
  {
    id: "3d-cartoon",
    name: "3D 卡通",
    emoji: "🎈",
    oneLineDesc: "Pixar 质感 · 鲜亮 · 圆润光滑",
    swatch: "linear-gradient(135deg, #fa709a, #fee140)",
    status: "complete",
    promptBase:
      "Pixar / DreamWorks 3D cartoon render, smooth subsurface scattering, friendly rounded character design, bright saturated palette, soft global illumination, glossy materials",
    negative: "no flat 2D, no realistic skin pores, no muted desaturated palette",
  },
  {
    id: "oil-painting",
    name: "油画风格",
    emoji: "🖼",
    oneLineDesc: "厚涂笔触 · 古典油画质感",
    swatch: "linear-gradient(135deg, #a18cd1, #fbc2eb)",
    status: "complete",
    promptBase:
      "Classical oil painting, thick impasto brushstrokes, rich pigment layering, museum-quality canvas texture, dramatic chiaroscuro lighting, baroque to romantic era aesthetic",
    negative: "no clean digital lines, no flat color fills, no anime style",
  },
  {
    id: "chinese-ink",
    name: "水墨国风",
    emoji: "🐉",
    oneLineDesc: "宣纸 · 飞白 · 留白意境",
    swatch: "linear-gradient(135deg, #c9d6df, #667073)",
    status: "complete",
    promptBase:
      "Traditional Chinese ink wash painting (水墨画), flowing brush strokes with dry-brush 飞白 effect, generous negative space on rice paper, monochrome black ink with subtle wash gradients, Song dynasty aesthetic",
    negative: "no bright saturated colors, no western perspective, no photorealism",
  },
  {
    id: "flat-design",
    name: "扁平设计",
    emoji: "🟧",
    oneLineDesc: "几何形 · 高饱和 · 矢量平面",
    swatch: "linear-gradient(135deg, #f7971e, #ffd200)",
    status: "complete",
    promptBase:
      "Flat vector illustration, geometric shapes, bold high-saturation color blocks, no gradients, minimal detail, clean editorial style suitable for tech / startup branding",
    negative: "no realistic textures, no 3D shading, no painterly brush strokes",
  },
  {
    id: "cyberpunk",
    name: "赛博朋克",
    emoji: "🌃",
    oneLineDesc: "霓虹光晕 · 未来主义 · 暗调高对比",
    swatch: "linear-gradient(135deg, #0f0c29, #302b63)",
    status: "complete",
    promptBase:
      "Cyberpunk aesthetic, neon-lit night city, magenta-and-cyan glow, rain-slicked streets, high contrast dark background, holographic interfaces, Blade Runner inspired",
    negative: "no daylight pastoral scenes, no soft watercolor, no flat minimalism",
  },
  {
    id: "vintage",
    name: "复古胶片",
    emoji: "📼",
    oneLineDesc: "颗粒感 · 偏色 · 老照片质感",
    swatch: "linear-gradient(135deg, #c79081, #dfa579)",
    status: "complete",
    promptBase:
      "Vintage 35mm film photograph, fine grain, slightly faded colors with warm shift, light leak, analog imperfection, 1970s magazine aesthetic",
    negative: "no crisp digital sharpness, no neon saturation, no 3D render",
  },
  {
    id: "minimalist",
    name: "极简主义",
    emoji: "⚪",
    oneLineDesc: "大量留白 · 单一主体 · 朴素配色",
    swatch: "linear-gradient(135deg, #e8e8e8, #c8c8c8)",
    status: "complete",
    promptBase:
      "Minimalist composition, abundant negative space, single focal subject, restrained 2-3 color palette (off-white, soft gray, one accent), clean Scandinavian editorial sensibility",
    negative: "no busy backgrounds, no high saturation, no maximalist detail",
  },
];

export const DEFAULT_IMAGE_STYLE: ImageStyleId = "auto";

export function findImageStyle(id: string): ImageStyleMeta | undefined {
  return IMAGE_STYLES.find((s) => s.id === id);
}
