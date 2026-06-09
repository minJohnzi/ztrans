import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { TranslatorError, serializeError } from "../src/errors.js";
import { loadGlossaryFile, renderGlossaryForPrompt } from "../src/translate/glossary.js";

let tempDir: string | undefined;

async function writeTempFile(name: string, contents: string): Promise<string> {
  tempDir ??= await mkdtemp(join(tmpdir(), "md-translator-glossary-"));
  const filePath = join(tempDir, name);
  await writeFile(filePath, contents, "utf8");
  return filePath;
}

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("renderGlossaryForPrompt", () => {
  it("renders terms with optional notes", () => {
    expect(
      renderGlossaryForPrompt([
        { source: "TwoRiver", target: "TwoRiver", note: "Project name, never translate." },
        { source: "发布控制台", target: "publishing console" }
      ])
    ).toBe(
      [
        "TwoRiver => TwoRiver (Project name, never translate.)",
        "发布控制台 => publishing console"
      ].join("\n")
    );
  });

  it("renders an explicit empty glossary message", () => {
    expect(renderGlossaryForPrompt([])).toBe("No glossary entries.");
  });
});

describe("loadGlossaryFile", () => {
  it("loads YAML glossary terms", async () => {
    const filePath = await writeTempFile(
      "glossary.yml",
      [
        "terms:",
        "  - source: TwoRiver",
        "    target: TwoRiver",
        "    note: Project name, never translate.",
        "  - source: API",
        "    target: API"
      ].join("\n")
    );

    await expect(loadGlossaryFile(filePath)).resolves.toEqual([
      { source: "TwoRiver", target: "TwoRiver", note: "Project name, never translate." },
      { source: "API", target: "API" }
    ]);
  });

  it("loads JSON glossary terms", async () => {
    const filePath = await writeTempFile(
      "glossary.json",
      JSON.stringify({ terms: [{ source: "Fastify", target: "Fastify" }] })
    );

    await expect(loadGlossaryFile(filePath)).resolves.toEqual([
      { source: "Fastify", target: "Fastify" }
    ]);
  });

  it("throws config_file_invalid for invalid glossary files without leaking contents", async () => {
    const filePath = await writeTempFile(
      "glossary.json",
      JSON.stringify({ terms: [{ source: "secret-source" }] })
    );

    try {
      await loadGlossaryFile(filePath);
    } catch (error) {
      expect(error).toBeInstanceOf(TranslatorError);
      expect(error).toMatchObject({ code: "config_file_invalid" });
      expect(JSON.stringify(serializeError(error))).not.toContain("secret-source");
      return;
    }

    throw new Error("Expected config_file_invalid");
  });
});
