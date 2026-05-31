// 动态生成默认 OG / 分享卡图片
//
// SPEC §6.5.3。无需手工准备 1200x630 PNG —— Next 16 内置 ImageResponse 在 edge runtime 渲染。
// 路由覆盖:同一文件被 metadata.openGraph.images 默认引用。

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AnySlide — AI 幻灯片 / 图片";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #ECECEC 0%, #F0F0F0 50%, #F5F5F5 100%)",
          padding: "80px",
          color: "#1F1F1F",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "32px",
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "#C96B35",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "32px",
              fontWeight: 800,
              boxShadow: "4px 4px 0px #1F1F1F",
            }}
          >
            A
          </div>
          AnySlide
        </div>
        <div
          style={{
            marginTop: "60px",
            fontSize: "84px",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-1.5px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>AI 幻灯片 · 图片</span>
          <span style={{ color: "#C96B35", fontSize: "60px", marginTop: "12px" }}>
            一键生成,原生中文
          </span>
        </div>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: "24px",
            color: "#6B6B6B",
          }}
        >
          <span>slides · image · 共用积分</span>
          <span style={{ fontWeight: 700, color: "#1F1F1F" }}>open source</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
