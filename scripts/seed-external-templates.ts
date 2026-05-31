// scripts/seed-external-templates.ts
// PR3:接入 zarazhangrui/beautiful-html-templates 的 32 个外部 HTML 模板。
//
// 用法:
//   npx tsx --env-file=.env.local scripts/seed-external-templates.ts
//
// 流程:
//   1. 从 src/lib/slides/templates/external/<slug>.html 读完整 HTML
//   2. 把 5 语言 name/oneLiner/headline/subhead 写入 *_i18n JSONB
//   3. template_html 字段塞 HTML 全文,LLM 改写时按模板路径走
//   4. preview_url 指向 /templates/external/<slug>.png(已复制到 public/)
//
// 每个模板的元数据(name / tagline / occasions)来自原仓库 template.json,
// 5 语言由 PR3 手工撰写,保证与原始视觉调性一致。
//
// 幂等:用 ON CONFLICT DO UPDATE,反复跑安全。

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import path from "node:path";

type Locale = "en" | "zh" | "zh-TW" | "ja" | "ko";
type LocalizedString = Record<Locale, string>;

interface ExternalTemplate {
  slug: string;
  niche: string; // 临时分组,PR4 会重做
  recommendedCount: number; // 估算
  name: LocalizedString;
  oneLiner: LocalizedString;
  headline: LocalizedString;
  subhead: LocalizedString;
}

// ─────────────────────── 32 模板元数据 + 5 语言文案 ───────────────────────

