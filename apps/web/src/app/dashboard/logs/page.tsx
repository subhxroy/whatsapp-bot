'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  actor: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs', { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-8 text-[#070607]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#070607]">
            ADMINISTRATIVE AUDIT LOGS
          </h1>
          <p className="text-sm font-medium text-[#070607]/70 mt-1">
            Security audit trail of dashboard logins, settings changes, and session events
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center justify-center gap-2 rounded-full bg-[#f7f6f2] px-6 py-3.5 text-sm font-semibold text-[#070607] transition hover:bg-[#fc5000]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      <div className="rounded-[40px] bg-[#f7f6f2] p-8 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[#070607]/60 font-medium text-sm">
            Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-[#070607]/60">
            <ShieldAlert className="mx-auto h-12 w-12 text-[#fc5000] mb-3 opacity-80" />
            <p className="font-display text-2xl uppercase text-[#070607]">No Audit Events Logged</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#070607]">
              <thead className="border-b border-dotted border-[#070607]/20 text-xs font-semibold uppercase text-[#070607]/60">
                <tr>
                  <th className="pb-4 pr-6">Action</th>
                  <th className="pb-4 px-6">Actor</th>
                  <th className="pb-4 px-6">Details</th>
                  <th className="pb-4 px-6">IP Address</th>
                  <th className="pb-4 pl-6 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-[#070607]/10">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#e2e2df]/50 transition">
                    <td className="py-4 pr-6 font-mono font-bold text-[#070607]">
                      <span className="rounded-full bg-[#fc5000]/15 px-3 py-1 text-xs text-[#fc5000]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-[#070607]">{log.actor}</td>
                    <td className="py-4 px-6 text-[#070607]/80 font-medium">{log.details || '-'}</td>
                    <td className="py-4 px-6 text-xs font-mono text-[#070607]/60">{log.ipAddress || '127.0.0.1'}</td>
                    <td className="py-4 pl-6 text-right text-xs font-medium text-[#070607]/70">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
