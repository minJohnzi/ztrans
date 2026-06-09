import { describe, expect, it } from "vitest";
import { TranslatorError, serializeError } from "../src/errors.js";

describe("TranslatorError", () => {
  it("serializes stable error codes without leaking metadata", () => {
    const error = new TranslatorError("missing_api_key", "Missing API key", {
      authorization: "Bearer secret-token",
      safe: "visible"
    });

    expect(serializeError(error)).toEqual({
      code: "missing_api_key",
      message: "Missing API key",
      details: { safe: "visible" }
    });
  });

  it("recursively sanitizes nested sensitive detail keys", () => {
    const error = new TranslatorError("provider_request_failed", "Provider request failed", {
      provider: {
        apiKey: "secret",
        baseUrl: "https://example.com"
      },
      request: {
        headers: {
          Authorization: "Bearer secret"
        },
        method: "POST"
      },
      attempts: [
        {
          token: "secret-token",
          status: 401
        }
      ]
    });

    expect(serializeError(error)).toEqual({
      code: "provider_request_failed",
      message: "Provider request failed",
      details: {
        provider: {
          baseUrl: "https://example.com"
        },
        request: {
          method: "POST"
        },
        attempts: [
          {
            status: 401
          }
        ]
      }
    });
  });

  it("sanitizes casing and separator variants of sensitive detail keys", () => {
    const error = new TranslatorError("provider_request_failed", "Provider request failed", {
      api_key: "secret",
      "x-api-key": "secret",
      Authorization: "Bearer secret",
      token: "secret-token",
      secret: "secret-value",
      safe: "visible"
    });

    expect(serializeError(error)).toEqual({
      code: "provider_request_failed",
      message: "Provider request failed",
      details: { safe: "visible" }
    });
  });
});
