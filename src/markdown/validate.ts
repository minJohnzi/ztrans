import type { Code, Heading, Image, InlineCode, Link, Nodes, Root } from "mdast";
import { TranslatorError } from "../errors.js";
import { parseFrontmatter, parseMarkdownAst } from "./parse.js";

export interface HeadingSignature {
  depth: number;
}

export type FrontmatterValue =
  | string
  | number
  | boolean
  | null
  | FrontmatterValue[]
  | { [key: string]: FrontmatterValue };

export interface FrontmatterSignature {
  present: boolean;
  data: Record<string, FrontmatterValue>;
}

export interface MarkdownStructureSignature {
  frontmatter: FrontmatterSignature;
  headings: HeadingSignature[];
  codeBlockLanguages: string[];
  inlineCodeValues: string[];
  linkUrls: string[];
  imageUrls: string[];
}

export function createStructureSignature(markdown: string): MarkdownStructureSignature {
  const parsed = parseFrontmatter(markdown);
  const tree = parseMarkdownAst(parsed.content);

  return createSignatureFromAst(tree, {
    present: parsed.present,
    data: normalizeFrontmatterData(parsed.data),
  });
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

  compareFrontmatter(
    warnings,
    sourceSignature.value.frontmatter,
    translatedSignature.value.frontmatter,
  );
  compareCounts(
    warnings,
    "Heading",
    sourceSignature.value.headings,
    translatedSignature.value.headings,
  );
  compareHeadingDepths(
    warnings,
    sourceSignature.value.headings,
    translatedSignature.value.headings,
  );
  compareCounts(
    warnings,
    "Code block",
    sourceSignature.value.codeBlockLanguages,
    translatedSignature.value.codeBlockLanguages,
  );
  compareIndexedValues(
    warnings,
    "Code block language",
    sourceSignature.value.codeBlockLanguages,
    translatedSignature.value.codeBlockLanguages,
  );
  compareCounts(
    warnings,
    "Inline code",
    sourceSignature.value.inlineCodeValues,
    translatedSignature.value.inlineCodeValues,
  );
  compareIndexedValues(
    warnings,
    "Inline code",
    sourceSignature.value.inlineCodeValues,
    translatedSignature.value.inlineCodeValues,
  );
  compareCounts(
    warnings,
    "Link",
    sourceSignature.value.linkUrls,
    translatedSignature.value.linkUrls,
  );
  compareIndexedValues(
    warnings,
    "Link URL",
    sourceSignature.value.linkUrls,
    translatedSignature.value.linkUrls,
  );
  compareCounts(
    warnings,
    "Image",
    sourceSignature.value.imageUrls,
    translatedSignature.value.imageUrls,
  );
  compareIndexedValues(
    warnings,
    "Image URL",
    sourceSignature.value.imageUrls,
    translatedSignature.value.imageUrls,
  );

  return warnings;
}

type SignatureResult =
  | { ok: true; value: MarkdownStructureSignature }
  | { ok: false; warning: string };

function safeCreateStructureSignature(
  markdown: string,
  label: "Source" | "Translated",
): SignatureResult {
  try {
    return { ok: true, value: createStructureSignature(markdown) };
  } catch (error) {
    return {
      ok: false,
      warning: `${label} Markdown parse failed: ${formatParseError(error)}`,
    };
  }
}

function createSignatureFromAst(
  tree: Root,
  frontmatter: FrontmatterSignature,
): MarkdownStructureSignature {
  const signature: MarkdownStructureSignature = {
    frontmatter,
    headings: [],
    codeBlockLanguages: [],
    inlineCodeValues: [],
    linkUrls: [],
    imageUrls: [],
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

    if (isInlineCode(node)) {
      signature.inlineCodeValues.push(node.value);
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

function isInlineCode(node: Nodes): node is InlineCode {
  return node.type === "inlineCode";
}

function isLink(node: Nodes): node is Link {
  return node.type === "link";
}

function isImage(node: Nodes): node is Image {
  return node.type === "image";
}

function compareCounts<T>(
  warnings: string[],
  label: "Heading" | "Code block" | "Inline code" | "Link" | "Image",
  expected: T[],
  received: T[],
): void {
  if (expected.length !== received.length) {
    warnings.push(
      `${label} count changed: expected ${expected.length}, received ${received.length}.`,
    );
  }
}

function compareIndexedValues(
  warnings: string[],
  label: "Code block language" | "Inline code" | "Link URL" | "Image URL",
  expected: string[],
  received: string[],
): void {
  const comparableLength = Math.min(expected.length, received.length);

  for (let index = 0; index < comparableLength; index += 1) {
    if (expected[index] !== received[index]) {
      warnings.push(
        `${label} changed at index ${index}: expected ${formatSignatureValue(
          expected[index],
        )}, received ${formatSignatureValue(received[index])}.`,
      );
    }
  }
}

function compareFrontmatter(
  warnings: string[],
  expected: FrontmatterSignature,
  received: FrontmatterSignature,
): void {
  if (expected.present !== received.present) {
    warnings.push(
      `Frontmatter presence changed: expected ${formatPresence(expected.present)}, received ${formatPresence(
        received.present,
      )}.`,
    );
    return;
  }

  if (!expected.present) {
    return;
  }

  for (const key of Object.keys(expected.data).sort()) {
    if (!(key in received.data)) {
      warnings.push(`Frontmatter key missing: ${key}.`);
      continue;
    }

    if (!frontmatterValuesEqual(expected.data[key], received.data[key])) {
      warnings.push(
        `Frontmatter value changed for key ${key}: expected ${formatFrontmatterValue(
          expected.data[key],
        )}, received ${formatFrontmatterValue(received.data[key])}.`,
      );
    }
  }

  for (const key of Object.keys(received.data).sort()) {
    if (!(key in expected.data)) {
      warnings.push(`Frontmatter key added: ${key}.`);
    }
  }
}

function compareHeadingDepths(
  warnings: string[],
  expected: HeadingSignature[],
  received: HeadingSignature[],
): void {
  const comparableLength = Math.min(expected.length, received.length);

  for (let index = 0; index < comparableLength; index += 1) {
    if (expected[index].depth !== received[index].depth) {
      warnings.push(
        `Heading depth changed at index ${index}: expected ${expected[index].depth}, received ${received[index].depth}.`,
      );
    }
  }
}

function formatSignatureValue(value: string): string {
  return value || "(none)";
}

function formatPresence(present: boolean): "present" | "absent" {
  return present ? "present" : "absent";
}

function normalizeFrontmatterData(data: Record<string, unknown>): Record<string, FrontmatterValue> {
  const normalized: Record<string, FrontmatterValue> = {};

  for (const key of Object.keys(data).sort()) {
    normalized[key] = normalizeFrontmatterValue(data[key]);
  }

  return normalized;
}

function normalizeFrontmatterValue(value: unknown): FrontmatterValue {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeFrontmatterValue(item));
  }

  if (isPlainObject(value)) {
    const normalized: Record<string, FrontmatterValue> = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = normalizeFrontmatterValue(value[key]);
    }
    return normalized;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  return String(value);
}

function frontmatterValuesEqual(expected: FrontmatterValue, received: FrontmatterValue): boolean {
  return formatFrontmatterValue(expected) === formatFrontmatterValue(received);
}

function formatFrontmatterValue(value: FrontmatterValue): string {
  return JSON.stringify(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function formatParseError(error: unknown): string {
  if (error instanceof TranslatorError) {
    return error.message;
  }

  return error instanceof Error ? error.message : String(error);
}
