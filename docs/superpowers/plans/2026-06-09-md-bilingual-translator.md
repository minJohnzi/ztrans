# md-bilingual-translator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an open-source TypeScript CLI and library that translates Chinese/English technical Markdown through an OpenAI-compatible API while preserving Markdown structure and reporting validation warnings.

**Architecture:** The implementation is split into small modules: config resolution, provider client, Markdown parse/chunk/validate helpers, translation orchestration, CLI, and a TwoRiver adapter. Markdown is parsed with `gray-matter`, `unified`, `remark-parse`, and `remark-stringify`; translation happens per AST-derived chunk through an injectable provider.

**Tech Stack:** Node.js 20+, TypeScript, pnpm, Vitest, tsup, commander, gray-matter, unified, remark-parse, remark-stringify, remark-gfm, mdast types, yaml.

---

## File Map

- Create: `package.json` - npm metadata, scripts, dependencies, CLI bin, exports.
- Create: `tsconfig.json` - TypeScript compiler settings.
- Create: `tsup.config.ts` - ESM/CJS/library and CLI build.
- Create: `vitest.config.ts` - Vitest config.
- Create: `.prettierrc` - formatting config.
- Create: `.gitignore` - ignores build output, dependencies, env files.
- Create: `.env.example` - safe provider environment examples.
- Create: `LICENSE` - MIT license.
- Create: `.github/workflows/ci.yml` - install, typecheck, test, build.
- Create: `src/errors.ts` - stable error codes and safe error serialization.
- Create: `src/types.ts` - public option/result/config types.
- Create: `src/provider/types.ts` - provider request/response interfaces.
- Create: `src/provider/openaiCompatibleClient.ts` - fetch-based Chat Completions client.
- Create: `src/config/env.ts` - environment provider config resolution.
- Create: `src/config/loadConfig.ts` - YAML/JSON config and glossary file loading.
- Create: `src/markdown/parse.ts` - frontmatter and Markdown parse/stringify helpers.
- Create: `src/markdown/chunk.ts` - AST-derived chunk generation.
- Create: `src/markdown/cleanModelOutput.ts` - model wrapper cleanup.
- Create: `src/markdown/validate.ts` - structure signatures and warnings.
- Create: `src/translate/glossary.ts` - glossary parsing and prompt rendering.
- Create: `src/translate/prompts.ts` - system and chunk prompts.
- Create: `src/translate/translateMarkdown.ts` - main translation orchestration.
- Create: `src/adapters/tworiver.ts` - TwoRiver-compatible helper.
- Create: `src/cli.ts` - commander CLI.
- Create: `src/index.ts` - public exports.
- Create: `tests/*.test.ts` - focused Vitest coverage.
- Create: `examples/basic/*` and `examples/tworiver/*` - usage examples.
- Create: `README.md` - CLI, library, config, glossary, security, examples.

---

### Task 1: Project Scaffold

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `.prettierrc`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `LICENSE`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Add package metadata and scripts**

Create `package.json` with:

```json
{
  "name": "md-bilingual-translator",
  "version": "0.1.0",
  "description": "CLI and TypeScript library for translating technical Markdown with OpenAI-compatible LLM APIs while preserving structure.",
  "type": "module",
  "bin": {
    "md-translator": "./dist/cli.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md", "LICENSE", ".env.example", "examples"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "dependencies": {
    "commander": "^12.1.0",
    "gray-matter": "^4.0.3",
    "remark-gfm": "^4.0.0",
    "remark-parse": "^11.0.0",
    "remark-stringify": "^11.0.0",
    "unified": "^11.0.5",
    "yaml": "^2.5.0"
  },
  "devDependencies": {
    "@types/mdast": "^4.0.4",
    "@types/node": "^22.10.0",
    "prettier": "^3.4.2",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  },
  "engines": {
    "node": ">=20"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Add TypeScript, build, and test config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "dist"
  },
  "include": ["src", "tests", "vitest.config.ts", "tsup.config.ts"]
}
```

Create `tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "node20",
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    dts: false,
    sourcemap: true,
    clean: false,
    target: "node20",
    banner: { js: "#!/usr/bin/env node" },
  },
]);
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add repository hygiene files**

Create `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": false,
  "printWidth": 100
}
```

Create `.gitignore`:

```gitignore
node_modules
dist
.env
.env.*
!.env.example
coverage
.DS_Store
*.tsbuildinfo
```

Create `.env.example`:

```bash
LLM_API_KEY=
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=
```

Create `LICENSE` with the standard MIT License text.

- [ ] **Step 4: Add CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 5: Run scaffold verification**

Run: `pnpm install`

Expected: dependencies install and `pnpm-lock.yaml` is created.

Run: `pnpm typecheck`

Expected: FAIL with missing `src/index.ts` or missing source-file errors. This confirms the scaffold command is wired; Task 2 starts adding source files.

- [ ] **Step 6: Commit scaffold**

Run:

```bash
git add package.json pnpm-lock.yaml tsconfig.json tsup.config.ts vitest.config.ts .prettierrc .gitignore .env.example LICENSE .github/workflows/ci.yml
git commit -m "chore: scaffold markdown translator package"
```

---

### Task 2: Core Types and Errors

**Files:**

- Create: `src/errors.ts`
- Create: `src/types.ts`
- Test: `tests/errors.test.ts`

- [ ] **Step 1: Write failing tests for typed errors**

Create `tests/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TranslatorError, serializeError } from "../src/errors.js";

