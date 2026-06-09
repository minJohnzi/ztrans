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
});
