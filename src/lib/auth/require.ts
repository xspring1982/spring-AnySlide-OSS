// SPEC §5.1.4 — API 路由统一鉴权 helper(M5+)
// 替代散落各处的 DEV_USER_ID fallback

import { auth } from "@clerk/nextjs/server";

type RequireUserResult =
  | { error: Response; userId: null }
  | { error: null; userId: string };

/**
 * 在 API 路由开头调用:未登录返 401 Response,登录返 userId
 *
 * 用法:
 *   const { error, userId } = await requireUser();
 *   if (error) return error;
 *   // 这里 userId 类型已收窄为 string
 */
export async function requireUser(): Promise<RequireUserResult> {
  try {
    const a = await auth();
    if (!a.userId) {
      return {
        error: Response.json(
          { error: "请先登录", authenticated: false },
          { status: 401 },
        ),
        userId: null,
      };
    }
    return { error: null, userId: a.userId };
  } catch {
    return {
      error: Response.json(
        { error: "鉴权失败", authenticated: false },
        { status: 401 },
      ),
      userId: null,
    };
  }
}
