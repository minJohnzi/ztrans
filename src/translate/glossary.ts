import { parseStructuredFile, assertPlainObject, throwInvalidConfig } from "../config/loadConfig.js";
import type { GlossaryTerm } from "../types.js";

const ASCII_CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export async function loadGlossaryFile(filePath?: string): Promise<GlossaryTerm[]> {
  if (!filePath) {
    return [];
  }

  const parsed = await parseStructuredFile(filePath);
  assertPlainObject(parsed, "Glossary file must contain an object.");

  if (!Array.isArray(parsed.terms)) {
    throwInvalidConfig("Glossary file must contain a terms array.", filePath);
  }

  return parsed.terms.map(parseGlossaryTerm);
}

export function renderGlossaryForPrompt(terms: GlossaryTerm[] = []): string {
  if (terms.length === 0) {
    return "No glossary entries.";
  }

  return terms.map(normalizeGlossaryTerm).map(renderGlossaryTerm).join("\n");
}

function renderGlossaryTerm(term: GlossaryTerm): string {
  const note = meaningfulString(term.note);
  const renderedTerm = `${term.source} => ${term.target}`;

  return note ? `${renderedTerm} (${note})` : renderedTerm;
}

function parseGlossaryTerm(value: unknown): GlossaryTerm {
  assertPlainObject(value, "Glossary term must contain an object.");

  return normalizeGlossaryTerm(value);
}

function normalizeGlossaryTerm(value: {
  source?: unknown;
  target?: unknown;
  note?: unknown;
}): GlossaryTerm {
  const source = requiredString(value.source, "terms.source");
  const target = requiredString(value.target, "terms.target");
  const note = optionalString(value.note, "terms.note");

  return note === undefined ? { source, target } : { source, target, note };
}

function requiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throwInvalidConfig(`Glossary field ${fieldName} must be a non-empty string.`);
  }

  const normalized = normalizePromptField(value, fieldName);
  if (normalized.length === 0) {
    throwInvalidConfig(`Glossary field ${fieldName} must be a non-empty string.`);
  }

  return normalized;
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throwInvalidConfig(`Glossary field ${fieldName} must be a string.`);
  }

  return meaningfulString(normalizePromptField(value, fieldName));
}

function meaningfulString(value: string | undefined): string | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

function normalizePromptField(value: string, fieldName: string): string {
  if (ASCII_CONTROL_CHARACTER_PATTERN.test(value)) {
    throwInvalidConfig(
      `Glossary field ${fieldName} must be a single-line prompt-safe string.`
    );
  }

  return value.trim();
}
