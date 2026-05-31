"use client";

import type { CSSProperties, MouseEvent } from "react";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";

const caseSets = [
  {
    id: "career-founder",
    label: "Career",
    title: "从 0 到 1 搭建个人影响力",
    caption: "4-card Xiaohongshu set",
    direction: "left",
    bg: "bg-[#ECECEC]",
    accent: "bg-primary-cta",
    cards: [
      {
        kicker: "职场干货",
        title: "从 0 到 1 搭建个人影响力",
        body: "定位、表达、分发、复盘，一套卡片讲清楚。",
      },
      {
        kicker: "Step 1",
        title: "先找到你的稳定议题",
        body: "不要追热点，先锁定你能持续输出的专业交叉点。",
      },
      {
        kicker: "Step 2",
        title: "把经验拆成可复用框架",
        body: "方法论、清单、案例和反思，是最容易被收藏的结构。",
      },
      {
        kicker: "CTA",
        title: "让每次发布都能沉淀资产",
        body: "结尾卡自动补上总结句、行动号召和标签方向。",
      },
    ],
  },
  {
    id: "reading-notes",
    label: "Reading",
    title: "How to Remember What You Read",
    caption: "Book note carousel",
    direction: "right",
    bg: "bg-[#FFF1EB]",
    accent: "bg-[#96440F]",
    cards: [
      {
        kicker: "Book Notes",
        title: "How to Remember What You Read",
        body: "A warm sequence for turning highlights into shareable ideas.",
      },
      {
        kicker: "Insight",
        title: "Capture the sentence, not the page",
        body: "A note becomes useful when it preserves one precise thought.",
      },
      {
        kicker: "Prompt",
        title: "Ask what changed in your mind",
        body: "Reflection cards make reading accounts feel personal and useful.",
      },
      {
        kicker: "Publish",
        title: "End with one takeaway",
        body: "The final card gives readers a clear save-worthy conclusion.",
      },
    ],
  },
  {
    id: "finance-guide",
    label: "Finance",
    title: "现金流、风险、资产配置",
    caption: "Structured finance explainer",
    direction: "left",
    bg: "bg-[#EAF3EE]",
    accent: "bg-[#006578]",
    cards: [
      {
        kicker: "理财知识",
        title: "资产配置不是猜涨跌",
        body: "用风险承受能力、现金流和目标期限搭建组合。",
      },
      {
        kicker: "Concept",
        title: "先留安全垫，再谈收益",
        body: "应急资金决定你能不能穿越短期波动。",
      },
      {
        kicker: "Checklist",
        title: "三类资产各司其职",
        body: "现金负责稳定，债券负责缓冲，权益负责长期增长。",
      },
      {
        kicker: "Reminder",
        title: "内容表达要避免承诺收益",
        body: "赛道规则会自动加入审慎措辞和风险提示。",
      },
    ],
  },
  {
    id: "cjk-output",
    label: "中文渲染",
    title: "中文文字 · 直接嵌入图像",
    caption: "业界最准的中文 AI 图模型",
    direction: "right",
    bg: "bg-[#F7E5DD]",
    accent: "bg-primary-cta",
    cards: [
      {
        kicker: "中文",
        title: "把长文变成知识卡片",
        body: "直接嵌入目标语言文字，减少图片中文字错误。",
      },
      {
        kicker: "日本語",
        title: "読書メモを投稿画像に変換",
        body: "構成、見出し、本文を同じ言語で生成。",
      },
      {
        kicker: "한국어",
        title: "업무 회고를 카드로 정리하기",
        body: "카드마다 핵심 문장과 보조 설명을 분리합니다.",
      },
      {
        kicker: "English",
        title: "One style across every card",
        body: "The first image anchors visual consistency for the whole set.",
      },
    ],
  },
  {
    id: "beauty-review",
    label: "Beauty",
    title: "Morning Skincare Routine",
    caption: "Editorial product review",
    direction: "left",
    bg: "bg-[#FBE7EA]",
    accent: "bg-[#C96B35]",
    cards: [
      {
        kicker: "美妆护肤",
        title: "晨间护肤 4 步清单",
        body: "从场景、肤感、步骤到注意事项，形成完整发布链路。",
      },
      {
        kicker: "Step 1",
        title: "先讲适合谁",
        body: "用户更关心自己的肤质和使用场景是否匹配。",
      },
      {
        kicker: "Step 2",
        title: "把体验写具体",
        body: "质地、吸收、妆前表现，比泛泛夸奖更有说服力。",
      },
      {
        kicker: "Tags",
        title: "结尾补齐标签和标题",
        body: "自动生成平台友好的标题候选、文案和标签。",
      },
    ],
  },
  {
    id: "culture-story",
    label: "Culture",
    title: "宋代美学的 5 个关键词",
    caption: "Chinese culture digest",
    direction: "right",
    bg: "bg-[#F1DFD7]",
    accent: "bg-[#1F1F1F]",
    cards: [
      {
        kicker: "国风文化",
        title: "宋代美学的 5 个关键词",
        body: "留白、秩序、器物、日常、雅趣。",
      },
      {
        kicker: "Keyword",
        title: "留白不是空，而是节制",
        body: "把解释压缩成短句，让画面和文字共同表达。",
      },
      {
        kicker: "Keyword",
        title: "器物承载生活方式",
        body: "适合做成图文并列、注释式和时间线构图。",
      },
      {
        kicker: "Closing",
        title: "用一句话收束主题",
        body: "让读者带着明确观点离开，而不是只看过一张图。",
      },
    ],
  },
];

