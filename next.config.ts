import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// 2026-05-05 PR 2:next-intl 插件,加载 src/i18n/request.ts 配置
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);
