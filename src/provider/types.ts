import type { TokenUsage } from "../types.js";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
}

export interface CompletionResponse {
  content: string;
  usage?: TokenUsage;
}

export interface LlmProvider {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}
