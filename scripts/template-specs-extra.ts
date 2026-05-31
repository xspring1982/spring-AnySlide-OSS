// 11 个增补 L2 风格 spec
// 6 个来自 AIPPTskill (proven-styles-gallery.md) — 实战验证过
// 5 个来自 huashu-design (design-styles.md) — 顶级工作室哲学
//
// 每个 spec 会被注入到 gpt-image-2 prompt 前(custom_prompt_addon),
// 走 baoyu Anchor Chain 模式串图

export interface ExtraL2Spec {
  id: string;
  baoyuStyleId: string; // 风格 key
  name: string;
  niche: string;
  oneLiner: string;
  /** 完整风格 spec(英文为主,gpt-image-2 对英文 prompt 响应更准确)*/
  spec: string;
  /** 缩略图 webp 路径(放 public/templates/);无则 null */
  previewLocal: string | null;
}

// ─────────────────────────────────────────────────────────────────
// AIPPT 6 个(基于 proven-styles-gallery.md)
// ─────────────────────────────────────────────────────────────────

const SPEC_DUNHUANG = `# Style: 敦煌壁画 (Dunhuang Mural)

## Visual Mood
Tang Dynasty Dunhuang cave mural aesthetic. Oriental, ceremonial, poetic. Mineral pigment matte finish (NOT digital glossy). Scroll-narrative composition flowing left to right.

## Color Palette
- Background: ochre #D4A574 (60%)
- Mineral azurite blue #2E86AB (15%)
- Cinnabar red #C53D43 (10%)
- Mineral green #5DAE8B (10%)
- Gold leaf accent #C4A35A (5%)

## Composition
- Horizontal scroll narrative, content elements arranged left-to-right
- Apsaras flying ribbons (飞天飘带) as connecting elements between sections
- Lotus flowers, auspicious clouds (祥云), gold leaf decorative borders
- Original characters with Apsara-inspired elegance — NOT direct Buddhist deities
- Mountain-and-water (山水) backdrop in distance

## Typography
- Title: large traditional Chinese characters, slightly stylized brush-like edges
- Body: clean sans-serif Chinese, dark ink color on ochre
- Decorative cartouches with gold borders

## Forbidden
- No glossy digital gradients
- No modern UI elements (buttons, icons)
- No direct depictions of Buddha or specific religious figures
- No bright neon colors`;

const SPEC_UKIYOE = `# Style: 浮世绘 (Ukiyo-e Woodblock Print)

## Visual Mood
Edo-period Japanese woodblock print. Flat color planes (no gradients), bold ink outlines, decorative pattern fills. Hokusai/Hiroshige aesthetic.

## Color Palette
- Background: washi paper cream #F5F0E1
- Indigo blue #1B4B7A (primary)
- Vermilion red #C53D43 (accent)
- Gold #C4A35A (highlight)
- Sumi ink black #1A1A1A (outlines)

## Composition
- Wave-as-metaphor: ripple → swell → great wave → breaking wave (use as visual progression)
- Japanese cloud patterns (雲文) as section dividers
- Ukiyo-e cartouche labels for titles (rectangular bordered text boxes)
- Mt. Fuji silhouette in distance for depth
- Asymmetric balance, off-center focal points

## Typography
- Title: bold Japanese-inspired display, vertical or angled placement
- Hand-stamped seal (落款) decorative elements
- Body: clean modern sans-serif, kept minimal

## Forbidden
- No gradients (flat color blocks only)
- No 3D shading, no realistic lighting
- No Western-style perspective
- No photographic textures`;

