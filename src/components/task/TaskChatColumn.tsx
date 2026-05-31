// SPEC §2.1 Step 4-7 + §2.8.1 — Chat 列(对话风格,Claude / ChatGPT 体验)
//
// 四段:
//   顶部:title bar — 任务标题 + ⋯ 菜单(下载 ZIP / 全部重生 / 保存模板 / 删除)
//   次顶:紧凑 phase 进度条
//   中间:消息流(可滚)— user 输入 / agent outline / agent thinking / 终态文案
//   底部:固定输入区 — 📎 附件 + textarea + ➤ 发送(Cmd/Ctrl+Enter)

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  uploadFile,
  buildDocInsertion,
  buildImageReferences,
  type UploadError,
  type UploadedFile,
} from "@/lib/uploads/client";

// 可取消的 phase:思考阶段(LLM 调用 + 等用户 confirm),用户可立即停
const CANCELLABLE_PHASES = new Set<string>(["analyze", "clarify", "outline", "confirm"]);
import {
  Download,
  ImageIcon,
  Layers,
  Loader2,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Square as StopIcon,
  Trash2,
} from "lucide-react";
import { SlidesTemplatePickerModal, type SlideTemplate } from "./SlidesTemplatePickerModal";
import type { LucideIcon } from "lucide-react";
import type { TaskRecord, TaskStatus, AgentPhase } from "@/lib/tasks/types";
import type { AnalyzeOutput } from "@/lib/cards/agents";
import type { SlidesAnalyzeOutput, SlideEntry } from "@/lib/slides/agents";
import { CompactPhaseStrip } from "./PhaseTimeline";
import { TaskThinkingCard } from "./TaskThinkingCard";

type AnyOutline = AnalyzeOutput | SlidesAnalyzeOutput | null;

/** 文稿 gate 本地化文案 — 纯对话驱动:优化文稿(可反复)→ 回复「定稿」直接生成幻灯片 */
const SOURCE_GATE_TEXT: Record<
  string,
  {
    intro: string;
    optimizing: string;
    revisionLabel: string;
    generating: string;
    placeholderOptimize: string;
  }
> = {
  zh: {
    intro: "文稿已就绪。想怎么改直接告诉我(可反复修改);觉得没问题了,回复「定稿」开始生成幻灯片。",
    optimizing: "正在按你的意见修改…",
    revisionLabel: "改好了,你看看 👇 不满意继续说,满意就回复「定稿」",
    generating: "已定稿,正在生成幻灯片…",
    placeholderOptimize: "想怎么改直接说;不改了就回复「定稿」",
  },
  en: {
    intro: 'Your text is ready. Tell me what to change (as many rounds as you like). When it looks good, reply "finalize" to generate the slides.',
    optimizing: "Revising per your notes…",
    revisionLabel: 'Done 👇 keep telling me, or reply "finalize" when happy',
    generating: "Finalized — generating slides…",
    placeholderOptimize: 'Tell me what to change; reply "finalize" when done',
  },
  "zh-TW": {
    intro: "文稿已就緒。想怎麼改直接告訴我(可反覆修改);覺得沒問題了,回覆「定稿」開始生成簡報。",
    optimizing: "正在依你的意見修改…",
    revisionLabel: "改好了,你看看 👇 不滿意繼續說,滿意就回覆「定稿」",
    generating: "已定稿,正在生成簡報…",
    placeholderOptimize: "想怎麼改直接說;不改了就回覆「定稿」",
  },
  ja: {
    intro: "原稿の準備ができました。直したいところを教えてください(何度でもOK)。よければ「確定」と返信するとスライドを生成します。",
    optimizing: "ご要望に沿って修正中…",
    revisionLabel: "直しました 👇 続けて指示してもOK、よければ「確定」と返信",
    generating: "確定しました。スライドを生成中…",
    placeholderOptimize: "直したい点を入力;終わったら「確定」",
  },
  ko: {
    intro: "원고가 준비되었습니다. 고치고 싶은 점을 말해 주세요(여러 번 가능). 괜찮으면 「확정」이라고 답하면 슬라이드를 생성합니다.",
    optimizing: "의견에 따라 수정 중…",
    revisionLabel: "수정했어요 👇 계속 말해도 되고, 괜찮으면 「확정」이라고 답해 주세요",
    generating: "확정됨 — 슬라이드 생성 중…",
    placeholderOptimize: "고칠 점을 입력; 끝나면 「확정」",
  },
};

/** 意图识别(纯前端)— gate 引导用户回复「定稿」,匹配这些 + 常见同义词 */
function normIntent(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s,，。.!！?？、:：;；'"「」『』（）()]/g, "");
}
const FINALIZE_EXACT = new Set([
  "定稿", "定稿吧", "确定", "确定了", "确认", "可以了", "好了", "就这样", "就这样吧",
  "不用改", "不用改了", "不改了",
  "確定", "確定了", "就這樣", "這樣就好",
  "finalize", "finalized", "done", "ok", "okay", "ready", "looksgood", "good",
  "これでいい", "確定でいい",
  "확정", "됐어", "좋아",
]);
const FINALIZE_PREFIX = ["定稿", "确定排版", "確定排版", "开始排版", "開始排版", "开始生成", "finalize"];
function isFinalizeIntent(s: string): boolean {
  const n = normIntent(s);
  if (!n) return false;
  if (FINALIZE_EXACT.has(n)) return true;
  return FINALIZE_PREFIX.some((p) => n.startsWith(normIntent(p)));
}

interface FlatOutline {
  title: string;
  items: Array<{
    index: number;
    title: string;
    role: string;
    composition?: string;
    /** M5+:正文摘要 / 副标题 — UI 显示让用户判断内容是否符合期望 */
    subtitle?: string;
    keyText?: string;
  }>;
  recommendedStyle?: string;
  recommendedStyleReason?: string;
  recommendedRatio?: string;
}

function isSlidesOutline(o: AnyOutline): o is SlidesAnalyzeOutput {
  return !!o && "outline" in o && typeof (o as SlidesAnalyzeOutput).outline === "object";
}

