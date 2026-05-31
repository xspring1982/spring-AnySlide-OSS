// SPEC §5.3 AI Adapter 统一入口
//
// 业务代码统一从这里 import:
//
//   import { ai } from '@/lib/ai';
//   const out = await ai.text.complete({ system, user, tier: 'default', cacheSystem: true });
//   const provider = ai.image.pick();
//   const { taskId } = await provider.submit({ prompt, ratio: '3:4' });
//   const result = await provider.poll(taskId);

import { getTextAdapter } from "./text";
import { pickImageProvider } from "./image";
import { jinaResearch, shouldResearch, extractUrls } from "./research/jina";

export const ai = {
  text: {
    complete: (input: Parameters<ReturnType<typeof getTextAdapter>["complete"]>[0]) =>
      getTextAdapter().complete(input),
  },
  image: {
    pick: pickImageProvider,
  },
  research: {
    /** SPEC §5.6 — Jina Reader 联网调研入口 */
    fetch: jinaResearch,
    shouldFetch: shouldResearch,
    extractUrls,
  },
};

// 便捷 re-export(给上层免去 deep import)
export type {
  TextCompleteInput,
  TextCompleteOutput,
  TextTier,
} from "./text";
export type {
  ImageProvider,
  ImageSubmitInput,
  ImagePollResult,
} from "./image";
