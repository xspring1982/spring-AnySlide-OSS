// 公开 landing 页 — SPEC §6.1 5.4
//
// 三栏结构:hero + 三模块 features + CTA。

import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { localizedAlternates } from "@/i18n/alternates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "AnySlide - AI 幻灯片 / 图片生成",
    description: "粘贴文章 / 链接,AI 一键生成幻灯片、AI 图片。原生支持中文渲染。",
    alternates: localizedAlternates("/landing", locale),
  };
}

const FEATURES: Array<{
  emoji: string;
  title: string;
  desc: string;
  href: string;
  color: string;
}> = [
  {
    emoji: "📊",
    title: "AI 幻灯片",
    desc: "HTML 模板 1 积分/页(纯 LLM,几乎免费),AI 图 5 积分/页。10 个 HTML 模板 + 28 个 AI 图风格,直出 PPTX / PDF。",
    href: "/task/new?mode=slides",
    color: "from-blue-50 to-indigo-100",
  },
  {
    emoji: "🎨",
    title: "AI 图片",
    desc: "12 风格预设 + Enhance prompt 增强。一次出 1 / 2 / 4 张。原生支持中文文字嵌入图像。",
    href: "/task/new?mode=image",
    color: "from-rose-50 to-pink-100",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-main-bg">
      <header className="h-16 flex items-center justify-between px-md border-b border-outline-variant/30 bg-white/70 backdrop-blur-sm sticky top-0 z-10">
        <Link href="/" className="font-h3 text-h3 text-on-surface">
          AnySlide
        </Link>
        <nav className="flex items-center gap-md text-[14px]">
          <Link href="/landing" className="text-on-surface font-medium">
            首页
          </Link>
          <Link href="/pricing" className="text-on-surface-variant hover:text-on-surface">
            定价
          </Link>
          <Link href="/login" className="text-on-surface-variant hover:text-on-surface">
            登录
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-1.5 rounded-full bg-primary-cta text-on-primary hover:bg-primary-container transition-colors"
          >
            免费试用
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-[1100px] mx-auto px-md pt-2xl pb-xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-cta/10 text-primary-cta text-[12px] font-medium mb-md">
          ✨ 中文文字直接嵌入 AI 图,业界最稳 — gpt-image-2
        </div>
        <h1 className="font-h1 text-[48px] md:text-[64px] leading-tight text-on-surface mb-md">
          把任何内容
          <br />
          变成 <span className="text-primary-cta">看得懂的图</span>
        </h1>
        <p className="text-body text-[18px] text-on-surface-variant max-w-[640px] mx-auto mb-lg">
          粘贴文章 / 链接 / PDF,AnySlide 用 AI 帮你做成幻灯片、画成 AI 图片。
          多步澄清,联网调研,中文绝不翻车。
        </p>
        <div className="flex items-center justify-center gap-md">
          <Link
            href="/sign-up"
            className="px-md py-3 rounded-full bg-primary-cta text-on-primary text-[15px] font-medium hover:bg-primary-container transition-colors shadow-lg"
          >
            免费试用 · 注册赠 60 积分
          </Link>
          <Link
            href="/pricing"
            className="px-md py-3 rounded-full border border-outline-variant text-on-surface text-[15px] font-medium hover:bg-surface-container transition-colors"
          >
            看定价
          </Link>
        </div>
      </section>

      {/* Three modules */}
      <section className="max-w-[1100px] mx-auto px-md pb-2xl">
        <h2 className="font-h2 text-h2 text-center text-on-surface mb-xl">两个模块,一套体验</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {FEATURES.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className={`group rounded-2xl p-xl bg-gradient-to-br ${f.color} hover:scale-[1.02] transition-transform shadow-sm hover:shadow-lg`}
            >
              <div className="text-5xl mb-md">{f.emoji}</div>
              <h3 className="font-h3 text-h3 text-on-surface mb-sm">{f.title}</h3>
              <p className="text-[14px] text-on-surface-variant leading-relaxed mb-md">
                {f.desc}
              </p>
              <span className="text-[13px] text-primary-cta font-medium group-hover:underline">
                进入 →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[800px] mx-auto px-md pb-2xl text-center">
        <div className="rounded-2xl bg-on-surface text-white px-xl py-2xl">
          <h2 className="font-h2 text-h2 mb-md">现在就试一试</h2>
          <p className="text-[14px] opacity-90 mb-lg">
            注册即可获得 60 积分,够你跑两轮真实测试。每天还自动重置 10 积分。
          </p>
          <Link
            href="/sign-up"
            className="inline-block px-md py-3 rounded-full bg-primary-cta text-on-primary text-[15px] font-medium hover:bg-primary-container transition-colors"
          >
            免费试用 →
          </Link>
        </div>
      </section>

      <footer className="border-t border-outline-variant/30 bg-white px-md py-md text-center text-[12px] text-on-surface-variant">
        © {new Date().getFullYear()} AnySlide ·{" "}
        <Link href="/landing" className="hover:underline">
          首页
        </Link>{" "}
        ·{" "}
        <Link href="/pricing" className="hover:underline">
          定价
        </Link>
      </footer>
    </main>
  );
}
