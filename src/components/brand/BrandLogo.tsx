"use client";

import Image from "next/image";

type BrandLogoProps = {
  logoSize?: number;
  fontSize?: number;
};

export function BrandLogo({ logoSize = 30, fontSize = 22 }: BrandLogoProps) {
  const gap = 0;
  const nudgeDown = Math.round(fontSize * 0.08);

  return (
    <span
      className="as-brand-logo"
      style={{ gap }}
    >
      <Image
        src="/brand/anyslide-logo.png"
        width={logoSize}
        height={logoSize}
        alt="AnySlide"
        priority
      />
      <span
        className="as-brand-word"
        style={{ fontSize, transform: `translateY(${nudgeDown}px)` }}
        aria-hidden
      >
        <span className="as-brand-ny">ny</span>
        <span className="as-brand-slide">Slide</span>
      </span>
    </span>
  );
}
