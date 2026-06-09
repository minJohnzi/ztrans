import { describe, expect, it } from "vitest";
import type { CompletionRequest, CompletionResponse, LlmProvider } from "../src/index.js";
import { createTranslator, translateMarkdown } from "../src/index.js";

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

describe("translateMarkdown", () => {
  it("translates Markdown chunks and returns metadata with aggregated usage", async () => {
    const provider = new MockProvider([
      {
        content: "# Titre\n",
        usage: { promptTokens: 10, completionTokens: 4, totalTokens: 14 }
      },
      {
        content: "Corps.\n",
        usage: { promptTokens: 8, completionTokens: 3, totalTokens: 11 }
      }
    ]);

    const result = await translateMarkdown({
      markdown: "# Title\n\nBody.",
      sourceLocale: "en",
      targetLocale: "fr",
      providerClient: provider,
      maxChunkChars: 20
    });

    expect(result.markdown).toBe("# Titre\n\nCorps.");
    expect(result).toMatchObject({
      sourceLocale: "en",
      targetLocale: "fr",
      warnings: [],
      usage: { promptTokens: 18, completionTokens: 7, totalTokens: 25 }
    });
    expect(result.chunks).toEqual([
      { index: 0, inputChars: 8, outputChars: 7, warnings: [] },
      { index: 1, inputChars: 6, outputChars: 6, warnings: [] }
    ]);
    expect(provider.requests).toHaveLength(2);
  });

  it("returns validation warnings when retries are exhausted", async () => {
    const provider = new MockProvider(["# Titre\n", "[broken](https://changed.example)\n"]);

    const result = await translateMarkdown({
      markdown: "# Title\n\n[link](https://example.com)",
      targetLocale: "fr",
      providerClient: provider,
      retryOnValidationFailure: false
    });

    expect(provider.requests).toHaveLength(2);
    expect(result.warnings).toContain(
      "Chunk 1 validation failed: Link URL changed at index 0: expected https://example.com, received https://changed.example."
    );
    expect(result.chunks[1]?.warnings).toContain(
      "Link URL changed at index 0: expected https://example.com, received https://changed.example."
    );
  });

  it("cleans fenced markdown output through orchestration", async () => {
    const provider = new MockProvider(["```markdown\n# Titre\n```", "```markdown\nCorps.\n```"]);

    const result = await translateMarkdown({
      markdown: "# Title\n\nBody.",
      targetLocale: "fr",
      providerClient: provider
    });

    expect(result.markdown).toBe("# Titre\n\nCorps.");
  });

  it("preserves frontmatter and does not send it to the provider", async () => {
    const provider = new MockProvider(["# Titre\n"]);

    const result = await translateMarkdown({
      markdown: "---\ntitle: Original\nslug: original\n---\n# Title",
      targetLocale: "fr",
      providerClient: provider
    });

    expect(result.markdown).toBe("---\ntitle: Original\nslug: original\n---\n# Titre");
    expect(provider.requests).toHaveLength(1);
    expect(JSON.stringify(provider.requests[0])).not.toContain("slug: original");
    expect(JSON.stringify(provider.requests[0])).not.toContain("title: Original");
  });

  it("createTranslator applies defaults without mutating options", async () => {
    const provider = new MockProvider(["# Titre\n"]);
    const defaults = {
      sourceLocale: "en",
      targetLocale: "fr",
      providerClient: provider,
      styleGuide: "Use concise Simplified Chinese."
    } as const;
    const translator = createTranslator(defaults);
    const options = { markdown: "# Title" };

    const result = await translator(options);

    expect(result.sourceLocale).toBe("en");
    expect(result.targetLocale).toBe("fr");
    expect(options).toEqual({ markdown: "# Title" });
    expect(provider.requests[0]?.messages.map((message) => message.content).join("\n")).toContain(
      "Use concise Simplified Chinese."
    );
  });

  it("includes glossary, style guide, heading path, locales, and fragment in prompts", async () => {
    const provider = new MockProvider(["Corps.\n"]);

    await translateMarkdown({
      markdown: "# Article\n\n## Setup\n\nUse API keys.",
      sourceLocale: "en",
      targetLocale: "fr",
      providerClient: provider,
      maxChunkChars: 25,
      glossary: [{ source: "API key", target: "cle API", note: "Keep API uppercase." }],
      styleGuide: "Prefer developer documentation tone."
    });

    const promptText = provider.requests.at(-1)?.messages.map((message) => message.content).join("\n");

    expect(promptText).toContain("Source locale: en");
    expect(promptText).toContain("Target locale: fr");
    expect(promptText).toContain("Heading path: Article > Setup");
    expect(promptText).toContain("API key");
    expect(promptText).toContain("cle API");
    expect(promptText).toContain("Prefer developer documentation tone.");
    expect(promptText).toContain("Use API keys.");
  });
});
