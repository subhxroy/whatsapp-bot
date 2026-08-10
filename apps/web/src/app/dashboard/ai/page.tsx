'use client';

import { useState, useEffect } from 'react';
import { Bot, ShieldCheck, Server, Cloud, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AIPage() {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'openai' | 'ollama'>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('https://api.openai.com/v1');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');

  const [, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const fetchAiSettings = async () => {
    try {
      const res = await fetch('/api/settings', { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const map = data.settingsMap || {};

        setAiEnabled(map.AI_ENABLED === 'true' || data.environment?.aiEnabled || false);
        setProvider(map.AI_PROVIDER || 'gemini');
        setGeminiKey(map.GEMINI_API_KEY || '');
        setOpenaiKey(map.OPENAI_API_KEY || '');
        setOpenaiBaseUrl(map.OPENAI_BASE_URL || 'https://api.openai.com/v1');
        setOllamaBaseUrl(map.OLLAMA_BASE_URL || 'http://localhost:11434');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAiSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setErr('');

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settings: {
            AI_ENABLED: String(aiEnabled),
            AI_PROVIDER: provider,
            GEMINI_API_KEY: geminiKey,
            OPENAI_API_KEY: openaiKey,
            OPENAI_BASE_URL: openaiBaseUrl,
            OLLAMA_BASE_URL: ollamaBaseUrl,
          },
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update AI settings');
      }

      setMsg('AI Assistant configuration saved successfully!');
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 text-[#070607]">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#070607]">
          AI ASSISTANT SETTINGS
        </h1>
        <p className="text-sm font-medium text-[#070607]/70 mt-1">
          Configure provider adapters, API credentials, and zero-leak privacy controls
        </p>
      </div>

      {msg && (
        <div className="flex items-center gap-2 rounded-[24px] bg-[#f5f28e] p-4 text-sm font-semibold text-[#070607]">
          <CheckCircle2 className="h-5 w-5 text-[#fc5000]" />
          <span>{msg}</span>
        </div>
      )}

      {err && (
        <div className="flex items-center gap-2 rounded-[24px] bg-[#fc5000]/15 p-4 text-sm font-semibold text-[#fc5000]">
          <AlertCircle className="h-5 w-5" />
          <span>{err}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-8 text-[#070607]">
          {/* AI Engine Global Toggle Switch */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[32px] bg-[#e2e2df]/60 border border-[#070607]/10">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fc5000] text-[#070607]">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-3xl uppercase text-[#070607]">AI Engine Global Switch</h2>
                <p className="text-xs font-semibold text-[#070607]/70 mt-0.5">
                  Master toggle for intelligent bot responses and AI commands
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`flex items-center gap-3 rounded-full px-6 py-3 text-xs font-bold uppercase tracking-wider transition ${
                aiEnabled
                  ? 'bg-[#fc5000] text-[#070607]'
                  : 'bg-[#070607] text-[#ffffff]'
              }`}
            >
              <span>{aiEnabled ? 'AI Engine Active' : 'AI Engine Disabled'}</span>
              <div
                className={`h-4 w-4 rounded-full border-2 border-current transition ${
                  aiEnabled ? 'bg-[#070607]' : 'bg-transparent'
                }`}
              />
            </button>
          </div>

          {/* Provider Selection Cards */}
          <div className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
              Active AI Provider Adapter
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Gemini Option */}
              <div
                onClick={() => setProvider('gemini')}
                className={`cursor-pointer rounded-[32px] p-6 space-y-3 transition border-2 ${
                  provider === 'gemini'
                    ? 'border-[#fc5000] bg-[#e2e2df] shadow-md'
                    : 'border-transparent bg-[#e2e2df]/50 hover:bg-[#e2e2df]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Cloud className="h-7 w-7 text-[#fc5000]" />
                  {provider === 'gemini' && (
                    <span className="rounded-full bg-[#fc5000] px-3 py-1 text-[10px] font-extrabold uppercase text-[#070607]">
                      SELECTED
                    </span>
                  )}
                </div>
                <h3 className="font-display text-2xl uppercase text-[#070607]">Google Gemini Pro</h3>
                <p className="text-xs font-medium text-[#070607]/80 leading-relaxed">
                  Fast, high-quality multimodal model from Google DeepMind.
                </p>
              </div>

              {/* OpenAI Option */}
              <div
                onClick={() => setProvider('openai')}
                className={`cursor-pointer rounded-[32px] p-6 space-y-3 transition border-2 ${
                  provider === 'openai'
                    ? 'border-[#fc5000] bg-[#e2e2df] shadow-md'
                    : 'border-transparent bg-[#e2e2df]/50 hover:bg-[#e2e2df]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Cloud className="h-7 w-7 text-[#fc5000]" />
                  {provider === 'openai' && (
                    <span className="rounded-full bg-[#fc5000] px-3 py-1 text-[10px] font-extrabold uppercase text-[#070607]">
                      SELECTED
                    </span>
                  )}
                </div>
                <h3 className="font-display text-2xl uppercase text-[#070607]">OpenAI / Compatible</h3>
                <p className="text-xs font-medium text-[#070607]/80 leading-relaxed">
                  Custom OpenAI, Groq, DeepSeek, or compatible v1 API endpoints.
                </p>
              </div>

              {/* Ollama Option */}
              <div
                onClick={() => setProvider('ollama')}
                className={`cursor-pointer rounded-[32px] p-6 space-y-3 transition border-2 ${
                  provider === 'ollama'
                    ? 'border-[#fc5000] bg-[#e2e2df] shadow-md'
                    : 'border-transparent bg-[#e2e2df]/50 hover:bg-[#e2e2df]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Server className="h-7 w-7 text-[#fc5000]" />
                  {provider === 'ollama' && (
                    <span className="rounded-full bg-[#fc5000] px-3 py-1 text-[10px] font-extrabold uppercase text-[#070607]">
                      SELECTED
                    </span>
                  )}
                </div>
                <h3 className="font-display text-2xl uppercase text-[#070607]">Local Ollama</h3>
                <p className="text-xs font-medium text-[#070607]/80 leading-relaxed">
                  100% offline local LLM inference with zero cloud telemetry.
                </p>
              </div>
            </div>
          </div>

          {/* Provider Credentials Form Inputs */}
          <div className="rounded-[32px] bg-[#e2e2df] p-6 space-y-6">
            <h3 className="font-display text-2xl uppercase text-[#070607]">Provider API Configuration</h3>

            {provider === 'gemini' && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-3.5 px-6 text-sm font-mono text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                />
              </div>
            )}

            {provider === 'openai' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-3.5 px-6 text-sm font-mono text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                    OpenAI Base URL
                  </label>
                  <input
                    type="text"
                    value={openaiBaseUrl}
                    onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-3.5 px-6 text-sm font-mono text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {provider === 'ollama' && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                  Ollama Local Base URL
                </label>
                <input
                  type="text"
                  value={ollamaBaseUrl}
                  onChange={(e) => setOllamaBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-3.5 px-6 text-sm font-mono text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="rounded-[32px] bg-[#f5f28e] p-6 text-[#070607] flex items-start gap-4">
            <ShieldCheck className="h-6 w-6 flex-shrink-0 mt-0.5 text-[#070607]" />
            <div>
              <h4 className="font-display text-xl uppercase text-[#070607]">Zero-Leak Privacy Assurance</h4>
              <p className="text-xs font-medium text-[#070607]/90 mt-1 leading-relaxed">
                AI processing is only invoked when explicitly triggered by authorized user prompt or command. No incoming WhatsApp message history or background conversations are ever streamed to AI providers.
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-full bg-[#fc5000] px-8 py-4 text-base font-semibold text-[#070607] transition hover:bg-[#070607] hover:text-[#ffffff] disabled:opacity-50"
        >
          <Save className="h-5 w-5" />
          <span>{saving ? 'Saving AI Settings...' : 'Save AI Configuration'}</span>
        </button>
      </form>
    </div>
  );
}
