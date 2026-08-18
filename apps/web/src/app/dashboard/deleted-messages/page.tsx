'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, MessageSquareOff, Search, CheckCircle2, AlertCircle, Image as ImageIcon } from 'lucide-react';

interface DeletedMessage {
  id: string;
  chatId: string;
  senderJid: string;
  senderNumber: string;
  senderResolved: boolean;
  fromMe: boolean;
  messageType: string;
  body?: string | null;
  hasMedia: boolean;
  mediaType?: string | null;
  originalMessageId: string;
  originalTimestamp?: number;
  deletedAt: string;
  contentAvailable: boolean;
  retainedUntil: string;
}

export default function DeletedMessagesPage() {
  const [messages, setMessages] = useState<DeletedMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [chatId, setChatId] = useState('');
  const [fromMe, setFromMe] = useState('');

  const fetchMessages = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (chatId.trim()) params.set('chatId', chatId.trim());
    if (fromMe) params.set('fromMe', fromMe);
    params.set('pageSize', '50');
    try {
      const res = await fetch(`/api/deleted-messages?${params.toString()}`, { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setTotal(data.total ?? (data.messages || []).length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, chatId, fromMe]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handlePurge = async (m: DeletedMessage) => {
    if (!window.confirm('Permanently delete this deleted-message record?')) return;
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/deleted-messages/${m.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setSuccessMsg('Record purged');
      await fetchMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-8 text-[#070607]">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#070607]">
          DELETED MESSAGES
        </h1>
        <p className="text-sm font-medium text-[#070607]/70 mt-1">
          Messages revoked by a sender. Content is recovered only from the local cache at revoke time — never fabricated.
        </p>
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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#070607]/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by sender number, chat, or content..."
            className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-3 pl-11 pr-6 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
          />
        </div>
        <input
          type="text"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="Chat JID (e.g. 919xxxx@s.whatsapp.net)"
          className="sm:w-72 rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-3 px-6 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
        />
        <select
          value={fromMe}
          onChange={(e) => setFromMe(e.target.value)}
          className="rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-3 px-4 text-sm font-semibold text-[#070607] focus:border-[#fc5000] focus:outline-none cursor-pointer"
        >
          <option value="">All Directions</option>
          <option value="true">From me</option>
          <option value="false">From them</option>
        </select>
      </div>

      <div className="rounded-[40px] bg-[#f7f6f2] p-8 overflow-hidden shadow-sm border border-[#070607]/5">
        {loading ? (
          <div className="py-12 text-center text-[#070607]/60 font-medium text-sm">Loading deleted messages...</div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-[#070607]/60">
            <MessageSquareOff className="mx-auto h-12 w-12 text-[#fc5000] mb-3 opacity-80" />
            <p className="font-display text-2xl uppercase text-[#070607]">No Deleted Messages</p>
            <p className="text-xs font-medium text-[#070607]/60 mt-1">
              When someone revokes a message while the bot is watching the chat, it will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#070607]">
              <thead className="border-b border-dotted border-[#070607]/20 text-xs font-semibold uppercase text-[#070607]/60">
                <tr>
                  <th className="pb-4 pr-6">Sender</th>
                  <th className="pb-4 px-6">Content</th>
                  <th className="pb-4 px-6">Type</th>
                  <th className="pb-4 px-6">Deleted At</th>
                  <th className="pb-4 px-6">Retained Until</th>
                  <th className="pb-4 pl-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-[#070607]/10">
                {messages.map((m) => (
                  <tr key={m.id} className="hover:bg-[#e2e2df]/50 transition">
                    <td className="py-4 pr-6 font-mono font-bold text-[#070607]">
                      <div className="flex items-center gap-1.5">
                        <span>+{m.senderNumber}</span>
                        {m.fromMe && (
                          <span className="rounded-full bg-[#070607] px-2 py-0.5 text-[10px] font-bold uppercase text-[#ffffff]">
                            You
                          </span>
                        )}
                        {!m.senderResolved && (
                          <span
                            className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700"
                            title="Sender identity could not be resolved (LID-only)"
                          >
                            LID
                          </span>
                        )}
                      </div>
                      <div className="mt-1 font-mono text-[10px] font-medium text-[#070607]/40">{m.chatId}</div>
                    </td>
                    <td className="py-4 px-6 max-w-xs">
                      {m.contentAvailable ? (
                        <span className="font-medium text-[#070607]/80 break-words line-clamp-3">
                          {m.body || (m.hasMedia ? `[Deleted ${m.mediaType || 'Media'}]` : 'Empty message')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#e2e2df] px-3 py-1 text-[11px] font-semibold text-[#070607]/60">
                          Content not available
                        </span>
                      )}
                      {m.hasMedia && (
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#fc5000]">
                          <ImageIcon className="h-3.5 w-3.5" />
                          {m.mediaType || 'media'}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="rounded-full bg-[#e2e2df] px-3 py-1 text-[11px] font-semibold uppercase text-[#070607]/70">
                        {m.messageType}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs font-semibold text-[#070607]/70">
                      {new Date(m.deletedAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-xs font-semibold text-[#070607]/50">
                      {new Date(m.retainedUntil).toLocaleDateString()}
                    </td>
                    <td className="py-4 pl-6 text-right">
                      <button
                        onClick={() => handlePurge(m)}
                        className="rounded-full p-2 text-[#fc5000] hover:bg-[#fc5000] hover:text-[#070607] transition"
                        title="Purge record"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {messages.length > 0 && (
          <div className="mt-4 text-xs font-semibold text-[#070607]/50">
            Showing {messages.length} of {total} deleted messages
          </div>
        )}
      </div>
    </div>
  );
}
