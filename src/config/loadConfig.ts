import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import YAML from "yaml";
import { TranslatorError } from "../errors.js";
import type { Locale, ProviderConfig } from "../types.js";

export interface TranslatorConfigFile {
  provider?: ProviderConfig;
  translation?: {
    sourceLocale?: Locale;
    targetLocale?: Locale;
    maxChunkChars?: number;
    concurrency?: number;
  };
  quality?: {
    retryOnValidationFailure?: boolean;
    maxRetries?: number;
    validateStructure?: boolean;
  };
}

export async function loadConfigFile(filePath?: string): Promise<TranslatorConfigFile> {
  if (!filePath) {
    return {};
  }

  const parsed = await parseStructuredFile(filePath);
  assertPlainObject(parsed, "Config file must contain an object.");

  return parseConfigObject(parsed);
}

export async function parseStructuredFile(filePath: string): Promise<unknown> {
  const contents = await readFile(filePath, "utf8");
  const extension = extname(filePath).toLowerCase();

  try {
    if (extension === ".json") {
      return JSON.parse(contents) as unknown;
    }

    return YAML.parse(contents) as unknown;
  } catch {
    throwInvalidConfig("Config file could not be parsed.", filePath);
  }
}

export function assertPlainObject(
  value: unknown,
  message = "Config file must contain an object."
): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throwInvalidConfig(message);
  }
}

export function throwInvalidConfig(message: string, filePath?: string): never {
  throw new TranslatorError("config_file_invalid", message, filePath ? { path: filePath } : undefined);
}

function parseConfigObject(value: Record<string, unknown>): TranslatorConfigFile {
  return {
    provider: parseProviderConfig(value.provider),
    translation: parseTranslationConfig(value.translation),
    quality: parseQualityConfig(value.quality)
  };
}

function parseProviderConfig(value: unknown): ProviderConfig | undefined {
  if (value === undefined) {
    return undefined;
  }

  assertPlainObject(value, "Config provider must contain an object.");

  return {
    apiKey: optionalString(value.apiKey, "provider.apiKey"),
    baseUrl: optionalString(value.baseUrl, "provider.baseUrl"),
    model: optionalString(value.model, "provider.model"),
    temperature: optionalNumber(value.temperature, "provider.temperature")
  };
}

function parseTranslationConfig(
  value: unknown
): TranslatorConfigFile["translation"] | undefined {
  if (value === undefined) {
    return undefined;
  }

  assertPlainObject(value, "Config translation must contain an object.");

  return {
    sourceLocale: optionalString(value.sourceLocale, "translation.sourceLocale"),
    targetLocale: optionalString(value.targetLocale, "translation.targetLocale"),
    maxChunkChars: optionalNumber(value.maxChunkChars, "translation.maxChunkChars"),
    concurrency: optionalNumber(value.concurrency, "translation.concurrency")
  };
}

function parseQualityConfig(value: unknown): TranslatorConfigFile["quality"] | undefined {
  if (value === undefined) {
    return undefined;
  }

  assertPlainObject(value, "Config quality must contain an object.");

  return {
    retryOnValidationFailure: optionalBoolean(
      value.retryOnValidationFailure,
      "quality.retryOnValidationFailure"
    ),
    maxRetries: optionalNumber(value.maxRetries, "quality.maxRetries"),
    validateStructure: optionalBoolean(value.validateStructure, "quality.validateStructure")
  };
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throwInvalidConfig(`Config field ${fieldName} must be a string.`);
  }

  return value;
}

function optionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throwInvalidConfig(`Config field ${fieldName} must be a finite number.`);
  }

  return value;
}

function optionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throwInvalidConfig(`Config field ${fieldName} must be a boolean.`);
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
