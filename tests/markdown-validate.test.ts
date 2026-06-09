import { describe, expect, it } from "vitest";
import {
  createStructureSignature,
  validateMarkdownStructure
} from "../src/markdown/validate.js";

describe("validateMarkdownStructure", () => {
  it("warns when heading count changes", () => {
    expect(validateMarkdownStructure("# One\n\n## Two", "# Uno")).toEqual([
      "Heading count changed: expected 2, received 1."
    ]);
  });

  it("warns when code block language signatures change", () => {
    expect(
      validateMarkdownStructure("```ts\nconst value = 1;\n```", "```js\nconst value = 1;\n```")
    ).toEqual(["Code block language changed at index 0: expected ts, received js."]);
  });

  it("warns when link URL count changes", () => {
    expect(
      validateMarkdownStructure(
        "[Docs](https://example.com/docs) and [API](https://example.com/api)",
        "[Docs](https://example.com/docs)"
      )
    ).toEqual(["Link count changed: expected 2, received 1."]);
  });

  it("warns when link URL signatures change", () => {
    expect(
      validateMarkdownStructure(
        "[Docs](https://example.com/docs)",
        "[Docs](https://example.com/reference)"
      )
    ).toEqual([
      "Link URL changed at index 0: expected https://example.com/docs, received https://example.com/reference."
    ]);
  });

  it("warns when image URL count changes", () => {
    expect(
      validateMarkdownStructure(
        "![One](./one.png)\n\n![Two](./two.png)",
        "![One](./one.png)"
      )
    ).toEqual(["Image count changed: expected 2, received 1."]);
  });

  it("warns when image URL signatures change", () => {
    expect(validateMarkdownStructure("![Diagram](./before.png)", "![Diagram](./after.png)")).toEqual([
      "Image URL changed at index 0: expected ./before.png, received ./after.png."
    ]);
  });

  it("warns when Markdown cannot be parsed", () => {
    expect(validateMarkdownStructure("---\ntitle: [broken\n---\n# Title", "# Title")).toEqual([
      expect.stringContaining("Source Markdown parse failed:")
    ]);
  });
});

describe("createStructureSignature", () => {
  it("uses frontmatter content rather than raw frontmatter markers", () => {
    const signature = createStructureSignature(
      [
        "---",
        "title: Parseable",
        "tags:",
        "  - stable",
        "draft: false",
        "---",
        "# Visible Heading",
        "",
        "[Docs](https://example.com/docs)",
        "![Diagram](./diagram.png)"
      ].join("\n")
    );

    expect(signature).toEqual({
      headings: [{ depth: 1 }],
      codeBlockLanguages: [],
      linkUrls: ["https://example.com/docs"],
      imageUrls: ["./diagram.png"]
    });
  });
});
