// SPEC §2.9 + Phase2 T2-30 — 系统模板列表
// GET /api/templates              → 当前 locale(从 cookie / Accept-Language 检测)
// GET /api/templates?locale=zh    → 强制 locale,前端切语言时显式传可避免 cookie 滞后
//
// M9 多语言改造(2026-05-09):
//   按 locale 从 *_i18n JSONB 字段读 name / one_liner / headline / subhead,
//   走 pickLocalized 的 fallback 链(目标 locale → en → zh → 旧字段)。
//   prompt_seed 不在列表 API 返回(数据量大 + 后端 inngest 直查 DB),
//   仅展示性字段在这里 i18n 化。

import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ALL_LOCALES, pickLocalized } from "@/i18n/locale-util";
import type { Locale } from "@/i18n/routing";

interface TemplateRow {
  id: string;
  mode: string;
  name: string;
  topic_tag: string | null;
  style_id: string;
  preview_url: string | null;
  preset_audience: string | null;
  preset_focus: string | null;
  preset_tone: string | null;
  preset_outline_strategy: string | null;
  recommended_count: number | null;
  locked_ratio: string | null;
  locked_generation_mode: string | null;
  headline: string | null;
  subhead: string | null;
  thumb_class: string | null;
  one_liner: string | null;
  uses_count: number;
  template_path: string | null;
  baoyu_style_id: string | null;
  // M9 i18n 字段
  name_i18n: Record<string, string> | null;
  one_liner_i18n: Record<string, string> | null;
  headline_i18n: Record<string, string> | null;
  subhead_i18n: Record<string, string> | null;
}

function resolveLocale(req: NextRequest): Locale {
  // 1. 显式 query string 优先
  const q = req.nextUrl.searchParams.get("locale");
  if (q && (ALL_LOCALES as readonly string[]).includes(q)) {
    return q as Locale;
  }
  // 2. NEXT_LOCALE cookie
  const cookie = req.cookies.get("NEXT_LOCALE")?.value;
  if (cookie && (ALL_LOCALES as readonly string[]).includes(cookie)) {
    return cookie as Locale;
  }
  // 3. Accept-Language(简化解析)
  const accept = (req.headers.get("accept-language") ?? "").toLowerCase();
  if (accept.includes("zh-tw") || accept.includes("zh-hant")) return "zh-TW";
  if (accept.includes("zh")) return "zh";
  if (accept.includes("ja")) return "ja";
  if (accept.includes("ko")) return "ko";
  if (accept.includes("en")) return "en";
  // 4. fallback en(routing.defaultLocale)
  return "en";
}

// 依赖缺失的 deck-stage.js 运行时 → 渲染全黑,暂时隐藏(2026-05-22)
const DECK_STAGE_BROKEN_TEMPLATES = [
  "ext-pin-and-paper",
  "ext-stencil-tablet",
  "ext-creative-mode",
  "ext-pink-script",
  "ext-editorial-tri-tone",
  "ext-soft-editorial",
  "ext-peoples-platform",
  "ext-neo-grid-bold",
];

export async function GET(req: NextRequest) {
  const locale = resolveLocale(req);

  // 只返浏览器渲染列表必要字段,不返 template_html / custom_prompt_addon 等重内容
  // 2026-05-21:L2(AI 生图)前端整体下线 → 模板墙过滤掉 l2_image(后端 L2 代码保留;
  //   恢复 L2 时删掉 WHERE 里的 template_path 条件即可)
  // 2026-05-22:这 8 个 external 模板依赖一个仓库里不存在的 `deck-stage.js` 运行时
  //   (<deck-stage> 自定义元素负责给每页定尺寸 + 翻页);缺它时每页塌成 0 高 → 全黑屏。
  //   暂时从模板墙隐藏,等补上 deck-stage 运行时(或内联)再放出。
  const rows = (await sql`
    SELECT
      id, mode, name, topic_tag, style_id, preview_url,
      preset_audience, preset_focus, preset_tone, preset_outline_strategy,
      recommended_count,
      locked_ratio, locked_generation_mode,
      headline, subhead, thumb_class, one_liner,
      uses_count, template_path, baoyu_style_id,
      name_i18n, one_liner_i18n, headline_i18n, subhead_i18n
    FROM templates
    WHERE owner_user_id IS NULL
      AND template_path IS DISTINCT FROM 'l2_image'
      AND NOT (id = ANY(${DECK_STAGE_BROKEN_TEMPLATES}))
    ORDER BY (preview_url IS NULL) ASC, uses_count DESC, created_at DESC
  `) as unknown as TemplateRow[];

  return Response.json({
    locale,
    templates: rows.map((r) => {
      // M9: 优先读 i18n JSONB,fallback 到旧单语言字段
      const title = pickLocalized(r.name_i18n, locale, r.name);
      const oneLiner = pickLocalized(r.one_liner_i18n, locale, r.one_liner ?? "");
      const headline = pickLocalized(r.headline_i18n, locale, r.headline ?? title);
      const subhead = pickLocalized(r.subhead_i18n, locale, r.subhead ?? "");

      return {
        id: r.id,
        mode: r.mode,
        title,
        niche: r.topic_tag ?? "其他",
        uses: `${r.uses_count.toLocaleString()} uses`,
        thumbClass: r.thumb_class ?? "as-theme-business",
        headline,
        subhead: subhead || undefined,
        imageSrc: r.preview_url ?? undefined,
        hasPromptSeed: true,
        lockedStyleId: r.style_id,
        lockedRatio: r.locked_ratio ?? undefined,
        lockedGenerationMode: r.locked_generation_mode ?? undefined,
        oneLiner: oneLiner || undefined,
        templatePath: r.template_path ?? undefined,
        baoyuStyleId: r.baoyu_style_id ?? undefined,
        presetAudience: r.preset_audience,
        recommendedCount: r.recommended_count,
      };
    }),
  }, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
