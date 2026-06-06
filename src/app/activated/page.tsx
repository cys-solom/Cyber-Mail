'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, Copy, Check, Trash2, Download, ArrowLeft,
  Search, FileDown, X, RefreshCw, Zap
} from 'lucide-react';

interface ExportedAccount {
  email: string;
  password: string;
  authCode?: string;
  exportedAt: string;
}

const C = {
  blue:   '#3b82f6',
  purple: '#8b5cf6',
  green:  '#10b981',
  red:    '#ef4444',
  amber:  '#f59e0b',
  text1:  '#f1f5f9',
  text2:  '#94a3b8',
  text3:  '#475569',
  card:   'rgba(12,18,32,0.85)',
  border: 'rgba(255,255,255,0.06)',
};

export default function ActivatedPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Record<string, ExportedAccount>>({});
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [showClear, setShowClear] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = () => {
    try {
      const data = JSON.parse(localStorage.getItem('ds_exported_accounts') || '{}');
      setAccounts(data);
    } catch {
      setAccounts({});
    }
  };

  const allList = Object.values(accounts).sort(
    (a, b) => new Date(b.exportedAt).getTime() - new Date(a.exportedAt).getTime()
  );

  const filtered = allList.filter(a =>
    !search || a.email.toLowerCase().includes(search.toLowerCase())
  );

  const copyOne = (email: string, password: string, authCode?: string) => {
    const text = authCode ? `${email}|${password}|${authCode}` : `${email}|${password}`;
    navigator.clipboard.writeText(text);
    setCopied(email);
    setTimeout(() => setCopied(''), 2000);
  };

  const copyAll = () => {
    const text = filtered.map(a =>
      a.authCode ? `${a.email}|${a.password}|${a.authCode}` : `${a.email}|${a.password}`
    ).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const downloadTxt = () => {
    const text = filtered.map(a =>
      a.authCode ? `${a.email}|${a.password}|${a.authCode}` : `${a.email}|${a.password}`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activated_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeOne = (email: string) => {
    setAccounts(prev => {
      const next = { ...prev };
      delete next[email];
      localStorage.setItem('ds_exported_accounts', JSON.stringify(next));
      return next;
    });
  };

  const clearAll = () => {
    localStorage.removeItem('ds_exported_accounts');
    setAccounts({});
    setShowClear(false);
  };

  const card: React.CSSProperties = {
    background: C.card,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#070b14', display: 'flex', flexDirection: 'column' }}>

      {/* ══ HEADER ══ */}
      <header style={{ ...card, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: '0 28px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(7,11,20,0.95)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => router.push('/app')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: C.text2, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            <ArrowLeft style={{ width: 14, height: 14 }} /> Back
          </button>
          <div style={{ width: 1, height: 20, background: C.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(59,130,246,0.15))', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield style={{ width: 16, height: 16, color: C.purple }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.text1 }}>
                Cyber<span style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Mail</span>
              </div>
            </div>
            <div style={{ width: 1, height: 18, background: C.border }} />
            <span style={{ fontSize: 11, color: C.purple, fontWeight: 700, letterSpacing: '0.08em' }}>ACTIVATED ACCOUNTS</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: '4px 12px', borderRadius: 100, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.purple }}>{allList.length} saved</span>
          </div>
          <button onClick={loadAccounts} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw style={{ width: 14, height: 14, color: C.text3 }} />
          </button>
          {allList.length > 0 && (
            <button onClick={() => setShowClear(true)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Trash2 style={{ width: 14, height: 14, color: C.red }} />
            </button>
          )}
        </div>
      </header>

      {/* ══ CONTENT ══ */}
      <div style={{ flex: 1, padding: '24px 28px', maxWidth: 820, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {allList.length === 0 ? (
          /* Empty State */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield style={{ width: 34, height: 34, color: 'rgba(139,92,246,0.4)' }} />
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 8 }}>No activated accounts yet</p>
              <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.7, maxWidth: 360, margin: '0 auto' }}>
                Mark accounts with ✓ in the main page, then click <strong style={{ color: C.green }}>Export</strong> to save them here permanently.
              </p>
            </div>
            <button onClick={() => router.push('/app')} style={{ marginTop: 8, padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap style={{ width: 14, height: 14 }} /> Go to Main Page
            </button>
          </div>
        ) : (
          <>
            {/* Search + Actions bar */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: C.text3 }} />
                <input
                  type="text"
                  placeholder="Search email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', color: C.text1, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.text3, cursor: 'pointer', display: 'flex' }}>
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                )}
              </div>
              <button onClick={copyAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: `1px solid ${copiedAll ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.15)'}`, background: copiedAll ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.06)', color: C.green, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {copiedAll ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                {copiedAll ? 'Copied!' : `Copy All (${filtered.length})`}
              </button>
              <button onClick={downloadTxt} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)', color: '#a5b4fc', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <FileDown style={{ width: 14, height: 14 }} /> Download .TXT
              </button>
            </div>

            {/* Accounts List */}
            <div style={{ ...card, overflow: 'hidden' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: C.text3, fontSize: 13 }}>No results for "{search}"</div>
              ) : (
                filtered.map((acc, i) => (
                  <div key={acc.email} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderBottom: i < filtered.length - 1 ? `1px solid rgba(255,255,255,0.03)` : 'none',
                    transition: 'background 0.12s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Status dot */}
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.purple, boxShadow: `0 0 6px ${C.purple}`, flexShrink: 0 }} />

                    {/* Email */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#c4b5fd', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {acc.email}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <p style={{ fontSize: 11, color: C.text3, fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.password}
                        </p>
                        {acc.authCode && (
                          <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', fontSize: 10, fontWeight: 700, color: '#c084fc', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                            {acc.authCode}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Time */}
                    <span style={{ fontSize: 10, color: C.text3, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(acc.exportedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Copy button */}
                    <button
                      onClick={() => copyOne(acc.email, acc.password, acc.authCode)}
                      style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${copied === acc.email ? 'rgba(16,185,129,0.3)' : C.border}`, background: copied === acc.email ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                    >
                      {copied === acc.email
                        ? <Check style={{ width: 12, height: 12, color: C.green }} />
                        : <Copy style={{ width: 12, height: 12, color: C.text3 }} />
                      }
                    </button>

                    {/* Remove button */}
                    <button
                      onClick={() => removeOne(acc.email)}
                      style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(239,68,68,0.1)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s', opacity: 0.5 }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <X style={{ width: 12, height: 12, color: C.red }} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer count */}
            <p style={{ textAlign: 'center', fontSize: 11, color: C.text3, marginTop: 12, fontWeight: 600 }}>
              {filtered.length} of {allList.length} accounts shown
            </p>
          </>
        )}
      </div>

      {/* ══ CLEAR CONFIRM MODAL ══ */}
      {showClear && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowClear(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', ...card, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 style={{ width: 22, height: 22, color: C.red }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 8 }}>Clear All Activated?</p>
            <p style={{ fontSize: 13, color: C.text3, marginBottom: 24, lineHeight: 1.6 }}>
              This will permanently delete all {allList.length} saved accounts from this page. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowClear(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: `1px solid ${C.border}`, background: 'transparent', color: C.text2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={clearAll} style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #dc2626, #ef4444)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Clear All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
