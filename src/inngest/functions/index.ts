// Inngest 函数注册表 — /api/inngest/route.ts 用这个一次性导出全部函数

import { cardsGenerate } from "./cards-generate";
import { cardsRegenerateCard } from "./cards-regenerate-card";
import { slidesGenerate } from "./slides-generate";
import { slidesRefine } from "./slides-refine";
import { imageGenerate } from "./image-generate";
import { cronCleanup } from "./cron-cleanup";

export const allFunctions = [
  cardsGenerate,
  cardsRegenerateCard,
  slidesGenerate,
  slidesRefine,
  imageGenerate,
  cronCleanup,
];
