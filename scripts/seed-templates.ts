// scripts/seed-templates.ts — 系统模板灌库脚本(M5+ 模板矩阵化 + M9 多语言)
//
// 用法:
//   npx tsx --env-file=.env.local scripts/seed-templates.ts
//
// 幂等:用 ON CONFLICT DO UPDATE,可反复跑
//
// 流程(参考 PHASE2 T2-30 SOP):
//   1. 测试出图验证 promptSeed 稳定 → 选首图
//   2. 把图存到 public/templates/<id>.png
//   3. 把元数据(promptSeed + locked* + niche + 5 语言文案) 写到 SYSTEM_TEMPLATES
//   4. 跑这个脚本 → INSERT/UPDATE templates 表
//   5. 前端 GET /api/templates 自动展示
//
// M9 多语言改造:
//   - name / oneLiner / promptSeed / headline / subhead 五字段全部 i18n 化
//   - 落库时 INSERT i18n JSONB,旧字段(单语言)填中文版兜底,以兼容旧 SQL 查询路径
//   - 5 语言:en / zh / zh-TW / ja / ko(对应 src/i18n/routing.ts)

import { neon } from "@neondatabase/serverless";

type Locale = "en" | "zh" | "zh-TW" | "ja" | "ko";
type LocalizedString = Record<Locale, string>;

interface SystemTemplate {
  id: string;
  mode: "cards" | "slides" | "image";
  niche: string;
  styleId: string;
  /** 锁的字段 — 用户点模板自动应用 */
  lockedRatio?: string;
  lockedGenerationMode?: "batch" | "one-by-one";
  /** 模板的封面预览图 */
  previewUrl?: string;
  /** 占位用 — 缩略图 emoji + 标题(无 previewUrl 时显示)*/
  thumbClass?: string;
  /** 推荐张数 */
  recommendedCount?: number;
  /** SPEC §3 等用的预设字段 */
  presetAudience?: string;
  presetFocus?: string;
  presetTone?: string;
  presetOutlineStrategy?: string;

  // ─────────────── M9 多语言:5 语言文案 ───────────────
  /** 模板显示名 */
  name: LocalizedString;
  /** 一句话介绍(模板预览弹窗 + sidebar list 用)*/
  oneLiner: LocalizedString;
  /** 通用 prompt 骨架 — 包含 {user_content} 占位 */
  promptSeed: LocalizedString;
  /** 缩略图 headline(无 previewUrl 时显示)*/
  headline?: LocalizedString;
  /** 缩略图 subhead */
  subhead?: LocalizedString;
}

// ─────────────────────── 系统模板首批 ───────────────────────

