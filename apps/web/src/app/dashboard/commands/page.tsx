'use client';

import { useState, useEffect, useMemo } from 'react';
import { Terminal, Shield, Clock, Search, Settings2, Play, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Modal states for command editing
  const [selectedCommand, setSelectedCommand] = useState<CommandItem | null>(null);
  const [editCooldown, setEditCooldown] = useState<number>(3);
  const [editOwnerOnly, setEditOwnerOnly] = useState<boolean>(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Modal states for command test execution
  const [execModalCommand, setExecModalCommand] = useState<CommandItem | null>(null);
  const [execInput, setExecInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [execOutput, setExecOutput] = useState<string | null>(null);

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
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        const user = data?.user;
        if (user) {
          const EXEMPT_EMAILS = ['contact.subhroy@gmail.com', 'aarxslan@gmail.com', 'admin', 'admin@openify.studio'];
          const userEmail = (user.username || '').toLowerCase();
          const adminCheck = EXEMPT_EMAILS.includes(userEmail) || user.role === 'ADMIN' || user.role === 'OWNER';
          setIsAdmin(adminCheck);
        }
      })
      .catch(() => {});
  }, []);

  // Instant optimistic toggle switch
  const toggleCommand = async (name: string, currentEnabled: boolean) => {
    if (!isAdmin) return;
    // Optimistic state update (0ms response)
    setCommands((prev) =>
      prev.map((c) => (c.name === name ? { ...c, enabled: !currentEnabled } : c))
    );

    try {
      await fetch(`/api/commands/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
    } catch (err) {
      // Revert state if failed
      setCommands((prev) =>
        prev.map((c) => (c.name === name ? { ...c, enabled: currentEnabled } : c))
      );
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommand) return;

    setSavingConfig(true);

    // Optimistic update
    setCommands((prev) =>
      prev.map((c) =>
        c.name === selectedCommand.name
          ? { ...c, cooldown: editCooldown, ownerOnly: editOwnerOnly }
          : c
      )
    );

    try {
      await fetch(`/api/commands/${selectedCommand.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cooldown: editCooldown,
          ownerOnly: editOwnerOnly,
        }),
      });
      setSelectedCommand(null);
    } catch (err) {
      console.error(err);
      fetchCommands();
    } finally {
      setSavingConfig(false);
    }
  };

  const handleExecuteTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!execModalCommand) return;

    setExecuting(true);
    setExecOutput(null);

    const fullCommand = execInput.trim().startsWith('.')
      ? execInput.trim()
      : `.${execModalCommand.name} ${execInput.trim()}`;

    try {
      const res = await fetch('/api/commands/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ commandText: fullCommand }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Execution failed');
      }
      setExecOutput(data.output || 'Execution completed without output.');
    } catch (err: any) {
      setExecOutput(`❌ Error: ${err.message || String(err)}`);
    } finally {
      setExecuting(false);
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    commands.forEach((c) => {
      if (c.category) set.add(c.category.toUpperCase());
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [commands]);

  // Filtered commands
  const filteredCommands = useMemo(() => {
    return commands.filter((cmd) => {
      const matchesSearch =
        cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cmd.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cmd.aliases.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategory === 'ALL' ||
        cmd.category?.toUpperCase() === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [commands, searchQuery, selectedCategory]);

  const activeCount = useMemo(() => commands.filter((c) => c.enabled).length, [commands]);
  const ownerCount = useMemo(() => commands.filter((c) => c.ownerOnly).length, [commands]);

  return (
    <div className="space-y-8 text-[#070607]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#070607]">
            COMMAND CONTROL CENTER
          </h1>
          <p className="text-sm font-medium text-[#070607]/70 mt-1">
            Manage system plugins, edit permissions, adjust execution cooldowns, and test run commands
          </p>
        </div>
      </div>

      {/* Header Statistics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-[28px] bg-[#f7f6f2] p-5 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#070607]/60">
            Total Commands
          </span>
          <div className="font-display text-3xl text-[#070607]">{commands.length}</div>
        </div>
        <div className="rounded-[28px] bg-[#f7f6f2] p-5 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#070607]/60">
            Active Commands
          </span>
          <div className="font-display text-3xl text-[#fc5000]">{activeCount}</div>
        </div>
        <div className="rounded-[28px] bg-[#f7f6f2] p-5 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#070607]/60">
            Owner Restricted
          </span>
          <div className="font-display text-3xl text-[#070607]">{ownerCount}</div>
        </div>
        <div className="rounded-[28px] bg-[#f7f6f2] p-5 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#070607]/60">
            Command Prefix
          </span>
          <div className="font-display text-3xl text-[#070607]">.</div>
        </div>
      </div>

      {/* Search & Category Filter Section */}
      <div className="rounded-[36px] bg-[#f7f6f2] p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#070607]/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search plugins by name, description, or alias..."
              className="w-full rounded-full border-1.5 border-[#070607]/15 bg-[#e2e2df] py-3 pl-11 pr-5 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dotted border-[#070607]/15">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition uppercase ${
                selectedCategory === cat
                  ? 'bg-[#fc5000] text-[#070607]'
                  : 'bg-[#e2e2df] text-[#070607]/70 hover:bg-[#e2e2df]/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Commands Grid */}
      <div className="rounded-[40px] bg-[#f7f6f2] p-8">
        {loading ? (
          <div className="py-12 text-center text-[#070607]/60 font-medium text-sm">
            Loading commands...
          </div>
        ) : filteredCommands.length === 0 ? (
          <div className="py-12 text-center text-[#070607]/60">
            <Terminal className="mx-auto h-12 w-12 text-[#fc5000] mb-3 opacity-80" />
            <p className="font-display text-2xl uppercase text-[#070607]">No Commands Found</p>
            <p className="text-xs font-medium text-[#070607]/60 mt-1">
              Try adjusting your search query or category filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCommands.map((cmd) => (
              <div
                key={cmd.name}
                className="rounded-[32px] bg-[#e2e2df] p-6 flex flex-col justify-between space-y-4 hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-5 w-5 text-[#fc5000]" />
                      <span className="font-display text-2xl uppercase text-[#070607]">
                        .{cmd.name}
                      </span>
                    </div>

                    {/* Instant Optimistic Toggle */}
                    <button
                      onClick={() => toggleCommand(cmd.name, cmd.enabled)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                        cmd.enabled ? 'bg-[#fc5000]' : 'bg-[#070607]/30'
                      }`}
                      title={cmd.enabled ? 'Disable Command' : 'Enable Command'}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-[#ffffff] transition-transform ${
                          cmd.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-xs font-medium text-[#070607]/80 mt-2 min-h-[36px]">
                    {cmd.description || 'No description provided'}
                  </p>

                  {cmd.aliases && cmd.aliases.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cmd.aliases.map((alias) => (
                        <span
                          key={alias}
                          className="rounded-md bg-[#f7f6f2] px-2 py-0.5 font-mono text-[10px] font-bold text-[#070607]/70"
                        >
                          .{alias}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-dotted border-[#070607]/20 text-xs font-semibold text-[#070607]/70">
                  <div className="flex items-center gap-2">
                    {cmd.ownerOnly && (
                      <span className="flex items-center gap-1 rounded-full bg-[#f5f28e] px-2.5 py-0.5 text-[#070607]">
                        <Shield className="h-3 w-3" /> Owner
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-[#fc5000]" /> {cmd.cooldown}s
                    </span>
                  </div>

                  {/* Actions: Configure & Test Execution */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedCommand(cmd);
                        setEditCooldown(cmd.cooldown);
                        setEditOwnerOnly(cmd.ownerOnly);
                      }}
                      className="rounded-full bg-[#f7f6f2] p-2 text-[#070607] hover:bg-[#fc5000] transition"
                      title="Configure Command"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setExecModalCommand(cmd);
                        setExecInput(`.${cmd.name}`);
                        setExecOutput(null);
                      }}
                      className="flex items-center gap-1 rounded-full bg-[#070607] px-3 py-1 text-[11px] font-bold text-[#ffffff] hover:bg-[#fc5000] hover:text-[#070607] transition"
                      title="Test Run Command"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>Test</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal 1: Configure Command Modal */}
      {selectedCommand && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#070607]/60 backdrop-blur-sm p-4 z-50">
          <div className="w-full max-w-md rounded-[40px] bg-[#f7f6f2] p-8 shadow-2xl space-y-6 text-[#070607]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-3xl uppercase text-[#070607]">
                Configure .{selectedCommand.name}
              </h2>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                  Execution Cooldown (Seconds)
                </label>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={editCooldown}
                  onChange={(e) => setEditCooldown(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-mono font-bold text-[#070607] focus:border-[#fc5000] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between rounded-[24px] bg-[#e2e2df] p-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#070607]">
                    Owner Only Restricted
                  </span>
                  <p className="text-[11px] font-medium text-[#070607]/60">
                    Require bot owner phone number match to execute
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEditOwnerOnly(!editOwnerOnly)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    editOwnerOnly ? 'bg-[#fc5000]' : 'bg-[#070607]/30'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-[#ffffff] transition-transform ${
                      editOwnerOnly ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCommand(null)}
                  className="flex-1 rounded-full border border-[#070607] py-3 text-sm font-semibold text-[#070607] hover:bg-[#e2e2df]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="flex-1 rounded-full bg-[#fc5000] py-3 text-sm font-semibold text-[#070607] hover:bg-[#070607] hover:text-[#ffffff] disabled:opacity-50"
                >
                  {savingConfig ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Command Test Execution Console */}
      {execModalCommand && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#070607]/60 backdrop-blur-sm p-4 z-50">
          <div className="w-full max-w-lg rounded-[40px] bg-[#f7f6f2] p-8 shadow-2xl space-y-6 text-[#070607]">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-[#fc5000]" />
              <h2 className="font-display text-3xl uppercase text-[#070607]">
                Test .{execModalCommand.name}
              </h2>
            </div>

            <form onSubmit={handleExecuteTest} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                  Command Test Input Line
                </label>
                <input
                  type="text"
                  required
                  value={execInput}
                  onChange={(e) => setExecInput(e.target.value)}
                  placeholder={`e.g. .${execModalCommand.name}`}
                  className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3.5 px-6 text-sm font-mono text-[#070607] focus:border-[#fc5000] focus:outline-none"
                />
              </div>

              {execOutput !== null && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
                    Console Execution Output
                  </label>
                  <pre className="w-full rounded-[24px] bg-[#070607] p-4 text-xs font-mono text-[#ffffff] whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {execOutput}
                  </pre>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setExecModalCommand(null)}
                  className="flex-1 rounded-full border border-[#070607] py-3.5 text-sm font-semibold text-[#070607] hover:bg-[#e2e2df]"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={executing}
                  className="flex-1 rounded-full bg-[#fc5000] py-3.5 text-sm font-semibold text-[#070607] hover:bg-[#070607] hover:text-[#ffffff] disabled:opacity-50"
                >
                  {executing ? 'Executing...' : 'Run Command'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