const SPEC_RISOGRAPH = `# Style: Risograph 孔版印刷

## Visual Mood
Independent zine / risograph print aesthetic. 2-color overprint with intentional 2-3px misregistration. Halftone dot patterns. Rough paper texture. Imperfect, handmade, charming.

## Color Palette (strictly 2-color overprint)
- Paper: cream #FAF3E0
- Risograph fluorescent pink #FF6B9D
- Risograph blue #0077B6
- Where pink + blue overlap: violet #6B3FA0 (this overprint effect must be visible)

## Composition
- Halftone dot patterns for shading (no smooth gradients)
- Intentional 2-3px misregistration on overlapping color elements
- Visible paper texture / grain
- Hand-drawn or screen-print aesthetic illustrations
- Generous use of solid pink or solid blue color blocks
- Bold geometric shapes overprinted

## Typography
- Display: chunky bold sans-serif (Druk-like, condensed)
- Body: clean grotesque
- Sometimes title text in single risograph color, with halftone fill

## Forbidden
- No more than 2 ink colors (+ paper) — strict
- No smooth gradients (must use halftone)
- No glossy / digital-perfect look
- No CMYK photographic style`;

const SPEC_BAUHAUS = `# Style: Bauhaus 包豪斯

## Visual Mood
Bauhaus design school aesthetic. Form follows function. Pure geometric shapes (circle/triangle/square/rectangle) with primary colors. Constructivist / Modernist purity.

## Color Palette
- Background: paper white #FAFAFA
- Bauhaus red #E53935
- Bauhaus blue #1E88E5
- Bauhaus yellow #FDD835
- Black #212121 (typography + outlines)

## Composition
- Pure geometric shapes as primary visual language: circles, triangles, squares
- Each shape can carry psychological meaning (red square = solid/foundation, blue circle = infinite, yellow triangle = dynamic)
- Strict grid-based layout, mathematical proportions
- Layered geometric compositions in flat colors
- Black thick lines (3-5px) for structural emphasis
- Asymmetric balance using shape weight

## Typography
- Display: geometric sans-serif (Futura-like)
- All caps for strong statements
- Tight letter-spacing on headlines
- Body: clean grotesque, generous leading

## Forbidden
- No gradients (flat color only)
- No decorative ornamentation
- No serif fonts
- No realistic illustrations or photographs
- No more than 4 colors`;

const SPEC_NEO_BRUTALISM = `# Style: Neo-Brutalism 新粗野主义

## Visual Mood
Anti-design aesthetic from Gumroad/Figma community. Thick black borders (4-6px), flat color blocks, raw-and-honest typography. High-contrast, attention-grabbing, slightly chaotic but controlled.

## Color Palette
- Cream/off-white #F5E6D3 (40% — main background)
- Revolutionary red #FF3B4F (25% — primary accent)
- Yellow gold #FFD700 (20% — secondary accent)
- Pure black #1A1A1A (15% — borders + text)
- Optional supporting: lime #C2FF00, hot pink #FF6CFF

## Composition
- 4-6px thick black borders on cards/buttons/sections
- Hard drop shadows: solid black 6-8px offset (no blur, no opacity)
- Flat color blocks side-by-side, no gradients ever
- Slightly tilted or off-center elements (1-3 degrees)
- Bold vertical/horizontal stripes
- Underlined text or boxed labels
- Big numbers, big text, big shapes

## Typography
- Display: heavy bold sans-serif (Inter Black / Archivo Black)
- All caps for emphasis
- High contrast weights (400 vs 900 in same composition)
- Sometimes text inside colored blocks

## Forbidden
- No soft drop shadows (must be hard solid offset)
- No gradients
- No rounded corners over 8px (prefer sharp edges)
- No serif fonts
- No glassmorphism / blur effects`;

