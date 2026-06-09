# zTrans

`zTrans` 是一个面向技术 Markdown 文档的双语翻译工具，既可以作为 CLI 使用，也可以作为 TypeScript library 调用。它通过 OpenAI-compatible / DeepSeek-compatible Chat Completions API 翻译中文或英文 Markdown，并尽量保持 Markdown 结构、链接、代码、frontmatter 和技术术语稳定。

npm 包名和 CLI 命令名均为 `ztrans`。

## 当前定位

这个项目的核心原则是：

> 只翻译给人看的内容，不破坏 Markdown 结构、代码、链接、占位符和元数据。

第一版已经覆盖常见技术博客翻译流程，但它不是完整 CMS，也不包含 Web UI、数据库、发布系统或多人协作能力。

## 安装

需要 Node.js 20 或更高版本。

作为 library 安装到项目：

```sh
pnpm add ztrans
```

在本地项目里运行 CLI，推荐使用 `pnpm exec`：

```sh
pnpm exec ztrans --help
```

如果你希望全局使用裸命令，可以全局安装：

```sh
pnpm add -g ztrans
ztrans --help
```

在本仓库开发或测试时，也可以直接运行构建后的 CLI：

```powershell
node dist\cli.js --help
```

## 快速测试

先安装依赖并构建：

```powershell
cd E:\ztrans
pnpm.cmd install
pnpm.cmd build
```

不调用大模型、只检查 Markdown 结构：

```powershell
node dist\cli.js translate examples\basic\Bayesian_Classifier.md --check --json
```

配置 DeepSeek-compatible 环境变量：

```powershell
$env:LLM_API_KEY="你的 API key"
$env:LLM_BASE_URL="https://api.deepseek.com"
$env:LLM_MODEL="deepseek-chat"
```

中文翻译成英文：

```powershell
node dist\cli.js translate examples\basic\Bayesian_Classifier.md --from zh --to en --out examples\basic\Bayesian_Classifier.en.md --glossary examples\basic\glossary.yml --force
```

英文翻译成中文：

```powershell
node dist\cli.js translate examples\basic\Bayesian_Classifier.md --from en --to zh --out examples\basic\Bayesian_Classifier.zh.md --glossary examples\basic\glossary.yml --force
```

## CLI 用法

翻译 Markdown 文件并写入指定输出路径：

```sh
pnpm exec ztrans translate input.md --from zh --to en --out output.en.md
```

翻译并输出到 stdout：

```sh
pnpm exec ztrans translate input.md --to en
```

只检查 Markdown 结构，不调用 provider，也不需要 API key：

```sh
pnpm exec ztrans translate input.md --check --json
```

打印示例 YAML 配置：

```sh
pnpm exec ztrans init
```

常用参数：

```sh
pnpm exec ztrans translate examples/basic/input.md \
  --config examples/basic/config.yml \
  --glossary examples/basic/glossary.yml \
  --out output.en.md
```

`--to` 只有在两种情况下可以省略：

- 使用 `--check`，因为它只做结构检查。
- 配置文件中设置了 `translation.targetLocale`。

真实翻译和 `--dry-run` 都需要从 `--to` 或配置文件获得目标语言。

如果输出文件已经存在，需要加 `--force` 才会覆盖。不传 `--out` 时，翻译后的 Markdown 会输出到 stdout。

## Provider 配置

默认 provider 配置兼容 DeepSeek：

```sh
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

推荐通过环境变量设置 API key：

```sh
LLM_API_KEY=your-key
```

也支持 provider-specific 别名：

```sh
DEEPSEEK_API_KEY=your-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
```

如果 `DEEPSEEK_*` 和 `OPENAI_*` 同时设置了同一个字段，`DEEPSEEK_*` 优先。

配置优先级：

1. CLI 参数：`--api-key`、`--base-url`、`--model`
2. 配置文件里的 `provider` 字段
3. 通用环境变量 `LLM_*`
4. Provider-specific 环境变量：`DEEPSEEK_*` 优先于 `OPENAI_*`
5. 默认值

## 配置文件

支持 YAML 和 JSON。当前支持的 YAML 配置示例：

```yml
provider:
  baseUrl: https://api.deepseek.com
  model: deepseek-chat
  temperature: 0.2
translation:
  sourceLocale: zh
  targetLocale: en
  maxChunkChars: 6000
  concurrency: 1
quality:
  retryOnValidationFailure: true
  maxRetries: 1
  validateStructure: true
```

配置文件中的值会按字面量读取，不会展开 `${LLM_API_KEY}` 这类环境变量占位符。因为配置文件优先级高于环境变量，建议不要把 API key 写进配置文件，而是使用 `LLM_API_KEY`、`DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`。

`--api-key` 只建议用于临时本地命令，因为命令行参数可能出现在 shell history 或进程列表中。

## Library 用法

一次性调用 `translateMarkdown`：

```ts
import { readFile } from "node:fs/promises";
import { translateMarkdown } from "ztrans";

