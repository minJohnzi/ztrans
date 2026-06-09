import { describe, expect, it } from "vitest";
import { chunkMarkdown } from "../src/markdown/chunk.js";

describe("chunkMarkdown", () => {
  it("keeps fenced code blocks inside a single chunk even with low maxChars", () => {
    const chunks = chunkMarkdown(
      [
        "# Example",
        "",
        "Before.",
        "",
        "```ts",
        "const first = 1;",
        "const second = 2;",
        "```",
        "",
        "After."
      ].join("\n"),
      { maxChars: 20 }
    );

    const codeChunk = chunks.find((chunk) => chunk.markdown.includes("```ts"));

    expect(codeChunk?.markdown).toContain("const first = 1;");
    expect(codeChunk?.markdown).toContain("const second = 2;");
    expect(codeChunk?.markdown).toContain("```");
  });

  it("tracks heading path", () => {
    const chunks = chunkMarkdown(
      ["# Article", "", "Intro.", "", "## Section", "", "Body text.", "", "### Detail", "", "More text."].join(
        "\n"
      ),
      { maxChars: 25 }
    );

    expect(chunks.find((chunk) => chunk.markdown.includes("# Article"))?.headingPath).toEqual(["Article"]);
    expect(chunks.find((chunk) => chunk.markdown.includes("Body text."))?.headingPath).toEqual([
      "Article",
      "Section"
    ]);
    expect(chunks.find((chunk) => chunk.markdown.includes("More text."))?.headingPath).toEqual([
      "Article",
      "Section",
      "Detail"
    ]);
  });

  it("does not split GFM tables", () => {
    const chunks = chunkMarkdown(
      [
        "# Metrics",
        "",
        "| Name | Value |",
        "| --- | --- |",
        "| Alpha | 1 |",
        "| Beta | 2 |",
        "",
        "Done."
      ].join("\n"),
      { maxChars: 20 }
    );

    const tableChunk = chunks.find((chunk) => chunk.markdown.includes("Alpha"));

    expect(tableChunk?.markdown).toContain("| Name");
    expect(tableChunk?.markdown).toContain("Beta");
  });

  it("preserves chunk order", () => {
    const chunks = chunkMarkdown(
      ["# One", "", "First paragraph.", "", "## Two", "", "Second paragraph.", "", "## Three", "", "Third paragraph."].join(
        "\n"
      ),
      { maxChars: 30 }
    );

    const combinedMarkdown = chunks.map((chunk) => chunk.markdown.trim()).join("\n\n");

    expect(combinedMarkdown.indexOf("# One")).toBeLessThan(combinedMarkdown.indexOf("First paragraph."));
    expect(combinedMarkdown.indexOf("First paragraph.")).toBeLessThan(combinedMarkdown.indexOf("## Two"));
    expect(combinedMarkdown.indexOf("## Two")).toBeLessThan(combinedMarkdown.indexOf("Second paragraph."));
    expect(combinedMarkdown.indexOf("Second paragraph.")).toBeLessThan(combinedMarkdown.indexOf("## Three"));
    expect(combinedMarkdown.indexOf("## Three")).toBeLessThan(combinedMarkdown.indexOf("Third paragraph."));
    expect(chunks.map((chunk) => chunk.index)).toEqual(chunks.map((_, index) => index));
  });

  it("handles empty markdown deterministically", () => {
    expect(chunkMarkdown("", { maxChars: 100 })).toEqual([]);
  });
});
