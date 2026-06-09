import { describe, expect, it } from "vitest";
import type { CompletionRequest, CompletionResponse, LlmProvider } from "../src/index.js";
import { translatePostTranslation } from "../src/index.js";

class PromptAwareProvider implements LlmProvider {
  readonly requests: CompletionRequest[] = [];
  private readonly responsesByFragment = new Map<string, Array<string | CompletionResponse>>();

  constructor(
    responsesByFragment: Record<
      string,
      Array<string | CompletionResponse> | string | CompletionResponse
    >,
  ) {
    for (const [fragment, responses] of Object.entries(responsesByFragment)) {
      this.responsesByFragment.set(
        fragment,
        Array.isArray(responses) ? [...responses] : [responses],
      );
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.requests.push(request);
    const fragment = extractMarkdownFragment(request);
    const responses = this.responsesByFragment.get(fragment);

    if (!responses) {
      throw new Error(`Unexpected translation request for fragment: ${JSON.stringify(fragment)}`);
    }

    const response = responses.shift();

    if (!response) {
      throw new Error(`No response left for fragment: ${JSON.stringify(fragment)}`);
    }

    if (typeof response === "string") {
      return { content: response };
    }

    return response;
  }
}

describe("translatePostTranslation", () => {
  it("returns the target locale shape and metadata for title, summary, contentMarkdown, and present SEO fields", async () => {
    const provider = new PromptAwareProvider({
      "Translated title": "Titre traduit",
      "Translated summary": "Resume traduit",
      "Body.": "Corps traduit.",
      "SEO title": "Titre SEO traduit",
      "SEO description": "Description SEO traduite",
    });

    const result = await translatePostTranslation({
      source: {
        locale: "en",
        title: "Translated title",
        summary: "Translated summary",
        contentMarkdown: "Body.",
        seoTitle: "SEO title",
        seoDescription: "SEO description",
      },
      targetLocale: "fr",
      providerClient: provider,
    });

    expect(result).toEqual({
      locale: "fr",
      title: "Titre traduit",
      summary: "Resume traduit",
      contentMarkdown: "Corps traduit.",
      seoTitle: "Titre SEO traduit",
      seoDescription: "Description SEO traduite",
      warnings: [],
      chunks: [expect.objectContaining({ index: 0, warnings: [] })],
    });
    expect(provider.requests).toHaveLength(5);
  });

  it("passes source.locale and targetLocale through to every translation prompt", async () => {
    const provider = new PromptAwareProvider({
      Title: "Target title",
      Summary: "Target summary",
      "Body.": "Target body.",
    });

    await translatePostTranslation({
      source: {
        locale: "en-US",
        title: "Title",
        summary: "Summary",
        contentMarkdown: "Body.",
      },
      targetLocale: "zh-Hant",
      providerClient: provider,
    });

    expect(provider.requests).toHaveLength(3);
    for (const request of provider.requests) {
      const promptText = request.messages.map((message) => message.content).join("\n");
      expect(promptText).toContain("Source locale: en-US");
      expect(promptText).toContain("Target locale: zh-Hant");
    }
  });

  it("returns null for missing SEO fields without translating them", async () => {
    const provider = new PromptAwareProvider({
      Title: "Titre",
      Summary: "Resume",
      "Body.": "Corps.",
    });

    const result = await translatePostTranslation({
      source: {
        locale: "en",
        title: "Title",
        summary: "Summary",
        contentMarkdown: "Body.",
        seoTitle: null,
        seoDescription: undefined,
      },
      targetLocale: "fr",
      providerClient: provider,
    });

    expect(result.seoTitle).toBeNull();
    expect(result.seoDescription).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(provider.requests).toHaveLength(3);
  });

  it("translates present SEO fields and does not generate missing SEO fields", async () => {
    const provider = new PromptAwareProvider({
      Title: "Titre",
      Summary: "Resume",
      "Body.": "Corps.",
      "SEO title": "Titre SEO",
    });

    const result = await translatePostTranslation({
      source: {
        locale: "en",
        title: "Title",
        summary: "Summary",
        contentMarkdown: "Body.",
        seoTitle: "SEO title",
      },
      targetLocale: "fr",
      providerClient: provider,
    });

    expect(result.seoTitle).toBe("Titre SEO");
    expect(result.seoDescription).toBeNull();
    expect(provider.requests.map(extractMarkdownFragment)).toEqual([
      "Title",
      "Summary",
      "Body.",
      "SEO title",
    ]);
  });

  it("keeps contentMarkdown structure validation enabled while plain text fields skip it", async () => {
    const provider = new PromptAwareProvider({
      "[Docs](https://example.com)": "[Guides](https://changed.example)",
      Summary: "Resume",
      "[Link](https://example.com)": [
        "[Lien](https://changed.example)",
        "[Lien](https://example.com)",
      ],
    });

    const result = await translatePostTranslation({
      source: {
        locale: "en",
        title: "[Docs](https://example.com)",
        summary: "Summary",
        contentMarkdown: "[Link](https://example.com)",
      },
      targetLocale: "fr",
      providerClient: provider,
    });

    expect(result.title).toBe("[Guides](https://changed.example)");
    expect(result.contentMarkdown).toBe("[Lien](https://example.com)");
    expect(provider.requests.map(extractMarkdownFragment)).toEqual([
      "[Docs](https://example.com)",
      "Summary",
      "[Link](https://example.com)",
      "[Link](https://example.com)",
    ]);
  });

  it("returns contentMarkdown validation warnings when retries are exhausted", async () => {
    const provider = new PromptAwareProvider({
      Title: "Titre",
      Summary: "Resume",
      "[Link](https://example.com)": [
        "[Lien](https://changed.example)",
        "[Lien](https://still-changed.example)",
      ],
    });

    const result = await translatePostTranslation({
      source: {
        locale: "en",
        title: "Title",
        summary: "Summary",
        contentMarkdown: "[Link](https://example.com)",
      },
      targetLocale: "fr",
      providerClient: provider,
    });

    expect(result.contentMarkdown).toBe("[Lien](https://still-changed.example)");
    expect(result.warnings).toEqual([
      "Chunk 0 validation failed: Link URL changed at index 0: expected https://example.com, received https://still-changed.example.",
    ]);
    expect(result.chunks).toEqual([
      expect.objectContaining({
        index: 0,
        warnings: [
          "Link URL changed at index 0: expected https://example.com, received https://still-changed.example.",
        ],
      }),
    ]);
  });
});

function extractMarkdownFragment(request: CompletionRequest): string {
  const promptText = request.messages.map((message) => message.content).join("\n");
  const marker = "Markdown fragment JSON:\n";
  const start = promptText.indexOf(marker);

  if (start === -1) {
    throw new Error("Expected prompt to include Markdown fragment JSON marker.");
  }

  return (JSON.parse(promptText.slice(start + marker.length).trim()) as string).trimEnd();
}
