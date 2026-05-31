// /sign-up — SPEC §5.1.1 公开路由
// 直接挂 Clerk <SignUp /> 标准组件:Google + Email 全套官方流程
// 不再用占位 LoginForm
//
// 2026-05-10 PR25:metadata + UI 全部 i18n 化

import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { SignUp } from "@clerk/nextjs";
import { getTranslations } from "next-intl/server";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t("auth.signUp.metaTitle"),
    description: t("auth.signUp.metaDescription"),
  };
}

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  // localePrefix='as-needed':默认 locale(en)URL 不带前缀,Clerk path 必须严格等于 URL,否则不渲染表单
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-surface px-md py-xl gap-md relative">
      <Link
        href="/"
        className="fixed top-4 left-4 inline-flex items-center gap-1 text-[14px] text-on-surface-variant hover:text-on-surface transition-colors z-10"
      >
        <span aria-hidden>←</span>
        <span>{t("nav.backHome")}</span>
      </Link>
      <BrandHeader
        title={t("auth.signUp.title")}
        subtitle={t("auth.signUp.subtitle")}
      />
      <SignUp
        path={`${prefix}/sign-up`}
        routing="path"
        signInUrl={`${prefix}/login`}
        fallbackRedirectUrl={prefix || "/"}
        appearance={{
          variables: {
            colorPrimary: "#C96B35",
            borderRadius: "0.75rem",
          },
        }}
      />
    </main>
  );
}
