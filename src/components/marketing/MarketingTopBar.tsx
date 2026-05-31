// 公开页(pricing / templates / login 等)通用顶栏
// 不带 sidebar,保留首页的品牌识别 + 登录入口
//
// 2026-05-10 PR25:i18n 化 + 加 LanguagePicker
// 之前导航文案全是中文硬编码,营销页 / 法律页非英文用户被困住。

import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LanguagePicker } from "@/components/i18n/LanguagePicker";

export async function MarketingTopBar() {
  const t = await getTranslations();
  return (
    <header className="sticky top-0 z-30 w-full border-b border-outline-variant/30 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-md md:px-xl">
        <Link href="/" className="flex items-center gap-sm">
          <BrandLogo logoSize={28} fontSize={20} />
        </Link>

        <nav className="hidden md:flex items-center gap-xl text-label font-label text-on-surface">
          <Link
            href="/"
            className="hover:text-primary-cta transition-colors"
          >
            {t("nav.home")}
          </Link>
          <Link
            href="/templates"
            className="hover:text-primary-cta transition-colors"
          >
            {t("nav.templates")}
          </Link>
          <Link
            href="/pricing"
            className="hover:text-primary-cta transition-colors"
          >
            {t("nav.pricing")}
          </Link>
        </nav>

        <div className="flex items-center gap-sm">
          <LanguagePicker variant="topbar" />
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center px-md py-[6px] text-label font-label text-on-surface hover:text-primary-cta transition-colors"
          >
            {t("nav.login")}
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center px-md py-[6px] rounded-full bg-primary-cta text-on-primary text-label font-label hover:bg-primary-container transition-colors shadow-sm"
          >
            {t("nav.freeTrial")}
          </Link>
        </div>
      </div>
    </header>
  );
}
