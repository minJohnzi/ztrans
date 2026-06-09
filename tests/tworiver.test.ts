import { describe, expect, it } from "vitest";
import type { CompletionRequest, CompletionResponse, LlmProvider } from "../src/index.js";
import { translatePostTranslation } from "../src/index.js";

class MockProvider implements LlmProvider {
  readonly requests: CompletionRequest[] = [];

  constructor(private readonly responses: Array<string | CompletionResponse>) {}

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.requests.push(request);
    const response = this.responses.shift();

    if (typeof response === "string") {
      return { content: response };
    }

    if (response) {
      return response;
    }

    return { content: request.messages.at(-1)?.content ?? "" };
  }
}

describe("translatePostTranslation", () => {
  it("returns the target locale shape for title, summary, contentMarkdown, and present SEO fields", async () => {
    const provider = new MockProvider([
      "Titre traduit",
      "Resume traduit",
      "Corps traduit.",
      "Titre SEO traduit",
      "Description SEO traduite"
    ]);

    const result = await translatePostTranslation({
      source: {
        locale: "en",
        title: "Translated title",
        summary: "Translated summary",
        contentMarkdown: "Body.",
        seoTitle: "SEO title",
        seoDescription: "SEO description"
      },
      targetLocale: "fr",
      providerClient: provider
    });

    expect(result).toEqual({
      locale: "fr",
      title: "Titre traduit",
      summary: "Resume traduit",
      contentMarkdown: "Corps traduit.",
      seoTitle: "Titre SEO traduit",
      seoDescription: "Description SEO traduite"
    });
    expect(provider.requests).toHaveLength(5);
  });

  it("passes source.locale and targetLocale through to every translation prompt", async () => {
    const provider = new MockProvider(["Target title", "Target summary", "Target body."]);

    await translatePostTranslation({
      source: {
        locale: "en-US",
        title: "Title",
        summary: "Summary",
        contentMarkdown: "Body."
      },
      targetLocale: "zh-Hant",
      providerClient: provider
    });

    expect(provider.requests).toHaveLength(3);
    for (const request of provider.requests) {
      const promptText = request.messages.map((message) => message.content).join("\n");
      expect(promptText).toContain("Source locale: en-US");
      expect(promptText).toContain("Target locale: zh-Hant");
    }
  });

  it("returns null for missing SEO fields without translating them", async () => {
    const provider = new MockProvider(["Titre", "Resume", "Corps."]);

    const result = await translatePostTranslation({
      source: {
        locale: "en",
        title: "Title",
        summary: "Summary",
        contentMarkdown: "Body.",
        seoTitle: null,
        seoDescription: undefined
      },
      targetLocale: "fr",
      providerClient: provider
    });

    expect(result.seoTitle).toBeNull();
    expect(result.seoDescription).toBeNull();
    expect(provider.requests).toHaveLength(3);
  });

  it("keeps contentMarkdown structure validation enabled while plain text fields skip it", async () => {
    const provider = new MockProvider([
      "[Guides](https://changed.example)",
      "Resume",
      "[Lien](https://changed.example)",
      "[Lien](https://example.com)"
    ]);

    const result = await translatePostTranslation({
      source: {
        locale: "en",
        title: "[Docs](https://example.com)",
        summary: "Summary",
        contentMarkdown: "[Link](https://example.com)"
      },
      targetLocale: "fr",
      providerClient: provider
    });

    expect(result.title).toBe("[Guides](https://changed.example)");
    expect(result.contentMarkdown).toBe("[Lien](https://example.com)");
    expect(provider.requests).toHaveLength(4);
  });
});
