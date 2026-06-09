import type { ProviderConfig } from "../types.js";

const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat"
};

export interface ResolveProviderConfigInput {
  cli?: ProviderConfig;
  config?: ProviderConfig;
  env?: Record<string, string | undefined>;
}

export function resolveProviderConfig(input: ResolveProviderConfigInput = {}): ProviderConfig {
  const env = input.env ?? process.env;
  const providerEnv = resolveProviderSpecificEnv(env);
  const llmEnv = resolveLlmEnv(env);

  return {
    apiKey: firstMeaningfulString(
      input.cli?.apiKey,
      input.config?.apiKey,
      llmEnv.apiKey,
      providerEnv.apiKey
    ),
    baseUrl:
      firstMeaningfulString(
        input.cli?.baseUrl,
        input.config?.baseUrl,
        llmEnv.baseUrl,
        providerEnv.baseUrl
      ) ?? DEFAULT_PROVIDER_CONFIG.baseUrl,
    model:
      firstMeaningfulString(
        input.cli?.model,
        input.config?.model,
        llmEnv.model,
        providerEnv.model
      ) ?? DEFAULT_PROVIDER_CONFIG.model,
    temperature: firstMeaningfulNumber(input.cli?.temperature, input.config?.temperature)
  };
}

function resolveLlmEnv(env: Record<string, string | undefined>): ProviderConfig {
  return {
    apiKey: env.LLM_API_KEY,
    baseUrl: env.LLM_BASE_URL,
    model: env.LLM_MODEL
  };
}

function resolveProviderSpecificEnv(env: Record<string, string | undefined>): ProviderConfig {
  return {
    apiKey: firstMeaningfulString(env.DEEPSEEK_API_KEY, env.OPENAI_API_KEY),
    baseUrl: firstMeaningfulString(env.DEEPSEEK_BASE_URL, env.OPENAI_BASE_URL),
    model: firstMeaningfulString(env.DEEPSEEK_MODEL, env.OPENAI_MODEL)
  };
}

function firstMeaningfulString(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim().length > 0);
}

function firstMeaningfulNumber(...values: Array<number | undefined>): number | undefined {
  return values.find((value) => value !== undefined && Number.isFinite(value));
}
