// ImageProvider 工厂。
//
// 当前默认走一个 OpenAI-compatible async image provider。自托管时通过
// OPENAI_API_KEY / OPENAI_BASE_URL / ANYSLIDE_IMAGE_MODEL_HIGH 选择实际供应商。

import { ApimartGptImage2Provider } from "./apimart-gpt-image-2";
import type { ImageProvider } from "./types";

export type { ImageProvider, ImageSubmitInput, ImagePollResult } from "./types";

export function pickImageProvider(): ImageProvider {
  return new ApimartGptImage2Provider();
}
