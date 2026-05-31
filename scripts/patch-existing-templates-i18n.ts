// scripts/patch-existing-templates-i18n.ts
// PR2:给 38 个已 seed 但缺 i18n 的老模板补 5 语言文案。
//
// 用法:
//   npx tsx --env-file=.env.local scripts/patch-existing-templates-i18n.ts
//
// 范围:
//   - 8 个 frontend-slides L1(l1-fs-*)
//   - 2 个 guizang L1(l1-guizang-*)
//   - 28 个 baoyu L2(l2-*)
//
// 不动字段:promptSeed/template_html/baoyu_style_id/style_id/preset_*/...
// 仅 UPDATE:name_i18n, one_liner_i18n, headline_i18n, subhead_i18n
//
// 幂等:每次跑都用 UPDATE 覆盖,所以反复跑等于"重置 i18n 文案"。如要保护
// 已被手动修订的模板 i18n,把那个 id 从下面 PATCHES 里删掉。

import { neon } from "@neondatabase/serverless";

type Locale = "en" | "zh" | "zh-TW" | "ja" | "ko";
type LocalizedString = Record<Locale, string>;

interface I18nPatch {
  id: string;
  name: LocalizedString;
  oneLiner: LocalizedString;
  headline: LocalizedString;
  subhead: LocalizedString;
}

// ─────────────────────── 38 模板 5 语言文案 ───────────────────────

