// AI Adapter smoke test:验证 DeepSeek 文本 + apimart 图像 凭证可用。
// 用法:npx tsx scripts/smoke-ai.ts

// 用法:npx tsx --env-file=.env.local scripts/smoke-ai.ts
import { ai } from "../src/lib/ai";

async function smokeText() {
  console.log("\n=== [1/2] 文本 smoke:DeepSeek V4 Flash via Anthropic-compat ===");
  const out = await ai.text.complete({
    system: "你是测试助手。回复必须是合法 JSON。",
    user: '请回 {"ok": true, "model": "deepseek-v4-flash"} 这个 JSON。',
    tier: "default",
    maxTokens: 100,
    temperature: 0,
    cacheSystem: false,
  });
  console.log("model:", out.model);
  console.log("text:", out.text);
  console.log("usage:", out.usage);
  try {
    const j = JSON.parse(out.text);
    console.log("✅ JSON parse ok:", j);
  } catch {
    console.log("⚠️ 不是合法 JSON,但 endpoint 通了");
  }
}

async function smokeImage() {
  console.log("\n=== [2/2] 图像 smoke:apimart gpt-image-2 异步 ===");
  const provider = ai.image.pick();
  const submitted = await provider.submit({
    prompt:
      "A simple test card with Chinese text `测试通过`, white background, minimal style, sans-serif.",
    ratio: "1:1",
  });
  console.log("✅ submit ok, task_id:", submitted.taskId);

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const r = await provider.poll(submitted.taskId);
    console.log(`[poll ${i + 1}] status=${r.status}`);
    if (r.status === "completed") {
      console.log("✅ image url:", r.imageUrls[0]);
      return;
    }
    if (r.status === "failed") {
      console.error("❌ failed:", r.error);
      process.exit(1);
    }
  }
  console.error("❌ 轮询 30 次仍未完成,放弃");
  process.exit(1);
}

(async () => {
  await smokeText();
  await smokeImage();
  console.log("\n🎉 两端都通了。");
})().catch((e) => {
  console.error("\n❌ smoke failed:", e);
  process.exit(1);
});
