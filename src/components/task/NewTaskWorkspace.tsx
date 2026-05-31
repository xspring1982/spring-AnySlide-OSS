// /task/new — task 页的空状态(没具体 task)
//
// 跟 /task/[id] 完全相同的三列布局(sidebar + chat + canvas),
// 区别:chat 列只有欢迎气泡 + 创建任务输入区,canvas 是空 dot grid。
// 提交 → POST /api/tasks → router.push(/task/[新id]) 进入有内容版本。

"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import {
  ChevronDown,
  FileText,
  ImageIcon,
  Layers,
  Paperclip,
  Send,
  Sparkles,
  Wand2 as Wand2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { TaskWorkspaceInner } from "./TaskWorkspaceInner";
import { SlidesTemplatePickerModal, type SlideTemplate } from "./SlidesTemplatePickerModal";
import { CARD_STYLES } from "@/lib/styles/cards";
import { SLIDE_STYLES } from "@/lib/styles/slides";
import { IMAGE_STYLES } from "@/lib/styles/image";
import {
  uploadFile,
  buildDocInsertion,
  buildImageReferences,
  type UploadError,
  type UploadedFile,
} from "@/lib/uploads/client";

interface NewTaskCreatedState {
  taskId: string;
  projectId: string;
  task: Parameters<typeof TaskWorkspaceInner>[0]["task"] | null;
}

export type CreationMode = "AI 图文卡片" | "AI 幻灯片" | "AI 图片";

const MODE_BY_CREATION: Record<CreationMode, "cards" | "slides" | "image"> = {
  "AI 图文卡片": "cards",
  "AI 幻灯片": "slides",
  "AI 图片": "image",
};
const MODE_FROM_QUERY: Record<string, CreationMode> = {
  cards: "AI 图文卡片",
  slides: "AI 幻灯片",
  image: "AI 图片",
};
/** CreationMode value → i18n key(显示用) */
const MODE_LABEL_KEY: Record<CreationMode, string> = {
  "AI 图文卡片": "modes.cards",
  "AI 幻灯片": "modes.slides",
  "AI 图片": "modes.image",
};
const RATIO_OPTIONS: Record<CreationMode, string[]> = {
  "AI 图文卡片": ["3:4", "4:5", "1:1", "9:16"],
  "AI 幻灯片": ["16:9", "4:3"],
  // image 模式:gpt-image-2 支持的全部比例,含极端 1:8 / 8:1(长条海报 / banner)
  "AI 图片": ["3:4", "4:5", "1:1", "9:16", "16:9", "3:2", "2:3", "1:8", "8:1"],
};
const RATIO_DEFAULT: Record<CreationMode, string> = {
  "AI 图文卡片": "3:4",
  "AI 幻灯片": "16:9",
  "AI 图片": "3:4",
};
/** placeholder i18n key(用 t() 解);跟首页 PromptComposer 共用 composer.placeholder* */
const PLACEHOLDER_KEY: Record<CreationMode, string> = {
  "AI 图文卡片": "composer.placeholderCards",
  "AI 幻灯片": "composer.placeholderSlides",
  "AI 图片": "composer.placeholderImage",
};

export interface NewTaskWorkspaceProps {
  /** 已存在的 project — /project/[id] 空态时传入,提交时把 task 加到此 project */
  projectId?: string;
  /** 已知 project mode(锁定 sidebar 切换为 PATCH project mode 行为) */
  projectMode?: "cards" | "image" | "slides";
}

