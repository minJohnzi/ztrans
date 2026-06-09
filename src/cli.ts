import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import {
  createStructureSignature,
  loadConfigFile,
  loadGlossaryFile,
  packageVersion,
  resolveProviderConfig,
  serializeError,
  translateMarkdown,
  TranslatorError,
} from "./index.js";
import type { ProviderConfig, TranslateMarkdownOptions, TranslateMarkdownResult } from "./index.js";

interface WritableLike {
  write(chunk: string): unknown;
}

export interface BuildCliProgramOptions {
  translateMarkdownImpl?: (options: TranslateMarkdownOptions) => Promise<TranslateMarkdownResult>;
  stdout?: WritableLike;
  stderr?: WritableLike;
  env?: Record<string, string | undefined>;
}

interface TranslateCommandOptions {
  from?: string;
  to?: string;
  out?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  config?: string;
  glossary?: string;
  style?: string;
  dryRun?: boolean;
  check?: boolean;
  force?: boolean;
  concurrency?: number;
  maxChars?: number;
  json?: boolean;
  verbose?: boolean;
}

const EXAMPLE_CONFIG = [
  "provider:",
  "  baseUrl: https://api.deepseek.com",
  "  model: deepseek-chat",
  "translation:",
  "  sourceLocale: zh",
  "  targetLocale: en",
  "  maxChunkChars: 6000",
  "  concurrency: 1",
  "quality:",
  "  retryOnValidationFailure: true",
  "  maxRetries: 1",
  "  validateStructure: true",
  "",
].join("\n");

export function buildCliProgram(options: BuildCliProgramOptions = {}): Command {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const translateMarkdownImpl = options.translateMarkdownImpl ?? translateMarkdown;
  const env = options.env ?? process.env;

  const program = new Command();
  program
    .name("md-translator")
    .description("Translate Markdown while preserving document structure.")
    .version(packageVersion)
    .exitOverride();

  program.configureOutput({
    writeOut: (chunk) => write(stdout, chunk),
    writeErr: (chunk) => write(stderr, chunk),
    outputError: (chunk, writeErr) => writeErr(chunk),
  });

  program
    .command("init")
    .description("Print an example YAML configuration.")
    .action(() => {
      write(stdout, EXAMPLE_CONFIG);
    });

  program
    .command("translate")
    .description("Translate a Markdown file.")
    .argument("<input>", "Markdown input file")
    .option("--from <locale>", "source locale")
    .option("--to <locale>", "target locale")
    .option("--out <file>", "write translated Markdown to a file")
    .option("--model <model>", "provider model")
    .option("--base-url <url>", "OpenAI-compatible base URL")
    .option("--api-key <key>", "provider API key")
    .option("--config <file>", "YAML or JSON config file")
    .option("--glossary <file>", "YAML or JSON glossary file")
    .option("--style <file>", "style guide text file")
    .option("--dry-run", "print a translation plan without translating or writing output")
    .option("--check", "print the Markdown structure signature without translating")
    .option("--force", "overwrite an existing output file")
    .option("--concurrency <number>", "parallel chunk translation limit", parsePositiveInteger)
    .option("--max-chars <number>", "maximum characters per chunk", parsePositiveInteger)
    .option("--json", "print machine-readable output")
    .option("--verbose", "print extra human-readable progress")
    .action(async (input: string, commandOptions: TranslateCommandOptions) => {
      try {
        await runTranslate(input, commandOptions, {
          stdout,
          stderr,
          env,
          translateMarkdownImpl,
        });
      } catch (error) {
        handleCliError(error, commandOptions.json === true, stdout, stderr);
      }
    });

  return program;
}

interface Runtime {
  stdout: WritableLike;
  stderr: WritableLike;
  env: Record<string, string | undefined>;
  translateMarkdownImpl: (options: TranslateMarkdownOptions) => Promise<TranslateMarkdownResult>;
}

