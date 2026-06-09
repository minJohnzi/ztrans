import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { TranslatorError, serializeError } from "../src/errors.js";
import { loadConfigFile } from "../src/config/loadConfig.js";
import { resolveProviderConfig } from "../src/config/env.js";

let tempDir: string | undefined;

async function writeTempFile(name: string, contents: string): Promise<string> {
  tempDir ??= await mkdtemp(join(tmpdir(), "ztrans-config-"));
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

  it("ignores empty strings and falls back to provider-specific env then defaults", () => {
    const result = resolveProviderConfig({
      cli: { apiKey: "", baseUrl: "", model: "" },
      config: { apiKey: "", baseUrl: "", model: "" },
      env: {
        LLM_API_KEY: "",
        LLM_BASE_URL: "",
        LLM_MODEL: "",
        OPENAI_API_KEY: "openai-key",
        OPENAI_BASE_URL: "https://openai.example/v1",
        OPENAI_MODEL: "openai-model",
      },
    });

    expect(result).toEqual({
      apiKey: "openai-key",
      baseUrl: "https://openai.example/v1",
      model: "openai-model",
    });
  });

  it("uses DeepSeek-compatible defaults when no values are provided", () => {
    expect(resolveProviderConfig({ env: {} })).toEqual({
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
    });
  });
});

describe("loadConfigFile", () => {
  it("loads YAML config files", async () => {
    const filePath = await writeTempFile(
      "translator.yml",
      [
        "provider:",
        "  apiKey: config-key",
        "  baseUrl: https://config.example",
        "  model: config-model",
        "  temperature: 0.1",
        "translation:",
        "  sourceLocale: zh",
        "  targetLocale: en",
        "quality:",
        "  maxRetries: 2",
      ].join("\n"),
    );

    await expect(loadConfigFile(filePath)).resolves.toEqual({
      provider: {
        apiKey: "config-key",
        baseUrl: "https://config.example",
        model: "config-model",
        temperature: 0.1,
      },
      translation: {
        sourceLocale: "zh",
        targetLocale: "en",
      },
      quality: {
        maxRetries: 2,
      },
    });
  });

  it("loads JSON config files", async () => {
    const filePath = await writeTempFile(
      "translator.json",
      JSON.stringify({ provider: { model: "json-model" } }),
    );

    await expect(loadConfigFile(filePath)).resolves.toEqual({
      provider: { model: "json-model" },
    });
  });

  it("throws config_file_invalid for non-object config files without leaking contents", async () => {
    const filePath = await writeTempFile("translator.yml", "secret-config-value");

    try {
      await loadConfigFile(filePath);
    } catch (error) {
      expect(error).toBeInstanceOf(TranslatorError);
      expect(error).toMatchObject({ code: "config_file_invalid" });
      expect(JSON.stringify(serializeError(error))).not.toContain("secret-config-value");
      return;
    }

    throw new Error("Expected config_file_invalid");
  });
});
