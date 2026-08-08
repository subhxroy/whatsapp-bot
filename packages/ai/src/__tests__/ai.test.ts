import { describe, it, expect, vi } from 'vitest';
import { getAIProvider } from '../providers';

describe('AI Module Security & Privacy', () => {
  it('should throw immediately when AI_ENABLED=false without calling any network endpoint', async () => {
    vi.stubEnv('AI_ENABLED', 'false');
    const provider = getAIProvider('gemini');

    await expect(provider.generateText('hello')).rejects.toThrow(
      /AI features are disabled by configuration. No data was transmitted./
    );
  });
});
