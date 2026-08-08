'use client';

import { useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const [prefix, setPrefix] = useState('.');
  const [logging, setLogging] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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
        setLogging(data.environment?.messageLogging || false);
        setAiEnabled(data.environment?.aiEnabled || false);
        const prefixSetting = data.settings?.find((s: any) => s.key === 'prefix');
        if (prefixSetting) setPrefix(prefixSetting.value);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: 'prefix', value: prefix }),
      });
      setMessage('Settings updated successfully!');
    } catch (err: any) {
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 text-[#070607]">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#070607]">
          GENERAL SETTINGS
        </h1>
        <p className="text-sm font-medium text-[#070607]/70 mt-1">
          Bot trigger prefix and global operational privacy parameters
        </p>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-[20px] bg-[#f5f28e] p-4 text-sm font-semibold text-[#070607]">
          <CheckCircle className="h-5 w-5" />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-6">
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
              className="w-full max-w-xs rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3 px-6 text-sm font-mono font-bold text-[#070607] focus:border-[#fc5000] focus:outline-none"
            />
            <p className="mt-2 text-xs font-medium text-[#070607]/60">
              Symbol prefix used for bot commands (e.g. <code className="font-bold text-[#070607]">.menu</code>, <code className="font-bold text-[#070607]">.ping</code>)
            </p>
          </div>

          <div className="pt-4 border-t border-dotted border-[#070607]/20 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-[24px] bg-[#e2e2df] p-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                Message Logging
              </span>
              <div className="mt-2 font-display text-2xl uppercase text-[#070607]">
                {logging ? 'ENABLED' : 'DISABLED (STRICT)'}
              </div>
              <p className="mt-1 text-xs font-medium text-[#070607]/70">
                Configured via <code className="font-mono text-[#070607]">MESSAGE_LOGGING</code> environment variable in <code className="font-mono text-[#070607]">.env</code>.
              </p>
            </div>

            <div className="rounded-[24px] bg-[#e2e2df] p-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                AI Engine
              </span>
              <div className="mt-2 font-display text-2xl uppercase text-[#070607]">
                {aiEnabled ? 'ACTIVE' : 'DISABLED'}
              </div>
              <p className="mt-1 text-xs font-medium text-[#070607]/70">
                Configured via <code className="font-mono text-[#070607]">AI_ENABLED</code> environment variable in <code className="font-mono text-[#070607]">.env</code>.
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
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </form>
    </div>
  );
}
