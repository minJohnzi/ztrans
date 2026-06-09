# md-bilingual-translator Design

Date: 2026-06-09

## Goal

Build an open-source TypeScript and Node.js Markdown translation tool that can be used both as a CLI and as a library. The first version translates Chinese/English technical Markdown articles through an OpenAI-compatible provider, with DeepSeek-compatible defaults, while preserving Markdown structure, code, links, frontmatter, and technical terms as much as possible.

The package name is `md-bilingual-translator`. The CLI command is `md-translator`.

## Non-Goals

The first version will not include a CMS, database, web UI, live editor, publishing workflow, user system, or provider-specific SDK. It will not depend on the TwoRiver Blog codebase.

## Recommended Approach

Use AST-based Markdown chunking, model translation, and post-translation structure validation.

This balances reliability and implementation size:

- Markdown is parsed structurally instead of split by fragile regular expressions.
- Long documents are translated in safe chunks based on Markdown sections and top-level nodes.
- Code blocks, tables, links, images, and frontmatter are validated after translation.
- The provider layer stays generic for OpenAI-compatible APIs.

The first version will not perform full node-by-node AST rewriting. That remains a future improvement for highly complex Markdown.

## Architecture

### CLI Layer

`src/cli.ts` exposes:

- `md-translator translate <input>`
- `md-translator init`

The translate command accepts source/target locales, output path, provider options, config path, glossary path, style guide path, dry-run, check-only mode, force overwrite, concurrency, max chunk characters, JSON output, and verbose logging.

If `--out` is omitted, translated Markdown is written to stdout. File writes use UTF-8. Existing output files are not overwritten unless `--force` is set.

### Library Layer

`src/index.ts` exports:

- `translateMarkdown(options)`
- `createTranslator(options)`
- `translatePostTranslation(options)`
- public types and error codes

The main result includes translated Markdown, source/target locales, per-chunk metadata, warnings, and optional token usage.

### Config Layer

`src/config` resolves options in this order:

1. CLI arguments
2. Config file
3. `LLM_*` environment variables
4. Provider-specific environment variables such as `DEEPSEEK_*` or `OPENAI_*`
5. Defaults

Default provider settings:

- `baseUrl`: `https://api.deepseek.com`
- `model`: `deepseek-chat`

An API key is required for real translation, but not for `--check`, `--dry-run`, or tests using a mock provider.

### Provider Layer

`src/provider/openaiCompatibleClient.ts` calls the Chat Completions endpoint with:

- `model`
- `messages`
- `temperature`

The layer accepts any OpenAI-compatible base URL. It never logs API keys or full Authorization headers. Provider failures are converted into typed errors.

### Markdown Layer

`src/markdown` owns Markdown-specific behavior:

- Parse frontmatter with `gray-matter`.
- Parse Markdown with `unified` and `remark-parse`.
- Stringify Markdown with `remark-stringify`.
- Build a structure signature before and after translation.
- Chunk by Markdown sections and top-level nodes, without splitting fenced code blocks or tables.
- Clean common model wrappers such as `Here is the translation:` and full-output ```markdown fences.
- Validate headings, code block counts and languages, link counts, image counts, parseability, frontmatter parseability, and placeholder preservation.

Frontmatter defaults:

- Preserve keys such as `slug`, `date`, `tags`, `category`, `cover`, and `canonical`.
- Translate configured natural-language keys such as `title`, `summary`, `description`, `seoTitle`, and `seoDescription`.

Image URL values are preserved. Image alt text is translatable by default.

### Translation Layer

`src/translate` owns prompts, glossary handling, chunk execution, retries, and warning aggregation.

The system prompt instructs the model to:

- Translate technical articles without summarizing, expanding, or deleting content.
- Preserve Markdown structure.
- Preserve code, variables, commands, paths, URLs, and API names.
- Follow glossary entries.
- Output only the translated Markdown fragment.

Each chunk prompt includes:

- Source locale and target locale.
- Document title when available.
- Current heading path.
- Glossary entries.
- Optional style guide.
- Markdown chunk content.

Validation failure flow:

1. Clean common model wrappers.
2. Validate structure.
3. Retry the chunk once when configured.
4. Return warnings if validation still fails.

The CLI exits non-zero on validation failure by default. A future `--allow-warnings` option can allow successful exit with warnings.

### TwoRiver Adapter

`src/adapters/tworiver.ts` provides a lightweight helper:

```ts
translatePostTranslation({
  source,
  targetLocale,
  provider
});
```

It translates `title`, `summary`, and `contentMarkdown` independently. SEO fields remain `null` unless source values exist or a future option enables SEO generation. The adapter uses plain TypeScript types and does not import from TwoRiver Blog.

## Error Handling

The package defines typed errors with stable codes:

- `missing_api_key`
- `invalid_base_url`
- `input_file_not_found`
- `output_file_exists`
- `markdown_parse_failed`
- `provider_request_failed`
- `provider_response_malformed`
- `validation_failed`
- `unsupported_locale`
- `config_file_invalid`

CLI output is human-readable by default. With `--json`, errors and results are machine-readable.

## Testing

Use Vitest with mock providers. Tests must not call external model APIs.

Required coverage:

- Preserve fenced code blocks.
- Preserve inline code.
- Preserve link URLs while allowing link text translation.
- Preserve image URLs while allowing alt text translation.
- Parse frontmatter and preserve non-translatable fields.
- Validate heading counts.
- Validate code block counts and languages.
- Clean ```markdown-wrapped model output.
- Parse CLI arguments.
- Resolve provider config priority.
- Return TwoRiver-compatible output.
- Produce clear provider failure errors.
- Return warnings or non-zero CLI behavior on validation failure.

## Open Source Deliverables

The repository includes:

- `README.md`
- `LICENSE`
- `.gitignore`
- `.env.example`
- `package.json`
- TypeScript config
- Vitest config
- Prettier config
- GitHub Actions CI for install, typecheck, test, and build
- `examples/basic`
- `examples/tworiver`

The package is npm-publishable with `bin`, `exports`, `files`, and `types`.

## Proposed Directory Structure

```text
.
+-- src
|   +-- cli.ts
|   +-- index.ts
|   +-- config
|   |   +-- env.ts
|   |   +-- loadConfig.ts
|   +-- provider
|   |   +-- openaiCompatibleClient.ts
|   |   +-- types.ts
|   +-- markdown
|   |   +-- parse.ts
|   |   +-- chunk.ts
|   |   +-- validate.ts
|   |   +-- cleanModelOutput.ts
|   +-- translate
|   |   +-- glossary.ts
|   |   +-- prompts.ts
|   |   +-- translateMarkdown.ts
|   +-- adapters
|   |   +-- tworiver.ts
|   +-- errors.ts
+-- tests
+-- examples
|   +-- basic
|   +-- tworiver
+-- docs
+-- README.md
+-- LICENSE
+-- package.json
+-- tsconfig.json
+-- vitest.config.ts
```

## First Implementation Scope

Implement the smallest complete version that satisfies the CLI, library API, provider abstraction, Markdown chunking, validation, glossary, TwoRiver adapter, tests, README, and CI requirements.

Do not add a web UI. Do not perform real API calls in tests.