describe("TranslatorError", () => {
  it("serializes stable error codes without leaking metadata", () => {
    const error = new TranslatorError("missing_api_key", "Missing API key", {
      authorization: "Bearer secret-token",
      safe: "visible",
    });

    expect(serializeError(error)).toEqual({
      code: "missing_api_key",
      message: "Missing API key",
      details: { safe: "visible" },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/errors.test.ts`

Expected: FAIL because `src/errors.ts` does not exist.

- [ ] **Step 3: Implement error and public types**

Create `src/errors.ts`:

```ts
export type TranslatorErrorCode =
  | "missing_api_key"
  | "invalid_base_url"
  | "input_file_not_found"
  | "output_file_exists"
  | "markdown_parse_failed"
  | "provider_request_failed"
  | "provider_response_malformed"
  | "validation_failed"
  | "unsupported_locale"
  | "config_file_invalid";

const SECRET_KEYS = new Set(["apiKey", "authorization", "Authorization", "headers"]);

export class TranslatorError extends Error {
  readonly code: TranslatorErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: TranslatorErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "TranslatorError";
    this.code = code;
    this.details = details;
  }
}

export function sanitizeDetails(
  details?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (!SECRET_KEYS.has(key)) sanitized[key] = value;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function serializeError(error: unknown): {
  code: TranslatorErrorCode | "unknown_error";
  message: string;
  details?: Record<string, unknown>;
} {
  if (error instanceof TranslatorError) {
    return {
      code: error.code,
      message: error.message,
      details: sanitizeDetails(error.details),
    };
  }

  return {
    code: "unknown_error",
    message: error instanceof Error ? error.message : String(error),
  };
}
```

Create `src/types.ts`:

```ts
import type { LlmProvider } from "./provider/types.js";

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

export interface TranslateMarkdownOptions {
  markdown: string;
  sourceLocale?: Locale;
  targetLocale: Locale;
  provider?: ProviderConfig;
  providerClient?: LlmProvider;
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
```

- [ ] **Step 4: Run test and typecheck**

Run: `pnpm test tests/errors.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: fail until `src/provider/types.ts` exists; this is resolved in Task 3.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/errors.ts src/types.ts tests/errors.test.ts
git commit -m "feat: add core translator types and errors"
```

---

### Task 3: Provider Client

**Files:**

- Create: `src/provider/types.ts`
- Create: `src/provider/openaiCompatibleClient.ts`
- Test: `tests/provider.test.ts`

- [ ] **Step 1: Write failing provider tests**

Create `tests/provider.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { OpenAICompatibleClient } from "../src/provider/openaiCompatibleClient.js";
import { TranslatorError } from "../src/errors.js";

describe("OpenAICompatibleClient", () => {
  it("calls chat completions and returns text plus usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Translated markdown" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });

    const client = new OpenAICompatibleClient({
      apiKey: "secret",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      fetchImpl: fetchMock,
    });

    const result = await client.complete({
      messages: [{ role: "user", content: "Translate this" }],
      temperature: 0.2,
    });

    expect(result.content).toBe("Translated markdown");
    expect(result.usage?.totalTokens).toBe(15);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      }),
    );
  });

  it("throws a typed error when the provider response is malformed", async () => {
    const client = new OpenAICompatibleClient({
      apiKey: "secret",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }),
    });

    await expect(client.complete({ messages: [] })).rejects.toMatchObject({
      code: "provider_response_malformed",
    } satisfies Partial<TranslatorError>);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/provider.test.ts`

Expected: FAIL because provider files do not exist.

- [ ] **Step 3: Implement provider interfaces**

Create `src/provider/types.ts`:

```ts
import type { TokenUsage } from "../types.js";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
}

export interface CompletionResponse {
  content: string;
  usage?: TokenUsage;
}

export interface LlmProvider {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}
```

- [ ] **Step 4: Implement fetch provider**

Create `src/provider/openaiCompatibleClient.ts`:

```ts
import { TranslatorError } from "../errors.js";
import type { CompletionRequest, CompletionResponse, LlmProvider } from "./types.js";

interface OpenAICompatibleClientOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

interface ChatCompletionsResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class OpenAICompatibleClient implements LlmProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatibleClientOptions) {
    if (!options.apiKey) {
      throw new TranslatorError("missing_api_key", "Missing API key for LLM provider.");
    }

    try {
      this.baseUrl = new URL(options.baseUrl ?? "https://api.deepseek.com")
        .toString()
        .replace(/\/$/, "");
    } catch {
      throw new TranslatorError("invalid_base_url", "Invalid LLM provider base URL.", {
        baseUrl: options.baseUrl,
      });
    }

    this.apiKey = options.apiKey;
    this.model = options.model ?? "deepseek-chat";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
      }),
    });

    if (!response.ok) {
      throw new TranslatorError("provider_request_failed", "Provider request failed.", {
        status: response.status,
        statusText: response.statusText,
      });
    }

    const data = (await response.json()) as ChatCompletionsResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new TranslatorError(
        "provider_response_malformed",
        "Provider response did not include message content.",
      );
    }

    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm test tests/provider.test.ts tests/errors.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS for all files created through Task 3.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/provider src/types.ts tests/provider.test.ts
git commit -m "feat: add openai compatible provider client"
```

---

### Task 4: Config and Glossary Loading

**Files:**

- Create: `src/config/env.ts`
- Create: `src/config/loadConfig.ts`
- Create: `src/translate/glossary.ts`
- Test: `tests/config.test.ts`
- Test: `tests/glossary.test.ts`

- [ ] **Step 1: Write failing config priority test**

Create `tests/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveProviderConfig } from "../src/config/env.js";

describe("resolveProviderConfig", () => {
  it("uses CLI over config over LLM env over provider env over defaults", () => {
    const result = resolveProviderConfig({
      cli: { model: "cli-model" },
      config: { baseUrl: "https://config.example", model: "config-model" },
      env: {
        LLM_API_KEY: "llm-key",
        LLM_BASE_URL: "https://llm.example",
        LLM_MODEL: "llm-model",
        DEEPSEEK_API_KEY: "deepseek-key",
        DEEPSEEK_BASE_URL: "https://deepseek.example",
        DEEPSEEK_MODEL: "deepseek-model",
      },
    });

    expect(result).toEqual({
      apiKey: "llm-key",
      baseUrl: "https://config.example",
      model: "cli-model",
    });
  });
});
```

- [ ] **Step 2: Write failing glossary test**

Create `tests/glossary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderGlossaryForPrompt } from "../src/translate/glossary.js";

