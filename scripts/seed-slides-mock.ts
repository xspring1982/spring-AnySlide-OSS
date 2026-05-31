// 给一个 slides 任务塞 mock outline + 4 张 task_files,用于 UI 布局验证
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL!;
  const sql = neon(url);
  const taskId = process.argv[2] || "Brm_vWKt-YqR";

  const html1 = `<div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);height:100vh;display:flex;align-items:center;justify-content:center;color:#fff;text-align:center"><div><div class="kicker" style="color:#999;letter-spacing:.1em;font-size:11px;margin-bottom:8px">早起系列</div><h1 class="h-hero" style="font-size:80px;font-weight:900;margin:0">早起 3 大好处</h1><p class="h-sub" style="margin-top:16px;color:#aaa">改变一天的开始</p></div></div>`;
  const html2 = `<div style="padding:40px;height:100vh"><div class="kicker">第 1 点</div><h1 class="h-xl" style="margin:8px 0 32px">大脑清晰</h1><p class="lead">早晨醒来后,大脑经历了一夜的休息,神经连接重组,信息处理能力达到峰值。这是处理复杂任务、做决策的最佳时机。</p></div>`;
  const html3 = `<div style="padding:40px;height:100vh"><div class="kicker">第 2 点</div><h1 class="h-xl" style="margin:8px 0 32px">时间充裕</h1><div class="grid-3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px"><div style="padding:16px;background:#fef3e7"><h3>静思</h3><p>独立思考的黄金时段</p></div><div style="padding:16px;background:#e7f3fe"><h3>规划</h3><p>梳理一天的优先级</p></div><div style="padding:16px;background:#e7fee7"><h3>执行</h3><p>专注完成最重要的事</p></div></div></div>`;
  const html4 = `<div style="background:#FF5722;color:#fff;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:40px"><div class="kicker" style="opacity:.7">总结</div><h1 class="h-xl" style="margin:16px 0">从明天开始,提早 1 小时</h1><p class="lead" style="opacity:.9">改变,从一个清晨开始</p></div>`;

  const slides = [
    { idx: 1, role: "cover", title: "早起 3 大好处", html: html1 },
    { idx: 2, role: "content", title: "大脑清晰", html: html2 },
    { idx: 3, role: "content", title: "时间充裕", html: html3 },
    { idx: 4, role: "closing", title: "从明天开始", html: html4 },
  ];

  // 先写 outline
  const analyze = {
    task_title: "早起 3 大好处",
    overall_topic: "早起",
    suggested_total_slides: 4,
    outline: {
      cover: { index: 1, role: "cover", title: "早起 3 大好处" },
      sections: [
        {
          title: "正文",
          slides: [
            { index: 2, role: "content", title: "大脑清晰" },
            { index: 3, role: "content", title: "时间充裕" },
          ],
        },
      ],
      closing: { index: 4, role: "closing", title: "从明天开始" },
    },
  };

  await sql`
    UPDATE tasks
    SET status = 'done',
        agent_phase = 'closing',
        analyze_result = ${JSON.stringify(analyze)}::jsonb,
        generation_mode = 'l1_html',
        updated_at = NOW()
    WHERE id = ${taskId}
  `;

  // 清掉旧 task_files
  await sql`DELETE FROM task_files WHERE task_id = ${taskId}`;

  for (const s of slides) {
    const dataUrl = "data:text/html;base64," + Buffer.from(s.html).toString("base64");
    const id = `mock_${taskId}_${s.idx}`;
    await sql`
      INSERT INTO task_files (id, task_id, type, page_no, page_version, role, filename, storage_url, size_bytes, mime_type)
      VALUES (${id}, ${taskId}, 'image', ${s.idx}, 1, ${s.role}, ${"slide_" + s.idx + ".html"}, ${dataUrl}, ${s.html.length}, 'text/html')
    `;
  }

  console.log(`✓ seeded ${slides.length} slides for ${taskId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
