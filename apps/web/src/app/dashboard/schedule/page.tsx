'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Clock, Calendar, CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';

interface ScheduledMsgItem {
  id: string;
  targetNumber: string;
  targetJid?: string;
  message: string;
  scheduledAt: string;
  type: 'SCHEDULED' | 'BIRTHDAY';
  status: 'PENDING' | 'SENT';
  createdAt: string;
}

export default function SchedulePage() {
  const [messages, setMessages] = useState<ScheduledMsgItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [targetNumber, setTargetNumber] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  
  // Custom 12-Hour AM/PM Time Selector states
  const [hour12, setHour12] = useState<number>(11);
  const [minute12, setMinute12] = useState<string>('30');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');

  const [messageText, setMessageText] = useState('');
  const [type, setType] = useState<'SCHEDULED' | 'BIRTHDAY'>('SCHEDULED');
  const [submitting, setSubmitting] = useState(false);

  const fetchScheduledMessages = async () => {
    try {
      const res = await fetch('/api/scheduled-messages', { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduledMessages();
    const interval = setInterval(fetchScheduledMessages, 3000);
    return () => clearInterval(interval);
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
    const roundedMins = Math.floor(d.getMinutes() / 5) * 5;
    
    setAmpm(rawHours >= 12 ? 'PM' : 'AM');
    setHour12(rawHours % 12 || 12);
    setMinute12(String(roundedMins).padStart(2, '0'));
  };

  // Formatted preview computation
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

  const handleCreateSchedule = async (e: React.FormEvent) => {
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

      const res = await fetch('/api/scheduled-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetNumber: targetNumber.trim(),
          scheduledAt: isoDate,
          message: messageText.trim(),
          type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to schedule message');
      }

      setSuccessMsg('Message scheduled successfully!');
      setShowModal(false);
      setTargetNumber('');
      setSelectedDate('');
      setMessageText('');
      setType('SCHEDULED');
      await fetchScheduledMessages();
    } catch (err: any) {
      setError(err.message || 'Failed to create schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/scheduled-messages/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await fetchScheduledMessages();
    } catch (err) {
      console.error(err);
    }
  };

  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <div className="space-y-8 text-[#070607]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#070607]">
            SCHEDULED MESSAGES
          </h1>
          <p className="text-sm font-medium text-[#070607]/70 mt-1">
            Schedule automated WhatsApp messages or birthday wishes to any contact at any time
          </p>
        </div>
        <button
          onClick={() => {
            setError('');
            applyPreset(15);
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-2 rounded-full bg-[#fc5000] px-6 py-3.5 text-base font-semibold text-[#070607] transition hover:bg-[#070607] hover:text-[#ffffff]"
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

      <div className="rounded-[40px] bg-[#f7f6f2] p-8 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[#070607]/60 font-medium text-sm">
            Loading scheduled messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-[#070607]/60">
            <Clock className="mx-auto h-12 w-12 text-[#fc5000] mb-3 opacity-80" />
            <p className="font-display text-2xl uppercase text-[#070607]">No Scheduled Messages</p>
            <p className="text-xs font-medium text-[#070607]/60 mt-1">
              Click "Schedule New Message" above to pick a recipient, date, and message text.
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
                      +{item.targetNumber}
                    </td>
                    <td className="py-4 px-6 font-medium text-[#070607]">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-[#fc5000]" />
                        <span>{new Date(item.scheduledAt).toLocaleString()}</span>
                      </div>
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
                      {item.message}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                          item.status === 'SENT'
                            ? 'bg-green-500/20 text-green-700'
                            : 'bg-[#f5f28e] text-[#070607]'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 pl-6 text-right">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-full p-2 text-[#fc5000] hover:bg-[#fc5000] hover:text-[#070607] transition"
                        title="Delete / Cancel Schedule"
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
      </div>

      {/* Modal - Fixed Overflow, Body Lock, Sleek Padded Scrollbar & Clean 12h Clock */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070607]/75 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-[40px] bg-[#f7f6f2] p-6 sm:p-8 shadow-2xl space-y-5 text-[#070607] my-auto max-h-[88vh] overflow-y-auto custom-scrollbar border border-[#070607]/10">
            <div className="flex items-center justify-between pb-2 border-b border-dotted border-[#070607]/20">
              <h2 className="font-display text-3xl sm:text-4xl uppercase text-[#070607]">Schedule Message</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full bg-[#e2e2df] p-2 text-[#070607] hover:bg-[#fc5000] hover:text-[#070607] transition"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                  Recipient Phone Number (with Country Code)
                </label>
                <input
                  type="text"
                  required
                  value={targetNumber}
                  onChange={(e) => setTargetNumber(e.target.value)}
                  placeholder="e.g. 919876543210 or +91 9876543210"
                  className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3 px-5 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                />
              </div>

              {/* Custom Date & 12-Hour AM/PM Time Selector Component */}
              <div className="rounded-[32px] bg-[#e2e2df] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#070607]">
                    📅 Scheduled Delivery Time (12-Hour Format)
                  </label>
                  <Sparkles className="h-4 w-4 text-[#fc5000]" />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset(15)}
                    className="rounded-full bg-[#f7f6f2] px-3 py-1.5 text-xs font-bold text-[#070607] hover:bg-[#fc5000] transition"
                  >
                    +15 Mins
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(60)}
                    className="rounded-full bg-[#f7f6f2] px-3 py-1.5 text-xs font-bold text-[#070607] hover:bg-[#fc5000] transition"
                  >
                    +1 Hour
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(180)}
                    className="rounded-full bg-[#f7f6f2] px-3 py-1.5 text-xs font-bold text-[#070607] hover:bg-[#fc5000] transition"
                  >
                    +3 Hours
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(0, 9)}
                    className="rounded-full bg-[#f7f6f2] px-3 py-1.5 text-xs font-bold text-[#070607] hover:bg-[#fc5000] transition"
                  >
                    Tomorrow 9 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(0, 18)}
                    className="rounded-full bg-[#f7f6f2] px-3 py-1.5 text-xs font-bold text-[#070607] hover:bg-[#fc5000] transition"
                  >
                    Tomorrow 6 PM
                  </button>
                </div>

                {/* Custom 12-Hour Selector Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 items-end">
                  <div className="sm:col-span-5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#070607]/60 block mb-1">
                      Target Date
                    </span>
                    <input
                      type="date"
                      required
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-2.5 px-4 text-xs font-semibold text-[#070607] focus:border-[#fc5000] focus:outline-none"
                    />
                  </div>

                  {/* 12-Hour AM/PM Time Selector */}
                  <div className="sm:col-span-7">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#070607]/60 block mb-1">
                      Target Time (12h Clock)
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                      {/* Hour Dropdown (1-12) */}
                      <select
                        value={hour12}
                        onChange={(e) => setHour12(parseInt(e.target.value, 10))}
                        className="rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-2.5 px-3 text-xs font-bold text-[#070607] focus:border-[#fc5000] focus:outline-none min-w-[60px]"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, '0')}
                          </option>
                        ))}
                      </select>

                      <span className="font-bold text-sm text-[#070607]">:</span>

                      {/* Minute Dropdown (00-55) */}
                      <select
                        value={minute12}
                        onChange={(e) => setMinute12(e.target.value)}
                        className="rounded-full border-1.5 border-[#070607]/20 bg-[#f7f6f2] py-2.5 px-3 text-xs font-bold text-[#070607] focus:border-[#fc5000] focus:outline-none min-w-[60px]"
                      >
                        {minutesList.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>

                      {/* AM/PM Toggle Pills */}
                      <div className="flex items-center bg-[#f7f6f2] p-1 rounded-full border border-[#070607]/10 flex-shrink-0 ml-auto">
                        <button
                          type="button"
                          onClick={() => setAmpm('AM')}
                          className={`px-3 py-1 text-[11px] font-extrabold rounded-full transition ${
                            ampm === 'AM'
                              ? 'bg-[#fc5000] text-[#070607]'
                              : 'text-[#070607]/60 hover:text-[#070607]'
                          }`}
                        >
                          AM
                        </button>
                        <button
                          type="button"
                          onClick={() => setAmpm('PM')}
                          className={`px-3 py-1 text-[11px] font-extrabold rounded-full transition ${
                            ampm === 'PM'
                              ? 'bg-[#fc5000] text-[#070607]'
                              : 'text-[#070607]/60 hover:text-[#070607]'
                          }`}
                        >
                          PM
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Human-Readable Delivery Target Preview Card */}
                {formattedPreview && (
                  <div className="rounded-[20px] bg-[#f5f28e] p-3 text-xs font-semibold text-[#070607] flex items-center justify-between">
                    <span>📅 {formattedPreview.text}</span>
                    <span className="rounded-full bg-[#070607] px-2.5 py-0.5 text-[10px] text-[#ffffff] uppercase font-bold">
                      {formattedPreview.diffStr}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                  Message Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3 px-5 text-sm font-medium text-[#070607] focus:border-[#fc5000] focus:outline-none"
                >
                  <option value="SCHEDULED">Standard Scheduled Message</option>
                  <option value="BIRTHDAY">Birthday Wish</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
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
                  className="flex-1 rounded-full border border-[#070607] py-3 text-sm font-semibold text-[#070607] hover:bg-[#e2e2df]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-full bg-[#fc5000] py-3 text-sm font-semibold text-[#070607] hover:bg-[#070607] hover:text-[#ffffff] disabled:opacity-50"
                >
                  {submitting ? 'Scheduling...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
