'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, FileText, X, Pencil, CheckCircle2, AlertCircle } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  message: string;
  type: 'SCHEDULED' | 'BIRTHDAY';
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'SCHEDULED' | 'BIRTHDAY'>('SCHEDULED');
  const [submitting, setSubmitting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates', { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    document.body.style.overflow = showModal ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setMessage('');
    setType('SCHEDULED');
    setError('');
    setShowModal(true);
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setName(t.name);
    setMessage(t.message);
    setType(t.type);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const payload = { name: name.trim(), message: message.trim(), type };
      const res = editing
        ? await fetch(`/api/templates/${editing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          })
        : await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save template');
      setSuccessMsg(editing ? 'Template updated!' : 'Template created!');
      setShowModal(false);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (t: Template) => {
    if (!window.confirm(`Delete template '${t.name}'?`)) return;
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/templates/${t.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setSuccessMsg(`Template '${t.name}' deleted`);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-8 text-[#070607]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#070607]">
            MESSAGE TEMPLATES
          </h1>
          <p className="text-sm font-medium text-[#070607]/70 mt-1">
            Reusable message templates for scheduled messages and birthday wishes
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 rounded-full bg-[#fc5000] px-6 py-3.5 text-base font-semibold text-[#070607] transition hover:bg-[#070607] hover:text-[#ffffff] shadow-md"
        >
          <Plus className="h-5 w-5" />
          <span>New Template</span>
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-[24px] bg-[#f5f28e] p-4 text-sm font-semibold text-[#070607]">
          <CheckCircle2 className="h-5 w-5 text-[#fc5000]" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-[24px] bg-[#fc5000]/15 p-4 text-sm font-semibold text-[#fc5000]">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-[40px] bg-[#f7f6f2] p-8 shadow-sm border border-[#070607]/5">
        {loading ? (
          <div className="py-12 text-center text-[#070607]/60 font-medium text-sm">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="py-12 text-center text-[#070607]/60">
            <FileText className="mx-auto h-12 w-12 text-[#fc5000] mb-3 opacity-80" />
            <p className="font-display text-2xl uppercase text-[#070607]">No Templates</p>
            <p className="text-xs font-medium text-[#070607]/60 mt-1">
              Create a template to quickly reuse a message when scheduling.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {templates.map((t) => (
              <div key={t.id} className="rounded-[32px] bg-[#e2e2df] p-6 border border-[#070607]/10 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-xl uppercase tracking-wide text-[#070607] truncate">
                      {t.name}
                    </h3>
                    <span
                      className={`mt-1 inline-block rounded-full px-3 py-0.5 text-[10px] font-bold uppercase ${
                        t.type === 'BIRTHDAY' ? 'bg-[#fc5000] text-[#ffffff]' : 'bg-[#f7f6f2] text-[#070607]'
                      }`}
                    >
                      {t.type}
                    </span>
                  </div>
                  <FileText className="h-5 w-5 text-[#fc5000] flex-shrink-0" />
                </div>
                <p className="mt-4 text-sm font-medium text-[#070607]/80 whitespace-pre-wrap break-words line-clamp-5">
                  {t.message}
                </p>
                <div className="mt-5 pt-4 border-t border-dotted border-[#070607]/15 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#070607]/50">
                    Updated {new Date(t.updatedAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(t)}
                      className="rounded-full p-2 text-[#070607]/60 hover:bg-[#070607] hover:text-[#ffffff] transition"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t)}
                      className="rounded-full p-2 text-[#fc5000] hover:bg-[#fc5000] hover:text-[#070607] transition"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#070607]/95 backdrop-blur-xl p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-xl max-h-[90vh] rounded-[40px] bg-[#f7f6f2] shadow-2xl flex flex-col border border-[#070607]/15 overflow-hidden my-auto text-[#070607]">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-dotted border-[#070607]/20 flex-shrink-0 bg-[#f7f6f2]">
              <h2 className="font-display text-3xl sm:text-4xl uppercase text-[#070607]">
                {editing ? 'Edit Template' : 'New Template'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full bg-[#e2e2df] p-2 text-[#070607] hover:bg-[#fc5000] transition"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#070607]/70">
                  Template Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Birthday greeting"
                  maxLength={120}
                  className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#070607]/70">
                  Template Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'SCHEDULED' | 'BIRTHDAY')}
                  className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-medium text-[#070607] focus:border-[#fc5000] focus:outline-none"
                >
                  <option value="SCHEDULED">Standard Scheduled Message</option>
                  <option value="BIRTHDAY">Birthday Wish</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#070607]/70">
                  Message Body
                </label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter reusable message text..."
                  className="w-full rounded-[24px] border-1.5 border-[#070607]/20 bg-[#e2e2df] p-4 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-full border border-[#070607] py-3.5 text-sm font-semibold text-[#070607] hover:bg-[#e2e2df] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-full bg-[#fc5000] py-3.5 text-sm font-semibold text-[#070607] hover:bg-[#070607] hover:text-[#ffffff] disabled:opacity-50 transition shadow-md"
                >
                  {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
