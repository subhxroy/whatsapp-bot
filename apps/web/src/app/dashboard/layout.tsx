'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  QrCode,
  Terminal,
  MessageSquare,
  Bot,
  FileImage,
  ShieldAlert,
  Lock,
  Settings,
  LogOut,
  Flame,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/whatsapp', label: 'WhatsApp', icon: QrCode },
  { href: '/dashboard/commands', label: 'Commands', icon: Terminal },
  { href: '/dashboard/auto-reply', label: 'Auto-Reply', icon: MessageSquare },
  { href: '/dashboard/ai', label: 'AI Assistant', icon: Bot },
  { href: '/dashboard/media', label: 'Media Settings', icon: FileImage },
  { href: '/dashboard/logs', label: 'Audit Logs', icon: ShieldAlert },
  { href: '/dashboard/security', label: 'Security', icon: Lock },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-[#e2e2df] text-[#070607]">
      {/* Mobile Top Navigation Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-[#f7f6f2] px-4 py-3 border-b border-dotted border-[#070607]/20 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fc5000] text-[#070607]">
            <Flame className="h-5 w-5 fill-current" />
          </div>
          <span className="font-display text-xl uppercase tracking-wide text-[#070607]">
            CALDERA BOT
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-full bg-[#e2e2df] p-2 text-[#070607] focus:outline-none"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Main Container */}
      <div className="mx-auto max-w-[1400px] p-4 sm:p-6 flex gap-6">
        {/* Desktop Fixed / Sticky Sidebar (Scrollbar Hidden) */}
        <aside className="hidden md:flex w-72 flex-shrink-0 bg-[#f7f6f2] p-5 rounded-[40px] sticky top-6 h-[calc(100vh-3rem)] flex-col justify-between overflow-y-auto no-scrollbar">
          <div>
            {/* Logo Header */}
            <div className="mb-6 flex items-center gap-3 px-2">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#fc5000] text-[#070607]">
                <Flame className="h-6 w-6 fill-current" />
              </div>
              <div>
                <h2 className="font-display text-2xl tracking-wide uppercase text-[#070607]">
                  CALDERA BOT
                </h2>
                <span className="text-[11px] font-medium text-[#070607]/70 block -mt-1">
                  Self-Hosted Control Center
                </span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
                      active
                        ? 'bg-[#fc5000] text-[#070607] font-semibold'
                        : 'text-[#070607] hover:bg-[#e2e2df]'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer / Sign Out */}
          <div className="pt-4 border-t border-dotted border-[#070607]/20">
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#070607] px-4 py-2.5 text-sm font-medium text-[#ffffff] transition hover:bg-[#fc5000] hover:text-[#070607]"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 bg-[#070607]/50 backdrop-blur-sm md:hidden">
            <div className="fixed left-0 top-0 bottom-0 w-4/5 max-w-sm bg-[#f7f6f2] p-6 flex flex-col justify-between overflow-y-auto no-scrollbar">
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fc5000] text-[#070607]">
                      <Flame className="h-5 w-5 fill-current" />
                    </div>
                    <span className="font-display text-xl uppercase text-[#070607]">CALDERA</span>
                  </div>
                  <button onClick={() => setMobileOpen(false)} className="p-2 text-[#070607]">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <nav className="space-y-1.5">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3.5 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                          active
                            ? 'bg-[#fc5000] text-[#070607] font-semibold'
                            : 'text-[#070607] hover:bg-[#e2e2df]'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-dotted border-[#070607]/20">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#070607] px-4 py-2.5 text-sm font-medium text-[#ffffff]"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 w-full min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
