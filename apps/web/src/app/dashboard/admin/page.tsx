'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, CreditCard, Check, X, RefreshCw, Users, DollarSign, Activity, AlertCircle } from 'lucide-react';

const BOT_PRICE = 150;
const BOT_CURRENCY = '₹';

interface PaymentReq {
  id: string;
  userId: string;
  userEmail: string;
  utrNumber: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export default function AdminPortalPage() {
  const [requests, setRequests] = useState<PaymentReq[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [waStatus, setWaStatus] = useState<string>('DISCONNECTED');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  const fetchAdminData = async () => {
    setLoading(true);
    setMsg('');
    try {
      const [reqRes, waRes] = await Promise.all([
        fetch('/api/payment/admin/requests'),
        fetch('/api/whatsapp/status'),
      ]);

      if (reqRes.ok) {
        const data = await reqRes.json();
        setRequests(data.requests || []);
      }
      if (waRes.ok) {
        const waData = await waRes.json();
        setWaStatus(waData.status || 'DISCONNECTED');
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (paymentId: string) => {
    setActionId(paymentId);
    try {
      const res = await fetch('/api/payment/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      if (res.ok) {
        setMsg('User payment approved! Access granted.');
        await fetchAdminData();
      }
    } catch {}
    setActionId(null);
  };

  const handleReject = async (paymentId: string) => {
    setActionId(paymentId);
    try {
      const res = await fetch('/api/payment/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      if (res.ok) {
        setMsg('Payment rejected.');
        await fetchAdminData();
      }
    } catch {}
    setActionId(null);
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
  const totalRevenue = approvedCount * BOT_PRICE;

  const filteredRequests = requests.filter((r) => {
    if (filter === 'ALL') return true;
    return r.status === filter;
  });

  return (
    <div className="space-y-8 text-[#070607]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fc5000] text-[#070607]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-5xl uppercase tracking-tight text-[#070607]">
            ADMIN PORTAL
          </h1>
        </div>
        <p className="text-sm font-medium text-[#070607]/70 mt-1">
          Master control panel for user approvals, monetization revenue, and system operations
        </p>
      </div>

      {msg && (
        <div className="rounded-[24px] border border-[#2563eb] bg-[#2563eb]/10 p-5 text-sm font-bold text-[#2563eb]">
          {msg}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="rounded-[32px] bg-[#f7f6f2] p-6 space-y-2 border border-[#070607]/10">
          <div className="flex items-center justify-between text-[#070607]/60 text-xs font-bold uppercase">
            <span>Pending Approvals</span>
            <AlertCircle className="h-5 w-5 text-[#fc5000]" />
          </div>
          <p className="font-display text-4xl text-[#070607]">{pendingCount}</p>
          <span className="text-[11px] font-semibold text-[#070607]/60 block">Awaiting UTR verification</span>
        </div>

        <div className="rounded-[32px] bg-[#f7f6f2] p-6 space-y-2 border border-[#070607]/10">
          <div className="flex items-center justify-between text-[#070607]/60 text-xs font-bold uppercase">
            <span>Total Revenue</span>
            <DollarSign className="h-5 w-5 text-[#2563eb]" />
          </div>
          <p className="font-display text-4xl text-[#070607]">₹{totalRevenue}</p>
          <span className="text-[11px] font-semibold text-[#070607]/60 block">{BOT_CURRENCY}{BOT_PRICE} x {approvedCount} approved users</span>
        </div>

        <div className="rounded-[32px] bg-[#f7f6f2] p-6 space-y-2 border border-[#070607]/10">
          <div className="flex items-center justify-between text-[#070607]/60 text-xs font-bold uppercase">
            <span>Total Users Paid</span>
            <Users className="h-5 w-5 text-[#070607]" />
          </div>
          <p className="font-display text-4xl text-[#070607]">{requests.length}</p>
          <span className="text-[11px] font-semibold text-[#070607]/60 block">Submissions processed</span>
        </div>

        <div className="rounded-[32px] bg-[#f7f6f2] p-6 space-y-2 border border-[#070607]/10">
          <div className="flex items-center justify-between text-[#070607]/60 text-xs font-bold uppercase">
            <span>WhatsApp Engine</span>
            <Activity className="h-5 w-5 text-[#fc5000]" />
          </div>
          <p className="font-display text-2xl text-[#070607] uppercase truncate">{waStatus}</p>
          <span className="text-[11px] font-semibold text-[#070607]/60 block">Multi-device socket</span>
        </div>
      </div>

      {/* Admin Privileged Emails Banner */}
      <div className="rounded-[32px] bg-[#f5f28e] p-6 border-2 border-[#070607] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#070607]/70">Master Administrators</span>
          <p className="text-sm font-semibold text-[#070607] mt-0.5">
            Admin emails (<code className="bg-[#ffffff] px-2 py-0.5 rounded font-bold">contact.subhroy@gmail.com</code> & <code className="bg-[#ffffff] px-2 py-0.5 rounded font-bold">aarxslan@gmail.com</code>) get instant email notifications on every payment submission.
          </p>
        </div>
        <button
          onClick={fetchAdminData}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-[#070607] px-5 py-2.5 text-xs font-bold text-[#ffffff] transition hover:bg-[#fc5000] hover:text-[#070607] flex-shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Table
        </button>
      </div>

      {/* Main Table Card */}
      <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-7 w-7 text-[#fc5000]" />
            <h2 className="font-display text-3xl uppercase text-[#070607]">
              Activation Payment Approvals
            </h2>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 bg-[#e2e2df] p-1.5 rounded-full text-xs font-bold">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full transition ${
                  filter === f ? 'bg-[#fc5000] text-[#070607]' : 'text-[#070607]/70 hover:text-[#070607]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto rounded-[28px] border border-[#070607]/10 bg-[#ffffff]">
          <table className="w-full text-left text-xs font-medium text-[#070607]">
            <thead className="bg-[#e2e2df] uppercase text-[#070607]/70 text-[11px] tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">User Email / Identifier</th>
                <th className="px-6 py-4">12-Digit UTR Ref No.</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Submitted At</th>
                <th className="px-6 py-4 text-right">Approval Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#070607]/10">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-[#070607]/50 font-semibold">
                    No {filter !== 'ALL' ? filter.toLowerCase() : ''} payment records found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-[#f7f6f2]/60 transition">
                    <td className="px-6 py-4 font-bold text-[#070607]">{req.userEmail}</td>
                    <td className="px-6 py-4 font-mono font-bold text-[#2563eb] text-sm">{req.utrNumber}</td>
                    <td className="px-6 py-4 font-bold text-[#070607]">₹{req.amount}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          req.status === 'APPROVED'
                            ? 'bg-[#2563eb]/10 text-[#2563eb]'
                            : req.status === 'PENDING'
                            ? 'bg-[#f5f28e] text-[#070607]'
                            : 'bg-[#fc5000]/10 text-[#fc5000]'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#070607]/60 font-medium">
                      {new Date(req.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {req.status === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => handleApprove(req.id)}
                            disabled={actionId === req.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#fc5000] px-4 py-2 text-xs font-bold text-[#070607] transition hover:bg-[#070607] hover:text-[#ffffff] disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve Access
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={actionId === req.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#070607] px-4 py-2 text-xs font-bold text-[#ffffff] transition hover:bg-[#fc5000] hover:text-[#070607] disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-[#070607]/40 text-[11px] font-bold uppercase tracking-wider">
                          Status Locked ({req.status})
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
