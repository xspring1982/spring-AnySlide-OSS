// next-intl 服务端 locale 解析(每个 SSR/RSC request 调一次)
//
// Next.js 16 + next-intl 4:从 routing 拿 locale + 加载对应 messages 文件

import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale 可能是 undefined(根路径未匹配 locale segment),fallback 到 defaultLocale
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
