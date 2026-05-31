// SPEC §6.1.2 — R2 切换上线前回归
//
// 用法:npx tsx --env-file=.env.local scripts/smoke-r2.ts
//
// 验证 7 项:
//   1. 凭证连通(尝试 list,空 prefix)
//   2. put     — 上传 key=smoke/<ts>.txt 含一段标记
//   3. exists  — head 该 key 应 true
//   4. get     — 拉回内容应 == 上传内容
//   5. list    — prefix=smoke/ 能列出该 key
//   6. signedUrl — 生成签名 URL,fetch 之能拿到原文
//   7. softDelete — copy → _trash/ + 原 key 消失
//   8. hardDelete — 清掉 _trash/ 副本
//
// 全部通过即 §6.1.2 验收 ✅

import { storage } from "../src/lib/storage";

async function main() {
  const ts = Date.now();
  const key = `smoke/r2-regression-${ts}.txt`;
  const payload = `R2 smoke @ ${new Date().toISOString()} — STORAGE_BACKEND=${process.env.STORAGE_BACKEND}`;

  console.log("\n=== R2 回归 smoke ===");
  console.log("backend:", process.env.STORAGE_BACKEND);
  console.log("bucket :", process.env.R2_BUCKET);
  console.log("endpoint:", process.env.R2_ENDPOINT);
  console.log("test key:", key);

  // 1. 连通性 / list 空 prefix
  console.log("\n[1] list (probe connectivity)…");
  const probe = await storage.list("");
  console.log("  ✓ 连通,当前 bucket 共", probe.length, "个对象(头 1000)");

  // 2. put
  console.log("\n[2] put …");
  await storage.put(key, payload, { contentType: "text/plain; charset=utf-8" });
  console.log("  ✓ 上传完成");

  // 3. exists
  console.log("\n[3] exists …");
  const ok = await storage.exists(key);
  if (!ok) throw new Error("FAIL: exists 返回 false");
  console.log("  ✓ exists = true");

  // 4. get
  console.log("\n[4] get …");
  const got = await storage.get(key);
  const gotStr = got.toString("utf-8");
  if (gotStr !== payload) {
    throw new Error(`FAIL: 拉回内容不一致\n  expected: ${payload}\n  got     : ${gotStr}`);
  }
  console.log("  ✓ 内容一致(", gotStr.length, "B)");

  // 5. list with prefix
  console.log("\n[5] list (prefix=smoke/) …");
  const listed = await storage.list("smoke/");
  const found = listed.find((o) => o.key === key);
  if (!found) throw new Error(`FAIL: list 没找到 ${key}`);
  console.log("  ✓ 找到, size =", found.size, "B");

  // 6. signedUrl
  console.log("\n[6] signedUrl(60s) + fetch …");
  const url = await storage.signedUrl(key, 60);
  console.log("  signed url:", url.slice(0, 100), "…");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FAIL: signed URL fetch ${res.status} ${res.statusText}`);
  const fetched = await res.text();
  if (fetched !== payload) throw new Error("FAIL: signed URL 拉回内容不一致");
  console.log("  ✓ 签名 URL 可访问 + 内容一致");

  // 7. softDelete
  console.log("\n[7] softDelete …");
  await storage.softDelete(key);
  const stillExists = await storage.exists(key);
  if (stillExists) throw new Error("FAIL: softDelete 后原 key 仍存在");
  const trashKey = `_trash/${key}`;
  const inTrash = await storage.exists(trashKey);
  if (!inTrash) throw new Error("FAIL: softDelete 后 _trash/ 副本不存在");
  console.log("  ✓ 原 key 消失,_trash/ 副本就绪");

  // 8. hardDelete _trash 副本
  console.log("\n[8] hardDelete _trash 副本(清理)…");
  await storage.hardDelete(trashKey);
  const trashStill = await storage.exists(trashKey);
  if (trashStill) throw new Error("FAIL: hardDelete 后 _trash/ 副本仍存在");
  console.log("  ✓ 已彻底清理");

  console.log("\n=== ✅ R2 回归全部通过(SPEC §6.1.2 P0 验收) ===\n");
}

main().catch((err) => {
  console.error("\n❌ R2 smoke FAIL:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
