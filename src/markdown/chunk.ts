import type { Heading, PhrasingContent, Root, RootContent } from "mdast";
import { parseFrontmatter, parseMarkdownAst, stringifyMarkdownAst } from "./parse.js";

export interface ChunkMarkdownOptions {
  maxChars: number;
}

export interface MarkdownChunk {
  index: number;
  markdown: string;
  headingPath: string[];
}

interface PendingChunk {
  nodes: RootContent[];
  headingPath: string[];
}

export function chunkMarkdown(markdown: string, options: ChunkMarkdownOptions): MarkdownChunk[] {
  const parsed = parseFrontmatter(markdown);
  const tree = parseMarkdownAst(parsed.content);
  const chunks: MarkdownChunk[] = [];
  let pending: PendingChunk | undefined;
  let headingPath: string[] = [];

  for (const node of tree.children) {
    if (isHeading(node)) {
      if (pending) {
        chunks.push(createChunk(chunks.length, pending));
        pending = undefined;
      }

      headingPath = updateHeadingPath(headingPath, node);
    }

    const pendingMarkdown = pending ? stringifyNodes([...pending.nodes, node]) : stringifyNodes([node]);

    if (pending && pendingMarkdown.length > options.maxChars) {
      chunks.push(createChunk(chunks.length, pending));
      pending = undefined;
    }

    if (!pending) {
      pending = {
        nodes: [node],
        headingPath: [...headingPath]
      };
      continue;
    }

    pending.nodes.push(node);
  }

  if (pending) {
    chunks.push(createChunk(chunks.length, pending));
  }

  return chunks;
}

function createChunk(index: number, chunk: PendingChunk): MarkdownChunk {
  return {
    index,
    markdown: stringifyNodes(chunk.nodes),
    headingPath: chunk.headingPath
  };
}

function stringifyNodes(children: RootContent[]): string {
  const tree: Root = {
    type: "root",
    children
  };

  return stringifyMarkdownAst(tree);
}

function updateHeadingPath(currentPath: string[], heading: Heading): string[] {
  const nextPath = currentPath.slice(0, heading.depth - 1);
  nextPath[heading.depth - 1] = headingText(heading.children);
  return nextPath;
}

function headingText(children: PhrasingContent[]): string {
  return children.map((child) => phrasingText(child)).join("").trim();
}

function phrasingText(node: PhrasingContent): string {
  if ("value" in node && typeof node.value === "string") {
    return node.value;
  }

  if ("alt" in node && typeof node.alt === "string") {
    return node.alt;
  }

  if ("children" in node) {
    return node.children.map((child) => phrasingText(child)).join("");
  }

  return "";
}

function isHeading(node: RootContent): node is Heading {
  return node.type === "heading";
}