const PATCHES: I18nPatch[] = [
  // ════════════════ 8 × frontend-slides L1 ════════════════
  {
    id: "l1-fs-bold-signal",
    name: {
      en: "Bold Signal · Night Focus",
      zh: "Bold Signal·暗夜聚焦",
      "zh-TW": "Bold Signal·暗夜聚焦",
      ja: "Bold Signal·夜のフォーカス",
      ko: "Bold Signal·나이트 포커스",
    },
    headline: {
      en: "Bold Signal",
      zh: "暗夜聚焦",
      "zh-TW": "暗夜聚焦",
      ja: "ボールドシグナル",
      ko: "볼드 시그널",
    },
    subhead: {
      en: "strategy · launch",
      zh: "战略 · 发布",
      "zh-TW": "戰略 · 發布",
      ja: "戦略 · 発表",
      ko: "전략 · 발표",
    },
    oneLiner: {
      en: "Dark gradient with orange focus cards and Archivo Black headlines — built for strategy launches and quarterly reviews.",
      zh: "深色渐变 + 橙色聚焦卡片 + Archivo Black 粗黑字体,适合战略发布 / 季度复盘",
      "zh-TW": "深色漸變 + 橘色聚焦卡片 + Archivo Black 粗黑字體,適合戰略發布 / 季度復盤",
      ja: "ダークグラデーション + オレンジのフォーカスカード + Archivo Black の太字。戦略発表や四半期レビューに最適。",
      ko: "다크 그라데이션 + 오렌지 포커스 카드 + Archivo Black 볼드 타이포. 전략 발표와 분기 리뷰에 최적화.",
    },
  },
  {
    id: "l1-fs-creative-voltage",
    name: {
      en: "Creative Voltage · Electric Glow",
      zh: "Creative Voltage·电光黄绿",
      "zh-TW": "Creative Voltage·電光黃綠",
      ja: "Creative Voltage·電光イエローグリーン",
      ko: "Creative Voltage·일렉트릭 옐로우그린",
    },
    headline: {
      en: "Creative Voltage",
      zh: "电光黄绿",
      "zh-TW": "電光黃綠",
      ja: "電光イエロー",
      ko: "일렉트릭 옐로우",
    },
    subhead: {
      en: "studio · campaign",
      zh: "工作室 · 招募",
      "zh-TW": "工作室 · 招募",
      ja: "スタジオ · キャンペーン",
      ko: "스튜디오 · 캠페인",
    },
    oneLiner: {
      en: "Electric blue with neon yellow halftones and Syne typography — for creative studios and campaign launches.",
      zh: "电光蓝 + 霓虹黄 + 半色调网点 + Syne 字体,适合创意工作室 / 活动招募",
      "zh-TW": "電光藍 + 霓虹黃 + 半色調網點 + Syne 字體,適合創意工作室 / 活動招募",
      ja: "電光ブルー + ネオンイエロー + ハーフトーン + Syne フォント。クリエイティブスタジオやキャンペーン告知に。",
      ko: "일렉트릭 블루 + 네온 옐로우 + 하프톤 + Syne 폰트. 크리에이티브 스튜디오 / 캠페인 모집에 적합.",
    },
  },
  {
    id: "l1-fs-dark-botanical",
    name: {
      en: "Dark Botanical · Warm Glow",
      zh: "Dark Botanical·暖色暗夜",
      "zh-TW": "Dark Botanical·暖色暗夜",
      ja: "Dark Botanical·ウォームナイト",
      ko: "Dark Botanical·웜 나이트",
    },
    headline: {
      en: "Dark Botanical",
      zh: "暖色暗夜",
      "zh-TW": "暖色暗夜",
      ja: "ダーク・ボタニカル",
      ko: "다크 보타니컬",
    },
    subhead: {
      en: "brand · culture",
      zh: "品牌 · 文化",
      "zh-TW": "品牌 · 文化",
      ja: "ブランド · 文化",
      ko: "브랜드 · 문화",
    },
    oneLiner: {
      en: "Deep black with warm gold-pink, Cormorant serif, and abstract glow halos — built for brand stories and cultural decks.",
      zh: "深色 + 暖金粉,Cormorant 衬线 + 抽象渐变光圈,适合品牌叙事 / 文化品牌",
      "zh-TW": "深色 + 暖金粉,Cormorant 襯線 + 抽象漸變光圈,適合品牌敘事 / 文化品牌",
      ja: "ダークベース + 暖かなゴールドピンク。Cormorant のセリフ書体と抽象的な光の輪。ブランドストーリーや文化ブランドに。",
      ko: "딥 블랙 + 웜 골드핑크. Cormorant 세리프 + 추상적 광휘 효과. 브랜드 스토리텔링과 문화 브랜드에 적합.",
    },
  },
  {
    id: "l1-fs-electric-studio",
    name: {
      en: "Electric Studio · Crisp Blue",
      zh: "Electric Studio·蓝白工作室",
      "zh-TW": "Electric Studio·藍白工作室",
      ja: "Electric Studio·ブルー&ホワイト",
      ko: "Electric Studio·블루&화이트",
    },
    headline: {
      en: "Electric Studio",
      zh: "蓝白工作室",
      "zh-TW": "藍白工作室",
      ja: "エレクトリック・スタジオ",
      ko: "일렉트릭 스튜디오",
    },
    subhead: {
      en: "SaaS · proposal",
      zh: "产品 · 提案",
      "zh-TW": "產品 · 提案",
      ja: "SaaS · 提案書",
      ko: "SaaS · 제안",
    },
    oneLiner: {
      en: "White-blue split with sharp edges, Manrope sans-serif, and crisp brand badges — perfect for SaaS pitches and design proposals.",
      zh: "白蓝分屏 + Manrope 字体 + 品牌角标,适合 SaaS 产品介绍 / 设计提案",
      "zh-TW": "白藍分屏 + Manrope 字體 + 品牌角標,適合 SaaS 產品介紹 / 設計提案",
      ja: "ブルー&ホワイトの分割レイアウト + Manrope 書体 + ブランドバッジ。SaaS 紹介やデザイン提案に。",
      ko: "화이트-블루 스플릿 + Manrope 폰트 + 브랜드 배지. SaaS 제품 소개 / 디자인 제안에 적합.",
    },
  },
  {
    id: "l1-fs-notebook-tabs",
    name: {
      en: "Notebook Tabs · Loose-leaf",
      zh: "活页笔记·彩色侧标",
      "zh-TW": "活頁筆記·彩色側標",
      ja: "ノートブック·彩色タブ",
      ko: "노트북·컬러 탭",
    },
    headline: {
      en: "Notebook Tabs",
      zh: "活页笔记",
      "zh-TW": "活頁筆記",
      ja: "ノートブック",
      ko: "노트북 탭",
    },
    subhead: {
      en: "training · book club",
      zh: "课件 · 读书会",
      "zh-TW": "課件 · 讀書會",
      ja: "研修 · 読書会",
      ko: "교육 · 북클럽",
    },
    oneLiner: {
      en: "Cream paper cards with rainbow side tabs and binding holes, Bodoni Moda serif — ideal for training decks and book-club shares.",
      zh: "奶油纸卡 + 彩色侧标签 + 装订孔,Bodoni Moda 衬线,适合培训课件 / 读书会",
      "zh-TW": "奶油紙卡 + 彩色側標籤 + 裝訂孔,Bodoni Moda 襯線,適合培訓課件 / 讀書會",
      ja: "クリーム紙カード + カラフルなサイドタブ + 綴じ穴。Bodoni Moda セリフ。研修資料や読書会に。",
      ko: "크림 페이퍼 카드 + 레인보우 사이드 탭 + 바인딩 홀. Bodoni Moda 세리프. 교육 자료 / 북클럽에 적합.",
    },
  },
  {
    id: "l1-fs-pastel-geometry",
    name: {
      en: "Pastel Geometry · Candy Shapes",
      zh: "Pastel Geometry·糖果几何",
      "zh-TW": "Pastel Geometry·糖果幾何",
      ja: "Pastel Geometry·キャンディ幾何",
      ko: "Pastel Geometry·캔디 지오메트리",
    },
    headline: {
      en: "Pastel Geometry",
      zh: "糖果几何",
      "zh-TW": "糖果幾何",
      ja: "キャンディ幾何",
      ko: "캔디 지오메트리",
    },
    subhead: {
      en: "lifestyle · portfolio",
      zh: "生活 · 作品集",
      "zh-TW": "生活 · 作品集",
      ja: "ライフスタイル · ポートフォリオ",
      ko: "라이프스타일 · 포트폴리오",
    },
    oneLiner: {
      en: "Soft white base with candy pastels and rounded geometric accents, Plus Jakarta Sans — for lifestyle brands and personal portfolios.",
      zh: "白底糖果色 + 圆角几何装饰,Plus Jakarta Sans,适合生活方式 / 个人作品集",
      "zh-TW": "白底糖果色 + 圓角幾何裝飾,Plus Jakarta Sans,適合生活方式 / 個人作品集",
      ja: "ホワイトベース + キャンディパステル + ラウンド幾何装飾。Plus Jakarta Sans。ライフスタイルブランドや個人ポートフォリオに。",
      ko: "화이트 베이스 + 캔디 파스텔 + 라운드 지오메트릭 데코. Plus Jakarta Sans. 라이프스타일 / 개인 포트폴리오에.",
    },
  },
  {
    id: "l1-fs-split-pastel",
    name: {
      en: "Split Pastel · Playful Diagonals",
      zh: "Split Pastel·分屏糖果",
      "zh-TW": "Split Pastel·分屏糖果",
      ja: "Split Pastel·分割パステル",
      ko: "Split Pastel·스플릿 파스텔",
    },
    headline: {
      en: "Split Pastel",
      zh: "分屏糖果",
      "zh-TW": "分屏糖果",
      ja: "分割パステル",
      ko: "스플릿 파스텔",
    },
    subhead: {
      en: "marketing · event",
      zh: "营销 · 活动",
      "zh-TW": "行銷 · 活動",
      ja: "マーケ · イベント",
      ko: "마케팅 · 이벤트",
    },
    oneLiner: {
      en: "Peach + lavender diagonal split with playful badges, Outfit rounded type — for marketing pitches and event keys.",
      zh: "桃粉 / 薰衣草分屏 + 顽皮徽章,Outfit 圆体,适合营销提案 / 活动主视觉",
      "zh-TW": "桃粉 / 薰衣草分屏 + 頑皮徽章,Outfit 圓體,適合行銷提案 / 活動主視覺",
      ja: "ピーチピンク + ラベンダーの斜め分割 + 遊び心バッジ。Outfit 丸ゴシック。マーケ提案やイベントメインビジュアルに。",
      ko: "피치 + 라벤더 대각선 스플릿 + 플레이풀 배지. Outfit 라운드 타이포. 마케팅 제안 / 이벤트 메인 비주얼에.",
    },
  },
  {
    id: "l1-fs-vintage-editorial",
    name: {
      en: "Vintage Editorial · Cream & Rust",
      zh: "Vintage Editorial·复古杂志",
      "zh-TW": "Vintage Editorial·復古雜誌",
      ja: "Vintage Editorial·ヴィンテージ・エディトリアル",
      ko: "Vintage Editorial·빈티지 에디토리얼",
    },
    headline: {
      en: "Vintage Editorial",
      zh: "复古杂志",
      "zh-TW": "復古雜誌",
      ja: "ヴィンテージ雑誌",
      ko: "빈티지 에디토리얼",
    },
    subhead: {
      en: "feature · longform",
      zh: "专题 · 长文",
      "zh-TW": "專題 · 長文",
      ja: "特集 · 長文",
      ko: "피처 · 롱폼",
    },
    oneLiner: {
      en: "Cream with rust accents, abstract geometric shapes, and Fraunces vintage serif — for brand longform and magazine features.",
      zh: "奶油底 + 抽象几何 + Fraunces 复古衬线,适合品牌长文 / 杂志专题",
      "zh-TW": "奶油底 + 抽象幾何 + Fraunces 復古襯線,適合品牌長文 / 雜誌專題",
      ja: "クリーム + ラスト + 抽象幾何形 + Fraunces ヴィンテージセリフ。ブランド長文や雑誌特集に。",
      ko: "크림 베이스 + 러스트 + 추상 지오메트릭 + Fraunces 빈티지 세리프. 브랜드 롱폼 / 매거진 피처에 적합.",
    },
  },

  // ════════════════ 2 × guizang L1 ════════════════
  {
    id: "l1-guizang-monocle",
    name: {
      en: "Monocle · Editorial Magazine",
      zh: "墨水经典·磁带杂志",
      "zh-TW": "墨水經典·磁帶雜誌",
      ja: "Monocle·エディトリアル誌風",
      ko: "Monocle·에디토리얼 매거진",
    },
    headline: {
      en: "Monocle",
      zh: "墨水经典",
      "zh-TW": "墨水經典",
      ja: "モノクル",
      ko: "모노클",
    },
    subhead: {
      en: "brand · culture",
      zh: "品牌 · 文化",
      "zh-TW": "品牌 · 文化",
      ja: "ブランド · 文化",
      ko: "브랜드 · 문화",
    },
    oneLiner: {
      en: "Black on warm white with WebGL fluid backgrounds and editorial typography — for brand launches and cultural narratives.",
      zh: "黑底暖白,磁带杂志感,WebGL 流体背景,适合品牌发布 / 文化叙事",
      "zh-TW": "黑底暖白,磁帶雜誌感,WebGL 流體背景,適合品牌發布 / 文化敘事",
      ja: "ブラック × ウォームホワイト。WebGL 流体背景とエディトリアルタイポ。ブランド発表や文化ナラティブに。",
      ko: "블랙 + 웜 화이트. WebGL 플루이드 배경 + 에디토리얼 타이포. 브랜드 런칭 / 문화 내러티브에 적합.",
    },
  },
  {
    id: "l1-guizang-kraft",
    name: {
      en: "Kraft Paper · Hand Notes",
      zh: "牛皮纸·手感笔记",
      "zh-TW": "牛皮紙·手感筆記",
      ja: "クラフト紙·手書きノート",
      ko: "크라프트지·핸드 노트",
    },
    headline: {
      en: "Kraft Paper",
      zh: "牛皮纸",
      "zh-TW": "牛皮紙",
      ja: "クラフト紙",
      ko: "크라프트",
    },
    subhead: {
      en: "course · book share",
      zh: "课程 · 读书",
      "zh-TW": "課程 · 讀書",
      ja: "講座 · 読書会",
      ko: "강좌 · 독서",
    },
    oneLiner: {
      en: "Warm kraft paper texture with a gentle handcrafted feel — built for online courses, book shares, and personal retros.",
      zh: "牛皮纸暖色,温柔手感,适合教育课程 / 读书分享 / 个人复盘",
      "zh-TW": "牛皮紙暖色,溫柔手感,適合教育課程 / 讀書分享 / 個人復盤",
      ja: "クラフト紙の暖色と手作りの温もり。オンライン講座、読書会、個人振り返りに。",
      ko: "크라프트지 웜 컬러 + 핸드메이드 감성. 강좌 / 독서 공유 / 개인 회고에 적합.",
    },
  },

  // ════════════════ 28 × baoyu L2 AI 出图风格 ════════════════
  {
    id: "l2-active-theory",
    name: {
      en: "Active Theory · Particle Cyber",
      zh: "Active Theory·粒子赛博",
      "zh-TW": "Active Theory·粒子賽博",
      ja: "Active Theory·パーティクル・サイバー",
      ko: "Active Theory·파티클 사이버",
    },
    headline: {
      en: "Active Theory",
      zh: "粒子赛博",
      "zh-TW": "粒子賽博",
      ja: "パーティクル・サイバー",
      ko: "파티클 사이버",
    },
    subhead: {
      en: "AI · data · tech",
      zh: "AI · 数据 · 科技",
      "zh-TW": "AI · 數據 · 科技",
      ja: "AI · データ · 技術",
      ko: "AI · 데이터 · 테크",
    },
    oneLiner: {
      en: "WebGL 3D particles, neon deep-space palette, and glassmorphic UI — for AI / tech / data-driven brand decks.",
      zh: "WebGL 3D 粒子 + 霓虹深空 + 玻璃 UI,适合 AI / 科技 / 数据驱动品牌",
      "zh-TW": "WebGL 3D 粒子 + 霓虹深空 + 玻璃 UI,適合 AI / 科技 / 數據驅動品牌",
      ja: "WebGL 3D パーティクル + ネオン宇宙色 + グラスモーフィック UI。AI・テック・データ駆動ブランドに。",
      ko: "WebGL 3D 파티클 + 네온 딥스페이스 + 글래스모피즘 UI. AI / 테크 / 데이터 드리븐 브랜드에 적합.",
    },
  },
  {
    id: "l2-ash-thorp",
    name: {
      en: "Ash Thorp · Warm Cyberpunk",
      zh: "Ash Thorp·暖色赛博",
      "zh-TW": "Ash Thorp·暖色賽博",
      ja: "Ash Thorp·ウォーム・サイバーパンク",
      ko: "Ash Thorp·웜 사이버펑크",
    },
    headline: {
      en: "Ash Thorp",
      zh: "暖色赛博",
      "zh-TW": "暖色賽博",
      ja: "ウォーム・サイバー",
      ko: "웜 사이버",
    },
    subhead: {
      en: "launch · cinematic",
      zh: "发布 · 电影感",
      "zh-TW": "發布 · 電影感",
      ja: "発表 · 映画的",
      ko: "런칭 · 시네마틱",
    },
    oneLiner: {
      en: "Blade Runner 2049 warm cyberpunk with volumetric light and industrial polish — for product launches and cinematic concepts.",
      zh: "Blade Runner 2049 暖色赛博朋克,光束 + 工业精致,适合品牌发布 / 概念项目 / 电影感",
      "zh-TW": "Blade Runner 2049 暖色賽博龐克,光束 + 工業精緻,適合品牌發布 / 概念專案 / 電影感",
      ja: "ブレードランナー 2049 風の暖色サイバーパンク。ボリュームライトと工業的な精度。ブランド発表や映画的コンセプトに。",
      ko: "블레이드 러너 2049 웜 사이버펑크 + 볼류메트릭 라이트 + 인더스트리얼 정밀함. 런칭 / 컨셉 프로젝트 / 시네마틱에 적합.",
    },
  },
  {
    id: "l2-bauhaus",
    name: {
      en: "Bauhaus",
      zh: "Bauhaus 包豪斯",
      "zh-TW": "Bauhaus 包浩斯",
      ja: "Bauhaus·バウハウス",
      ko: "Bauhaus·바우하우스",
    },
    headline: {
      en: "Bauhaus",
      zh: "包豪斯",
      "zh-TW": "包浩斯",
      ja: "バウハウス",
      ko: "바우하우스",
    },
    subhead: {
      en: "design · architecture",
      zh: "设计 · 建筑",
      "zh-TW": "設計 · 建築",
      ja: "デザイン · 建築",
      ko: "디자인 · 건축",
    },
    oneLiner: {
      en: "Pure geometry, primary triad, and grid constructivism — the go-to for design / architecture / education topics.",
      zh: "纯几何 + 三原色 + 网格主义,设计 / 建筑 / 教育主题首选",
      "zh-TW": "純幾何 + 三原色 + 網格主義,設計 / 建築 / 教育主題首選",
      ja: "純粋な幾何学 + 三原色 + グリッド構成主義。デザイン / 建築 / 教育テーマの定番。",
      ko: "순수 기하 + 3원색 + 그리드 구성주의. 디자인 / 건축 / 교육 주제 최적.",
    },
  },
  {
    id: "l2-blueprint",
    name: {
      en: "Blueprint · Engineering Brief",
      zh: "蓝图工程·技术汇报",
      "zh-TW": "藍圖工程·技術匯報",
      ja: "ブループリント·技術ブリーフ",
      ko: "블루프린트·테크 브리프",
    },
    headline: {
      en: "Blueprint",
      zh: "蓝图工程",
      "zh-TW": "藍圖工程",
      ja: "ブループリント",
      ko: "블루프린트",
    },
    subhead: {
      en: "architecture · tech",
      zh: "架构 · 技术",
      "zh-TW": "架構 · 技術",
      ja: "アーキ · 技術",
      ko: "아키텍처 · 테크",
    },
    oneLiner: {
      en: "Engineering blueprint with grid lines and technical annotations — for architecture diagrams and tech briefs.",
      zh: "工程蓝图风,网格线 + 技术注解,适合架构设计 / 技术汇报",
      "zh-TW": "工程藍圖風,網格線 + 技術註解,適合架構設計 / 技術匯報",
      ja: "エンジニアリング・ブループリント風。グリッド線とテクニカル注釈。アーキテクチャ図や技術ブリーフに。",
      ko: "엔지니어링 블루프린트. 그리드 라인 + 테크 어노테이션. 아키텍처 다이어그램 / 테크 브리프에 적합.",
    },
  },
  {
    id: "l2-bold-editorial",
    name: {
      en: "Bold Editorial · Magazine Headline",
      zh: "粗体编辑·杂志头条",
      "zh-TW": "粗體編輯·雜誌頭條",
      ja: "Bold Editorial·マガジン見出し",
      ko: "Bold Editorial·매거진 헤드라인",
    },
    headline: {
      en: "Bold Editorial",
      zh: "粗体编辑",
      "zh-TW": "粗體編輯",
      ja: "ボールド・エディトリアル",
      ko: "볼드 에디토리얼",
    },
    subhead: {
      en: "PR · publish",
      zh: "公关 · 发布",
      "zh-TW": "公關 · 發布",
      ja: "PR · 発信",
      ko: "PR · 퍼블리싱",
    },
    oneLiner: {
      en: "Magazine-headline gravitas with extreme contrast and bold weights — for content drops and PR statements.",
      zh: "粗体杂志头条感,极致对比,适合内容发布 / 公关稿",
      "zh-TW": "粗體雜誌頭條感,極致對比,適合內容發布 / 公關稿",
      ja: "雑誌見出しの存在感と極端なコントラスト。コンテンツリリースや PR 発信に。",
      ko: "매거진 헤드라인 + 극강 콘트라스트. 콘텐츠 릴리스 / PR 자료에 적합.",
    },
  },
  {
    id: "l2-chalkboard",
    name: {
      en: "Chalkboard · Hand-drawn Lesson",
      zh: "黑板手绘·教学复盘",
      "zh-TW": "黑板手繪·教學復盤",
      ja: "黒板·手描きレッスン",
      ko: "칠판·핸드드로우 레슨",
    },
    headline: {
      en: "Chalkboard",
      zh: "黑板手绘",
      "zh-TW": "黑板手繪",
      ja: "黒板",
      ko: "칠판",
    },
    subhead: {
      en: "class · explainer",
      zh: "课堂 · 科普",
      "zh-TW": "課堂 · 科普",
      ja: "授業 · 解説",
      ko: "수업 · 해설",
    },
    oneLiner: {
      en: "Chalk lettering on blackboard with hand-drawn arrows and erase marks — for classroom teaching and explainer decks.",
      zh: "黑板粉笔字,手绘箭头,适合课堂教学 / 知识科普",
      "zh-TW": "黑板粉筆字,手繪箭頭,適合課堂教學 / 知識科普",
      ja: "黒板にチョーク文字、手描きの矢印と消し跡。授業や解説スライドに。",
      ko: "칠판 분필 글씨 + 핸드 드로우 화살표 + 지운 흔적. 수업 / 해설 슬라이드에 적합.",
    },
  },
  {
    id: "l2-corporate",
    name: {
      en: "Corporate · Boardroom",
      zh: "商务专业·企业汇报",
      "zh-TW": "商務專業·企業匯報",
      ja: "コーポレート·ボードルーム",
      ko: "코퍼레이트·보드룸",
    },
    headline: {
      en: "Corporate",
      zh: "商务专业",
      "zh-TW": "商務專業",
      ja: "コーポレート",
      ko: "코퍼레이트",
    },
    subhead: {
      en: "quarterly · investor",
      zh: "季报 · 路演",
      "zh-TW": "季報 · 路演",
      ja: "四半期 · 投資家",
      ko: "분기 · 투자자",
    },
    oneLiner: {
      en: "Navy + gold structured grid for quarterly reviews, investor pitches, and client proposals.",
      zh: "海军蓝 + 金,结构化网格,适合季度汇报 / 投资人路演 / 客户提案",
      "zh-TW": "海軍藍 + 金,結構化網格,適合季度匯報 / 投資人路演 / 客戶提案",
      ja: "ネイビー + ゴールドの構造化グリッド。四半期レビュー、投資家ピッチ、顧客提案に。",
      ko: "네이비 + 골드 구조화 그리드. 분기 리포트 / 투자자 피칭 / 고객 제안에 적합.",
    },
  },
  {
    id: "l2-dark-atmospheric",
    name: {
      en: "Dark Atmospheric · Cinematic",
      zh: "深色氛围·电影感",
      "zh-TW": "深色氛圍·電影感",
      ja: "Dark Atmospheric·シネマティック",
      ko: "Dark Atmospheric·시네마틱",
    },
    headline: {
      en: "Dark Atmospheric",
      zh: "深色氛围",
      "zh-TW": "深色氛圍",
      ja: "ダーク・アトモスフェリック",
      ko: "다크 앳모스페릭",
    },
    subhead: {
      en: "brand · launch",
      zh: "品牌 · 发布",
      "zh-TW": "品牌 · 發布",
      ja: "ブランド · 発表",
      ko: "브랜드 · 런칭",
    },
    oneLiner: {
      en: "Dark immersion with cinema-grade color grading and dramatic lighting — for brand launches and product reveals.",
      zh: "深色 + 电影色彩分级,沉浸感强,适合品牌发布 / 产品 launch",
      "zh-TW": "深色 + 電影色彩分級,沉浸感強,適合品牌發布 / 產品 launch",
      ja: "ダーク基調 + シネマグレードのカラー + ドラマチックな照明。ブランド発表やプロダクトローンチに。",
      ko: "다크 + 시네마 그레이드 컬러 + 드라마틱 라이팅. 브랜드 런칭 / 프로덕트 리빌에 적합.",
    },
  },
  {
    id: "l2-dunhuang",
    name: {
      en: "Dunhuang · Tang Mural",
      zh: "敦煌壁画·东方典雅",
      "zh-TW": "敦煌壁畫·東方典雅",
      ja: "敦煌·唐代壁画",
      ko: "둔황·당대 벽화",
    },
    headline: {
      en: "Dunhuang",
      zh: "敦煌壁画",
      "zh-TW": "敦煌壁畫",
      ja: "敦煌",
      ko: "둔황",
    },
    subhead: {
      en: "guofeng · ceremony",
      zh: "国风 · 文化",
      "zh-TW": "國風 · 文化",
      ja: "中国風 · 文化",
      ko: "구오펑 · 문화",
    },
    oneLiner: {
      en: "Tang Dynasty Dunhuang mural aesthetic — scroll narrative, flying ribbons, mineral pigments — for guofeng brands, cultural launches, and high-end ceremonial decks.",
      zh: "唐风敦煌壁画,卷轴叙事 + 飞天 + 矿物色,适合国风品牌 / 文化项目 / 高端发布",
      "zh-TW": "唐風敦煌壁畫,卷軸敘事 + 飛天 + 礦物色,適合國風品牌 / 文化專案 / 高端發布",
      ja: "唐代敦煌壁画美学。巻物ナラティブ、飛天の帯、鉱物顔料。中国風ブランドや文化プロジェクト、高級発表に。",
      ko: "당대 둔황 벽화 미학. 스크롤 내러티브 + 비천 리본 + 미네랄 안료. 구오펑 브랜드 / 문화 프로젝트 / 고급 런칭에 적합.",
    },
  },
  {
    id: "l2-editorial-infographic",
    name: {
      en: "Editorial Infographic · Data Story",
      zh: "信息图杂志·数据故事",
      "zh-TW": "資訊圖雜誌·數據故事",
      ja: "Editorial Infographic·データストーリー",
      ko: "Editorial Infographic·데이터 스토리",
    },
    headline: {
      en: "Editorial Infographic",
      zh: "信息图杂志",
      "zh-TW": "資訊圖雜誌",
      ja: "インフォグラフィック",
      ko: "에디토리얼 인포그래픽",
    },
    subhead: {
      en: "report · insight",
      zh: "报告 · 洞察",
      "zh-TW": "報告 · 洞察",
      ja: "レポート · 洞察",
      ko: "리포트 · 인사이트",
    },
    oneLiner: {
      en: "Editorial infographic style with data-driven narrative — for industry reports and trend insights.",
      zh: "信息图风,数据可视化驱动,适合行业报告 / 趋势洞察",
      "zh-TW": "資訊圖風,數據視覺化驅動,適合行業報告 / 趨勢洞察",
      ja: "インフォグラフィック風。データドリブンなナラティブ。業界レポートやトレンド洞察に。",
      ko: "에디토리얼 인포그래픽 + 데이터 드리븐 내러티브. 산업 리포트 / 트렌드 인사이트에 적합.",
    },
  },
  {
    id: "l2-fantasy-animation",
    name: {
      en: "Fantasy Animation · Story Mode",
      zh: "奇幻动画·叙事故事",
      "zh-TW": "奇幻動畫·敘事故事",
      ja: "Fantasy Animation·物語モード",
      ko: "Fantasy Animation·스토리 모드",
    },
    headline: {
      en: "Fantasy Animation",
      zh: "奇幻动画",
      "zh-TW": "奇幻動畫",
      ja: "ファンタジー・アニメ",
      ko: "판타지 애니메이션",
    },
    subhead: {
      en: "creative · story",
      zh: "创意 · 故事",
      "zh-TW": "創意 · 故事",
      ja: "クリエイティブ · 物語",
      ko: "크리에이티브 · 스토리",
    },
    oneLiner: {
      en: "Animated-film aesthetic with scenic narrative — for creative projects, kids' content, and storytelling decks.",
      zh: "动画电影感,场景化叙事,适合创意项目 / 儿童内容",
      "zh-TW": "動畫電影感,場景化敘事,適合創意專案 / 兒童內容",
      ja: "アニメ映画の質感、シーン主導のストーリーテリング。クリエイティブ案件や児童向けに。",
      ko: "애니메이션 영화 감각 + 장면 중심 내러티브. 크리에이티브 프로젝트 / 어린이 콘텐츠에 적합.",
    },
  },
  {
    id: "l2-field-io",
    name: {
      en: "Field.io · Algorithmic Aesthetic",
      zh: "Field.io·算法美学",
      "zh-TW": "Field.io·演算法美學",
      ja: "Field.io·アルゴリズミック美学",
      ko: "Field.io·알고리즈믹 미학",
    },
    headline: {
      en: "Field.io",
      zh: "算法美学",
      "zh-TW": "演算法美學",
      ja: "アルゴリズミック",
      ko: "알고리즈믹",
    },
    subhead: {
      en: "data · algorithm",
      zh: "数据 · 算法",
      "zh-TW": "數據 · 演算法",
      ja: "データ · アルゴリズム",
      ko: "데이터 · 알고리즘",
    },
    oneLiner: {
      en: "Voronoi / Delaunay algorithmic generation — code as design — for data science, algorithm brands, and digital art.",
      zh: "Voronoi / Delaunay 算法生成图,代码即设计,适合数据科学 / 算法品牌 / 数字艺术",
      "zh-TW": "Voronoi / Delaunay 演算法生成圖,代碼即設計,適合數據科學 / 演算法品牌 / 數位藝術",
      ja: "Voronoi / Delaunay アルゴリズム生成。コード = デザイン。データサイエンス、アルゴリズムブランド、デジタルアートに。",
      ko: "Voronoi / Delaunay 알고리즘 생성. 코드 = 디자인. 데이터 사이언스 / 알고리즘 브랜드 / 디지털 아트에 적합.",
    },
  },
  {
    id: "l2-hand-drawn-edu",
    name: {
      en: "Hand-drawn Edu · Friendly Lesson",
      zh: "手绘教育·亲切讲解",
      "zh-TW": "手繪教育·親切講解",
      ja: "手描き教育·親しみやすい解説",
      ko: "핸드 드로우 교육·친근한 강의",
    },
    headline: {
      en: "Hand-drawn Edu",
      zh: "手绘教育",
      "zh-TW": "手繪教育",
      ja: "手描き教育",
      ko: "핸드드로우 교육",
    },
    subhead: {
      en: "course · bootcamp",
      zh: "课程 · 训练营",
      "zh-TW": "課程 · 訓練營",
      ja: "講座 · ブートキャンプ",
      ko: "강좌 · 부트캠프",
    },
    oneLiner: {
      en: "Hand-drawn teaching style with a warm, approachable feel — for online courses, bootcamps, and internal training.",
      zh: "手绘风教学,亲切感强,适合在线课 / 训练营 / 内训",
      "zh-TW": "手繪風教學,親切感強,適合線上課 / 訓練營 / 內訓",
      ja: "手描き教育スタイル + 親しみやすい質感。オンライン講座、ブートキャンプ、社内研修に。",
      ko: "핸드 드로우 교육 스타일 + 친근한 톤. 온라인 강좌 / 부트캠프 / 사내 교육에 적합.",
    },
  },
  {
    id: "l2-intuition-machine",
    name: {
      en: "Intuition Machine · Abstract Concept",
      zh: "直觉机器·抽象概念",
      "zh-TW": "直覺機器·抽象概念",
      ja: "Intuition Machine·抽象概念",
      ko: "Intuition Machine·추상 개념",
    },
    headline: {
      en: "Intuition Machine",
      zh: "直觉机器",
      "zh-TW": "直覺機器",
      ja: "直感機械",
      ko: "직관 머신",
    },
    subhead: {
      en: "AI · concept",
      zh: "AI · 概念",
      "zh-TW": "AI · 概念",
      ja: "AI · 概念",
      ko: "AI · 개념",
    },
    oneLiner: {
      en: "Geometric abstraction for AI / algorithm / frontier-tech concept communication.",
      zh: "几何抽象,适合 AI / 算法 / 前沿科技概念",
      "zh-TW": "幾何抽象,適合 AI / 演算法 / 前沿科技概念",
      ja: "幾何抽象。AI・アルゴリズム・先端技術コンセプトの伝達に。",
      ko: "기하학적 추상. AI / 알고리즘 / 첨단 기술 컨셉 전달에 적합.",
    },
  },
  {
    id: "l2-minimal",
    name: {
      en: "Minimal · Negative Space",
      zh: "极简·留白美学",
      "zh-TW": "極簡·留白美學",
      ja: "ミニマル·余白の美",
      ko: "미니멀·여백의 미",
    },
    headline: {
      en: "Minimal",
      zh: "极简",
      "zh-TW": "極簡",
      ja: "ミニマル",
      ko: "미니멀",
    },
    subhead: {
      en: "portfolio · concept",
      zh: "作品集 · 概念",
      "zh-TW": "作品集 · 概念",
      ja: "ポートフォリオ · 概念",
      ko: "포트폴리오 · 컨셉",
    },
    oneLiner: {
      en: "Negative space first, typography forward, no decoration — for design portfolios and concept presentations.",
      zh: "极简留白,字体优先,适合 design portfolio / 概念展示",
      "zh-TW": "極簡留白,字體優先,適合 design portfolio / 概念展示",
      ja: "余白優先・タイポグラフィ主導・装飾なし。デザインポートフォリオやコンセプト発表に。",
      ko: "여백 우선 + 타이포그래피 중심 + 무장식. 디자인 포트폴리오 / 컨셉 프레젠테이션에 적합.",
    },
  },
  {
    id: "l2-neo-brutalism",
    name: {
      en: "Neo-Brutalism · Hard Shadows",
      zh: "Neo-Brutalism·新粗野",
      "zh-TW": "Neo-Brutalism·新粗野",
      ja: "Neo-Brutalism·ネオ・ブルータリズム",
      ko: "Neo-Brutalism·네오 브루탈리즘",
    },
    headline: {
      en: "Neo-Brutalism",
      zh: "新粗野",
      "zh-TW": "新粗野",
      ja: "ネオ・ブルータリズム",
      ko: "네오 브루탈리즘",
    },
    subhead: {
      en: "SaaS · indie",
      zh: "SaaS · 独立",
      "zh-TW": "SaaS · 獨立",
      ja: "SaaS · インディー",
      ko: "SaaS · 인디",
    },
    oneLiner: {
      en: "Heavy black borders, hard shadows, and big-block color in a Gumroad / Figma vibe — for SaaS, internal training, and info-dense scenes.",
      zh: "粗黑边框 + 硬阴影 + 大字色块,Gumroad/Figma 风,SaaS / 内训 / 信息密集场景",
      "zh-TW": "粗黑邊框 + 硬陰影 + 大字色塊,Gumroad/Figma 風,SaaS / 內訓 / 資訊密集場景",
      ja: "太い黒枠 + ハードシャドウ + ビッグカラーブロック。Gumroad / Figma 系。SaaS、社内研修、情報密度の高い場面に。",
      ko: "굵은 블랙 보더 + 하드 섀도 + 빅 컬러 블록. Gumroad / Figma 톤. SaaS / 사내 교육 / 정보 밀도 높은 장면에 적합.",
    },
  },
  {
    id: "l2-notion",
    name: {
      en: "Notion · Clean Structure",
      zh: "Notion 风·结构清晰",
      "zh-TW": "Notion 風·結構清晰",
      ja: "Notion 風·クリーン構造",
      ko: "Notion 풍·클린 스트럭처",
    },
    headline: {
      en: "Notion",
      zh: "Notion 风",
      "zh-TW": "Notion 風",
      ja: "Notion 風",
      ko: "Notion 풍",
    },
    subhead: {
      en: "knowledge · share",
      zh: "知识 · 分享",
      "zh-TW": "知識 · 分享",
      ja: "知識 · 共有",
      ko: "지식 · 공유",
    },
    oneLiner: {
      en: "Notion-inspired aesthetic with card layouts and grid alignment — for knowledge management and internal shares.",
      zh: "Notion 美学,卡片式布局,适合知识管理 / 内部分享",
      "zh-TW": "Notion 美學,卡片式佈局,適合知識管理 / 內部分享",
      ja: "Notion 美学。カード式レイアウトとグリッドアライメント。ナレッジ管理や社内共有に。",
      ko: "Notion 미학. 카드형 레이아웃 + 그리드 정렬. 지식 관리 / 사내 공유에 적합.",
    },
  },
  {
    id: "l2-pixel-art",
    name: {
      en: "Pixel Art · Retro Game",
      zh: "像素艺术·复古游戏",
      "zh-TW": "像素藝術·復古遊戲",
      ja: "ピクセルアート·レトロゲーム",
      ko: "픽셀 아트·레트로 게임",
    },
    headline: {
      en: "Pixel Art",
      zh: "像素艺术",
      "zh-TW": "像素藝術",
      ja: "ピクセルアート",
      ko: "픽셀 아트",
    },
    subhead: {
      en: "geek · indie",
      zh: "极客 · 独立",
      "zh-TW": "極客 · 獨立",
      ja: "ギーク · インディー",
      ko: "긱 · 인디",
    },
    oneLiner: {
      en: "8-bit pixel art with game-like vibes — for geek culture and indie project showcases.",
      zh: "8-bit 像素,游戏感,适合极客文化 / 个人项目展示",
      "zh-TW": "8-bit 像素,遊戲感,適合極客文化 / 個人專案展示",
      ja: "8-bit ピクセルアート、ゲーム感覚。ギークカルチャーや個人プロジェクト紹介に。",
      ko: "8-bit 픽셀 아트 + 게임 감성. 긱 컬처 / 개인 프로젝트 쇼케이스에 적합.",
    },
  },
  {
    id: "l2-risograph",
    name: {
      en: "Risograph · Stencil Print",
      zh: "Risograph·孔版印刷",
      "zh-TW": "Risograph·孔版印刷",
      ja: "リソグラフ·孔版印刷",
      ko: "리소그래프·스텐실 프린트",
    },
    headline: {
      en: "Risograph",
      zh: "孔版印刷",
      "zh-TW": "孔版印刷",
      ja: "リソグラフ",
      ko: "리소그래프",
    },
    subhead: {
      en: "indie · zine",
      zh: "独立 · 刊物",
      "zh-TW": "獨立 · 刊物",
      ja: "インディー · ZINE",
      ko: "인디 · 진",
    },
    oneLiner: {
      en: "Two-color overprint with misregistered layers and halftone dots — for indie brands, music labels, and zine-style publications.",
      zh: "双色叠印 + 套色错位 + 半色调,文创独立品牌 / 音乐厂牌 / 独立刊物",
      "zh-TW": "雙色疊印 + 套色錯位 + 半色調,文創獨立品牌 / 音樂廠牌 / 獨立刊物",
      ja: "2 色重ね刷り + ミスレジスト + ハーフトーン。文化系インディーブランド、音楽レーベル、ZINE に。",
      ko: "투 컬러 오버프린트 + 미스레지스트 + 하프톤. 인디 브랜드 / 음악 레이블 / 진 출판물에 적합.",
    },
  },
  {
    id: "l2-sagmeister",
    name: {
      en: "Sagmeister · Joyful Minimal",
      zh: "Sagmeister·快乐极简",
      "zh-TW": "Sagmeister·快樂極簡",
      ja: "Sagmeister·ジョイフル・ミニマル",
      ko: "Sagmeister·조이풀 미니멀",
    },
    headline: {
      en: "Sagmeister",
      zh: "快乐极简",
      "zh-TW": "快樂極簡",
      ja: "ジョイフル・ミニマル",
      ko: "조이풀 미니멀",
    },
    subhead: {
      en: "studio · culture",
      zh: "工作室 · 文化",
      "zh-TW": "工作室 · 文化",
      ja: "スタジオ · 文化",
      ko: "스튜디오 · 문화",
    },
    oneLiner: {
      en: "Minimal base with surprise color bursts and physical handcraft texture — for creative studios, cultural brands, and personal portfolios.",
      zh: "极简底 + 意外色彩爆发 + 手工感物理材质,适合创意工作室 / 文化品牌 / 个人作品集",
      "zh-TW": "極簡底 + 意外色彩爆發 + 手工感物理材質,適合創意工作室 / 文化品牌 / 個人作品集",
      ja: "ミニマルなベース + 意外なカラーバースト + 手工芸の質感。クリエイティブスタジオ、文化ブランド、個人ポートフォリオに。",
      ko: "미니멀 베이스 + 서프라이즈 컬러 + 핸드크래프트 질감. 크리에이티브 스튜디오 / 문화 브랜드 / 개인 포트폴리오에 적합.",
    },
  },
  {
    id: "l2-scientific",
    name: {
      en: "Scientific · Research Brief",
      zh: "科学论文·学术严谨",
      "zh-TW": "科學論文·學術嚴謹",
      ja: "Scientific·学術ブリーフ",
      ko: "Scientific·학술 브리프",
    },
    headline: {
      en: "Scientific",
      zh: "科学论文",
      "zh-TW": "科學論文",
      ja: "サイエンティフィック",
      ko: "사이언티픽",
    },
    subhead: {
      en: "thesis · lab",
      zh: "论文 · 实验",
      "zh-TW": "論文 · 實驗",
      ja: "論文 · 実験",
      ko: "논문 · 실험",
    },
    oneLiner: {
      en: "Academic-paper layout with data-driven figures — for thesis defenses, lab reports, and research summaries.",
      zh: "学术论文风,数据驱动,适合学术答辩 / 实验汇报",
      "zh-TW": "學術論文風,數據驅動,適合學術答辯 / 實驗匯報",
      ja: "学術論文の組版とデータ駆動図表。学位審査や実験報告に。",
      ko: "학술 논문 레이아웃 + 데이터 드리븐 도표. 학위 심사 / 실험 보고에 적합.",
    },
  },
  {
    id: "l2-sketch-notes",
    name: {
      en: "Sketch Notes · Brainstorm",
      zh: "速写笔记·头脑风暴",
      "zh-TW": "速寫筆記·腦力激盪",
      ja: "スケッチノート·ブレスト",
      ko: "스케치 노트·브레인스토밍",
    },
    headline: {
      en: "Sketch Notes",
      zh: "速写笔记",
      "zh-TW": "速寫筆記",
      ja: "スケッチノート",
      ko: "스케치 노트",
    },
    subhead: {
      en: "workshop · brainstorm",
      zh: "工坊 · 共创",
      "zh-TW": "工坊 · 共創",
      ja: "ワークショップ · 共創",
      ko: "워크숍 · 공동 창작",
    },
    oneLiner: {
      en: "Hand-sketched note vibe — for workshops, co-creation sessions, and brainstorming.",
      zh: "速写笔记感,适合 workshop / 共创 / 头脑风暴",
      "zh-TW": "速寫筆記感,適合 workshop / 共創 / 腦力激盪",
      ja: "スケッチノートのライブ感。ワークショップ、共創、ブレストに。",
      ko: "라이브 스케치 노트 감성. 워크숍 / 공동 창작 / 브레인스토밍에 적합.",
    },
  },
  {
    id: "l2-snoopy",
    name: {
      en: "Snoopy · Warm Comic",
      zh: "Snoopy·温暖漫画",
      "zh-TW": "Snoopy·溫暖漫畫",
      ja: "Snoopy·ウォームコミック",
      ko: "Snoopy·웜 코믹",
    },
    headline: {
      en: "Snoopy",
      zh: "温暖漫画",
      "zh-TW": "溫暖漫畫",
      ja: "ウォームコミック",
      ko: "웜 코믹",
    },
    subhead: {
      en: "story · IP",
      zh: "故事 · 个人 IP",
      "zh-TW": "故事 · 個人 IP",
      ja: "物語 · 個人 IP",
      ko: "스토리 · 개인 IP",
    },
    oneLiner: {
      en: "Peanuts-style round-headed characters on warm canvas with 4-panel comic strips — for brand storytelling, education, and personal IPs.",
      zh: "Peanuts 圆头小身体 + 暖色画布 + 4 格漫画,品牌叙事 / 教育课件 / 个人 IP",
      "zh-TW": "Peanuts 圓頭小身體 + 暖色畫布 + 4 格漫畫,品牌敘事 / 教育課件 / 個人 IP",
      ja: "ピーナッツ風の丸頭キャラ + 暖色キャンバス + 4 コマ漫画。ブランドナラティブ、教育、個人 IP に。",
      ko: "피너츠 스타일 라운드 헤드 캐릭터 + 웜 캔버스 + 4 컷 만화. 브랜드 내러티브 / 교육 / 개인 IP에 적합.",
    },
  },
  {
    id: "l2-territory-fui",
    name: {
      en: "Territory FUI · Sci-Fi HUD",
      zh: "Territory FUI·科幻界面",
      "zh-TW": "Territory FUI·科幻介面",
      ja: "Territory FUI·SF・HUD",
      ko: "Territory FUI·SF HUD",
    },
    headline: {
      en: "Territory FUI",
      zh: "科幻 HUD",
      "zh-TW": "科幻 HUD",
      ja: "SF・HUD",
      ko: "SF HUD",
    },
    subhead: {
      en: "sci-fi · AI demo",
      zh: "科幻 · AI 演示",
      "zh-TW": "科幻 · AI 演示",
      ja: "SF · AI デモ",
      ko: "SF · AI 데모",
    },
    oneLiner: {
      en: "Sci-fi film HUD aesthetic — holographic projections, layered data, and scan lines — for tech products, AI demos, and future narratives.",
      zh: "科幻电影 HUD / 全息投影 / 数据叠层,适合科技产品 / AI / 未来叙事",
      "zh-TW": "科幻電影 HUD / 全息投影 / 數據疊層,適合科技產品 / AI / 未來敘事",
      ja: "SF 映画の HUD 美学。ホログラフィック投影、データレイヤー、スキャンライン。テック製品、AI デモ、未来ナラティブに。",
      ko: "SF 영화 HUD 미학. 홀로그래픽 + 데이터 레이어 + 스캔 라인. 테크 프로덕트 / AI 데모 / 미래 내러티브에 적합.",
    },
  },
  {
    id: "l2-ukiyo-e",
    name: {
      en: "Ukiyo-e · Edo Aesthetic",
      zh: "浮世绘·东瀛和风",
      "zh-TW": "浮世繪·東瀛和風",
      ja: "浮世絵·江戸の美学",
      ko: "우키요에·에도 미학",
    },
    headline: {
      en: "Ukiyo-e",
      zh: "浮世绘",
      "zh-TW": "浮世繪",
      ja: "浮世絵",
      ko: "우키요에",
    },
    subhead: {
      en: "Japan · culture",
      zh: "日系 · 文化",
      "zh-TW": "日系 · 文化",
      ja: "日本 · 文化",
      ko: "일본 · 문화",
    },
    oneLiner: {
      en: "Edo-period ukiyo-e aesthetic with flat color blocks, waves, and seal stamps — for Japanese brands, Asia-bound campaigns, and cultural narratives.",
      zh: "江户浮世绘,平涂色块 + 浪潮 + 朱印,适合日系品牌 / 跨境东方市场 / 文化叙事",
      "zh-TW": "江戶浮世繪,平塗色塊 + 浪潮 + 朱印,適合日系品牌 / 跨境東方市場 / 文化敘事",
      ja: "江戸期の浮世絵美学。フラットな色面、波、朱印。日系ブランド、アジア向けキャンペーン、文化ナラティブに。",
      ko: "에도시대 우키요에 미학. 플랫 컬러 + 웨이브 + 주인. 일본계 브랜드 / 아시아 시장 캠페인 / 문화 내러티브에 적합.",
    },
  },
  {
    id: "l2-vector-illustration",
    name: {
      en: "Vector Illustration · Bright & Flat",
      zh: "矢量插画·明亮活泼",
      "zh-TW": "向量插畫·明亮活潑",
      ja: "ベクター・イラスト·明るくフラット",
      ko: "벡터 일러스트·밝고 플랫",
    },
    headline: {
      en: "Vector Illustration",
      zh: "矢量插画",
      "zh-TW": "向量插畫",
      ja: "ベクター・イラスト",
      ko: "벡터 일러스트",
    },
    subhead: {
      en: "product · landing",
      zh: "产品 · 落地页",
      "zh-TW": "產品 · 落地頁",
      ja: "プロダクト · LP",
      ko: "프로덕트 · 랜딩",
    },
    oneLiner: {
      en: "Flat vector illustration in a bright, lively palette — for product intros and SaaS landing decks.",
      zh: "扁平矢量,明亮活泼,适合产品介绍 / SaaS 着陆页",
      "zh-TW": "扁平向量,明亮活潑,適合產品介紹 / SaaS 著陸頁",
      ja: "フラットベクター + 明るく活発な配色。プロダクト紹介や SaaS LP に。",
      ko: "플랫 벡터 + 밝고 생기 있는 컬러. 프로덕트 소개 / SaaS 랜딩에 적합.",
    },
  },
  {
    id: "l2-vintage",
    name: {
      en: "Vintage Print · Nostalgia",
      zh: "复古印刷·怀旧感",
      "zh-TW": "復古印刷·懷舊感",
      ja: "ヴィンテージ印刷·ノスタルジア",
      ko: "빈티지 프린트·노스탤지아",
    },
    headline: {
      en: "Vintage Print",
      zh: "复古印刷",
      "zh-TW": "復古印刷",
      ja: "ヴィンテージ印刷",
      ko: "빈티지 프린트",
    },
    subhead: {
      en: "culture · F&B",
      zh: "文化 · 餐饮",
      "zh-TW": "文化 · 餐飲",
      ja: "文化 · 飲食",
      ko: "문화 · F&B",
    },
    oneLiner: {
      en: "Vintage print texture with paper-aged feel — for cultural brands, F&B venues, and photography portfolios.",
      zh: "复古印刷质感,适合文化品牌 / 餐饮 / 摄影集",
      "zh-TW": "復古印刷質感,適合文化品牌 / 餐飲 / 攝影集",
      ja: "ヴィンテージ印刷の質感、紙の年代感。文化ブランド、飲食店、写真集に。",
      ko: "빈티지 프린트 질감 + 페이퍼 에이징. 문화 브랜드 / F&B / 사진집에 적합.",
    },
  },
  {
    id: "l2-watercolor",
    name: {
      en: "Watercolor · Soft & Healing",
      zh: "水彩晕染·治愈风",
      "zh-TW": "水彩暈染·治癒風",
      ja: "水彩·癒しの色",
      ko: "수채화·힐링",
    },
    headline: {
      en: "Watercolor",
      zh: "水彩晕染",
      "zh-TW": "水彩暈染",
      ja: "水彩",
      ko: "수채화",
    },
    subhead: {
      en: "lifestyle · wellness",
      zh: "生活 · 健康",
      "zh-TW": "生活 · 健康",
      ja: "ライフ · ウェルネス",
      ko: "라이프 · 웰니스",
    },
    oneLiner: {
      en: "Watercolor washes with soft, healing tones — for lifestyle brands, wellness, and personal retros.",
      zh: "水彩晕染,柔和治愈,适合生活方式 / 健康 / 个人复盘",
      "zh-TW": "水彩暈染,柔和治癒,適合生活方式 / 健康 / 個人復盤",
      ja: "水彩のにじみと柔らかな癒しの色。ライフスタイル、ウェルネス、個人振り返りに。",
      ko: "수채 번짐 + 부드럽고 힐링 톤. 라이프스타일 / 웰니스 / 개인 회고에 적합.",
    },
  },
];

