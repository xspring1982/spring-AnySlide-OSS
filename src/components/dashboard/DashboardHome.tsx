"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import type { AppliedTemplate, ComposerSubmitPayload } from "./PromptComposer";
import { Bell, Crown, PanelLeft, User, X } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { LanguagePicker } from "@/components/i18n/LanguagePicker";
import { FAQSection } from "./FAQSection";
import { FeaturesSection } from "./FeaturesSection";
import { OnboardingModal } from "./OnboardingModal";

// T2-54:推广 banner 的版本 key — 改文案时**必须**改这个常量,
// 这样 localStorage 里旧 key 的 dismissal 不会再压制新文案,banner 会重新弹给所有用户。
// 命名约定:`<topic>-<YYYY-MM-DD>`,例 "launch-2026-05-05" / "new-feature-2026-05-08"
const BANNER_KEY = "launch-2026-05-05";
const BANNER_DISMISS_STORAGE = "anyslide_dismissed_banners";
import { PromptComposer } from "./PromptComposer";
import { SiteFooter } from "./SiteFooter";
import { SocialProofSection } from "./SocialProofSection";
import { TemplateGrid, type Template } from "./TemplateGrid";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";
import { TestimonialsSection } from "./TestimonialsSection";

// placeholder 走 i18n(messages.composer.placeholderRotating1-4)— 已 5 语言齐备
const PLACEHOLDER_KEYS = [
  "composer.placeholderRotating1",
  "composer.placeholderRotating2",
  "composer.placeholderRotating3",
  "composer.placeholderRotating4",
];

// 2026-05-10 PR26:languagePages / activeLanguage / languageOpen 三件套全部下放到
// 共享的 LanguagePicker 组件,见 src/components/i18n/LanguagePicker.tsx

export type CreationMode = "AI 图文卡片" | "AI 幻灯片" | "AI 图片";

/** SPEC §1.1 — 一级 chip → API mode 字段 */
const MODE_BY_CREATION: Record<CreationMode, "cards" | "slides" | "image"> = {
  "AI 图文卡片": "cards",
  "AI 幻灯片": "slides",
  "AI 图片": "image",
};

const CREATION_BY_MODE: Record<"cards" | "slides" | "image", CreationMode> = {
  cards: "AI 图文卡片",
  slides: "AI 幻灯片",
  image: "AI 图片",
};

// 反映 mode query → CreationMode 标签(供 TaskWorkspace 等外部跳转用)
const MODE_FROM_QUERY: Record<string, CreationMode> = {
  cards: "AI 图文卡片",
  slides: "AI 幻灯片",
  image: "AI 图片",
};

