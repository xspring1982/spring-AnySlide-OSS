// SSE 客户端 hook — 订阅 /api/tasks/[id]/stream 实时推送
//
// 事件类型:
//   - status:{ status, agentPhase }
//   - card:{ pageNo, pageVersion, role, url }
//   - error:{ message }
//   - done:{ status }(服务端关闭连接)
//
// 用法:
//   const { status, agentPhase, images, error } = useTaskStream(taskId, {
//     initialStatus: task.status,
//     initialAgentPhase: task.agentPhase,
//     initialImages: task.images,
//   });

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskStatus, AgentPhase } from "@/lib/tasks/types";
import type { AnalyzeOutput } from "@/lib/cards/agents";

export interface StreamedImage {
  pageNo: number;
  pageVersion: number;
  role: string | null;
  url: string;
  /** M5+:project workspace 跨 task 聚合时,每张图带源 taskId 用于下载 / 重生跳准 task */
  taskId?: string;
}

interface UseTaskStreamInit {
  initialStatus: TaskStatus;
  initialAgentPhase: AgentPhase | null;
  initialImages?: StreamedImage[];
  initialOutline?: AnalyzeOutput | null;
  /** T2-51:首屏渲染时如果 task 已是 failed,从 GET 接口拿到的 errorMessage 直接传入,SSE 不会连 */
  initialErrorMessage?: string | null;
}

export function useTaskStream(taskId: string, init: UseTaskStreamInit) {
  const [status, setStatus] = useState<TaskStatus>(init.initialStatus);
  const [agentPhase, setAgentPhase] = useState<AgentPhase | null>(
    init.initialAgentPhase,
  );
  const [images, setImages] = useState<StreamedImage[]>(
    init.initialImages ?? [],
  );
  const [outline, setOutline] = useState<AnalyzeOutput | null>(
    init.initialOutline ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  // T2-51:任务终态(failed / cancelled / done with regenerate failure)的友好错误文案
  const [errorMessage, setErrorMessage] = useState<string | null>(
    init.initialErrorMessage ?? null,
  );
  // PR27 Slides Refine:done 之后再次开 SSE 连接(SSE 走 done 即关闭,
  // 用户 refine 时把任务从 done 拉回 generating,需要手动重连一次)
  const [reconnectKey, setReconnectKey] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // 任务终止状态不再连接(除非 reconnectKey 被显式 bump → 说明用户触发了 refine)
    if (
      reconnectKey === 0 &&
      (init.initialStatus === "done" ||
        init.initialStatus === "failed" ||
        init.initialStatus === "cancelled")
    ) {
      return;
    }

    const url = `/api/tasks/${encodeURIComponent(taskId)}/stream`;
    const es = new EventSource(url);
    sourceRef.current = es;

    es.addEventListener("status", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as {
          status: TaskStatus;
          agentPhase: AgentPhase | null;
        };
        setStatus(d.status);
        setAgentPhase(d.agentPhase);
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("outline", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as { outline: AnalyzeOutput };
        if (d.outline) setOutline(d.outline);
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("card", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as StreamedImage;
        setImages((prev) => {
          // 同 pageNo 取最高 pageVersion(M2 重生成时多版本)
          const map = new Map<number, StreamedImage>();
          for (const img of prev) {
            const cur = map.get(img.pageNo);
            if (!cur || img.pageVersion > cur.pageVersion) {
              map.set(img.pageNo, img);
            }
          }
          const cur = map.get(d.pageNo);
          if (!cur || d.pageVersion > cur.pageVersion) {
            map.set(d.pageNo, d);
          }
          return Array.from(map.values()).sort((a, b) => a.pageNo - b.pageNo);
        });
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("done", (ev) => {
      // T2-51:done 事件携带 errorMessage(NSFW / 余额 / API 异常的友好文案)
      try {
        const d = JSON.parse((ev as MessageEvent).data) as {
          status?: TaskStatus;
          errorMessage?: string | null;
        };
        if (d.errorMessage) setErrorMessage(d.errorMessage);
      } catch {
        /* ignore parse error */
      }
      es.close();
      sourceRef.current = null;
    });

    es.addEventListener("error", (ev) => {
      // EventSource 内置 error 事件没有 data;但服务端推的 'error' event 也走这里,
      // MessageEvent 才有 data。这里两者都尝试兼容。
      const me = ev as MessageEvent<string | undefined>;
      if (typeof me.data === "string" && me.data) {
        try {
          const d = JSON.parse(me.data) as { message: string };
          setError(d.message);
        } catch {
          setError("stream parse error");
        }
      }
      // 浏览器会自动重连;但任务已 done/failed 时我们要主动关
    });

    return () => {
      es.close();
      sourceRef.current = null;
    };
  }, [taskId, init.initialStatus, reconnectKey]);

  // PR27 — 给外部调用 reconnect() 重新订阅 SSE(refine 把 done 拉回 generating 后用)
  // 同时把本地 status 也拉成 generating,触发 UI 显示"生成中"
  const reconnect = useCallback(() => {
    setStatus("generating");
    setReconnectKey((k) => k + 1);
  }, []);

  return { status, agentPhase, images, outline, error, errorMessage, reconnect };
}
