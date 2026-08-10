'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  Pencil,
  Copy,
  Pause,
  Play,
  RotateCcw,
  Ban,
  History as HistoryIcon,
  Search,
} from 'lucide-react';

type ScheduleStatus = 'PENDING' | 'SENT' | 'FAILED' | 'PROCESSING' | 'PAUSED' | 'CANCELLED' | 'DRAFT';

interface ScheduledMsg {
  id: string;
  targetNumber: string;
  targetJid?: string;
  message: string;
  scheduledAt: string;
  type: 'SCHEDULED' | 'BIRTHDAY';
  status: ScheduleStatus;
  createdAt: string;
  updatedAt?: string;
  title?: string;
  deliveryAttempts?: number;
  lastAttemptAt?: string;
  lastError?: string;
  sentAt?: string;
  sourceScheduleId?: string;
}

interface ScheduleEvent {
  id: string;
  eventType: string;
  status?: ScheduleStatus;
  attempt?: number;
  errorCode?: string;
  errorMessage?: string;
  messageId?: string;
  targetNumber?: string;
  timestamp: string;
}

const STATUS_STYLES: Record<ScheduleStatus, string> = {
  PENDING: 'bg-[#f5f28e] text-[#070607]',
  SENT: 'bg-green-500/20 text-green-700',
  FAILED: 'bg-red-500/15 text-red-700',
  PROCESSING: 'bg-blue-500/15 text-blue-700',
  PAUSED: 'bg-amber-500/15 text-amber-700',
  CANCELLED: 'bg-[#e2e2df] text-[#070607]/60',
  DRAFT: 'bg-[#e2e2df] text-[#070607]',
};

const EVENT_LABELS: Record<string, string> = {
  SCHEDULE_CREATED: 'Schedule created',
  SCHEDULE_UPDATED: 'Schedule updated',
  SCHEDULE_DELETED: 'Schedule deleted',
  SCHEDULE_CANCELLED: 'Schedule cancelled',
  SCHEDULE_PAUSED: 'Schedule paused',
  SCHEDULE_RESUMED: 'Schedule resumed',
  SCHEDULE_DUPLICATED: 'Schedule duplicated',
  SCHEDULE_RETRIED: 'Schedule retried',
  DELIVERY_ATTEMPT: 'Delivery attempt',
  DELIVERY_SENT: 'Delivered',
  DELIVERY_FAILED: 'Delivery failed',
};

const EDITABLE_STATUSES: ScheduleStatus[] = ['PENDING', 'DRAFT', 'PAUSED', 'FAILED'];

