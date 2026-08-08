export type AIProviderType = 'gemini' | 'openai' | 'ollama';

export interface AIResponse {
  text: string;
  provider: AIProviderType;
  model: string;
}

export interface AIProvider {
  type: AIProviderType;
  generateText(prompt: string, options?: { systemPrompt?: string }): Promise<AIResponse>;
}
