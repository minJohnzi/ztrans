import { chunkMarkdown, type MarkdownChunk } from "../markdown/chunk.js";
import { cleanModelOutput } from "../markdown/cleanModelOutput.js";
import { validateMarkdownStructure } from "../markdown/validate.js";
import { TranslatorError } from "../errors.js";
import { OpenAICompatibleClient } from "../provider/openaiCompatibleClient.js";
import type { LlmProvider } from "../provider/types.js";
import type {
  ChunkResult,
  TokenUsage,
  TranslateMarkdownOptions,
  TranslateMarkdownResult,
} from "../types.js";
import { createChunkPrompt, createSystemPrompt } from "./prompts.js";

export type TranslateMarkdownDefaults = Omit<Partial<TranslateMarkdownOptions>, "markdown">;
export type TranslateMarkdownInput = Pick<TranslateMarkdownOptions, "markdown"> &
  Partial<Omit<TranslateMarkdownOptions, "markdown">>;
export type TranslateMarkdownInputWithTarget = Pick<TranslateMarkdownOptions, "markdown"> &
  Partial<Omit<TranslateMarkdownOptions, "markdown" | "targetLocale">> &
  Pick<TranslateMarkdownOptions, "targetLocale">;

interface TranslatedChunk {
  markdown: string;
  metadata: ChunkResult;
  usage?: TokenUsage;
}

const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_CONCURRENCY = 1;

export async function translateMarkdown(
  options: TranslateMarkdownOptions,
): Promise<TranslateMarkdownResult> {
  const concurrency = normalizeConcurrency(options.concurrency);
  const chunks = chunkMarkdown(options.markdown, { maxChars: options.maxChunkChars });
  const frontmatterMarkdown = chunks.find(
    (chunk) => chunk.frontmatterMarkdown,
  )?.frontmatterMarkdown;
  const translatableChunks = chunks.filter((chunk) => chunk.markdown.length > 0);

  if (translatableChunks.length === 0) {
    return {
      markdown: frontmatterMarkdown?.trimEnd() ?? "",
      sourceLocale: options.sourceLocale,
      targetLocale: options.targetLocale,
      chunks: [],
      warnings: [],
    };
  }

  const providerClient =
    options.providerClient ?? new OpenAICompatibleClient(options.provider ?? {});
  const translatedChunks = await translateChunksWithConcurrency(
    translatableChunks,
    concurrency,
    options,
    providerClient,
  );

  const markdown = prependFrontmatter(
    frontmatterMarkdown,
    translatedChunks.map((chunk) => chunk.markdown).join("\n\n"),
  );
  const warnings = translatedChunks.flatMap((chunk) =>
    chunk.metadata.warnings.map(
      (warning) => `Chunk ${chunk.metadata.index} validation failed: ${warning}`,
    ),
  );
  const usage = aggregateUsage(translatedChunks.map((chunk) => chunk.usage));

  return {
    markdown,
    sourceLocale: options.sourceLocale,
    targetLocale: options.targetLocale,
    chunks: translatedChunks.map((chunk) => chunk.metadata),
    warnings,
    usage,
  };
}

export function createTranslator(
  defaults: TranslateMarkdownDefaults & Pick<TranslateMarkdownOptions, "targetLocale">,
): (options: TranslateMarkdownInput) => Promise<TranslateMarkdownResult>;
export function createTranslator(
  defaults: TranslateMarkdownDefaults,
): (options: TranslateMarkdownInputWithTarget) => Promise<TranslateMarkdownResult>;
export function createTranslator(defaults: TranslateMarkdownDefaults) {
  return (options: TranslateMarkdownInput): Promise<TranslateMarkdownResult> =>
    translateMarkdown(
      requireTargetLocale({
        ...defaults,
        ...options,
        provider: mergeProviderConfig(defaults.provider, options.provider),
      }),
    );
}

function requireTargetLocale(options: TranslateMarkdownInput): TranslateMarkdownOptions {
  if (!options.targetLocale) {
    throw new TranslatorError("unsupported_locale", "targetLocale is required.");
  }

  return {
    ...options,
    targetLocale: options.targetLocale,
  };
}

