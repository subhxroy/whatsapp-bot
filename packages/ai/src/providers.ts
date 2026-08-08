import { AIProvider, AIResponse, AIProviderType } from './types';
import { getEnv } from '@private-md-bot/config';
import { GoogleGenAI } from '@google/genai';

export class GeminiProvider implements AIProvider {
  public type: AIProviderType = 'gemini';

  async generateText(prompt: string, options: { systemPrompt?: string } = {}): Promise<AIResponse> {
    const env = getEnv();
    if (!env.AI_ENABLED) {
      throw new Error('AI features are disabled by configuration. No data was transmitted.');
    }

    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: options.systemPrompt ? { systemInstruction: options.systemPrompt } : undefined,
    });

    return {
      text: response.text || '',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    };
  }
}

export class OpenAIProvider implements AIProvider {
  public type: AIProviderType = 'openai';

  async generateText(prompt: string, options: { systemPrompt?: string } = {}): Promise<AIResponse> {
    const env = getEnv();
    if (!env.AI_ENABLED) {
      throw new Error('AI features are disabled by configuration. No data was transmitted.');
    }

    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured.');
    }

    const res = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    return {
      text: data.choices[0]?.message?.content || '',
      provider: 'openai',
      model: 'gpt-4o-mini',
    };
  }
}

export class OllamaProvider implements AIProvider {
  public type: AIProviderType = 'ollama';

  async generateText(prompt: string, options: { systemPrompt?: string } = {}): Promise<AIResponse> {
    const env = getEnv();
    if (!env.AI_ENABLED) {
      throw new Error('AI features are disabled by configuration. No data was transmitted.');
    }

    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        prompt,
        system: options.systemPrompt,
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    return {
      text: data.response || '',
      provider: 'ollama',
      model: 'llama3',
    };
  }
}

export function getAIProvider(provider: AIProviderType = 'gemini'): AIProvider {
  switch (provider) {
    case 'gemini':
      return new GeminiProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'ollama':
      return new OllamaProvider();
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