function flattenOutline(o: AnyOutline): FlatOutline | null {
  if (!o) return null;
  // image mode 没大纲,outline 可能是空对象;cards/slides 也可能在 outline 还没生成完时拿到不完整结构
  // 防御:任何不符合预期 schema 的都返 null,避免 .map of undefined
  if (isSlidesOutline(o)) {
    /** slides 一张幻灯的字段映射:bullets/body/callout 拼成 keyText 让用户看到内容 */
    const slideToItem = (s: NonNullable<typeof o.outline.cover>, role: string) => {
      const parts: string[] = [];
      if (s.bullets && s.bullets.length > 0) {
        parts.push(s.bullets.map((b) => `· ${b}`).join("\n"));
      }
      if (s.body) parts.push(s.body);
      if (s.callout) parts.push(`💡 ${s.callout}`);
      if (s.visual_hint) parts.push(`🎨 视觉:${s.visual_hint}`);
      return {
        index: s.index,
        title: s.title,
        role,
        subtitle: s.subtitle,
        keyText: parts.length > 0 ? parts.join("\n\n") : undefined,
      };
    };
    const items: FlatOutline["items"] = [];
    items.push(slideToItem(o.outline.cover, "cover"));
    if (o.outline.agenda) {
      items.push(slideToItem(o.outline.agenda, "agenda"));
    }
    for (const sec of o.outline.sections) {
      if (sec.divider) {
        items.push(slideToItem(sec.divider, "section_divider"));
      }
      for (const s of sec.slides) {
        items.push(slideToItem(s, "content"));
      }
    }
    items.push(slideToItem(o.outline.closing, "closing"));
    return { title: o.task_title || "", items };
  }
  // cards mode:必须有 cards 数组才视为有效大纲
  if (!Array.isArray((o as AnalyzeOutput).cards)) return null;
  const co = o as AnalyzeOutput;
  return {
    title: co.task_title,
    items: co.cards.map((c) => ({
      index: c.index,
      title: c.title,
      role: c.role,
      composition: c.composition,
      subtitle: c.subtitle,
      keyText: c.key_text,
    })),
    recommendedStyle: co.recommended_style,
    recommendedStyleReason: co.recommended_style_reason,
    recommendedRatio: co.recommended_ratio,
  };
}

type TaskApiResponse = Omit<TaskRecord, "createdAt" | "updatedAt" | "deletedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type Props = {
  task: TaskApiResponse;
  status: TaskStatus;
  agentPhase: AgentPhase | null;
  outline: AnyOutline;
  imageCount: number;
  streamError: string | null;
  /** T2-51:任务终态(failed/cancelled/done with regenerate failure)的友好错误文案 */
  errorMessage?: string | null;
  /** M5+:project workspace 已渲染项目标题栏 → 这里隐藏自带 header,避免双标题 */
  hideHeader?: boolean;
  /** PR27 — slides refine 触发后调一下,让 useTaskStream 重新订阅 SSE(done 后默认关闭) */
  onReconnectStream?: () => void;
};