const SPEC_SNOOPY = `# Style: Snoopy 温暖漫画 (Warm Comic Strip)

## Visual Mood
Charles Schulz Peanuts aesthetic. Warm, comforting, narrative. Round-headed small-bodied characters with simple expressions. Hand-drawn ink lines with slight imperfection. Healing emotional tone.

## Color Palette
- Background: warm cream #FFF8E8
- Ink lines: warm dark #333333 (NOT pure black)
- Sky blue accent #87CEEB
- Grass green #8FBC8F
- Sunset orange #F4A460

## Composition
- 3-5 panel comic-strip layout (NOT too many panels — gets cluttered)
- Original characters with Peanuts proportions: oversized round head, tiny body, simple dot eyes, line mouth
- Zigzag grass horizon line
- Speech bubbles for content delivery (clean rounded rectangles with small tail)
- Minimal background — sky, grass, occasional simple object
- Occasional pet character (NOT named Snoopy)

## Typography
- Title: hand-lettered casual sans-serif
- Body in speech bubbles: friendly rounded sans-serif
- Sometimes hand-written notes / scribbles

## CRITICAL constraints (memorize)
- ALWAYS specify: "an original character with Peanuts proportions, NOT Snoopy or Charlie Brown" — to avoid copyright look-alikes
- Ink lines must look hand-drawn (slight wobble), not CAD-perfect

## Forbidden
- No realistic shading
- No detailed backgrounds
- No anime/manga influence (different aesthetic)
- No bright saturated colors`;

// ─────────────────────────────────────────────────────────────────
// huashu-design 5 个(基于 design-styles.md)
// ─────────────────────────────────────────────────────────────────

const SPEC_ACTIVE_THEORY = `# Style: Active Theory WebGL 粒子赛博

## Visual Mood
Active Theory studio aesthetic. WebGL 3D particle systems made visible. Real-time generative data visualization vibe. Floating UI with glassmorphism. Deep space + neon accents.

## Color Palette
- Background: near-black #0A0E1A or deep navy #0D1B2A
- Cyan glow #00E5FF (primary neon)
- Magenta accent #FF006E
- Electric blue #3A86FF
- Glass white #FFFFFF (10% opacity for floating panels)

## Composition
- 3D particle systems (1000s of points) representing data flow / connections
- Depth-of-field bokeh: foreground sharp, background blurred glow
- Floating UI panels with glassmorphism (frosted blur, white border)
- Streaming light trails / motion lines between elements
- Mouse-reactive feel even in static image
- Volumetric depth — clear z-axis layering

## Typography
- Display: thin geometric sans-serif (Inter / Helvetica Neue Light)
- Glowing edges on key text (neon outline)
- Numerical readouts in monospace

## Forbidden
- No flat 2D illustration
- No warm sunset colors (must stay cool/neon)
- No paper textures
- No hand-drawn elements`;

const SPEC_FIELD_IO = `# Style: Field.io 算法美学 (Generative Art)

## Visual Mood
Field.io generative design aesthetic. Code-as-designer. Algorithmically generated geometric patterns. Computational beauty. Each composition feels like it was systematically generated.

## Color Palette
- Monochromatic base + 1 vibrant accent
- Option A: pure white #FFFFFF + black #000000 + electric coral #FF3B30
- Option B: deep navy #0F1419 + warm white #FFF8F0 + chartreuse #DFFF00

## Composition
- Voronoi diagrams or Delaunay triangulation as primary patterns
- Mathematically precise spacing (golden ratio / phi)
- Recursive / self-similar structures
- Particle field arrangements
- Clean code aesthetic — looks like generative art output
- Mostly abstract patterns, sometimes typography integrated

## Typography
- Display: thin elegant sans-serif (Neue Haas Grotesk Display Light)
- Generous tracking on headlines
- Body: monospace for technical labels (JetBrains Mono / Berkeley Mono)
- Numbers and data treated as primary visual elements

## Forbidden
- No organic curves (must be algorithmic / mathematical)
- No warm tones unless monochromatic accent
- No realistic photography
- No skeuomorphic effects`;