// ─────────────────────── 主流程 ───────────────────────

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ 缺 DATABASE_URL");
    process.exit(1);
  }
  const sql = neon(url);

  let updated = 0;
  let skipped = 0;

  for (const p of PATCHES) {
    const result = (await sql`
      UPDATE templates SET
        name_i18n      = ${JSON.stringify(p.name)}::jsonb,
        one_liner_i18n = ${JSON.stringify(p.oneLiner)}::jsonb,
        headline_i18n  = ${JSON.stringify(p.headline)}::jsonb,
        subhead_i18n   = ${JSON.stringify(p.subhead)}::jsonb,
        updated_at     = NOW()
      WHERE id = ${p.id} AND owner_user_id IS NULL
      RETURNING id
    `) as Array<{ id: string }>;

    if (result.length > 0) {
      updated += 1;
      console.log(`  ↻ ${p.id}`);
    } else {
      skipped += 1;
      console.warn(`  ⚠ 跳过(模板不存在):${p.id}`);
    }
  }

  console.log(
    `\n✅ 完成 — 更新 ${updated} / 跳过 ${skipped} / 总计 ${PATCHES.length}`,
  );
  console.log(`   每个模板 5 语言 name + oneLiner + headline + subhead 均已就绪`);
}

main().catch((err) => {
  console.error("❌ patch 失败:", err);
  process.exit(1);
});
