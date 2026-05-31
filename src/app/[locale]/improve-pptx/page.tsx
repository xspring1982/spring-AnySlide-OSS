"use client";
// Phase 3 PR39:PPT 美化工具页(独立 /improve-pptx 路由)
// 2026-05-17 PR42:接 i18n 5 语言
// 2026-05-17 PR50:加"套用模板"toggle — 选模板时套用模板视觉(忽略上传 PPT 自己的颜色)
// 2026-05-17 PR51:简化 — 删"保留我的品牌"选项。模板必选。
//                  原因:保留品牌的需求未来通过"上传 PPT 作自定义模板"独立路径实现,
//                  跟本工具页解耦,避免一个 UI 承担两种心智模型。

import { useState, useRef } from "react";
import { Upload, Loader2, FileText } from "lucide-react";
import { useTranslations } from "next-intl";

/** 当前支持的模板 — 跟 src/lib/slides/exporters/blueprint-to-pptx.ts TEMPLATE_RENDERERS 保持一致 */
const TEMPLATE_OPTIONS = [
  {
    id: "ext-blue-professional",
    name: "Blue Professional",
    colorPrimary: "#1E2BFA",
    colorBg: "#FDFAE7",
  },
  {
    id: "ext-bold-poster",
    name: "Bold Poster",
    colorPrimary: "#D8000F",
    colorBg: "#FFFFFF",
  },
] as const;

export default function ImprovePptxPage() {
  const t = useTranslations("improvePptx");
  const [file, setFile] = useState<File | null>(null);
  const [instruction, setInstruction] = useState("");
  const [format, setFormat] = useState<"pptx" | "pdf">("pptx");
  // templateId 永远有值(默认第一个),必填
  const [templateId, setTemplateId] = useState<string>(TEMPLATE_OPTIONS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError(t("selectFirstError"));
      return;
    }
    setLoading(true);
    setError(null);
    setSummary(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("format", format);
    fd.append("templateId", templateId);
    if (instruction.trim()) fd.append("instruction", instruction.trim());

    try {
      const res = await fetch("/api/improve-pptx", { method: "POST", body: fd });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }
      // 拿 X-Improve-Summary header(URL-encoded 中文)
      const summaryEnc = res.headers.get("X-Improve-Summary");
      if (summaryEnc) setSummary(decodeURIComponent(summaryEnc));

      // 触发浏览器下载
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name.replace(/\.pptx?$/i, "")}-improved.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-md py-xl">
      {/* 用 max-w-[42rem] 而非 max-w-2xl:命名尺寸类与 globals.css @theme 的 --spacing-2xl 撞名,
          会被压成 48px → CJK 文字逐字折行。任意值绕开 token 解析。 */}
      <div className="w-full max-w-[42rem]">
        <header className="mb-xl text-center">
          <h1 className="text-display font-display text-on-surface mb-sm">
            {t("pageTitle")}
          </h1>
          <p className="text-body text-on-surface-variant">
            {t("pageSubtitle")}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="bg-surface-container rounded-2xl p-xl shadow-brown space-y-md">
          {/* 文件选择 */}
          <div>
            <label className="block text-label font-label text-on-surface mb-sm">
              {t("fileLabel")}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ppt,.pptx,.pptm,.potx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-md py-md border-2 border-dashed border-outline-variant/60 rounded-xl hover:border-primary-cta hover:bg-primary-cta/5 transition-colors"
            >
              {file ? (
                <>
                  <FileText className="w-5 h-5 text-primary-cta" />
                  <span className="text-on-surface">
                    {file.name}{" "}
                    <span className="text-on-surface-variant">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-on-surface-variant" />
                  <span className="text-on-surface-variant">{t("filePlaceholder")}</span>
                </>
              )}
            </button>
          </div>

          {/* 模板必选(2026-05-17 PR51) */}
          <div>
            <label className="block text-label font-label text-on-surface mb-sm">
              {t("templateLabel")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATE_OPTIONS.map((tpl) => {
                const selected = templateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setTemplateId(tpl.id)}
                    className={`flex items-center gap-3 px-md py-sm rounded-lg border transition-colors text-left ${
                      selected
                        ? "border-primary-cta bg-primary-cta/5"
                        : "border-outline-variant hover:border-outline"
                    }`}
                  >
                    <span
                      className="inline-block w-7 h-7 rounded-md border border-outline-variant flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${tpl.colorBg} 50%, ${tpl.colorPrimary} 50%)`,
                      }}
                    />
                    <span
                      className={`text-body font-label ${
                        selected ? "text-on-surface" : "text-on-surface-variant"
                      }`}
                    >
                      {tpl.name}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-body-small text-on-surface-variant mt-sm">
              {t("templateHelp")}
            </p>
          </div>

          {/* 优化指令(可选) */}
          <div>
            <label className="block text-label font-label text-on-surface mb-sm">
              {t("instructionLabel")}
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t("instructionPlaceholder")}
              rows={2}
              className="w-full px-md py-sm rounded-lg border border-outline-variant bg-white text-body text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-cta/30"
            />
          </div>

          {/* 输出格式 */}
          <div>
            <label className="block text-label font-label text-on-surface mb-sm">
              {t("formatLabel")}
            </label>
            <div className="flex gap-2">
              {(["pptx", "pdf"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`px-md py-sm rounded-lg text-label font-label transition-colors ${
                    format === f
                      ? "bg-primary-cta text-on-primary"
                      : "bg-white text-on-surface border border-outline-variant hover:bg-surface-container-high"
                  }`}
                >
                  {f === "pptx" ? t("formatPptx") : t("formatPdf")}
                </button>
              ))}
            </div>
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading || !file}
            className="w-full px-md py-md rounded-xl bg-primary-cta text-on-primary text-label font-label disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t("submitting")}</span>
              </>
            ) : (
              <span>{t("submit")}</span>
            )}
          </button>

          {/* 结果反馈 */}
          {summary && !error && (
            <div className="px-md py-sm rounded-lg bg-green-50 text-green-800 text-body">
              ✅ {summary}
            </div>
          )}
          {error && (
            <div className="px-md py-sm rounded-lg bg-red-50 text-red-800 text-body">
              ❌ {error}
            </div>
          )}
        </form>

        <p className="mt-md text-center text-body-small text-on-surface-variant">
          ⚠️ {t("mvpHint")}
        </p>
      </div>
    </main>
  );
}