const SPEC_SAGMEISTER = `# Style: Sagmeister & Walsh 快乐极简

## Visual Mood
Stefan Sagmeister + Jessica Walsh aesthetic. Minimal base + unexpected color burst. Handmade physical objects digitized. Optimistic, joyful, slightly humorous. Experimental but always legible.

## Color Palette
- Base: clean white #FFFFFF or kraft paper #E8DCC4
- Bursts of unexpected vibrant colors:
  - Hot pink #FF1493
  - Sun yellow #FFD500
  - Electric blue #0066FF
  - Vibrant orange #FF6B35
- Use 1-2 vibrant colors per composition, not all at once

## Composition
- Handmade physical objects in digital context (cut paper, sewn thread, hand-painted swatches)
- Typography made of physical materials (paint, food, fabric)
- Minimal layout but with one OOH (out of the ordinary) element
- Human imperfection visible — paint drips, hand-cut edges, creases
- Photographic capture of physical work (real shadows, real texture)

## Typography
- Display: hand-rendered or made of physical materials
- Body: clean sans-serif (Helvetica / Akzidenz Grotesk)
- Mix of analog handwriting and clean digital type

## Forbidden
- No purely digital flatness (need handmade quality somewhere)
- No dark grunge tones (must stay optimistic)
- No corporate sterile feel
- No overcomplexity (still minimal at heart)`;

const SPEC_ASH_THORP = `# Style: Ash Thorp 赛博诗意

## Visual Mood
Ash Thorp cinematic concept art. Warm cyberpunk (NOT cold blue). Industrial design meets luxury. Blade Runner 2049 warmth over Tron coldness. Storytelling concept art feel.

## Color Palette
- Atmospheric warm orange #FF8C42 (primary accent, like sodium street lights)
- Deep teal #006B7F (secondary, complementary contrast)
- Charcoal #1A1F2A (background)
- Cream #F4E4D6 (highlights)
- Volumetric god-rays in warm orange

## Composition
- Film-grade lighting: strong directional source, deep shadows, atmospheric haze
- Industrial mechanical objects rendered with luxury detail
- Volumetric light beams (god rays) cutting through atmosphere
- Wet pavement reflections / mist particles
- Wide cinematic framing (use 21:9 spirit even in 16:9 frame)
- Tiny human silhouette in vast environment for scale

## Typography
- Display: condensed industrial sans-serif (Industry / Tungsten)
- Often integrated into the scene (signs, projections, holograms)
- Subtle glow on key text
- Numerical readouts in technical monospace

## Forbidden
- No bright Tron-like cold blue (must use warm orange/teal)
- No clean digital flat surfaces (need atmospheric grit)
- No anime aesthetic
- No saturated primary colors`;

const SPEC_TERRITORY_FUI = `# Style: Territory Studio FUI (Fantasy User Interface)

## Visual Mood
Territory Studio screen graphics. Fantasy User Interface from sci-fi films. Holographic projection feel. Multiple overlapping data layers. Believable future technology readouts.

## Color Palette
- Black or near-black background #000814
- Amber/orange monochrome #FFB347 (Blade Runner option)
- Or cyan accent #00D9FF (more modern sci-fi)
- White #FFFFFF for data text
- Subtle red #FF3B30 for warnings/alerts

## Composition
- Multiple overlapping HUD-style data layers (radar, scope, terminal, charts)
- Concentric circles, crosshairs, scanning lines
- Wireframe 3D objects rotating in space
- Streaming data text feeds
- Glitch effects, scan lines (subtle CRT feel)
- Targeting brackets / corner markers
- Floating UI elements with thin borders

## Typography
- Display: technical monospace (JetBrains Mono / Space Mono / OCR-A)
- All UPPERCASE for headers
- Tabular numbers for data
- Tight technical spacing
- Often green-on-black or amber-on-black

## Forbidden
- No warm sunset colors (stay technical/cold OR amber)
- No organic curves (everything geometric)
- No serif fonts
- No realistic photography (must feel like FUI render)`;

// ─────────────────────────────────────────────────────────────────
// 总数组
// ─────────────────────────────────────────────────────────────────