describe("renderGlossaryForPrompt", () => {
  it("renders terms with optional notes", () => {
    expect(
      renderGlossaryForPrompt([
        { source: "TwoRiver", target: "TwoRiver", note: "Project name, never translate." },
        { source: "发布控制台", target: "publishing console" },
      ]),
    ).toContain("TwoRiver => TwoRiver (Project name, never translate.)");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test tests/config.test.ts tests/glossary.test.ts`

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement config resolution**

Create `src/config/env.ts`:

```ts
import type { ProviderConfig } from "../types.js";

export interface ResolveProviderConfigInput {
  cli?: ProviderConfig;
  config?: ProviderConfig;
  env?: NodeJS.ProcessEnv;
}

export function resolveProviderConfig(input: ResolveProviderConfigInput = {}): ProviderConfig {
  const env = input.env ?? process.env;
  const providerEnv: ProviderConfig = {
    apiKey: env.DEEPSEEK_API_KEY ?? env.OPENAI_API_KEY,
    baseUrl: env.DEEPSEEK_BASE_URL ?? env.OPENAI_BASE_URL,
    model: env.DEEPSEEK_MODEL ?? env.OPENAI_MODEL,
  };
  const llmEnv: ProviderConfig = {
    apiKey: env.LLM_API_KEY,
    baseUrl: env.LLM_BASE_URL,
    model: env.LLM_MODEL,
  };
  const defaults: ProviderConfig = {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  };

  return compactProviderConfig({
    ...defaults,
    ...providerEnv,
    ...llmEnv,
    ...input.config,
    ...input.cli,
  });
}

function compactProviderConfig(config: ProviderConfig): ProviderConfig {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined && value !== ""),
  ) as ProviderConfig;
}
```

- [ ] **Step 5: Implement config and glossary file loading**

Create `src/config/loadConfig.ts`:

```ts
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import YAML from "yaml";
import { TranslatorError } from "../errors.js";

export interface TranslatorConfigFile {
  provider?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  translation?: {
    sourceLocale?: string;
    targetLocale?: string;
    temperature?: number;
    maxChunkChars?: number;
    concurrency?: number;
  };
  quality?: {
    validateStructure?: boolean;
    retryOnValidationFailure?: boolean;
    maxRetries?: number;
  };
}

export async function loadConfigFile(path?: string): Promise<TranslatorConfigFile> {
  if (!path) return {};
  try {
    const raw = await readFile(path, "utf8");
    return parseStructuredFile<TranslatorConfigFile>(raw, path);
  } catch (error) {
    throw new TranslatorError("config_file_invalid", `Could not load config file: ${path}`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export function parseStructuredFile<T>(raw: string, path = "inline.yml"): T {
  const ext = extname(path).toLowerCase();
  if (ext === ".json") return JSON.parse(raw) as T;
  return YAML.parse(raw) as T;
}
```

Create `src/translate/glossary.ts`:

```ts
import { readFile } from "node:fs/promises";
import { parseStructuredFile } from "../config/loadConfig.js";
import type { GlossaryTerm } from "../types.js";

interface GlossaryFile {
  terms?: GlossaryTerm[];
}

export async function loadGlossaryFile(path?: string): Promise<GlossaryTerm[]> {
  if (!path) return [];
  const raw = await readFile(path, "utf8");
  const parsed = parseStructuredFile<GlossaryFile>(raw, path);
  return parsed.terms ?? [];
}

export function renderGlossaryForPrompt(terms: GlossaryTerm[] = []): string {
  if (terms.length === 0) return "No glossary entries.";
  return terms
    .map((term) => {
      const note = term.note ? ` (${term.note})` : "";
      return `- ${term.source} => ${term.target}${note}`;
    })
    .join("\n");
}
```

- [ ] **Step 6: Run tests**

Run: `pnpm test tests/config.test.ts tests/glossary.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/config src/translate/glossary.ts tests/config.test.ts tests/glossary.test.ts
git commit -m "feat: add config and glossary loading"
```

---

### Task 5: Markdown Parse, Clean, and Validation

**Files:**

- Create: `src/markdown/parse.ts`
- Create: `src/markdown/cleanModelOutput.ts`
- Create: `src/markdown/validate.ts`
- Test: `tests/markdown-validate.test.ts`
- Test: `tests/clean-output.test.ts`

- [ ] **Step 1: Write failing clean output test**

Create `tests/clean-output.test.ts`:

````ts
import { describe, expect, it } from "vitest";
import { cleanModelOutput } from "../src/markdown/cleanModelOutput.js";

describe("cleanModelOutput", () => {
  it("removes common markdown wrappers", () => {
    const output = cleanModelOutput(
      "Here is the translation:\n\n```markdown\n# Title\n\nBody\n```",
    );
    expect(output).toBe("# Title\n\nBody");
  });
});
````

- [ ] **Step 2: Write failing validation tests**

Create `tests/markdown-validate.test.ts`:

````ts
import { describe, expect, it } from "vitest";
import { createStructureSignature, validateMarkdownStructure } from "../src/markdown/validate.js";

describe("markdown validation", () => {
  it("detects heading count mismatch", () => {
    const source = "# A\n\n## B\n\nText";
    const translated = "# A\n\nText";
    const warnings = validateMarkdownStructure(source, translated);
    expect(warnings).toContain("Heading count changed: expected 2, received 1.");
  });

  it("preserves code block count and language", () => {
    const signature = createStructureSignature("```ts\nconst a = 1;\n```");
    expect(signature.codeBlocks).toEqual([{ lang: "ts" }]);
  });
});
````

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test tests/clean-output.test.ts tests/markdown-validate.test.ts`

Expected: FAIL because markdown modules do not exist.

- [ ] **Step 4: Implement parse and clean helpers**

Create `src/markdown/parse.ts`:

```ts
import matter from "gray-matter";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { TranslatorError } from "../errors.js";

