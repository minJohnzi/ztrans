import matter from "gray-matter";
import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { TranslatorError } from "../errors.js";

export interface ParsedFrontmatter {
  content: string;
  data: Record<string, unknown>;
}

export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  try {
    const parsed = matter(markdown);
    return {
      content: parsed.content,
      data: parsed.data
    };
  } catch (error) {
    throw new TranslatorError("markdown_parse_failed", "Failed to parse Markdown frontmatter.", {
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

export function parseMarkdownAst(markdown: string): Root {
  try {
    return markdownProcessor().parse(markdown);
  } catch (error) {
    throw new TranslatorError("markdown_parse_failed", "Failed to parse Markdown.", {
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

export function stringifyMarkdownAst(tree: Root): string {
  return markdownProcessor().stringify(tree);
}

function markdownProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkStringify, {
      bullet: "-",
      emphasis: "_",
      fences: true,
      incrementListMarker: true,
      listItemIndent: "one",
      rule: "-",
      ruleRepetition: 3,
      strong: "*"
    });
}
