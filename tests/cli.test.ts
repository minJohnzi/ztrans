import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TranslatorError,
  type TranslateMarkdownOptions,
  type TranslateMarkdownResult,
} from "../src/index.js";
import { buildCliProgram } from "../src/cli.js";

let tempDir: string | undefined;

async function tempFile(name: string, contents: string): Promise<string> {
  tempDir ??= await mkdtemp(join(tmpdir(), "ztrans-cli-"));
  const filePath = join(tempDir, name);
  await writeFile(filePath, contents, "utf8");
  return filePath;
}

function tempPath(name: string): string {
  tempDir ??= join(tmpdir(), `ztrans-cli-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  return join(tempDir, name);
}

async function runCli(
  args: string[],
  translateMarkdownImpl = vi.fn(
    async (options: TranslateMarkdownOptions): Promise<TranslateMarkdownResult> => ({
      markdown: options.markdown.replace("Hello", "Bonjour"),
      sourceLocale: options.sourceLocale,
      targetLocale: options.targetLocale,
      chunks: [],
      warnings: [],
    }),
  ),
) {
  let stdout = "";
  let stderr = "";
  const program = buildCliProgram({
    translateMarkdownImpl,
    stdout: {
      write: (chunk: string) => {
        stdout += chunk;
      },
    },
    stderr: {
      write: (chunk: string) => {
        stderr += chunk;
      },
    },
    env: {},
  });

  let exitCode = 0;
  try {
    await program.parseAsync(["node", "ztrans", ...args], { from: "node" });
  } catch (error) {
    exitCode = Number((error as { exitCode?: number }).exitCode ?? 1);
  }

  return { stdout, stderr, exitCode, translateMarkdownImpl };
}

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("buildCliProgram", () => {
  it("configures the ztrans command with translate and init subcommands", () => {
    const program = buildCliProgram();

    expect(program.name()).toBe("ztrans");
    expect(program.commands.map((command) => command.name()).sort()).toEqual(["init", "translate"]);

    const translate = program.commands.find((command) => command.name() === "translate");
    expect(translate?.registeredArguments.map((argument) => argument.name())).toEqual(["input"]);
    expect(translate?.options.map((option) => option.long).sort()).toEqual([
      "--api-key",
      "--base-url",
      "--check",
      "--concurrency",
      "--config",
      "--dry-run",
      "--force",
      "--from",
      "--glossary",
      "--json",
      "--max-chars",
      "--model",
      "--out",
      "--style",
      "--to",
      "--verbose",
    ]);
  });

  it("does not make --to required at the Commander parser layer", () => {
    const program = buildCliProgram();
    const translate = program.commands.find((command) => command.name() === "translate");
    const toOption = translate?.options.find((option) => option.long === "--to");

    expect((toOption as { mandatory?: boolean } | undefined)?.mandatory).toBe(false);
  });

  it("prints example YAML config from init", async () => {
    const result = await runCli(["init"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("provider:");
    expect(result.stdout).toContain("translation:");
    expect(result.stdout).toContain("targetLocale:");
    expect(result.stderr).toBe("");
  });

  it("prints a structure signature for --check --json without an API key", async () => {
    const input = await tempFile(
      "source.md",
      "# Hello\n\nUse `code` and [link](https://example.com).",
    );
    const result = await runCli(["translate", input, "--check", "--json"]);

    expect(result.exitCode).toBe(0);
    expect(result.translateMarkdownImpl).not.toHaveBeenCalled();
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      mode: "check",
      signature: {
        headings: [{ depth: 1 }],
        inlineCodeValues: ["code"],
        linkUrls: ["https://example.com"],
      },
    });
    expect(result.stderr).toBe("");
  });

  it("uses translation.targetLocale from config when --to is omitted", async () => {
    const input = await tempFile("source.md", "# Hello");
    const config = await tempFile(
      "translator.yml",
      ["translation:", "  targetLocale: fr"].join("\n"),
    );
    const translateMarkdownImpl = vi.fn(
      async (options: TranslateMarkdownOptions): Promise<TranslateMarkdownResult> => ({
        markdown: options.markdown.replace("Hello", "Bonjour"),
        sourceLocale: options.sourceLocale,
        targetLocale: options.targetLocale,
        chunks: [],
        warnings: [],
      }),
    );

    const result = await runCli(["translate", input, "--config", config], translateMarkdownImpl);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("# Bonjour\n");
    expect(translateMarkdownImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLocale: "fr",
      }),
    );
  });

  it("prints a friendly typed error when translate is missing target locale", async () => {
    const input = await tempFile("source.md", "# Hello");
    const result = await runCli(["translate", input, "--json"]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      error: {
        code: "unsupported_locale",
        message: "Target locale is required. Pass --to or set translation.targetLocale in config.",
      },
    });
    expect(result.translateMarkdownImpl).not.toHaveBeenCalled();
  });

  it("prints JSON errors for missing input files", async () => {
    const result = await runCli(["translate", tempPath("missing.md"), "--to", "fr", "--json"]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      error: { code: "input_file_not_found" },
    });
    expect(result.stderr).toBe("");
  });

  it("rejects existing output files without --force", async () => {
    const input = await tempFile("source.md", "# Hello");
    const output = await tempFile("translated.md", "existing");
    const result = await runCli(["translate", input, "--to", "fr", "--out", output]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("output_file_exists");
    expect(result.translateMarkdownImpl).not.toHaveBeenCalled();
    await expect(readFile(output, "utf8")).resolves.toBe("existing");
  });

  it("prints a dry-run plan without writing output or translating", async () => {
    const input = await tempFile("source.md", "# Hello");
    const output = tempPath("translated.md");
    const result = await runCli([
      "translate",
      input,
      "--to",
      "fr",
      "--out",
      output,
      "--dry-run",
      "--max-chars",
      "500",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Dry run plan");
    expect(result.stdout).toContain("targetLocale: fr");
    expect(result.translateMarkdownImpl).not.toHaveBeenCalled();
    expect(existsSync(output)).toBe(false);
  });

  it("writes translated Markdown to stdout when --out is omitted", async () => {
    const input = await tempFile("source.md", "# Hello");
    const translateMarkdownImpl = vi.fn(
      async (): Promise<TranslateMarkdownResult> => ({
        markdown: "# Bonjour",
        targetLocale: "fr",
        chunks: [],
        warnings: [],
      }),
    );

    const result = await runCli(["translate", input, "--to", "fr"], translateMarkdownImpl);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("# Bonjour\n");
    expect(result.stderr).toBe("");
    expect(translateMarkdownImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        markdown: "# Hello",
        targetLocale: "fr",
      }),
    );
  });

  it("writes translated Markdown to a UTF-8 output file with --force", async () => {
    const input = await tempFile("source.md", "# Hello");
    const output = await tempFile("translated.md", "existing");
    const translateMarkdownImpl = vi.fn(
      async (): Promise<TranslateMarkdownResult> => ({
        markdown: "# Bonjour",
        targetLocale: "fr",
        chunks: [],
        warnings: [],
      }),
    );

    const result = await runCli(
      ["translate", input, "--to", "fr", "--out", output, "--force"],
      translateMarkdownImpl,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Wrote");
    expect(result.stderr).toBe("");
    await expect(readFile(output, "utf8")).resolves.toBe("# Bonjour");
  });

  it("returns a non-zero exit code after printing output when translation has warnings", async () => {
    const input = await tempFile("source.md", "# Hello");
    const translateMarkdownImpl = vi.fn(
      async (): Promise<TranslateMarkdownResult> => ({
        markdown: "# Bonjour",
        targetLocale: "fr",
        chunks: [],
        warnings: ["Heading count changed."],
      }),
    );

    const result = await runCli(["translate", input, "--to", "fr"], translateMarkdownImpl);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("# Bonjour");
    expect(result.stderr).toContain("Translation warnings");
    expect(result.stderr).toContain("Heading count changed.");
  });

  it("prints exactly one JSON object when translation has warnings", async () => {
    const input = await tempFile("source.md", "# Hello");
    const translateMarkdownImpl = vi.fn(
      async (): Promise<TranslateMarkdownResult> => ({
        markdown: "# Bonjour",
        targetLocale: "fr",
        chunks: [],
        warnings: ["Heading count changed."],
      }),
    );

    const result = await runCli(
      ["translate", input, "--to", "fr", "--json"],
      translateMarkdownImpl,
    );
    const jsonLines = result.stdout.trim().split(/\r?\n/);

    expect(result.exitCode).toBe(1);
    expect(jsonLines).toHaveLength(1);
    expect(JSON.parse(jsonLines[0] ?? "")).toMatchObject({
      ok: false,
      result: { markdown: "# Bonjour" },
      warnings: ["Heading count changed."],
    });
    expect(result.stderr).toBe("");
  });

  it("does not print API keys in JSON errors", async () => {
    const input = await tempFile("source.md", "# Hello");
    const translateMarkdownImpl = vi.fn(async () => {
      throw new TranslatorError("provider_request_failed", "Provider failed.", {
        apiKey: "secret-key",
        authorization: "Bearer secret-key",
        safe: "visible",
      });
    });

    const result = await runCli(
      ["translate", input, "--to", "fr", "--api-key", "secret-key", "--json"],
      translateMarkdownImpl,
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("provider_request_failed");
    expect(result.stdout).toContain("visible");
    expect(result.stdout).not.toContain("secret-key");
    expect(result.stderr).toBe("");
  });
});
