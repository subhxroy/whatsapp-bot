'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, Lock, Search, Image as ImageIcon, EyeOff } from 'lucide-react';

interface HistoryRecord {
  id: string;
  messageId: string;
  chatId: string;
  senderJid: string;
  senderNumber: string;
  fromMe: boolean;
  isGroup: boolean;
  messageType: string;
  body?: string | null;
  hasMedia: boolean;
  mediaType?: string | null;
  isViewOnce: boolean;
  timestamp: string;
}

export default function MessageHistoryPage() {
  const [messages, setMessages] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState('');
  const [chatId, setChatId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');

  const fetchHistory = useCallback(async () => {
    const params = new URLSearchParams();
    if (chatId.trim()) params.set('chatId', chatId.trim());
    if (senderNumber.trim()) params.set('senderNumber', senderNumber.trim());
    params.set('limit', '100');
    try {
      const res = await fetch(`/api/message-history?${params.toString()}`, { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.status === 403) {
        setDisabled(true);
        setMessages([]);
        return;
      }
      if (res.ok) {
        setDisabled(false);
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load message history');
    } finally {
      setLoading(false);
    }
  }, [chatId, senderNumber]);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  return (
    <div className="space-y-8 text-[#070607]">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#070607]">
          MESSAGE HISTORY
        </h1>
        <p className="text-sm font-medium text-[#070607]/70 mt-1">
          Recent messages seen by the bot. Bodies are only persisted when a content-retention policy is configured.
        </p>
      </div>

      {disabled && (
        <div className="flex items-start gap-3 rounded-[24px] bg-[#e2e2df] p-5 text-sm font-semibold text-[#070607]">
          <Lock className="h-5 w-5 flex-shrink-0 text-[#fc5000]" />
          <div>
            <p>Message history is currently disabled.</p>
            <p className="mt-1 text-xs font-medium text-[#070607]/60">
              Enable it by setting <span className="font-mono font-bold">MESSAGE_HISTORY_ENABLED=true</span> and
              optionally <span className="font-mono font-bold">MESSAGE_CONTENT_RETENTION=7d|30d|90d</span> in the
              server environment. Bodies are never stored under the default
              <span className="font-mono font-bold"> metadata</span> policy.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-[24px] bg-[#fc5000]/15 p-4 text-sm font-semibold text-[#fc5000]">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#070607]/40" />
          <input
            type="text"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="Chat JID (e.g. 919xxxx@s.whatsapp.net)"
            className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-3 pl-11 pr-6 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
          />
        </div>
        <input
          type="text"
          value={senderNumber}
          onChange={(e) => setSenderNumber(e.target.value)}
          placeholder="Sender number (digits only)"
          className="sm:w-72 rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-3 px-6 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
        />
      </div>

      <div className="rounded-[40px] bg-[#f7f6f2] p-8 overflow-hidden shadow-sm border border-[#070607]/5">
        {loading ? (
          <div className="py-12 text-center text-[#070607]/60 font-medium text-sm">Loading message history...</div>
        ) : disabled ? (
          <div className="py-12 text-center text-[#070607]/60">
            <Lock className="mx-auto h-12 w-12 text-[#fc5000] mb-3 opacity-80" />
            <p className="font-display text-2xl uppercase text-[#070607]">History Disabled</p>
            <p className="text-xs font-medium text-[#070607]/60 mt-1">
              Message history is off by default for privacy. Enable it in the server environment to view the feed.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-[#070607]/60">
            <History className="mx-auto h-12 w-12 text-[#fc5000] mb-3 opacity-80" />
            <p className="font-display text-2xl uppercase text-[#070607]">No Messages Recorded</p>
            <p className="text-xs font-medium text-[#070607]/60 mt-1">
              {chatId || senderNumber
                ? 'No messages match your filters.'
                : 'New messages seen by the bot will appear here in real time.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-3 rounded-[24px] bg-[#e2e2df] p-4">
                <div
                  className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    m.fromMe ? 'bg-[#070607] text-[#ffffff]' : 'bg-[#fc5000] text-[#070607]'
                  }`}
                >
                  {m.fromMe ? 'ME' : '+'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-mono text-sm font-bold text-[#070607]">
                      {m.fromMe ? 'You' : `+${m.senderNumber}`}
                    </span>
                    <span className="text-[11px] font-semibold text-[#070607]/50">
                      {new Date(m.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-[#f7f6f2] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#070607]/60">
                      {m.messageType}
                    </span>
                    {m.isGroup && (
                      <span className="rounded-full bg-[#f7f6f2] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#070607]/60">
                        group
                      </span>
                    )}
                    {m.isViewOnce && (
                      <span className="flex items-center gap-1 rounded-full bg-[#f7f6f2] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#070607]/60">
                        <EyeOff className="h-3 w-3" /> view once
                      </span>
                    )}
                    {m.hasMedia && (
                      <span className="flex items-center gap-1 rounded-full bg-[#f7f6f2] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#fc5000]">
                        <ImageIcon className="h-3 w-3" /> {m.mediaType || 'media'}
                      </span>
                    )}
                  </div>
                  {m.body ? (
                    <p className="mt-2 text-sm font-medium text-[#070607]/80 break-words whitespace-pre-wrap">{m.body}</p>
                  ) : (
                    <p className="mt-2 text-xs font-semibold text-[#070607]/40">Content not retained</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
