"use client";

import {
  ArrowUp,
  ChevronDown,
  FileText,
  ImageIcon,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  uploadFile,
  buildDocInsertion,
  buildImageReferences,
  ACCEPT_DOC,
  ACCEPT_ANY,
  type UploadError,
  type UploadedFile,
} from "@/lib/uploads/client";
import { X as XIcon } from "lucide-react";
import type { CreationMode } from "./DashboardHome";

/** SPEC §2.1 Step 8 / §3 / §4.1 Step 1：生成模式只有 2 档,标签按 mode 切换
 *  2026-05-16 PR30:slides L2(AI 图)前端入口下线后,前端只会发 batch。
 *  type 保留是因为 ComposerSubmitPayload + 后端 generation_mode 字段还在用. */
type GenerationMode = "batch" | "one-by-one";

/** SPEC §2.4.x defaultRatio / §3.x / §4 image — 与 NewTaskWorkspace 保持一致 */
const DEFAULT_RATIOS: Record<CreationMode, string> = {
  "AI 图文卡片": "3:4",
  "AI 幻灯片": "16:9",
  "AI 图片": "3:4",
};

const RATIO_OPTIONS: Record<CreationMode, string[]> = {
  "AI 图文卡片": ["3:4", "4:5", "1:1", "9:16"],
  "AI 幻灯片": ["16:9", "4:3"],
  "AI 图片": ["1:1", "3:4", "4:5", "16:9", "9:16"],
};

const DEFAULT_STYLE_IDS: Record<CreationMode, string> = {
  "AI 图文卡片": "auto",
  "AI 幻灯片": "auto",
  "AI 图片": "auto",
};

const MODE_TO_TEMPLATE_MODE: Record<CreationMode, "cards" | "slides" | "image"> = {
  "AI 图文卡片": "cards",
  "AI 幻灯片": "slides",
  "AI 图片": "image",
};

// 2026-05-05 i18n:placeholder 由 mode → i18n key 映射,用 t() 解析
const MODE_PLACEHOLDER_KEY: Record<CreationMode, string> = {
  "AI 图文卡片": "composer.placeholderCards",
  "AI 幻灯片": "composer.placeholderSlides",
  "AI 图片": "composer.placeholderImage",
};

// 2026-05-18 用户决策(7-项改造):
// - 删 inputActions 行 (粘贴链接 / 上传文件 / 进入工作台 整套下线)
// - 美化 PPT 不再独占一行,移到 toolbar 内 +(attach)按钮旁边
// - 粘贴链接功能暂下线,真做版本见 TODOLIST P2-PASTE-LINK-AGENT
// - 上传文件功能下沉到 textarea 内 + 按钮(本就是同一个 triggerUpload)
// - 进入工作台按钮删除(用户直接在 textarea 输入提交就跳工作台,不需要额外入口)

/** SPEC §2.1 Step 2 提交 payload — DashboardHome 转 POST /api/tasks */
export type ComposerSubmitPayload = {
  ratio: string;
  styleId: string;
  generationMode: GenerationMode;
  /** image mode 用：是否调 enhance prompt 增强（§4.1 Step 1）*/
  enhance?: boolean;
  /** image mode 用：张数 1/2/4（cards/slides 由 agent 决定）*/
  count?: number;
};

/** M5+ 模板矩阵化:用户点模板 → 父组件传 appliedTemplate → 这里 useEffect 锁字段 */
export interface AppliedTemplate {
  id: string;
  title: string;
  mode: "cards" | "slides" | "image";
  /** true 表示该模板来自 templates 表,提交时可以带 template_id */
  dbBacked?: boolean;
  lockedStyleId?: string;
  lockedRatio?: string;
  lockedGenerationMode?: GenerationMode;
  /** promptSeed 不显示在 textarea,提交时父组件拼接 */
  promptSeed?: string;
}

