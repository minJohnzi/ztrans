import type { Code, Heading, Image, Link, Nodes, Root } from "mdast";
import { TranslatorError } from "../errors.js";
import { parseFrontmatter, parseMarkdownAst } from "./parse.js";

export interface HeadingSignature {
  depth: number;
}

export interface MarkdownStructureSignature {
  headings: HeadingSignature[];
  codeBlockLanguages: string[];
  linkUrls: string[];
  imageUrls: string[];
}

export function createStructureSignature(markdown: string): MarkdownStructureSignature {
  const parsed = parseFrontmatter(markdown);
  const tree = parseMarkdownAst(parsed.content);

  return createSignatureFromAst(tree);
}

export function validateMarkdownStructure(source: string, translated: string): string[] {
  const sourceSignature = safeCreateStructureSignature(source, "Source");
  const translatedSignature = safeCreateStructureSignature(translated, "Translated");

  if (!sourceSignature.ok) {
    return [sourceSignature.warning];
  }

  if (!translatedSignature.ok) {
    return [translatedSignature.warning];
  }

  const warnings: string[] = [];

  compareCounts(warnings, "Heading", sourceSignature.value.headings, translatedSignature.value.headings);
  compareCounts(
    warnings,
    "Code block",
    sourceSignature.value.codeBlockLanguages,
    translatedSignature.value.codeBlockLanguages
  );
  compareCounts(warnings, "Link", sourceSignature.value.linkUrls, translatedSignature.value.linkUrls);
  compareCounts(warnings, "Image", sourceSignature.value.imageUrls, translatedSignature.value.imageUrls);

  compareIndexedValues(
    warnings,
    "Code block language",
    sourceSignature.value.codeBlockLanguages,
    translatedSignature.value.codeBlockLanguages
  );
  compareIndexedValues(warnings, "Link URL", sourceSignature.value.linkUrls, translatedSignature.value.linkUrls);
  compareIndexedValues(warnings, "Image URL", sourceSignature.value.imageUrls, translatedSignature.value.imageUrls);

  return warnings;
}

type SignatureResult =
  | { ok: true; value: MarkdownStructureSignature }
  | { ok: false; warning: string };

function safeCreateStructureSignature(markdown: string, label: "Source" | "Translated"): SignatureResult {
  try {
    return { ok: true, value: createStructureSignature(markdown) };
  } catch (error) {
    return {
      ok: false,
      warning: `${label} Markdown parse failed: ${formatParseError(error)}`
    };
  }
}

function createSignatureFromAst(tree: Root): MarkdownStructureSignature {
  const signature: MarkdownStructureSignature = {
    headings: [],
    codeBlockLanguages: [],
    linkUrls: [],
    imageUrls: []
  };

  visit(tree, (node) => {
    if (isHeading(node)) {
      signature.headings.push({ depth: node.depth });
      return;
    }

    if (isCode(node)) {
      signature.codeBlockLanguages.push(node.lang ?? "");
      return;
    }

    if (isLink(node)) {
      signature.linkUrls.push(node.url);
      return;
    }

    if (isImage(node)) {
      signature.imageUrls.push(node.url);
    }
  });

  return signature;
}

function visit(node: Nodes, visitor: (node: Nodes) => void): void {
  visitor(node);

  if (!hasChildren(node)) {
    return;
  }

  for (const child of node.children) {
    visit(child, visitor);
  }
}

type NodeWithChildren = Nodes & { children: Nodes[] };

function hasChildren(node: Nodes): node is NodeWithChildren {
  return "children" in node && Array.isArray(node.children);
}

function isHeading(node: Nodes): node is Heading {
  return node.type === "heading";
}

function isCode(node: Nodes): node is Code {
  return node.type === "code";
}

function isLink(node: Nodes): node is Link {
  return node.type === "link";
}

function isImage(node: Nodes): node is Image {
  return node.type === "image";
}

function compareCounts<T>(
  warnings: string[],
  label: "Heading" | "Code block" | "Link" | "Image",
  expected: T[],
  received: T[]
): void {
  if (expected.length !== received.length) {
    warnings.push(`${label} count changed: expected ${expected.length}, received ${received.length}.`);
  }
}

function compareIndexedValues(
  warnings: string[],
  label: "Code block language" | "Link URL" | "Image URL",
  expected: string[],
  received: string[]
): void {
  const comparableLength = Math.min(expected.length, received.length);

  for (let index = 0; index < comparableLength; index += 1) {
    if (expected[index] !== received[index]) {
      warnings.push(
        `${label} changed at index ${index}: expected ${formatSignatureValue(
          expected[index]
        )}, received ${formatSignatureValue(received[index])}.`
      );
    }
  }
}

function formatSignatureValue(value: string): string {
  return value || "(none)";
}

function formatParseError(error: unknown): string {
  if (error instanceof TranslatorError) {
    return error.message;
  }

  return error instanceof Error ? error.message : String(error);
}
