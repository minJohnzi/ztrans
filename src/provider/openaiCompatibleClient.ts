import { TranslatorError } from "../errors.js";
import type { CompletionRequest, CompletionResponse, LlmProvider } from "./types.js";

export interface OpenAICompatibleClientOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

interface ChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class OpenAICompatibleClient implements LlmProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatibleClientOptions) {
    if (!options.apiKey?.trim()) {
      throw new TranslatorError("missing_api_key", "Missing API key for LLM provider.");
    }

    this.apiKey = options.apiKey;
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.model = options.model ?? "deepseek-chat";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const response = await this.sendRequest(url, request);

    if (!response.ok) {
      throw new TranslatorError("provider_request_failed", "Provider request failed.", {
        status: response.status,
        statusText: response.statusText,
        url
      });
    }

    const data = await parseChatCompletionsResponse(response, url);
    const content = data.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.length === 0) {
      throw new TranslatorError(
        "provider_response_malformed",
        "Provider response did not include message content.",
        { url }
      );
    }

    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens
          }
        : undefined
    };
  }

  private async sendRequest(url: string, request: CompletionRequest): Promise<Response> {
    try {
      return await this.fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.2
        })
      });
    } catch {
      throw new TranslatorError("provider_request_failed", "Provider request failed.", {
        url
      });
    }
  }
}

function normalizeBaseUrl(baseUrl?: string): string {
  try {
    const parsed = new URL(baseUrl ?? "https://api.deepseek.com");

    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      throw new Error("Unsupported protocol");
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new TranslatorError("invalid_base_url", "Invalid LLM provider base URL.");
  }
}

async function parseChatCompletionsResponse(
  response: Response,
  url: string
): Promise<ChatCompletionsResponse> {
  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new TranslatorError("provider_response_malformed", "Provider response was not valid JSON.", {
      url
    });
  }

  if (!isResponseObject(data)) {
    throw new TranslatorError("provider_response_malformed", "Provider response was not an object.", {
      url
    });
  }

  return data;
}

function isResponseObject(value: unknown): value is ChatCompletionsResponse {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
