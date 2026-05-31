// SPEC §6.5.5 robots.txt
//
// 允许:首页 / landing / pricing / 登录注册 / 公开模板浏览(Phase 2)
// 禁止:用户私域 /dashboard / /task / /settings / /billing 以及 /api/*

import type { MetadataRoute } from "next";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const base = baseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/dashboard",
          "/dashboard/",
          "/task/",
          "/settings",
          "/settings/",
          "/billing",
          "/billing/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
