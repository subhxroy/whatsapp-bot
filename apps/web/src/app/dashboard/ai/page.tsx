'use client';

import { useState, useEffect } from 'react';
import { Bot, ShieldCheck, Server, Cloud } from 'lucide-react';

export default function AIPage() {
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    fetch('/api/settings', { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          window.location.href = '/login';
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setAiEnabled(data.environment?.aiEnabled || false);
      });
  }, []);

  return (
    <div className="space-y-8 text-[#070607]">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#070607]">
          AI ASSISTANT SETTINGS
        </h1>
        <p className="text-sm font-medium text-[#070607]/70 mt-1">
          Configure provider adapters and zero-leak privacy controls
        </p>
      </div>

      <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-8 text-[#070607]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fc5000] text-[#070607]">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-3xl uppercase text-[#070607]">AI Engine Global Toggle</h2>
              <p className="text-xs font-semibold text-[#070607]/70 mt-0.5">
                Strictly off by default (<code className="bg-[#e2e2df] px-1 py-0.5 rounded text-[#070607]">AI_ENABLED=false</code> in environment)
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#070607] ${
              aiEnabled ? 'bg-[#fc5000]' : 'bg-[#f5f28e]'
            }`}
          >
            {aiEnabled ? 'AI Engine Active' : 'AI Engine Disabled'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-[32px] bg-[#e2e2df] p-6 space-y-3">
            <Cloud className="h-7 w-7 text-[#fc5000]" />
            <h3 className="font-display text-2xl uppercase text-[#070607]">Google Gemini Pro</h3>
            <p className="text-xs font-medium text-[#070607]/80 leading-relaxed">
              Fast, high-quality multimodal model. Configure <code className="bg-[#f7f6f2] px-1 rounded text-[#070607]">GEMINI_API_KEY</code> in your environment file.
            </p>
          </div>

          <div className="rounded-[32px] bg-[#e2e2df] p-6 space-y-3">
            <Cloud className="h-7 w-7 text-[#fc5000]" />
            <h3 className="font-display text-2xl uppercase text-[#070607]">OpenAI / Compatible</h3>
            <p className="text-xs font-medium text-[#070607]/80 leading-relaxed">
              Custom OpenAI or compatible base URL. Configure <code className="bg-[#f7f6f2] px-1 rounded text-[#070607]">OPENAI_API_KEY</code> and <code className="bg-[#f7f6f2] px-1 rounded text-[#070607]">OPENAI_BASE_URL</code>.
            </p>
          </div>

          <div className="rounded-[32px] bg-[#e2e2df] p-6 space-y-3">
            <Server className="h-7 w-7 text-[#fc5000]" />
            <h3 className="font-display text-2xl uppercase text-[#070607]">Local Ollama (Offline)</h3>
            <p className="text-xs font-medium text-[#070607]/80 leading-relaxed">
              100% offline local LLM inference via Ollama on <code className="bg-[#f7f6f2] px-1 rounded text-[#070607]">http://localhost:11434</code> with zero cloud telemetry.
            </p>
          </div>
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
    </div>
  );
}
