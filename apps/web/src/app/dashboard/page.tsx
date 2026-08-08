'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, MessageSquare, Terminal, QrCode, Cpu, Database, Flame } from 'lucide-react';

export default function DashboardOverview() {
  const [waStatus, setWaStatus] = useState<string>('DISCONNECTED');
  const [commandsCount, setCommandsCount] = useState<number>(0);
  const [autoReplyCount, setAutoReplyCount] = useState<number>(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const [resWa, resCmd, resAr] = await Promise.all([
          fetch('/api/whatsapp/status', { credentials: 'include' }),
          fetch('/api/commands', { credentials: 'include' }),
          fetch('/api/auto-replies', { credentials: 'include' }),
        ]);

        if (resWa.status === 401) {
          window.location.href = '/login';
          return;
        }

        const dataWa = await resWa.json();
        const dataCmd = await resCmd.json();
        const dataAr = await resAr.json();

        setWaStatus(dataWa.status || 'DISCONNECTED');
        setCommandsCount(dataCmd.commands?.length || 0);
        setAutoReplyCount(dataAr.rules?.length || 0);
      } catch (err) {
        console.error('Error fetching dashboard overview:', err);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Signature Hero Halftone Card */}
      <div className="relative overflow-hidden rounded-[32px] sm:rounded-[40px] halftone-pattern p-6 sm:p-10 text-[#ffffff] flex flex-col justify-between min-h-[220px] sm:min-h-[260px]">
        <div className="flex items-center justify-between z-10">
          <span className="inline-block rounded-full bg-[#f5f28e] px-3 sm:px-4 py-1 text-xs font-bold text-[#070607] tracking-wider uppercase">
            CALDERA SYSTEM ACTIVE
          </span>
          <Flame className="h-6 w-6 sm:h-8 sm:w-8 text-[#fc5000]" />
        </div>
        <div className="z-10 mt-6">
          <h1 className="font-display text-4xl sm:text-6xl md:text-8xl tracking-normal uppercase leading-none text-[#ffffff]">
            VOLCANIC AUTOMATION
          </h1>
          <p className="mt-2 text-xs sm:text-base md:text-lg font-medium text-[#ffffff]/90 max-w-2xl">
            Private WhatsApp Multi-Device Automation Bot running with AES-256-GCM encryption at rest and strict zero-telemetry privacy defaults.
          </p>
        </div>
      </div>

      {/* Metrics Row (Stat Feature Cards) */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Connection Stat Card */}
        <div className="rounded-[32px] sm:rounded-[40px] bg-[#fc5000] p-6 sm:p-8 text-[#ffffff] flex flex-col justify-between min-h-[190px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#ffffff]/90">Status</span>
            <QrCode className="h-6 w-6 text-[#ffffff] flex-shrink-0" />
          </div>
          <div className="mt-4">
            <div className="font-display text-xl sm:text-2xl md:text-3xl lg:text-4xl text-[#ffffff] leading-tight uppercase break-words">
              {waStatus}
            </div>
            <span className="mt-2 block text-xs font-medium text-[#ffffff]/90">
              Multi-Device Session State
            </span>
          </div>
        </div>

        {/* Commands Card */}
        <div className="rounded-[32px] sm:rounded-[40px] bg-[#f7f6f2] p-6 sm:p-8 text-[#070607] flex flex-col justify-between min-h-[190px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#070607]/70">Plugins</span>
            <Terminal className="h-6 w-6 text-[#fc5000] flex-shrink-0" />
          </div>
          <div className="mt-4">
            <div className="font-display text-5xl sm:text-6xl text-[#070607] leading-none">
              {commandsCount}
            </div>
            <span className="mt-2 block text-xs font-medium text-[#070607]/70">
              Registered Prefix Commands
            </span>
          </div>
        </div>

        {/* Auto Reply Rules Card */}
        <div className="rounded-[32px] sm:rounded-[40px] bg-[#f7f6f2] p-6 sm:p-8 text-[#070607] flex flex-col justify-between min-h-[190px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#070607]/70">Auto-Replies</span>
            <MessageSquare className="h-6 w-6 text-[#fc5000] flex-shrink-0" />
          </div>
          <div className="mt-4">
            <div className="font-display text-5xl sm:text-6xl text-[#070607] leading-none">
              {autoReplyCount}
            </div>
            <span className="mt-2 block text-xs font-medium text-[#070607]/70">
              Configured Keyword Rules
            </span>
          </div>
        </div>

        {/* Privacy Status Card */}
        <div className="rounded-[32px] sm:rounded-[40px] bg-[#f5f28e] p-6 sm:p-8 text-[#070607] flex flex-col justify-between min-h-[190px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#070607]/80">Privacy</span>
            <ShieldCheck className="h-6 w-6 text-[#070607] flex-shrink-0" />
          </div>
          <div className="mt-4">
            <div className="font-display text-xl sm:text-2xl text-[#070607] uppercase leading-tight">
              STRICT PRIVATE MODE
            </div>
            <span className="mt-1 block text-xs font-medium text-[#070607]/80">
              Zero Telemetry / AES-256
            </span>
          </div>
        </div>
      </div>

      {/* Core Architecture Cards */}
      <div className="rounded-[32px] sm:rounded-[40px] bg-[#f7f6f2] p-6 sm:p-8 text-[#070607]">
        <h2 className="font-display text-3xl sm:text-4xl uppercase text-[#070607] mb-6">
          Core Monorepo Architecture
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="rounded-[24px] bg-[#e2e2df] p-6">
            <Cpu className="h-8 w-8 text-[#fc5000] mb-3" />
            <h3 className="font-display text-2xl uppercase text-[#070607]">Isolated Baileys Adapter</h3>
            <p className="text-sm font-medium text-[#070607]/80 mt-2">
              Encapsulated inside <code className="bg-[#f7f6f2] px-1.5 py-0.5 rounded text-xs text-[#070607]">packages/whatsapp</code>. Baileys auth state encrypted at rest using AES-256-GCM.
            </p>
          </div>

          <div className="rounded-[24px] bg-[#e2e2df] p-6">
            <Database className="h-8 w-8 text-[#fc5000] mb-3" />
            <h3 className="font-display text-2xl uppercase text-[#070607]">Firestore & Redis</h3>
            <p className="text-sm font-medium text-[#070607]/80 mt-2">
              Cloud Firestore for rules and settings. BullMQ and Redis for async queues and sliding-window rate limiters.
            </p>
          </div>

          <div className="rounded-[24px] bg-[#e2e2df] p-6">
            <ShieldCheck className="h-8 w-8 text-[#fc5000] mb-3" />
            <h3 className="font-display text-2xl uppercase text-[#070607]">Privacy Defaults</h3>
            <p className="text-sm font-medium text-[#070607]/80 mt-2">
              <code className="bg-[#f7f6f2] px-1.5 py-0.5 rounded text-xs text-[#070607]">MESSAGE_LOGGING=false</code> and <code className="bg-[#f7f6f2] px-1.5 py-0.5 rounded text-xs text-[#070607]">AI_ENABLED=false</code> by default. View-once reveal via <code className="bg-[#f7f6f2] px-1.5 py-0.5 rounded text-xs text-[#070607]">.vv</code> / <code className="bg-[#f7f6f2] px-1.5 py-0.5 rounded text-xs text-[#070607]">.avv</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