const TEMPLATES: ExternalTemplate[] = [
  // ════════════ 复古 / 趣味(8 个)════════════
  {
    slug: "8-bit-orbit",
    niche: "复古",
    recommendedCount: 10,
    name: {
      en: "8-Bit Orbit",
      zh: "8-Bit Orbit·像素霓虹",
      "zh-TW": "8-Bit Orbit·像素霓虹",
      ja: "8-Bit Orbit·ピクセルネオン",
      ko: "8-Bit Orbit·픽셀 네온",
    },
    headline: {
      en: "8-Bit Orbit",
      zh: "像素霓虹",
      "zh-TW": "像素霓虹",
      ja: "ピクセルネオン",
      ko: "픽셀 네온",
    },
    subhead: {
      en: "gaming · web3 · indie",
      zh: "游戏 · Web3 · 独立",
      "zh-TW": "遊戲 · Web3 · 獨立",
      ja: "ゲーム · Web3 · インディー",
      ko: "게임 · Web3 · 인디",
    },
    oneLiner: {
      en: "Pixel-art neon arcade aesthetic on a deep navy void — gaming pitches, hackathon demos, web3 decks, indie launches.",
      zh: "深紫黑底 + 霓虹粉青黄像素艺术 + CRT 扫描线,适合游戏路演 / 黑客松 demo / Web3 deck / 独立产品发布",
      "zh-TW": "深紫黑底 + 霓虹粉青黃像素藝術 + CRT 掃描線,適合遊戲路演 / 黑客松 demo / Web3 deck / 獨立產品發布",
      ja: "深いネイビーにネオンピンク・シアン・イエローのピクセルアート + CRT スキャンライン。ゲームピッチ、ハッカソンデモ、Web3 deck、インディーローンチに。",
      ko: "딥 네이비 + 네온 핑크/시안/옐로우 픽셀 아트 + CRT 스캔라인. 게임 피칭 / 해커톤 데모 / Web3 덱 / 인디 런칭에 적합.",
    },
  },
  {
    slug: "retro-windows",
    niche: "复古",
    recommendedCount: 10,
    name: {
      en: "Retro Windows",
      zh: "Retro Windows·复古视窗",
      "zh-TW": "Retro Windows·復古視窗",
      ja: "Retro Windows·懐かしの OS",
      ko: "Retro Windows·레트로 OS",
    },
    headline: {
      en: "Retro Windows",
      zh: "复古视窗",
      "zh-TW": "復古視窗",
      ja: "レトロ・ウィンドウズ",
      ko: "레트로 윈도우",
    },
    subhead: {
      en: "Y2K · nostalgia",
      zh: "Y2K · 怀旧",
      "zh-TW": "Y2K · 懷舊",
      ja: "Y2K · ノスタルジー",
      ko: "Y2K · 노스탤지어",
    },
    oneLiner: {
      en: "Win95 title bars, MS Sans Serif, and pixel icons — for retro gaming, Y2K branding, and nostalgic tech talks.",
      zh: "Win95 标题栏 + MS Sans Serif + 像素图标 + 对话框,适合复古游戏 / Y2K 品牌 / 技术怀旧演讲",
      "zh-TW": "Win95 標題列 + MS Sans Serif + 像素圖示 + 對話框,適合復古遊戲 / Y2K 品牌 / 技術懷舊演講",
      ja: "Win95 のタイトルバー、MS Sans Serif、ピクセルアイコン、ダイアログボックス。レトロゲーム、Y2K ブランド、技術ノスタルジー講演に。",
      ko: "Win95 타이틀바 + MS Sans Serif + 픽셀 아이콘 + 다이얼로그. 레트로 게임 / Y2K 브랜드 / 테크 노스탤지어에 적합.",
    },
  },
  {
    slug: "retro-zine",
    niche: "复古",
    recommendedCount: 10,
    name: {
      en: "Retro Zine",
      zh: "Retro Zine·孔版独立刊物",
      "zh-TW": "Retro Zine·孔版獨立刊物",
      ja: "Retro Zine·リソ印刷",
      ko: "Retro Zine·리소 진",
    },
    headline: {
      en: "Retro Zine",
      zh: "孔版独立",
      "zh-TW": "孔版獨立",
      ja: "リソ印刷",
      ko: "리소 진",
    },
    subhead: {
      en: "indie · zine",
      zh: "独立 · 刊物",
      "zh-TW": "獨立 · 刊物",
      ja: "インディー · ZINE",
      ko: "인디 · 진",
    },
    oneLiner: {
      en: "Cream paper with green Riso accents, Bebas + Caveat, and lo-fi printed-zine vibes — for indie zines, music labels, and small-batch crafts.",
      zh: "米色纸 + 绿色 Riso 点缀 + Bebas + Caveat 手写,Riso 印刷感,适合独立 zine / 音乐厂牌 / 小批量手作",
      "zh-TW": "米色紙 + 綠色 Riso 點綴 + Bebas + Caveat 手寫,Riso 印刷感,適合獨立 zine / 音樂廠牌 / 小批量手作",
      ja: "クリーム紙にグリーンのリソ + Bebas + Caveat。リソ印刷の質感。インディー ZINE、音楽レーベル、小ロット手作りに。",
      ko: "크림 페이퍼 + 그린 리소 + Bebas + Caveat. 리소 프린트 질감. 인디 진 / 음악 레이블 / 스몰 배치 핸드메이드에 적합.",
    },
  },
  {
    slug: "sakura-chroma",
    niche: "复古",
    recommendedCount: 10,
    name: {
      en: "Sakura Chroma",
      zh: "Sakura Chroma·复古日系",
      "zh-TW": "Sakura Chroma·復古日系",
      ja: "Sakura Chroma·レトロ和ハードウェア",
      ko: "Sakura Chroma·레트로 일본",
    },
    headline: {
      en: "Sakura Chroma",
      zh: "复古日系",
      "zh-TW": "復古日系",
      ja: "和ハードウェア",
      ko: "레트로 일본",
    },
    subhead: {
      en: "JP retro · hardware",
      zh: "日系 · 硬件",
      "zh-TW": "日系 · 硬體",
      ja: "和 · ハード",
      ko: "일본 · 하드웨어",
    },
    oneLiner: {
      en: "Cream base with rainbow ribbons, condensed bold type, and JIS-style spec tables — for retro Japanese hardware, music labels, and studio annuals.",
      zh: "米底 + 斜彩虹绶带 + 紧缩粗体 + JIS 复选规格表,适合复古日系硬件 / 音乐厂牌 / 工作室年刊",
      "zh-TW": "米底 + 斜彩虹綬帶 + 緊縮粗體 + JIS 複選規格表,適合復古日系硬體 / 音樂廠牌 / 工作室年刊",
      ja: "クリーム地に斜めレインボーリボン、コンデンス太字、JIS スタイルのスペック表。レトロ日系ハードウェア、音楽レーベル、スタジオ年鑑に。",
      ko: "크림 베이스 + 사선 무지개 리본 + 콘덴스 볼드 + JIS 스타일 스펙 표. 레트로 일본 하드웨어 / 음악 레이블 / 스튜디오 연감에 적합.",
    },
  },
  {
    slug: "daisy-days",
    niche: "生活",
    recommendedCount: 10,
    name: {
      en: "Daisy Days",
      zh: "Daisy Days·治愈手绘",
      "zh-TW": "Daisy Days·治癒手繪",
      ja: "Daisy Days·癒しの手描き",
      ko: "Daisy Days·힐링 핸드드로우",
    },
    headline: {
      en: "Daisy Days",
      zh: "治愈手绘",
      "zh-TW": "治癒手繪",
      ja: "癒しの手描き",
      ko: "힐링 핸드드로우",
    },
    subhead: {
      en: "education · wellness",
      zh: "教育 · 健康",
      "zh-TW": "教育 · 健康",
      ja: "教育 · ウェルネス",
      ko: "교육 · 웰니스",
    },
    oneLiner: {
      en: "Cheerful pastels with hand-drawn daisies, stars, and rainbows — for education, kids' products, wellness programs, and community workshops.",
      zh: "粉嫩 pastel + 手绘雏菊星星彩虹,温暖治愈,适合教育 / 儿童 / 健康项目 / 社区工作坊",
      "zh-TW": "粉嫩 pastel + 手繪雛菊星星彩虹,溫暖治癒,適合教育 / 兒童 / 健康項目 / 社區工作坊",
      ja: "パステル + 手描きデイジー、星、虹。教育、こども向け、ウェルネス、コミュニティワークショップに。",
      ko: "파스텔 + 핸드드로우 데이지, 별, 무지개. 교육 / 키즈 / 웰니스 프로그램 / 커뮤니티 워크숍에 적합.",
    },
  },
  {
    slug: "playful",
    niche: "生活",
    recommendedCount: 10,
    name: {
      en: "Playful",
      zh: "Playful·阳光独立",
      "zh-TW": "Playful·陽光獨立",
      ja: "Playful·明るくインディー",
      ko: "Playful·선샤인 인디",
    },
    headline: {
      en: "Playful",
      zh: "阳光独立",
      "zh-TW": "陽光獨立",
      ja: "明るく",
      ko: "선샤인",
    },
    subhead: {
      en: "creator · indie",
      zh: "创作者 · 独立",
      "zh-TW": "創作者 · 獨立",
      ja: "クリエイター · インディー",
      ko: "크리에이터 · 인디",
    },
    oneLiner: {
      en: "Sunny peach base with Syne display type — friendly, indie, and warm. For creator portfolios, indie products, and small businesses.",
      zh: "阳光桃色底 + Syne 显示字体,友好独立,适合创作者作品集 / 独立产品 / 小生意",
      "zh-TW": "陽光桃色底 + Syne 顯示字體,友好獨立,適合創作者作品集 / 獨立產品 / 小生意",
      ja: "サンシャイン・ピーチ + Syne ディスプレイ書体。フレンドリーでインディーな温かさ。クリエイターポートフォリオ、インディー製品、小ビジネスに。",
      ko: "선샤인 피치 + Syne 디스플레이 폰트. 친근하고 인디한 따뜻함. 크리에이터 포트폴리오 / 인디 프로덕트 / 스몰 비즈니스에 적합.",
    },
  },
  {
    slug: "scatterbrain",
    niche: "生活",
    recommendedCount: 10,
    name: {
      en: "Scatterbrain",
      zh: "Scatterbrain·便利贴白板",
      "zh-TW": "Scatterbrain·便條白板",
      ja: "Scatterbrain·付箋ボード",
      ko: "Scatterbrain·포스트잇 보드",
    },
    headline: {
      en: "Scatterbrain",
      zh: "便利贴板",
      "zh-TW": "便條板",
      ja: "付箋ボード",
      ko: "포스트잇 보드",
    },
    subhead: {
      en: "workshop · brainstorm",
      zh: "工坊 · 头脑风暴",
      "zh-TW": "工坊 · 腦力激盪",
      ja: "WS · ブレスト",
      ko: "워크숍 · 브레인스토밍",
    },
    oneLiner: {
      en: "Corkboard backdrop with pastel sticky notes, Caveat handwriting, and Shrikhand display — for brainstorms, workshops, and design thinking.",
      zh: "软木板底 + pastel 便利贴 + Caveat 手写 + Shrikhand 标题,适合头脑风暴 / 工作坊 / 设计思维",
      "zh-TW": "軟木板底 + pastel 便條 + Caveat 手寫 + Shrikhand 標題,適合腦力激盪 / 工作坊 / 設計思維",
      ja: "コルクボードに付箋、Caveat 手書き、Shrikhand 見出し。ブレスト、ワークショップ、デザイン思考に。",
      ko: "코르크 보드 + 파스텔 포스트잇 + Caveat 손글씨 + Shrikhand 타이틀. 브레인스토밍 / 워크숍 / 디자인 씽킹에 적합.",
    },
  },
  {
    slug: "pin-and-paper",
    niche: "生活",
    recommendedCount: 10,
    name: {
      en: "Pin & Paper",
      zh: "Pin & Paper·便签别针",
      "zh-TW": "Pin & Paper·便箋別針",
      ja: "Pin & Paper·ピンとメモ",
      ko: "Pin & Paper·핀 앤 페이퍼",
    },
    headline: {
      en: "Pin & Paper",
      zh: "便签别针",
      "zh-TW": "便箋別針",
      ja: "ピン & メモ",
      ko: "핀 앤 페이퍼",
    },
    subhead: {
      en: "research · field notes",
      zh: "研究 · 田野",
      "zh-TW": "研究 · 田野",
      ja: "リサーチ · フィールド",
      ko: "리서치 · 필드 노트",
    },
    oneLiner: {
      en: "Yellow paper canvas with safety-pin illustrations and Caveat blue ink — for qualitative research, founder essays, and workshop recaps.",
      zh: "黄纸底 + 安全别针插画 + Caveat 蓝墨手写,适合定性研究 / 创始人随笔 / 工作坊回顾",
      "zh-TW": "黃紙底 + 安全別針插畫 + Caveat 藍墨手寫,適合定性研究 / 創辦人隨筆 / 工作坊回顧",
      ja: "イエローペーパー + 安全ピンのイラスト + Caveat ブルーインク。定性調査、創業者エッセイ、ワークショップ振り返りに。",
      ko: "옐로우 페이퍼 + 안전핀 일러스트 + Caveat 블루 잉크. 정성 연구 / 창업자 에세이 / 워크숍 회고에 적합.",
    },
  },

  // ════════════ 商务 / 投资(3 个)════════════
  {
    slug: "blue-professional",
    niche: "商务",
    recommendedCount: 10,
    name: {
      en: "Blue Professional",
      zh: "Blue Professional·钴蓝商务",
      "zh-TW": "Blue Professional·鈷藍商務",
      ja: "Blue Professional·コバルトブルー",
      ko: "Blue Professional·코발트 블루",
    },
    headline: {
      en: "Blue Professional",
      zh: "钴蓝商务",
      "zh-TW": "鈷藍商務",
      ja: "コバルトブルー",
      ko: "코발트 블루",
    },
    subhead: {
      en: "B2B · consulting",
      zh: "B2B · 咨询",
      "zh-TW": "B2B · 顧問",
      ja: "B2B · 戦略コンサル",
      ko: "B2B · 컨설팅",
    },
    oneLiner: {
      en: "Cream paper with electric cobalt accents — clean modern professional. For B2B SaaS pitches, consulting deliverables, and advisory updates.",
      zh: "米白底 + 电光钴蓝点缀,clean modern,适合 B2B SaaS / 咨询交付 / 投资人更新",
      "zh-TW": "米白底 + 電光鈷藍點綴,clean modern,適合 B2B SaaS / 顧問交付 / 投資人更新",
      ja: "クリーム紙 + 電光コバルトブルー。クリーンでモダンなプロ感。B2B SaaS、コンサル納品、アドバイザー報告に。",
      ko: "크림 페이퍼 + 일렉트릭 코발트. 클린 모던 프로페셔널. B2B SaaS / 컨설팅 산출물 / 어드바이저 업데이트에 적합.",
    },
  },
  {
    slug: "signal",
    niche: "商务",
    recommendedCount: 12,
    name: {
      en: "Signal · Institutional",
      zh: "Signal·机构旗舰",
      "zh-TW": "Signal·機構旗艦",
      ja: "Signal·インスティテューショナル",
      ko: "Signal·인스티튜셔널",
    },
    headline: {
      en: "Signal",
      zh: "机构旗舰",
      "zh-TW": "機構旗艦",
      ja: "インスティ",
      ko: "인스티튜셔널",
    },
    subhead: {
      en: "investor · board",
      zh: "投资 · 董事会",
      "zh-TW": "投資 · 董事會",
      ja: "投資家 · 取締役会",
      ko: "투자자 · 이사회",
    },
    oneLiner: {
      en: "Deep navy with bone white and dark gold — institutional gravitas. For investor decks, board presentations, consulting deliverables, and policy briefs.",
      zh: "深海军蓝 + 骨白 + 暗金,机构感强,适合投资人 / 董事会 / 咨询交付 / 法律政策",
      "zh-TW": "深海軍藍 + 骨白 + 暗金,機構感強,適合投資人 / 董事會 / 顧問交付 / 法律政策",
      ja: "ディープネイビー + ボーンホワイト + ダークゴールド。機関級の重厚感。投資家ピッチ、取締役会、コンサル納品、政策ブリーフに。",
      ko: "딥 네이비 + 본 화이트 + 다크 골드. 기관급 무게감. 투자자 덱 / 이사회 / 컨설팅 산출물 / 정책 브리프에 적합.",
    },
  },
  {
    slug: "monochrome",
    niche: "商务",
    recommendedCount: 12,
    name: {
      en: "Monochrome · Long Document",
      zh: "Monochrome·长文档黑白",
      "zh-TW": "Monochrome·長文檔黑白",
      ja: "Monochrome·モノクロ長文",
      ko: "Monochrome·모노크롬 롱폼",
    },
    headline: {
      en: "Monochrome",
      zh: "黑白长文",
      "zh-TW": "黑白長文",
      ja: "モノクロ",
      ko: "모노크롬",
    },
    subhead: {
      en: "research · whitepaper",
      zh: "研究 · 白皮书",
      "zh-TW": "研究 · 白皮書",
      ja: "研究 · ホワイトペーパー",
      ko: "리서치 · 화이트페이퍼",
    },
    oneLiner: {
      en: "Ivory base with all-black type, Lora + Jost, no color — for user research, white papers, academic decks, and bilingual long-form.",
      zh: "象牙底 + 全黑字 + Lora + Jost 字体,无彩色,16 种 layout,适合用研报告 / 白皮书 / 学术 / 政策 / 双语长文",
      "zh-TW": "象牙底 + 全黑字 + Lora + Jost 字體,無彩色,16 種 layout,適合用研報告 / 白皮書 / 學術 / 政策 / 雙語長文",
      ja: "アイボリーベース + 全黒テキスト + Lora + Jost。色なし、16 種レイアウト。ユーザーリサーチ、白書、学術、政策、二言語長文に。",
      ko: "아이보리 베이스 + 올블랙 타이포 + Lora + Jost. 무채색, 16 종 레이아웃. UX 리서치 / 화이트페이퍼 / 학술 / 정책 / 이중언어 롱폼에 적합.",
    },
  },

  // ════════════ 杂志 / Editorial(7 个)════════════
  {
    slug: "soft-editorial",
    niche: "编辑",
    recommendedCount: 10,
    name: {
      en: "Soft Editorial",
      zh: "Soft Editorial·柔和文学",
      "zh-TW": "Soft Editorial·柔和文學",
      ja: "Soft Editorial·柔らかな文学",
      ko: "Soft Editorial·소프트 문학",
    },
    headline: {
      en: "Soft Editorial",
      zh: "柔和文学",
      "zh-TW": "柔和文學",
      ja: "柔らかな文学",
      ko: "소프트 문학",
    },
    subhead: {
      en: "magazine · feature",
      zh: "杂志 · 专题",
      "zh-TW": "雜誌 · 專題",
      ja: "雑誌 · 特集",
      ko: "매거진 · 피처",
    },
    oneLiner: {
      en: "Cormorant Garamond serif with warm paper and sage / blush / lemon — for magazine features, brand long stories, and gallery decks.",
      zh: "Cormorant Garamond 衬线 + 暖纸 + 鼠尾草 / 腮红 / 柠檬,适合杂志专题 / 品牌长故事 / 画廊博物馆",
      "zh-TW": "Cormorant Garamond 襯線 + 暖紙 + 鼠尾草 / 腮紅 / 檸檬,適合雜誌專題 / 品牌長故事 / 畫廊博物館",
      ja: "Cormorant Garamond セリフ + 暖紙 + セージ / ブラッシュ / レモン。雑誌特集、ブランド長文、ギャラリーに。",
      ko: "Cormorant Garamond 세리프 + 웜 페이퍼 + 세이지 / 블러시 / 레몬. 매거진 피처 / 브랜드 롱폼 / 갤러리에 적합.",
    },
  },
  {
    slug: "editorial-tri-tone",
    niche: "编辑",
    recommendedCount: 10,
    name: {
      en: "Editorial Tri-Tone",
      zh: "Editorial Tri-Tone·三色编辑",
      "zh-TW": "Editorial Tri-Tone·三色編輯",
      ja: "Editorial Tri-Tone·トリトーン編集",
      ko: "Editorial Tri-Tone·트라이톤 에디토리얼",
    },
    headline: {
      en: "Editorial Tri-Tone",
      zh: "三色编辑",
      "zh-TW": "三色編輯",
      ja: "トリトーン",
      ko: "트라이톤",
    },
    subhead: {
      en: "fashion · lifestyle",
      zh: "时尚 · 生活",
      "zh-TW": "時尚 · 生活",
      ja: "ファッション · ライフ",
      ko: "패션 · 라이프",
    },
    oneLiner: {
      en: "Three-color editorial system: dusty pink, mustard cream, deep burgundy — Bricolage + Instrument Serif. For fashion brands, lifestyle media, and editorial direction.",
      zh: "灰粉 / 芥末奶油 / 勃艮第三色 + Bricolage + Instrument Serif,适合时尚品牌 / 生活媒体 / 艺术总监",
      "zh-TW": "灰粉 / 芥末奶油 / 勃艮第三色 + Bricolage + Instrument Serif,適合時尚品牌 / 生活媒體 / 藝術總監",
      ja: "ダスティピンク / マスタードクリーム / バーガンディの三色編集 + Bricolage + Instrument Serif。ファッションブランド、ライフスタイルメディア、アートディレクションに。",
      ko: "더스티 핑크 / 머스터드 크림 / 버건디 트라이톤 + Bricolage + Instrument Serif. 패션 브랜드 / 라이프스타일 미디어 / 아트 디렉션에 적합.",
    },
  },
  {
    slug: "broadside",
    niche: "编辑",
    recommendedCount: 12,
    name: {
      en: "Broadside",
      zh: "Broadside·暗黑双语报",
      "zh-TW": "Broadside·暗黑雙語報",
      ja: "Broadside·ダーク二言語報",
      ko: "Broadside·다크 이중언어",
    },
    headline: {
      en: "Broadside",
      zh: "暗黑双语",
      "zh-TW": "暗黑雙語",
      ja: "ダーク二言語",
      ko: "다크 이중언어",
    },
    subhead: {
      en: "manifesto · bilingual",
      zh: "宣言 · 双语",
      "zh-TW": "宣言 · 雙語",
      ja: "マニフェスト · 二言語",
      ko: "매니페스토 · 이중언어",
    },
    oneLiner: {
      en: "Dark editorial canvas with fire-orange accent and bilingual Latin/Chinese type stack — for brand manifestos, founder visions, and cultural pitches.",
      zh: "暗黑报纸版式 + 火橙强调 + 中英双语字体栈,适合中英双语 deck / 品牌宣言 / 设计演讲",
      "zh-TW": "暗黑報紙版式 + 火橙強調 + 中英雙語字體棧,適合中英雙語 deck / 品牌宣言 / 設計演講",
      ja: "ダークエディトリアル + ファイアオレンジアクセント + 漢字 / Latin 二言語タイポ。ブランドマニフェスト、創業者ビジョン、文化発信に。",
      ko: "다크 에디토리얼 + 파이어 오렌지 + 한자/라틴 이중언어 타이포. 브랜드 매니페스토 / 창업자 비전 / 문화 발신에 적합.",
    },
  },
  {
    slug: "cartesian",
    niche: "编辑",
    recommendedCount: 10,
    name: {
      en: "Cartesian",
      zh: "Cartesian·古典衬线",
      "zh-TW": "Cartesian·古典襯線",
      ja: "Cartesian·クラシックセリフ",
      ko: "Cartesian·클래식 세리프",
    },
    headline: {
      en: "Cartesian",
      zh: "古典衬线",
      "zh-TW": "古典襯線",
      ja: "クラシック",
      ko: "클래식",
    },
    subhead: {
      en: "thesis · whitepaper",
      zh: "论文 · 白皮书",
      "zh-TW": "論文 · 白皮書",
      ja: "論文 · 白書",
      ko: "논문 · 화이트페이퍼",
    },
    oneLiner: {
      en: "Quiet warm-neutral palette with classical Playfair serifs — tasteful and unhurried. For investment theses, white papers, advisory deliverables.",
      zh: "暖中性色 + Playfair 衬线,quiet & elegant,适合投资白皮书 / 咨询交付 / 长文研究",
      "zh-TW": "暖中性色 + Playfair 襯線,quiet & elegant,適合投資白皮書 / 顧問交付 / 長文研究",
      ja: "暖系ニュートラルとクラシカルな Playfair セリフ。控えめで品のある。投資テーゼ、ホワイトペーパー、コンサル納品に。",
      ko: "웜 뉴트럴 + 클래식 Playfair 세리프. 절제된 우아함. 투자 테제 / 화이트페이퍼 / 컨설팅 산출물에 적합.",
    },
  },
  {
    slug: "vellum",
    niche: "编辑",
    recommendedCount: 10,
    name: {
      en: "Vellum",
      zh: "Vellum·学术深蓝",
      "zh-TW": "Vellum·學術深藍",
      ja: "Vellum·学術ディープブルー",
      ko: "Vellum·아카데믹 딥블루",
    },
    headline: {
      en: "Vellum",
      zh: "学术深蓝",
      "zh-TW": "學術深藍",
      ja: "学術深ブルー",
      ko: "아카데믹 딥블루",
    },
    subhead: {
      en: "research · policy",
      zh: "研究 · 政策",
      "zh-TW": "研究 · 政策",
      ja: "研究 · 政策",
      ko: "리서치 · 정책",
    },
    oneLiner: {
      en: "Deep navy with warm yellow italic Cormorant and dark teal accents — academic. For research overviews, white papers, policy briefs.",
      zh: "深海军蓝 + 暖黄斜体 Cormorant + 暗青强调,学术,适合研究综述 / 白皮书 / 学术 / 政策简报",
      "zh-TW": "深海軍藍 + 暖黃斜體 Cormorant + 暗青強調,學術,適合研究綜述 / 白皮書 / 學術 / 政策簡報",
      ja: "ディープネイビー + 暖イエローのイタリック Cormorant + ダークティール。学術調。研究レビュー、白書、政策ブリーフに。",
      ko: "딥 네이비 + 웜 옐로 이탈릭 Cormorant + 다크 틸. 학술 톤. 연구 리뷰 / 화이트페이퍼 / 정책 브리프에 적합.",
    },
  },
  {
    slug: "cobalt-grid",
    niche: "编辑",
    recommendedCount: 10,
    name: {
      en: "Cobalt Grid",
      zh: "Cobalt Grid·钴蓝方格",
      "zh-TW": "Cobalt Grid·鈷藍方格",
      ja: "Cobalt Grid·コバルトグリッド",
      ko: "Cobalt Grid·코발트 그리드",
    },
    headline: {
      en: "Cobalt Grid",
      zh: "钴蓝方格",
      "zh-TW": "鈷藍方格",
      ja: "コバルトグリッド",
      ko: "코발트 그리드",
    },
    subhead: {
      en: "studio bulletin",
      zh: "工作室公报",
      "zh-TW": "工作室公報",
      ja: "スタジオ公報",
      ko: "스튜디오 공보",
    },
    oneLiner: {
      en: "Electric cobalt italic serifs on graph paper with stair-stepped pixel-glitch decorations — for design research bulletins and studio annuals.",
      zh: "钴蓝斜体衬线 + 方格纸底 + 像素故障装饰 + 细线规则,适合设计研究公报 / 工作室年报 / 趋势报告",
      "zh-TW": "鈷藍斜體襯線 + 方格紙底 + 像素故障裝飾 + 細線規則,適合設計研究公報 / 工作室年報 / 趨勢報告",
      ja: "コバルトのイタリックセリフ + 方眼紙ベース + 階段状のピクセルグリッチ装飾。デザイン研究公報、スタジオ年鑑、トレンドレポートに。",
      ko: "코발트 이탈릭 세리프 + 그리드 페이퍼 + 픽셀 글리치 데코. 디자인 리서치 공보 / 스튜디오 연감 / 트렌드 리포트에 적합.",
    },
  },
  {
    slug: "stencil-tablet",
    niche: "编辑",
    recommendedCount: 10,
    name: {
      en: "Stencil Tablet",
      zh: "Stencil Tablet·镂空考古",
      "zh-TW": "Stencil Tablet·鏤空考古",
      ja: "Stencil Tablet·ステンシル考古",
      ko: "Stencil Tablet·스텐실 고고학",
    },
    headline: {
      en: "Stencil Tablet",
      zh: "镂空考古",
      "zh-TW": "鏤空考古",
      ja: "ステンシル",
      ko: "스텐실",
    },
    subhead: {
      en: "museum · archive",
      zh: "博物馆 · 档案",
      "zh-TW": "博物館 · 檔案",
      ja: "博物館 · アーカイブ",
      ko: "박물관 · 아카이브",
    },
    oneLiner: {
      en: "Bone white with stencil display titles and 6-color earth palette — archaeological vibe. For museum decks, art / architecture, and longform research.",
      zh: "骨白 + 镂空字标题 + 6 色大地色,考古风,适合博物馆 / 艺术建筑 / 长文研究 / 手作品牌",
      "zh-TW": "骨白 + 鏤空字標題 + 6 色大地色,考古風,適合博物館 / 藝術建築 / 長文研究 / 手作品牌",
      ja: "ボーンホワイト + ステンシル見出し + 6 色アースパレット。考古調。博物館、美術 / 建築、長文研究、手作りブランドに。",
      ko: "본 화이트 + 스텐실 헤드라인 + 6 색 어스 팔레트. 고고학 톤. 박물관 / 미술 / 건축 / 롱폼 리서치 / 핸드메이드 브랜드에 적합.",
    },
  },

  // ════════════ 创意 / 工作室(6 个)════════════
  {
    slug: "studio",
    niche: "创意",
    recommendedCount: 10,
    name: {
      en: "Studio · Black & Yellow",
      zh: "Studio·黑底电光黄",
      "zh-TW": "Studio·黑底電光黃",
      ja: "Studio·ブラック&電光イエロー",
      ko: "Studio·블랙&일렉트릭 옐로우",
    },
    headline: {
      en: "Studio",
      zh: "黑底电光黄",
      "zh-TW": "黑底電光黃",
      ja: "ブラック&イエロー",
      ko: "블랙&옐로우",
    },
    subhead: {
      en: "studio · agency",
      zh: "工作室 · 机构",
      "zh-TW": "工作室 · 機構",
      ja: "スタジオ · エージェンシー",
      ko: "스튜디오 · 에이전시",
    },
    oneLiner: {
      en: "Black canvas with electric yellow type — high contrast design-studio vibes. For design studios, creative agencies, and brand showcases.",
      zh: "黑底 + 电光黄字,高对比设计工作室感,适合设计工作室 / 创意机构 / 品牌秀 / 时尚",
      "zh-TW": "黑底 + 電光黃字,高對比設計工作室感,適合設計工作室 / 創意機構 / 品牌秀 / 時尚",
      ja: "ブラック背景に電光イエローテキスト。高コントラストなデザインスタジオ感。デザインスタジオ、クリエイティブエージェンシー、ブランドショーケースに。",
      ko: "블랙 배경 + 일렉트릭 옐로우. 하이 콘트라스트 디자인 스튜디오 톤. 디자인 스튜디오 / 크리에이티브 에이전시 / 브랜드 쇼케이스에 적합.",
    },
  },
  {
    slug: "mat",
    niche: "创意",
    recommendedCount: 10,
    name: {
      en: "Mat · Mid-Century",
      zh: "Mat·中世纪现代",
      "zh-TW": "Mat·中世紀現代",
      ja: "Mat·ミッドセンチュリー",
      ko: "Mat·미드센추리",
    },
    headline: {
      en: "Mat",
      zh: "中世纪现代",
      "zh-TW": "中世紀現代",
      ja: "ミッドセンチュリー",
      ko: "미드센추리",
    },
    subhead: {
      en: "studio · architecture",
      zh: "设计 · 建筑",
      "zh-TW": "設計 · 建築",
      ja: "デザイン · 建築",
      ko: "디자인 · 건축",
    },
    oneLiner: {
      en: "Deep sage green with bone white and burnt orange — mid-century modern. For design studios, architecture / interior, and ceramics / furniture.",
      zh: "深鼠尾草绿 + 骨白 + 烧橙,中世纪现代,适合设计工作室 / 建筑室内 / 陶艺家具",
      "zh-TW": "深鼠尾草綠 + 骨白 + 燒橙,中世紀現代,適合設計工作室 / 建築室內 / 陶藝家具",
      ja: "ディープセージグリーン + ボーンホワイト + バーントオレンジ。ミッドセンチュリーモダン。デザインスタジオ、建築 / インテリア、陶芸 / 家具に。",
      ko: "딥 세이지 그린 + 본 화이트 + 번트 오렌지. 미드센추리 모던. 디자인 스튜디오 / 건축 / 인테리어 / 도예 / 가구에 적합.",
    },
  },
  {
    slug: "creative-mode",
    niche: "创意",
    recommendedCount: 10,
    name: {
      en: "Creative Mode",
      zh: "Creative Mode·四色创意",
      "zh-TW": "Creative Mode·四色創意",
      ja: "Creative Mode·四色クリエイティブ",
      ko: "Creative Mode·4 컬러 크리에이티브",
    },
    headline: {
      en: "Creative Mode",
      zh: "四色创意",
      "zh-TW": "四色創意",
      ja: "四色クリエイティブ",
      ko: "4 컬러 크리에이티브",
    },
    subhead: {
      en: "agency · campaign",
      zh: "机构 · 活动",
      "zh-TW": "機構 · 活動",
      ja: "エージェンシー · キャンペーン",
      ko: "에이전시 · 캠페인",
    },
    oneLiner: {
      en: "Cream paper with confident multi-color (green / pink / orange / yellow) accents and Archivo Black display — for creative agencies and design studios.",
      zh: "米白 + 绿 / 粉 / 橙 / 黄四色 + Archivo Black,适合创意机构 / 设计工作室 / 广告公司",
      "zh-TW": "米白 + 綠 / 粉 / 橘 / 黃四色 + Archivo Black,適合創意機構 / 設計工作室 / 廣告公司",
      ja: "クリーム紙にグリーン / ピンク / オレンジ / イエロー + Archivo Black 太字。クリエイティブエージェンシー、デザインスタジオ、広告会社に。",
      ko: "크림 페이퍼 + 그린 / 핑크 / 오렌지 / 옐로우 4 컬러 + Archivo Black. 크리에이티브 에이전시 / 디자인 스튜디오 / 광고 회사에 적합.",
    },
  },
  {
    slug: "raw-grid",
    niche: "创意",
    recommendedCount: 10,
    name: {
      en: "Raw Grid",
      zh: "Raw Grid·新粗野网格",
      "zh-TW": "Raw Grid·新粗野網格",
      ja: "Raw Grid·ニューブルータリズム・グリッド",
      ko: "Raw Grid·로우 그리드",
    },
    headline: {
      en: "Raw Grid",
      zh: "新粗野网格",
      "zh-TW": "新粗野網格",
      ja: "ロウグリッド",
      ko: "로우 그리드",
    },
    subhead: {
      en: "startup · demo day",
      zh: "创业 · demo",
      "zh-TW": "創業 · demo",
      ja: "スタートアップ · デモ",
      ko: "스타트업 · 데모데이",
    },
    oneLiner: {
      en: "Pink / sage / ink with thick borders and offset shadows — neo-brutalist startup vibes. For startup pitches, accelerator demos, indie launches.",
      zh: "粉 / 鼠尾草 / 墨色 + 厚边框 + 偏移阴影,新粗野感,适合创业 pitch / 加速器 demo day / 独立发布",
      "zh-TW": "粉 / 鼠尾草 / 墨色 + 厚邊框 + 偏移陰影,新粗野感,適合創業 pitch / 加速器 demo day / 獨立發布",
      ja: "ピンク / セージ / インクに厚い枠とオフセットシャドウ。ニューブルータリズム調。スタートアップピッチ、アクセラレーターのデモデイ、インディーローンチに。",
      ko: "핑크 / 세이지 / 잉크 + 두꺼운 보더 + 오프셋 섀도. 네오 브루탈리즘. 스타트업 피칭 / 액셀러레이터 데모데이 / 인디 런칭에 적합.",
    },
  },
  {
    slug: "neo-grid-bold",
    niche: "创意",
    recommendedCount: 10,
    name: {
      en: "Neo Grid Bold",
      zh: "Neo Grid Bold·霓虹黄网格",
      "zh-TW": "Neo Grid Bold·霓虹黃網格",
      ja: "Neo Grid Bold·ネオングリッド",
      ko: "Neo Grid Bold·네온 그리드",
    },
    headline: {
      en: "Neo Grid Bold",
      zh: "霓虹黄网格",
      "zh-TW": "霓虹黃網格",
      ja: "ネオングリッド",
      ko: "네온 그리드",
    },
    subhead: {
      en: "product · launch",
      zh: "产品 · 发布",
      "zh-TW": "產品 · 發布",
      ja: "プロダクト · 発表",
      ko: "프로덕트 · 런칭",
    },
    oneLiner: {
      en: "Cream paper with single neon yellow accent — neo-brutalist editorial. For product launches, design reviews, founder talks.",
      zh: "米黄底 + 单一霓虹黄,新粗野 editorial,适合产品发布 / 设计评审 / 创始人演讲",
      "zh-TW": "米黃底 + 單一霓虹黃,新粗野 editorial,適合產品發布 / 設計評審 / 創辦人演講",
      ja: "クリームベースに単一のネオンイエロー。ニューブルータリズム editorial。プロダクトローンチ、デザインレビュー、創業者トークに。",
      ko: "크림 베이스 + 단일 네온 옐로우. 네오 브루탈리즘 에디토리얼. 프로덕트 런칭 / 디자인 리뷰 / 창업자 토크에 적합.",
    },
  },
  {
    slug: "block-frame",
    niche: "创意",
    recommendedCount: 10,
    name: {
      en: "BlockFrame",
      zh: "BlockFrame·色块拼贴",
      "zh-TW": "BlockFrame·色塊拼貼",
      ja: "BlockFrame·カラーブロック",
      ko: "BlockFrame·블록 프레임",
    },
    headline: {
      en: "BlockFrame",
      zh: "色块拼贴",
      "zh-TW": "色塊拼貼",
      ja: "ブロック",
      ko: "블록 프레임",
    },
    subhead: {
      en: "agency · indie",
      zh: "机构 · 独立",
      "zh-TW": "機構 · 獨立",
      ja: "エージェンシー · インディー",
      ko: "에이전시 · 인디",
    },
    oneLiner: {
      en: "Neobrutalist with pastel-neon color blocks and chunky black borders — for creative agencies, indie SaaS launches, designer portfolios, brand redesigns.",
      zh: "新粗野主义 + 粉 / 青 / 黄色块 + 黑粗边,适合创意机构 / 独立 SaaS / 品牌重塑",
      "zh-TW": "新粗野主義 + 粉 / 青 / 黃色塊 + 黑粗邊,適合創意機構 / 獨立 SaaS / 品牌重塑",
      ja: "ニューブルータリズム + パステルネオンの色面 + 太い黒枠。クリエイティブエージェンシー、インディー SaaS、ブランドリブランドに。",
      ko: "네오 브루탈리즘 + 파스텔 네온 색면 + 굵은 블랙 보더. 크리에이티브 에이전시 / 인디 SaaS / 브랜드 리디자인에 적합.",
    },
  },

  // ════════════ 品牌 / 生活方式(5 个)════════════
  {
    slug: "capsule",
    niche: "品牌",
    recommendedCount: 10,
    name: {
      en: "Capsule",
      zh: "Capsule·胶囊模块",
      "zh-TW": "Capsule·膠囊模組",
      ja: "Capsule·カプセル",
      ko: "Capsule·캡슐",
    },
    headline: {
      en: "Capsule",
      zh: "胶囊模块",
      "zh-TW": "膠囊模組",
      ja: "カプセル",
      ko: "캡슐",
    },
    subhead: {
      en: "DTC · creator",
      zh: "DTC · 创作者",
      "zh-TW": "DTC · 創作者",
      ja: "DTC · クリエイター",
      ko: "DTC · 크리에이터",
    },
    oneLiner: {
      en: "Modular pill-shaped cards on warm bone with full pastel-pop palette — for lifestyle brands, creator portfolios, DTC launches, wellness pitches.",
      zh: "暖米底 + pastel 胶囊卡片,Y2K 模块感,适合生活方式品牌 / 创作者作品集 / DTC 产品发布",
      "zh-TW": "暖米底 + pastel 膠囊卡片,Y2K 模組感,適合生活方式品牌 / 創作者作品集 / DTC 產品發布",
      ja: "ウォームボーンにモジュラーなピル型カード + フルパステルポップ。ライフスタイルブランド、クリエイターポートフォリオ、DTC ローンチ、ウェルネスに。",
      ko: "웜 본 베이스 + 모듈러 필 카드 + 풀 파스텔 팝. 라이프스타일 브랜드 / 크리에이터 포트폴리오 / DTC 런칭 / 웰니스 피칭에 적합.",
    },
  },
  {
    slug: "coral",
    niche: "品牌",
    recommendedCount: 10,
    name: {
      en: "Coral",
      zh: "Coral·珊瑚奶油",
      "zh-TW": "Coral·珊瑚奶油",
      ja: "Coral·コーラル&クリーム",
      ko: "Coral·코랄&크림",
    },
    headline: {
      en: "Coral",
      zh: "珊瑚奶油",
      "zh-TW": "珊瑚奶油",
      ja: "コーラル",
      ko: "코랄",
    },
    subhead: {
      en: "fashion · wellness",
      zh: "时尚 · 健身",
      "zh-TW": "時尚 · 健身",
      ja: "ファッション · ウェルネス",
      ko: "패션 · 웰니스",
    },
    oneLiner: {
      en: "Cream and coral on near-black, oversized Bebas Neue — for fashion / beauty pitches, fitness brands, F&B decks, lifestyle launches.",
      zh: "近黑底 + 米色 + 珊瑚色 + Bebas Neue 大字,适合时尚 / 美容 / 健身 / 餐饮 / 生活方式",
      "zh-TW": "近黑底 + 米色 + 珊瑚色 + Bebas Neue 大字,適合時尚 / 美容 / 健身 / 餐飲 / 生活方式",
      ja: "近ブラックにクリームとコーラル、特大の Bebas Neue。ファッション / ビューティー、フィットネス、F&B、ライフスタイルに。",
      ko: "니어 블랙 + 크림 + 코랄 + 오버사이즈 Bebas Neue. 패션 / 뷰티 / 피트니스 / F&B / 라이프스타일에 적합.",
    },
  },
  {
    slug: "grove",
    niche: "品牌",
    recommendedCount: 10,
    name: {
      en: "Grove",
      zh: "Grove·森绿铁锈",
      "zh-TW": "Grove·森綠鐵鏽",
      ja: "Grove·フォレストグリーン",
      ko: "Grove·포레스트 그린",
    },
    headline: {
      en: "Grove",
      zh: "森绿铁锈",
      "zh-TW": "森綠鐵鏽",
      ja: "フォレスト",
      ko: "포레스트",
    },
    subhead: {
      en: "sustainability · winery",
      zh: "可持续 · 酒庄",
      "zh-TW": "永續 · 酒莊",
      ja: "サステナ · ワイナリー",
      ko: "서스테이너빌리티 · 와이너리",
    },
    oneLiner: {
      en: "Forest-green canvas with cream type, classical Playfair, and a single rust accent — for sustainability, wellness, outdoors, wineries.",
      zh: "深森林绿 + 米色字 + Playfair 衬线 + 单一铁锈红,适合可持续 / 户外品牌 / 酒庄 / 文学艺术",
      "zh-TW": "深森林綠 + 米色字 + Playfair 襯線 + 單一鐵鏽紅,適合永續 / 戶外品牌 / 酒莊 / 文學藝術",
      ja: "ディープフォレストグリーン + クリームテキスト + Playfair セリフ + ラストアクセント。サステナビリティ、アウトドア、ワイナリーに。",
      ko: "딥 포레스트 그린 + 크림 타이포 + Playfair 세리프 + 러스트 액센트. 서스테이너빌리티 / 아웃도어 / 와이너리 / 문학 예술에 적합.",
    },
  },
  {
    slug: "long-table",
    niche: "品牌",
    recommendedCount: 10,
    name: {
      en: "Long Table",
      zh: "Long Table·餐桌系列",
      "zh-TW": "Long Table·餐桌系列",
      ja: "Long Table·ロングテーブル",
      ko: "Long Table·롱 테이블",
    },
    headline: {
      en: "Long Table",
      zh: "餐桌系列",
      "zh-TW": "餐桌系列",
      ja: "ロングテーブル",
      ko: "롱 테이블",
    },
    subhead: {
      en: "F&B · gathering",
      zh: "餐饮 · 聚会",
      "zh-TW": "餐飲 · 聚會",
      ja: "飲食 · 集い",
      ko: "F&B · 모임",
    },
    oneLiner: {
      en: "Warm cream + rust with grotesk uppercase and Fraunces italic serifs — poster-feel for F&B series, small restaurants, community gatherings.",
      zh: "暖米 + 铁锈红,大写 grotesk + Fraunces 斜体衬线,海报式封面,适合餐桌系列 / 小餐饮 / 社区聚会",
      "zh-TW": "暖米 + 鐵鏽紅,大寫 grotesk + Fraunces 斜體襯線,海報式封面,適合餐桌系列 / 小餐飲 / 社區聚會",
      ja: "ウォームクリーム + ラストカラー、大文字グロテスクと Fraunces イタリックセリフ。ポスター調。食卓シリーズ、小レストラン、コミュニティ集会に。",
      ko: "웜 크림 + 러스트, 대문자 그로테스크 + Fraunces 이탤릭 세리프. 포스터 톤. 다이닝 시리즈 / 스몰 레스토랑 / 커뮤니티 모임에 적합.",
    },
  },
  {
    slug: "pink-script",
    niche: "品牌",
    recommendedCount: 10,
    name: {
      en: "Pink Script",
      zh: "Pink Script·热粉夜店",
      "zh-TW": "Pink Script·熱粉夜店",
      ja: "Pink Script·ホットピンク・ナイト",
      ko: "Pink Script·핫핑크 나이트",
    },
    headline: {
      en: "Pink Script",
      zh: "热粉夜店",
      "zh-TW": "熱粉夜店",
      ja: "ホットピンク",
      ko: "핫핑크",
    },
    subhead: {
      en: "fashion · luxury",
      zh: "时尚 · 奢侈",
      "zh-TW": "時尚 · 奢侈",
      ja: "ファッション · ラグジュアリー",
      ko: "패션 · 럭셔리",
    },
    oneLiner: {
      en: "Black canvas with hot pink accent, pearl cream paper, Instrument Serif — nightlife glamour for fashion, luxury, spirits launches.",
      zh: "黑底 + 热粉点缀 + 珍珠米纸 + Instrument Serif,夜店感,适合时尚 / 夜生活 / 烈酒 / 奢侈品发布",
      "zh-TW": "黑底 + 熱粉點綴 + 珍珠米紙 + Instrument Serif,夜店感,適合時尚 / 夜生活 / 烈酒 / 奢侈品發布",
      ja: "ブラックにホットピンクのアクセント + パールクリームペーパー + Instrument Serif。ナイトクラブ調のグラマー。ファッション、ナイトライフ、酒類、ラグジュアリー発表に。",
      ko: "블랙 캔버스 + 핫 핑크 액센트 + 펄 크림 페이퍼 + Instrument Serif. 나이트라이프 글래머. 패션 / 나이트라이프 / 주류 / 럭셔리 런칭에 적합.",
    },
  },

  // ════════════ 海报 / 文化(2 个)════════════
  {
    slug: "bold-poster",
    niche: "海报",
    recommendedCount: 8,
    name: {
      en: "Bold Poster",
      zh: "Bold Poster·海报宣言",
      "zh-TW": "Bold Poster·海報宣言",
      ja: "Bold Poster·マニフェストポスター",
      ko: "Bold Poster·매니페스토 포스터",
    },
    headline: {
      en: "Bold Poster",
      zh: "海报宣言",
      "zh-TW": "海報宣言",
      ja: "ポスター宣言",
      ko: "매니페스토",
    },
    subhead: {
      en: "manifesto · vision",
      zh: "宣言 · 愿景",
      "zh-TW": "宣言 · 願景",
      ja: "宣言 · ビジョン",
      ko: "매니페스토 · 비전",
    },
    oneLiner: {
      en: "Editorial poster aesthetic with massive Shrikhand display and a single fire-engine red — for brand manifestos, founder visions, magazine pitches.",
      zh: "Shrikhand 巨型衬线 + 单一火红,极少字 + 海报式留白,适合品牌宣言 / 创始人愿景 / 杂志风",
      "zh-TW": "Shrikhand 巨型襯線 + 單一火紅,極少字 + 海報式留白,適合品牌宣言 / 創辦人願景 / 雜誌風",
      ja: "Shrikhand 特大セリフ + 一点ファイアレッド。極少の文字とポスター調の余白。ブランドマニフェスト、創業者ビジョン、雑誌調に。",
      ko: "Shrikhand 매시브 디스플레이 + 단일 파이어 레드. 미니멀 텍스트 + 포스터 톤 여백. 브랜드 매니페스토 / 창업자 비전 / 매거진 톤에 적합.",
    },
  },
  {
    slug: "biennale-yellow",
    niche: "海报",
    recommendedCount: 10,
    name: {
      en: "Biennale Yellow",
      zh: "Biennale Yellow·双年展太阳黄",
      "zh-TW": "Biennale Yellow·雙年展太陽黃",
      ja: "Biennale Yellow·ビエンナーレイエロー",
      ko: "Biennale Yellow·비엔날레 옐로우",
    },
    headline: {
      en: "Biennale Yellow",
      zh: "双年展太阳黄",
      "zh-TW": "雙年展太陽黃",
      ja: "ビエンナーレ",
      ko: "비엔날레",
    },
    subhead: {
      en: "exhibition · arts",
      zh: "展览 · 艺术",
      "zh-TW": "展覽 · 藝術",
      ja: "展覧会 · アート",
      ko: "전시 · 아트",
    },
    oneLiner: {
      en: "Solar yellow on warm parchment with deep indigo serif and atmospheric sun-glow gradients — for biennales, arts institutions, design conferences.",
      zh: "太阳黄底 + 靛蓝衬线 + 光晕渐变,海报感,适合双年展 / 美术馆 / 设计大会 / 策展",
      "zh-TW": "太陽黃底 + 靛藍襯線 + 光暈漸變,海報感,適合雙年展 / 美術館 / 設計大會 / 策展",
      ja: "ソーラーイエロー + ディープインディゴのセリフ + サングロウ・グラデーション。ビエンナーレ、美術館、デザインカンファレンス、キュレーションに。",
      ko: "솔라 옐로우 + 딥 인디고 세리프 + 선글로 그라데이션. 비엔날레 / 미술관 / 디자인 컨퍼런스 / 큐레이팅에 적합.",
    },
  },

  // ════════════ 文化 / 评论(1 个)════════════
  {
    slug: "peoples-platform",
    niche: "海报",
    recommendedCount: 10,
    name: {
      en: "People's Platform",
      zh: "People's Platform·公民海报",
      "zh-TW": "People's Platform·公民海報",
      ja: "People's Platform·市民プラットフォーム",
      ko: "People's Platform·시민 플랫폼",
    },
    headline: {
      en: "People's Platform",
      zh: "公民海报",
      "zh-TW": "公民海報",
      ja: "市民プラット",
      ko: "시민 플랫폼",
    },
    subhead: {
      en: "civic · activism",
      zh: "文化 · 评论",
      "zh-TW": "文化 · 評論",
      ja: "文化 · 評論",
      ko: "문화 · 평론",
    },
    oneLiner: {
      en: "Cream base with blue / orange / red triad, Alfa Slab + Caveat — civic poster vibes for cultural commentary, activism, community campaigns.",
      zh: "米底 + 蓝 / 橙 / 红三色 + Alfa Slab + Caveat 手写,适合文化评论 / 宣言 / 公民 / 活动文案",
      "zh-TW": "米底 + 藍 / 橘 / 紅三色 + Alfa Slab + Caveat 手寫,適合文化評論 / 宣言 / 公民 / 活動文案",
      ja: "クリーム + ブルー / オレンジ / レッドの三色 + Alfa Slab + Caveat。市民ポスター調。文化評論、マニフェスト、市民活動、キャンペーンに。",
      ko: "크림 + 블루 / 오렌지 / 레드 트라이아드 + Alfa Slab + Caveat. 시민 포스터 톤. 문화 평론 / 매니페스토 / 시민 / 캠페인에 적합.",
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

  // 校验:32 模板必须不重不漏
  if (TEMPLATES.length !== 32) {
    console.error(`❌ TEMPLATES 数量错:${TEMPLATES.length},应该 32`);
    process.exit(1);
  }
  const slugs = new Set(TEMPLATES.map((t) => t.slug));
  if (slugs.size !== 32) {
    console.error(`❌ 有重复 slug,unique 数 ${slugs.size}`);
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;

  for (const t of TEMPLATES) {
    const id = `ext-${t.slug}`;
    // 读 HTML 文件
    const htmlPath = path.resolve(
      process.cwd(),
      `src/lib/slides/templates/external/${t.slug}.html`,
    );
    const html = readFileSync(htmlPath, "utf-8");
    // 2026-05-09 PR5:截图从 PNG 转为 WebP(省 92% 体积),
    // public/templates/external/<slug>.webp 由 scripts/optimize-template-screenshots.ts 生成
    const previewUrl = `/templates/external/${t.slug}.webp`;

    // 旧字段(单语言)兜底用 en 版本(因为外部模板都是英文为主)
    const fallbackName = t.name.en;
    const fallbackOneLiner = t.oneLiner.en;
    const fallbackHeadline = t.headline.en;
    const fallbackSubhead = t.subhead.en;

    const existing = (await sql`
      SELECT id FROM templates WHERE id = ${id} LIMIT 1
    `) as Array<{ id: string }>;
    const isNew = existing.length === 0;

    await sql`
      INSERT INTO templates (
        id, owner_user_id, mode, name, topic_tag, style_id, preview_url,
        recommended_count,
        locked_ratio, locked_generation_mode,
        headline, subhead, thumb_class, one_liner,
        template_path, template_html, source_repo,
        name_i18n, one_liner_i18n, headline_i18n, subhead_i18n,
        is_premium, created_at, updated_at
      ) VALUES (
        ${id}, NULL, 'slides', ${fallbackName}, ${t.niche}, 'external', ${previewUrl},
        ${t.recommendedCount},
        '16:9', 'batch',
        ${fallbackHeadline}, ${fallbackSubhead}, 'as-theme-business', ${fallbackOneLiner},
        'l1_html', ${html}, 'github.com/zarazhangrui/beautiful-html-templates',
        ${JSON.stringify(t.name)}::jsonb,
        ${JSON.stringify(t.oneLiner)}::jsonb,
        ${JSON.stringify(t.headline)}::jsonb,
        ${JSON.stringify(t.subhead)}::jsonb,
        FALSE, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        topic_tag = EXCLUDED.topic_tag,
        style_id = EXCLUDED.style_id,
        preview_url = EXCLUDED.preview_url,
        recommended_count = EXCLUDED.recommended_count,
        locked_ratio = EXCLUDED.locked_ratio,
        locked_generation_mode = EXCLUDED.locked_generation_mode,
        headline = EXCLUDED.headline,
        subhead = EXCLUDED.subhead,
        thumb_class = EXCLUDED.thumb_class,
        one_liner = EXCLUDED.one_liner,
        template_path = EXCLUDED.template_path,
        template_html = EXCLUDED.template_html,
        source_repo = EXCLUDED.source_repo,
        name_i18n = EXCLUDED.name_i18n,
        one_liner_i18n = EXCLUDED.one_liner_i18n,
        headline_i18n = EXCLUDED.headline_i18n,
        subhead_i18n = EXCLUDED.subhead_i18n,
        updated_at = NOW()
    `;

    if (isNew) {
      inserted += 1;
      console.log(`  ✓ 新增 ext-${t.slug}`);
    } else {
      updated += 1;
      console.log(`  ↻ 更新 ext-${t.slug}`);
    }
  }

  console.log(
    `\n✅ 完成 — 新增 ${inserted} / 更新 ${updated} / 总计 ${TEMPLATES.length}`,
  );
}

main().catch((err) => {
  console.error("❌ seed 失败:", err);
  process.exit(1);
});