function CaseCard({
  set,
  card,
  index,
}: {
  set: (typeof caseSets)[number];
  card: (typeof caseSets)[number]["cards"][number];
  index: number;
}) {
  return (
    <article
      className={`relative aspect-[4/5] w-[78vw] min-w-[280px] max-w-[440px] shrink-0 overflow-hidden rounded-lg border border-outline-variant/70 ${set.bg} p-6 shadow-brown sm:w-[42vw] lg:w-[31vw] xl:w-[28vw]`}
    >
      <div className="mb-12 flex items-center justify-between">
        <span className="rounded-full bg-white/75 px-3 py-1 text-xs font-semibold text-brown/70 backdrop-blur">
          {card.kicker}
        </span>
        <span className="text-xs font-semibold text-brown/35">
          {index + 1}/4
        </span>
      </div>

      <div className={`mb-5 h-2 w-16 rounded-full ${set.accent} opacity-75`} />
      <h3 className="max-w-[15rem] text-3xl font-black leading-tight text-on-surface">
        {card.title}
      </h3>
      <p className="mt-4 max-w-[18rem] text-base font-medium leading-7 text-on-surface-variant">
        {card.body}
      </p>

      <div className="absolute inset-x-6 bottom-6 space-y-3">
        <div className="rounded-lg bg-white/70 p-3 backdrop-blur">
          <div className={`mb-2 h-2 w-20 rounded-full ${set.accent} opacity-40`} />
          <div className="h-2 w-full rounded-full bg-brown/20" />
        </div>
        <div className="rounded-lg bg-white/70 p-3 backdrop-blur">
          <div className={`mb-2 h-2 w-16 rounded-full ${set.accent} opacity-40`} />
          <div className="h-2 w-full rounded-full bg-brown/20" />
        </div>
      </div>
    </article>
  );
}

function CaseRow({ set }: { set: (typeof caseSets)[number] }) {
  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width - 0.5;
    const direction = set.direction === "left" ? -1 : 1;
    const shift = Math.round(ratio * 360 * direction);

    target.style.setProperty("--case-shift", `${shift}px`);
  }

  function handleMouseLeave(event: MouseEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--case-shift", "0px");
  }

  return (
    <div
      className="case-row group overflow-x-auto overflow-y-hidden py-3 md:overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={
        {
          "--case-base": set.direction === "right" ? "-140px" : "0px",
          "--case-shift": "0px",
        } as CSSProperties
      }
    >
      <div className="case-set-track flex w-max snap-x snap-mandatory gap-1 transition-transform duration-500 ease-out md:gap-0">
        {set.cards.map((card, index) => (
          <div key={card.title} className="snap-center">
            <CaseCard set={set} card={card} index={index} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CaseShowcase() {
  const t = useTranslations();
  return (
    <section id="waterfall" className="overflow-hidden bg-white py-16 lg:py-24">
      <div className="mx-auto mb-10 flex max-w-7xl flex-col justify-between gap-5 px-6 lg:flex-row lg:items-end lg:px-8">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-primary-cta">
            {t("caseShowcase.kicker")}
          </p>
          <h2 className="max-w-3xl text-4xl font-black tracking-tight text-on-surface md:text-5xl">
            {t("caseShowcase.title")}
          </h2>
        </div>
        {/* max-w-[28rem] 而非 max-w-md:同 --spacing-md 撞名会被压成 16px */}
        <div className="max-w-[28rem]">
          <p className="text-base leading-7 text-on-surface-variant">
            {t("caseShowcase.subtitle")}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-on-surface-variant">
            {[
              t("caseShowcase.badgeCover"),
              t("caseShowcase.badgeContent"),
              t("caseShowcase.badgeClosing"),
            ].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <BadgeCheck size={15} className="text-primary-cta" aria-hidden />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {caseSets.map((set) => (
          <CaseRow key={set.id} set={set} />
        ))}
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl px-6 lg:px-8">
        <a
          href="/task/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-cta px-5 py-3 text-base font-semibold text-white shadow-brown transition-colors hover:bg-[#B05A28]"
        >
          {t("caseShowcase.cta")}
          <ArrowRight size={18} aria-hidden />
        </a>
      </div>
    </section>
  );
}
