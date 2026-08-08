'use client';

import { useState, useEffect } from 'react';
import { Terminal, Shield, Clock } from 'lucide-react';

interface CommandItem {
  name: string;
  aliases: string[];
  description: string;
  category: string;
  ownerOnly: boolean;
  enabled: boolean;
  cooldown: number;
}

export default function CommandsPage() {
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCommands = async () => {
    try {
      const res = await fetch('/api/commands', { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      setCommands(data.commands || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommands();
  }, []);

  const toggleCommand = async (name: string, currentEnabled: boolean) => {
    try {
      await fetch(`/api/commands/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      fetchCommands();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 text-[#070607]">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#070607]">
          COMMAND PLUGINS
        </h1>
        <p className="text-sm font-medium text-[#070607]/70 mt-1">
          Manage system prefix commands, permission toggles, and execution cooldowns
        </p>
      </div>

      <div className="rounded-[40px] bg-[#f7f6f2] p-8 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[#070607]/60 font-medium text-sm">
            Loading commands...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {commands.map((cmd) => (
              <div
                key={cmd.name}
                className="rounded-[32px] bg-[#e2e2df] p-6 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-5 w-5 text-[#fc5000]" />
                      <span className="font-display text-2xl uppercase text-[#070607]">
                        .{cmd.name}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleCommand(cmd.name, cmd.enabled)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                        cmd.enabled ? 'bg-[#fc5000]' : 'bg-[#070607]/30'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-[#ffffff] transition-transform ${
                          cmd.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-xs font-medium text-[#070607]/80 mt-2">
                    {cmd.description || 'No description provided'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-dotted border-[#070607]/20 text-xs font-semibold text-[#070607]/70">
                  <div className="flex items-center gap-3">
                    {cmd.ownerOnly && (
                      <span className="flex items-center gap-1 rounded-full bg-[#f5f28e] px-2.5 py-0.5 text-[#070607]">
                        <Shield className="h-3 w-3" /> Owner
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-[#fc5000]" /> {cmd.cooldown}s
                    </span>
                  </div>
                  <span className="uppercase text-[10px] tracking-wider text-[#070607]/50">
                    Category: {cmd.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
