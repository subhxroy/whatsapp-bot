'use client';

import { useState, useEffect } from 'react';
import { Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const [prefix, setPrefix] = useState('.');
  const [logging, setLogging] = useState(false);
  const [ownerNumber, setOwnerNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [isAdmin, setIsAdmin] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        const user = data?.user;
        if (user) {
          const adminCheck = user.role === 'ADMIN' || user.role === 'OWNER';
          setIsAdmin(adminCheck);
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

        setPrefix(map.COMMAND_PREFIX || data.settings?.find((s: { key: string }) => s.key === 'prefix')?.value || '.');
        setLogging(map.MESSAGE_LOGGING === 'true' || data.environment?.messageLogging || false);
        setOwnerNumber(map.BOT_OWNER_NUMBER || data.environment?.ownerNumber || '');
      });
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
            COMMAND_PREFIX: prefix.trim(),
            MESSAGE_LOGGING: String(logging),
            BOT_OWNER_NUMBER: ownerNumber.trim(),
            prefix: prefix.trim(),
          },
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update settings');
      }

      setMsg('General settings saved successfully!');
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
          GENERAL SETTINGS
        </h1>
        <p className="text-sm font-medium text-[#070607]/70 mt-1">
          Bot trigger prefix, owner number, and global operational privacy parameters
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

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-6">
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
                Symbol prefix used for bot commands (e.g. <code className="font-bold text-[#070607]">{prefix || '.'}menu</code>, <code className="font-bold text-[#070607]">{prefix || '.'}ping</code>)
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                Bot Owner Phone Number
              </label>
              <input
                type="text"
                value={ownerNumber}
                onChange={(e) => setOwnerNumber(e.target.value)}
                placeholder="e.g. 919876543210"
                className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-mono text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
              />
              <div className="mt-3 rounded-[20px] bg-[#f5f28e]/80 p-3.5 text-xs text-[#070607]">
                <span className="font-bold block uppercase tracking-wider text-[10px] text-[#070607]">ℹ️ What is Bot Owner Number?</span>
                <p className="mt-1 font-medium leading-relaxed">
                  Enter your personal WhatsApp phone number with country code (e.g. <code className="font-bold">919876543210</code>). High-privilege owner commands (<code className="font-bold">.exec</code>, <code className="font-bold">.eval</code>, <code className="font-bold">.restart</code>, <code className="font-bold">.broadcast</code>) check this number to verify master admin rights.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-dotted border-[#070607]/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[24px] bg-[#e2e2df] p-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                  Message Logging Controls
                </span>
                <div className="mt-1 font-display text-2xl uppercase text-[#070607]">
                  {logging ? 'ENABLED' : 'DISABLED (STRICT)'}
                </div>
                <p className="mt-0.5 text-xs font-medium text-[#070607]/70">
                  Toggle message audit trail logging for incoming and outgoing messages
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLogging(!logging)}
                className={`flex items-center gap-3 rounded-full px-6 py-3 text-xs font-bold uppercase tracking-wider transition ${
                  logging
                    ? 'bg-[#fc5000] text-[#070607]'
                    : 'bg-[#070607] text-[#ffffff]'
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

        {isAdmin ? (
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-[#fc5000] px-8 py-4 text-base font-semibold text-[#070607] transition hover:bg-[#070607] hover:text-[#ffffff] disabled:opacity-50 shadow-md"
          >
            <Save className="h-5 w-5" />
            <span>{saving ? 'Saving Settings...' : 'Save Configuration'}</span>
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
