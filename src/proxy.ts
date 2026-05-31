// SPEC §5.1.4 — Clerk middleware + next-intl i18n routing(2026-05-05 PR 2)
//
// 鉴权策略:
//   公开页:landing / pricing / templates / login / sign-up + 首页 + legal
//   公开 API:webhook(stripe + clerk + inngest)+ /api/me + /api/templates
//   其余全部强鉴权
//
// i18n 策略:
//   localePrefix: 'as-needed' — 默认 en URL 不变(/pricing),其他语言带前缀(/zh/pricing)
//   next-intl middleware 处理 locale 检测 + redirect
//   API 路由不参与 i18n(matcher 排除 /api)
//
// 中间件执行顺序:
//   1. Clerk 检查鉴权(优先,否则未登录用户能访问 i18n redirect 后的私有页)
//   2. i18n middleware 处理 locale routing + 检测

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { GEO_COOKIE_NAME, isEUCountry, type GeoZone } from "@/lib/consent/types";

const intlMiddleware = createIntlMiddleware(routing);

// Geo gate:从常见托管/CDN country header 解析 + 写 cookie
// 让客户端 ConsentProvider 决定是否弹 cookie banner(仅 EU/EEA/UK/CH)
//
// Dev mock:?eu=1 强制 EU、?eu=0 强制 ROW;query string 优先于 header
function resolveGeoZone(req: NextRequest): GeoZone {
  const override = req.nextUrl.searchParams.get("eu");
  if (override === "1") return "EU";
  if (override === "0") return "ROW";
  const country =
    req.headers.get("cf-ipcountry") ??
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("x-country-code");
  return isEUCountry(country) ? "EU" : "ROW";
}

function ensureGeoCookie(req: NextRequest, res: NextResponse): NextResponse {
  // 已有 cookie 且非 dev override → 不重写(避免每次请求都翻动 Set-Cookie)
  const existing = req.cookies.get(GEO_COOKIE_NAME)?.value;
  const override = req.nextUrl.searchParams.get("eu");
  if (existing && override === null) return res;

  const zone = resolveGeoZone(req);
  res.cookies.set(GEO_COOKIE_NAME, zone, {
    path: "/",
    sameSite: "lax",
    httpOnly: false, // 客户端 ConsentProvider 需要读
    maxAge: 60 * 60 * 24, // 1 天(够长期会话用,又能在用户漫游时及时更新)
  });
  return res;
}

// 公开页面:展开每个 locale 的所有路径(path-to-regexp 6.x 不支持 (?:...) 组)
// 默认 locale (en) 不带前缀,其他 4 种 (zh / zh-TW / ja / ko) 带前缀
const PUBLIC_BASE_PATHS = [
  "",
  "/landing(.*)",
  "/pricing(.*)",
  "/improve-pptx(.*)",
  "/templates(.*)",
  "/template/(.*)",
  "/login(.*)",
  "/sign-up(.*)",
  "/legal/(.*)",
];
const NON_DEFAULT_LOCALES = ["zh", "zh-TW", "ja", "ko"];

const PUBLIC_PAGES = createRouteMatcher([
  // 根路径 + 默认 locale (en) 不带前缀
  "/",
  ...PUBLIC_BASE_PATHS.map((p) => p || "/"),
  // 4 种非默认 locale 都带前缀
  ...NON_DEFAULT_LOCALES.flatMap((loc) =>
    PUBLIC_BASE_PATHS.map((p) => `/${loc}${p}`),
  ),
]);

const PUBLIC_API = createRouteMatcher([
  "/api/webhooks/stripe(.*)",
  "/api/clerk/webhook(.*)",
  "/api/inngest(.*)",
  "/api/me(.*)",
  "/api/templates(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // API 路径:Clerk 鉴权 only,不进 i18n routing,也不需要 geo cookie
  if (req.nextUrl.pathname.startsWith("/api/")) {
    if (PUBLIC_API(req)) return;
    await auth.protect();
    return;
  }

  // 页面路径:先 Clerk 鉴权检查,通过后交给 i18n middleware 处理 locale
  if (!PUBLIC_PAGES(req)) {
    await auth.protect();
  }
  // intlMiddleware 可能返回 redirect 或继续 pipeline 的 response;
  // 不管哪种,都给它打上 geo cookie(redirect 时跟随 set-cookie,下一跳就有)
  const res = intlMiddleware(req) ?? NextResponse.next();
  return ensureGeoCookie(req, res);
});

export const config = {
  // 跳过静态资源 + sitemap.xml + robots.txt + opengraph-image
  matcher: [
    "/((?!_next|sitemap.xml|robots.txt|opengraph-image|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