export function parseFrontmatter(markdown: string) {
  try {
    return matter(markdown);
  } catch (error) {
    throw new TranslatorError(
      "markdown_parse_failed",
      "Markdown frontmatter could not be parsed.",
      {
        cause: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

export function markdownProcessor() {
  return unified().use(remarkParse).use(remarkGfm).use(remarkStringify, {
    fences: true,
    bullet: "-",
    listItemIndent: "one",
  });
}

export function parseMarkdownAst(markdown: string) {
  try {
    return markdownProcessor().parse(markdown);
  } catch (error) {
    throw new TranslatorError("markdown_parse_failed", "Markdown could not be parsed.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export function stringifyMarkdownAst(tree: unknown): string {
  return String(markdownProcessor().stringify(tree));
}
```

Create `src/markdown/cleanModelOutput.ts`:

````ts
export function cleanModelOutput(output: string): string {
  let cleaned = output.trim();
  cleaned = cleaned.replace(/^Here is the translation:\s*/i, "").trim();
  const fenced = cleaned.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) cleaned = fenced[1].trim();
  return cleaned;
}
````

- [ ] **Step 5: Implement structure validation**

Create `src/markdown/validate.ts`:

```ts
import { parseFrontmatter, parseMarkdownAst } from "./parse.js";

interface MarkdownNode {
  type?: string;
  depth?: number;
  lang?: string;
  url?: string;
  children?: MarkdownNode[];
}

export interface StructureSignature {
  headings: number[];
  codeBlocks: Array<{ lang?: string }>;
  links: string[];
  images: string[];
}

export function createStructureSignature(markdown: string): StructureSignature {
  const file = parseFrontmatter(markdown);
  const tree = parseMarkdownAst(file.content) as MarkdownNode;
  const signature: StructureSignature = {
    headings: [],
    codeBlocks: [],
    links: [],
    images: [],
  };

  visit(tree, (node) => {
    if (node.type === "heading" && typeof node.depth === "number") {
      signature.headings.push(node.depth);
    }
    if (node.type === "code") {
      signature.codeBlocks.push({ lang: node.lang });
    }
    if (node.type === "link" && node.url) {
      signature.links.push(node.url);
    }
    if (node.type === "image" && node.url) {
      signature.images.push(node.url);
    }
  });

  return signature;
}

export function validateMarkdownStructure(source: string, translated: string): string[] {
  const warnings: string[] = [];
  let sourceSignature: StructureSignature;
  let translatedSignature: StructureSignature;

  try {
    sourceSignature = createStructureSignature(source);
    translatedSignature = createStructureSignature(translated);
  } catch (error) {
    return [
      `Markdown parse failed during validation: ${error instanceof Error ? error.message : String(error)}.`,
    ];
  }

  compareCount(
    warnings,
    "Heading",
    sourceSignature.headings.length,
    translatedSignature.headings.length,
  );
  compareCount(
    warnings,
    "Code block",
    sourceSignature.codeBlocks.length,
    translatedSignature.codeBlocks.length,
  );
  compareCount(warnings, "Link", sourceSignature.links.length, translatedSignature.links.length);
  compareCount(warnings, "Image", sourceSignature.images.length, translatedSignature.images.length);

  sourceSignature.codeBlocks.forEach((block, index) => {
    const translatedBlock = translatedSignature.codeBlocks[index];
    if (translatedBlock && block.lang !== translatedBlock.lang) {
      warnings.push(
        `Code block language changed at index ${index}: expected ${block.lang ?? ""}, received ${translatedBlock.lang ?? ""}.`,
      );
    }
  });

  return warnings;
}

function compareCount(warnings: string[], label: string, expected: number, received: number): void {
  if (expected !== received) {
    warnings.push(`${label} count changed: expected ${expected}, received ${received}.`);
  }
}

function visit(node: MarkdownNode, callback: (node: MarkdownNode) => void): void {
  callback(node);
  for (const child of node.children ?? []) {
    visit(child, callback);
  }
}
```

- [ ] **Step 6: Run tests**

Run: `pnpm test tests/clean-output.test.ts tests/markdown-validate.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/markdown tests/clean-output.test.ts tests/markdown-validate.test.ts
git commit -m "feat: add markdown parsing and structure validation"
```

---

### Task 6: AST-Based Chunking

**Files:**

- Create: `src/markdown/chunk.ts`
- Test: `tests/chunk.test.ts`

- [ ] **Step 1: Write failing chunk tests**

Create `tests/chunk.test.ts`:

````ts
import { describe, expect, it } from "vitest";
import { chunkMarkdown } from "../src/markdown/chunk.js";

describe("chunkMarkdown", () => {
  it("keeps fenced code blocks inside a single chunk", () => {
    const chunks = chunkMarkdown("# A\n\nText\n\n```ts\nconst a = 1;\n```\n\n## B\n\nMore", {
      maxChars: 30,
    });

    expect(chunks.some((chunk) => chunk.markdown.includes("```ts\nconst a = 1;\n```"))).toBe(true);
  });

  it("tracks heading path for prompts", () => {
    const chunks = chunkMarkdown("# Article\n\n## Section\n\nParagraph", { maxChars: 200 });
    expect(chunks.at(-1)?.headingPath).toEqual(["Article", "Section"]);
  });
});
````

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/chunk.test.ts`

Expected: FAIL because `src/markdown/chunk.ts` does not exist.

- [ ] **Step 3: Implement chunking**

Create `src/markdown/chunk.ts`:

```ts
import type { Root, RootContent } from "mdast";
import { parseMarkdownAst, stringifyMarkdownAst } from "./parse.js";

export interface MarkdownChunk {
  index: number;
  markdown: string;
  headingPath: string[];
}

interface ChunkOptions {
  maxChars?: number;
}

interface HeadingState {
  path: string[];
}

export function chunkMarkdown(markdown: string, options: ChunkOptions = {}): MarkdownChunk[] {
  const maxChars = options.maxChars ?? 6000;
  const tree = parseMarkdownAst(markdown) as Root;
  const chunks: MarkdownChunk[] = [];
  let buffer: RootContent[] = [];
  let bufferHeadingPath: string[] = [];
  const headingState: HeadingState = { path: [] };

  for (const node of tree.children) {
    if (node.type === "heading") {
      updateHeadingPath(headingState, node);
    }

    const nodeMarkdown = stringifyNodes([node]);
    const bufferMarkdown = stringifyNodes(buffer);
    if (buffer.length > 0 && bufferMarkdown.length + nodeMarkdown.length > maxChars) {
      chunks.push({
        index: chunks.length,
        markdown: bufferMarkdown.trimEnd(),
        headingPath: bufferHeadingPath,
      });
      buffer = [];
    }

    if (buffer.length === 0) {
      bufferHeadingPath = [...headingState.path];
    }
    buffer.push(node);
  }

  if (buffer.length > 0) {
    chunks.push({
      index: chunks.length,
      markdown: stringifyNodes(buffer).trimEnd(),
      headingPath: bufferHeadingPath,
    });
  }

  return chunks.length > 0 ? chunks : [{ index: 0, markdown: "", headingPath: [] }];
}

function stringifyNodes(children: RootContent[]): string {
  if (children.length === 0) return "";
  return stringifyMarkdownAst({ type: "root", children }).trimEnd() + "\n";
}

function updateHeadingPath(state: HeadingState, node: RootContent): void {
  if (node.type !== "heading") return;
  const text = extractText(node);
  const depth = node.depth;
  state.path = [...state.path.slice(0, depth - 1), text];
}

function extractText(node: RootContent): string {
  if (!("children" in node) || !Array.isArray(node.children)) return "";
  return node.children
    .map((child) => ("value" in child && typeof child.value === "string" ? child.value : ""))
    .join("");
}
```

- [ ] **Step 4: Run test**

Run: `pnpm test tests/chunk.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/markdown/chunk.ts tests/chunk.test.ts
git commit -m "feat: add ast based markdown chunking"
```

---

### Task 7: Translation Orchestration

**Files:**

- Create: `src/translate/prompts.ts`
- Create: `src/translate/translateMarkdown.ts`
- Create: `src/index.ts`
- Test: `tests/translate-markdown.test.ts`

- [ ] **Step 1: Write failing translation tests with mock provider**

Create `tests/translate-markdown.test.ts`:

````ts
import { describe, expect, it } from "vitest";
import { translateMarkdown } from "../src/index.js";
import type { LlmProvider } from "../src/provider/types.js";

describe("translateMarkdown", () => {
  it("translates chunks with a mock provider and preserves metadata", async () => {
    const providerClient: LlmProvider = {
      async complete() {
        return {
          content: "# Translated\n\nUse `pnpm test`.\n\n```ts\nconst ok = true;\n```",
          usage: { totalTokens: 12 },
        };
      },
    };

    const result = await translateMarkdown({
      markdown: "# 原文\n\n使用 `pnpm test`。\n\n```ts\nconst ok = true;\n```",
      sourceLocale: "zh",
      targetLocale: "en",
      providerClient,
    });

    expect(result.markdown).toContain("# Translated");
    expect(result.chunks[0]?.warnings).toEqual([]);
    expect(result.usage?.totalTokens).toBe(12);
  });

  it("returns warnings when validation fails after retry", async () => {
    const providerClient: LlmProvider = {
      async complete() {
        return { content: "# Only one heading\n\nText" };
      },
    };

    const result = await translateMarkdown({
      markdown: "# A\n\n## B\n\nText",
      targetLocale: "en",
      providerClient,
      maxRetries: 0,
    });

    expect(result.warnings).toContain("Heading count changed: expected 2, received 1.");
  });
});
````

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/translate-markdown.test.ts`

Expected: FAIL because translation modules do not exist.

- [ ] **Step 3: Implement prompts**

Create `src/translate/prompts.ts`:

```ts
import type { GlossaryTerm, Locale } from "../types.js";
import { renderGlossaryForPrompt } from "./glossary.js";

export function buildSystemPrompt(): string {
  return [
    "You are a professional technical Markdown translator.",
    "Translate the article content without summarizing, expanding, deleting, or explaining it.",
    "Preserve Markdown structure, heading hierarchy, code blocks, inline code, links, image URLs, HTML tags, commands, paths, variables, package names, and API names.",
    "Only output the translated Markdown fragment.",
    "Follow the glossary exactly. If a technical term is uncertain, keep the original term.",
  ].join("\n");
}

export function buildChunkPrompt(input: {
  markdown: string;
  sourceLocale?: Locale;
  targetLocale: Locale;
  headingPath?: string[];
  glossary?: GlossaryTerm[];
  styleGuide?: string;
}): string {
  return [
    `Source locale: ${input.sourceLocale ?? "auto-detect"}`,
    `Target locale: ${input.targetLocale}`,
    `Current heading path: ${input.headingPath?.join(" > ") || "(root)"}`,
    "",
    "Glossary:",
    renderGlossaryForPrompt(input.glossary),
    "",
    "Style guide:",
    input.styleGuide?.trim() || "Use a clear, natural technical blog style.",
    "",
    "Markdown fragment:",
    input.markdown,
  ].join("\n");
}
```

- [ ] **Step 4: Implement translation orchestration and exports**

Create `src/translate/translateMarkdown.ts`:

```ts
import { OpenAICompatibleClient } from "../provider/openaiCompatibleClient.js";
import type { LlmProvider } from "../provider/types.js";
import type { TranslateMarkdownOptions, TranslateMarkdownResult, TokenUsage } from "../types.js";
import { chunkMarkdown } from "../markdown/chunk.js";
import { cleanModelOutput } from "../markdown/cleanModelOutput.js";
import { validateMarkdownStructure } from "../markdown/validate.js";
import { buildChunkPrompt, buildSystemPrompt } from "./prompts.js";

export function createTranslator(
  defaults: Omit<TranslateMarkdownOptions, "markdown" | "targetLocale">,
) {
  return {
    translateMarkdown(
      options: Pick<TranslateMarkdownOptions, "markdown" | "targetLocale"> &
        Partial<TranslateMarkdownOptions>,
    ) {
      return translateMarkdown({ ...defaults, ...options });
    },
  };
}

export async function translateMarkdown(
  options: TranslateMarkdownOptions,
): Promise<TranslateMarkdownResult> {
  const providerClient = getProviderClient(options);
  const chunks = chunkMarkdown(options.markdown, { maxChars: options.maxChunkChars });
  const translatedChunks: string[] = [];
  const chunkResults: TranslateMarkdownResult["chunks"] = [];
  const warnings: string[] = [];
  const usage: TokenUsage = {};

  for (const chunk of chunks) {
    const translated = await translateChunkWithRetry(providerClient, chunk.markdown, {
      ...options,
      headingPath: chunk.headingPath,
    });

    translatedChunks.push(translated.markdown);
    chunkResults.push({
      index: chunk.index,
      inputChars: chunk.markdown.length,
      outputChars: translated.markdown.length,
      warnings: translated.warnings,
    });
    warnings.push(...translated.warnings);
    addUsage(usage, translated.usage);
  }

  return {
    markdown: translatedChunks.join("\n\n").trim(),
    sourceLocale: options.sourceLocale,
    targetLocale: options.targetLocale,
    chunks: chunkResults,
    warnings,
    usage: Object.keys(usage).length > 0 ? usage : undefined,
  };
}

async function translateChunkWithRetry(
  providerClient: LlmProvider,
  markdown: string,
  options: TranslateMarkdownOptions & { headingPath?: string[] },
): Promise<{ markdown: string; warnings: string[]; usage?: TokenUsage }> {
  const maxRetries = options.maxRetries ?? (options.retryOnValidationFailure === false ? 0 : 1);
  let attempt = 0;
  let lastMarkdown = "";
  let lastWarnings: string[] = [];
  let lastUsage: TokenUsage | undefined;

  while (attempt <= maxRetries) {
    const response = await providerClient.complete({
      temperature: options.provider?.temperature ?? 0.2,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: buildChunkPrompt({
            markdown,
            sourceLocale: options.sourceLocale,
            targetLocale: options.targetLocale,
            headingPath: options.headingPath,
            glossary: options.glossary,
            styleGuide: options.styleGuide,
          }),
        },
      ],
    });

    lastMarkdown = cleanModelOutput(response.content);
    lastWarnings =
      options.validateStructure === false ? [] : validateMarkdownStructure(markdown, lastMarkdown);
    lastUsage = response.usage;
    if (lastWarnings.length === 0) break;
    attempt += 1;
  }

  return { markdown: lastMarkdown, warnings: lastWarnings, usage: lastUsage };
}

function getProviderClient(options: TranslateMarkdownOptions): LlmProvider {
  if (options.providerClient) return options.providerClient;
  return new OpenAICompatibleClient(options.provider ?? {});
}

function addUsage(target: TokenUsage, source?: TokenUsage): void {
  if (!source) return;
  target.promptTokens = addOptional(target.promptTokens, source.promptTokens);
  target.completionTokens = addOptional(target.completionTokens, source.completionTokens);
  target.totalTokens = addOptional(target.totalTokens, source.totalTokens);
}

function addOptional(a?: number, b?: number): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  return (a ?? 0) + (b ?? 0);
}
```

Create `src/index.ts`:

```ts
export { TranslatorError, serializeError } from "./errors.js";
export type { TranslatorErrorCode } from "./errors.js";
export type {
  ChunkResult,
  GlossaryTerm,
  Locale,
  ProviderConfig,
  TokenUsage,
  TranslateMarkdownOptions,
  TranslateMarkdownResult,
} from "./types.js";
export { OpenAICompatibleClient } from "./provider/openaiCompatibleClient.js";
export type {
  LlmProvider,
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
} from "./provider/types.js";
export { createTranslator, translateMarkdown } from "./translate/translateMarkdown.js";
```

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/translate-markdown.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/translate src/index.ts tests/translate-markdown.test.ts
git commit -m "feat: add markdown translation orchestration"
```

---

### Task 8: TwoRiver Adapter

**Files:**

- Create: `src/adapters/tworiver.ts`
- Modify: `src/index.ts`
- Test: `tests/tworiver.test.ts`

- [ ] **Step 1: Write failing adapter test**

Create `tests/tworiver.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { translatePostTranslation } from "../src/adapters/tworiver.js";
import type { LlmProvider } from "../src/provider/types.js";

describe("translatePostTranslation", () => {
  it("returns a target locale post translation shape", async () => {
    const providerClient: LlmProvider = {
      async complete(request) {
        const content = request.messages.at(-1)?.content ?? "";
        if (content.includes("标题")) return { content: "Title" };
        if (content.includes("摘要")) return { content: "Summary" };
        return { content: "# Body" };
      },
    };

    const result = await translatePostTranslation({
      source: {
        locale: "zh",
        title: "标题",
        summary: "摘要",
        contentMarkdown: "# 正文",
        seoTitle: null,
        seoDescription: null,
      },
      targetLocale: "en",
      providerClient,
    });

    expect(result).toEqual({
      locale: "en",
      title: "Title",
      summary: "Summary",
      contentMarkdown: "# Body",
      seoTitle: null,
      seoDescription: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/tworiver.test.ts`

Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement adapter**

Create `src/adapters/tworiver.ts`:

```ts
import type { LlmProvider } from "../provider/types.js";
import type { Locale, ProviderConfig } from "../types.js";
import { translateMarkdown } from "../translate/translateMarkdown.js";

export interface TwoRiverPostTranslation {
  locale: Locale;
  title: string;
  summary: string;
  contentMarkdown: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface TranslatePostTranslationOptions {
  source: TwoRiverPostTranslation;
  targetLocale: Locale;
  provider?: ProviderConfig;
  providerClient?: LlmProvider;
}

export async function translatePostTranslation(
  options: TranslatePostTranslationOptions,
): Promise<TwoRiverPostTranslation> {
  const common = {
    sourceLocale: options.source.locale,
    targetLocale: options.targetLocale,
    provider: options.provider,
    providerClient: options.providerClient,
    validateStructure: false,
  };

  const [title, summary, content] = await Promise.all([
    translateMarkdown({ ...common, markdown: options.source.title }),
    translateMarkdown({ ...common, markdown: options.source.summary }),
    translateMarkdown({
      ...common,
      markdown: options.source.contentMarkdown,
      validateStructure: true,
    }),
  ]);

  return {
    locale: options.targetLocale,
    title: title.markdown,
    summary: summary.markdown,
    contentMarkdown: content.markdown,
    seoTitle: options.source.seoTitle ? title.markdown : null,
    seoDescription: options.source.seoDescription ? summary.markdown : null,
  };
}
```

Modify `src/index.ts` to add:

```ts
export { translatePostTranslation } from "./adapters/tworiver.js";
export type {
  TranslatePostTranslationOptions,
  TwoRiverPostTranslation,
} from "./adapters/tworiver.js";
```

- [ ] **Step 4: Run test**

Run: `pnpm test tests/tworiver.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/adapters/tworiver.ts src/index.ts tests/tworiver.test.ts
git commit -m "feat: add tworiver translation adapter"
```

---

### Task 9: CLI

**Files:**

- Create: `src/cli.ts`
- Test: `tests/cli.test.ts`

- [ ] **Step 1: Write failing CLI parser tests**

Create `tests/cli.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCliProgram } from "../src/cli.js";

describe("CLI", () => {
  it("parses translate options", () => {
    const program = buildCliProgram();
    program.exitOverride();
    program.parse(
      ["md-translator", "translate", "input.md", "--from", "zh", "--to", "en", "--json"],
      {
        from: "user",
      },
    );

    const command = program.commands.find((item) => item.name() === "translate");
    expect(command?.opts()).toMatchObject({ from: "zh", to: "en", json: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/cli.test.ts`

Expected: FAIL because `src/cli.ts` does not exist.

- [ ] **Step 3: Implement CLI program**

Create `src/cli.ts`:

```ts
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { Command } from "commander";
import { TranslatorError, serializeError } from "./errors.js";
import { resolveProviderConfig } from "./config/env.js";
import { loadConfigFile } from "./config/loadConfig.js";
import { loadGlossaryFile } from "./translate/glossary.js";
import { createStructureSignature } from "./markdown/validate.js";
import { translateMarkdown } from "./translate/translateMarkdown.js";

export function buildCliProgram(): Command {
  const program = new Command();
  program
    .name("md-translator")
    .description("Translate technical Markdown with an OpenAI-compatible LLM API.");

  program
    .command("translate")
    .argument("<input>", "Input Markdown file")
    .option("--from <locale>", "Source locale")
    .requiredOption("--to <locale>", "Target locale")
    .option("--out <file>", "Output file")
    .option("--model <model>", "Provider model")
    .option("--base-url <url>", "Provider base URL")
    .option("--api-key <key>", "Provider API key")
    .option("--config <file>", "Config file")
    .option("--glossary <file>", "Glossary YAML or JSON file")
    .option("--style <file>", "Style guide file")
    .option("--dry-run", "Print the execution plan without calling the provider")
    .option("--check", "Check Markdown structure without calling the provider")
    .option("--force", "Overwrite existing output file")
    .option("--concurrency <number>", "Chunk concurrency", Number.parseInt)
    .option("--max-chars <number>", "Maximum characters per chunk", Number.parseInt)
    .option("--json", "Print JSON output")
    .option("--verbose", "Print verbose logs")
    .action(runTranslateCommand);

  program
    .command("init")
    .description("Print an example config file")
    .action(() => {
      process.stdout.write(
        [
          "provider:",
          "  baseUrl: https://api.deepseek.com",
          "  model: deepseek-chat",
          "translation:",
          "  defaultSourceLocale: zh",
          "  defaultTargetLocale: en",
          "  temperature: 0.2",
          "  maxChunkChars: 6000",
          "  concurrency: 1",
        ].join("\n") + "\n",
      );
    });

  return program;
}

async function runTranslateCommand(input: string, options: Record<string, unknown>) {
  try {
    if (!existsSync(input)) {
      throw new TranslatorError("input_file_not_found", `Input file not found: ${input}`);
    }

    const markdown = await readFile(input, "utf8");
    if (options.check) {
      const signature = createStructureSignature(markdown);
      writeOutput(options, { ok: true, signature }, JSON.stringify(signature, null, 2));
      return;
    }

    if (options.dryRun) {
      writeOutput(
        options,
        { ok: true, input, targetLocale: options.to },
        `Would translate ${input} to ${options.to}\n`,
      );
      return;
    }

    if (options.out && existsSync(String(options.out)) && !options.force) {
      throw new TranslatorError("output_file_exists", `Output file already exists: ${options.out}`);
    }

    const config = await loadConfigFile(
      typeof options.config === "string" ? options.config : undefined,
    );
    const glossary = await loadGlossaryFile(
      typeof options.glossary === "string" ? options.glossary : undefined,
    );
    const styleGuide =
      typeof options.style === "string" ? await readFile(options.style, "utf8") : undefined;
    const provider = resolveProviderConfig({
      cli: {
        apiKey: typeof options.apiKey === "string" ? options.apiKey : undefined,
        baseUrl: typeof options.baseUrl === "string" ? options.baseUrl : undefined,
        model: typeof options.model === "string" ? options.model : undefined,
      },
      config: config.provider,
    });

    const result = await translateMarkdown({
      markdown,
      sourceLocale:
        typeof options.from === "string" ? options.from : config.translation?.sourceLocale,
      targetLocale: String(options.to ?? config.translation?.targetLocale),
      provider,
      glossary,
      styleGuide,
      maxChunkChars:
        typeof options.maxChars === "number" ? options.maxChars : config.translation?.maxChunkChars,
      concurrency:
        typeof options.concurrency === "number"
          ? options.concurrency
          : config.translation?.concurrency,
      retryOnValidationFailure: config.quality?.retryOnValidationFailure,
      maxRetries: config.quality?.maxRetries,
      validateStructure: config.quality?.validateStructure,
    });

    if (options.out) {
      await writeFile(String(options.out), result.markdown, "utf8");
    } else {
      writeOutput(options, result, result.markdown + "\n");
    }

    if (result.warnings.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    const serialized = serializeError(error);
    if (options.json) {
      process.stderr.write(JSON.stringify({ ok: false, error: serialized }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error [${serialized.code}]: ${serialized.message}\n`);
    }
    process.exitCode = 1;
  }
}

