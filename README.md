# md-bilingual-translator

`md-bilingual-translator` is a CLI and TypeScript library for translating technical Markdown with OpenAI-compatible LLM APIs while preserving document structure.

## Install

Requires Node.js 20 or newer.

```sh
pnpm add md-bilingual-translator
```

Run the CLI from a local project with `pnpm exec`:

```sh
pnpm exec md-translator --help
```

For a global command, install globally:

```sh
pnpm add -g md-bilingual-translator
md-translator --help
```

## CLI Usage

Translate a Markdown file and write the result to a chosen output path:

```sh
pnpm exec md-translator translate input.md --from zh --to en --out output.en.md
```

Translate to stdout:

```sh
pnpm exec md-translator translate input.md --to en
```

Check Markdown structure without calling a provider or requiring an API key:

```sh
pnpm exec md-translator translate input.md --check --json
```

Print an example YAML config:

```sh
pnpm exec md-translator init
```

`--to` is optional only when `translation.targetLocale` is set in a config file, or when using `--check`. Real translation and `--dry-run` both require a target locale from `--to` or config.

Common options:

```sh
pnpm exec md-translator translate examples/basic/input.md \
  --config examples/basic/config.yml \
  --glossary examples/basic/glossary.yml \
  --out output.en.md
```

Use `--force` to overwrite an existing output file. Without `--out`, translated Markdown is printed to stdout.

## Provider Configuration

The default provider settings are:

```sh
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

Set your API key with an environment variable:

```sh
LLM_API_KEY=your-key
```

Provider-specific aliases are also supported:

```sh
DEEPSEEK_API_KEY=your-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
```

If both provider-specific aliases are set for the same field, `DEEPSEEK_*` wins over `OPENAI_*`.

Configuration priority is:

1. CLI args: `--api-key`, `--base-url`, `--model`
2. Config file `provider` values
3. `LLM_*` environment variables
4. Provider-specific environment variables, with `DEEPSEEK_*` before `OPENAI_*`
5. Defaults

## Config File

YAML and JSON config files are supported. These are the supported keys:

```yml
provider:
  baseUrl: https://api.deepseek.com
  model: deepseek-chat
  temperature: 0.2
translation:
  sourceLocale: zh
  targetLocale: en
  maxChunkChars: 6000
  concurrency: 1
quality:
  retryOnValidationFailure: true
  maxRetries: 1
  validateStructure: true
```

The config parser reads literal strings and config values outrank environment variables. Prefer leaving `provider.apiKey` out of config files and setting `LLM_API_KEY`, `DEEPSEEK_API_KEY`, or `OPENAI_API_KEY` in your environment. Use `--api-key` only for temporary local commands.

## Library Usage

Use `translateMarkdown` for one-off calls:

```ts
import { translateMarkdown } from "md-bilingual-translator";

const result = await translateMarkdown({
  markdown: "# 发布控制台\n\nUse `pnpm build` before release.",
  sourceLocale: "zh",
  targetLocale: "en",
  provider: {
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
  },
  glossary: [{ source: "发布控制台", target: "publishing console" }],
});

console.log(result.markdown);
console.log(result.warnings);
```

Use `createTranslator` to share defaults:

```ts
import { createTranslator } from "md-bilingual-translator";

const translateToEnglish = createTranslator({
  targetLocale: "en",
  provider: {
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
  },
  validateStructure: true,
});

const result = await translateToEnglish({
  markdown: "## TwoRiver\n\nFastify serves the API.",
  sourceLocale: "zh",
});
```

## Glossary

Glossary files may be YAML or JSON. YAML format:

```yml
terms:
  - source: TwoRiver
    target: TwoRiver
    note: Product name; do not translate.
  - source: 发布控制台
    target: publishing console
```

Glossary values are inserted into translation prompts as caller-supplied data. For prompt safety, `source`, `target`, and `note` must be single-line values; multiline strings and control characters are rejected.

## Markdown Preservation and Validation

The translator parses Markdown, translates text chunks, and asks the provider to preserve Markdown structure. Validation checks frontmatter keys, heading structure, link and image URLs, inline code values, and fenced code block count/language. In v1, fenced code body text is not programmatically rewritten or protected beyond prompt instructions and validation metadata.

Validation warnings are returned in library results and surfaced by the CLI. If a translation completes with warnings, the CLI reports them and exits non-zero so automation can catch structure drift. `--json` returns machine-readable success, warning, and error payloads.

## TwoRiver Adapter

`translatePostTranslation` translates a TwoRiver post translation object:

```ts
import { translatePostTranslation } from "md-bilingual-translator";

const result = await translatePostTranslation({
  source: {
    locale: "zh",
    title: "发布控制台",
    summary: "面向编辑团队的发布流程。",
    contentMarkdown: "## TwoRiver\n\n使用 Fastify 和 SQLite。",
    seoTitle: "TwoRiver 发布控制台",
    seoDescription: null,
  },
  targetLocale: "en",
  provider: {
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
  },
});
```

Present SEO fields are translated independently. Missing or `null` SEO fields are not generated and are returned as `null`. Validation warning metadata is available on `result.warnings`; Markdown chunk metadata for the content body is available on `result.chunks`.

## Security Notes

Do not commit API keys. Prefer environment variables such as `LLM_API_KEY`, `DEEPSEEK_API_KEY`, or `OPENAI_API_KEY` over passing secrets with `--api-key`, because command-line arguments can be visible in shell history and process listings.

Errors and logs are designed to avoid leaking API keys and `Authorization` header values. The test suite uses mocks and local fixtures; it does not call external APIs.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## License

MIT
