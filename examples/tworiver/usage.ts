import { translatePostTranslation } from "md-bilingual-translator";

const result = await translatePostTranslation({
  source: {
    locale: "zh",
    title: "发布控制台更新",
    summary: "TwoRiver 编辑团队的发布流程说明。",
    contentMarkdown: "## 发布控制台\n\nFastify 服务读取 SQLite 内容索引。",
    seoTitle: "TwoRiver 发布控制台",
    seoDescription: null,
  },
  targetLocale: "en",
  provider: {
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
  },
  glossary: [
    { source: "TwoRiver", target: "TwoRiver", note: "Product name; do not translate." },
    { source: "发布控制台", target: "publishing console" },
  ],
});

console.log(result.title);
console.log(result.seoDescription); // null; missing/null SEO fields are not generated.
console.log(result.warnings);
