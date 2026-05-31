// OpenAI-compatible async image provider.
//
// 关键差异(对比 OpenAI 官方同步 images.generate):
//   - 异步模式:POST /v1/images/generations 返回 task_id
//   - 轮询:GET /v1/tasks/{task_id} → pending/processing/completed/failed
//   - 状态完成后图片 URL 在 data.result.images[0].url[0]
//   - image_urls 字段就是 SPEC §2.7 anchor chain 用的 ref(最多 16 张)
//   - 不支持 quality/style/response_format(传了会被忽略)

import type {
  ImageProvider,
  ImagePollResult,
  ImageSubmitInput,
  ImageSubmitResult,
} from "./types";
import type { RatioId } from "@/lib/cards/styles/types";

const RATIO_TO_SIZE: Record<RatioId, string> = {
  "3:4": "3:4",
  "4:5": "4:5",
  "1:1": "1:1",
  "9:16": "9:16",
  "3:2": "3:2",
  "16:9": "16:9",
  "4:3": "4:3",
};

// Provider response shape:
//   submit: { code: 200, data: [{ status: "submitted", task_id: "task_xxx" }] }
//   poll:   { code: 200, data: { task_id, status, result?: { images: [{ url }] }, error?: ... } }
// 兼容文档与平铺字段,做容错解析。

type ApimartImage = { url?: string | string[] };
type ApimartTaskBody = {
  task_id?: string;
  id?: string;
  status?: string;
  result?: { images?: ApimartImage[] };
  error?: string | { message?: string };
};

interface ApimartTaskResponse {
  code?: number;
  data?: ApimartTaskBody | ApimartTaskBody[];
  // 有些聚合站直接把字段平铺
  task_id?: string;
  id?: string;
  status?: string;
  result?: { images?: ApimartImage[] };
  error?: string | { message?: string };
}

interface ApimartCreateResponse {
  code?: number;
  data?: ApimartTaskBody | ApimartTaskBody[];
  task_id?: string;
  id?: string;
}

function pickFirst<T>(v: T | T[] | undefined): T | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

// dev log 里偶发 `TypeError: terminated` —— undici 底层 socket 在长连接上被对端切断,
// 不是 HTTP 状态码错误,fetch() 直接 throw。submit/poll 的网络层都需要兜一下。
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { timeoutMs: number; retries: number; label: string },
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      // 最后一次失败直接抛
      if (attempt === opts.retries) break;
      // 200ms / 600ms 退避
      await new Promise((r) => setTimeout(r, 200 * Math.pow(3, attempt)));
    }
  }
  const reason = lastErr instanceof Error ? `${lastErr.name}: ${lastErr.message}` : String(lastErr);
  throw new Error(`apimart ${opts.label} 网络失败(已重试 ${opts.retries} 次): ${reason}`);
}

export class ApimartGptImage2Provider implements ImageProvider {
  readonly id = "apimart-gpt-image-2" as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    const baseUrl = opts?.baseUrl ?? process.env.OPENAI_BASE_URL;
    if (!baseUrl) {
      throw new Error("ApimartGptImage2Provider: OPENAI_BASE_URL 未配置");
    }
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = opts?.model ?? process.env.ANYSLIDE_IMAGE_MODEL_HIGH ?? "gpt-image-2";
    if (!this.apiKey) {
      throw new Error("ApimartGptImage2Provider: OPENAI_API_KEY 未配置");
    }
  }

  async submit(input: ImageSubmitInput): Promise<ImageSubmitResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      prompt: input.prompt,
      size: RATIO_TO_SIZE[input.ratio],
      n: input.n ?? 1,
    };
    if (input.refImageUrls && input.refImageUrls.length > 0) {
      body.image_urls = input.refImageUrls.slice(0, 16);
    }

    const res = await fetchWithRetry(
      `${this.baseUrl}/images/generations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      { timeoutMs: 60_000, retries: 2, label: "submit" },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `apimart submit ${res.status} ${res.statusText}: ${text.slice(0, 500)}`,
      );
    }

    const json = (await res.json()) as ApimartCreateResponse;
    const inner = pickFirst(json.data);
    const taskId = inner?.task_id ?? inner?.id ?? json.task_id ?? json.id;
    if (!taskId) {
      throw new Error(
        `apimart submit: 响应里找不到 task_id,原文 ${JSON.stringify(json).slice(0, 500)}`,
      );
    }
    return { taskId };
  }

  async poll(taskId: string): Promise<ImagePollResult> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
      },
      { timeoutMs: 30_000, retries: 1, label: "poll" },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `apimart poll ${res.status} ${res.statusText}: ${text.slice(0, 500)}`,
      );
    }

    const json = (await res.json()) as ApimartTaskResponse;
    const data: ApimartTaskBody = pickFirst(json.data) ?? (json as ApimartTaskBody);
    const status = (data.status ?? "").toLowerCase();

    if (status === "pending" || status === "queued" || status === "submitted") {
      return { status: "pending" };
    }
    if (status === "processing" || status === "running") {
      return { status: "processing" };
    }
    if (status === "completed" || status === "succeeded" || status === "success") {
      const images = data.result?.images ?? [];
      const urls: string[] = [];
      for (const img of images) {
        const u = img?.url;
        if (Array.isArray(u)) urls.push(...u.filter(Boolean));
        else if (typeof u === "string" && u) urls.push(u);
      }
      if (urls.length === 0) {
        return { status: "failed", error: "completed 但没拿到 image url" };
      }
      return { status: "completed", imageUrls: urls };
    }
    if (status === "failed" || status === "error") {
      const err = data.error;
      const msg = typeof err === "string" ? err : err?.message ?? "unknown";
      return { status: "failed", error: msg };
    }
    // 未知状态当 processing 处理(让 caller 继续轮询)
    return { status: "processing" };
  }
}
