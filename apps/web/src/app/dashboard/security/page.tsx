'use client';

import { useState, useEffect } from 'react';
import { Lock, ExternalLink, UserCheck, CreditCard, Check, X, RefreshCw } from 'lucide-react';

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

export default function SecurityPage() {
  const [requests, setRequests] = useState<PaymentReq[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const fetchPaymentRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payment/admin/requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchPaymentRequests();
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
        setMsg('Payment approved successfully!');
        await fetchPaymentRequests();
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
        setMsg('Payment rejected');
        await fetchPaymentRequests();
      }
    } catch {}
    setActionId(null);
  };

  return (
    <div className="space-y-8 text-[#070607]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl uppercase tracking-tight text-[#070607]">
            SECURITY & ACCESS CONTROLS
          </h1>
          <p className="text-sm font-medium text-[#070607]/70 mt-1">
            Encryption status, payment approvals, and RBAC role hierarchy
          </p>
        </div>
        <a
          href="https://admin-caldera-bot.netlify.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-[#070607] px-6 py-3 text-xs font-bold text-[#ffffff] transition hover:bg-[#fc5000] hover:text-[#070607]"
        >
          <span>Open Master Admin Portal</span>
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {msg && (
        <div className="rounded-[24px] border border-[#2563eb] bg-[#2563eb]/10 p-4 text-sm font-semibold text-[#2563eb]">
          {msg}
        </div>
      )}

      {/* Admin Payment Approval Panel */}
      <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-7 w-7 text-[#fc5000]" />
            <h2 className="font-display text-3xl uppercase text-[#070607]">
              {BOT_CURRENCY}{BOT_PRICE} Payment Approvals (Admin Panel)
            </h2>
          </div>
          <button
            onClick={fetchPaymentRequests}
            disabled={loading}
            className="flex items-center gap-2 rounded-full bg-[#e2e2df] px-4 py-2 text-xs font-bold text-[#070607] hover:bg-[#fc5000] hover:text-[#070607]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <p className="text-xs font-medium text-[#070607]/70">
          Verify UTR numbers submitted by users. Click Approve to grant bot connection permissions. Notified admins: <code className="font-bold text-[#070607]">contact.subhroy@gmail.com</code> & <code className="font-bold text-[#070607]">aarxslan@gmail.com</code>.
        </p>

        <div className="overflow-x-auto rounded-[24px] border border-[#070607]/10 bg-[#ffffff]">
          <table className="w-full text-left text-xs font-medium text-[#070607]">
            <thead className="bg-[#e2e2df] uppercase text-[#070607]/70 text-[11px] tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">User Email / ID</th>
                <th className="px-6 py-4">UTR Ref Number</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Submitted At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#070607]/10">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#070607]/50 font-semibold">
                    No payment activation requests recorded yet.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-[#f7f6f2]/50">
                    <td className="px-6 py-4 font-bold text-[#070607]">{req.userEmail}</td>
                    <td className="px-6 py-4 font-mono font-bold text-[#2563eb]">{req.utrNumber}</td>
                    <td className="px-6 py-4 font-bold text-[#070607]">₹{req.amount}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase ${
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
                    <td className="px-6 py-4 text-[#070607]/60">
                      {new Date(req.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {req.status === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => handleApprove(req.id)}
                            disabled={actionId === req.id}
                            className="inline-flex items-center gap-1 rounded-full bg-[#fc5000] px-3.5 py-1.5 text-xs font-bold text-[#070607] hover:bg-[#070607] hover:text-[#ffffff] disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={actionId === req.id}
                            className="inline-flex items-center gap-1 rounded-full bg-[#070607] px-3.5 py-1.5 text-xs font-bold text-[#ffffff] hover:bg-[#fc5000] hover:text-[#070607] disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-[#070607]/40 text-[11px] font-semibold">Completed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-4 text-[#070607]">
          <div className="flex items-center gap-3">
            <Lock className="h-7 w-7 text-[#fc5000]" />
            <h2 className="font-display text-3xl uppercase text-[#070607]">Session Encryption at Rest</h2>
          </div>
          <p className="text-sm font-medium text-[#070607]/80">
            Session authentication state is stored in Firestore encrypted with AES-256-GCM. The encryption key is enforced via <code className="bg-[#e2e2df] px-1.5 py-0.5 rounded text-xs text-[#070607]">SESSION_ENCRYPTION_KEY</code>.
          </p>
          <div className="rounded-[20px] bg-[#e2e2df] p-4 text-xs font-mono font-semibold text-[#070607]">
            Algorithm: AES-256-GCM (12-byte IV, 16-byte Auth Tag)
          </div>
        </div>

        <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-4 text-[#070607]">
          <div className="flex items-center gap-3">
            <UserCheck className="h-7 w-7 text-[#fc5000]" />
            <h2 className="font-display text-3xl uppercase text-[#070607]">RBAC Permissions</h2>
          </div>
          <p className="text-sm font-medium text-[#070607]/80">
            Three permission tiers: <code className="bg-[#e2e2df] px-1.5 py-0.5 rounded text-xs text-[#070607]">PUBLIC</code>, <code className="bg-[#e2e2df] px-1.5 py-0.5 rounded text-xs text-[#070607]">ADMIN</code>, <code className="bg-[#e2e2df] px-1.5 py-0.5 rounded text-xs text-[#070607]">OWNER</code>. Admin emails (<code className="bg-[#e2e2df] px-1 py-0.5 rounded text-xs text-[#070607]">contact.subhroy@gmail.com</code> & <code className="bg-[#e2e2df] px-1 py-0.5 rounded text-xs text-[#070607]">aarxslan@gmail.com</code>) have permanent access.
          </p>
          <div className="rounded-[20px] bg-[#e2e2df] p-4 text-xs font-semibold text-[#070607]">
            Arbitrary <code className="bg-[#f7f6f2] px-1 py-0.5 rounded text-[#fc5000]">eval</code> commands: <span className="text-[#fc5000] uppercase font-bold">Strictly Forbidden</span>
          </div>
        </div>
      </div>
    </div>
  );
}
