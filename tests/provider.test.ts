import { beforeEach, describe, expect, it, vi } from "vitest";
import { serializeError, TranslatorError } from "../src/errors.js";
import { OpenAICompatibleClient } from "../src/provider/openaiCompatibleClient.js";

describe("OpenAICompatibleClient", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("Unexpected external network call");
      })
    );
  });

  it("calls chat completions with auth and maps content plus usage", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "translated markdown" } }],
          usage: {
            prompt_tokens: 11,
            completion_tokens: 7,
            total_tokens: 18
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const client = new OpenAICompatibleClient({
      apiKey: "test-key",
      baseUrl: "https://provider.example/v1/",
      model: "demo-model",
      fetchImpl
    });

    const response = await client.complete({
      messages: [{ role: "user", content: "Translate this" }],
      temperature: 0.2
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://provider.example/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "demo-model",
        messages: [{ role: "user", content: "Translate this" }],
        temperature: 0.2
      })
    });
    expect(response).toEqual({
      content: "translated markdown",
      usage: {
        promptTokens: 11,
        completionTokens: 7,
        totalTokens: 18
      }
    });
  });

  it("accepts base URLs without a trailing slash", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200
      });
    });
    const client = new OpenAICompatibleClient({
      apiKey: "test-key",
      baseUrl: "https://provider.example/v1",
      model: "demo-model",
      fetchImpl
    });

    await client.complete({ messages: [{ role: "user", content: "Hello" }] });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://provider.example/v1/chat/completions",
      expect.any(Object)
    );
  });

  it("throws missing_api_key when apiKey is missing", () => {
    expect(() => new OpenAICompatibleClient({ apiKey: "", baseUrl: "https://provider.example" }))
      .toThrowError(TranslatorError);

    expect(() => new OpenAICompatibleClient({ apiKey: "", baseUrl: "https://provider.example" }))
      .toThrow(expect.objectContaining({ code: "missing_api_key" }));
  });

  it("throws invalid_base_url for invalid base URLs", () => {
    expect(
      () => new OpenAICompatibleClient({ apiKey: "test-key", baseUrl: "not a url" })
    ).toThrow(expect.objectContaining({ code: "invalid_base_url" }));
  });

  it("rejects base URLs containing credentials, search params, or hash fragments", () => {
    const unsafeBaseUrls = [
      "https://user@provider.example",
      "https://user:secret@provider.example",
      "https://provider.example?token=secret-token",
      "https://provider.example#secret-token"
    ];

    for (const baseUrl of unsafeBaseUrls) {
      expect(() => new OpenAICompatibleClient({ apiKey: "test-key", baseUrl })).toThrow(
        expect.objectContaining({ code: "invalid_base_url" })
      );
    }
  });

  it("does not reveal secrets embedded in rejected base URLs when serialized", () => {
    try {
      new OpenAICompatibleClient({
        apiKey: "test-key",
        baseUrl: "https://user:secret-password@provider.example?token=secret-token#secret-fragment"
      });
    } catch (error) {
      expect(error).toMatchObject({ code: "invalid_base_url" });
      const serialized = JSON.stringify(serializeError(error));
      expect(serialized).not.toContain("secret-password");
      expect(serialized).not.toContain("secret-token");
      expect(serialized).not.toContain("secret-fragment");
      expect(serialized).not.toContain("user:");
      return;
    }

    throw new Error("Expected invalid_base_url");
  });

  it("throws provider_response_malformed when response lacks message content", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 });
    });
    const client = new OpenAICompatibleClient({
      apiKey: "test-key",
      baseUrl: "https://provider.example",
      model: "demo-model",
      fetchImpl
    });

    await expect(
      client.complete({ messages: [{ role: "user", content: "Hello" }] })
    ).rejects.toMatchObject({ code: "provider_response_malformed" });
  });

  it("throws provider_response_malformed for invalid JSON responses", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("not json", { status: 200 });
    });
    const client = new OpenAICompatibleClient({
      apiKey: "test-key",
      baseUrl: "https://provider.example",
      model: "demo-model",
      fetchImpl
    });

    await expect(
      client.complete({ messages: [{ role: "user", content: "Hello" }] })
    ).rejects.toMatchObject({ code: "provider_response_malformed" });
  });

  it("throws provider_response_malformed for null JSON responses", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("null", { status: 200 });
    });
    const client = new OpenAICompatibleClient({
      apiKey: "test-key",
      baseUrl: "https://provider.example",
      model: "demo-model",
      fetchImpl
    });

    await expect(
      client.complete({ messages: [{ role: "user", content: "Hello" }] })
    ).rejects.toMatchObject({ code: "provider_response_malformed" });
  });

  it("throws provider_request_failed without leaking authorization details", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { message: "nope" } }), {
        status: 401,
        statusText: "Unauthorized"
      });
    });
    const client = new OpenAICompatibleClient({
      apiKey: "secret-api-key",
      baseUrl: "https://provider.example",
      model: "demo-model",
      fetchImpl
    });

    await expect(
      client.complete({ messages: [{ role: "user", content: "Hello" }] })
    ).rejects.toMatchObject({
      code: "provider_request_failed",
      details: {
        status: 401,
        statusText: "Unauthorized",
        url: "https://provider.example/chat/completions"
      }
    });

    try {
      await client.complete({ messages: [{ role: "user", content: "Hello" }] });
    } catch (error) {
      const details = JSON.stringify((error as TranslatorError).details);
      expect(details).not.toContain("secret-api-key");
      expect(details).not.toContain("Bearer");
      expect(details).not.toContain("Authorization");
    }
  });

  it("does not leak authorization details from thrown fetch errors", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("failed with Authorization: Bearer secret-api-key");
    });
    const client = new OpenAICompatibleClient({
      apiKey: "secret-api-key",
      baseUrl: "https://provider.example",
      model: "demo-model",
      fetchImpl
    });

    try {
      await client.complete({ messages: [{ role: "user", content: "Hello" }] });
    } catch (error) {
      expect(error).toMatchObject({ code: "provider_request_failed" });
      const details = JSON.stringify((error as TranslatorError).details);
      expect(details).not.toContain("secret-api-key");
      expect(details).not.toContain("Bearer");
      expect(details).not.toContain("Authorization");
      return;
    }

    throw new Error("Expected provider_request_failed");
  });

  it("does not call global fetch when a fetch implementation is injected", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200
      });
    });
    const client = new OpenAICompatibleClient({
      apiKey: "test-key",
      baseUrl: "https://provider.example",
      model: "demo-model",
      fetchImpl
    });

    await client.complete({ messages: [{ role: "user", content: "Hello" }] });

    expect(fetch).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