function mergeProviderConfig(
  defaultsProvider: TranslateMarkdownDefaults["provider"],
  optionsProvider: TranslateMarkdownInput["provider"],
): TranslateMarkdownOptions["provider"] {
  if (!defaultsProvider && !optionsProvider) {
    return undefined;
  }

  return {
    ...defaultsProvider,
    ...optionsProvider,
  };
}

async function translateChunksWithConcurrency(
  chunks: MarkdownChunk[],
  concurrency: number,
  options: TranslateMarkdownOptions,
  providerClient: LlmProvider,
): Promise<TranslatedChunk[]> {
  const results = new Array<TranslatedChunk>(chunks.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, chunks.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < chunks.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await translateChunk(chunks[currentIndex], options, providerClient);
      }
    }),
  );

  return results;
}

async function translateChunk(
  chunk: MarkdownChunk,
  options: TranslateMarkdownOptions,
  providerClient: LlmProvider,
): Promise<TranslatedChunk> {
  const maxAttempts = shouldRetryValidation(options) ? normalizeMaxAttempts(options.maxRetries) : 1;
  let lastMarkdown = "";
  let lastWarnings: string[] = [];
  const usages: Array<TokenUsage | undefined> = [];

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await providerClient.complete({
      temperature: options.provider?.temperature,
      messages: [
        {
          role: "system",
          content: createSystemPrompt(options),
        },
        {
          role: "user",
          content: createChunkPrompt({
            sourceLocale: options.sourceLocale,
            targetLocale: options.targetLocale,
            headingPath: chunk.headingPath,
            glossary: options.glossary,
            styleGuide: options.styleGuide,
            markdown: chunk.markdown,
          }),
        },
      ],
    });

    lastMarkdown = cleanModelOutput(response.content);
    usages.push(response.usage);
    lastWarnings = shouldValidateStructure(options)
      ? validateMarkdownStructure(chunk.markdown, lastMarkdown)
      : [];

    if (lastWarnings.length === 0) {
      break;
    }
  }

  return {
    markdown: lastMarkdown,
    metadata: {
      index: chunk.index,
      inputChars: chunk.markdown.length,
      outputChars: lastMarkdown.length,
      warnings: lastWarnings,
    },
    usage: aggregateUsage(usages),
  };
}

function shouldValidateStructure(options: TranslateMarkdownOptions): boolean {
  return options.validateStructure !== false;
}

function shouldRetryValidation(options: TranslateMarkdownOptions): boolean {
  return shouldValidateStructure(options) && options.retryOnValidationFailure !== false;
}

function normalizeMaxAttempts(maxRetries: number | undefined): number {
  const retries = maxRetries ?? DEFAULT_MAX_RETRIES;
  return Math.max(1, Math.floor(retries) + 1);
}

function normalizeConcurrency(concurrency: number | undefined): number {
  const normalized = concurrency ?? DEFAULT_CONCURRENCY;

  if (!Number.isFinite(normalized) || !Number.isInteger(normalized) || normalized <= 0) {
    throw new TranslatorError(
      "validation_failed",
      "concurrency must be a positive finite integer.",
      {
        concurrency,
      },
    );
  }

  return normalized;
}

function prependFrontmatter(frontmatterMarkdown: string | undefined, markdown: string): string {
  const translatedMarkdown = markdown.trim();

  if (!frontmatterMarkdown) {
    return translatedMarkdown;
  }

  if (translatedMarkdown.length === 0) {
    return frontmatterMarkdown.trimEnd();
  }

  return `${frontmatterMarkdown}${translatedMarkdown}`;
}

function aggregateUsage(usages: Array<TokenUsage | undefined>): TokenUsage | undefined {
  const totals: TokenUsage = {};
  let sawUsage = false;

  for (const usage of usages) {
    if (!usage) {
      continue;
    }

    sawUsage = true;
    totals.promptTokens = addUsage(totals.promptTokens, usage.promptTokens);
    totals.completionTokens = addUsage(totals.completionTokens, usage.completionTokens);
    totals.totalTokens = addUsage(totals.totalTokens, usage.totalTokens);
  }

  return sawUsage ? totals : undefined;
}

function addUsage(current: number | undefined, next: number | undefined): number | undefined {
  if (next === undefined) {
    return current;
  }

  return (current ?? 0) + next;
}
