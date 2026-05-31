"use client";

// task 页 slides 模式的"模板选择"弹窗 — 替代以前跳首页的体验
//
// 流程:
//   1. mount 时调 /api/templates 拉所有模板,只过滤 mode === "slides"
//   2. 用户点缩略图 → onPick(template) 把 id/title 传回父组件
//   3. 父组件存 selectedSlideTemplate,提交 task 时把 template_id 带给后端
//      (跟首页 DashboardHome appliedTemplate 一致,后端用 promptSeed 包装 source_text)

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

/** niche key 映射 — 跟 TemplateGrid 用同一套 templateGrid.* keys
 * 2026-05-09 PR4:slides 用新 8 分类(商务/编辑/工作室/品牌/复古/教育/科技/海报),
 * 旧 cards niche 保留兜底以防带 cards 模板进来。
 */
const NICHE_KEY: Record<string, string> = {
  "全部": "templateGrid.filterAll",
  "商务": "templateGrid.nicheBusiness",
  "编辑": "templateGrid.nicheEditorial",
  "工作室": "templateGrid.nicheStudio",
  "品牌": "templateGrid.nicheLifestyle",
  "复古": "templateGrid.nicheRetro",
  "教育": "templateGrid.nicheEducation",
  "科技": "templateGrid.nicheTech",
  "海报": "templateGrid.nichePoster",
  "职场": "templateGrid.nicheCareer",
  "理财": "templateGrid.nicheFinance",
  "读书": "templateGrid.nicheReading",
  "美妆": "templateGrid.nicheBeauty",
  "健康": "templateGrid.nicheHealth",
  "国风": "templateGrid.nicheCulture",
  "旅行": "templateGrid.nicheTravel",
};

export interface SlideTemplate {
  id: string;
  title: string;
  niche: string;
  uses: string;
  thumbClass: string;
  headline: string;
  subhead?: string;
  imageSrc?: string;
}

type ApiTemplate = SlideTemplate & { mode: string };

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (t: SlideTemplate) => void;
}

export function SlidesTemplatePickerModal({ open, onClose, onPick }: Props) {
  const t = useTranslations();
  const [templates, setTemplates] = useState<SlideTemplate[] | null>(null);
  const [activeNiche, setActiveNiche] = useState("全部");

  useEffect(() => {
    if (!open) return;
    if (templates !== null) return;
    fetch("/api/templates", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { templates: ApiTemplate[] }) => {
        setTemplates(
          (d.templates ?? []).filter((t) => t.mode === "slides"),
        );
      })
      .catch(() => setTemplates([]));
  }, [open, templates]);

  // ESC 关弹窗
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // 2026-05-09 PR4:同步 TemplateGrid.tsx slideNiches
  const niches = ["全部", "商务", "编辑", "工作室", "品牌", "复古", "教育", "科技", "海报"];
  const visible =
    activeNiche === "全部"
      ? templates ?? []
      : (templates ?? []).filter((t) => t.niche === activeNiche);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[min(92vw,920px)] max-h-[82vh] flex flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <header className="flex items-center justify-between px-md py-3 border-b border-outline-variant/30">
          <div>
            <h2 className="font-h3 text-[16px] text-on-surface">{t("slidesTemplateModal.title")}</h2>
            <p className="text-[12px] text-on-surface-variant mt-0.5">
              {t("slidesTemplateModal.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            aria-label={t("slidesTemplateModal.close")}
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </header>

        {/* niche pills */}
        <div className="px-md pt-3 pb-2 flex flex-wrap gap-2 border-b border-outline-variant/20">
          {niches.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setActiveNiche(n)}
              className={`px-3 py-1 rounded-full text-[12px] transition-colors ${
                activeNiche === n
                  ? "bg-on-surface text-white"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {NICHE_KEY[n] ? t(NICHE_KEY[n] as never) : n}
            </button>
          ))}
        </div>

        {/* grid */}
        <div className="flex-1 overflow-y-auto px-md py-md">
          {templates === null ? (
            <div className="text-center text-on-surface-variant py-10 text-[13px]">
              {t("common.loading")}
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center text-on-surface-variant py-10 text-[13px]">
              {t("slidesTemplateModal.empty")}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {visible.map((t) => (
                <article key={t.id} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => {
                      onPick(t);
                      onClose();
                    }}
                    className={`relative aspect-[4/3] rounded-lg overflow-hidden border border-outline-variant/40 hover:ring-2 hover:ring-primary-cta/50 transition-all ${
                      t.imageSrc ? "" : t.thumbClass
                    }`}
                    style={
                      t.imageSrc
                        ? { background: "#f5f4f0" }
                        : undefined
                    }
                  >
                    {t.imageSrc ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={t.imageSrc}
                        alt={t.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                        <strong className="text-[13px] text-on-surface">
                          {t.headline}
                        </strong>
                        {t.subhead && (
                          <span className="text-[10px] text-on-surface-variant mt-0.5">
                            {t.subhead}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                  <h3 className="text-[12px] text-on-surface mt-1.5 truncate" title={t.title}>
                    {t.title}
                  </h3>
                  <p className="text-[10px] text-on-surface-variant/80">
                    {t.niche} · {t.uses}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