async function runTranslate(
  input: string,
  options: TranslateCommandOptions,
  runtime: Runtime,
): Promise<void> {
  if (!existsSync(input)) {
    throw new TranslatorError("input_file_not_found", "Input file was not found.", { path: input });
  }

  if (
    options.out &&
    !options.force &&
    !options.dryRun &&
    !options.check &&
    existsSync(options.out)
  ) {
    throw new TranslatorError(
      "output_file_exists",
      "Output file already exists. Use --force to overwrite.",
      {
        path: options.out,
      },
    );
  }

  const markdown = await readFile(input, "utf8");

  if (options.check) {
    const signature = createStructureSignature(markdown);
    printSuccess(
      runtime.stdout,
      options.json === true,
      {
        mode: "check",
        signature,
      },
      `Structure signature:\n${JSON.stringify(signature, null, 2)}\n`,
    );
    return;
  }

  const config = await loadConfigFile(options.config);
  const provider = resolveProviderConfig({
    cli: cliProviderConfig(options),
    config: config.provider,
    env: runtime.env,
  });
  const sourceLocale = options.from ?? config.translation?.sourceLocale;
  const targetLocale = options.to ?? config.translation?.targetLocale;
  const maxChunkChars = options.maxChars ?? config.translation?.maxChunkChars;
  const concurrency = options.concurrency ?? config.translation?.concurrency;

  assertTargetLocale(targetLocale);

  if (options.dryRun) {
    const plan = {
      input,
      output: options.out ?? "stdout",
      sourceLocale,
      targetLocale,
      provider: {
        baseUrl: provider.baseUrl,
        model: provider.model,
      },
      maxChunkChars,
      concurrency,
      glossary: options.glossary,
      style: options.style,
    };
    printSuccess(
      runtime.stdout,
      options.json === true,
      {
        mode: "dry-run",
        plan,
      },
      renderDryRunPlan(plan),
    );
    return;
  }

  const glossary = await loadGlossaryFile(options.glossary);
  const styleGuide = options.style ? await readFile(options.style, "utf8") : undefined;
  const result = await runtime.translateMarkdownImpl({
    markdown,
    sourceLocale,
    targetLocale,
    provider,
    glossary,
    styleGuide,
    maxChunkChars,
    concurrency,
    retryOnValidationFailure: config.quality?.retryOnValidationFailure,
    maxRetries: config.quality?.maxRetries,
    validateStructure: config.quality?.validateStructure,
  });

  if (options.out) {
    await writeFile(options.out, result.markdown, "utf8");
  }

  if (options.json) {
    write(runtime.stdout, `${JSON.stringify(jsonTranslatePayload(result))}\n`);
  } else if (options.out) {
    write(runtime.stdout, `Wrote ${options.out}\n`);
  } else {
    write(runtime.stdout, `${result.markdown}\n`);
  }

  if (result.warnings.length > 0) {
    if (!options.json) {
      write(
        runtime.stderr,
        `Translation warnings:\n${result.warnings.map((warning) => `- ${warning}`).join("\n")}\n`,
      );
    }
    throw new CommanderError(1, "translation_warnings", "Translation completed with warnings.");
  }
}

function assertTargetLocale(targetLocale: string | undefined): asserts targetLocale is string {
  if (!targetLocale) {
    throw new TranslatorError(
      "unsupported_locale",
      "Target locale is required. Pass --to or set translation.targetLocale in config.",
    );
  }
}

function jsonTranslatePayload(result: TranslateMarkdownResult): Record<string, unknown> {
  if (result.warnings.length > 0) {
    return { ok: false, result, warnings: result.warnings };
  }

  return { ok: true, result };
}

function cliProviderConfig(options: TranslateCommandOptions): ProviderConfig {
  return {
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    model: options.model,
  };
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("must be a positive integer");
  }

  return parsed;
}

function printSuccess(
  stdout: WritableLike,
  json: boolean,
  payload: Record<string, unknown>,
  humanText?: string,
): void {
  if (json) {
    write(stdout, `${JSON.stringify({ ok: true, ...payload })}\n`);
    return;
  }

  write(stdout, humanText ?? `${JSON.stringify(payload, null, 2)}\n`);
}

function renderDryRunPlan(plan: Record<string, unknown>): string {
  return [
    "Dry run plan",
    `input: ${plan.input}`,
    `output: ${plan.output}`,
    `sourceLocale: ${plan.sourceLocale ?? "(auto)"}`,
    `targetLocale: ${plan.targetLocale}`,
    `provider.baseUrl: ${(plan.provider as ProviderConfig).baseUrl}`,
    `provider.model: ${(plan.provider as ProviderConfig).model}`,
    `maxChunkChars: ${plan.maxChunkChars ?? "(default)"}`,
    `concurrency: ${plan.concurrency ?? "(default)"}`,
    "",
  ].join("\n");
}

function handleCliError(
  error: unknown,
  json: boolean,
  stdout: WritableLike,
  stderr: WritableLike,
): never {
  if (error instanceof CommanderError) {
    throw error;
  }

  const serialized = serializeError(error);
  if (json) {
    write(stdout, `${JSON.stringify({ ok: false, error: serialized })}\n`);
  } else {
    write(stderr, `${serialized.code}: ${serialized.message}\n`);
  }

  throw new CommanderError(1, serialized.code, serialized.message);
}

function write(stream: WritableLike, chunk: string): void {
  stream.write(chunk);
}

function isEntrypoint(): boolean {
  const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return fileURLToPath(import.meta.url) === executedPath;
}

if (isEntrypoint()) {
  try {
    await buildCliProgram().parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      process.exitCode = error.exitCode;
    } else {
      const serialized = serializeError(error);
      process.stderr.write(`${serialized.code}: ${serialized.message}\n`);
      process.exitCode = 1;
    }
  }
}
