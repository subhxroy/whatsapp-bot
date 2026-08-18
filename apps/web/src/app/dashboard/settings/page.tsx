'use client';

import { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  History,
  MessageSquareOff,
  Sparkles,
  Phone,
  Hash,
  Zap,
} from 'lucide-react';

export default function SettingsPage() {
  // General & Identity
  const [prefix, setPrefix] = useState('.');
  const [ownerNumber, setOwnerNumber] = useState('');
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);

  // View-Once
  const [autoVv, setAutoVv] = useState(true);

  // Retention & Deleted Messages
  const [contentRetention, setContentRetention] = useState('90d');
  const [deletedRetention, setDeletedRetention] = useState('90d');

  // History & Logging
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [logging, setLogging] = useState(false);

  // AI Integration
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'ollama'>('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('https://api.openai.com/v1');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');

  // UI States
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        const user = data?.user;
        if (user) {
          const adminCheck = user.role === 'ADMIN' || user.role === 'OWNER' || user.isAdmin === true;
          setIsAdmin(adminCheck);
          if (user.connectedPhone) {
            setConnectedPhone(user.connectedPhone);
          }
        }
      })
      .catch(() => {});

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
        const map = data.settingsMap || {};

        setPrefix(map.COMMAND_PREFIX || map.prefix || data.settings?.find((s: { key: string }) => s.key === 'prefix')?.value || '.');
        setOwnerNumber(map.BOT_OWNER_NUMBER || data.environment?.ownerNumber || '');
        setAutoVv(map.AUTO_VV_ENABLED !== 'false');
        setContentRetention(map.MESSAGE_CONTENT_RETENTION || data.environment?.messageContentRetention || '90d');
        setDeletedRetention(map.DELETED_MESSAGE_RETENTION || data.environment?.deletedMessageRetention || '90d');
        setHistoryEnabled(map.MESSAGE_HISTORY_ENABLED === 'true' || data.environment?.messageHistoryEnabled || false);
        setLogging(map.MESSAGE_LOGGING === 'true' || data.environment?.messageLogging || false);

        setAiEnabled(map.AI_ENABLED === 'true' || data.environment?.aiEnabled || false);
        setAiProvider((map.AI_PROVIDER as 'gemini' | 'openai' | 'ollama') || 'gemini');
        setGeminiApiKey(map.GEMINI_API_KEY || '');
        setOpenaiApiKey(map.OPENAI_API_KEY || '');
        setOpenaiBaseUrl(map.OPENAI_BASE_URL || 'https://api.openai.com/v1');
        setOllamaBaseUrl(map.OLLAMA_BASE_URL || 'http://localhost:11434');
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setErr('');

    try {
      const payloadSettings: Record<string, string> = {
        COMMAND_PREFIX: prefix.trim(),
        prefix: prefix.trim(),
        BOT_OWNER_NUMBER: ownerNumber.trim(),
        AUTO_VV_ENABLED: String(autoVv),
        MESSAGE_CONTENT_RETENTION: contentRetention,
        DELETED_MESSAGE_RETENTION: deletedRetention,
        MESSAGE_HISTORY_ENABLED: String(historyEnabled),
        MESSAGE_LOGGING: String(logging),
        AI_ENABLED: String(aiEnabled),
        AI_PROVIDER: aiProvider,
        OPENAI_BASE_URL: openaiBaseUrl.trim(),
        OLLAMA_BASE_URL: ollamaBaseUrl.trim(),
      };

      // Only include API keys if they are not masked
      if (geminiApiKey && !geminiApiKey.includes('***')) {
        payloadSettings.GEMINI_API_KEY = geminiApiKey.trim();
      }
      if (openaiApiKey && !openaiApiKey.includes('***')) {
        payloadSettings.OPENAI_API_KEY = openaiApiKey.trim();
      }

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ settings: payloadSettings }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }

      setMsg('All configuration settings saved successfully!');
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
          SYSTEM SETTINGS
        </h1>
        <p className="text-sm font-medium text-[#070607]/70 mt-1">
          Configure bot prefix, auto view-once reveals, deleted message retention, history feeds, and AI assistants.
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
        {/* SECTION 1: General & Command Identity */}
        <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-6 border border-[#070607]/5">
          <div className="flex items-center gap-3 border-b border-dotted border-[#070607]/20 pb-4">
            <Hash className="h-5 w-5 text-[#fc5000]" />
            <h2 className="font-display text-xl uppercase tracking-tight text-[#070607]">
              Command & Owner Identity
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                Command Trigger Prefix
              </label>
              <input
                type="text"
                required
                maxLength={3}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-mono font-bold text-[#070607] focus:border-[#fc5000] focus:outline-none"
              />
              <p className="mt-2 text-xs font-medium text-[#070607]/60">
                Prefix used to trigger bot commands (e.g. <code className="font-bold">{prefix || '.'}menu</code>, <code className="font-bold">{prefix || '.'}ping</code>, <code className="font-bold">{prefix || '.'}vv</code>)
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                {isAdmin ? 'Bot Owner Phone Number (with Country Code)' : 'Connected WhatsApp Phone Number'}
              </label>
              {isAdmin ? (
                <>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#070607]/40" />
                    <input
                      type="text"
                      value={ownerNumber}
                      onChange={(e) => setOwnerNumber(e.target.value)}
                      placeholder="e.g. 919876543210"
                      className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 pl-11 pr-6 text-sm font-mono text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                    />
                  </div>
                  <p className="mt-2 text-xs font-medium text-[#070607]/60">
                    Your personal number. Receives auto-revealed view-once media and possesses master admin command access.
                  </p>
                </>
              ) : (
                <div className="w-full rounded-full border-1.5 border-[#070607]/10 bg-[#e2e2df] py-3.5 px-6 text-sm font-mono text-[#070607]">
                  {connectedPhone ? `+${connectedPhone}` : 'Not connected yet'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: Auto View-Once (.vv) */}
        <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-6 border border-[#070607]/5">
          <div className="flex items-center gap-3 border-b border-dotted border-[#070607]/20 pb-4">
            <Zap className="h-5 w-5 text-[#fc5000]" />
            <h2 className="font-display text-xl uppercase tracking-tight text-[#070607]">
              Auto View-Once (.vv) Bypass
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[24px] bg-[#e2e2df] p-6">
            <div className="space-y-1 max-w-xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                Auto-Forward View-Once Photos & Videos
              </span>
              <div className="font-display text-2xl uppercase text-[#070607]">
                {autoVv ? 'AUTOMATIC (ENABLED)' : 'MANUAL COMMAND ONLY'}
              </div>
              <p className="text-xs font-medium text-[#070607]/70">
                When enabled, any view-once photo, video, or audio sent in direct messages or groups is immediately downloaded and sent directly to your private WhatsApp number without needing to type <code className="font-bold">.vv</code>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAutoVv(!autoVv)}
              className={`flex items-center gap-3 rounded-full px-6 py-3 text-xs font-bold uppercase tracking-wider transition ${
                autoVv ? 'bg-[#fc5000] text-[#070607]' : 'bg-[#070607] text-[#ffffff]'
              }`}
            >
              <span>{autoVv ? 'Auto-Forward Enabled' : 'Auto-Forward Disabled'}</span>
              <div
                className={`h-4 w-4 rounded-full border-2 border-current transition ${
                  autoVv ? 'bg-[#070607]' : 'bg-transparent'
                }`}
              />
            </button>
          </div>
        </div>

        {/* SECTION 3: Deleted Messages & Content Retention */}
        <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-6 border border-[#070607]/5">
          <div className="flex items-center gap-3 border-b border-dotted border-[#070607]/20 pb-4">
            <MessageSquareOff className="h-5 w-5 text-[#fc5000]" />
            <h2 className="font-display text-xl uppercase tracking-tight text-[#070607]">
              Deleted Messages & Content Retention
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                Message Content Retention Policy
              </label>
              <select
                value={contentRetention}
                onChange={(e) => setContentRetention(e.target.value)}
                className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-semibold text-[#070607] focus:border-[#fc5000] focus:outline-none cursor-pointer"
              >
                <option value="90d">90 Days (Recommended — full text available for 90 days)</option>
                <option value="30d">30 Days (Full text available for 30 days)</option>
                <option value="7d">7 Days (Full text available for 7 days)</option>
                <option value="metadata">Metadata Only (Strict Privacy — text body is stripped)</option>
              </select>
              <p className="mt-2 text-xs font-medium text-[#070607]/60">
                Determines whether message text is preserved when messages are revoked or stored in history. If set to <code className="font-bold">metadata</code>, the dashboard will show &quot;Content not available&quot;.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                Deleted Messages Storage Expiration
              </label>
              <select
                value={deletedRetention}
                onChange={(e) => setDeletedRetention(e.target.value)}
                className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-semibold text-[#070607] focus:border-[#fc5000] focus:outline-none cursor-pointer"
              >
                <option value="90d">90 Days (Retain deleted records for 90 days)</option>
                <option value="30d">30 Days (Retain deleted records for 30 days)</option>
                <option value="7d">7 Days (Retain deleted records for 7 days)</option>
                <option value="24h">24 Hours (Retain deleted records for 1 day)</option>
                <option value="forever">Forever (Keep indefinitely until manual purge)</option>
              </select>
              <p className="mt-2 text-xs font-medium text-[#070607]/60">
                How long revoked messages remain accessible on the <strong>Deleted Messages</strong> dashboard page before automated cleanup.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 4: Message History & Logging */}
        <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-6 border border-[#070607]/5">
          <div className="flex items-center gap-3 border-b border-dotted border-[#070607]/20 pb-4">
            <History className="h-5 w-5 text-[#fc5000]" />
            <h2 className="font-display text-xl uppercase tracking-tight text-[#070607]">
              Message History & Logging Feed
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[24px] bg-[#e2e2df] p-6">
              <div className="space-y-1 max-w-xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                  Live Message History Feed (/dashboard/message-history)
                </span>
                <div className="font-display text-2xl uppercase text-[#070607]">
                  {historyEnabled ? 'HISTORY ENABLED' : 'HISTORY DISABLED'}
                </div>
                <p className="text-xs font-medium text-[#070607]/70">
                  When enabled, incoming and outgoing messages are recorded and searchable in the Message History feed.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setHistoryEnabled(!historyEnabled)}
                className={`flex items-center gap-3 rounded-full px-6 py-3 text-xs font-bold uppercase tracking-wider transition ${
                  historyEnabled ? 'bg-[#fc5000] text-[#070607]' : 'bg-[#070607] text-[#ffffff]'
                }`}
              >
                <span>{historyEnabled ? 'Feed Enabled' : 'Feed Disabled'}</span>
                <div
                  className={`h-4 w-4 rounded-full border-2 border-current transition ${
                    historyEnabled ? 'bg-[#070607]' : 'bg-transparent'
                  }`}
                />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[24px] bg-[#e2e2df] p-6">
              <div className="space-y-1 max-w-xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                  Server Terminal Message Logging
                </span>
                <div className="font-display text-2xl uppercase text-[#070607]">
                  {logging ? 'CONSOLE LOGGING ON' : 'STRICT PRIVACY (REDACTED)'}
                </div>
                <p className="text-xs font-medium text-[#070607]/70">
                  Print incoming message metadata and body details to the backend terminal for diagnostic debugging.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLogging(!logging)}
                className={`flex items-center gap-3 rounded-full px-6 py-3 text-xs font-bold uppercase tracking-wider transition ${
                  logging ? 'bg-[#fc5000] text-[#070607]' : 'bg-[#070607] text-[#ffffff]'
                }`}
              >
                <span>{logging ? 'Logging Enabled' : 'Logging Disabled'}</span>
                <div
                  className={`h-4 w-4 rounded-full border-2 border-current transition ${
                    logging ? 'bg-[#070607]' : 'bg-transparent'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 5: AI Assistant Configuration */}
        <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-6 border border-[#070607]/5">
          <div className="flex items-center gap-3 border-b border-dotted border-[#070607]/20 pb-4">
            <Sparkles className="h-5 w-5 text-[#fc5000]" />
            <h2 className="font-display text-xl uppercase tracking-tight text-[#070607]">
              AI Assistant Settings (.ai / .ask)
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[24px] bg-[#e2e2df] p-6 mb-6">
            <div className="space-y-1 max-w-xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                AI Assistant Command Integration
              </span>
              <div className="font-display text-2xl uppercase text-[#070607]">
                {aiEnabled ? 'AI ASSISTANT ACTIVE' : 'AI ASSISTANT DISABLED'}
              </div>
              <p className="text-xs font-medium text-[#070607]/70">
                Enables WhatsApp AI response commands (<code className="font-bold">.ai &lt;question&gt;</code>, <code className="font-bold">.ask</code>, <code className="font-bold">.gemini</code>, <code className="font-bold">.gpt</code>).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`flex items-center gap-3 rounded-full px-6 py-3 text-xs font-bold uppercase tracking-wider transition ${
                aiEnabled ? 'bg-[#fc5000] text-[#070607]' : 'bg-[#070607] text-[#ffffff]'
              }`}
            >
              <span>{aiEnabled ? 'AI Enabled' : 'AI Disabled'}</span>
              <div
                className={`h-4 w-4 rounded-full border-2 border-current transition ${
                  aiEnabled ? 'bg-[#070607]' : 'bg-transparent'
                }`}
              />
            </button>
          </div>

          {aiEnabled && (
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                  Active AI Provider
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'gemini' as const, label: 'Google Gemini (2.5 Flash)', desc: 'Fast & Intelligent' },
                    { id: 'openai' as const, label: 'OpenAI (GPT-4o Mini)', desc: 'Standard OpenAI API' },
                    { id: 'ollama' as const, label: 'Ollama (Local Llama3)', desc: 'Self-hosted & Free' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAiProvider(p.id)}
                      className={`rounded-[24px] p-4 text-left border transition ${
                        aiProvider === p.id
                          ? 'border-[#fc5000] bg-[#e2e2df] shadow-sm'
                          : 'border-[#070607]/10 bg-[#e2e2df]/50 hover:bg-[#e2e2df]'
                      }`}
                    >
                      <div className="font-bold text-sm text-[#070607]">{p.label}</div>
                      <div className="text-xs text-[#070607]/60 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {aiProvider === 'gemini' && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                    Google Gemini API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 pl-6 pr-12 text-sm font-mono text-[#070607] focus:border-[#fc5000] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#070607]/50 hover:text-[#070607]"
                    >
                      {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {aiProvider === 'openai' && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                      OpenAI API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showOpenaiKey ? 'text' : 'password'}
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        placeholder="sk-proj-..."
                        className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 pl-6 pr-12 text-sm font-mono text-[#070607] focus:border-[#fc5000] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#070607]/50 hover:text-[#070607]"
                      >
                        {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
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
                      className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-mono text-[#070607] focus:border-[#fc5000] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {aiProvider === 'ollama' && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                    Ollama Local Base URL
                  </label>
                  <input
                    type="text"
                    value={ollamaBaseUrl}
                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-mono text-[#070607] focus:border-[#fc5000] focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* SUBMIT BUTTON */}
        {isAdmin ? (
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-[#fc5000] px-8 py-4 text-base font-semibold text-[#070607] transition hover:bg-[#070607] hover:text-[#ffffff] disabled:opacity-50 shadow-md"
          >
            <Save className="h-5 w-5" />
            <span>{saving ? 'Saving Settings...' : 'Save All Settings'}</span>
          </button>
        ) : (
          <div className="rounded-[24px] bg-[#e2e2df] p-4 text-xs font-semibold text-[#070607]/70">
            🔒 System parameters are managed by Administrators. Read-only mode active.
          </div>
        )}
      </form>
    </div>
  );
}