const markdown = await readFile("examples/basic/input.md", "utf8");

const result = await translateMarkdown({
  markdown,
  sourceLocale: "zh",
  targetLocale: "en",
  provider: {
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
  },
  glossary: [
    { source: "发布控制台", target: "publishing console" },
    { source: "TwoRiver", target: "TwoRiver", note: "项目名，不翻译。" },
  ],
});

console.log(result.markdown);
console.log(result.warnings);
```

用 `createTranslator` 共享默认配置：

```ts
import { createTranslator } from "ztrans";

const translateToEnglish = createTranslator({
  targetLocale: "en",
  provider: {
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
  },
  validateStructure: true,
});

const result = await translateToEnglish({
  markdown: "## 发布控制台\n\n使用 `pnpm build` 构建项目。",
  sourceLocale: "zh",
});
```

## 术语表

术语表支持 YAML 或 JSON。YAML 示例：

```yml
terms:
  - source: TwoRiver
    target: TwoRiver
    note: 项目名，不翻译。
  - source: 发布控制台
    target: publishing console
  - source: SQLite
    target: SQLite
```

术语表会作为“用户提供的数据”插入 prompt。为了降低 prompt 注入风险，`source`、`target` 和 `note` 必须是单行字符串；多行字符串和控制字符会被拒绝。

## Markdown 处理能力

工具会解析 Markdown，按 AST 顶层节点安全分块，然后把需要翻译的片段交给 provider。翻译后会做结构校验并返回 warnings。

已经实现并测试的能力：

- 保留 heading 数量和层级，检测 `#` / `##` 等层级变化。
- 分块时不切开 fenced code block。
- 分块时不切碎 GFM table。
- 检测 fenced code block 数量和语言标识变化。
- 检测 inline code 数量和值变化，例如 `` `pnpm install` ``。
- 检测 link URL 数量和值变化。
- 检测 image URL 数量和值变化。
- 翻译图片 alt 文本时保留图片 URL。
- 翻译自然语言 frontmatter 字段：`title`、`summary`、`description`、`seoTitle`、`seoDescription`。
- 保留结构性 frontmatter 字段：`slug`、`date`、`tags`、`category`、`cover`、`canonical` 和非字符串值。
- 清理模型常见输出包装，例如 `Here is the translation:` 或整段 ```markdown 包裹。
- validation warnings 会出现在 library 返回值和 CLI 输出中。

需要注意的边界：

- fenced code block 的 body 当前不做逐字保护；工具会提示模型不要翻译代码块，并校验代码块数量和语言标识，但不会逐字比较代码块内容。
- HTML 标签结构目前主要依赖 prompt 约束，没有专门的 HTML AST 校验。
- 裸露占位符如 `{{ user.name }}`、`{count}`、`%APP_NAME%`、`$HOME` 目前没有专门 validator；建议把关键占位符写进术语表或用行内代码包住。
- 表格不会被分块切碎，但当前没有专门校验每行表格列数是否一致。
- 标题翻译后可能影响自动生成的锚点；当前不会自动同步 `#installation` 这类锚点链接。
- 当前没有内置 Markdown 渲染预览检查；建议重要文档翻译后再用你的文档系统预览一次。

如果翻译完成但有结构 warnings，CLI 会设置非零退出码，方便 CI 或自动化流程捕获结构漂移。`--json` 会返回机器可读结果。

## TwoRiver Blog 适配

`translatePostTranslation` 可以翻译类似 TwoRiver Blog 的文章 translation 对象：

```ts
import { translatePostTranslation } from "ztrans";

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
    { source: "TwoRiver", target: "TwoRiver", note: "项目名，不翻译。" },
    { source: "发布控制台", target: "publishing console" },
  ],
});

console.log(result.title);
console.log(result.contentMarkdown);
console.log(result.warnings);
```

SEO 字段规则：

- `seoTitle` / `seoDescription` 非空时会独立翻译。
- 缺失或为 `null` 时不会自动生成，返回值仍为 `null`。
- `result.warnings` 会聚合结构校验 warning。
- 正文 Markdown 的 chunk 元数据可在 `result.chunks` 中查看。

## 安全注意事项

- 不要提交 API key。
- 优先使用环境变量，不要长期使用 `--api-key`。
- 错误序列化会递归脱敏 `apiKey`、`Authorization`、`token`、`secret` 等字段。
- Provider 测试使用 mock，不会调用外部大模型 API。
- 被拒绝的 provider URL 不会在错误详情中暴露 query、hash、用户名或密码。

## 开发命令

```sh
pnpm install
pnpm format:check
pnpm test
pnpm typecheck
pnpm build
```

构建后可以运行：

```powershell
node dist\cli.js init
node dist\cli.js translate examples\basic\input.md --check --json
```

## License

MIT
