// Phase 4 PR43:粘链接抓内容 endpoint
//
// POST /api/uploads/fetch-link
//   body: { url: string }
//   returns: { ok, markdown, title?, error? }
//
// 流程:
//   1. 鉴权 + 校验 URL 格式
//   2. 调 Jina Reader API(r.jina.ai/<URL>)抓网页正文 markdown
//   3. 返回 markdown 给前端,前端拼到 prompt textarea
//
// 对标 AnyGen "Convert" 入口里的"粘链接生成 deck"路径。
// 我们更轻量:不存 DB / 不创建 task,只返抓到的 markdown,用户自己决定生成什么。

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require";
import { fetchOne } from "@/lib/ai/research/jina";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

interface Body {
  url: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  const { error, userId } = await requireUser();
  if (error) return error;
  void userId; // 抓链接是免费的(jina 自己限流),不扣积分,但需要登录(防爬)

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  const url = body.url?.trim();
  if (!url) {
    return Response.json({ ok: false, error: "缺少 url" }, { status: 400 });
  }
  // 简单 URL 校验
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ ok: false, error: "url 格式错误" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return Response.json(
      { ok: false, error: "仅支持 http(s) 链接" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchOne(url);
    if (!result || !result.content) {
      return Response.json(
        { ok: false, error: "抓取失败,可能是反爬或链接无效" },
        { status: 502 },
      );
    }
    return Response.json({
      ok: true,
      markdown: result.content,
      sourceUrl: result.sourceUrl,
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: `抓取异常: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 500 },
    );
  }
}
