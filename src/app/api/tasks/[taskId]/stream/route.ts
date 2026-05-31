// SPEC §2.1 — SSE 流式推送任务进度
//
// 客户端 EventSource 连接,服务端按以下事件类型推送:
//   - status:状态机变化(analyzing → generating → done)
//   - card:每张卡完成时立即推
//   - error:出错
//   - done:整个任务完成,服务端主动关闭连接
//
// M1 实现:轮询 DB 模式(简单稳)。每 1.5s 查一次 DB,diff 出新增的图片 + 状态变化。
// M2+ 可改 Postgres LISTEN/NOTIFY 或 Redis pub/sub 实现真推送。

import { NextRequest } from "next/server";
import { getTask, listTaskImageFiles } from "@/lib/tasks/repo";
import { requireUser } from "@/lib/auth/require";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 1500;
// 单连接 15 分钟超时 — cards 5 张要 4-7 分钟,slides L2 长 deck 可达 10+ 分钟
// 客户端浏览器会自动重连,服务端按这个值守住一波
const MAX_DURATION_MS = 15 * 60 * 1000;

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;

  // 资源级越权防护:在打开 SSE 流之前先验证 task 所有权
  // 否则任何登录用户都能监听任何人的生成进度 + 图片 URL
  const task = await getTask(taskId);
  if (!task) {
    return Response.json({ error: "任务不存在" }, { status: 404 });
  }
  if (task.userId !== userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (e: string, d: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(e, d)));
        } catch {
          // 连接已断开,忽略
        }
      };

      const startedAt = Date.now();
      let lastStatus: string | null = null;
      let lastPhase: string | null = null;
      // M2.2:outline 每次内容变化都推(支持 outline-refine 多版本),不再 outlineSent 一次性 flag
      let lastOutlineHash: string | null = null;
      const sentPages = new Set<string>(); // `${pageNo}-${pageVersion}`

      // 立即先推一帧当前状态(避免空跑)
      try {
        const t = await getTask(taskId);
        if (!t) {
          send("error", { message: "任务不存在" });
          controller.close();
          return;
        }
        send("status", { status: t.status, agentPhase: t.agentPhase });
        lastStatus = t.status;
        lastPhase = t.agentPhase;

        if (t.analyzeResult) {
          const hash = JSON.stringify(t.analyzeResult);
          send("outline", { outline: t.analyzeResult });
          lastOutlineHash = hash;
        }

        const files = await listTaskImageFiles(taskId);
        for (const f of files) {
          const key = `${f.pageNo}-${f.pageVersion}`;
          send("card", {
            pageNo: f.pageNo,
            pageVersion: f.pageVersion,
            role: f.role,
            url: f.storageUrl,
          });
          sentPages.add(key);
        }
        if (t.status === "done" || t.status === "failed" || t.status === "cancelled") {
          // T2-51:终态附带 errorMessage,前端可在 chat 友好显示
          send("done", { status: t.status, errorMessage: t.errorMessage });
          controller.close();
          return;
        }
      } catch (e) {
        send("error", { message: (e as Error).message });
        controller.close();
        return;
      }

      // 进入轮询循环
      const interval = setInterval(async () => {
        try {
          if (Date.now() - startedAt > MAX_DURATION_MS) {
            send("error", { message: "stream timeout" });
            clearInterval(interval);
            controller.close();
            return;
          }

          const t = await getTask(taskId);
          if (!t) return;

          if (t.status !== lastStatus || t.agentPhase !== lastPhase) {
            send("status", { status: t.status, agentPhase: t.agentPhase });
            lastStatus = t.status;
            lastPhase = t.agentPhase;
          }

          if (t.analyzeResult) {
            const hash = JSON.stringify(t.analyzeResult);
            if (hash !== lastOutlineHash) {
              send("outline", { outline: t.analyzeResult });
              lastOutlineHash = hash;
            }
          }

          const files = await listTaskImageFiles(taskId);
          for (const f of files) {
            const key = `${f.pageNo}-${f.pageVersion}`;
            if (sentPages.has(key)) continue;
            send("card", {
              pageNo: f.pageNo,
              pageVersion: f.pageVersion,
              role: f.role,
              url: f.storageUrl,
            });
            sentPages.add(key);
          }

          if (
            t.status === "done" ||
            t.status === "failed" ||
            t.status === "cancelled"
          ) {
            // T2-51:终态附带 errorMessage
            send("done", { status: t.status, errorMessage: t.errorMessage });
            clearInterval(interval);
            controller.close();
          }
        } catch (e) {
          send("error", { message: (e as Error).message });
        }
      }, POLL_INTERVAL_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // 防 nginx 缓冲
    },
  });
}
