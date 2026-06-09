export const packageVersion = "0.1.0";

export { TranslatorError, serializeError } from "./errors.js";
export { OpenAICompatibleClient } from "./provider/openaiCompatibleClient.js";
export type { SerializedTranslatorError, TranslatorErrorCode } from "./errors.js";
export type {
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  LlmProvider
} from "./provider/types.js";
export type {
  ChunkResult,
  GlossaryTerm,
  Locale,
  ProviderClient,
  ProviderConfig,
  TokenUsage,
  TranslateMarkdownOptions,
  TranslateMarkdownResult
} from "./types.js";