export function DashboardHome() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  // 2026-05-17 PR46:首页 sidebar 默认收起(用户反馈展开占空间)
  // 跟 task 页(TaskWorkspace,默认 true)行为一致
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [promptValue, setPromptValue] = useState("");
  // M5+ 模板应用状态:appliedTemplate 锁内部 style/ratio/generationMode
  const [appliedTemplate, setAppliedTemplate] = useState<AppliedTemplate | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  // T2-54:SSR-safe 默认 false 避免首屏闪烁,mount 后读 localStorage 决定
  const [offerVisible, setOfferVisible] = useState(false);
  const [offerInView, setOfferInView] = useState(true);

  function dismissBanner() {
    setOfferVisible(false);
    try {
      const raw = localStorage.getItem(BANNER_DISMISS_STORAGE);
      const dismissed: string[] = raw ? JSON.parse(raw) : [];
      if (!dismissed.includes(BANNER_KEY)) {
        dismissed.push(BANNER_KEY);
        localStorage.setItem(BANNER_DISMISS_STORAGE, JSON.stringify(dismissed));
      }
    } catch {
      /* localStorage 不可用(如隐私模式) — 仅本次会话生效 */
    }
  }
  // ?mode=cards|slides|image 初始化创作模式;TaskWorkspace 跳过来时会带这个 query
  // 2026-05-04 调顺:默认入口改为 AI 幻灯片(模板矩阵最丰富,引导效果最好)
  // 2026-05-28:cards 重新上线为图文笔记,query mode=cards 可直达。
  const queryMode = searchParams?.get("mode") ?? "";
  const fromQuery = MODE_FROM_QUERY[queryMode];
  const initialMode: CreationMode = fromQuery ?? "AI 幻灯片";
  const [activeCreationMode, setActiveCreationMode] = useState<CreationMode>(initialMode);

  // query 变化也跟着切(同页内 router.push 不会重 mount)
  useEffect(() => {
    const next = MODE_FROM_QUERY[queryMode];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 同页 query 导航需要同步到本地 mode 状态。
    if (next) setActiveCreationMode(next);
  }, [queryMode]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPlaceholderIndex((index) => (index + 1) % PLACEHOLDER_KEYS.length);
    }, 3200);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const OFFER_HEIGHT = 44;
    const handleScroll = () => setOfferInView(window.scrollY < OFFER_HEIGHT);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function resetWorkspace() {
    setPromptValue("");
    setOnboardingOpen(false);
  }

  function handleCreationModeChange(mode: CreationMode) {
    const nextMode = MODE_BY_CREATION[mode];
    setActiveCreationMode(mode);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `${window.location.pathname}?mode=${nextMode}#mode-${nextMode}`);
    }
    // 用户主动切 mode → 清模板(否则模板锁定的 mode 会被覆盖,体验混乱)
    if (appliedTemplate && appliedTemplate.mode !== nextMode) {
      setAppliedTemplate(null);
    }
  }

  function goHome() {
    setPromptValue("");
    setActiveCreationMode("AI 幻灯片"); // 2026-05-04 调顺:幻灯片做默认入口
    setPreviewTemplate(null);
  }

  async function handleSubmit(payload: ComposerSubmitPayload) {
    if (submitting) return;
    const currentMode = MODE_BY_CREATION[activeCreationMode];
    const requiresTemplate = currentMode === "cards" || currentMode === "slides";
    // cards / slides 都走模板优先:无模板时拦住并滚到对应模板墙。
    if (requiresTemplate && appliedTemplate?.mode !== currentMode) {
      window.alert(t("composer.templateRequired"));
      document.getElementById(currentMode === "cards" ? "mode-cards" : "mode-slides")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    const userInput = promptValue.trim() || t(PLACEHOLDER_KEYS[placeholderIndex] as never);
    setOnboardingOpen(false);
    setPromptValue(userInput);
    setSubmitting(true);

    // M5+ 模板:有 promptSeed → 把 user_input 替换 {user_content} 占位,组装最终 prompt
    let finalPrompt = userInput;
    if (appliedTemplate?.promptSeed) {
      finalPrompt = appliedTemplate.promptSeed.includes("{user_content}")
        ? appliedTemplate.promptSeed.replace(/\{user_content\}/g, userInput)
        : `${appliedTemplate.promptSeed}\n\n【用户内容】\n${userInput}`;
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: currentMode,
          source_text: finalPrompt,
          style_id: payload.styleId,
          ratio: payload.ratio,
          generation_mode: payload.generationMode,
          template_id: appliedTemplate?.dbBacked ? appliedTemplate.id : undefined,
          // image-only 字段（cards/slides 提交 undefined，API 自动忽略）
          enhance: payload.enhance,
          count: payload.count,
        }),
      });

      // 2026-05-09 鲁棒性修(PR6):
      // 未登录时 Clerk middleware 会把 POST /api/tasks rewrite 到 /[locale]/login 返回
      // HTML 登录页(status 200),前端无脑 res.json() 会拿到 "<!DOCTYPE..." 抛 SyntaxError。
      // 这里识别两种"被踢去登录"信号(redirected / URL 含 /login / 200 但不是 JSON),
      // 友好提示并跳登录页,而不是 raw JSON parse error。
      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");
      const looksLikeLoginRedirect =
        res.redirected ||
        res.url.includes("/login") ||
        (!isJson && res.status === 200);
      if (looksLikeLoginRedirect || res.status === 401) {
        window.alert(t("task.loginRequired"));
        const next = window.location.pathname + window.location.search;
        router.push(`/login?redirect_url=${encodeURIComponent(next)}`);
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        const err = isJson ? await res.json().catch(() => ({})) : {};
        throw new Error(err.error ?? `创建任务失败 (HTTP ${res.status})`);
      }
      const { taskId, projectId } = (await res.json()) as {
        taskId: string;
        projectId?: string;
      };
      // M5+:统一跳到 /project/[id](三模块都进 project workspace)
      router.push(projectId ? `/project/${projectId}` : `/task/${taskId}`);
    } catch (err) {
      console.error("[handleSubmit]", err);
      window.alert(err instanceof Error ? err.message : t("task.createFailed"));
      setSubmitting(false);
    }
  }

  function handleUseTemplate(template: Template) {
    setPreviewTemplate(null);
    setOnboardingOpen(false);

    // M5+ 模板矩阵化(2026-05-03 调整):
    // promptSeed 不再塞进 textarea(避免长 prompt 占满输入框),
    // 只挂载 appliedTemplate 给 PromptComposer 显示小 badge,
    // 用户输入自己的内容,提交时 handleSubmit 把 promptSeed 与 user_content 拼接发后端。
    const modeMap: Record<Template["mode"], CreationMode> = {
      cards: "AI 图文卡片",
      slides: "AI 幻灯片",
      image: "AI 图片",
    };
    setActiveCreationMode(modeMap[template.mode]);

    // 2026-05-05 Bug 1 修:之前 if (template.promptSeed) 但 /api/templates 没返
    // promptSeed 字段(只返 hasPromptSeed: true 标记),导致 badge 永远不显示。
    // 现在:点模板就设 appliedTemplate(badge 显示模板名),后端用 template_id 查 DB。
    setAppliedTemplate({
      id: template.id,
      title: template.title,
      mode: template.mode,
      lockedStyleId: template.lockedStyleId,
      lockedRatio: template.lockedRatio,
      lockedGenerationMode: template.lockedGenerationMode,
      dbBacked: template.dbBacked,
      promptSeed: template.promptSeed,
    });

    setTimeout(() => {
      document.getElementById("anyslide-prompt")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      document.getElementById("anyslide-prompt")?.focus();
    }, 100);
  }

  return (
    <main
      className={`as-home ${sidebarCollapsed ? "as-sidebar-collapsed" : ""} ${
        // 2026-05-06 修:as-offer-visible 必须跟 banner 真实渲染条件一致(下方 line 256
        // 渲染 banner 时也判 !isSignedIn)。否则已登录用户 offerVisible 仍可能 true,
        // 导致 CSS 把 sidebar / 主区往下推 44px,但 banner 不渲染 → 顶部空 44px。
        offerVisible && offerInView && !isSignedIn ? "as-offer-visible" : ""
      }`}
    >
      {/* 推广横幅:已登录用户隐藏(他们已经领过 60 积分,展示无意义且"立即领取"按钮也无效)
          文案修正:每日重置至 10 而非送 10(避免反不正当竞争法风险) */}
      {offerVisible && !isSignedIn ? (
        <aside className="as-offer-bar" aria-label="Promotion">
          <div className="as-offer-content">
            <span className="as-offer-badge">{t("banner.badge")}</span>
            <strong>{t("banner.text")}</strong>
            <Link href="/sign-up">{t("banner.cta")}</Link>
          </div>
          <button
            className="as-offer-close"
            type="button"
            aria-label="Close promotion"
            onClick={dismissBanner}
          >
            <X aria-hidden />
          </button>
        </aside>
      ) : null}

      <AppSidebar
        activeCreationMode={activeCreationMode}
        onHome={goHome}
        onNewTask={resetWorkspace}
        onCreationModeChange={setActiveCreationMode}
        onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />

      <section className="as-app-shell">
        <header className="as-topbar">
          <button
            className="as-mobile-menu"
            type="button"
            aria-label="Sidebar"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            <PanelLeft aria-hidden />
          </button>

          <div className="as-topbar-actions">
            <Link className="as-topbar-action as-pricing-link" href="/pricing" title={t("nav.pricing")}>
              <Crown aria-hidden />
              <span>{t("nav.pricing")}</span>
            </Link>

            <button className="as-topbar-icon" type="button" aria-label={t("dashboard.notifications")} title={t("dashboard.notifications")}>
              <Bell aria-hidden />
              <em aria-hidden />
            </button>

            {/* 2026-05-10 PR26:复用共享 LanguagePicker(同一组件已在
                MarketingTopBar / SiteFooter 落地);click-outside / cookie / hard navigate
                行为内置,不再需要外层 onClick 协调 */}
            <LanguagePicker variant="topbar" />

            {userLoaded && isSignedIn ? (
              <div className="as-topbar-menu">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-9 h-9",
                    },
                  }}
                />
              </div>
            ) : (
              <Link className="as-sign-in" href="/login">
                <User aria-hidden />
                {t("nav.loginOrSignUp")}
              </Link>
            )}
          </div>
        </header>

        <PromptComposer
          prompt={promptValue}
          placeholder={t(PLACEHOLDER_KEYS[placeholderIndex] as never)}
          activeCreationMode={activeCreationMode}
          onPromptChange={setPromptValue}
          onSubmit={handleSubmit}
          submitting={submitting}
          onCreationModeChange={handleCreationModeChange}
          appliedTemplate={appliedTemplate}
          onClearTemplate={() => {
            setAppliedTemplate(null);
            setPromptValue("");
          }}
        />

        <div id="template-grid-section">
          <TemplateGrid
            key={MODE_BY_CREATION[activeCreationMode]}
            activeMode={MODE_BY_CREATION[activeCreationMode]}
            onModeChange={(mode) => handleCreationModeChange(CREATION_BY_MODE[mode])}
            onPreview={setPreviewTemplate}
          />
        </div>

        <FeaturesSection />
        <TestimonialsSection />
        <SocialProofSection />
        <FAQSection />
        <SiteFooter />
      </section>

      <TemplatePreviewDialog
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onUseTemplate={handleUseTemplate}
      />

      <OnboardingModal
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onTry={() => {
          setOnboardingOpen(false);
        }}
      />
    </main>
  );
}
