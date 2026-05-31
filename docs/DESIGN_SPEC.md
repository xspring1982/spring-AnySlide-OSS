# DESIGN SPEC — AnySlide
**版本：v2.0**
**日期：2026-04-25**
**用途：原型设计规范（基于 Stitch 生成设计 + aicarousels.com Landing 交互参考）**
**对应 SPEC：v1.1 MVP**
**原型文件已从公开仓库移除；本文件保留公开 UI 规范。**

---

## 0. 阅读说明

本文档是交给设计工具直接出原型的设计简报，覆盖：
- **设计 Token**（色彩/字体/间距/圆角/阴影）
- **组件清单**（所有可复用组件 + 每个组件的全状态）
- **页面线框**（每个页面的结构、内容层级、关键标注）
- **交互说明**（触发条件、过渡方式、边界态）
- **移动端降级规则**

**优先级**：首页 Hero + 工具区 > 定价页 > Dashboard > 登录页 > SEO 场景页

---

## 1. 设计 Token

### 1.1 色彩

> 设计语言：**Warm Earth Artisanal**。由 Stitch 生成，完整 token 见 `warm_earth_artisanal` DESIGN.md。
> 品牌定位：手工感、内容创作氛围，非冷峻科技感。

```
── 品牌色 ──────────────────────────────────────────────────────────────
primary           #96440f / #C96B35   主按钮、强调、logo、active 态
primary-container #b55c27             按钮 hover 态、深色强调
inverse-primary   #ffb691             深色模式主色

── 页面背景层级（从深到浅）────────────────────────────────────────────────
surface                    #fff8f6   全局页面底色（Warm Cream）
surface-container-low      #fff1eb   次级背景（侧边栏内卡片）
surface-container          #fceae3   组件背景
surface-container-high     #f7e5dd   悬浮菜单背景
surface-container-highest  #f1dfd7   最高层背景（分隔用）
surface-container-lowest   #ffffff   卡片、输入框、弹窗（纯白）
sidebar                    #F3E8D8   左侧导航栏（Deep Cream，固定值）
main-bg                    #FAFAFA   主内容区背景（比侧栏亮）

── 文字 ────────────────────────────────────────────────────────────────
on-surface         #231a15   主文字（Dark Brown）
on-surface-variant #55433a   辅助文字（Medium Brown）
outline            #887368   边框、placeholder
outline-variant    #dbc1b5   分割线、淡边框

── 语义色 ──────────────────────────────────────────────────────────────
error              #ba1a1a   错误态
error-container    #ffdad6   错误背景
tertiary           #006578   info/链接色
```

**Tailwind 配置（从 Stitch HTML 直接提取）**
```js
colors: {
  "surface": "#fff8f6",
  "background": "#fff8f6",
  "primary": "#96440f",          // logo 文字色
  "primary-container": "#b55c27",
  "on-primary": "#ffffff",
  "on-surface": "#231a15",
  "on-surface-variant": "#55433a",
  "surface-container-lowest": "#ffffff",
  "surface-container-low": "#fff1eb",
  "surface-container": "#fceae3",
  "surface-container-high": "#f7e5dd",
  "surface-container-highest": "#f1dfd7",
  "outline": "#887368",
  "outline-variant": "#dbc1b5",
  "tertiary": "#006578",
  "error": "#ba1a1a",
}
// Sidebar 背景: bg-[#F3E8D8]（直接写死，非 token）
// 主色 CTA:    bg-[#C96B35] hover:bg-[#B05A28]（直接写死）
```

### 1.2 字体

```
主字体：Plus Jakarta Sans（Google Fonts）
引入：https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;900

字号规范（从 Stitch DESIGN.md 提取）：
  H1   32px / SemiBold 600 / 行高 1.2
  H2   24px / SemiBold 600 / 行高 1.3
  H3   18px / Medium 500   / 行高 1.4
  body 16px / Regular 400  / 行高 1.6
  label 14px / Medium 500  / 行高 1.0
  button 15px / SemiBold 600 / letterSpacing 0.01em

注：实现时用 Tailwind fontFamily 覆盖，见 Stitch code.html 的 tailwind.config。
```

### 1.3 间距

```
基础单位：4px（Stitch v1 规格）

组件内间距：
  xs   4px
  sm   8px
  md   16px
  lg   24px
  xl   32px

页面级：
  sidebar_width  220px（固定）
  topbar_height  64px（固定）
  content_padding  32px（主内容区左右内边距）
```

### 1.4 圆角

```
sm      4px   （checkbox、小元素）
DEFAULT 8px   （按钮、输入框）
md      12px  （卡片）
lg      16px  （模态框、弹窗）
xl      24px  （大容器）
full  9999px  （胶囊 Tag、NicheChip）
```

### 1.5 阴影

```
shadow-brown（所有卡片默认）
  box-shadow: 0 4px 24px rgba(44, 26, 14, 0.08)

悬浮/弹窗
  box-shadow: 0px 10px 30px rgba(201, 107, 53, 0.08)

Sidebar
  box-shadow: 4px 0 24px rgba(44,26,14,0.04)
  + border-right: 1px solid rgba(231,229,228,0.5)

TopBar
  border-bottom: 1px solid #e5e7eb（stone-200）
```

