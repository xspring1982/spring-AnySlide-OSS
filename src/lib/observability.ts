// 观测打点统一入口(Sentry + PostHog)— SPEC §6.4
//
// 现在是 stub 实现:env 变量没填时全部 no-op,接 SDK 时换 import 即可。
// 这样上层代码能直接调 captureException / track,无需关心是否启用。
//
// 接 Sentry 步骤(未来):
//   1. npm i @sentry/nextjs
//   2. npx @sentry/wizard@latest -i nextjs
//   3. 把这里 captureException 改成 Sentry.captureException(err)
//
// 接 PostHog 步骤(未来):
//   1. npm i posthog-js posthog-node
//   2. NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_HOST 填 .env
//   3. 把 track / identify 改成 posthog.capture / posthog.identify

const sentryDsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export function captureException(err: unknown, ctx?: Record<string, unknown>): void {
  if (!sentryDsn) {
    // 本地开发:打到 console 就行
    console.error("[observability] uncaught:", err, ctx);
    return;
  }
  // TODO(M7+): Sentry.captureException(err, { extra: ctx })
  console.error("[sentry stub]", err, ctx);
}

export function captureMessage(message: string, ctx?: Record<string, unknown>): void {
  if (!sentryDsn) {
    console.warn("[observability]", message, ctx);
    return;
  }
  console.warn("[sentry stub msg]", message, ctx);
}

/** 业务事件埋点 — generate / topup / signup 等 */
export function track(
  event: string,
  properties?: Record<string, unknown>,
  userId?: string,
): void {
  if (!posthogKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[track]", event, { userId, ...properties });
    }
    return;
  }
  // TODO(M7+): posthog.capture({ distinctId: userId ?? '$anon', event, properties })
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (!posthogKey) return;
  // TODO(M7+): posthog.identify({ distinctId: userId, properties: traits })
  void traits;
}

/** 给 client component 用的快捷判断 */
export function isObservabilityEnabled(): boolean {
  return !!(sentryDsn || posthogKey);
}
