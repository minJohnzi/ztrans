import { describe, expect, it } from "vitest";
import { createStructureSignature, validateMarkdownStructure } from "../src/markdown/validate.js";

describe("validateMarkdownStructure", () => {
  it("warns when source frontmatter is dropped", () => {
    expect(validateMarkdownStructure("---\nslug: original\n---\n# Title", "# Title")).toEqual([
      "Frontmatter presence changed: expected present, received absent.",
    ]);
  });

  it("warns when non-translatable frontmatter values change", () => {
    const source = [
      "---",
      "slug: stable-post",
      "date: 2026-06-09",
      "tags:",
      "  - api",
      "  - markdown",
      "category: engineering",
      "---",
      "# Title",
    ].join("\n");
    const translated = [
      "---",
      "slug: translated-post",
      "date: 2026-06-10",
      "tags:",
      "  - markdown",
      "  - api",
      "category: docs",
      "---",
      "# Title",
    ].join("\n");

    expect(validateMarkdownStructure(source, translated)).toEqual([
      'Frontmatter value changed for key category: expected "engineering", received "docs".',
      'Frontmatter value changed for key date: expected "2026-06-09T00:00:00.000Z", received "2026-06-10T00:00:00.000Z".',
      'Frontmatter value changed for key slug: expected "stable-post", received "translated-post".',
      'Frontmatter value changed for key tags: expected ["api","markdown"], received ["markdown","api"].',
    ]);
  });

  it("warns when a source frontmatter key is missing", () => {
    expect(
      validateMarkdownStructure(
        "---\nslug: stable-post\ncategory: engineering\n---\n# Title",
        "---\nslug: stable-post\n---\n# Title",
      ),
    ).toEqual(["Frontmatter key missing: category."]);
  });

  it("warns when translated frontmatter adds a key", () => {
    expect(
      validateMarkdownStructure(
        "---\nslug: stable-post\n---\n# Title",
        "---\nslug: stable-post\nreviewed: true\ndraft: false\n---\n# Title",
      ),
    ).toEqual(["Frontmatter key added: draft.", "Frontmatter key added: reviewed."]);
  });

  it("warns when heading count changes", () => {
    expect(validateMarkdownStructure("# One\n\n## Two", "# Uno")).toEqual([
      "Heading count changed: expected 2, received 1.",
    ]);
  });

  it("warns when heading depth changes", () => {
    expect(validateMarkdownStructure("# Title", "## Title")).toEqual([
      "Heading depth changed at index 0: expected 1, received 2.",
    ]);
  });

  it("warns when code block language signatures change", () => {
    expect(
      validateMarkdownStructure("```ts\nconst value = 1;\n```", "```js\nconst value = 1;\n```"),
    ).toEqual(["Code block language changed at index 0: expected ts, received js."]);
  });

  it("warns when inline code count changes", () => {
    expect(
      validateMarkdownStructure("Run `pnpm install` before `pnpm test`.", "Run `pnpm install`."),
    ).toEqual(["Inline code count changed: expected 2, received 1."]);
  });

  it("warns when inline code values change", () => {
    expect(
      validateMarkdownStructure("Use `user_id` in queries.", "Use `userId` in queries."),
    ).toEqual(["Inline code changed at index 0: expected user_id, received userId."]);
  });

  it("warns when link URL count changes", () => {
    expect(
      validateMarkdownStructure(
        "[Docs](https://example.com/docs) and [API](https://example.com/api)",
        "[Docs](https://example.com/docs)",
      ),
    ).toEqual(["Link count changed: expected 2, received 1."]);
  });

  it("warns when link URL signatures change", () => {
    expect(
      validateMarkdownStructure(
        "[Docs](https://example.com/docs)",
        "[Docs](https://example.com/reference)",
      ),
    ).toEqual([
      "Link URL changed at index 0: expected https://example.com/docs, received https://example.com/reference.",
    ]);
  });

  it("warns when image URL count changes", () => {
    expect(
      validateMarkdownStructure("![One](./one.png)\n\n![Two](./two.png)", "![One](./one.png)"),
    ).toEqual(["Image count changed: expected 2, received 1."]);
  });

  it("warns when image URL signatures change", () => {
    expect(
      validateMarkdownStructure("![Diagram](./before.png)", "![Diagram](./after.png)"),
    ).toEqual(["Image URL changed at index 0: expected ./before.png, received ./after.png."]);
  });

  it("warns when Markdown cannot be parsed", () => {
    expect(validateMarkdownStructure("---\ntitle: [broken\n---\n# Title", "# Title")).toEqual([
      expect.stringContaining("Source Markdown parse failed:"),
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
        "![Diagram](./diagram.png)",
      ].join("\n"),
    );

    expect(signature).toEqual({
      frontmatter: {
        present: true,
        data: {
          draft: false,
          tags: ["stable"],
          title: "Parseable",
        },
      },
      headings: [{ depth: 1 }],
      codeBlockLanguages: [],
      inlineCodeValues: [],
      linkUrls: ["https://example.com/docs"],
      imageUrls: ["./diagram.png"],
    });
  });
});