export const EXTRA_L2_TEMPLATES: ExtraL2Spec[] = [
  // AIPPT 6
  { id: "l2-dunhuang",       baoyuStyleId: "dunhuang",       name: "敦煌壁画·东方典雅",     niche: "国风",   oneLiner: "唐风敦煌壁画,卷轴叙事 + 飞天 + 矿物色,适合国风品牌 / 文化项目 / 高端发布",          spec: SPEC_DUNHUANG,        previewLocal: null },
  { id: "l2-ukiyo-e",        baoyuStyleId: "ukiyo-e",        name: "浮世绘·东瀛和风",       niche: "和风",   oneLiner: "江户浮世绘,平涂色块 + 浪潮 + 朱印,适合日系品牌 / 跨境东方市场 / 文化叙事",          spec: SPEC_UKIYOE,          previewLocal: null },
  { id: "l2-risograph",      baoyuStyleId: "risograph",      name: "Risograph 孔版印刷",   niche: "独立",   oneLiner: "双色叠印 + 套色错位 + 半色调,文创独立品牌 / 音乐厂牌 / 独立刊物",                    spec: SPEC_RISOGRAPH,       previewLocal: null },
  { id: "l2-bauhaus",        baoyuStyleId: "bauhaus",        name: "Bauhaus 包豪斯",       niche: "设计",   oneLiner: "纯几何 + 三原色 + 网格主义,设计 / 建筑 / 教育主题首选",                              spec: SPEC_BAUHAUS,         previewLocal: null },
  { id: "l2-neo-brutalism",  baoyuStyleId: "neo-brutalism",  name: "Neo-Brutalism 新粗野", niche: "SaaS",   oneLiner: "粗黑边框 + 硬阴影 + 大字色块,Gumroad/Figma 风,SaaS / 内训 / 信息密集场景",          spec: SPEC_NEO_BRUTALISM,   previewLocal: null },
  { id: "l2-snoopy",         baoyuStyleId: "snoopy",         name: "Snoopy 温暖漫画",       niche: "教育",   oneLiner: "Peanuts 圆头小身体 + 暖色画布 + 4 格漫画,品牌叙事 / 教育课件 / 个人 IP",            spec: SPEC_SNOOPY,          previewLocal: null },

  // huashu 5
  { id: "l2-active-theory",  baoyuStyleId: "active-theory",  name: "Active Theory 粒子赛博", niche: "前沿",  oneLiner: "WebGL 3D 粒子 + 霓虹深空 + 玻璃 UI,适合 AI / 科技 / 数据驱动品牌",                    spec: SPEC_ACTIVE_THEORY,   previewLocal: null },
  { id: "l2-field-io",       baoyuStyleId: "field-io",       name: "Field.io 算法美学",    niche: "前沿",   oneLiner: "Voronoi / Delaunay 算法生成图,代码即设计,适合数据科学 / 算法品牌 / 数字艺术",        spec: SPEC_FIELD_IO,        previewLocal: null },
  { id: "l2-sagmeister",     baoyuStyleId: "sagmeister",     name: "Sagmeister 快乐极简",   niche: "创意",   oneLiner: "极简底 + 意外色彩爆发 + 手工感物理材质,适合创意工作室 / 文化品牌 / 个人作品集",      spec: SPEC_SAGMEISTER,      previewLocal: null },
  { id: "l2-ash-thorp",      baoyuStyleId: "ash-thorp",      name: "Ash Thorp 暖色赛博",   niche: "电影",   oneLiner: "Blade Runner 2049 暖色赛博朋克,光束 + 工业精致,适合品牌发布 / 概念项目 / 电影感",  spec: SPEC_ASH_THORP,       previewLocal: null },
  { id: "l2-territory-fui",  baoyuStyleId: "territory-fui",  name: "Territory FUI 科幻界面", niche: "未来", oneLiner: "科幻电影 HUD / 全息投影 / 数据叠层,适合科技产品 / AI / 未来叙事",                     spec: SPEC_TERRITORY_FUI,   previewLocal: null },
];
