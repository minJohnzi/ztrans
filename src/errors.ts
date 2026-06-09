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

const SENSITIVE_DETAIL_KEYS = new Set(["apiKey", "authorization", "Authorization", "headers"]);

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
      details: sanitizeDetails(error.details)
    };
  }

  return {
    code: "unknown_error",
    message: error instanceof Error ? error.message : String(error)
  };
}

function sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) {
    return undefined;
  }

  const sanitized = Object.fromEntries(
    Object.entries(details).filter(([key]) => !SENSITIVE_DETAIL_KEYS.has(key))
  );

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}
