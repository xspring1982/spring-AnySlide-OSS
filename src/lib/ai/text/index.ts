// 文本 adapter 工厂
//
// M1 起步:Anthropic SDK + DeepSeek Anthropic-compat endpoint(看 .env.local)
// 上线切真 Claude:把 ANTHROPIC_BASE_URL 改回 api.anthropic.com 即可

import { AnthropicAdapter } from "./anthropic-adapter";
import type { TextAdapter } from "./types";

export type {
  TextAdapter,
  TextCompleteInput,
  TextCompleteOutput,
  TextTier,
} from "./types";

let _adapter: TextAdapter | null = null;

/** 单例,避免每次重建 SDK 客户端 */
export function getTextAdapter(): TextAdapter {
  if (!_adapter) {
    _adapter = new AnthropicAdapter();
  }
  return _adapter;
}
