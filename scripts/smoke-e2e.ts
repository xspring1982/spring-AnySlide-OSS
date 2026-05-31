// M1.7 端到端 smoke:提任务 → 轮询 → 看到全部图片
//
// 用法:
//   set -a && source .env.local && set +a
//   npx tsx scripts/smoke-e2e.ts [BASE_URL]
// 默认 BASE_URL=http://localhost:3000

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const TIMEOUT_MS = 8 * 60 * 1000; // 8 分钟上限

const SAMPLE_INPUT = `
《纳瓦尔宝典》核心要点:

1. 财富不是金钱,而是不依赖时间的资产。
2. 选择有复利效应的事:知识、关系、代码。
3. 学会做"特定"的事:稀缺、不可替代。
4. 把自己产品化:用判断力赚钱,而非用时间。
5. 长期主义:跟同一群人,玩同一个长期游戏。
`.trim();

interface CreateResponse {
  taskId?: string;
  error?: string;
}
interface TaskDetail {
  id: string;
  status: string;
  agentPhase: string | null;
  analyzeResult: { cards?: { index: number }[]; recommended_count?: number } | null;
  images?: { pageNo: number; pageVersion: number; url: string }[];
}

async function postTask(): Promise<string> {
  const res = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "cards",
      source_text: SAMPLE_INPUT,
      style_id: "xiaohongshu_fresh",
      ratio: "3:4",
      generation_mode: "batch",
    }),
  });
  if (!res.ok) {
    throw new Error(`POST /api/tasks ${res.status}: ${await res.text()}`);
  }
  const j = (await res.json()) as CreateResponse;
  if (!j.taskId) throw new Error(`无 taskId: ${JSON.stringify(j)}`);
  return j.taskId;
}

async function fetchTask(taskId: string): Promise<TaskDetail> {
  const res = await fetch(`${BASE}/api/tasks/${taskId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GET /api/tasks/${taskId} ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as TaskDetail;
}

(async () => {
  console.log(`[e2e] BASE=${BASE}`);
  console.log("[e2e] POST /api/tasks ...");
  const taskId = await postTask();
  console.log(`[e2e] ✅ taskId=${taskId}`);
  console.log(`[e2e] task page: ${BASE}/task/${taskId}`);

  const startedAt = Date.now();
  let lastStatus = "";
  let lastImageCount = 0;

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const t = await fetchTask(taskId);
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);

    if (t.status !== lastStatus) {
      console.log(
        `[e2e t=${elapsedSec}s] status=${t.status} phase=${t.agentPhase ?? "-"}`,
      );
      lastStatus = t.status;
    }

    const imgCount = t.images?.length ?? 0;
    if (imgCount > lastImageCount) {
      const newOnes = (t.images ?? []).slice(lastImageCount);
      for (const img of newOnes) {
        console.log(
          `[e2e t=${elapsedSec}s] 🎴 第 ${img.pageNo} 张 → ${img.url.slice(0, 100)}...`,
        );
      }
      lastImageCount = imgCount;
    }

    if (t.status === "done") {
      const expected = t.analyzeResult?.cards?.length ?? imgCount;
      console.log(
        `\n🎉 任务完成。${imgCount}/${expected} 张图全部生成。耗时 ${elapsedSec}s`,
      );
      console.log(`\n打开任务页查看效果:${BASE}/task/${taskId}\n`);
      process.exit(0);
    }
    if (t.status === "failed" || t.status === "cancelled") {
      console.error(`\n❌ 任务 ${t.status}`);
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  console.error(`\n❌ 等待 ${TIMEOUT_MS / 1000}s 仍未完成`);
  process.exit(1);
})().catch((e) => {
  console.error("\n❌ smoke-e2e 异常:", e);
  process.exit(1);
});
