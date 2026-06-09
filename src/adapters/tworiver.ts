import { translateMarkdown } from "../translate/translateMarkdown.js";
import type {
  ChunkResult,
  Locale,
  TranslateMarkdownOptions,
  TranslateMarkdownResult
} from "../types.js";

export interface TwoRiverPostTranslation {
  locale: Locale;
  title: string;
  summary: string;
  contentMarkdown: string;
  /**
   * Optional SEO title. When present, it is translated independently.
   * Missing or null SEO fields are not generated and are returned as null.
   */
  seoTitle?: string | null;
  /**
   * Optional SEO description. When present, it is translated independently.
   * Missing or null SEO fields are not generated and are returned as null.
   */
  seoDescription?: string | null;
}

export interface TranslatePostTranslationOptions
  extends Omit<TranslateMarkdownOptions, "markdown" | "sourceLocale" | "targetLocale"> {
  source: TwoRiverPostTranslation;
  targetLocale: Locale;
}

/**
 * Translated TwoRiver post shape plus validation metadata from underlying
 * Markdown translation calls. SEO fields are conservative: non-null source SEO
 * fields are translated, while missing or null source SEO fields are not
 * generated and return null.
 */
export interface TranslatePostTranslationResult extends TwoRiverPostTranslation {
  seoTitle: string | null;
  seoDescription: string | null;
  warnings: string[];
  chunks: ChunkResult[];
}

export async function translatePostTranslation(
  options: TranslatePostTranslationOptions
): Promise<TranslatePostTranslationResult> {
  const { source, targetLocale, ...translationOptions } = options;
  const commonOptions = {
    ...translationOptions,
    sourceLocale: source.locale,
    targetLocale
  };

  const title = await translatePlainText(source.title, commonOptions);
  const summary = await translatePlainText(source.summary, commonOptions);
  const contentMarkdown = await translateMarkdown({
    ...commonOptions,
    markdown: source.contentMarkdown
  });
  const seoTitle =
    source.seoTitle == null ? null : await translatePlainText(source.seoTitle, commonOptions);
  const seoDescription =
    source.seoDescription == null
      ? null
      : await translatePlainText(source.seoDescription, commonOptions);
  const translatedFields = [
    title,
    summary,
    contentMarkdown,
    ...(seoTitle ? [seoTitle] : []),
    ...(seoDescription ? [seoDescription] : [])
  ];

  return {
    locale: targetLocale,
    title: title.markdown,
    summary: summary.markdown,
    contentMarkdown: contentMarkdown.markdown,
    seoTitle: seoTitle?.markdown ?? null,
    seoDescription: seoDescription?.markdown ?? null,
    warnings: translatedFields.flatMap((result) => result.warnings),
    chunks: contentMarkdown.chunks
  };
}

async function translatePlainText(
  markdown: string,
  options: Omit<TranslateMarkdownOptions, "markdown">
): Promise<TranslateMarkdownResult> {
  return translateMarkdown({
    ...options,
    markdown,
    validateStructure: false
  });
}