export function NewTaskWorkspace(props: NewTaskWorkspaceProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageAttachments, setImageAttachments] = useState<UploadedFile[]>([]);
  // image 模式专属:张数 + Enhance(对齐首页 PromptComposer)
  const [imageCount, setImageCount] = useState<1 | 2 | 4>(1);
  const [enhance, setEnhance] = useState(true);
  // slides 模板弹窗(2026-05-06 用户决策:不再跳首页,改在 task 页内弹)
  const [showSlideTemplateModal, setShowSlideTemplateModal] = useState(false);
  const [pickedSlideTemplate, setPickedSlideTemplate] = useState<SlideTemplate | null>(null);

  function removeAttachment(storageKey: string) {
    setImageAttachments((prev) => prev.filter((a) => a.storageKey !== storageKey));
  }
  // 2026-05-09 PR10:task 类页面默认收起 sidebar 给主区更多空间
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [promptValue, setPromptValue] = useState("");
  // M5+:从 + 新建项目 跳过来 ?just_created=1 → 顶部弹一个 3s toast
  const [justCreatedToast, setJustCreatedToast] = useState(false);
  useEffect(() => {
    if (searchParams?.get("just_created") === "1") {
      setJustCreatedToast(true);
      const id = setTimeout(() => setJustCreatedToast(false), 3500);
      // 移除 query 让刷新不再触发
      window.history.replaceState(
        null,
        "",
        window.location.pathname,
      );
      return () => clearTimeout(id);
    }
  }, [searchParams]);

  // initial mode 优先级:project mode (props) > URL ?mode= > 默认 cards
  const projectModeAsCreation: CreationMode | null = props.projectMode
    ? (Object.entries(MODE_BY_CREATION).find(
        ([, m]) => m === props.projectMode,
      )?.[0] as CreationMode | undefined) ?? null
    : null;
  // 2026-05-28:cards 重新上线为图文笔记;默认入口仍保留 slides。
  const initialMode: CreationMode =
    projectModeAsCreation ??
    (searchParams && MODE_FROM_QUERY[searchParams.get("mode") ?? ""]) ??
    "AI 幻灯片";
  const [activeCreationMode, setActiveCreationMode] = useState<CreationMode>(initialMode);
  const [styleId, setStyleId] = useState("auto");
  const [ratio, setRatio] = useState<string>(RATIO_DEFAULT[initialMode]);
  // slides 输出方式:html(L1, 1 积分/页 Claude 改写填充) | image(L2, 5 积分/页 gpt-image-2)
  // SPEC §3.2 双轨;cards/image 模式忽略此字段
  // 2026-05-17 PR48:slidesOutput picker 下线 — 跟新架构对齐(Blueprint 输出,下载时按需选格式)
  //   - 后端 generation_mode 固定 "batch" (L1 HTML 路径)
  //   - 用户在生成完成后,工具栏 HTML/PPTX/PDF 三按钮按需下载
  const [openPicker, setOpenPicker] = useState<"style" | "ratio" | "count" | null>(null);
  // 提交后:不跳转,直接内嵌 TaskWorkspace 渲染
  const [created, setCreated] = useState<NewTaskCreatedState | null>(null);

  // 切 mode 时把 style 复位到 auto + ratio 给该 mode 的默认比例
  useEffect(() => {
    setStyleId("auto");
    setRatio(RATIO_DEFAULT[activeCreationMode]);
  }, [activeCreationMode]);

  useEffect(() => {
    const m = searchParams?.get("mode") ?? "";
    if (m && MODE_FROM_QUERY[m]) setActiveCreationMode(MODE_FROM_QUERY[m]);
  }, [searchParams]);

  // picker 外点击关闭
  const pickerWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openPicker) return;
    const close = (e: MouseEvent) => {
      if (!pickerWrapRef.current?.contains(e.target as Node)) setOpenPicker(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openPicker]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    if (submitting) return;
    const baseText = promptValue.trim();
    if (!baseText) {
      window.alert(t("task.emptyContentAlert"));
      return;
    }
    // 提交时把图片附件 URL 拼到末尾,让 agent 能引用参考图
    const text = (baseText + buildImageReferences(imageAttachments)).trim();
    // M5+ 规则:slides L1(HTML) 必选模板;L2(AI 图)和其他模式可裸跑
    // NewTaskWorkspace 没有 appliedTemplate 上下文(模板选择只在首页 PromptComposer),
    // 2026-05-05 用户决策:模板可选,不强制(没模板时 LLM 自由发挥)
    setSubmitting(true);
    try {
      // PR48:slides 固定 batch (L1 HTML),L2 已下线;image 单独 mode 也走 batch 字段
      const generationMode: "batch" | "one-by-one" = "batch";

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: MODE_BY_CREATION[activeCreationMode],
          // M5+:在已有 project 上下文里提交 → 把 task 挂到该 project,不创新 project
          project_id: props.projectId ?? undefined,
          source_text: text,
          style_id: styleId,
          ratio,
          generation_mode: generationMode,
          ...(activeCreationMode === "AI 图片"
            ? { count: imageCount, enhance }
            : {}),
          ...(pickedSlideTemplate && activeCreationMode === "AI 幻灯片"
            ? { template_id: pickedSlideTemplate.id }
            : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `创建任务失败 (HTTP ${res.status})`);
      }
      const { taskId, projectId } = (await res.json()) as {
        taskId: string;
        projectId: string;
      };

      // 静默改 URL 用于分享 / 浏览器后退,但不触发路由切换/重 mount
      window.history.replaceState(null, "", `/project/${projectId}`);

      // 拉刚创建的 task 详情(SSE 连接需要)
      const taskRes = await fetch(`/api/tasks/${taskId}`, { cache: "no-store" });
      if (!taskRes.ok) {
        throw new Error(`拉任务详情失败 (HTTP ${taskRes.status})`);
      }
      const taskData = (await taskRes.json()) as Parameters<typeof TaskWorkspaceInner>[0]["task"];

      // 切到 TaskWorkspace 内嵌渲染(同 sidebar+chat+canvas 布局,SSE 自动推流)
      setCreated({ taskId, projectId, task: taskData });
      setSubmitting(false);
    } catch (err) {
      console.error("[NewTaskWorkspace] submit failed:", err);
      window.alert(err instanceof Error ? err.message : t("task.createFailed"));
      setSubmitting(false);
    }
  }

  function handlePickFile() {
    if (uploading) return;
    fileInputRef.current?.click();
  }
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      const result = await uploadFile(f);
      if (result.kind === "image") {
        setImageAttachments((prev) => [...prev, result]);
      } else {
        setPromptValue((prev) => (prev + buildDocInsertion(result)).trimStart());
      }
    } catch (err) {
      const ue = err as UploadError;
      const msg =
        ue.i18nKey === "fileTooLarge"
          ? t("composer.fileTooLarge", ue.i18nValues)
          : ue.i18nKey === "fileTypeNotSupported"
            ? t("composer.fileTypeNotSupported")
            : t("composer.uploadFailed");
      window.alert(msg);
    } finally {
      setUploading(false);
    }
  }

  function goHome() {
    router.push("/");
  }
  // M5+:在 project 上下文里切 mode → PATCH project mode(后端会拒绝已有 task 的 project 改 mode)
  async function patchProjectMode(targetMode: CreationMode) {
    if (!props.projectId) return;
    try {
      await fetch(`/api/projects/${props.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: MODE_BY_CREATION[targetMode] }),
      });
    } catch (err) {
      console.warn("[NewTaskWorkspace] patch project mode failed:", err);
    }
  }
  function gotoMode(mode: CreationMode) {
    setActiveCreationMode(mode);
    // 在 project 上下文里:同步 PATCH project mode(后端只允许空 project 改)
    if (props.projectId) {
      patchProjectMode(mode);
    }
    router.replace(`/task/new?mode=${MODE_BY_CREATION[mode]}`);
  }

  // 当前 mode 的风格列表 — 上线只展示 status='complete' 的(stub 风格 prompt 没写完,先隐藏)
  const styleListAll =
    activeCreationMode === "AI 图文卡片"
      ? CARD_STYLES
      : activeCreationMode === "AI 幻灯片"
        ? SLIDE_STYLES
        : IMAGE_STYLES;
  const styleList = styleListAll.filter((s) => s.status === "complete");
  const activeStyleLabel =
    styleId === "auto"
      ? t("composer.aiRecommended")
      : (styleList.find((s) => s.id === styleId)?.name ?? t("composer.aiRecommended"));
  const ratioLabel = ratio === "auto" ? t("composer.aiRecommended") : ratio;

  return (
    <main
      className={`as-home as-task-page ${sidebarCollapsed ? "as-sidebar-collapsed" : ""}`}
    >
      <AppSidebar
        activeCreationMode={activeCreationMode}
        onHome={goHome}
        onCreationModeChange={gotoMode}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />

      {/* + 新建项目 → toast 浮顶 3s */}
      {justCreatedToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full bg-primary-cta text-on-primary text-[13px] font-medium shadow-2xl animate-[fadeIn_0.2s] flex items-center gap-2">
          <span>✨</span>
          <span>{t("task.justCreatedToast")}</span>
        </div>
      )}

      <section className="as-app-shell flex flex-col">
        <div className="flex flex-1 min-h-0">
          {/* 已创建任务 → 直接渲染真实 chat + canvas(同 360px 列宽,无任何 layout 切换) */}
          {created?.task ? (
            <TaskWorkspaceInner task={created.task} />
          ) : (
            <NewTaskEmptyState
              activeCreationMode={activeCreationMode}
              onModeChange={gotoMode}
              modeLocked={!!props.projectId}
              promptValue={promptValue}
              setPromptValue={setPromptValue}
              submitting={submitting}
              uploading={uploading}
              imageCount={imageCount}
              setImageCount={setImageCount}
              enhance={enhance}
              setEnhance={setEnhance}
              pickedSlideTemplate={pickedSlideTemplate}
              onOpenSlideTemplate={() => setShowSlideTemplateModal(true)}
              onClearSlideTemplate={() => setPickedSlideTemplate(null)}
              handleSubmit={handleSubmit}
              handlePickFile={handlePickFile}
              fileInputRef={fileInputRef}
              handleFileSelected={handleFileSelected}
              styleId={styleId}
              setStyleId={setStyleId}
              ratio={ratio}
              setRatio={setRatio}
              openPicker={openPicker}
              setOpenPicker={setOpenPicker}
              pickerWrapRef={pickerWrapRef}
              styleList={styleList}
              activeStyleLabel={activeStyleLabel}
              ratioLabel={ratioLabel}
            />
          )}
        </div>
      </section>

      {/* slides 模板弹窗 — 用户在 task 页内挑模板,选中后注入 template_id 到提交 payload */}
      <SlidesTemplatePickerModal
        open={showSlideTemplateModal}
        onClose={() => setShowSlideTemplateModal(false)}
        onPick={(t) => setPickedSlideTemplate(t)}
      />
    </main>
  );
}

// ─────────────────────── 空状态 chat 列 + 空画布(抽出来便于条件 render)───────────────────────

interface EmptyStateProps {
  activeCreationMode: CreationMode;
  /** T2-53:模式切换回调,与 sidebar 共用 gotoMode */
  onModeChange: (mode: CreationMode) => void;
  /** T2-53:在 project 上下文里,mode 已锁,tabs 显示但点击无效(显示提示) */
  modeLocked: boolean;
  promptValue: string;
  setPromptValue: (s: string) => void;
  submitting: boolean;
  uploading: boolean;
  handleSubmit: () => void;
  handlePickFile: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** image 模式专属:张数 + Enhance */
  imageCount: 1 | 2 | 4;
  setImageCount: (n: 1 | 2 | 4) => void;
  enhance: boolean;
  setEnhance: (v: boolean) => void;
  styleId: string;
  setStyleId: (s: string) => void;
  ratio: string;
  setRatio: (s: string) => void;
  openPicker: "style" | "ratio" | "count" | null;
  setOpenPicker: (v: "style" | "ratio" | "count" | null) => void;
  pickerWrapRef: React.RefObject<HTMLDivElement | null>;
  styleList: Array<{ id: string; name: string; status: string; swatch?: string }>;
  activeStyleLabel: string;
  ratioLabel: string;
  /** slides 模板弹窗 */
  pickedSlideTemplate: SlideTemplate | null;
  onOpenSlideTemplate: () => void;
  onClearSlideTemplate: () => void;
}

function NewTaskEmptyState(props: EmptyStateProps) {
  const t = useTranslations();
  const {
    activeCreationMode,
    onModeChange,
    modeLocked,
    promptValue,
    setPromptValue,
    submitting,
    uploading,
    handleSubmit,
    handlePickFile,
    fileInputRef,
    handleFileSelected,
    imageCount,
    setImageCount,
    enhance,
    setEnhance,
    styleId,
    setStyleId,
    ratio,
    setRatio,
    openPicker,
    setOpenPicker,
    pickerWrapRef,
    styleList,
    activeStyleLabel,
    ratioLabel,
    pickedSlideTemplate,
    onOpenSlideTemplate,
    onClearSlideTemplate,
  } = props;
  return (
    <>
      {/* 中间 chat 列(空状态)— 与 task 页同宽 360px,统一 */}
      <section className="w-[360px] shrink-0 border-r border-outline-variant/30 bg-white flex flex-col min-h-0">
            <header className="shrink-0 flex items-center gap-2 px-md h-12 bg-white">
              <h2 className="flex-1 truncate text-on-surface font-h3 text-[14px]">
                {t("task.newTask")}
              </h2>
            </header>

            {/* 上半部:AI 回答区(消息流);空状态时显示灰色引导文字 */}
            <div className="flex-1 overflow-y-auto px-md py-md min-h-0">
              {!submitting && (
                <p className="text-on-surface-variant/60 text-[13px] font-label leading-relaxed">
                  {t("task.welcomeIntroPrefix")}
                  <span className="text-primary-cta/80 mx-1">
                    {t(MODE_LABEL_KEY[activeCreationMode] as never)}
                  </span>
                  {t("task.welcomeIntroSuffix")}
                </p>
              )}
              {submitting && (
                <div className="self-start max-w-[90%] rounded-2xl rounded-bl-sm bg-surface-container-low text-on-surface-variant px-md py-2 text-body font-body">
                  <span className="inline-flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-cta/60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-cta" />
                    </span>
                    {t("task.creating")}
                  </span>
                </div>
              )}
            </div>

            {/* 下半部:用户输入区(textarea 含内嵌附件/发送)+ 工具栏在底部 */}
            <div className="shrink-0 px-md pt-2 pb-md bg-white">
              {/* T2-53 + design v2(Editorial Folio):模式 tabs 紧贴输入框上方
                  2026-05-05 修订:窄列(360px)用 flex-1 等分,避免 auto width 溢出 */}
              <div
                className="flex items-end gap-1 border-b border-outline-variant -mb-px"
                role="tablist"
                aria-label={t("task.creationModeAria")}
              >
                {(
                  [
                    { label: "AI 图文卡片", icon: Layers },
                    { label: "AI 幻灯片", icon: FileText },
                    { label: "AI 图片", icon: ImageIcon },
                  ] as { label: CreationMode; icon: typeof Layers }[]
                ).map((m) => {
                  const Icon = m.icon;
                  const active = m.label === activeCreationMode;
                  const disabled = submitting || (modeLocked && !active);
                  return (
                    <button
                      key={m.label}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      disabled={disabled}
                      title={
                        modeLocked && !active
                          ? t("task.modeLockedTooltip")
                          : t(MODE_LABEL_KEY[m.label] as never)
                      }
                      onClick={() => {
                        if (modeLocked && !active) return;
                        onModeChange(m.label);
                      }}
                      className={`flex-1 min-w-0 inline-flex items-center justify-center gap-0.5 px-1 py-2.5 rounded-t-[10px] text-[11px] tracking-tight whitespace-nowrap transition-all relative ${
                        active
                          ? "bg-white text-primary-cta font-semibold border border-outline-variant border-b-0 -mb-px before:content-[''] before:absolute before:top-0 before:left-3 before:right-3 before:h-0.5 before:bg-primary-cta before:rounded-b"
                          : "border border-transparent text-on-surface/55 hover:bg-[#ECECEC]/55 hover:text-on-surface font-medium"
                      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <Icon className="w-3 h-3 shrink-0" aria-hidden />
                      {/* 显示去掉 "AI " 前缀(360px 窄列下"AI 图文卡片"会被截);
                         内部 value/state 仍用完整名,不影响逻辑 */}
                      <span className="truncate">{m.label.replace(/^AI /, "")}</span>
                    </button>
                  );
                })}
              </div>

              {/* textarea 卡片:附件 + 发送按钮内嵌左下/右下 */}
              <form
                className="relative rounded-xl border border-outline-variant/60 bg-white focus-within:ring-2 focus-within:ring-primary-cta/30 transition-shadow"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
              >
                {/* slides 模板选中态 — 输入框左上角 badge(参考首页 PromptComposer appliedTemplate)
                    2026-05-09 PR9:同步 PR7 chip 实色背景修复,避免与 textarea 文字重叠 */}
                {activeCreationMode === "AI 幻灯片" && pickedSlideTemplate && (
                  <div
                    className="absolute top-2 left-3 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFF1E8] border border-primary-cta/40 shadow-sm text-[11px] font-label text-primary-cta max-w-[80%]"
                    title={pickedSlideTemplate.title}
                  >
                    <span className="opacity-80">📋</span>
                    <span className="truncate">{pickedSlideTemplate.title}</span>
                    <button
                      type="button"
                      onClick={onClearSlideTemplate}
                      className="ml-1 w-4 h-4 inline-flex items-center justify-center rounded hover:bg-primary-cta/20 text-[10px]"
                      title={t("composer.clearTemplate")}
                      aria-label={t("composer.clearTemplate")}
                    >
                      ✕
                    </button>
                  </div>
                )}
                <textarea
                  rows={5}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder={t(PLACEHOLDER_KEY[activeCreationMode] as never)}
                  disabled={submitting}
                  style={
                    activeCreationMode === "AI 幻灯片" && pickedSlideTemplate
                      ? { paddingTop: 44 }
                      : undefined
                  }
                  className="w-full min-h-[120px] resize-none bg-transparent px-md pt-3 pb-12 text-body font-body focus:outline-none disabled:text-on-surface-variant"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.docx"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handlePickFile}
                  disabled={submitting || uploading}
                  title={uploading ? t("composer.uploading") : t("composer.attachmentTooltip")}
                  aria-label={uploading ? t("composer.uploading") : t("composer.attachment")}
                  className="absolute left-2 bottom-2 h-8 w-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-40 transition-colors"
                >
                  <Paperclip className={`w-4 h-4 ${uploading ? "animate-pulse" : ""}`} />
                </button>
                <button
                  type="submit"
                  disabled={!promptValue.trim() || submitting}
                  className="absolute right-2 bottom-2 h-8 w-8 flex items-center justify-center rounded-lg bg-primary-cta text-on-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-container transition-colors"
                  aria-label={t("composer.submit")}
                  title={t("task.sendShortcut")}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {/* 风格 / 比例 picker(textarea 下方 — dropdown 向上展开,避免溢出 chat 列)
                  2026-05-05 修订:
                  - Cards:维持「风格」picker
                  - Slides:风格 picker → 「📋 模版选择」按钮(跳到首页模板墙)
                  - Image:隐藏风格 picker(image 暂无模板系统) */}
              {/* 2026-05-18 #7 fix: 删 overflow-x-auto — CSS 规则 overflow-x 非 visible
                  时 overflow-y 也强制变 auto,导致 ratio dropdown 用 bottom-full 弹出后
                  被父元素裁掉,表现为"按钮点击无效"。flex-wrap 兜底处理横向溢出 */}
              <div ref={pickerWrapRef} className="relative flex flex-wrap items-center gap-1 mt-2 text-[12px] font-label text-on-surface-variant">
                {activeCreationMode === "AI 图文卡片" && (
                  <PickerButton
                    icon={Sparkles}
                    label={`${t("composer.stylePicker")}: ${activeStyleLabel}`}
                    active={openPicker === "style"}
                    onClick={() => setOpenPicker(openPicker === "style" ? null : "style")}
                  />
                )}
                {activeCreationMode === "AI 幻灯片" && (
                  <PickerButton
                    icon={Layers}
                    // 选中后名字显示在 textarea 左上角 badge,工具栏按钮恒定文案,只指示当前是否激活
                    label={t("composer.templatePicker")}
                    active={!!pickedSlideTemplate}
                    onClick={onOpenSlideTemplate}
                  />
                )}
                <PickerButton
                  icon={ImageIcon}
                  label={`${t("composer.ratioPicker")}: ${ratioLabel}`}
                  active={openPicker === "ratio"}
                  onClick={() => setOpenPicker(openPicker === "ratio" ? null : "ratio")}
                />
                {/* PR48 删:slides 输出格式 picker 下线(架构改成 Blueprint,下载时再选 HTML/PPTX/PDF) */}

                {/* image 模式专属:张数 + Enhance(对齐首页 PromptComposer) */}
                {activeCreationMode === "AI 图片" && (
                  <>
                    <PickerButton
                      icon={Layers}
                      label={`${t("task.countLabel")}: ${imageCount}`}
                      active={openPicker === "count"}
                      onClick={() => setOpenPicker(openPicker === "count" ? null : "count")}
                    />
                    <button
                      type="button"
                      onClick={() => setEnhance(!enhance)}
                      title={t("task.enhanceTooltip")}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] transition-colors ${
                        enhance
                          ? "bg-primary-cta text-on-primary"
                          : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                      }`}
                    >
                      <Wand2Icon aria-hidden className="w-3 h-3" />
                      <span>Enhance</span>
                    </button>
                  </>
                )}

                {openPicker === "count" && activeCreationMode === "AI 图片" && (
                  <div className="absolute left-[80px] bottom-full mb-1 w-[120px] rounded-lg border border-outline-variant/40 p-1 bg-white shadow-lg z-10">
                    {([1, 2, 4] as const).map((n) => (
                      <PickerOption
                        key={n}
                        label={t("task.countOption", { count: n })}
                        active={imageCount === n}
                        onClick={() => {
                          setImageCount(n);
                          setOpenPicker(null);
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* PR48 删:output picker dropdown 同时下线 */}

                {openPicker === "style" && (
                  <div className="absolute left-0 bottom-full mb-1 w-[260px] max-h-[260px] overflow-y-auto rounded-lg border border-outline-variant/40 p-1 bg-white shadow-lg z-10">
                    <PickerOption
                      label={`✨ ${t("composer.aiRecommended")}`}
                      active={styleId === "auto"}
                      onClick={() => {
                        setStyleId("auto");
                        setOpenPicker(null);
                      }}
                    />
                    {styleList.map((s) => (
                      <PickerOption
                        key={s.id}
                        label={s.name}
                        tag={s.status === "stub" ? t("task.placeholderTag") : undefined}
                        swatch={s.swatch}
                        active={styleId === s.id}
                        onClick={() => {
                          setStyleId(s.id);
                          setOpenPicker(null);
                        }}
                      />
                    ))}
                  </div>
                )}

                {openPicker === "ratio" && (
                  <div className="absolute left-[110px] bottom-full mb-1 w-[160px] max-h-[200px] overflow-y-auto rounded-lg border border-outline-variant/40 p-1 bg-white shadow-lg z-10">
                    <PickerOption
                      label={`✨ ${t("composer.aiRecommended")}`}
                      active={ratio === "auto"}
                      onClick={() => {
                        setRatio("auto");
                        setOpenPicker(null);
                      }}
                    />
                    {RATIO_OPTIONS[activeCreationMode].map((r) => (
                      <PickerOption
                        key={r}
                        label={r}
                        active={ratio === r}
                        onClick={() => {
                          setRatio(r);
                          setOpenPicker(null);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

      {/* 右侧空画布 — dot grid 背景跟 task 页画布视觉一致,中央小提示 */}
      <section
        className="flex-1 min-w-0 bg-main-bg relative flex items-center justify-center"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(44,24,16,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <div className="text-center px-md text-on-surface-variant pointer-events-none">
          <Layers className="w-8 h-8 mx-auto opacity-25 mb-sm" />
          <p className="font-label text-label opacity-70">{t("task.emptyCanvas")}</p>
          <p className="font-label text-label opacity-50 mt-1">
            {t("task.emptyCanvasHint")}
          </p>
        </div>
      </section>
    </>
  );
}

// ─────────────────────── 紧凑 picker ───────────────────────

function PickerButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Sparkles;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-surface-container transition-colors ${
        active ? "bg-surface-container text-on-surface" : ""
      }`}
    >
      <Icon className="w-3 h-3 opacity-70" />
      <span>{label}</span>
      <ChevronDown className="w-3 h-3 opacity-60" />
    </button>
  );
}

function PickerOption({
  label,
  tag,
  swatch,
  active,
  onClick,
}: {
  label: string;
  tag?: string;
  swatch?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[12px] font-label transition-colors ${
        active
          ? "bg-primary-cta/10 text-primary-cta"
          : "text-on-surface hover:bg-surface-container"
      }`}
    >
      {swatch ? (
        <span
          className="shrink-0 w-4 h-4 rounded-sm border border-outline-variant/40"
          style={{ background: swatch }}
        />
      ) : null}
      <span className="flex-1 truncate">{label}</span>
      {tag && (
        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
          {tag}
        </span>
      )}
    </button>
  );
}
