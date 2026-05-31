// SPEC §6.1 4.3 — 定时任务:每天清理过期 task_files
//
// Free 用户上传 / 生成的图片有 expires_at(7 天后),过期后:
//   1. 软删 task_files(deleted_at = NOW)
//   2. 物理删 R2 / 本地存储里的对象(P1 接 Storage adapter)
// 同时:每日重置 free 用户当天的积分(SPEC §5.4.2,默认目标 10)。
//
// Inngest cron:每天 UTC 16:00(= 北京 00:00),每天一次。

import { staticSchema } from "inngest";
import { inngest } from "../client";
import { sql } from "@/lib/db";
import { FREE_DAILY_RESET_AMOUNT } from "@/lib/credits";

export const cronCleanup = inngest.createFunction(
  {
    id: "cron-cleanup-daily",
    name: "每日清理过期文件 + Free 积分重置",
    retries: 3,
    triggers: [{ cron: "TZ=Asia/Shanghai 0 0 * * *" }, { event: "system/cron.cleanup" }],
  },
  async ({ step }) => {
    // ── 1. 物理标记过期文件 deleted_at(R2 物理删交给 P1 storage adapter) ──
    const deletedFiles = await step.run("expire-files", async () => {
      const r = (await sql`
        UPDATE task_files
        SET deleted_at = NOW()
        WHERE expires_at IS NOT NULL
          AND expires_at < NOW()
          AND deleted_at IS NULL
        RETURNING id, storage_url
      `) as Array<{ id: string; storage_url: string }>;
      return r.length;
    });

    // ── 2. Free 用户每日积分重置 ──
    // SPEC §5.4.2:credit_balance < FREE_DAILY_RESET_AMOUNT 的 free 用户拉到目标,
    // 记一条 daily_reset 流水。
    // 用 CTE 把"重置前的余额"先 capture 出来,再做 UPDATE,这样 delta 计算才准确。
    const target = FREE_DAILY_RESET_AMOUNT;
    const resetCount = await step.run("daily-reset-free", async () => {
      const updated = (await sql`
        WITH targets AS (
          SELECT id, credit_balance AS old_balance
          FROM users
          WHERE plan = 'free' AND credit_balance < ${target}
          FOR UPDATE
        ),
        bumped AS (
          UPDATE users u
          SET credit_balance = ${target},
              credit_reset_at = NOW(),
              updated_at = NOW()
          FROM targets t
          WHERE u.id = t.id
          RETURNING u.id, t.old_balance
        )
        SELECT id, old_balance FROM bumped
      `) as Array<{ id: string; old_balance: number }>;
      // 给每个被重置的用户写一条流水(注意:幂等 — 一天只跑一次,不会重复)
      const today = new Date().toISOString().slice(0, 10);
      for (const u of updated) {
        const delta = target - u.old_balance; // 老余额可能为负,target-(-5)=target+5,自然兜正
        await sql`
          INSERT INTO credit_transactions (id, user_id, delta, reason, created_at)
          VALUES (
            ${"reset_" + u.id + "_" + today},
            ${u.id},
            ${delta},
            'daily_reset',
            NOW()
          )
          ON CONFLICT (id) DO NOTHING
        `;
      }
      return updated.length;
    });

    return {
      ranAt: new Date().toISOString(),
      filesExpired: deletedFiles,
      usersReset: resetCount,
    };
  },
);

// 给手动触发用 — 测试时直接 inngest.send({name:'system/cron.cleanup'})
export type CronCleanupPayload = Record<string, unknown>;
const _staticSchemaUnused = staticSchema<CronCleanupPayload>;
void _staticSchemaUnused;
