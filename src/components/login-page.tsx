'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LogIn, AlertCircle, Zap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error || 'Wrong password'); return; }
      window.location.href = '/app';
    } catch { setError('Connection error'); } finally { setLoading(false); }
  };

  return (
    <>
      <div className="login-bg" />

      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
      }}>
        {/* Card */}
        <div className="animate-in" style={{ width: '100%', maxWidth: 420 }}>

          {/* Logo Block */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 22,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.1))',
              border: '1px solid rgba(59,130,246,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 40px rgba(59,130,246,0.15)',
            }}>
              <Zap style={{ width: 34, height: 34, color: '#60a5fa' }} />
            </div>
            <h1 style={{
              fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: 6,
            }}>
              Cyber Mail
            </h1>
            <p style={{ fontSize: 13, color: '#475569', fontWeight: 500, letterSpacing: '0.08em' }}>
              CYBER MAIL
            </p>
          </div>

          {/* Form Card */}
          <div style={{
            background: 'rgba(12, 18, 32, 0.9)',
            backdropFilter: 'blur(24px)',
            border: `1px solid ${focused ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 20,
            padding: '36px 32px',
            boxShadow: focused
              ? '0 0 60px rgba(59,130,246,0.1), 0 20px 40px rgba(0,0,0,0.4)'
              : '0 20px 40px rgba(0,0,0,0.4)',
            transition: 'all 0.3s ease',
          }}>

            {/* Error */}
            {error && (
              <div className="animate-in" style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 10, fontSize: 13, color: '#f87171', marginBottom: 20,
              }}>
                <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} /> {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Password Field */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    width: 15, height: 15, color: focused ? '#3b82f6' : '#475569',
                    transition: 'color 0.2s',
                  }} />
                  <input
                    className="app-input"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="Enter password..."
                    required
                    autoComplete="current-password"
                    autoFocus
                    style={{ paddingLeft: 40, fontSize: 15 }}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !password}
                style={{
                  width: '100%', padding: '14px 0', border: 'none', borderRadius: 12,
                  background: loading || !password
                    ? 'rgba(59,130,246,0.3)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                  color: 'white',
                  fontSize: 15, fontWeight: 700, cursor: loading || !password ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.25s',
                  boxShadow: loading || !password ? 'none' : '0 4px 20px rgba(59,130,246,0.35)',
                  letterSpacing: '0.02em',
                }}
              >
                {loading ? (
                  <>
                    <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Logging in...
                  </>
                ) : (
                  <>
                    <LogIn style={{ width: 17, height: 17 }} />
                    Login
                  </>
                )}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#334155', marginTop: 24 }}>
            Cyber Mail · Local Mode
          </p>
        </div>
      </div>
    </>
  );
}
