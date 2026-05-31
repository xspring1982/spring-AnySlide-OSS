// next-intl 提供的 i18n-aware Link / useRouter / usePathname
// 用法:`import { Link, useRouter } from "@/i18n/navigation"`(替换原 "next/link" / "next/navigation")
// 这样 <Link href="/pricing"> 自动加 locale 前缀(en 用户看 /en/pricing)

import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