type PromptComposerProps = {
  prompt: string;
  placeholder: string;
  activeCreationMode: CreationMode;
  onPromptChange: (value: string) => void;
  onSubmit: (payload: ComposerSubmitPayload) => void;
  onCreationModeChange: (mode: CreationMode) => void;
  /** M5+ 模板矩阵化 */
  appliedTemplate?: AppliedTemplate | null;
  onClearTemplate?: () => void;
  /** 提交中(创建任务请求未返回):禁用送出按钮 + 显示 spinner,避免误以为没反应而重复点击 */
  submitting?: boolean;
};

export function PromptComposer({
  prompt,
  placeholder,
  activeCreationMode,
  onPromptChange,
  onSubmit,
  onCreationModeChange,
  appliedTemplate,
  onClearTemplate,
  submitting = false,
}: PromptComposerProps) {
  const t = useTranslations();
  const router = useRouter();
  // M5+:每个 mode 给具体默认比例(用户可改),不再"AI 推荐"
  const [ratios, setRatios] = useState<Record<CreationMode, string>>({
    "AI 图文卡片": DEFAULT_RATIOS["AI 图文卡片"],
    "AI 幻灯片": DEFAULT_RATIOS["AI 幻灯片"],
    "AI 图片": DEFAULT_RATIOS["AI 图片"],
  });
  const [imageCount, setImageCount] = useState(1);
  const [enhance, setEnhance] = useState(true); // SPEC §4.1 默认开
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  // —— 文件上传 —— 三个入口共享一个隐藏 input,通过 acceptRef 决定接受类型(any/doc/image)
  // 文档:解析文本直接拼到 textarea(LLM 直接读)
  // 图片:不进 textarea,作为 attachment chip 显示在输入框上方,提交时把 URL 自动拼到末尾
  const fileInputRef = useRef<HTMLInputElement>(null);
  const acceptRef = useRef<string>(ACCEPT_ANY);
  const [uploading, setUploading] = useState(false);
  const [imageAttachments, setImageAttachments] = useState<UploadedFile[]>([]);

  function triggerUpload(accept: string) {
    if (uploading) return;
    if (!fileInputRef.current) return;
    acceptRef.current = accept;
    fileInputRef.current.accept = accept;
    fileInputRef.current.value = ""; // 允许连续上传同名文件
    fileInputRef.current.click();
  }

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const result = await uploadFile(f);
      if (result.kind === "image") {
        setImageAttachments((prev) => [...prev, result]);
      } else {
        onPromptChange((prompt + buildDocInsertion(result)).trimStart());
      }
    } catch (err) {
      const ue = err as UploadError;
      const msg =
        ue.i18nKey === "fileTooLarge"
          ? t("composer.fileTooLarge", ue.i18nValues)
          : ue.i18nKey === "fileTypeNotSupported"
            ? t("composer.fileTypeNotSupported")
            : t("composer.uploadFailed");
      alert(msg);
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(storageKey: string) {
    setImageAttachments((prev) => prev.filter((a) => a.storageKey !== storageKey));
  }

  const configRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (configRef.current && !configRef.current.contains(e.target as Node)) {
        setOpenPicker(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function togglePicker(id: string) {
    setOpenPicker((prev) => (prev === id ? null : id));
  }

  const isCardsMode = activeCreationMode === "AI 图文卡片";
  const isSlidesMode = activeCreationMode === "AI 幻灯片";
  const activeTemplateMode = MODE_TO_TEMPLATE_MODE[activeCreationMode];
  const templateApplies = appliedTemplate?.mode === activeTemplateMode;
  const activeStyleId =
    templateApplies && appliedTemplate.lockedStyleId
      ? appliedTemplate.lockedStyleId
      : DEFAULT_STYLE_IDS[activeCreationMode];
  const currentRatio =
    templateApplies && appliedTemplate.lockedRatio
      ? appliedTemplate.lockedRatio
      : ratios[activeCreationMode];
  const currentGenerationMode =
    templateApplies && appliedTemplate.lockedGenerationMode
      ? appliedTemplate.lockedGenerationMode
      : "batch";
  const currentRatioOptions = RATIO_OPTIONS[activeCreationMode];
  const activePlaceholder = t(MODE_PLACEHOLDER_KEY[activeCreationMode]) ?? placeholder;
  // 2026-05-16 PR30:genLabelKeys 删除(L2 picker 下线后无引用)。
  // GEN_MODE_KEY 顶层常量保留 — 后端 generation_mode enum 仍兼容。

  function scrollToTemplateSection() {
    const targetId = isCardsMode ? "mode-cards" : "mode-slides";
    const target =
      document.getElementById(targetId) ??
      document.getElementById("template-grid-section");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="as-hero">
      <div className="as-hero-stack">
        <div className="as-value-panel">
          <div className="as-hero-title">
            <BrandLogo logoSize={52} fontSize={42} />
            {t("hero.headline1")}
            <span>{t("hero.headline2")}</span>
          </div>
          <p>{t("hero.subtitle")}</p>
        </div>

        <div className="as-compose-window">
          <div className="as-mode-tabs" aria-label="Creation type">
            {(
              // 2026-05-04 调顺:AI 幻灯片放第一(模板矩阵最丰富,引导效果最强)
              // i18n key 映射:label 是 state 内部值不变(中文 enum),displayKey 用于 t()
              // 2026-05-28:cards 重新上线为图文笔记,走 HTML/PNG 渲染,不走 AI 生图。
              // 2026-05-17 PR45 修正:之前 PR30 一刀切藏了 AI 图片 — 是错的。
              //   藏的应该只是 slides 的 L2 one-by-one(那是 Storybook/绘本场景),
              //   AI 图片是独立"单图生成"产品(海报/卡片/插画),保留。
              [
                { label: "AI 图文卡片", displayKey: "modes.cards", icon: Layers },
                { label: "AI 幻灯片", displayKey: "modes.slides", icon: FileText },
                { label: "AI 图片", displayKey: "modes.image", icon: ImageIcon },
              ] as { label: CreationMode; displayKey: string; icon: typeof Layers }[]
            ).map((mode) => {
              const Icon = mode.icon;
              const active = mode.label === activeCreationMode;
              return (
                <button
                  type="button"
                  key={mode.label}
                  className={active ? "active" : ""}
                  onClick={() => {
                    onCreationModeChange(mode.label);
                    setOpenPicker(null);
                  }}
                >
                  <Icon aria-hidden />
                  <strong>{t(mode.displayKey)}</strong>
                </button>
              );
            })}
          </div>

          <form
            className="as-composer"
            onSubmit={(e) => {
              e.preventDefault();
              // DashboardHome 负责拦截 cards/slides 的模板必选;这里只组装提交 payload。
              // 提交前把图片附件 URL 拼到 prompt 末尾,这样 agent 能拿到参考图
              if (imageAttachments.length > 0) {
                const refs = buildImageReferences(imageAttachments);
                if (!prompt.includes(refs.trim())) {
                  onPromptChange(prompt + refs);
                }
              }
              onSubmit({
                ratio: isCardsMode ? DEFAULT_RATIOS["AI 图文卡片"] : currentRatio,
                styleId: activeStyleId,
                // cards 模式 2026-05-06 起默认 one-by-one(一张一张出),不再让用户选;
                // slides / image 默认 batch;模板仍可锁定 generationMode。
                generationMode:
                  isCardsMode ? "one-by-one" : currentGenerationMode,
                ...(activeCreationMode === "AI 图片"
                  ? { enhance, count: imageCount }
                  : {}),
              });
            }}
          >
            <label className="sr-only" htmlFor="anyslide-prompt">
              Prompt
            </label>
            {/* M5+ 模板已选时:左上角小 badge,不挡 textarea 输入区(top:8 left:14)
                2026-05-09 PR7:原 bg-primary-cta/15 是 15% 透明,下面的 textarea 文字
                会透过来与 chip 重叠。改成实色背景 + 阴影,确保 chip 完全遮盖,且看起来
                浮在 textarea 之上。 */}
            {appliedTemplate && (
              <div
                className="absolute top-2 left-3 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFF1E8] border border-primary-cta/40 shadow-sm text-[11px] font-label text-primary-cta max-w-[60%]"
                title={appliedTemplate.title}
              >
                <span className="opacity-80">📋</span>
                <span className="truncate">{appliedTemplate.title}</span>
                {onClearTemplate && (
                  <button
                    type="button"
                    onClick={onClearTemplate}
                    className="ml-1 w-4 h-4 inline-flex items-center justify-center rounded hover:bg-primary-cta/20 text-[10px]"
                    title={t("composer.clearTemplate")}
                    aria-label={t("composer.clearTemplate")}
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            <textarea
              id="anyslide-prompt"
              value={prompt}
              placeholder={
                appliedTemplate
                  ? `已选「${appliedTemplate.title}」,在这里输入你的具体内容(主题 / 书名 / 数据 等)...`
                  : activePlaceholder
              }
              onChange={(e) => onPromptChange(e.target.value)}
              style={appliedTemplate ? { paddingTop: 44 } : undefined}
            />

            {/* 图片附件缩略图区 — 上传图片后显示在 toolbar 上方 */}
            {imageAttachments.length > 0 && (
              <div className="as-attachment-row">
                {imageAttachments.map((att) => (
                  <div key={att.storageKey} className="as-attachment-chip" title={att.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.url}
                      alt={att.name}
                      className="as-attachment-thumb"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <span className="as-attachment-name">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.storageKey)}
                      className="as-attachment-remove"
                      aria-label={t("composer.removeAttachment")}
                      title={t("composer.removeAttachment")}
                    >
                      <XIcon aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 2026-05-11 PR27:slides 模式下软提示文字长度。
                <1500:不显示;1500-2000:橙色温和提示;>=2000:红色强提示。
                LLM 不会硬截断,但内容太多容易撑爆模板版式 — 提前告诉用户。*/}
            {activeCreationMode === "AI 幻灯片" && prompt.length >= 1500 && (
              <div
                className="px-3 pb-1 text-[12px] font-label"
                style={{
                  color: prompt.length >= 2000 ? "#C92121" : "#C96B35",
                }}
                aria-live="polite"
              >
                <span className="opacity-80">
                  {prompt.length}/2000 ·{" "}
                  {t(
                    prompt.length >= 2000
                      ? "composer.lengthHintOver"
                      : "composer.lengthHintSoft",
                  )}
                </span>
              </div>
            )}

            {/* ── Toolbar ─────────────────────────────────── */}
            <div className="as-composer-toolbar" ref={configRef}>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={handleFilePicked}
              />
              <button
                className="as-composer-plus"
                type="button"
                aria-label={uploading ? t("composer.uploading") : t("composer.attachment")}
                title={uploading ? t("composer.uploading") : t("composer.attachmentTooltip")}
                disabled={uploading}
                onClick={() => triggerUpload(ACCEPT_DOC)}
              >
                <Plus aria-hidden />
              </button>

              {/* 美化 PPT 是 slides 专属入口,cards 图文笔记不显示。 */}
              {isSlidesMode && (
                <div className="as-toolbar-item">
                  <button
                    type="button"
                    className="as-toolbar-btn"
                    onClick={() => router.push("/improve-pptx")}
                    title={t("composer.actionImprovePptx")}
                  >
                    <Sparkles aria-hidden />
                    <span>{t("composer.actionImprovePptx")}</span>
                  </button>
                </div>
              )}

              {/* T2-59 + 2026-05-05 修订:
                  - Slides 模式:隐藏「风格」picker,改显「📋 模版选择」按钮(滚到下方模板墙)
                  - Image 模式:隐藏「风格」picker(image 暂无模板系统)
                  - Cards 模式:同样走模板优先,不再显示风格 picker */}
              {(isCardsMode || isSlidesMode) && (
                <div className="as-toolbar-item">
                  <button
                    type="button"
                    className="as-toolbar-btn"
                    onClick={scrollToTemplateSection}
                    title={t("composer.pickSlideTemplateTooltip")}
                  >
                    <Layers aria-hidden />
                    <span>{t("composer.templatePicker")}</span>
                  </button>
                </div>
              )}

              {/* 2026-05-16 PR30:生成模式 picker 下线。
                  之前 slides 模式有 L1 (HTML batch) / L2 (AI 图 one-by-one) 切换,
                  L2 决策为 storybook/绘本场景(参考 AnyGen "创意"模式定位),不属于
                  幻灯片产品,前端入口下线。slides 模式现在固定走 batch (L1 HTML)。
                  generationMode state + setGenerationMode 保留(后端 enum 兼容)。*/}

              <div className="as-toolbar-sep" />

              {isCardsMode ? (
                <div className="as-toolbar-item">
                  <div
                    className="as-toolbar-btn as-toolbar-static"
                    aria-label={`${t("composer.ratioPicker")}: 3:4`}
                  >
                    <ImageIcon aria-hidden />
                    <span>{t("composer.ratioPicker")}: 3:4</span>
                  </div>
                </div>
              ) : (
                <div className="as-toolbar-item">
                  <button
                    type="button"
                    className="as-toolbar-btn"
                    onClick={() => togglePicker("ratio")}
                  >
                    <ImageIcon aria-hidden />
                    <span>{t("composer.ratioPicker")}: {currentRatio === "auto" ? t("composer.aiRecommended") : currentRatio}</span>
                    <ChevronDown aria-hidden />
                  </button>
                  {openPicker === "ratio" && (
                    <div className="as-picker-popup as-simple-picker">
                      <button
                        key="auto"
                        type="button"
                        className={currentRatio === "auto" ? "active" : ""}
                        onClick={() => {
                          setRatios((prev) => ({
                            ...prev,
                            [activeCreationMode]: "auto",
                          }));
                          setOpenPicker(null);
                        }}
                        title={t("composer.ratioAutoTooltip")}
                      >
                        ✨ {t("composer.aiRecommended")}
                      </button>
                      {currentRatioOptions.map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={currentRatio === r ? "active" : ""}
                          onClick={() => {
                            setRatios((prev) => ({
                              ...prev,
                              [activeCreationMode]: r,
                            }));
                            setOpenPicker(null);
                          }}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Image-only：张数 + Enhance */}
              {activeCreationMode === "AI 图片" && (
                <>
                  <div className="as-toolbar-sep" />

                  <div className="as-toolbar-item">
                    <button
                      type="button"
                      className="as-toolbar-btn"
                      onClick={() => togglePicker("count")}
                    >
                      <Layers aria-hidden />
                      <span>张数: {imageCount}</span>
                      <ChevronDown aria-hidden />
                    </button>
                    {openPicker === "count" && (
                      <div className="as-picker-popup as-simple-picker">
                        {[1, 2, 4].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={imageCount === n ? "active" : ""}
                            onClick={() => {
                              setImageCount(n);
                              setOpenPicker(null);
                            }}
                          >
                            {n} 张
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="as-toolbar-sep" />

                  {/* Enhance toggle (按钮形态，不是下拉)*/}
                  <button
                    type="button"
                    className={`as-toolbar-btn as-toolbar-toggle${
                      enhance ? " active" : ""
                    }`}
                    onClick={() => setEnhance((v) => !v)}
                    aria-pressed={enhance}
                    title={t("composer.enhanceTooltip")}
                  >
                    <Wand2 aria-hidden />
                    <span>Enhance{enhance ? "" : ` ${t("composer.enhanceOff")}`}</span>
                  </button>
                </>
              )}

              <button
                className="as-send-button"
                type="submit"
                disabled={submitting}
                aria-label={t("composer.generate")}
              >
                {submitting ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <ArrowUp aria-hidden />
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 2026-05-18:as-input-actions 整块下线(美化 PPT 移到 toolbar 内 + 旁;
            粘贴链接 / 上传文件 / 进入工作台都按用户需求删除)*/}
      </div>
    </section>
  );
}