### 1.6 过渡动画

```
颜色/背景过渡   transition-colors 200ms
侧边栏 active   scale-95 on click（Stitch HTML 原有）
卡片淡入        opacity 0→1 + translateY 8px→0，250ms ease
骨架屏闪烁      shimmer: 1.5s 循环渐变（animate-pulse）
Landing 展示行  CSS transform translateX，transition 8s linear infinite（hover 暂停）
```

---

## 2. 组件清单

### 2.1 Button（按钮）

**变体**
- `primary`：背景 `#C96B35`，白字，8px 圆角
- `secondary`：白色背景，`#2C1A0E` 字，1px `#E5D9C8` 边框
- `ghost`：透明背景，`#8B6650` 字，无边框
- `danger`：背景 `#C24040`，白字

**尺寸**
- `lg`：高度 48px，padding 16px 24px，字号 16px（主 CTA 用）
- `md`：高度 40px，padding 12px 20px，字号 14px（常规用）
- `sm`：高度 32px，padding 8px 16px，字号 12px（辅助操作用）

**状态**（每个变体均需设计以下状态）
- Default
- Hover（亮度 -10%）
- Active / Pressed（亮度 -15%，略微缩小 scale 0.98）
- Loading（禁用 + 左侧 spinner 动画 + 文字变「...」）
- Disabled（opacity 0.4，cursor not-allowed）

**特殊状态**
- `积分不足`：`primary` 按钮变为灰色 disabled + 文字「积分不足，去充值」

---

### 2.2 Input / Textarea

**输入框**
- 边框 1px `#E5D9C8`，圆角 8px，背景白色
- Focus：边框变 `#C96B35`，轻微外阴影 `0 0 0 3px rgba(201,107,53,0.15)`
- Error：边框变 `#C24040`，下方显示红色错误文字
- Disabled：背景 `#F5EDE0`，文字 `#B8A090`

**Textarea（粘贴文字用）**
- 最小高度 160px，可拖拽调高
- 右下角字数计数（如「128 / 5000」），超限变红
- 内置 placeholder 示例文本（每次随机取一条，见内容规范）

**URL 输入框**
- 单行 input
- 粘贴后右侧出现「读取中...」spinner（inline）
- 读取成功：输入框变为不可编辑的摘要展示（带「✓ 已读取 XX 字」标注）
- 读取失败：行内红色提示「无法读取此链接，请直接粘贴文章内容」

---

### 2.3 Tab（标签页切换）

用于输入区三种方式切换：「粘贴文字」/「粘贴链接」/「上传文件」

- 样式：**胶囊式**（参考 Pollo.ai），活跃 tab 背景 `#C96B35` 白字，未激活透明底
- 整体容器：背景 `#EDD9C5`，圆角 999px，padding 4px
- 切换动画：内容区 150ms fade，active 胶囊 150ms ease 位移
- 未激活 tab 文字颜色 `#8B6650`，激活白字

---

### 2.4 FileUpload（文件上传区）

- 虚线边框 2px dashed `#E5D9C8`，圆角 12px，高度 140px
- 中心图标（上传图标）+ 主文字「拖拽文件到这里，或点击选择」+ 副文字「支持 .pdf / .txt / .md，最大 10MB」
- Drag Over 状态：边框变 `#C96B35`，背景 `rgba(201,107,53,0.05)`
- 文件已选中：显示文件名 + 文件大小 + 「× 移除」按钮，隐藏上传区文字
- 解析中：显示文件名 + 进度 spinner + 「解析中...」
- 解析失败：红色提示 + 重新选择入口

---

### 2.5 Sidebar（左侧导航栏）

> 基于 Stitch `anyslide_homepage_empty/code.html` 精确实现规格。

```
宽度：220px 固定（w-[220px]）
背景：#F3E8D8（bg-[#F3E8D8]）
右侧：border-right 1px rgba(231,229,228,0.5) + box-shadow 4px 0 24px rgba(44,26,14,0.04)
Position：fixed left-0 top-0，h-full，z-50
内边距：py-6 px-4
```

**结构（从上到下，精确对应 Stitch HTML）**

```
┌─────────────────────────┐
│ [★] AnySlide            │  ← Logo 区：图标 w-8 h-8 rounded-lg bg-[#C96B35] 内含
│     AI Content Partner  │    material-symbol auto_awesome（filled），
│                         │    "AnySlide" text-2xl font-black text-[#C96B35] tracking-tight
│                         │    "AI Content Partner" text-xs text-stone-500
├─────────────────────────┤
│  [+ New Generation]     │  ← primary 按钮，全宽，py-3 px-4，bg-[#C96B35] hover:bg-[#B05A28]
│                         │    rounded-lg，font-semibold，shadow-brown
├─────────────────────────┤  flex-1 space-y-1
│  ⌂  Home               │  ← 导航 item，px-3 py-2.5，rounded-lg
│  ⏱  History            │  ← 各 item 使用 Material Symbols Outlined icon
│  💳  Credit Center      │
├─────────────────────────┤  mt-auto（弹性撑底）
│  ✨  Upgrade Plus       │  ← 文字色 #C96B35，icon 色 #C96B35，放在 mt-auto 底部
└─────────────────────────┘
```

