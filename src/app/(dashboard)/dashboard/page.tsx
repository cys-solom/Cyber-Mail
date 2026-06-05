'use client';

import { PageWrapper } from '@/components/layout/page-wrapper';
import { GlassCard } from '@/components/shared/glass-card';
import { AnimatedCounter } from '@/components/shared/animated-counter';
import { StatusPill } from '@/components/shared/status-pill';
import { GradientButton } from '@/components/shared/gradient-button';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Mail, Shield, Key, Activity,
  TrendingUp, Clock, AlertTriangle,
  Zap, ArrowUpRight, RefreshCw
} from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, active: 0, otps: 0, health: 0 });
  const [recentOtps, setRecentOtps] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/accounts');
      const json = await res.json();
      if (json.success && json.data) {
        const accounts = json.data;
        const active = accounts.filter((a: any) => a.status === 'active').length;
        const totalOtps = accounts.reduce((sum: number, a: any) => sum + (a.total_otps || 0), 0);
        const avgHealth = accounts.length > 0
          ? Math.round(accounts.reduce((sum: number, a: any) => sum + (a.health_score || 0), 0) / accounts.length)
          : 0;
        setStats({ total: accounts.length, active, otps: totalOtps, health: avgHealth });
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const statsData = [
    { label: 'Total Accounts', value: stats.total, icon: Mail, gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)', trend: `${stats.total}` },
    { label: 'Active Accounts', value: stats.active, icon: Shield, gradient: 'linear-gradient(135deg, #059669, #10b981)', trend: `${stats.active}` },
    { label: 'OTPs Extracted', value: stats.otps, icon: Key, gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)', trend: `${stats.otps}` },
    { label: 'Avg Health', value: stats.health, icon: Activity, gradient: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', trend: `${stats.health}%`, suffix: '%' },
  ];

  const quickActions = [
    { icon: Zap, label: 'Start Queue', desc: 'Begin mail fetch session', color: '#2563eb', href: '/queue' },
    { icon: Mail, label: 'Fetch All', desc: 'Check all accounts', color: '#0891b2', href: '/pickup' },
    { icon: Activity, label: 'Import Accounts', desc: 'Batch import', color: '#7c3aed', href: '/import' },
  ];

  return (
    <PageWrapper
      title="Dashboard"
      subtitle="Overview of your Outlook mail operations"
      actions={
        <GradientButton size="sm" onClick={fetchStats} loading={refreshing}>
          <RefreshCw style={{ width: 18, height: 18 }} />
          Refresh
        </GradientButton>
      }
    >
      {/* Stats */}
      <motion.div variants={container} initial="hidden" animate="show"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {statsData.map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <GlassCard glow className="relative overflow-hidden">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {stat.label}
                  </p>
                  <div style={{ marginTop: 12, fontSize: 42, fontWeight: 900, color: '#1e293b', lineHeight: 1 }}>
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <TrendingUp style={{ width: 18, height: 18, color: '#059669' }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>{stat.trend}</span>
                  </div>
                </div>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: stat.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                }}>
                  <stat.icon style={{ width: 28, height: 28, color: 'white' }} />
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </motion.div>

      {/* Two Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.div variants={item} initial="hidden" animate="show" className="lg:col-span-2">
          <GlassCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Recent OTP Activity</h2>
                <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>Latest extracted verification codes</p>
              </div>
              <GradientButton variant="secondary" size="sm" onClick={() => router.push('/pickup')}>View All</GradientButton>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentOtps.length === 0 ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: 16, borderRadius: 14,
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Key style={{ width: 22, height: 22, color: '#3b82f6' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 17, fontWeight: 700, color: '#cbd5e1', fontFamily: 'monospace' }}>— — — —</span>
                      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>No data yet — connect your accounts</p>
                    </div>
                  </div>
                ))
              ) : (
                recentOtps.map((otp) => (
                  <div key={otp.id} style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: 16, borderRadius: 14, cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59,130,246,0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Key style={{ width: 22, height: 22, color: '#3b82f6' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', fontFamily: 'monospace', letterSpacing: '0.15em' }}>
                          {otp.code}
                        </span>
                        <StatusPill status="fresh" />
                      </div>
                      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {otp.subject || otp.sender || 'Unknown'}
                      </p>
                    </div>
                    <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {new Date(otp.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </motion.div>

        <motion.div variants={item} initial="hidden" animate="show" className="space-y-5">
          <GlassCard>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>Quick Actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {quickActions.map((action) => (
                <button key={action.label}
                  onClick={() => router.push(action.href)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                    padding: 16, borderRadius: 14, textAlign: 'left',
                    background: 'transparent', border: '1px solid transparent',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.04)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: `${action.color}10`, border: `1px solid ${action.color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <action.icon style={{ width: 22, height: 22, color: action.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#334155' }}>{action.label}</p>
                    <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{action.desc}</p>
                  </div>
                  <ArrowUpRight style={{ width: 20, height: 20, color: '#94a3b8' }} />
                </button>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle style={{ width: 22, height: 22, color: '#f59e0b' }} />
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Token Alerts</h2>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 14,
              background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)',
            }}>
              <Clock style={{ width: 22, height: 22, color: '#f59e0b', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#d97706' }}>No expiring tokens</p>
                <p style={{ fontSize: 13, color: '#b45309', opacity: 0.6, marginTop: 2 }}>All tokens are healthy</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </PageWrapper>
  );
}