export default function SchedulePage() {
  const [messages, setMessages] = useState<ScheduledMsg[]>([]);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ScheduledMsg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Event history viewer
  const [eventsSchedule, setEventsSchedule] = useState<ScheduledMsg | null>(null);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Form states
  const [targetNumber, setTargetNumber] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [hour12, setHour12] = useState<number>(9);
  const [minute12, setMinute12] = useState<string>('00');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
  const [messageText, setMessageText] = useState('');
  const [titleText, setTitleText] = useState('');
  const [type, setType] = useState<'SCHEDULED' | 'BIRTHDAY'>('SCHEDULED');
  const [submitting, setSubmitting] = useState(false);

  const fetchScheduledMessages = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('type', typeFilter);
    params.set('pageSize', '50');
    try {
      const res = await fetch(`/api/scheduled-messages?${params.toString()}`, { credentials: 'include' });
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
  }, [search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchScheduledMessages();
    const interval = setInterval(fetchScheduledMessages, 4000);
    return () => clearInterval(interval);
  }, [fetchScheduledMessages]);

  useEffect(() => {
    if (showModal || eventsSchedule) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal, eventsSchedule]);

  // Compute 24h format for backend calculation
  const selectedTime24 = useMemo(() => {
    let h = hour12;
    if (ampm === 'AM') {
      if (h === 12) h = 0;
    } else {
      if (h !== 12) h += 12;
    }
    const hStr = String(h).padStart(2, '0');
    return `${hStr}:${minute12}`;
  }, [hour12, minute12, ampm]);

  // Quick preset helper
  const applyPreset = (minutesToAdd: number, targetHour?: number) => {
    const d = new Date();
    if (targetHour !== undefined) {
      d.setDate(d.getDate() + (d.getHours() >= targetHour ? 1 : 0));
      d.setHours(targetHour, 0, 0, 0);
    } else {
      d.setMinutes(d.getMinutes() + minutesToAdd);
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);

    const rawHours = d.getHours();
    const exactMins = d.getMinutes();

    setAmpm(rawHours >= 12 ? 'PM' : 'AM');
    setHour12(rawHours % 12 || 12);
    setMinute12(String(exactMins).padStart(2, '0'));
  };

  const openCreate = () => {
    setEditing(null);
    setError('');
    setTargetNumber('');
    setMessageText('');
    setTitleText('');
    setType('SCHEDULED');
    applyPreset(15);
    setShowModal(true);
  };

  const openEdit = (item: ScheduledMsg) => {
    setEditing(item);
    setError('');
    setTargetNumber(item.targetNumber);
    setMessageText(item.message);
    setTitleText(item.title || '');
    setType(item.type);
    const d = new Date(item.scheduledAt);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setSelectedDate(`${year}-${month}-${day}`);
      setAmpm(d.getHours() >= 12 ? 'PM' : 'AM');
      setHour12(d.getHours() % 12 || 12);
      setMinute12(String(d.getMinutes()).padStart(2, '0'));
    } else {
      setSelectedDate('');
    }
    setShowModal(true);
  };

  const openEvents = async (item: ScheduledMsg) => {
    setEventsSchedule(item);
    setEvents([]);
    setEventsLoading(true);
    try {
      const res = await fetch(`/api/scheduled-messages/${item.id}/events`, { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
    } finally {
      setEventsLoading(false);
    }
  };

  const formattedPreview = useMemo(() => {
    if (!selectedDate || !selectedTime24) return null;
    try {
      const d = new Date(`${selectedDate}T${selectedTime24}`);
      if (isNaN(d.getTime())) return null;

      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      let diffStr = '';
      if (diffMs > 0) {
        const diffMins = Math.round(diffMs / (1000 * 60));
        if (diffMins < 60) {
          diffStr = `In ${diffMins} min${diffMins !== 1 ? 's' : ''}`;
        } else {
          const diffHours = (diffMins / 60).toFixed(1);
          diffStr = `In ${diffHours} hours`;
        }
      } else {
        diffStr = 'Past time selected';
      }

      return {
        text: d.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        diffStr,
      };
    } catch {
      return null;
    }
  }, [selectedDate, selectedTime24]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetNumber.trim() || !selectedDate || !selectedTime24 || !messageText.trim()) return;

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const scheduledDateTime = new Date(`${selectedDate}T${selectedTime24}`);
      if (isNaN(scheduledDateTime.getTime())) {
        throw new Error('Invalid date or time selected');
      }

      const isoDate = scheduledDateTime.toISOString();
      const payload = {
        targetNumber: targetNumber.trim(),
        scheduledAt: isoDate,
        message: messageText.trim(),
        type,
        title: titleText.trim() || undefined,
      };

      const res = editing
        ? await fetch(`/api/scheduled-messages/${editing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          })
        : await fetch('/api/scheduled-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save schedule');
      }

      setSuccessMsg(editing ? 'Schedule updated successfully!' : 'Message scheduled successfully!');
      setShowModal(false);
      setEditing(null);
      setTargetNumber('');
      setSelectedDate('');
      setMessageText('');
      setTitleText('');
      setType('SCHEDULED');
      await fetchScheduledMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (item: ScheduledMsg, endpoint: string, successLabel: string) => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/scheduled-messages/${item.id}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `${successLabel} failed`);
      }
      setSuccessMsg(`${successLabel} — ${item.targetNumber}`);
      await fetchScheduledMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${successLabel} failed`);
    }
  };

  const handleDelete = async (item: ScheduledMsg) => {
    if (!window.confirm(`Delete schedule to ${item.targetNumber}? This cannot be undone.`)) return;
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/scheduled-messages/${item.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setSuccessMsg(`Schedule deleted — ${item.targetNumber}`);
      await fetchScheduledMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const isEditable = (s: ScheduleStatus) => EDITABLE_STATUSES.includes(s);

  return (
    <div className="space-y-8 text-[#070607]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#070607]">
            SCHEDULED MESSAGES
          </h1>
          <p className="text-sm font-medium text-[#070607]/70 mt-1">
            Schedule, pause, retry or cancel WhatsApp messages — with full delivery history
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 rounded-full bg-[#fc5000] px-6 py-3.5 text-base font-semibold text-[#070607] transition hover:bg-[#070607] hover:text-[#ffffff] shadow-md"
        >
          <Plus className="h-5 w-5" />
          <span>Schedule New Message</span>
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#070607]/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by recipient or message..."
            className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-3 pl-11 pr-6 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-3 px-4 text-sm font-semibold text-[#070607] focus:border-[#fc5000] focus:outline-none cursor-pointer"
        >
          <option value="">All Statuses</option>
          {(['PENDING', 'SENT', 'FAILED', 'PROCESSING', 'PAUSED', 'CANCELLED', 'DRAFT'] as ScheduleStatus[]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-3 px-4 text-sm font-semibold text-[#070607] focus:border-[#fc5000] focus:outline-none cursor-pointer"
        >
          <option value="">All Types</option>
          <option value="SCHEDULED">SCHEDULED</option>
          <option value="BIRTHDAY">BIRTHDAY</option>
        </select>
      </div>

      <div className="rounded-[40px] bg-[#f7f6f2] p-8 overflow-hidden shadow-sm border border-[#070607]/5">
        {loading ? (
          <div className="py-12 text-center text-[#070607]/60 font-medium text-sm">
            Loading scheduled messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-[#070607]/60">
            <Clock className="mx-auto h-12 w-12 text-[#fc5000] mb-3 opacity-80" />
            <p className="font-display text-2xl uppercase text-[#070607]">No Scheduled Messages</p>
            <p className="text-xs font-medium text-[#070607]/60 mt-1">
              {search || statusFilter || typeFilter
                ? 'No results match your filters.'
                : 'Click "Schedule New Message" above to pick a recipient, date, and message text.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#070607]">
              <thead className="border-b border-dotted border-[#070607]/20 text-xs font-semibold uppercase text-[#070607]/60">
                <tr>
                  <th className="pb-4 pr-6">Recipient</th>
                  <th className="pb-4 px-6">Scheduled Time</th>
                  <th className="pb-4 px-6">Type</th>
                  <th className="pb-4 px-6">Message</th>
                  <th className="pb-4 px-6">Status</th>
                  <th className="pb-4 pl-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-[#070607]/10">
                {messages.map((item) => (
                  <tr key={item.id} className="hover:bg-[#e2e2df]/50 transition">
                    <td className="py-4 pr-6 font-mono font-bold text-[#070607]">
                      <div className="flex items-center gap-1.5">
                        <span>+{item.targetNumber}</span>
                        {item.deliveryAttempts != null && item.deliveryAttempts > 0 && (
                          <span className="rounded-full bg-[#e2e2df] px-2 py-0.5 text-[10px] font-bold text-[#070607]/60">
                            ×{item.deliveryAttempts}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-medium text-[#070607]">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-[#fc5000]" />
                        <span>{new Date(item.scheduledAt).toLocaleString()}</span>
                      </div>
                      {item.lastError && (
                        <div className="mt-1 max-w-[220px] truncate text-[11px] font-semibold text-red-600" title={item.lastError}>
                          {item.lastError}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.type === 'BIRTHDAY'
                            ? 'bg-[#fc5000] text-[#ffffff]'
                            : 'bg-[#e2e2df] text-[#070607]'
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#070607]/80 max-w-xs truncate font-medium">
                      {item.title ? (
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[#070607]/50">
                            {item.title}
                          </div>
                          <div className="truncate">{item.message}</div>
                        </div>
                      ) : (
                        item.message
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${STATUS_STYLES[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 pl-6">
                      <div className="flex items-center justify-end gap-1">
                        {isEditable(item.status) && (
                          <button
                            onClick={() => openEdit(item)}
                            className="rounded-full p-2 text-[#070607]/60 hover:bg-[#070607] hover:text-[#ffffff] transition"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => runAction(item, '/duplicate', 'Schedule duplicated')}
                          className="rounded-full p-2 text-[#070607]/60 hover:bg-[#070607] hover:text-[#ffffff] transition"
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        {item.status === 'PENDING' && (
                          <button
                            onClick={() => runAction(item, '/pause', 'Schedule paused')}
                            className="rounded-full p-2 text-[#070607]/60 hover:bg-amber-500 hover:text-[#070607] transition"
                            title="Pause"
                          >
                            <Pause className="h-4 w-4" />
                          </button>
                        )}
                        {item.status === 'FAILED' && (
                          <button
                            onClick={() => runAction(item, '/pause', 'Schedule paused')}
                            className="rounded-full p-2 text-[#070607]/60 hover:bg-amber-500 hover:text-[#070607] transition"
                            title="Pause"
                          >
                            <Pause className="h-4 w-4" />
                          </button>
                        )}
                        {item.status === 'PAUSED' && (
                          <button
                            onClick={() => runAction(item, '/resume', 'Schedule resumed')}
                            className="rounded-full p-2 text-[#070607]/60 hover:bg-green-500 hover:text-[#070607] transition"
                            title="Resume"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        {item.status === 'FAILED' && (
                          <button
                            onClick={() => runAction(item, '/retry', 'Schedule retried')}
                            className="rounded-full p-2 text-[#070607]/60 hover:bg-[#fc5000] hover:text-[#070607] transition"
                            title="Retry"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        {['PENDING', 'DRAFT', 'PAUSED', 'FAILED'].includes(item.status) && (
                          <button
                            onClick={() => runAction(item, '/cancel', 'Schedule cancelled')}
                            className="rounded-full p-2 text-[#070607]/60 hover:bg-[#070607] hover:text-[#ffffff] transition"
                            title="Cancel"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEvents(item)}
                          className="rounded-full p-2 text-[#070607]/60 hover:bg-[#fc5000] hover:text-[#070607] transition"
                          title="Delivery history"
                        >
                          <HistoryIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="rounded-full p-2 text-[#fc5000] hover:bg-[#fc5000] hover:text-[#070607] transition"
                          title="Delete Schedule"
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
        {messages.length > 0 && (
          <div className="mt-4 text-xs font-semibold text-[#070607]/50">
            Showing {messages.length} of {total} schedules
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#070607]/95 backdrop-blur-xl p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-xl max-h-[90vh] rounded-[40px] bg-[#f7f6f2] shadow-2xl flex flex-col border border-[#070607]/15 overflow-hidden my-auto text-[#070607]">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-dotted border-[#070607]/20 flex-shrink-0 bg-[#f7f6f2]">
              <h2 className="font-display text-3xl sm:text-4xl uppercase text-[#070607]">
                {editing ? 'Edit Schedule' : 'Schedule Message'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full bg-[#e2e2df] p-2 text-[#070607] hover:bg-[#fc5000] hover:text-[#070607] transition"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#070607]/70">
                  Recipient Phone Number (with Country Code)
                </label>
                <input
                  type="text"
                  required
                  value={targetNumber}
                  onChange={(e) => setTargetNumber(e.target.value)}
                  placeholder="e.g. 919876543210 or +91 9876543210"
                  className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#070607]/70">
                  Title (optional label)
                </label>
                <input
                  type="text"
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                  placeholder="e.g. Birthday reminder"
                  maxLength={120}
                  className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                />
              </div>

              <div className="rounded-[32px] bg-[#e2e2df] p-5 space-y-4 border border-[#070607]/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-[#070607]">
                    📅 Scheduled Delivery Time (12-Hour Format)
                  </label>
                  <Sparkles className="h-4 w-4 text-[#fc5000]" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset(15)}
                    className="rounded-full bg-[#f7f6f2] px-3.5 py-1.5 text-xs font-bold text-[#070607] hover:bg-[#fc5000] transition shadow-xs"
                  >
                    +15 Mins
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(60)}
                    className="rounded-full bg-[#f7f6f2] px-3.5 py-1.5 text-xs font-bold text-[#070607] hover:bg-[#fc5000] transition shadow-xs"
                  >
                    +1 Hour
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(180)}
                    className="rounded-full bg-[#f7f6f2] px-3.5 py-1.5 text-xs font-bold text-[#070607] hover:bg-[#fc5000] transition shadow-xs"
                  >
                    +3 Hours
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(0, 9)}
                    className="rounded-full bg-[#f7f6f2] px-3.5 py-1.5 text-xs font-bold text-[#070607] hover:bg-[#fc5000] transition shadow-xs"
                  >
                    Tomorrow 9 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(0, 18)}
                    className="rounded-full bg-[#f7f6f2] px-3.5 py-1.5 text-xs font-bold text-[#070607] hover:bg-[#fc5000] transition shadow-xs"
                  >
                    Tomorrow 6 PM
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#070607]/70 block mb-1.5">
                      Target Date
                    </label>
                    <input
                      type="date"
                      required
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-3 px-4 text-xs font-bold text-[#070607] focus:border-[#fc5000] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#070607]/70 block mb-1.5">
                      Target Time (12-Hour AM/PM)
                    </label>
                    <div className="flex items-center gap-2 bg-[#f7f6f2] p-1.5 rounded-full border border-[#070607]/20">
                      <select
                        value={hour12}
                        onChange={(e) => setHour12(parseInt(e.target.value, 10))}
                        className="rounded-full bg-[#e2e2df] py-1.5 px-3 font-mono text-sm font-extrabold text-[#070607] focus:outline-none cursor-pointer border border-[#070607]/10"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, '0')}
                          </option>
                        ))}
                      </select>

                      <span className="font-mono text-lg font-black text-[#fc5000]">:</span>

                      <select
                        value={minute12}
                        onChange={(e) => setMinute12(e.target.value)}
                        className="rounded-full bg-[#e2e2df] py-1.5 px-3 font-mono text-sm font-extrabold text-[#070607] focus:outline-none cursor-pointer border border-[#070607]/10"
                      >
                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center bg-[#e2e2df] p-1 rounded-full border border-[#070607]/15 ml-auto">
                        <button
                          type="button"
                          onClick={() => setAmpm('AM')}
                          className={`px-3 py-1 text-xs font-black rounded-full transition-all ${
                            ampm === 'AM'
                              ? 'bg-[#fc5000] text-[#070607] shadow-sm'
                              : 'text-[#070607]/60 hover:text-[#070607]'
                          }`}
                        >
                          AM
                        </button>
                        <button
                          type="button"
                          onClick={() => setAmpm('PM')}
                          className={`px-3 py-1 text-xs font-black rounded-full transition-all ${
                            ampm === 'PM'
                              ? 'bg-[#fc5000] text-[#070607] shadow-sm'
                              : 'text-[#070607]/60 hover:text-[#070607]'
                          }`}
                        >
                          PM
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {formattedPreview && (
                  <div className="rounded-[20px] bg-[#f5f28e] p-3 text-xs font-bold text-[#070607] flex items-center justify-between flex-wrap gap-2 shadow-xs">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-[#fc5000]" />
                      <span>{formattedPreview.text}</span>
                    </span>
                    <span className="rounded-full bg-[#070607] px-3 py-1 text-[10px] text-[#ffffff] uppercase font-black tracking-wider">
                      {formattedPreview.diffStr}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#070607]/70">
                  Message Type
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
                  Message Text
                </label>
                <textarea
                  required
                  rows={3}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Enter message to send..."
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
                  {submitting ? (editing ? 'Saving...' : 'Scheduling...') : editing ? 'Save Changes' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delivery History Modal */}
      {eventsSchedule && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#070607]/95 backdrop-blur-xl p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-lg max-h-[90vh] rounded-[40px] bg-[#f7f6f2] shadow-2xl flex flex-col border border-[#070607]/15 overflow-hidden my-auto text-[#070607]">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-dotted border-[#070607]/20 flex-shrink-0 bg-[#f7f6f2]">
              <h2 className="font-display text-2xl sm:text-3xl uppercase text-[#070607]">Delivery History</h2>
              <button
                type="button"
                onClick={() => setEventsSchedule(null)}
                className="rounded-full bg-[#e2e2df] p-2 text-[#070607] hover:bg-[#fc5000] transition"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="mb-4 rounded-[24px] bg-[#e2e2df] p-4 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-mono font-bold">+{eventsSchedule.targetNumber}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${STATUS_STYLES[eventsSchedule.status]}`}>
                    {eventsSchedule.status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-[#070607]/60">
                  Scheduled: {new Date(eventsSchedule.scheduledAt).toLocaleString()}
                </div>
                {eventsSchedule.deliveryAttempts != null && (
                  <div className="mt-1 text-xs text-[#070607]/60">
                    Delivery attempts: {eventsSchedule.deliveryAttempts}
                  </div>
                )}
              </div>

              {eventsLoading ? (
                <div className="py-8 text-center text-sm font-medium text-[#070607]/60">Loading history...</div>
              ) : events.length === 0 ? (
                <div className="py-8 text-center">
                  <HistoryIcon className="mx-auto h-10 w-10 text-[#fc5000] mb-2 opacity-80" />
                  <p className="text-sm font-medium text-[#070607]/60">No events recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...events]
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    .map((ev) => (
                      <div key={ev.id} className="flex gap-3 items-start rounded-[20px] bg-[#e2e2df] p-3.5">
                        <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f7f6f2]">
                          <Clock className="h-4 w-4 text-[#fc5000]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#070607]">
                              {EVENT_LABELS[ev.eventType] || ev.eventType}
                            </span>
                            <span className="text-[11px] font-semibold text-[#070607]/50">
                              {new Date(ev.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {ev.status && (
                            <div className="mt-1">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[ev.status]}`}>
                                {ev.status}
                              </span>
                            </div>
                          )}
                          {ev.attempt != null && (
                            <div className="mt-1 text-xs text-[#070607]/60">Attempt #{ev.attempt}</div>
                          )}
                          {ev.errorMessage && (
                            <div className="mt-1 text-xs font-semibold text-red-600">
                              {ev.errorMessage}
                              {ev.errorCode ? ` (${ev.errorCode})` : ''}
                            </div>
                          )}
                          {ev.messageId && (
                            <div className="mt-1 truncate font-mono text-[11px] text-[#070607]/50">
                              msg: {ev.messageId}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
