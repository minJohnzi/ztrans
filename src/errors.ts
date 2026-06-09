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

const SENSITIVE_DETAIL_KEYS = new Set([
  "apikey",
  "xapikey",
  "authorization",
  "headers",
  "token",
  "secret",
]);

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

export interface SerializedTranslatorError {
  code: TranslatorErrorCode | "unknown_error";
  message: string;
  details?: Record<string, unknown>;
}

export function serializeError(error: unknown): SerializedTranslatorError {
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

function sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) {
    return undefined;
  }

  const sanitized = sanitizeObject(details);

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (isPlainObject(value)) {
    return sanitizeObject(value);
  }

  return value;
}

function sanitizeObject(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSensitiveDetailKey(key)) {
      continue;
    }

    sanitized[key] = sanitizeValue(nestedValue);
  }

  return sanitized;
}

function isSensitiveDetailKey(key: string): boolean {
  return SENSITIVE_DETAIL_KEYS.has(normalizeDetailKey(key));
}

function normalizeDetailKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
