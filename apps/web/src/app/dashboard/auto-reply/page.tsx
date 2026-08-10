'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, MessageSquare, Target, X } from 'lucide-react';

interface AutoReplyRule {
  id: string;
  trigger: string;
  matchType: 'EXACT' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'REGEX' | 'ANY';
  specificNumber?: string | null;
  response: string;
  enabled: boolean;
  priority: number;
  cooldown: number;
}

export default function AutoReplyPage() {
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoReplyRule | null>(null);

  // Form state
  const [trigger, setTrigger] = useState('');
  const [matchType, setMatchType] = useState<AutoReplyRule['matchType']>('EXACT');
  const [specificNumber, setSpecificNumber] = useState('');
  const [response, setResponse] = useState('');
  const [priority, setPriority] = useState(1);
  const [cooldown, setCooldown] = useState(5);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/auto-replies', { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      setRules(data.rules || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const openCreateModal = () => {
    setEditingRule(null);
    setTrigger('');
    setMatchType('EXACT');
    setSpecificNumber('');
    setResponse('');
    setPriority(1);
    setCooldown(5);
    setShowModal(true);
  };

  const openEditModal = (rule: AutoReplyRule) => {
    setEditingRule(rule);
    setTrigger(rule.trigger);
    setMatchType(rule.matchType);
    setSpecificNumber(rule.specificNumber ? rule.specificNumber.replace(/\D/g, '') : '');
    setResponse(rule.response);
    setPriority(rule.priority ?? 1);
    setCooldown(rule.cooldown ?? 5);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const finalTrigger = matchType === 'ANY' ? (trigger.trim() || '*') : trigger.trim();

    try {
      const isEdit = !!editingRule;
      const url = isEdit ? `/api/auto-replies/${editingRule.id}` : '/api/auto-replies';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trigger: finalTrigger,
          matchType,
          specificNumber: specificNumber.trim() || null,
          response,
          priority,
          cooldown,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingRule(null);
        setTrigger('');
        setSpecificNumber('');
        setResponse('');
        fetchRules();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/auto-replies/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchRules();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 text-[#070607]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#070607]">
            AUTO-REPLY RULES
          </h1>
          <p className="text-sm font-medium text-[#070607]/70 mt-1">
            Automated keyword triggers, target phone number filters, and contextual responses
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 rounded-full bg-[#fc5000] px-6 py-3.5 text-base font-semibold text-[#070607] transition hover:bg-[#070607] hover:text-[#ffffff] shadow-md"
        >
          <Plus className="h-5 w-5" />
          <span>Add New Rule</span>
        </button>
      </div>

      <div className="rounded-[40px] bg-[#f7f6f2] p-8 overflow-hidden shadow-sm border border-[#070607]/5">
        {loading ? (
          <div className="py-12 text-center text-[#070607]/60 font-medium text-sm">
            Loading rules...
          </div>
        ) : rules.length === 0 ? (
          <div className="py-12 text-center text-[#070607]/60">
            <MessageSquare className="mx-auto h-12 w-12 text-[#fc5000] mb-3 opacity-80" />
            <p className="font-display text-2xl uppercase text-[#070607]">No Auto-Reply Rules Configured</p>
            <p className="text-xs font-medium text-[#070607]/60 mt-1">Click &quot;Add New Rule&quot; above to create automated keyword triggers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#070607]">
              <thead className="border-b border-dotted border-[#070607]/20 text-xs font-semibold uppercase text-[#070607]/60">
                <tr>
                  <th className="pb-4 pr-6">Trigger</th>
                  <th className="pb-4 px-6">Match Type</th>
                  <th className="pb-4 px-6">Target Contact</th>
                  <th className="pb-4 px-6">Response</th>
                  <th className="pb-4 px-6">Priority</th>
                  <th className="pb-4 pl-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-[#070607]/10">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-[#e2e2df]/50 transition">
                    <td className="py-4 pr-6 font-mono font-bold text-[#070607]">{rule.trigger}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          rule.matchType === 'ANY'
                            ? 'bg-[#fc5000] text-[#ffffff]'
                            : 'bg-[#f5f28e] text-[#070607]'
                        }`}
                      >
                        {rule.matchType === 'ANY' ? 'ANY MESSAGE' : rule.matchType}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs">
                      {rule.specificNumber ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#070607] px-3 py-1 font-semibold text-[#ffffff]">
                          <Target className="h-3 w-3 text-[#fc5000]" />
                          +{rule.specificNumber.replace(/\D/g, '')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#e2e2df] px-3 py-1 font-semibold text-[#070607]/70">
                          🌐 All Contacts
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-[#070607]/80 max-w-xs truncate font-medium">{rule.response}</td>
                    <td className="py-4 px-6 text-xs font-semibold text-[#070607]">{rule.priority}</td>
                    <td className="py-4 pl-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(rule)}
                          className="rounded-full p-2 text-[#070607] hover:bg-[#fc5000] hover:text-[#070607] transition"
                          title="Edit Auto-Reply Rule"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="rounded-full p-2 text-[#fc5000] hover:bg-[#fc5000] hover:text-[#070607] transition"
                          title="Delete Rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#070607]/95 backdrop-blur-xl p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-xl max-h-[90vh] rounded-[40px] bg-[#f7f6f2] shadow-2xl flex flex-col border border-[#070607]/15 overflow-hidden my-auto text-[#070607]">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-dotted border-[#070607]/20 flex-shrink-0 bg-[#f7f6f2]">
              <h2 className="font-display text-3xl sm:text-4xl uppercase text-[#070607]">
                {editingRule ? 'Edit Auto-Reply Rule' : 'Create Auto-Reply Rule'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingRule(null);
                }}
                className="rounded-full bg-[#e2e2df] p-2 text-[#070607] hover:bg-[#fc5000] hover:text-[#070607] transition"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#070607]/70">
                  Trigger Keyword / Regex
                </label>
                <input
                  type="text"
                  required={matchType !== 'ANY'}
                  value={matchType === 'ANY' && !trigger ? '*' : trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  placeholder={matchType === 'ANY' ? 'Matches ANY incoming message (*)' : 'e.g. hello or ^price'}
                  className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#070607]/70">
                  Match Type
                </label>
                <select
                  value={matchType}
                  onChange={(e) => {
                    const newType = e.target.value as AutoReplyRule['matchType'];
                    setMatchType(newType);
                    if (newType === 'ANY' && !trigger) {
                      setTrigger('*');
                    }
                  }}
                  className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-medium text-[#070607] focus:border-[#fc5000] focus:outline-none"
                >
                  <option value="EXACT">EXACT</option>
                  <option value="CONTAINS">CONTAINS</option>
                  <option value="STARTS_WITH">STARTS_WITH</option>
                  <option value="ENDS_WITH">ENDS_WITH</option>
                  <option value="REGEX">REGEX</option>
                  <option value="ANY">ANY MESSAGE (Catch-All / Wildcard)</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#070607]/70">
                  Target Contact Phone Number (Optional Filter)
                </label>
                <input
                  type="text"
                  value={specificNumber}
                  onChange={(e) => setSpecificNumber(e.target.value)}
                  placeholder="e.g. 919876543210 (Leave empty to apply to all numbers)"
                  className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                />
                <p className="mt-1 text-[11px] font-medium text-[#070607]/60">
                  If set, this rule will ONLY auto-reply when this specific contact messages you.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#070607]/70">
                  Automated Response
                </label>
                <textarea
                  required
                  rows={3}
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Enter response text..."
                  className="w-full rounded-[24px] border-1.5 border-[#070607]/20 bg-[#e2e2df] p-4 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingRule(null);
                  }}
                  className="flex-1 rounded-full border border-[#070607] py-3.5 text-sm font-semibold text-[#070607] hover:bg-[#e2e2df] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-full bg-[#fc5000] py-3.5 text-sm font-semibold text-[#070607] hover:bg-[#070607] hover:text-[#ffffff] disabled:opacity-50 transition shadow-md"
                >
                  {submitting ? 'Saving...' : editingRule ? 'Update Rule' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


