import { translateMarkdown } from "../translate/translateMarkdown.js";
import type { Locale, TranslateMarkdownOptions } from "../types.js";

export interface TwoRiverPostTranslation {
  locale: Locale;
  title: string;
  summary: string;
  contentMarkdown: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface TranslatePostTranslationOptions
  extends Omit<TranslateMarkdownOptions, "markdown" | "sourceLocale" | "targetLocale"> {
  source: TwoRiverPostTranslation;
  targetLocale: Locale;
}

export interface TranslatePostTranslationResult {
  locale: Locale;
  title: string;
  summary: string;
  contentMarkdown: string;
  seoTitle: string | null;
  seoDescription: string | null;
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

  return {
    locale: targetLocale,
    title,
    summary,
    contentMarkdown: contentMarkdown.markdown,
    seoTitle,
    seoDescription
  };
}

async function translatePlainText(
  markdown: string,
  options: Omit<TranslateMarkdownOptions, "markdown">
): Promise<string> {
  const result = await translateMarkdown({
    ...options,
    markdown,
    validateStructure: false
  });

  return result.markdown;
}