**导航 item 状态（精确从 Stitch 提取）**

| 状态 | 背景 | 文字 | 其他 |
|---|---|---|---|
| Default | 透明 | text-stone-600 | - |
| Hover | bg-stone-200/50 | hover:text-[#C96B35] | transition-all 200ms |
| Active | bg-stone-200/50 | text-[#C96B35] font-bold | border-l-4 border-[#C96B35] |

**TopBar（固定在主内容区顶部，非 Sidebar）**
```
高度：64px（h-16），背景 white，border-bottom border-stone-200
Position：fixed top-0，left-[220px]，right-0，z-40
内边距：px-8

内容（右对齐，gap-4）：
  [History 按钮]  text-stone-500 hover:text-[#C96B35] + hover:bg-stone-100 rounded-lg p-2
  [🔔 通知图标]   同上 style
  [👤 头像圆形]   w-9 h-9 rounded-full，bg-[#C96B35]（无头像时用首字母）
```

---

### 2.6 NicheChip（赛道快捷胶囊）

> 对应 Stitch 设计中的 "SUGGESTED NICHES" 区域。

```
形态：pill 胶囊，全圆角（full），px-3 py-1，text-sm font-medium
状态：
  未选中：bg-surface-container-high + text-on-surface-variant + border border-outline-variant
  选中：  bg-[#C96B35] + text-white
  Hover：bg-surface-container-highest
```

示例（来自 Stitch 截图）：`Parenting` · `Career` · `Health & Wellness`

---

### 2.6b ConfigRow（配置行）

> 对应 Stitch 设计中的 "CONFIGURATION" 区域，包含 Style / Platform / Pages 三个下拉。

```
布局：横向排列，gap-3，每项为 label + select 组合
  CONFIGURATION 标题：text-xs uppercase tracking-widest text-on-surface-variant

每个 select 项：
  - 圆角 8px，border border-outline-variant，bg-white
  - padding px-3 py-2，text-sm
  - 下拉箭头图标右侧
  示例：Style [Minimalist ▼]  Platform [Instagram ▼]  Pages [5 ▼]
```

---

### 2.6c VisualStyleSelector（生成中风格选择）

> 对应 Stitch `tool-generating` 截图中的 "VISUAL STYLE" 区域。

```
标签行：
  "VISUAL STYLE" 文字 + "✨ AI Suggests Hand-drawn" 橙色胶囊提示（来自 AI 推断）

风格缩略图列表（横向，gap-3）：
  每项：80×80px 正方形，圆角 8px，下方小字 style 名
  选中态：外框 2px border-[#C96B35]
  示例：[Hand-drawn ✓] [Minimalist] [Editorial]
```

---

### 2.6d GeneratingProgress（生成进度）

> 对应 Stitch `tool-generating` 截图中的进度区域。

```
┌──────────────────────────────────────────────────────────┐
│  ⚙ Structuring Layout                        33%         │
│  Generating card 2/6, approx 40s remaining               │
│  ████████░░░░░░░░░░░░░░░░░░  (进度条)                    │
└──────────────────────────────────────────────────────────┘
```

- 容器：白色卡片，shadow-brown，rounded-md，p-4
- 图标：material symbol `settings` 动画旋转
- 百分比：text-[#C96B35] font-bold，右对齐
- 进度条：h-1.5，bg-surface-container-high 底，bg-[#C96B35] fill
- 下方：骨架卡片网格（两列），每张约 160×200px，animate-pulse
- 横向滚动列表：每个风格缩略图 60×80px，圆角 8px，鼠标悬浮显示风格名称 Tooltip
- 选中状态：缩略图外框变 `#C96B35` 2px，带勾选徽章

**风格选择模态框**（点击「更多→」打开）
- 全屏模态，标题「选择图文风格」
- 网格展示所有 Level 1 大类（2 列，桌面端 3 列）
- 每个大类下可展开 Level 2 案例
- 底部「确认选择」按钮

---

### 2.7 CardPreview（卡片预览）

**空状态**
- 右侧预览区展示 3-5 张精选模板缩略图自动轮播
- 轮播：淡入淡出，2 秒/张，底部点状指示器
- 每张图下方显示模板名称 + 适用场景描述

**生成中状态**
- 骨架屏：1080:1350 比例灰色矩形，内有流光动画（shimmer）
- 顶部进度文字：「正在生成第 2 张 / 共 6 张，预计还需 40 秒」
- 进度条：细线条 `#C96B35`，宽度按完成比例
- 每张完成后：骨架屏替换为真实卡片，带 fadeIn 动画

**完成态**
- 卡片翻页预览（主视觉区，占右侧 60% 高度）
  - 左右箭头按钮（半透明背景圆形，悬浮显示）
  - 底部点状分页指示器
  - 点击卡片 → 全屏预览 Modal
  - 支持键盘左右方向键翻页

**卡片尺寸适配**
- 预览区等比缩放：保持 4:5 比例，宽度撑满预览容器
- 全屏预览：居中展示，背景半透明黑色遮罩

---

### 2.8 OutputPanel（输出面板）

完成态时，卡片预览下方展示以下内容：

**爆款标题候选**
```
爆款标题 ×3
┌─────────────────────────────────┐  [复制]
│ 标题文字（20字以内）              │
└─────────────────────────────────┘
┌─────────────────────────────────┐  [复制]
│ 标题文字                         │
└─────────────────────────────────┘
┌─────────────────────────────────┐  [复制]
│ 标题文字                         │
└─────────────────────────────────┘
```
- 每条标题独立区块，右上角「复制」ghost 按钮，点击后变「✓ 已复制」2秒

**配套文案**
```
配套文案   字数：[200字 ●] [350字] [500字]
┌──────────────────────────────────────────┐  [复制全文]
│ 文案正文，多行，自动展开                    │
└──────────────────────────────────────────┘
```
- 字数切换：Segmented Control（三个选项），切换扣 5 分，切换前若积分不足弹提示
- 字数切换时文案区域 shimmer 动画后刷新内容

**推荐标签**
```
推荐标签（15-20个）   [复制全部标签]
[大词标签]  [大词标签]  [中词标签]  [中词标签]  [小词标签] ...
```
- 标签气泡，背景按大/中/小词分级显示不同颜色：
  - 大词：`#F5E6D8` 底，`#C96B35` 字
  - 中词：`#E8EEF8` 底，`#3A6BAA` 字
  - 小词：`#F0EAE0` 底，`#8B6650` 字
- 点击单个标签 → 复制该标签

---

### 2.9 ActionBar（下载操作栏）

完成态固定显示在预览区底部（sticky）：

```
[↓ 下载全套 ZIP]  [逐张保存]  [复制文案]  [↺ 重新生成]  [换风格]
```

- 「下载全套 ZIP」：primary lg 按钮，最左最突出
- 其余：secondary sm 或 ghost sm 按钮
- 未登录点击「下载全套 ZIP」→ 弹出登录引导 Modal

---

### 2.10 Toast（消息提示）

- 位置：右上角，z-index 最高
- 宽度：320px，圆角 12px，阴影
- 类型：
  - 成功（绿色左边框 + ✓ 图标）：「图文已生成」「复制成功」
  - 错误（红色左边框 + ✗ 图标）：「图片生成失败，积分已退回，请重试」
  - 警告（黄色左边框 + ⚠ 图标）：「积分余额不足」
- 自动消失：3 秒（错误类型 5 秒）

---

### 2.11 Modal（模态框）

- 遮罩：背景 rgba(0,0,0,0.5)，点击遮罩关闭
- 容器：白色，圆角 16px，最大宽度 480px（桌面端居中）
- 移动端：从底部滑出（Bottom Sheet）
- 关闭按钮：右上角 × 图标

**登录引导 Modal**
```
┌────────────────────────────┐
│  [× 关闭]                  │
│                            │
│  🎉 登录后即可下载          │
│  首次注册赠 100 积分         │
│                            │
│  [用 Google 账号登录]       │
│  [用邮箱登录/注册]           │
│                            │
│  已有账号？直接登录          │
└────────────────────────────┘
```

**积分不足 Modal**
```
┌────────────────────────────┐
│  [× 关闭]                  │
│                            │
│  ⚡ 积分余额不足             │
│  当前余额：20 分             │
│  本次操作需要：30 分/张      │
│                            │
│  [升级 Plus，获取更多积分]   │
│  [查看我的积分]             │
└────────────────────────────┘
```

---

### 2.12 SkeletonCard（骨架屏）

- 比例 4:5（1080:1350）
- 底色 `#EDD9C5`（暖色骨架，比纯灰更融入整体配色）
- 流光动画：从左到右渐变 `rgba(255,248,240,0.6)`，1.5s 无限循环
- 顶部留一条细进度条（`#C96B35`）

---

### 2.13 CreditBadge（积分徽章）

右上角工具栏（已登录态）显示：
- 「⚡ 850分」，胶囊形，背景 `#F5E6D8`，文字 `#C96B35`
- 点击 → 跳转 /dashboard/billing

---

### 2.14 NicheExampleCard（赛道案例卡）

用于 Output Panel 空态画廊，展示各垂直赛道的效果图：
- 尺寸：等比缩略图（4:5），圆角 12px，阴影 card-default
- 左上角赛道 Tag 徽章（如「🍼 宝妈育儿」），使用 §1.1 赛道配色
- 悬浮：阴影加深 card-hover，底部显示「用此风格生成」按钮（从底部滑入，`#C96B35` 底色）
- 选中：边框 2px `#C96B35`，右上角勾选徽章

---

### 2.15 NicheQuickPill（赛道快捷胶囊）

位于 Input Panel 输入框与 AI 配置条之间，横向可滚动：

- 胶囊样式：`padding: 6px 14px`，圆角 999px，`font-size: 13px`
- 默认态：背景使用该赛道 Tag 配色（见 §1.1），文字对应赛道深色
- 选中态：背景变 `#C96B35`，白字，左侧小勾 ✓
- 未选时 hover：背景加深 10%
- 右侧「更多 →」ghost pill，点击展开完整赛道列表 Modal

---

## 3. 页面线框

### 3.1 App Shell（全局布局）

> 基于 Stitch `tool-empty.html` 精确实现。公开仓库不包含原型文件

#### 整体结构（桌面端 ≥1024px）

```
┌─────────────────────────────────────────────────────────────────────┐
│  [可选：顶部公告条，全宽，可关闭，背景 #C96B35 白字]                      │
├──────────────────┬──────────────────────────────────────────────────┤
│                  │                       右上角工具栏                 │
│   LEFT SIDEBAR   │   [历史记录]  [⚡ 850分]  [👤 头像▼]              │
│   220px 固定宽   ├─────────────────────────────────────────────────┤
│   bg #F3E8D8     │                                                   │
│                  │   INPUT PANEL (40%)  │  OUTPUT PANEL (60%)       │
│  AnySlide  logo  │                      │                           │
│                  │                      │                           │
│  [+ 新建生成]    │                      │                           │
│  主色全宽圆角按钮  │                      │                           │
│                  │                      │                           │
│  ── 功能 ──      │                      │                           │
│  🏠 首页         │                      │                           │
│  📋 我的历史     │                      │                           │
│  ⚡ 积分中心     │                      │                           │
│                  │                      │                           │
│  ── 垂直赛道 ──  │                      │                           │
│  🍼 宝妈育儿     │                      │                           │
│  💼 职场副业     │                      │                           │
│  🌿 养生健康     │                      │                           │
│  💰 理财知识     │                      │                           │
│  📚 读书写作     │                      │                           │
│  🧘 情感心理     │                      │                           │
│  🏛️ 历史文化     │                      │                           │
│  🤖 科技AI      │                      │                           │
│  ＋ 更多赛道     │                      │                           │
│                  │                      │                           │
│  ── 底部 ──      │                      │                           │
│  [🚀 升级 Plus]  │                      │                           │
│  全宽圆角主色按钮  │                      │                           │
└──────────────────┴──────────────────────────────────────────────────┘
```

**尺寸（桌面 1440px 为例）**
- Sidebar：220px 固定，fixed left-0 top-0 h-full z-50
- TopBar：fixed top-0 left-[220px] right-0 h-16 z-40，白底
- 主内容区：ml-[220px] mt-16，剩余空间铺满
- 内容区两栏：Input ~40% / Output ~60%

---

### 3.2 工具页 — 空态 `/`

> 公开仓库不包含原型文件

**左侧 Input Panel**

```
┌──────────────────────────────┐
│  Create Content              │  ← H2，on-surface 色
│                              │
│  [Paste Text] [Paste Link] [Upload]  │  ← 3个 Tab，下划线激活式
│                              │
│  ┌──────────────────────┐   │
│  │ E.g. Paste your raw  │   │  ← textarea，min-h ~160px，
│  │ meeting notes…       │   │    placeholder text-outline
│  │                 X/1000 │  │  ← 字数计数，右下角
│  └──────────────────────┘   │
│                              │
│  SUGGESTED NICHES            │  ← label-sm uppercase text-outline-variant
│  [Parenting] [Career] [Health & Wellness]  │  ← NicheChip，见 §2.6
│                              │
│  CONFIGURATION               │  ← label-sm uppercase
│  Style [Minimalist ▼]  Platform [Instagram ▼]  Pages [5 ▼]
│                              │
│  [✦ Generate Content Set]   │  ← 全宽 primary 按钮，py-3
└──────────────────────────────┘
```

**右侧 Output Panel（空态）**

```
┌────────────────────────────────────────┐
│  Select a template or paste content    │  ← 标题
│  to start                              │
│  Explore our curated gallery of…       │  ← 副标题
│                                        │
│  ┌──────────┐  ┌────────┐  ┌────────┐ │
│  │ 大卡 竖版 │  │ 小卡1  │  │ 小卡2  │ │  ← 模板 gallery，混合尺寸网格
│  │ (Reading │  │Career  │  │Health  │ │    各卡带赛道 tag badge
│  │  Notes)  │  │Tips    │  │Recipe  │ │
│  └──────────┘  └────────┘  └────────┘ │
│                                        │
│  [Tech & SaaS]  [Motivation]           │  ← 更多小卡片
└────────────────────────────────────────┘
```

---

### 3.3 工具页 — 生成中态

> 公开仓库不包含原型文件

**左侧（锁定输入，展示配置）**

```
┌──────────────────────────────┐
│  Crafting your content...    │  ← H2
│  We're weaving your ideas…   │  ← 副标题，on-surface-variant
│                              │
│  YOUR PROMPT                 │  ← label-sm uppercase
│  ┌──────────────────────┐   │
│  │ [用户输入内容，只读]   │   │  ← 灰色背景，不可编辑
│  └──────────────────────┘   │
│                              │
│  VISUAL STYLE                │  ← label-sm
│  ✨ AI Suggests Hand-drawn   │  ← 橙色胶囊 badge
│                              │
│  [Hand-drawn ✓] [Minimalist] [Editorial]  │  ← 80px 方形缩略图
│                              │
│  [⟳ Generating...]          │  ← 按钮禁用态，spinner 图标
└──────────────────────────────┘
```

**右侧（进度 + 骨架卡片）**

```
┌────────────────────────────────────────┐
│  ┌────────────────────────────────┐    │
│  │ ⚙ Structuring Layout   33%    │    │  ← 进度卡片，shadow-brown
│  │ Generating card 2/6, ~40s     │    │
│  │ ████████░░░░░░░░░░░░░░        │    │  ← 进度条 h-1.5 bg-[#C96B35]
│  └────────────────────────────────┘    │
│                                        │
│  ┌──────────┐  ┌──────────┐           │  ← 骨架卡片网格（2列）
│  │ [已完成] │  │ ⟳ Render │           │    已完成：真实内容
│  │  真实卡  │  │  骨架屏  │           │    渲染中：animate-pulse
│  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐           │
│  │ 骨架屏   │  │  骨架屏  │           │
│  └──────────┘  └──────────┘           │
└────────────────────────────────────────┘
```

---

### 3.4 工具页 — 生成完成/审阅态

> 公开仓库不包含原型文件

**布局切换**：生成完成后，左侧从"输入"切换为"Presentation Details"编辑面板，右侧展示卡片序列预览。

**左侧（Presentation Details 面板）**

```
┌──────────────────────────────┐
│  Presentation Details        │  ← H2
│  Review and refine the       │
│  generated content…          │
│                              │
│  Topic / Prompt              │  ← label-sm
│  ┌──────────────────────┐   │
│  │ "Create a comprehen… │   │  ← 只读文本框，显示原始 prompt
│  └──────────────────────┘   │
│                              │
│  Tone                        │
│  [Professional ✓] [Engaging] │  ← 胶囊选择器
│                              │
│  Key Focus Areas             │
│  ● Digital Channel Expansion │  ← 列表，可编辑
│  ● Customer Retention        │
│                              │
│  [Regenerate]  [Export Slides]│  ← secondary + primary 按钮
└──────────────────────────────┘
```

**右侧（卡片序列预览）**

```
┌────────────────────────────────────────┐
│  Slide 1 of 5  [< >]   [This Slide ▼] │  ← 顶部导航
│                                        │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │  ← 主卡片预览，4:5 比例
│  │    Q3 Strategy                   │  │    白底 shadow-brown
│  │                                  │  │
│  │  Brewing Success:                │  │
│  │  Q3 Digital Expansion            │  │
│  │                                  │  │
│  │  Scaling our artisanal coffee…   │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ── ── ── ── ──                       │  ← 底部缩略图列表
│  [缩图1][缩图2][缩图3][缩图4][缩图5]    │
└────────────────────────────────────────┘
```

---

### 3.5 定价页 `/pricing`

> 公开仓库不包含原型文件
> 布局：独立页面，带顶部 Sidebar 的 app 布局（与工具页共用 Shell）

```
页面标题：Simple, Transparent Pricing
副标题：Choose the plan that fits your needs

[Monthly ● / Yearly] Toggle（年付显示 "27% off" 徽章）

┌────────────────┬──────────────────┬─────────────────┐
│   Free         │   Plus ★RECOMMENDED│   Pro          │
│   ¥0           │   ¥XX /mo        │   ¥XX /mo      │
│   Forever free │                  │                 │
│────────────────│──────────────────│─────────────────│
│ ✓ 100 credits  │ ✓ 1,500 credits  │ ✓ 5,000 credits │
│   /day (1-3 sets)│ /mo (~50 sets) │  /mo (~166 sets)│
│ ✓ No watermark │ ✓ AI features    │ ✓ Everything    │
│                │ ✓ Priority queue │ ✓ API access    │
│                │ ✓ Permanent hist │   (Phase 2)     │
│────────────────│──────────────────│─────────────────│
│ [Current Plan] │ [Upgrade to Plus]│ [Upgrade to Pro]│
│  ghost/disabled│  primary btn     │  secondary btn  │
└────────────────┴──────────────────┴─────────────────┘
```

**积分说明区**（Accordion 或卡片）
```
How do credits work?
Credits are used to generate presentations. A standard presentation set
typically costs around 30 credits depending on length and complexity.
Free users receive a daily refill; while paid plans receive a monthly
block of credits that do not expire as long as the subscription is active.
```

**FAQ**（Accordion，3 条默认折叠）

---

### 3.6 用户后台 `/dashboard`

> 公开仓库不包含原型文件
> 布局：共用 App Shell（220px Sidebar + TopBar）

```
┌──────────────────────────────────────────────┐
│  Dashboard Overview          [Create New →]  │  ← TopBar 右侧额外按钮
├──────────────────────────────────────────────┤
│  Welcome back, Alex.                         │
│  Here's a summary of your workspace…         │
│                                              │
│  ┌──────────────┐┌──────────────┐┌──────────┐│
│  │AVAILABLE     ││PRESENTATIONS ││CURRENT   ││
│  │CREDITS       ││CREATED       ││PLAN      ││
│  │  2,450 $     ││  18 ⊕        ││ Artisan  ││
│  │Refreshes in  ││+3 this week  ││ Pro      ││
│  │14 days       ││              ││Manage →  ││
│  └──────────────┘└──────────────┘└──────────┘│
│                                              │
│  Recent Generations              [View All →]│
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────────┐  │
│  │封面图 │ │封面图 │ │封面图 │ │     +      │  │
│  │      │ │      │ │      │ │New Genera- │  │
│  │标题   │ │标题   │ │标题   │ │tion        │  │
│  │2h ago │ │Yester│ │Oct 12│ │            │  │
│  └──────┘ └──────┘ └──────┘ └────────────┘  │
└──────────────────────────────────────────────┘
```

**StatCard 规格**（三个统计卡）
- 白底，border border-outline-variant，rounded-md，p-5
- 标题：label-sm uppercase text-outline-variant
- 数值：H2 text-on-surface，图标右上角 text-[#C96B35]
- 副标题：body-sm text-outline-variant

**Recent Generations 卡片**
- 4 列网格，最后一个始终为"+ New Generation"空占位卡
- 卡片：封面缩略图（等比，圆角 8px）+ 标题（截断）+ 时间

---

### 3.7 登录页 `/login`

> 公开仓库不包含原型文件

```
页面背景：#FAFAFA（主内容背景色，非 Sidebar 暖色）

居中容器，最大宽度 400px，垂直居中

┌──────────────────────────────────┐
│  [★] AnySlide                    │  ← icon rounded-lg bg-[#C96B35] + 品牌名
│      AI Content Partner          │
│                                  │
│  Welcome back                    │  ← H2，text-on-surface
│                                  │
│  ┌────────────────────────────┐  │
│  │ G  Continue with Google    │  │  ← 白底，border-outline-variant
│  └────────────────────────────┘  │
│                                  │
│  ──────────── or ────────────    │
│                                  │
│  ✉ [Email address              ] │  ← 输入框，border-outline-variant
│                                  │
│  [Continue with Email  →]        │  ← primary 全宽按钮，bg-[#C96B35]
│                                  │
│  By continuing, you agree to     │
│  AnySlide's Terms of Service     │
│  and Privacy Policy.             │
└──────────────────────────────────┘
```

---

### 3.8 Landing 营销页 `/landing`（或 `/`，未登录态）

> 非 App Shell 布局，独立营销页面。Stitch 未设计，按以下规格实现。

**顶部 Navbar**
```
[★ AnySlide]  Features  Templates  Community      [🔔] [Upgrade Plus]
```
- 背景白色，border-bottom border-outline-variant，fixed top-0
- 右侧：登录用户显示通知图标 + Upgrade 按钮；未登录显示 [Log in] [Get Started Free]

**Hero 区**
```
┌──────────────────────────────┬──────────────────────────────┐
│ Create AI Knowledge Cards    │ Generate Now                 │
│ for Any Niche                │ [Paste Text | Link | Upload] │
│ Powered by gpt-image-2       │ [textarea / upload area]     │
│ Paste content → select niche │ [Niche chips] [Style/Pages]  │
│ [Start for Free] [Examples]  │ [Generate Content Set →]     │
│ 12,000+ creators ...         │                              │
└──────────────────────────────┴──────────────────────────────┘
```
- Hero 是营销页，但必须嵌入轻量生成器，满足用户进首页即可开始生成的趋势。
- 桌面端：左文案右生成器，约 58/42 分栏；生成器白底、border-outline-variant、shadow-brown。
- 移动端：文案在上，生成器在下；按钮全宽，输入框高度不低于 160px。
- MVP 阶段 Generate 可进入 `/tool` 完整流程；API 完成后在首页直接接 `/api/generate` SSE。

**案例展示行（aicarousels.com 风格 — 核心交互）**

参考 https://www.aicarousels.com/ 的 showcase 区域：
- 每一行是一套完整的「4张卡片套装」序列，不做孤立单图瀑布流
- 4张卡横向排列：封面 / 内容1 / 内容2 / 结尾 CTA
- 桌面端：鼠标在行内横向移动时，整套卡片行 `translateX`，用于浏览一套图的左右内容
- 奇数行和偶数行位移方向相反，形成左右错动的交互节奏
- 移动端：退化为横向滑动，使用 snap 对齐每张卡

```
实现方式：
.case-row {
  overflow: hidden;
  --case-base: 0px;
  --case-shift: 0px;
}
.case-set-track {
  display: flex;
  transform: translate3d(calc(var(--case-base) + var(--case-shift)), 0, 0);
  transition: transform 500ms ease-out;
}

鼠标移动时：
ratio = (clientX - rowLeft) / rowWidth - 0.5
shift = ratio * 360px * direction
```

每个「卡片套装行」结构：
```
┌──────────┬──────────┬──────────┬──────────┐
│ 封面      │ 内容1     │ 内容2     │ 结尾 CTA  │
│ Topic    │ Insight  │ Steps    │ Publish  │
│          │          │          │          │
└──────────┴──────────┴──────────┴──────────┘
每张卡：4:5 比例，圆角 8px，shadow-brown；整行宽度大于 viewport。
```

行内赛道分配示例：
- 行 1：职场干货完整套装（封面 / 方法 / 清单 / CTA）
- 行 2：读书写作完整套装（封面 / 金句 / 启发 / CTA）
- 行 3：理财知识完整套装（封面 / 概念 / 风险提示 / CTA）
- 行 4：CJK 多语言完整套装（中文 / 日本語 / 한국어 / English）

初期可使用 aicarousels.com 截图（用户截图）作为临时占位，后续替换为真实生成样例。

**功能特性区**（3-4 列图标卡）
```
✦ Niche-First AI      🌏 Multilingual        ⚡ One-Click Export   🎨 6 Visual Styles
  垂直赛道内置配置      gpt-image-2 原生多语言   ZIP 一键下载          风格自动匹配赛道
```

**社会证明 + CTA**
```
12,000+ creators · 86,000+ card sets generated

[✦ Start Generating for Free]
No credit card required · 100 free credits daily
```

**Footer**
```
[★ AnySlide]  AI Content Partner

Product         Support
Pricing         Privacy Policy
Blog            Terms of Service
                Contact Us

© 2026 AnySlide. All rights reserved.
```

---

## 4. 交互状态汇总

| 触发 | 状态 | 表现 |
|---|---|---|
| 进入页面 | 空状态 | 右侧模板轮播 |
| 粘贴 URL | 读取中 | 输入框内 spinner，「正在读取文章...」 |
| URL 读取完成 | 成功 | 输入框变摘要展示，显示字数 |
| URL 读取失败 | 错误 | 行内红色提示 |
| 拖拽文件进入区域 | Drag Over | 边框变橙色，背景微染色 |
| 文件解析中 | Loading | 文件名 + spinner |
| 点击「生成图文」（匿名，首次） | 生成中 | 右侧骨架屏 + 进度文字 |
| 点击「生成图文」（匿名，非首次） | 阻断 | 弹出登录引导 Modal |
| 点击「生成图文」（积分不足） | 阻断 | 弹出积分不足 Modal |
| AI 推断场景完成（Step 4） | 风格确认 | 风格确认条插入，按钮下方 |
| 每张卡片生成完成 | 流式更新 | 骨架屏替换为真实卡片，fadeIn |
| 全部生成完成 | 完成态 | 卡片预览 + 输出面板 + 操作栏 |
| 点击「下载全套 ZIP」（未登录） | 阻断 | 弹出登录引导 Modal |
| 点击「下载全套 ZIP」（已登录） | Loading | 按钮 loading 态，3-5 秒后下载触发 |
| 点击「重新生成」 | 确认 | inline 确认「将消耗 XX 积分，确认？」 |
| 切换文案字数 | 重新生成 | 文案区 shimmer，5 秒后刷新内容 |
| 生成失败 | 错误 | 红色 Toast，已成功卡片保留展示 |
| 复制按钮点击 | 成功 | 按钮文字变「✓ 已复制」，2 秒后恢复 |

---

## 5. 移动端降级规则（<1024px）

| 元素 | 桌面 | 移动端 |
|---|---|---|
| Hero 布局 | 左右分栏 45/55 | 上下堆叠：输入区在上，预览区折叠在下（点击展开） |
| Navbar | 完整展示 | Logo + 登录/注册，隐藏中间导航项 |
| 操作栏 | 内嵌预览区底部 | Fixed bottom，始终可见 |
| 模板展廊网格 | 4 列 | 2 列 |
| 定价页套餐 | 三列并排 | 单列堆叠，Plus 排第一 |
| Dashboard 侧边栏 | 160px 固定左侧 | 折叠为顶部水平 Tab |
| 模态框 | 居中弹窗 | Bottom Sheet（从底部滑入） |
| 风格确认条 | 横向展示 | 竖向堆叠，缩略图滚动改为水平滚动 |
| 卡片翻页 | 箭头 + 键盘 | 触摸滑动（swipe） |

**移动端核心原则**：不崩溃，可完成完整生成流程，具体交互体验 Phase 2 专项优化。

---

## 6. 页面优先级与原型顺序

| 优先级 | 页面 | 关键交互 |
|---|---|---|
| P0 | 首页 Hero（含工具区所有状态） | 输入→生成→预览→下载完整链路 |
| P0 | 首页（空状态、生成中、完成态三个主状态） | 状态切换动画 |
| P0 | 定价页 | 月付/年付 Toggle |
| P1 | 登录页 | Clerk 样式适配 |
| P1 | Dashboard 概览 + 历史记录 | 列表交互 |
| P2 | 场景 SEO 页 | 工具组件复用 |
| P2 | 流程 B 大纲工作流 | 大纲可编辑交互 |

---

*DESIGN SPEC v1.0 — AnySlide — 2026-04-23*
