// Inngest 函数 HTTP 适配端点
//
// 本地 dev:`npx inngest-cli@latest dev` 自动发现这个 endpoint(默认 sniff 8288)。
// 生产:Inngest Cloud 通过 INNGEST_SIGNING_KEY 环境变量验签。

import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { allFunctions } from "@/inngest/functions";

// Inngest SDK 自动从 INNGEST_SIGNING_KEY 环境变量读签名密钥,无需显式传
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: allFunctions,
});