export function TaskChatColumn({
  task,
  status,
  agentPhase,
  outline,
  imageCount,
  streamError,
  errorMessage,
  hideHeader = false,
  onReconnectStream,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const [reply, setReply] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageAttachments, setImageAttachments] = useState<UploadedFile[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  function removeAttachment(storageKey: string) {
    setImageAttachments((prev) => prev.filter((a) => a.storageKey !== storageKey));
  }
  // 引用消除 unused-vars(下一波 commit 会真用上 buildImageReferences 和 removeAttachment 渲染 chip)
  void buildImageReferences;
  void removeAttachment;
  const [deleting, setDeleting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDone = status === "done";
  const isConfirming = status === "confirming";
  // T2-49 / 2026-05-09 PR17:done 后允许继续提交,同 project 加新 task batch
  // 之前只 image 允许,但 slides 做完后用户也可能想"再做一份相关的 deck",
  // 一样走 continueInProject(POST /api/tasks 带 project_id)
  const isImageContinuable =
    (task.mode === "image" || task.mode === "slides") && isDone;
  // M9 取消相关:任务"运行中" + 是否在可取消的 phase
  const isRunning =
    status === "created" ||
    status === "analyzing" ||
    status === "clarifying" ||
    status === "outlining" ||
    status === "confirming" ||
    status === "generating";
  // image 模式整个跑流程都不可取消(图像 API 一发就出);cards/slides 看 phase
  const canCancel =
    isRunning &&
    task.mode !== "image" &&
    (task.agentPhase === null || CANCELLABLE_PHASES.has(task.agentPhase));
  // 出图阶段 / image 模式 → 不可取消,但允许"运行中"按钮显示提示
  const inOutputPhase = isRunning && !canCancel;
  const isInputDisabled =
    status === "failed" || status === "cancelled" ||
    (isDone && !isImageContinuable);

  // 2026-05-11 PR29:取消只在思考阶段允许真停。出图阶段拒绝(API 已发),
  // 后端返 409 cantCancelAtOutput → 前端 alert "正在生成,请耐心等待"。
  // 处理 race condition:用户刚看到 canCancel=true 按下停止,这时后端 phase
  // 已经跳到 batch/cover/image → cancel API 拒绝,task.status 保持 generating
  const [cancelling, setCancelling] = useState(false);
  async function handleCancel() {
    if (cancelling) return;
    if (!canCancel) return;
    if (!window.confirm(t("taskChat.cancelConfirm"))) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/cancel`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        cantCancelAtOutput?: boolean;
      };
      if (res.status === 409 && data.cantCancelAtOutput) {
        // race condition:刚按停止时已进出图,告诉用户耐心等
        window.alert(t("taskChat.cancelRaceAtOutput"));
        return;
      }
      if (!res.ok) {
        window.alert(t("taskChat.cancelFailed"));
        return;
      }
      // 成功:SSE 推 status='cancelled' 给前端
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("taskChat.cancelFailed"));
    } finally {
      setCancelling(false);
    }
  }

  // PR15c — outline 编辑(本地 mirror,允许 optimistic update,
  // PATCH 成功后 SSE 推流再回正)
  const [localOutline, setLocalOutline] = useState<AnyOutline>(outline);
  useEffect(() => {
    // 标准 props mirror 模式:SSE 推过来的新 outline 同步到本地
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalOutline(outline);
  }, [outline]);
  const flatOutline = flattenOutline(localOutline);
  const totalItems = flatOutline?.items.length ?? 0;

  // 编辑 modal 状态:null = 未编辑;{kind:'edit',index} = 编辑该 index;{kind:'add'} = 加新页
  const [editingState, setEditingState] = useState<
    | { kind: "edit"; index: number; draft: { title: string; body: string; bullets: string } }
    | { kind: "add"; draft: { title: string; body: string; bullets: string } }
    | null
  >(null);
  const [savingOutline, setSavingOutline] = useState(false);
  // L1 模板填充模式(有 templateId 且当前 outline 含 template_section_index)→ 可编辑
  const isTemplated = !!task.templateId;
  const editableOutline =
    status === "confirming" && isTemplated && isSlidesOutline(localOutline);

  // M2.3 大纲确认介入
  const [confirming, setConfirming] = useState(false);
  // 文稿 gate(纯对话驱动):优化文稿(可反复)→ 回复「定稿」直接生成幻灯片
  const [confirmingSource, setConfirmingSource] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  // 只存实质对话(用户意见 u / 改后文稿 rev);AI 引导文案走输入框上方的高亮引导条
  const [gateMessages, setGateMessages] = useState<
    Array<{ kind: "u" | "rev"; text: string }>
  >([]);
  // 优化后的最新文稿 — 定稿后用它在顶部气泡显示(而不是初始原稿)
  const [latestSource, setLatestSource] = useState<string | null>(null);
  // M2.2 outline-refine
  const [refining, setRefining] = useState(false);
  // T2-49:Image 模式连续提交中状态
  const [continuing, setContinuing] = useState(false);
  // PR18:slides 模式 task 页切模板 modal
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  // PR27 → PR28 简化:done + L1 模板填充的 slides task,输入框默认就是 refine 这份 deck。
  // 用户想"做一份新的"应该去左侧 sidebar 新建项目,而不是在已 done 的对话框里切换模式
  // (避免认知负担 — 同 task 只有一种语义:调整它)。
  const [refiningDeck, setRefiningDeck] = useState(false);
  const canRefineDeck =
    task.mode === "slides" && isDone && !!task.templateId;

  // PR18 — 用户在 task 页点 slides 模板 picker 选了新模板
  // - status === done(已生成):confirm "切模板会重构整个 deck",同 project 创新 task
  // - status 中途:阻止操作,提示"等当前任务完成"
  function handleSwitchTemplate(tpl: SlideTemplate) {
    setTemplatePickerOpen(false);
    if (task.mode !== "slides") return;
    if (status !== "done") {
      window.alert(t("taskChat.switchTemplateBusy"));
      return;
    }
    if (tpl.id === task.templateId) {
      // 用户选了当前已用的模板,什么都不做
      return;
    }
    if (!window.confirm(t("taskChat.switchTemplateConfirm"))) return;
    if (!task.sourceText) {
      window.alert(t("taskChat.switchTemplateNoSource"));
      return;
    }
    // 同 project 创新 task,带新 template_id + 原 sourceText
    void continueInProject(task.sourceText, "slides", { templateId: tpl.id });
  }

  /**
   * 同 project 创新 task,跳项目页。
   *
   * 触发场景:
   *   1. T2-49:Image 模式 done 后用户继续提交新 prompt(`continueImageInProject` 时代)
   *   2. M9 排队完整版(2026-05-06):cards/slides/image 在出图阶段,
   *      用户继续提交新内容 → 同 project 排队下一个 task,不阻塞当前出图
   */
  async function continueInProject(
    text: string,
    mode: "cards" | "slides" | "image",
    overrides?: { templateId?: string },
  ) {
    if (continuing) return;
    setContinuing(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          project_id: task.projectId,
          source_text: text,
          style_id: task.styleId,
          ratio: task.ratio,
          ...(overrides?.templateId ? { template_id: overrides.templateId } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      // 跳到项目页(聚合显示所有 task 的图 + SSE 推流新生成)
      router.push(`/project/${task.projectId}`);
    } catch (err) {
      console.error("[continue-in-project]", err);
      alert(err instanceof Error ? err.message : t("taskChat.continueFailed"));
      setContinuing(false);
    }
  }

  async function refineOutline(instruction: string) {
    if (refining) return;
    setRefining(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, mode: "restructure" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      // SSE 自动会推 outline 更新,清空 textarea
      setReply("");
    } catch (err) {
      console.error("[refine]", err);
      alert(err instanceof Error ? `refine 失败: ${err.message}` : "refine 失败");
    } finally {
      setRefining(false);
    }
  }

  // PR27 — 整 deck refine(用户在 done 后输入修改意见)
  // 流程:POST /api/tasks/[id]/refine-deck → inngest event task/slides.refine →
  //       slides-refine 函数串行重写指定 sections → 写新 task_file pageVersion+1 →
  //       SSE 自动推流前端 reload deck。
  async function refineDeck(feedback: string) {
    if (refiningDeck) return;
    setRefiningDeck(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/refine-deck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setReply("");
      // 关键:done 之后 SSE 已关闭,refine 把 status 拉回 generating 但前端不会自动重连。
      // 这里显式让 useTaskStream 重订阅,后续 task_file 新 pageVersion / status 变化能推过来。
      onReconnectStream?.();
    } catch (err) {
      console.error("[refine-deck]", err);
      alert(
        err instanceof Error
          ? `${t("taskChat.refineDeckFailed")}: ${err.message}`
          : t("taskChat.refineDeckFailed"),
      );
    } finally {
      setRefiningDeck(false);
    }
  }
  // PR15c — outline 编辑 helpers
  // ─────────────────────────────────────────────────────────
  async function saveOutlineToServer(newOutline: SlidesAnalyzeOutput) {
    setSavingOutline(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/outline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outline: newOutline }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err as { error?: string }).error ?? `HTTP ${res.status}`;
        window.alert(`保存大纲失败:${msg}`);
        // 失败时回滚到 props.outline
        setLocalOutline(outline);
        return false;
      }
      return true;
    } catch (e) {
      window.alert(`保存大纲失败:${e instanceof Error ? e.message : "未知错误"}`);
      setLocalOutline(outline);
      return false;
    } finally {
      setSavingOutline(false);
    }
  }

  /** 在 SlidesAnalyzeOutput 里按 index 找到对应 SlideEntry,返回 location 用于改 / 删
   * (cover/agenda/closing 拆成独立 entries 让 TS narrowing 工作正常)*/
  function findSlideLocation(
    o: SlidesAnalyzeOutput,
    index: number,
  ):
    | { kind: "cover" }
    | { kind: "agenda" }
    | { kind: "closing" }
    | { kind: "section_divider"; sectionIdx: number }
    | { kind: "section_slide"; sectionIdx: number; slideIdx: number }
    | null {
    if (o.outline.cover.index === index) return { kind: "cover" };
    if (o.outline.agenda?.index === index) return { kind: "agenda" };
    if (o.outline.closing.index === index) return { kind: "closing" };
    for (let si = 0; si < o.outline.sections.length; si++) {
      const sec = o.outline.sections[si];
      if (sec.divider?.index === index) {
        return { kind: "section_divider", sectionIdx: si };
      }
      for (let ii = 0; ii < sec.slides.length; ii++) {
        if (sec.slides[ii].index === index) {
          return { kind: "section_slide", sectionIdx: si, slideIdx: ii };
        }
      }
    }
    return null;
  }

  function openEdit(itemIndex: number) {
    if (!isSlidesOutline(localOutline)) return;
    const loc = findSlideLocation(localOutline, itemIndex);
    if (!loc) return;
    let entry: SlideEntry | undefined;
    const ol = localOutline.outline;
    if (loc.kind === "cover") entry = ol.cover;
    else if (loc.kind === "agenda") entry = ol.agenda;
    else if (loc.kind === "closing") entry = ol.closing;
    else if (loc.kind === "section_divider") entry = ol.sections[loc.sectionIdx].divider;
    else entry = ol.sections[loc.sectionIdx].slides[loc.slideIdx];
    if (!entry) return;
    setEditingState({
      kind: "edit",
      index: itemIndex,
      draft: {
        title: entry.title ?? "",
        body: entry.body ?? "",
        bullets: (entry.bullets ?? []).join("\n"),
      },
    });
  }

  function openAdd() {
    setEditingState({
      kind: "add",
      draft: { title: "", body: "", bullets: "" },
    });
  }

  async function submitEdit() {
    if (!editingState || !isSlidesOutline(localOutline)) return;
    const draft = editingState.draft;
    if (!draft.title.trim()) {
      window.alert("标题不能为空");
      return;
    }
    // 深拷贝 outline 避免 React 误判 same ref
    const next = JSON.parse(JSON.stringify(localOutline)) as SlidesAnalyzeOutput;
    const bulletsArr = draft.bullets
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);
    if (editingState.kind === "edit") {
      const loc = findSlideLocation(next, editingState.index);
      if (!loc) return;
      let entry: SlideEntry | undefined;
      if (loc.kind === "cover") entry = next.outline.cover;
      else if (loc.kind === "agenda") entry = next.outline.agenda;
      else if (loc.kind === "closing") entry = next.outline.closing;
      else if (loc.kind === "section_divider") entry = next.outline.sections[loc.sectionIdx].divider;
      else entry = next.outline.sections[loc.sectionIdx].slides[loc.slideIdx];
      if (!entry) return;
      entry.title = draft.title.trim();
      entry.body = draft.body.trim() || undefined;
      entry.bullets = bulletsArr.length > 0 ? bulletsArr : undefined;
    } else {
      // add:加到第一个 section 的 slides 末尾,默认 role=content
      // template_section_index 复用模板里第一个 content section(从已有 content slide 取)
      const existingContent =
        next.outline.sections[0]?.slides.find(
          (s) => s.role === "content" && typeof s.template_section_index === "number",
        );
      const newSlide: SlideEntry = {
        index: 999, // 提交时由后端 re-index
        role: "content",
        title: draft.title.trim(),
        body: draft.body.trim() || undefined,
        bullets: bulletsArr.length > 0 ? bulletsArr : undefined,
        template_section_index: existingContent?.template_section_index ?? 1,
      };
      if (next.outline.sections.length === 0) {
        next.outline.sections.push({ slides: [newSlide] });
      } else {
        next.outline.sections[next.outline.sections.length - 1].slides.push(newSlide);
      }
    }
    // optimistic UI
    setLocalOutline(next);
    setEditingState(null);
    await saveOutlineToServer(next);
  }

  async function deleteSlide(itemIndex: number) {
    if (!isSlidesOutline(localOutline)) return;
    if (!window.confirm("删除这一页?")) return;
    const next = JSON.parse(JSON.stringify(localOutline)) as SlidesAnalyzeOutput;
    const loc = findSlideLocation(next, itemIndex);
    if (!loc) return;
    if (loc.kind === "cover" || loc.kind === "closing") {
      window.alert("封面 / 封底不能删除");
      return;
    }
    if (loc.kind === "agenda") {
      next.outline.agenda = undefined;
    } else if (loc.kind === "section_divider") {
      next.outline.sections[loc.sectionIdx].divider = undefined;
    } else {
      next.outline.sections[loc.sectionIdx].slides.splice(loc.slideIdx, 1);
    }
    setLocalOutline(next);
    await saveOutlineToServer(next);
  }

  async function confirmOutline(action: "start" | "redo") {
    if (confirming) return;
    if (action === "redo" && !confirm(t("taskChat.redoConfirm"))) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/confirm-outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error("[confirm-outline]", err);
      alert(err instanceof Error ? err.message : t("taskChat.actionFailed"));
      setConfirming(false);
    }
  }

  // 文稿优化(LLM 按指令改写 source_text,可多轮)→ 把用户意见 + 改后文稿都进对话流
  async function optimizeSource(instruction: string) {
    if (!instruction || optimizing) return;
    setOptimizing(true);
    setGateMessages((prev) => [...prev, { kind: "u", text: instruction }]);
    try {
      const res = await fetch(`/api/tasks/${task.id}/optimize-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        sourceText?: string;
        error?: string;
      };
      if (!res.ok || !json.sourceText) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setGateMessages((prev) => [...prev, { kind: "rev", text: json.sourceText! }]);
      setLatestSource(json.sourceText!);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("taskChat.actionFailed"));
    } finally {
      setOptimizing(false);
    }
  }

  // 文稿定稿 → 触发 source-confirmed,继续直接生成幻灯片(智能模式)
  async function confirmSource() {
    if (confirmingSource) return;
    setConfirmingSource(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/confirm-source`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      // 成功:SSE 推 status=outlining/analyzing,gate 自动消失
    } catch (err) {
      alert(err instanceof Error ? err.message : t("taskChat.actionFailed"));
      setConfirmingSource(false);
    }
  }

  // 文稿 gate 的对话路由:回复「定稿」→ 直接生成;否则当作修改意见去优化文稿
  async function handleGateSubmit(text: string) {
    if (confirmingSource) return;
    if (isFinalizeIntent(text)) {
      setGateMessages((prev) => [...prev, { kind: "u", text }]);
      await confirmSource();
      return;
    }
    await optimizeSource(text);
  }

  // 新内容出现时滚到底
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [status, agentPhase, totalItems, imageCount, gateMessages.length, optimizing]);

  // 关掉菜单(任意点击)
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element)?.closest?.("[data-task-menu]")) setMenuOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  // agent thinking 气泡(按 mode 分支)
  const isImageMode = task.mode === "image";
  let thinkingBubble: string | null = null;
  if (status === "analyzing") {
    thinkingBubble = isImageMode
      ? "✨ 正在增强你的描述词…"
      : "🔍 正在分析你的内容…";
  } else if (status === "outlining") {
    thinkingBubble = "✏️ 正在生成大纲…";
  } else if (status === "confirming") {
    thinkingBubble = null;
  } else if (status === "generating") {
    if (isImageMode) {
      thinkingBubble = "🎨 gpt-image-2 正在出图(约 10-25 秒)…";
    } else {
      const total = totalItems ?? 0;
      if (agentPhase === "cover") {
        thinkingBubble = "🎨 正在画封面(Anchor Chain 锚点)…";
      } else if (total > 0) {
        thinkingBubble = `🎨 批量出图中… ${imageCount}/${total}`;
      } else {
        thinkingBubble = "🎨 批量出图中…";
      }
    }
  }

  // 工具按钮
  function handleDownload() {
    window.location.href = `/api/tasks/${task.id}/export`;
    setMenuOpen(false);
  }
  async function handleDelete() {
    setMenuOpen(false);
    if (deleting) return;
    if (!confirm(t("taskChat.deleteConfirm"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `删除失败 (HTTP ${res.status})`);
      }
      router.push("/");
    } catch (err) {
      console.error("[delete task]", err);
      alert(err instanceof Error ? err.message : t("taskChat.deleteFailed"));
      setDeleting(false);
    }
  }

  // 附件上传:PDF/TXT/MD 解析为文本,图片以 URL 引用,塞到对话回复输入区
  function handlePickFile() {
    if (uploading) return;
    fileInputRef.current?.click();
  }
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // 允许同名文件重选
    if (!f) return;
    setUploading(true);
    try {
      const result = await uploadFile(f);
      if (result.kind === "image") {
        setImageAttachments((prev) => [...prev, result]);
      } else {
        setReply((prev) => (prev + buildDocInsertion(result)).trimStart());
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

  return (
    <>
      {/* 顶部:title bar(标题 + ⋯ 菜单) — project workspace 场景隐藏避免双标题 */}
      {!hideHeader && (
      <header className="shrink-0 flex items-center gap-2 px-md h-12 border-b border-outline-variant/30 bg-white">
        <h2
          className="flex-1 min-w-0 truncate text-on-surface font-h3 text-[14px]"
          title={task.title}
        >
          {task.title}
        </h2>
        <div className="relative" data-task-menu>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
            aria-label={t("taskChat.menuAria")}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 min-w-[180px] bg-white border border-outline-variant/40 rounded-lg shadow-xl py-1 z-50">
              <MenuItem
                icon={Download}
                label={t("taskChat.menuDownload")}
                onClick={handleDownload}
                disabled={!isDone}
              />
              <MenuItem
                icon={RefreshCw}
                label={t("taskChat.menuRegenAll")}
                disabled
                onClick={() => {}}
              />
              <MenuItem
                icon={Save}
                label={t("taskChat.menuSaveTemplate")}
                disabled
                onClick={() => {}}
              />
              <div className="h-px bg-outline-variant/40 my-1" />
              <MenuItem
                icon={Trash2}
                label={deleting ? t("taskChat.menuDeleting") : t("taskChat.menuDelete")}
                onClick={handleDelete}
                tone="danger"
              />
            </div>
          )}
        </div>
      </header>
      )}

      {/* 次顶:phase 进度条 */}
      <div className="shrink-0 px-md py-sm border-b border-outline-variant/30 bg-white">
        <CompactPhaseStrip
          status={status}
          agentPhase={agentPhase}
          mode={task.mode}
        />
      </div>

      {/* 消息流 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-md py-md flex flex-col gap-md"
      >
        {/* AI 思考过程持久卡:贯穿整个生命周期,done 后留下可回看 */}
        <TaskThinkingCard
          status={status}
          agentPhase={agentPhase}
          imageCount={imageCount}
          totalCount={totalItems}
          mode={task.mode}
          outlinePreview={
            flatOutline ? <OutlineCard outline={flatOutline} /> : null
          }
        />

        {/* 顶部原始输入气泡:gate 阶段显示原稿(优化稿在下方对话流);定稿后显示最终优化稿 */}
        {(() => {
          const shown = status === "confirming_source" ? task.sourceText : latestSource ?? task.sourceText;
          return shown ? <ChatBubble role="user">{shown}</ChatBubble> : null;
        })()}

        {status === "confirming_source" &&
          (() => {
            const gate = SOURCE_GATE_TEXT[task.locale] ?? SOURCE_GATE_TEXT.zh;
            return (
              <>
                {/* 对话流:只放用户意见 + 改后文稿(AI 引导见输入框上方引导条) */}
                {gateMessages.map((m, i) =>
                  m.kind === "u" ? (
                    <ChatBubble key={i} role="user">
                      {m.text}
                    </ChatBubble>
                  ) : (
                    <ChatBubble key={i} role="agent">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-on-surface-variant">
                          {gate.revisionLabel}
                        </span>
                        <div className="rounded-lg border border-outline-variant/40 bg-surface-container/30 px-2.5 py-2 text-[12px] whitespace-pre-wrap max-h-72 overflow-y-auto">
                          {m.text}
                        </div>
                      </div>
                    </ChatBubble>
                  ),
                )}
                {/* 优化中 / 定稿中 转圈提示(就近显示在对话流) */}
                {(optimizing || confirmingSource) && (
                  <ChatBubble role="agent" muted>
                    <span className="inline-flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-cta/60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-cta" />
                      </span>
                      <span>{optimizing ? gate.optimizing : gate.generating}</span>
                    </span>
                  </ChatBubble>
                )}
              </>
            );
          })()}

        {flatOutline && status === "confirming" && (
          <ChatBubble role="agent">
            <OutlineCard
              outline={flatOutline}
              editable={editableOutline}
              onEditItem={openEdit}
              onDeleteItem={deleteSlide}
              onAddItem={openAdd}
            />
          </ChatBubble>
        )}

        {/* M2.3 大纲确认介入:仅 confirming 状态显示 ✓ 开始 / ✗ 重做 */}
        {isConfirming && outline && (
          <div className="self-start max-w-[90%] flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={() => confirmOutline("start")}
              disabled={confirming}
              className="px-3 py-1.5 rounded-full bg-primary-cta text-on-primary text-[12px] font-label hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ✓ {t("taskChat.startGen")}
            </button>
            <button
              type="button"
              onClick={() => confirmOutline("redo")}
              disabled={confirming}
              className="px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-[12px] font-label hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ✗ {t("taskChat.redoOutline")}
            </button>
            {confirming && (
              <span className="text-[11px] text-on-surface-variant/70">{t("taskChat.submitting")}</span>
            )}
          </div>
        )}

        {thinkingBubble && (
          <ChatBubble role="agent" muted>
            <span className="inline-flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-cta/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-cta" />
              </span>
              <span>{thinkingBubble}</span>
            </span>
          </ChatBubble>
        )}

        {status === "done" && (
          <ChatBubble role="agent">
            <span className="text-emerald-700 font-medium">
              {isImageMode ? t("taskChat.doneImage") : t("taskChat.doneAll")}
            </span>
          </ChatBubble>
        )}
        {/* T2-44:done 状态下若有 errorMessage(部分图被 NSFW 拦 / 单张重生失败等),显示警告气泡 */}
        {status === "done" && errorMessage && (
          <ChatBubble role="agent">
            <span className="text-amber-700 whitespace-pre-line">
              ⚠️ {errorMessage}
            </span>
          </ChatBubble>
        )}
        {status === "failed" && (
          <ChatBubble role="agent">
            <span className="text-error whitespace-pre-line">
              ❌ {errorMessage ?? t("taskChat.taskFailed")}
            </span>
          </ChatBubble>
        )}
        {status === "cancelled" && (
          <ChatBubble role="agent">
            <span className="text-on-surface-variant">⊘ {t("taskChat.taskCancelled")}</span>
          </ChatBubble>
        )}
        {streamError && (
          <ChatBubble role="agent">
            <span className="text-error">⚠️ {t("taskChat.streamError")}: {streamError}</span>
          </ChatBubble>
        )}
      </div>

      {/* 文稿 gate:输入框上方的高亮引导条 — 始终显示 AI 引导,让用户知道下一步回复什么 */}
      {status === "confirming_source" &&
        (() => {
          const gate = SOURCE_GATE_TEXT[task.locale] ?? SOURCE_GATE_TEXT.zh;
          const guide = gate.intro;
          return (
            <div className="shrink-0 mx-md mb-1 rounded-xl border border-primary-cta/40 bg-primary-cta/10 px-3 py-2">
              <div className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary-cta" />
                <span className="text-[12.5px] leading-relaxed text-on-surface font-medium whitespace-pre-line">
                  {guide}
                </span>
              </div>
            </div>
          );
        })()}

      {/* 底部输入区:卡片样式(与 NewTaskWorkspace 输入区一致 — 内嵌附件/发送按钮)
          PR28 简化:不再显示模式切换 chip,done + L1 模板的 slides 默认就是 refine 这份;
          想做新的请在左侧 sidebar 新建项目 */}
      <form
        className="shrink-0 px-md pt-2 pb-md bg-white"
        onSubmit={(e) => {
          e.preventDefault();
          const text = reply.trim();
          if (!text) return;
          if (status === "confirming_source") {
            // 文稿 gate:全程对话驱动(改稿 / 回复定稿 / 选保真智能)
            setReply("");
            void handleGateSubmit(text);
            return;
          }
          if (isConfirming) {
            refineOutline(text);
          } else if (canRefineDeck) {
            // PR27/PR28:L1 模板 slides done 后,默认调整这份 deck
            refineDeck(text);
          } else if (isImageContinuable) {
            // T2-49:Image done(或 L2 slides done)继续生成 → 同 project 新 task
            continueInProject(text, task.mode);
          } else if (inOutputPhase) {
            // 2026-05-11 PR29:出图阶段严格排队,不接受新 task。
            // 按钮已 disable,这里不会触发(双保险),保留 alert 防 keydown 提交
            alert(t("taskChat.outputPhaseQueueAlert"));
          } else {
            alert(t("taskChat.notInDialog"));
          }
        }}
      >
        <div className="relative rounded-xl border border-outline-variant/60 bg-white focus-within:ring-2 focus-within:ring-primary-cta/30 transition-shadow">
          <textarea
            rows={5}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
            placeholder={
              status === "confirming_source"
                ? (SOURCE_GATE_TEXT[task.locale] ?? SOURCE_GATE_TEXT.zh).placeholderOptimize
                : refining || refiningDeck
                ? t("taskChat.placeholderRefining")
                : continuing
                  ? t("taskChat.placeholderContinuing")
                  : isConfirming
                    ? t("taskChat.placeholderConfirming")
                    : canRefineDeck
                      ? t("taskChat.placeholderRefineDeck")
                      : isImageContinuable
                        ? task.mode === "slides"
                          ? t("taskChat.placeholderSlidesContinue")
                          : t("taskChat.placeholderImageContinue")
                        : inOutputPhase
                          ? t("taskChat.placeholderOutputPhase")
                          : isInputDisabled
                            ? t("taskChat.placeholderEnded")
                            : t("taskChat.placeholderDefault")
            }
            disabled={isInputDisabled || refining || refiningDeck || continuing || !!confirmingSource}
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
            disabled={isInputDisabled || refining || continuing || uploading}
            title={uploading ? t("composer.uploading") : t("composer.attachmentTooltip")}
            aria-label={uploading ? t("composer.uploading") : t("composer.attachment")}
            className="absolute left-2 bottom-2 h-8 w-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-40 transition-colors"
          >
            <Paperclip className={`w-4 h-4 ${uploading ? "animate-pulse" : ""}`} />
          </button>
          {/* 2026-05-11 PR29 两态发送按钮(简化):
              - canCancel(思考阶段) → 红色 ⏹ 真停按钮
              - 其他(包括 inOutputPhase / done / confirming) → 主色 ✈️ submit
                出图阶段时 disabled + 显示 spinner,文字仍可输入
              废弃了 T2-52 的"出图阶段并发新 task" + "软停"两条路径:
              用户决策(2026-05-11)跟 Lovart 一致,出图阶段一律不能开下一个 */}
          {canCancel ? (
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={cancelling}
              className="absolute right-2 bottom-2 h-8 w-8 flex items-center justify-center rounded-lg bg-error/90 text-white disabled:opacity-40 hover:bg-error transition-colors"
              aria-label={t("taskChat.stopGen")}
              title={t("taskChat.stopGenTooltip")}
            >
              <StopIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={
                !reply.trim() ||
                isInputDisabled ||
                refining ||
                refiningDeck ||
                continuing ||
                inOutputPhase ||
                optimizing ||
                !!confirmingSource
              }
              className="absolute right-2 bottom-2 h-8 w-8 flex items-center justify-center rounded-lg bg-primary-cta text-on-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-container transition-colors"
              aria-label={
                inOutputPhase ? t("taskChat.outputPhaseQueueDisabled") : t("task.sendShortcut")
              }
              title={
                inOutputPhase ? t("taskChat.outputPhaseQueueDisabled") : t("task.sendShortcut")
              }
            >
              {inOutputPhase ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* 风格 / 模板 / 比例 / 输出 显示条 */}
        <div className="flex items-center gap-1 mt-2 text-[12px] font-label text-on-surface-variant flex-wrap">
          {/* PR18:slides 模式显示模板 picker(可点切),其他模式显示风格(只读)*/}
          {task.mode === "slides" ? (
            <button
              type="button"
              onClick={() => setTemplatePickerOpen(true)}
              title={
                status === "done"
                  ? t("taskChat.switchTemplateTooltip")
                  : t("taskChat.switchTemplateBusy")
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-container/40 hover:bg-primary-cta/10 hover:text-primary-cta transition-colors"
            >
              <Layers className="w-3 h-3 opacity-70" />
              <span>{t("composer.templatePicker")}</span>
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-container/40"
              title={t("taskChat.styleLockedTooltip")}
            >
              <Sparkles className="w-3 h-3 opacity-70" />
              <span>
                {t("composer.stylePicker")}: {task.styleId === "auto" ? t("composer.aiRecommended") : task.styleId}
              </span>
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-container/40"
            title={t("taskChat.ratioLockedTooltip")}
          >
            <ImageIcon className="w-3 h-3 opacity-70" />
            <span>
              {t("composer.ratioPicker")}: {task.ratio === "auto" ? t("composer.aiRecommended") : task.ratio}
            </span>
          </span>
          {/* 2026-05-22:移除「输出: HTML / AI 图」L1/L2 路径选择器。
              L2(AI 图)已下线 → 只剩 L1,无需选;HTML / PPTX / PDF 三格式在生成后的
              deck 预览(SlideDeckView)按需下载,不在生成前预选格式。 */}
        </div>
      </form>

      {/* PR18 — slides 切模板 modal(复用首页同款 SlidesTemplatePickerModal)*/}
      <SlidesTemplatePickerModal
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onPick={handleSwitchTemplate}
      />

      {/* PR15c — outline 编辑 / 加页 Modal */}
      {editingState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => !savingOutline && setEditingState(null)}
        >
          <div
            className="relative w-[min(92vw,560px)] rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-md py-3 border-b border-outline-variant/30 flex items-center justify-between">
              <h2 className="font-h3 text-[15px] text-on-surface">
                {editingState.kind === "edit"
                  ? `编辑第 ${editingState.index} 页`
                  : "加新一页"}
              </h2>
              <button
                type="button"
                onClick={() => !savingOutline && setEditingState(null)}
                disabled={savingOutline}
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container disabled:opacity-40"
                aria-label="关闭"
              >
                ✕
              </button>
            </header>
            <div className="px-md py-md flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-label text-on-surface-variant uppercase tracking-wider">
                  标题
                </span>
                <input
                  type="text"
                  value={editingState.draft.title}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditingState((s) =>
                      s ? { ...s, draft: { ...s.draft, title: v } } : s,
                    );
                  }}
                  disabled={savingOutline}
                  className="w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-[14px] focus:outline-none focus:border-primary-cta disabled:opacity-50"
                  placeholder="标题(必填)"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-label text-on-surface-variant uppercase tracking-wider">
                  正文
                </span>
                <textarea
                  value={editingState.draft.body}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditingState((s) =>
                      s ? { ...s, draft: { ...s.draft, body: v } } : s,
                    );
                  }}
                  disabled={savingOutline}
                  rows={3}
                  className="w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-[13px] focus:outline-none focus:border-primary-cta resize-none disabled:opacity-50"
                  placeholder="这页主要讲什么(可空)"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-label text-on-surface-variant uppercase tracking-wider">
                  要点(每行一条)
                </span>
                <textarea
                  value={editingState.draft.bullets}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditingState((s) =>
                      s ? { ...s, draft: { ...s.draft, bullets: v } } : s,
                    );
                  }}
                  disabled={savingOutline}
                  rows={4}
                  className="w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-[13px] font-mono focus:outline-none focus:border-primary-cta resize-none disabled:opacity-50"
                  placeholder={"要点 1\n要点 2\n要点 3"}
                />
              </label>
            </div>
            <footer className="px-md py-3 border-t border-outline-variant/30 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => !savingOutline && setEditingState(null)}
                disabled={savingOutline}
                className="h-8 px-3 rounded-md text-[12px] text-on-surface hover:bg-surface-container disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={savingOutline || !editingState.draft.title.trim()}
                className="h-8 px-3 rounded-md bg-primary-cta text-on-primary text-[12px] font-medium hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {savingOutline ? "保存中…" : "保存"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────── menu 项 ───────────────────────

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "text-error hover:bg-error-container"
      : "text-on-surface hover:bg-surface-container";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] font-label disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${cls}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
      <span>{label}</span>
    </button>
  );
}

// ─────────────────────── outline 卡片(支持 PR15c 编辑模式) ───────────────────────

interface OutlineCardEditCallbacks {
  /** 用户点 ✎ 编辑某 slide */
  onEditItem?: (index: number) => void;
  /** 用户点 🗑 删除某 slide(cover / closing 不能删)*/
  onDeleteItem?: (index: number) => void;
  /** 用户点 ➕ 在末尾加新 content slide */
  onAddItem?: () => void;
}

function OutlineCard({
  outline,
  editable,
  onEditItem,
  onDeleteItem,
  onAddItem,
}: {
  outline: FlatOutline;
  editable?: boolean;
} & OutlineCardEditCallbacks) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-2 min-w-[260px]">
      <div className="flex items-center gap-2 text-[12px] text-on-surface-variant">
        <span>📋</span>
        <span className="font-label uppercase tracking-wider">{t("taskChat.outlineLabel")}</span>
        <span className="ml-auto text-on-surface-variant/70">
          {t("taskChat.outlineCount", { count: outline.items.length })}
        </span>
      </div>
      <div className="text-body font-body text-on-surface line-clamp-2">
        {outline.title}
      </div>
      {/* M2.7:LLM 真推荐的风格 + 理由,透明展示 */}
      {(outline.recommendedStyle || outline.recommendedRatio) && (
        <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-md bg-primary-cta/8 border border-primary-cta/20 text-[11px]">
          <div className="flex items-center gap-1 text-primary-cta font-medium">
            <span>✨ {t("composer.aiRecommended")}</span>
          </div>
          {outline.recommendedStyle && (
            <div className="text-on-surface-variant">
              <span className="text-on-surface font-medium">{t("composer.stylePicker")}:</span>{" "}
              {outline.recommendedStyle}
              {outline.recommendedStyleReason && (
                <span className="opacity-70">
                  {" — "}
                  {outline.recommendedStyleReason}
                </span>
              )}
            </div>
          )}
          {outline.recommendedRatio && (
            <div className="text-on-surface-variant">
              <span className="text-on-surface font-medium">{t("composer.ratioPicker")}:</span>{" "}
              {outline.recommendedRatio}
            </div>
          )}
        </div>
      )}
      <ol className="flex flex-col gap-2 mt-1">
        {outline.items.map((c) => {
          // cover / closing 不能删(模板必备的入口/出口页)
          const canDelete = c.role !== "cover" && c.role !== "closing";
          return (
          <li
            key={c.index}
            className="flex items-start gap-2 text-[12px] leading-relaxed pb-2 border-b border-outline-variant/15 last:border-b-0 group"
          >
            <span className="shrink-0 inline-flex w-5 h-5 items-center justify-center rounded bg-primary-cta/10 text-primary-cta font-medium text-[11px]">
              {c.index}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-1">
                <div className="flex-1 text-on-surface font-medium">{c.title}</div>
                {editable && (
                  <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditItem?.(c.index);
                      }}
                      title="编辑这一页"
                      aria-label="编辑这一页"
                      className="w-5 h-5 inline-flex items-center justify-center rounded text-on-surface-variant hover:bg-primary-cta/10 hover:text-primary-cta text-[11px]"
                    >
                      ✎
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteItem?.(c.index);
                        }}
                        title="删除这一页"
                        aria-label="删除这一页"
                        className="w-5 h-5 inline-flex items-center justify-center rounded text-on-surface-variant hover:bg-error/10 hover:text-error text-[11px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
              {/* 副标 / 内容摘要 — 让用户判断是不是要的 */}
              {c.subtitle && (
                <div className="text-on-surface-variant text-[11px] mt-0.5">
                  {c.subtitle}
                </div>
              )}
              {c.keyText && (
                <div className="text-on-surface-variant/85 text-[11px] mt-1 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                  {c.keyText}
                </div>
              )}
              <div className="text-on-surface-variant/60 text-[10px] mt-1">
                {t(roleI18nKey(c.role) as never)}
                {c.composition && (
                  <>
                    <span className="mx-1 opacity-40">·</span>
                    <span>{c.composition}</span>
                  </>
                )}
              </div>
            </div>
          </li>
          );
        })}
      </ol>
      {editable && onAddItem && (
        <button
          type="button"
          onClick={onAddItem}
          className="mt-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md border border-dashed border-outline-variant hover:border-primary-cta hover:bg-primary-cta/5 text-[12px] text-on-surface-variant hover:text-primary-cta transition-colors"
        >
          <span className="text-[14px]">＋</span>
          <span>加一页</span>
        </button>
      )}
    </div>
  );
}

function roleI18nKey(r: string): string {
  if (r === "cover") return "taskChat.roles.cover";
  if (r === "closing") return "taskChat.roles.closing";
  if (r === "agenda") return "taskChat.roles.agenda";
  if (r === "section_divider") return "taskChat.roles.sectionDivider";
  return "taskChat.roles.content";
}

// ─────────────────────── 气泡 ───────────────────────

function ChatBubble({
  role,
  muted,
  children,
}: {
  role: "user" | "agent";
  muted?: boolean;
  children: React.ReactNode;
}) {
  if (role === "user") {
    // 素一点:用户消息改成左对齐 + 浅灰背景 + 深字,不再橙色高亮
    return (
      <div className="self-stretch rounded-lg bg-surface-container/40 border border-outline-variant/30 px-3 py-2 text-[13px] text-on-surface whitespace-pre-wrap break-words">
        {children}
      </div>
    );
  }
  return (
    <div
      className={`self-stretch rounded-lg px-3 py-2 text-[13px] ${
        muted
          ? "bg-transparent text-on-surface-variant"
          : "bg-transparent text-on-surface"
      }`}
    >
      {children}
    </div>
  );
}

// SlidesOutputPicker(L1/L2 输出路径选择器)已于 2026-05-22 移除:
// L2(AI 图)下线 → 只剩 L1;HTML / PPTX / PDF 三格式在 SlideDeckView 生成后按需下载。
