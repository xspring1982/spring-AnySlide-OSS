// 登录 / 注册页顶部品牌区
// prototype/login.html 顶部 logo + tagline 部分

import Image from "next/image";

type Props = {
  title: string;
  subtitle?: string;
};

export function BrandHeader({ title, subtitle }: Props) {
  return (
    <div className="text-center mb-xl">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-cta/10 mb-md">
        <Image
          src="/brand/anyslide-logo.png"
          width={36}
          height={36}
          alt=""
          aria-hidden
          priority
        />
      </div>
      <h1 className="font-h1 text-h1 text-on-surface tracking-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="font-body text-body text-on-surface-variant mt-sm">
          {subtitle}
        </p>
      )}
    </div>
  );
}
