export type Locale = "zh" | "en" | (string & {});

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
}

export interface GlossaryTerm {
  source: string;
  target: string;
  note?: string;
}

export interface ProviderClient {
  complete(request: {
    messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
    temperature?: number;
  }): Promise<{
    content: string;
    usage?: TokenUsage;
  }>;
}

export interface TranslateMarkdownOptions {
  markdown: string;
  sourceLocale?: Locale;
  targetLocale: Locale;
  provider?: ProviderConfig;
  providerClient?: ProviderClient;
  glossary?: GlossaryTerm[];
  styleGuide?: string;
  maxChunkChars?: number;
  concurrency?: number;
  retryOnValidationFailure?: boolean;
  maxRetries?: number;
  validateStructure?: boolean;
}

export interface ChunkResult {
  index: number;
  inputChars: number;
  outputChars: number;
  warnings: string[];
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface TranslateMarkdownResult {
  markdown: string;
  sourceLocale?: Locale;
  targetLocale: Locale;
  chunks: ChunkResult[];
  warnings: string[];
  usage?: TokenUsage;
}
