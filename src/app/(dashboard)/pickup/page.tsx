'use client';

import { PageWrapper } from '@/components/layout/page-wrapper';
import { GlassCard } from '@/components/shared/glass-card';
import { StatusPill } from '@/components/shared/status-pill';
import { GradientButton } from '@/components/shared/gradient-button';
import { EmptyState } from '@/components/shared/empty-state';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import type { EmailAccount, MailMessage, OTPResult } from '@/types';
import {
  Mail, Key, Copy, Check, ChevronLeft, ChevronRight,
  XCircle, RefreshCw, Crosshair, Clock,
  User, Search, Shield, Activity, Zap, Hash
} from 'lucide-react';

export default function PickupPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [otpResults, setOtpResults] = useState<OTPResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [autoFetch, setAutoFetch] = useState(false);

  const filteredAccounts = accounts.filter(a =>
    a.email.toLowerCase().includes(searchEmail.toLowerCase())
  );
  const selectedAccount = selectedIndex >= 0 ? filteredAccounts[selectedIndex] : null;
  const topOTP = otpResults[0];
  const currentPos = selectedIndex + 1;
  const totalCount = filteredAccounts.length;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex < filteredAccounts.length - 1;

  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounts');
      const json = await res.json();
      if (json.success && json.data) {
        setAccounts(json.data.filter((a: any) => a.status === 'active'));
      }
    } catch (err) { console.error('Failed to fetch accounts:', err); }
    setLoading(false);
  };

  const selectAccount = useCallback((idx: number) => {
    setSelectedIndex(idx);
    setMessages([]);
    setOtpResults([]);
  }, []);

  const goPrev = useCallback(() => { if (hasPrev) selectAccount(selectedIndex - 1); }, [hasPrev, selectedIndex, selectAccount]);
  const goNext = useCallback(() => { if (hasNext) selectAccount(selectedIndex + 1); }, [hasNext, selectedIndex, selectAccount]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
      if (e.key === 'Enter' && selectedAccount) { e.preventDefault(); fetchMail(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext, selectedAccount]);

  const fetchMail = async () => {
    if (!selectedAccount) return;
    setFetching(true);
    try {
      const res = await fetch('/api/mail/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: selectedAccount.id }),
      });
      const data = await res.json();
      if (data.data?.messages) setMessages(data.data.messages);
      if (data.data?.otps) setOtpResults(data.data.otps);
    } finally { setFetching(false); }
  };

  const fetchAndNext = async () => {
    await fetchMail();
    if (hasNext) {
      setTimeout(() => goNext(), 800);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Inline style helpers
  const navBtn = (enabled: boolean): React.CSSProperties => ({
    width: 48, height: 48, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: enabled ? 'rgba(37,99,235,0.08)' : 'rgba(148,163,184,0.06)',
    border: `1px solid ${enabled ? 'rgba(37,99,235,0.15)' : 'rgba(148,163,184,0.1)'}`,
    color: enabled ? '#2563eb' : '#cbd5e1',
    cursor: enabled ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s',
    opacity: enabled ? 1 : 0.4,
  });

  return (
    <PageWrapper title="Mail Pickup" subtitle="Fetch emails and extract verification codes">
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, minHeight: 'calc(100vh - 200px)' }}>

        {/* ═══ LEFT PANEL — Email List ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <GlassCard padding="sm" className="flex-1 flex flex-col">
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 8px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <User style={{ width: 18, height: 18, color: '#2563eb' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>Email List</h3>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{totalCount} accounts loaded</p>
                </div>
              </div>
              <div style={{
                padding: '6px 14px', borderRadius: 100,
                background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.12)',
              }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#2563eb' }}>{totalCount}</span>
              </div>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 12, padding: '0 4px' }}>
              <Search style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Filter emails..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px 12px 44px',
                  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(59,130,246,0.1)',
                  borderRadius: 12, fontSize: 14, color: '#1e293b', outline: 'none',
                }}
              />
            </div>

            {/* Email List */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 420px)', padding: '0 4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredAccounts.map((account, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button key={account.id}
                      onClick={() => selectAccount(idx)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                        background: isSelected ? 'rgba(37,99,235,0.08)' : 'transparent',
                        border: isSelected ? '1px solid rgba(37,99,235,0.15)' : '1px solid transparent',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(59,130,246,0.04)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isSelected ? 'rgba(37,99,235,0.08)' : 'transparent'; }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        background: isSelected ? '#2563eb' : 'transparent',
                        border: isSelected ? '2px solid #2563eb' : '2px solid #cbd5e1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                      }}>
                        {isSelected && <Check style={{ width: 12, height: 12, color: 'white' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 13, fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? '#2563eb' : '#475569',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          transition: 'color 0.2s',
                        }}>
                          {account.email}
                        </p>
                      </div>
                      <div style={{
                        padding: '2px 8px', borderRadius: 6,
                        background: account.health_score > 80 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                        border: `1px solid ${account.health_score > 80 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}`,
                      }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                          color: account.health_score > 80 ? '#059669' : '#d97706',
                        }}>{account.health_score}%</span>
                      </div>
                    </button>
                  );
                })}
                {filteredAccounts.length === 0 && !loading && (
                  <div style={{ padding: '40px 0', textAlign: 'center' }}>
                    <Mail style={{ width: 32, height: 32, color: '#cbd5e1', margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 14, color: '#94a3b8' }}>No accounts found</p>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>

          {/* ═══ NAVIGATION CONTROLS ═══ */}
          <GlassCard padding="sm">
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12,
            }}>
              <button onClick={goPrev} disabled={!hasPrev} style={navBtn(hasPrev)}
                onMouseEnter={(e) => { if (hasPrev) e.currentTarget.style.background = 'rgba(37,99,235,0.14)'; }}
                onMouseLeave={(e) => { if (hasPrev) e.currentTarget.style.background = 'rgba(37,99,235,0.08)'; }}
              >
                <ChevronLeft style={{ width: 22, height: 22 }} />
              </button>

              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#1e293b', lineHeight: 1 }}>
                  {selectedIndex >= 0 ? currentPos : '—'}
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8' }}> / {totalCount}</span>
                </div>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {selectedIndex >= 0 ? 'Account Selected' : 'Select Account'}
                </p>
              </div>

              <button onClick={goNext} disabled={!hasNext} style={navBtn(hasNext)}
                onMouseEnter={(e) => { if (hasNext) e.currentTarget.style.background = 'rgba(37,99,235,0.14)'; }}
                onMouseLeave={(e) => { if (hasNext) e.currentTarget.style.background = 'rgba(37,99,235,0.08)'; }}
              >
                <ChevronRight style={{ width: 22, height: 22 }} />
              </button>
            </div>

            {/* Keyboard Hint */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
              marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(59,130,246,0.06)',
            }}>
              {[
                { key: '←', label: 'Prev' },
                { key: '→', label: 'Next' },
                { key: '↵', label: 'Fetch' },
              ].map(k => (
                <div key={k.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6,
                    background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.1)',
                    fontSize: 12, fontWeight: 700, color: '#64748b', fontFamily: 'monospace',
                  }}>{k.key}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{k.label}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* ═══ RIGHT PANEL — Main Content ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Controls Bar */}
          {selectedAccount && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <GlassCard padding="sm">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Account Info */}
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(37,99,235,0.15)',
                  }}>
                    <Mail style={{ width: 24, height: 24, color: 'white' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{selectedAccount.email}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <StatusPill status={selectedAccount.status} />
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>Health: {selectedAccount.health_score}%</span>
                      <span style={{ fontSize: 12, color: '#cbd5e1' }}>•</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>#{currentPos} of {totalCount}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GradientButton size="sm" onClick={fetchMail} loading={fetching}>
                      <Crosshair style={{ width: 18, height: 18 }} />
                      Fetch Mail
                    </GradientButton>
                    <GradientButton variant="secondary" size="sm" onClick={fetchAndNext}>
                      <Zap style={{ width: 18, height: 18 }} />
                      Fetch & Next
                    </GradientButton>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* OTP Display */}
          <AnimatePresence>
            {topOTP && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
                <GlassCard glow>
                  <div style={{
                    textAlign: 'center', padding: '32px 0',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {/* Background glow */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'radial-gradient(circle at center, rgba(37,99,235,0.04) 0%, transparent 70%)',
                    }} />
                    <div style={{ position: 'relative' }}>
                      <div style={{
                        width: 64, height: 64, borderRadius: 20, margin: '0 auto 20px',
                        background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 32px rgba(37,99,235,0.2)',
                      }}>
                        <Key style={{ width: 32, height: 32, color: 'white' }} />
                      </div>

                      <p style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 12 }}>
                        Verification Code
                      </p>

                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        marginBottom: 16,
                      }}>
                        {topOTP.code.split('').map((char: string, i: number) => (
                          <div key={i} style={{
                            width: 52, height: 64, borderRadius: 14,
                            background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 32, fontWeight: 900, color: '#2563eb', fontFamily: 'monospace',
                          }}>
                            {char}
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
                        <StatusPill status={topOTP.status || 'fresh'} />
                        <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{topOTP.code_type || 'OTP'}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <GradientButton onClick={() => copyCode(topOTP.code)} size="md">
                          {copied ? <Check style={{ width: 20, height: 20 }} /> : <Copy style={{ width: 20, height: 20 }} />}
                          {copied ? 'Copied!' : 'Copy Code'}
                        </GradientButton>
                        <GradientButton variant="secondary" size="md" onClick={fetchAndNext}>
                          <ChevronRight style={{ width: 20, height: 20 }} />
                          Next Account
                        </GradientButton>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          {selectedAccount && (
            <GlassCard>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>Messages</h3>
                  {messages.length > 0 && (
                    <span style={{
                      padding: '4px 12px', borderRadius: 100,
                      background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.12)',
                      fontSize: 13, fontWeight: 700, color: '#2563eb',
                    }}>{messages.length}</span>
                  )}
                </div>
                <GradientButton variant="secondary" size="sm" onClick={fetchMail} loading={fetching}>
                  <RefreshCw style={{ width: 16, height: 16 }} />
                  Refresh
                </GradientButton>
              </div>
              {messages.length === 0 ? (
                <EmptyState
                  title="No messages yet"
                  description="Click 'Fetch Mail' to retrieve messages from this account"
                  icon={<Mail className="w-10 h-10 text-blue-400" />}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {messages.map((msg) => (
                    <div key={msg.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 16,
                      padding: 16, borderRadius: 14, cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59,130,246,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: msg.has_otp ? 'rgba(37,99,235,0.06)' : 'rgba(148,163,184,0.06)',
                        border: `1px solid ${msg.has_otp ? 'rgba(37,99,235,0.12)' : 'rgba(148,163,184,0.1)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {msg.has_otp
                          ? <Key style={{ width: 20, height: 20, color: '#2563eb' }} />
                          : <Mail style={{ width: 20, height: 20, color: '#94a3b8' }} />
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{msg.sender}</span>
                          {msg.has_otp && (
                            <span style={{
                              padding: '2px 8px', borderRadius: 6,
                              background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.12)',
                              fontSize: 10, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase',
                            }}>OTP</span>
                          )}
                        </div>
                        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{msg.subject}</p>
                        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.body_preview}
                        </p>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock style={{ width: 14, height: 14 }} />
                        {new Date(msg.received_at).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          )}

          {/* Empty State */}
          {!selectedAccount && (
            <GlassCard className="flex-1">
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: 500, textAlign: 'center',
              }}>
                <div>
                  <div style={{
                    width: 80, height: 80, borderRadius: 24, margin: '0 auto 24px',
                    background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Crosshair style={{ width: 40, height: 40, color: 'rgba(37,99,235,0.35)' }} />
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
                    Select an account to begin
                  </h3>
                  <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
                    Choose an email from the list or use <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.1)', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#64748b' }}>←</span> <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.1)', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#64748b' }}>→</span> arrow keys to navigate.
                  </p>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
