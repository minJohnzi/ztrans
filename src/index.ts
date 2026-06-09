export const packageVersion = "0.1.0";

export { translatePostTranslation } from "./adapters/tworiver.js";
export { resolveProviderConfig } from "./config/env.js";
export { loadConfigFile } from "./config/loadConfig.js";
export { TranslatorError, serializeError } from "./errors.js";
export { chunkMarkdown } from "./markdown/chunk.js";
export { cleanModelOutput } from "./markdown/cleanModelOutput.js";
export { createStructureSignature, validateMarkdownStructure } from "./markdown/validate.js";
export { OpenAICompatibleClient } from "./provider/openaiCompatibleClient.js";
export { loadGlossaryFile, renderGlossaryForPrompt } from "./translate/glossary.js";
export { createChunkPrompt, createSystemPrompt } from "./translate/prompts.js";
export { createTranslator, translateMarkdown } from "./translate/translateMarkdown.js";
export type {
  TranslatePostTranslationOptions,
  TranslatePostTranslationResult,
  TwoRiverPostTranslation,
} from "./adapters/tworiver.js";
export type { ResolveProviderConfigInput } from "./config/env.js";
export type { TranslatorConfigFile } from "./config/loadConfig.js";
export type { SerializedTranslatorError, TranslatorErrorCode } from "./errors.js";
export type { ChunkMarkdownOptions, MarkdownChunk } from "./markdown/chunk.js";
export type { HeadingSignature, MarkdownStructureSignature } from "./markdown/validate.js";
export type {
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  LlmProvider,
} from "./provider/types.js";
export type {
  ChunkResult,
  GlossaryTerm,
  Locale,
  ProviderClient,
  ProviderConfig,
  TokenUsage,
  TranslateMarkdownOptions,
  TranslateMarkdownResult,
} from "./types.js";
export type { TranslationPromptOptions } from "./translate/prompts.js";
export type {
  TranslateMarkdownDefaults,
  TranslateMarkdownInput,
} from "./translate/translateMarkdown.js";
