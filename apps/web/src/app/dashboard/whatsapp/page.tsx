'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Phone, Power, RefreshCw, CheckCircle, AlertTriangle, CreditCard, Clock, Lock } from 'lucide-react';

const BOT_PRICE = 150;
const BOT_CURRENCY = '₹';

export default function WhatsAppConnectionPage() {
  const [status, setStatus] = useState<string>('DISCONNECTED');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Payment states
  const [paymentStatus, setPaymentStatus] = useState<'UNPAID' | 'PENDING' | 'APPROVED' | 'REJECTED'>('APPROVED');
  const [isApproved, setIsApproved] = useState(true);
  const [utrNumber, setUtrNumber] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status', { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      setStatus(data.status || 'DISCONNECTED');
      if (data.qrCode) {
        setQrCode(data.qrCode);
      }
    } catch {
      setError('Failed to reach API server');
    }
  };

  const fetchPaymentStatus = async () => {
    try {
      const res = await fetch('/api/payment/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setIsApproved(data.isApproved ?? true);
        setPaymentStatus(data.status || 'APPROVED');
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    fetchPaymentStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    if (!isApproved) {
      setError('Please complete activation payment and get admin approval to connect the bot.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect');
      setStatus(data.status || 'CONNECTING');
      await fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError('');
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST', credentials: 'include' });
      setPairingCode(null);
      setQrCode(null);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const handlePairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    if (!isApproved) {
      setError('Please complete activation payment and get admin approval first.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/whatsapp/pair-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get pairing code');
      setPairingCode(data.code);
    } catch (err: any) {
      setError(err.message || 'Pairing failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrNumber.trim()) return;

    setSubmittingPayment(true);
    setError('');
    setPaymentSuccessMsg('');
    try {
      const res = await fetch('/api/payment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ utrNumber: utrNumber.trim(), amount: BOT_PRICE }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit payment details');
      setPaymentSuccessMsg('Payment submitted successfully! Admin has been notified for approval.');
      setPaymentStatus('PENDING');
      await fetchPaymentStatus();
    } catch (err: any) {
      setError(err.message || 'Payment submission failed');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const upiId = 'contact.subhroy@okaxis';
  const upiString = `upi://pay?pa=${upiId}&pn=Subhankar%20Roy&am=${BOT_PRICE}.00&cu=INR&tn=Caldera%20Bot%20Activation`;

  return (
    <div className="space-y-8 text-[#070607]">
      <div>
        <h1 className="font-display text-5xl uppercase tracking-tight text-[#070607]">
          WHATSAPP CONNECTION
        </h1>
        <p className="text-sm font-medium text-[#070607]/70 mt-1">
          Manage multi-device authorization via QR Code scan or 8-digit Pairing Code
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-[24px] border border-[#fc5000] bg-[#fc5000]/10 p-5 text-sm font-medium text-[#fc5000]">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {paymentSuccessMsg && (
        <div className="flex items-center gap-3 rounded-[24px] border border-[#2563eb] bg-[#2563eb]/10 p-5 text-sm font-medium text-[#2563eb]">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span>{paymentSuccessMsg}</span>
        </div>
      )}

      {/* Payment Required Card for non-approved users */}
      {!isApproved && (
        <div className="rounded-[40px] border-2 border-[#fc5000] bg-[#f7f6f2] p-8 space-y-6">
          <div className="flex items-center gap-3 text-[#fc5000]">
            <CreditCard className="h-8 w-8" />
            <h2 className="font-display text-3xl uppercase text-[#070607]">
              One-Time Activation Fee ({BOT_CURRENCY}{BOT_PRICE})
            </h2>
          </div>

          <p className="text-sm font-medium text-[#070607]/80 leading-relaxed">
            To unlock WhatsApp Bot connection privileges, please pay a <strong>{BOT_CURRENCY}{BOT_PRICE} one-time lifetime fee</strong> using UPI. After paying, submit your 12-digit UTR/Ref Number below for admin verification.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-2">
            {/* UPI QR */}
            <div className="flex flex-col items-center justify-center rounded-[32px] bg-[#ffffff] p-6 border-2 border-[#070607] text-center shadow-md">
              <QRCodeSVG value={upiString} size={180} />
              <p className="mt-3 text-xs font-bold text-[#070607] uppercase">Scan to pay {BOT_CURRENCY}{BOT_PRICE} via PhonePe / GPay / Paytm</p>
              <div className="mt-2 rounded-full bg-[#f5f28e] px-4 py-1 text-xs font-mono font-bold text-[#070607]">
                UPI ID: {upiId}
              </div>
            </div>

            {/* UTR Form or Pending Banner */}
            <div>
              {paymentStatus === 'PENDING' ? (
                <div className="rounded-[32px] bg-[#f5f28e] p-6 text-center space-y-3 border-2 border-[#070607]">
                  <Clock className="h-10 w-10 text-[#070607] mx-auto animate-bounce" />
                  <h3 className="font-display text-xl uppercase text-[#070607]">Payment Under Review</h3>
                  <p className="text-xs font-medium text-[#070607]/80">
                    Your UTR reference has been received and emailed to admins (<code className="font-bold text-[#070607]">contact.subhroy@gmail.com</code> & <code className="font-bold text-[#070607]">aarxslan@gmail.com</code>). You will get access as soon as approved!
                  </p>
                </div>
              ) : (
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#070607]/70 mb-2">
                      Enter 12-Digit UPI UTR / Transaction Ref No.
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 423589102456"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-mono font-bold text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingPayment || !utrNumber.trim()}
                    className="w-full rounded-full bg-[#fc5000] py-4 text-base font-semibold text-[#070607] transition hover:bg-[#070607] hover:text-[#ffffff] disabled:opacity-50"
                  >
                    {submittingPayment ? 'Submitting Reference...' : `I Have Paid ${BOT_CURRENCY}${BOT_PRICE} — Submit for Approval`}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Bar + Connection Methods — only visible after payment approval */}
      {isApproved && (
        <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-[40px] bg-[#f7f6f2] p-8">
        <div className="flex items-center gap-5">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              status === 'CONNECTED' ? 'bg-[#fc5000] text-[#070607]' : 'bg-[#e2e2df] text-[#070607]'
            }`}
          >
            {status === 'CONNECTED' ? <CheckCircle className="h-7 w-7" /> : <RefreshCw className="h-7 w-7 animate-spin" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#070607]/60">Current Status</span>
              <span className="rounded-full bg-[#f5f28e] px-3 py-0.5 text-xs font-semibold text-[#070607]">
                Encrypted Session
              </span>
            </div>
            <p className="font-display text-3xl text-[#070607] uppercase mt-0.5">{status}</p>
          </div>
        </div>

        <div>
          {status !== 'CONNECTED' ? (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="flex items-center gap-2.5 rounded-full bg-[#fc5000] px-8 py-4 text-base font-semibold text-[#070607] transition hover:bg-[#070607] hover:text-[#ffffff] disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Initializing Socket...' : 'Connect Bot'}</span>
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="flex items-center gap-2.5 rounded-full bg-[#070607] px-8 py-4 text-base font-semibold text-[#ffffff] transition hover:bg-[#fc5000] hover:text-[#070607] disabled:opacity-50"
            >
              <Power className="h-5 w-5" />
              <span>Disconnect Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Auth Methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Method 1: QR Code */}
        <div className="rounded-[40px] bg-[#f7f6f2] p-8 flex flex-col items-center justify-center text-center">
          <div className="mb-6 flex items-center gap-2 font-display text-2xl uppercase text-[#070607]">
            <QrCode className="h-6 w-6 text-[#fc5000]" />
            <span>Option 1: Scan QR Code</span>
          </div>

          {qrCode ? (
            <div className="rounded-[32px] bg-[#ffffff] p-6 shadow-md border-2 border-[#070607]">
              <QRCodeSVG value={qrCode} size={220} />
              <p className="mt-3 text-xs font-bold text-[#fc5000] uppercase tracking-wider">
                Scan with WhatsApp Camera
              </p>
            </div>
          ) : (
            <div className="flex h-56 w-56 flex-col items-center justify-center rounded-[32px] bg-[#e2e2df] p-6 text-center text-xs font-medium text-[#070607]/70 space-y-3">
              <QrCode className="h-10 w-10 text-[#070607]/40" />
              <span>
                {status === 'CONNECTED'
                  ? 'WhatsApp Session Active'
                  : status === 'CONNECTING' || status === 'PAIRING'
                  ? 'Generating QR Code from WhatsApp...'
                  : 'Click Connect Bot button above to generate QR Code'}
              </span>
            </div>
          )}

          <p className="mt-6 text-xs font-medium text-[#070607]/70">
            Open WhatsApp → Linked Devices → Link a Device
          </p>
        </div>

        {/* Method 2: Pairing Code */}
        <div className="rounded-[40px] bg-[#f7f6f2] p-8">
          <div className="mb-6 flex items-center gap-2 font-display text-2xl uppercase text-[#070607]">
            <Phone className="h-6 w-6 text-[#fc5000]" />
            <span>Option 2: 8-Digit Pairing Code</span>
          </div>

          <form onSubmit={handlePairingCode} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                Phone Number (with Country Code)
              </label>
              <input
                type="text"
                placeholder="e.g. 15551234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !phoneNumber}
              className="w-full rounded-full bg-[#070607] py-4 text-base font-semibold text-[#ffffff] transition hover:bg-[#fc5000] hover:text-[#070607] disabled:opacity-50"
            >
              Request Pairing Code
            </button>
          </form>

          {pairingCode && (
            <div className="mt-8 rounded-[32px] bg-[#fc5000] p-6 text-center text-[#ffffff]">
              <span className="text-xs uppercase font-semibold text-[#ffffff]/90 tracking-wider">
                WhatsApp 8-Digit Code
              </span>
              <div className="mt-2 font-mono text-4xl font-bold tracking-widest text-[#ffffff]">
                {pairingCode}
              </div>
              <p className="mt-2 text-xs font-medium text-[#ffffff]/90">
                Enter code inside WhatsApp → Linked Devices → Link with phone number
              </p>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