function writeOutput(
  options: Record<string, unknown>,
  jsonValue: unknown,
  textValue: string,
): void {
  if (options.json) {
    process.stdout.write(JSON.stringify(jsonValue, null, 2) + "\n");
  } else {
    process.stdout.write(textValue);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildCliProgram().parseAsync(process.argv);
}
```

- [ ] **Step 4: Run CLI test**

Run: `pnpm test tests/cli.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/cli.ts tests/cli.test.ts
git commit -m "feat: add markdown translator cli"
```

---

### Task 10: Documentation and Examples

**Files:**

- Create: `README.md`
- Create: `examples/basic/input.md`
- Create: `examples/basic/glossary.yml`
- Create: `examples/tworiver/usage.ts`

- [ ] **Step 1: Add basic example files**

Create `examples/basic/input.md`:

````md
---
title: 发布控制台设计
slug: publishing-console-design
tags:
  - Fastify
  - SQLite
---

# 发布控制台设计

使用 `pnpm test` 验证服务端逻辑。

```ts
const framework = "fastify";
```
````

Read the [Fastify docs](https://fastify.dev/).

````

Create `examples/basic/glossary.yml`:

```yaml
terms:
  - source: TwoRiver
    target: TwoRiver
    note: Project name, never translate.
  - source: Fastify
    target: Fastify
  - source: SQLite
    target: SQLite
  - source: 发布控制台
    target: publishing console
````

- [ ] **Step 2: Add TwoRiver example**

Create `examples/tworiver/usage.ts`:

```ts
import { translatePostTranslation } from "md-bilingual-translator";

const result = await translatePostTranslation({
  source: {
    locale: "zh",
    title: "发布控制台设计",
    summary: "如何设计一个轻量的发布控制台。",
    contentMarkdown: "# 发布控制台设计\n\n使用 `Fastify` 构建 API。",
    seoTitle: null,
    seoDescription: null,
  },
  targetLocale: "en",
  provider: {
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
  },
});

console.log(result);
```

- [ ] **Step 3: Add README**

Create `README.md` with sections:

````md
# md-bilingual-translator

`md-bilingual-translator` is a TypeScript library and `md-translator` CLI for translating Chinese/English technical Markdown through OpenAI-compatible chat completion APIs.

## Install

```bash
pnpm add md-bilingual-translator
```
````

## CLI

```bash
md-translator translate input.md --from zh --to en --out output.en.md
md-translator translate input.md --to en
md-translator translate input.md --to en --check
md-translator init
```

## Provider Configuration

The default provider is DeepSeek-compatible:

```bash
LLM_API_KEY=
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

Priority order:

1. CLI arguments
2. Config file
3. `LLM_*`
4. `DEEPSEEK_*` or `OPENAI_*`
5. Defaults

## Library Usage

```ts
import { translateMarkdown } from "md-bilingual-translator";

const result = await translateMarkdown({
  markdown,
  sourceLocale: "zh",
  targetLocale: "en",
  provider: {
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
  },
});
```

## Glossary

```yaml
terms:
  - source: TwoRiver
    target: TwoRiver
    note: Project name, never translate.
```

## TwoRiver Adapter

See `examples/tworiver/usage.ts`.

## Security

Do not commit API keys. The CLI and provider avoid printing API keys or full Authorization headers. Prefer environment variables over passing keys on the command line.

## Testing

Tests mock the provider and do not call external LLM APIs.

````

- [ ] **Step 4: Commit**

Run:

```bash
git add README.md examples
git commit -m "docs: add usage documentation and examples"
````

---

### Task 11: Final Verification and Polish

**Files:**

- Verify: `src/**/*.ts`
- Verify: `tests/**/*.test.ts`
- Verify: `README.md`
- Verify: `examples/**/*`

- [ ] **Step 1: Run all tests**

Run: `pnpm test`

Expected: PASS for all Vitest tests.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `pnpm build`

Expected: PASS and `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, and `dist/cli.js` exist.

- [ ] **Step 4: Run format check**

Run: `pnpm format:check`

Expected: PASS. If it fails, run `pnpm format`, inspect the diff, then rerun `pnpm format:check`.

- [ ] **Step 5: Run CLI smoke checks without external API**

Run: `node dist/cli.js init`

Expected: prints example YAML config.

Run: `node dist/cli.js translate examples/basic/input.md --to en --check --json`

Expected: prints a JSON structure signature and does not require an API key.

- [ ] **Step 6: Inspect git diff**

Run: `git status --short`

Expected: only intended files are modified.

Run: `git diff --stat`

Expected: changes match this plan.

- [ ] **Step 7: Final commit**

Run:

```bash
git add .
git commit -m "feat: implement markdown bilingual translator"
```

If earlier task commits were already made, skip the final commit or use it only for final polish files.

---

## Self-Review

- Spec coverage: The plan covers CLI, library API, OpenAI-compatible provider, config priority, Markdown AST parsing, chunking, validation, glossary, TwoRiver adapter, tests, README, MIT license, env example, and CI.
- Scope: The plan excludes CMS, database, web UI, live editor, publishing automation, and real external API calls in tests.
- Validation: The plan includes structure warnings, clean wrapper handling, provider error typing, and CLI non-zero behavior for warnings.
- Type consistency: `@types/mdast` is included in Task 1, and `Root` / `RootContent` imports in Task 6 use that package.
