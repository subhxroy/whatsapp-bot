'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, Flame } from 'lucide-react';
import { signInWithGoogle, googleErrorToMessage } from '@/lib/firebase';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.4a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.96-4.32 2.96-7.34Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.07v2.6A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.42 13.9a6 6 0 0 1 0-3.8v-2.6H3.07a10 10 0 0 0 0 9l3.35-2.6Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.98c1.47 0 2.78.5 3.82 1.5l2.87-2.87A10 10 0 0 0 3.07 7.5l3.35 2.6C7.2 8.74 9.4 6.98 12 6.98Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => {
        if (res.ok) {
          return res.json().then((data) => {
            if (data?.user) {
              router.push('/dashboard');
            }
          });
        }
      })
      .catch(() => {});

    fetch('/api/auth/status', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setIsInitialized(data.initialized))
      .catch(() => setIsInitialized(true));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isInitialized ? '/api/auth/login' : '/api/auth/setup';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      const idToken = await signInWithGoogle();
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google sign-in failed');
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      setError(googleErrorToMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#e2e2df] p-4 text-[#070607]">
      <div className="w-full max-w-lg rounded-[40px] bg-[#f7f6f2] p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#fc5000] text-[#070607]">
            <Flame className="h-8 w-8 fill-current" />
          </div>
          <h1 className="font-display text-5xl uppercase tracking-tight text-[#070607]">
            CALDERA BOT
          </h1>
          <p className="text-sm font-medium text-[#070607]/70 mt-1">
            {isInitialized === false ? 'Initial Admin Setup' : 'Control Dashboard Login'}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-[20px] bg-[#fc5000]/10 border border-[#fc5000] p-4 text-sm font-medium text-[#fc5000]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 h-5 w-5 text-[#070607]/40" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3 pl-12 pr-6 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#070607]/70">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-5 w-5 text-[#070607]/40" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-full border-1.5 border-[#070607]/20 bg-[#e2e2df] py-3 pl-12 pr-6 text-sm font-medium text-[#070607] placeholder-[#070607]/40 focus:border-[#fc5000] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#fc5000] py-4 text-base font-semibold text-[#070607] transition hover:bg-[#070607] hover:text-[#ffffff] disabled:opacity-50 mt-4"
          >
            {loading ? 'Authenticating...' : isInitialized === false ? 'Create Admin Account' : 'Sign In'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#070607]/15" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#070607]/50">
            or
          </span>
          <div className="h-px flex-1 bg-[#070607]/15" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="flex w-full items-center justify-center gap-3 rounded-full border-1.5 border-[#070607]/20 bg-[#ffffff] py-4 text-base font-semibold text-[#070607] transition hover:border-[#070607] hover:bg-[#e2e2df] disabled:opacity-50"
        >
          <GoogleIcon className="h-5 w-5" />
          {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}