const SYSTEM_TEMPLATES: SystemTemplate[] = [
  // ═══════════ Slides:仅 modern_pro 是 status='complete' ═══════════
  // 第一批先用 modern_pro 做 3 个不同场景(覆盖 80% 商务/职场需求)
  {
    id: "slides-modern-pro-business-3acts",
    mode: "slides",
    niche: "职场",
    styleId: "modern_pro",
    lockedRatio: "16:9",
    lockedGenerationMode: "batch",
    thumbClass: "as-theme-business",
    recommendedCount: 8,
    presetAudience: "高管",
    presetOutlineStrategy: "problem_solution",
    name: {
      en: "Business Brief · 3-Act",
      zh: "商务汇报·三幕式",
      "zh-TW": "商務匯報·三幕式",
      ja: "ビジネス報告·三幕構成",
      ko: "비즈니스 보고·3막 구조",
    },
    headline: {
      en: "Business 3-Acts",
      zh: "商务三幕",
      "zh-TW": "商務三幕",
      ja: "ビジネス三幕",
      ko: "비즈니스 3막",
    },
    subhead: {
      en: "problem · solution · action",
      zh: "问题 · 方案 · 行动",
      "zh-TW": "問題 · 方案 · 行動",
      ja: "課題 · 解決 · 行動",
      ko: "문제 · 해결 · 실행",
    },
    oneLiner: {
      en: "Modern professional deck with a problem → solution → action arc, ideal for quarterly reviews, strategy proposals, and client pitches.",
      zh: "现代专业商务风,三幕式叙事(问题→方案→行动),适合季度复盘 / 战略提案 / 客户演讲",
      "zh-TW": "現代專業商務風,三幕式敘事(問題→方案→行動),適合季度復盤 / 戰略提案 / 客戶演講",
      ja: "モダンでプロフェッショナルな三幕構成(課題→解決→行動)。四半期レビュー、戦略提案、クライアント向けプレゼン向け。",
      ko: "모던 프로페셔널한 3막 구조(문제→해결→실행). 분기 리뷰, 전략 제안, 클라이언트 피칭에 적합.",
    },
    promptSeed: {
      en: `Build an 8-page business deck using a 3-act structure (problem → solution → action).

[Topic]
{user_content}

[Audience] CTO / Product Lead / Business Decision Makers

[Structure]
1. Cover — Title + subtitle + presenter slot
2. Agenda — 3 key points + summary + Q&A
3. Section divider — "Problem 1: [Phenomenon]"
4. Content — Phenomenon + data + recommended response (highlight key numbers via callout)
5. Section divider — "Problem 2: [Phenomenon]"
6. Content — Case study + bad/good comparison
7. Section divider — "Problem 3: [Phenomenon]"
8. Summary + Q&A — 3-sentence summary + 3 actionable next steps

[Visual rules]
- Style: modern_pro
- Primary: orange focus #FF5722 + deep charcoal background #1a1a1a
- Generous whitespace, titles top-aligned, data centered
- Page number + section name in bottom-right of every page`,
      zh: `做一份 8 页商务演讲 deck,采用三幕式结构(问题 → 方案 → 行动)。

【主题】
{user_content}

【受众】CTO / 产品负责人 / 业务决策层

【结构】
1. 封面 — 标题 + 副标题 + 演讲人位
2. 议程页 — 列 3 大要点 + 总结 + Q&A
3. 章节标题 — "问题 1:[现象]"
4. 内容页 — 现象 + 数据 + 应对建议(用 callout 高亮关键数据)
5. 章节标题 — "问题 2:[现象]"
6. 内容页 — 案例 + bad/good 对比
7. 章节标题 — "问题 3:[现象]"
8. 总结 + Q&A 页 — 3 句话总结 + 3 个行动建议

【视觉规范】
- 风格:现代专业(modern_pro)
- 主色:橙色焦点 #FF5722 + 深炭灰背景 #1a1a1a
- 留白充足,标题靠上,数据居中
- 每页右下角显示页码 + 章节名`,
      "zh-TW": `做一份 8 頁商務演講 deck,採用三幕式結構(問題 → 方案 → 行動)。

【主題】
{user_content}

【受眾】CTO / 產品負責人 / 業務決策層

【結構】
1. 封面 — 標題 + 副標題 + 演講人位
2. 議程頁 — 列 3 大要點 + 總結 + Q&A
3. 章節標題 — "問題 1:[現象]"
4. 內容頁 — 現象 + 數據 + 應對建議(用 callout 高亮關鍵數據)
5. 章節標題 — "問題 2:[現象]"
6. 內容頁 — 案例 + bad/good 對比
7. 章節標題 — "問題 3:[現象]"
8. 總結 + Q&A 頁 — 3 句話總結 + 3 個行動建議

【視覺規範】
- 風格:現代專業(modern_pro)
- 主色:橘色焦點 #FF5722 + 深炭灰背景 #1a1a1a
- 留白充足,標題靠上,數據居中
- 每頁右下角顯示頁碼 + 章節名`,
      ja: `8 ページのビジネスプレゼンを三幕構成(課題 → 解決 → 行動)で作成してください。

【テーマ】
{user_content}

【対象】CTO / プロダクト責任者 / 経営層

【構成】
1. 表紙 — タイトル + サブタイトル + 発表者欄
2. アジェンダ — 3 つの重要ポイント + まとめ + Q&A
3. セクション見出し — 「課題 1:[現象]」
4. 本編 — 現象 + データ + 対応策(重要数値は callout でハイライト)
5. セクション見出し — 「課題 2:[現象]」
6. 本編 — 事例 + bad/good 比較
7. セクション見出し — 「課題 3:[現象]」
8. まとめ + Q&A — 3 文要約 + 3 つの具体的アクション

【ビジュアル規範】
- スタイル:modern_pro(モダンプロフェッショナル)
- メインカラー:オレンジアクセント #FF5722 + ダークチャコール背景 #1a1a1a
- 余白を広く、タイトル上寄せ、データ中央配置
- 各ページ右下にページ番号 + セクション名を表示`,
      ko: `8 페이지 비즈니스 프레젠테이션 덱을 3막 구조(문제 → 해결 → 실행)로 만들어주세요.

【주제】
{user_content}

【대상】CTO / 프로덕트 책임자 / 경영진

【구성】
1. 표지 — 제목 + 부제 + 발표자 자리
2. 어젠다 — 3 가지 핵심 포인트 + 요약 + Q&A
3. 섹션 제목 — "문제 1: [현상]"
4. 본문 — 현상 + 데이터 + 대응 제안 (핵심 수치는 callout 으로 강조)
5. 섹션 제목 — "문제 2: [현상]"
6. 본문 — 사례 + bad/good 비교
7. 섹션 제목 — "문제 3: [현상]"
8. 요약 + Q&A — 3 문장 요약 + 3 가지 실행 제안

【비주얼 규범】
- 스타일: modern_pro (모던 프로페셔널)
- 메인 컬러: 오렌지 포커스 #FF5722 + 딥 차콜 배경 #1a1a1a
- 충분한 여백, 제목은 위쪽 정렬, 데이터는 중앙
- 각 페이지 오른쪽 아래에 페이지 번호 + 섹션명 표시`,
    },
  },
  {
    id: "slides-modern-pro-pitch-deck",
    mode: "slides",
    niche: "创业",
    styleId: "modern_pro",
    lockedRatio: "16:9",
    lockedGenerationMode: "batch",
    thumbClass: "as-theme-business",
    recommendedCount: 10,
    presetAudience: "投资人 / 战略合伙人",
    presetOutlineStrategy: "problem_solution",
    name: {
      en: "Pitch Deck · Founders",
      zh: "项目路演·Pitch Deck",
      "zh-TW": "專案路演·Pitch Deck",
      ja: "ピッチデック·創業者向け",
      ko: "피치덱·창업자용",
    },
    headline: {
      en: "Pitch Deck",
      zh: "Pitch Deck",
      "zh-TW": "Pitch Deck",
      ja: "Pitch Deck",
      ko: "Pitch Deck",
    },
    subhead: {
      en: "problem · solution · traction · ask",
      zh: "问题 · 方案 · 牵引 · 融资",
      "zh-TW": "問題 · 方案 · 牽引 · 融資",
      ja: "課題 · 解決 · 牽引 · 調達",
      ko: "문제 · 해결 · 트랙션 · 펀딩",
    },
    oneLiner: {
      en: "Classic Silicon Valley 10-page pitch deck covering product, market, team, and ask — built for investor meetings.",
      zh: "经典硅谷路演 deck 结构,10 页讲清产品 / 市场 / 团队 / 融资,适合给投资人",
      "zh-TW": "經典矽谷路演 deck 結構,10 頁講清產品 / 市場 / 團隊 / 融資,適合給投資人",
      ja: "シリコンバレー定番の 10 ページピッチデック。プロダクト・市場・チーム・調達を一気通貫で。投資家向け。",
      ko: "실리콘밸리 클래식 10 페이지 피치덱. 제품 · 시장 · 팀 · 펀딩을 명확히 설명. 투자자 미팅용.",
    },
    promptSeed: {
      en: `Build a 10-page fundraising pitch deck.

[Project topic]
{user_content}

[Structure]
1. Cover — Company + one-line positioning + founder + round
2. Problem — User pain + market size (with numbers)
3. Solution — Core product + key capabilities (3 points)
4. Market opportunity — TAM / SAM / SOM data
5. Business model — Revenue structure + unit economics
6. Traction — Key metric curve + flagship customers
7. Competitive landscape — 2x2 quadrant + our differentiation
8. Team — Founders + core members + advisors
9. Funding plan — Use of funds + milestones
10. Contact — Email / website + one-line vision

[Visual rules]
- Style: modern_pro
- High-contrast dark background + orange focus
- Large numbers, restrained text
- One core idea per page, no clutter`,
      zh: `做一份 10 页融资路演 Pitch Deck。

【项目主题】
{user_content}

【结构】
1. 封面 — 公司名 + 一句话定位 + 创始人 + 轮次
2. 问题 — 用户痛点 + 市场规模(配数字)
3. 解决方案 — 核心产品 + 关键能力(3 点)
4. 市场机会 — TAM/SAM/SOM 数据
5. 商业模式 — 收入结构 + 单经济模型
6. 牵引力 — 关键数据曲线 + 标杆客户
7. 竞争格局 — 2x2 象限图 + 我们的差异化
8. 团队 — 创始人 + 核心成员 + 顾问
9. 融资计划 — 用钱用途 + 里程碑
10. 联系方式 — 邮箱 / 网址 + 一句话愿景

【视觉规范】
- 风格:现代专业(modern_pro)
- 高对比深色背景 + 橙色焦点
- 数字字号大,文字克制
- 每页一个核心概念,不堆砌`,
      "zh-TW": `做一份 10 頁融資路演 Pitch Deck。

【專案主題】
{user_content}

【結構】
1. 封面 — 公司名 + 一句話定位 + 創辦人 + 輪次
2. 問題 — 用戶痛點 + 市場規模(配數字)
3. 解決方案 — 核心產品 + 關鍵能力(3 點)
4. 市場機會 — TAM/SAM/SOM 數據
5. 商業模式 — 收入結構 + 單經濟模型
6. 牽引力 — 關鍵數據曲線 + 標竿客戶
7. 競爭格局 — 2x2 象限圖 + 我們的差異化
8. 團隊 — 創辦人 + 核心成員 + 顧問
9. 融資計劃 — 用錢用途 + 里程碑
10. 聯絡方式 — 信箱 / 網址 + 一句話願景

【視覺規範】
- 風格:現代專業(modern_pro)
- 高對比深色背景 + 橘色焦點
- 數字字號大,文字克制
- 每頁一個核心概念,不堆砌`,
      ja: `10 ページの資金調達ピッチデックを作成してください。

【プロジェクトテーマ】
{user_content}

【構成】
1. 表紙 — 社名 + 一行ポジショニング + 創業者 + ラウンド
2. 課題 — ユーザーの痛み + 市場規模(数値付き)
3. ソリューション — コアプロダクト + 主要機能(3 点)
4. 市場機会 — TAM / SAM / SOM データ
5. ビジネスモデル — 収益構造 + ユニットエコノミクス
6. トラクション — 主要 KPI の伸び + 旗艦顧客
7. 競合状況 — 2x2 マトリクス + 当社の差別化
8. チーム — 創業者 + コアメンバー + アドバイザー
9. 調達計画 — 資金用途 + マイルストーン
10. 連絡先 — メール / Web サイト + 一行ビジョン

【ビジュアル規範】
- スタイル:modern_pro
- 高コントラストのダーク背景 + オレンジアクセント
- 数字は大きく、文字は抑えめに
- 1 ページ 1 コンセプト、情報を詰め込まない`,
      ko: `10 페이지 펀딩 피치덱을 만들어주세요.

【프로젝트 주제】
{user_content}

【구성】
1. 표지 — 회사명 + 한 줄 포지셔닝 + 창업자 + 라운드
2. 문제 — 유저 페인 + 시장 규모 (숫자 동반)
3. 솔루션 — 핵심 제품 + 주요 역량 (3 가지)
4. 시장 기회 — TAM / SAM / SOM 데이터
5. 비즈니스 모델 — 수익 구조 + 단위 경제성
6. 트랙션 — 핵심 지표 곡선 + 대표 고객
7. 경쟁 환경 — 2x2 매트릭스 + 우리의 차별화
8. 팀 — 창업자 + 핵심 멤버 + 어드바이저
9. 펀딩 계획 — 자금 용도 + 마일스톤
10. 연락처 — 이메일 / 웹사이트 + 한 줄 비전

【비주얼 규범】
- 스타일: modern_pro
- 고대비 다크 배경 + 오렌지 포커스
- 숫자는 크게, 텍스트는 절제
- 페이지당 한 가지 핵심 개념, 채우지 말 것`,
    },
  },
  {
    id: "slides-modern-pro-quarterly-review",
    mode: "slides",
    niche: "职场",
    styleId: "modern_pro",
    lockedRatio: "16:9",
    lockedGenerationMode: "batch",
    thumbClass: "as-theme-business",
    recommendedCount: 6,
    presetAudience: "团队成员 / 直属领导",
    presetOutlineStrategy: "compare_contrast",
    name: {
      en: "Quarterly Review · OKR",
      zh: "季度复盘·OKR 视角",
      "zh-TW": "季度復盤·OKR 視角",
      ja: "四半期レビュー·OKR 視点",
      ko: "분기 리뷰·OKR 시점",
    },
    headline: {
      en: "Quarterly Review",
      zh: "季度复盘",
      "zh-TW": "季度復盤",
      ja: "四半期レビュー",
      ko: "분기 리뷰",
    },
    subhead: {
      en: "wins · gaps · next",
      zh: "亮点 · 不足 · 下季",
      "zh-TW": "亮點 · 不足 · 下季",
      ja: "成果 · 課題 · 次期",
      ko: "성과 · 갭 · 다음",
    },
    oneLiner: {
      en: "Tight 6-page team retrospective around OKR completion: wins, gaps, learnings, and next quarter's plan. Built for internal share-outs.",
      zh: "团队季度复盘,OKR 完成度+亮点+不足+下季计划,6 页紧凑,适合内部分享",
      "zh-TW": "團隊季度復盤,OKR 完成度+亮點+不足+下季計劃,6 頁緊湊,適合內部分享",
      ja: "OKR 達成率+成果+課題+次期計画。6 ページのコンパクトな四半期レビュー。社内共有向け。",
      ko: "OKR 달성률+성과+갭+다음 분기 계획. 6 페이지 컴팩트한 분기 리뷰. 사내 공유용.",
    },
    promptSeed: {
      en: `Build a 6-page quarterly review deck centered on OKR completion.

[Quarter / team / OKR brief]
{user_content}

[Structure]
1. Cover — Q1/Q2/Q3/Q4 review + team name + lead
2. Goal recap — 3 Os of the quarter + each KR completion % (progress bars)
3. Three wins — One major outcome per slide + key number
4. Three gaps — One missed target per slide + root cause
5. Lessons — 3 retrospective insights (transferable to next quarter)
6. Next-quarter OKR draft — 3 proposed Os for the next quarter

[Visual rules]
- modern_pro
- Progress bars / large stat numbers / horizontal comparison tables
- Palette: dark background + orange highlight for wins + gray for gaps
- Bottom-right small caption "@team · quarter"`,
      zh: `做一份 6 页季度复盘 deck,围绕 OKR 完成度展开。

【季度主题 / 团队 / OKR 简述】
{user_content}

【结构】
1. 封面 — Q1/Q2/Q3/Q4 季度复盘 + 团队名 + 主负责人
2. 目标回顾 — 本季 3 个 O + 各自 KR 完成%(进度条)
3. 三大亮点 — 每张高亮一项重大成果 + 关键数字
4. 三大不足 — 每张说一个未达成 + 根因分析
5. 反思学习 — 3 条复盘洞察(可推广到下季)
6. 下季 OKR 草案 — 新一季 3 个 O 提案

【视觉规范】
- 现代专业风(modern_pro)
- 进度条 / 数字大字号 / 横向对比表
- 配色:深色背景 + 橙色高亮成功 + 灰色不足
- 每页右下小字"@团队名 · 季度名"`,
      "zh-TW": `做一份 6 頁季度復盤 deck,圍繞 OKR 完成度展開。

【季度主題 / 團隊 / OKR 簡述】
{user_content}

【結構】
1. 封面 — Q1/Q2/Q3/Q4 季度復盤 + 團隊名 + 主負責人
2. 目標回顧 — 本季 3 個 O + 各自 KR 完成%(進度條)
3. 三大亮點 — 每張高亮一項重大成果 + 關鍵數字
4. 三大不足 — 每張說一個未達成 + 根因分析
5. 反思學習 — 3 條復盤洞察(可推廣到下季)
6. 下季 OKR 草案 — 新一季 3 個 O 提案

【視覺規範】
- 現代專業風(modern_pro)
- 進度條 / 數字大字號 / 橫向對比表
- 配色:深色背景 + 橘色高亮成功 + 灰色不足
- 每頁右下小字"@團隊名 · 季度名"`,
      ja: `OKR 達成率を軸とした 6 ページの四半期レビューデックを作成してください。

【四半期テーマ / チーム / OKR 概要】
{user_content}

【構成】
1. 表紙 — Q1/Q2/Q3/Q4 レビュー + チーム名 + 責任者
2. 目標振り返り — 当四半期の 3 つの O + 各 KR 達成率(プログレスバー)
3. 3 大成果 — 1 ページ 1 つの主要成果 + キー数値
4. 3 大課題 — 1 ページ 1 つの未達成 + 根本原因分析
5. 学び — 振り返りインサイト 3 つ(次期に活かせるもの)
6. 次期 OKR ドラフト — 次四半期の 3 つの O 提案

【ビジュアル規範】
- modern_pro
- プログレスバー / 大きな数字 / 横並び比較表
- 配色:ダーク背景 + オレンジで成果ハイライト + グレーで課題
- 右下に小さく「@チーム名 · 四半期名」`,
      ko: `OKR 달성률을 중심으로 한 6 페이지 분기 리뷰 덱을 만들어주세요.

【분기 주제 / 팀 / OKR 개요】
{user_content}

【구성】
1. 표지 — Q1/Q2/Q3/Q4 리뷰 + 팀명 + 리더
2. 목표 리뷰 — 이번 분기 3 개 O + 각 KR 달성률 (프로그레스 바)
3. 3 대 성과 — 슬라이드당 1 개 핵심 성과 + 핵심 숫자
4. 3 대 갭 — 슬라이드당 1 개 미달성 + 근본 원인 분석
5. 회고 인사이트 — 다음 분기에 적용 가능한 3 가지
6. 다음 분기 OKR 초안 — 새 분기 3 개 O 제안

【비주얼 규범】
- modern_pro
- 프로그레스 바 / 큰 숫자 / 가로 비교표
- 배색: 다크 배경 + 오렌지로 성과 강조 + 그레이로 갭
- 페이지 오른쪽 아래 "@팀명 · 분기" 작은 캡션`,
    },
  },

  // ═══════════ Cards 模板(读书金句·小红书清新)═══════════
  {
    id: "cards-xhs-fresh-book-quote",
    mode: "cards",
    niche: "读书",
    styleId: "xiaohongshu_fresh",
    lockedRatio: "3:4",
    thumbClass: "as-theme-reading",
    previewUrl: "/templates/card-reading-quote.png",
    recommendedCount: 5,
    presetAudience: "年轻女性 / 读书爱好者",
    presetTone: "亲切",
    name: {
      en: "Book Quotes · Xiaohongshu Fresh",
      zh: "读书金句·小红书清新",
      "zh-TW": "讀書金句·小紅書清新",
      ja: "読書名言·小紅書フレッシュ",
      ko: "독서 명언·샤오홍슈 프레시",
    },
    headline: {
      en: "Book Quote",
      zh: "读书金句",
      "zh-TW": "讀書金句",
      ja: "読書名言",
      ko: "독서 명언",
    },
    subhead: {
      en: "5 cards · linen + serif",
      zh: "5 张 · 亚麻 + 衬线",
      "zh-TW": "5 張 · 亞麻 + 襯線",
      ja: "5 枚 · リネン + セリフ",
      ko: "5 장 · 리넨 + 세리프",
    },
    oneLiner: {
      en: "Classic 5-card book-quote set: linen background, bold serif title, handwritten subhead. Perfect for Xiaohongshu / Instagram carousels.",
      zh: "经典 5 张读书金句套图,米色亚麻 + 衬线粗体标题 + 手写副标,适合小红书图文",
      "zh-TW": "經典 5 張讀書金句套圖,米色亞麻 + 襯線粗體標題 + 手寫副標,適合小紅書圖文",
      ja: "リネン地+セリフ太字+手書き副題の定番 5 枚セット。小紅書 / Instagram カルーセル向け。",
      ko: "리넨 배경 + 세리프 볼드 제목 + 손글씨 부제의 클래식 5 장 세트. 샤오홍슈 / 인스타그램 캐러셀용.",
    },
    promptSeed: {
      en: `Create a 5-card book-quote set in a fresh Xiaohongshu literary style.

[Book / theme — please provide]
{user_content}

[Structure]
1. Cover — "5 things you only get after finishing《[Book]》" centered large
2-4. Content cards — One core quote each + brief explanation + 1/5 2/5 3/5 numbering
5. Closing — "Three actions to act on today" + checklist

[Visual rules]
- Beige linen-textured background
- Bold serif title (e.g., Source Han Serif Bold / Playfair Display)
- Handwritten subhead
- Generous whitespace, 3:4 ratio
- Small "AnySlide" watermark in bottom-right`,
      zh: `做 5 张读书金句套图,小红书清新文艺风。

【书名 / 主题 — 请填入】
{user_content}

【结构】
1. 封面 — "《[书名]》读完才懂的 5 个道理" 居中大字
2-4. 内容卡 — 每张提取 1 个核心金句 + 简短解释 + 编号 1/5 2/5 3/5
5. 结尾 — "三个动作落实今天" + 行动清单

【视觉规范】
- 米色亚麻纹理背景
- 衬线粗体标题(如 Source Han Serif Bold)
- 手写体副标
- 留白雅致,3:4 比例
- 右下小水印 AnySlide`,
      "zh-TW": `做 5 張讀書金句套圖,小紅書清新文藝風。

【書名 / 主題 — 請填入】
{user_content}

【結構】
1. 封面 — "《[書名]》讀完才懂的 5 個道理" 置中大字
2-4. 內容卡 — 每張提取 1 個核心金句 + 簡短解釋 + 編號 1/5 2/5 3/5
5. 結尾 — "三個動作落實今天" + 行動清單

【視覺規範】
- 米色亞麻紋理背景
- 襯線粗體標題(如 Source Han Serif Bold)
- 手寫體副標
- 留白雅致,3:4 比例
- 右下小浮水印 AnySlide`,
      ja: `5 枚組の読書名言カードを、小紅書フレッシュ文芸風で作成してください。

【書名 / テーマ — 記入してください】
{user_content}

【構成】
1. 表紙 — 「『[書名]』を読み終えてやっと分かる 5 つのこと」を中央に大きく
2-4. 本編カード — 1 枚 1 つの核心名言 + 短い解説 + 1/5 2/5 3/5 番号
5. 締めくくり — 「今日やる 3 つのアクション」+ チェックリスト

【ビジュアル規範】
- ベージュのリネン地背景
- セリフ太字タイトル(Source Han Serif Bold など)
- 手書き風サブタイトル
- 余白を上品に、3:4 比率
- 右下に小さく AnySlide の透かし`,
      ko: `샤오홍슈 프레시 문예풍 5 장 독서 명언 세트를 만들어주세요.

【책 제목 / 주제 — 입력해주세요】
{user_content}

【구성】
1. 표지 — "《[책 제목]》을 다 읽고 나서야 알게 되는 5 가지" 중앙 큰 글씨
2-4. 본문 카드 — 카드당 1 개 핵심 명언 + 간단한 해설 + 1/5 2/5 3/5 넘버링
5. 마무리 — "오늘 실천할 3 가지 액션" + 체크리스트

【비주얼 규범】
- 베이지 리넨 텍스처 배경
- 세리프 볼드 제목 (Source Han Serif Bold 등)
- 손글씨 부제
- 우아한 여백, 3:4 비율
- 오른쪽 아래 AnySlide 워터마크`,
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

  let inserted = 0;
  let updated = 0;

  for (const t of SYSTEM_TEMPLATES) {
    // 检查是否已存在
    const existing = (await sql`
      SELECT id FROM templates WHERE id = ${t.id} LIMIT 1
    `) as Array<{ id: string }>;

    const isNew = existing.length === 0;

    // 旧字段(单语言)存中文兜底,新字段(*_i18n)存 JSONB(5 语言完整)
    const fallbackName = t.name.zh;
    const fallbackOneLiner = t.oneLiner.zh;
    const fallbackPromptSeed = t.promptSeed.zh;
    const fallbackHeadline = t.headline?.zh ?? null;
    const fallbackSubhead = t.subhead?.zh ?? null;

    await sql`
      INSERT INTO templates (
        id, owner_user_id, mode, name, topic_tag, style_id, preview_url,
        preset_audience, preset_focus, preset_tone, preset_outline_strategy,
        recommended_count, custom_prompt_addon,
        locked_ratio, locked_generation_mode,
        headline, subhead, thumb_class, one_liner,
        name_i18n, one_liner_i18n, prompt_seed_i18n, headline_i18n, subhead_i18n,
        is_premium, created_at, updated_at
      ) VALUES (
        ${t.id}, NULL, ${t.mode}, ${fallbackName}, ${t.niche}, ${t.styleId}, ${t.previewUrl ?? null},
        ${t.presetAudience ?? null}, ${t.presetFocus ?? null}, ${t.presetTone ?? null},
        ${t.presetOutlineStrategy ?? null},
        ${t.recommendedCount ?? null}, ${fallbackPromptSeed},
        ${t.lockedRatio ?? null}, ${t.lockedGenerationMode ?? null},
        ${fallbackHeadline}, ${fallbackSubhead}, ${t.thumbClass ?? null}, ${fallbackOneLiner},
        ${JSON.stringify(t.name)}::jsonb,
        ${JSON.stringify(t.oneLiner)}::jsonb,
        ${JSON.stringify(t.promptSeed)}::jsonb,
        ${t.headline ? JSON.stringify(t.headline) : null}::jsonb,
        ${t.subhead ? JSON.stringify(t.subhead) : null}::jsonb,
        FALSE, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        topic_tag = EXCLUDED.topic_tag,
        style_id = EXCLUDED.style_id,
        preview_url = EXCLUDED.preview_url,
        preset_audience = EXCLUDED.preset_audience,
        preset_focus = EXCLUDED.preset_focus,
        preset_tone = EXCLUDED.preset_tone,
        preset_outline_strategy = EXCLUDED.preset_outline_strategy,
        recommended_count = EXCLUDED.recommended_count,
        custom_prompt_addon = EXCLUDED.custom_prompt_addon,
        locked_ratio = EXCLUDED.locked_ratio,
        locked_generation_mode = EXCLUDED.locked_generation_mode,
        headline = EXCLUDED.headline,
        subhead = EXCLUDED.subhead,
        thumb_class = EXCLUDED.thumb_class,
        one_liner = EXCLUDED.one_liner,
        name_i18n = EXCLUDED.name_i18n,
        one_liner_i18n = EXCLUDED.one_liner_i18n,
        prompt_seed_i18n = EXCLUDED.prompt_seed_i18n,
        headline_i18n = EXCLUDED.headline_i18n,
        subhead_i18n = EXCLUDED.subhead_i18n,
        updated_at = NOW()
    `;

    if (isNew) {
      inserted += 1;
      console.log(`  ✓ 新增  [${t.mode}] ${t.name.zh} (${t.id})`);
    } else {
      updated += 1;
      console.log(`  ↻ 更新  [${t.mode}] ${t.name.zh} (${t.id})`);
    }
  }

  console.log(`\n✅ 完成 — 新增 ${inserted} / 更新 ${updated} / 总计 ${SYSTEM_TEMPLATES.length}`);
  console.log(`   每个模板 5 语言文案就绪(en / zh / zh-TW / ja / ko)`);
}

main().catch((err) => {
  console.error("❌ seed 失败:", err);
  process.exit(1);
});
