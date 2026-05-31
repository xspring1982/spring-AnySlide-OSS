// 登录表单（Google OAuth + Email magic link）
// 当前：UI 完整 + 占位 onSubmit
// 接入 Clerk 阶段：用 useSignIn() hook 替换占位逻辑

"use client";

import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { GoogleIcon } from "@/components/auth/GoogleIcon";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<"google" | "email" | null>(null);

  async function handleGoogle() {
    setPending("google");
    // TODO(auth): signIn.authenticateWithRedirect({ strategy: 'oauth_google', redirectUrl: '/sso-callback', redirectUrlComplete: '/dashboard' })
    await new Promise((r) => setTimeout(r, 600));
    alert("Google 登录占位 — 接 Clerk 后跳转 OAuth 流程");
    setPending(null);
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPending("email");
    // TODO(auth): signIn.create({ identifier: email, strategy: 'email_link' })
    await new Promise((r) => setTimeout(r, 600));
    alert(`Email magic link 占位 — 接 Clerk 后会发链接到 ${email}`);
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-md">
      {/* Google Button */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={pending !== null}
        className="w-full flex items-center justify-center gap-sm bg-white hover:bg-stone-50 disabled:opacity-60 disabled:cursor-not-allowed text-on-surface font-label text-label py-md px-md rounded-lg transition-colors border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary-cta/20"
      >
        <GoogleIcon className="w-5 h-5" />
        {pending === "google" ? "正在跳转…" : "使用 Google 继续"}
      </button>

      {/* Divider */}
      <div className="flex items-center my-sm">
        <div className="flex-grow border-t border-outline-variant/40" />
        <span className="px-md font-label text-label text-on-surface-variant bg-white">
          或
        </span>
        <div className="flex-grow border-t border-outline-variant/40" />
      </div>

      {/* Email Form */}
      <form onSubmit={handleEmail} className="flex flex-col gap-md">
        <div className="relative">
          <label htmlFor="email" className="sr-only">
            邮箱地址
          </label>
          <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none text-on-surface-variant">
            <Mail className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱地址"
            className="w-full pl-[40px] pr-md py-md rounded-lg border border-outline-variant/60 bg-white text-on-surface font-body text-body focus:ring-2 focus:ring-primary-cta/20 focus:border-primary-cta transition-colors placeholder:text-on-surface-variant/70"
          />
        </div>

        <button
          type="submit"
          disabled={pending !== null || !email}
          className="w-full bg-primary-cta hover:bg-primary-container disabled:opacity-60 disabled:cursor-not-allowed text-on-primary font-label text-label py-md px-md rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-cta/40 shadow-sm flex items-center justify-center gap-sm"
        >
          {pending === "email" ? "正在发送…" : "通过邮箱继续"}
          <ArrowRight className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
