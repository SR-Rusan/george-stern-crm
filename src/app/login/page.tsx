'use client';

import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';

/** Only allow same-site relative paths, so `?next=` can't redirect off-site. */
function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return '/';
  }
  return raw;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    fetch('/api/public/branding')
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok) setBusinessName(json.data.business_name || '');
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
        window.location.replace(next);
        return;
      }
      setError(json?.error?.message || 'Login failed. Please try again.');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="mx-auto w-11 h-11 rounded-xl bg-brand flex items-center justify-center mb-3">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-stone-900">
            {businessName ? `${businessName} CRM` : 'CRM'}
          </h1>
          <p className="text-sm text-stone-500 mt-1">Sign in to the operator workspace</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-semibold text-stone-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs font-semibold text-stone-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
