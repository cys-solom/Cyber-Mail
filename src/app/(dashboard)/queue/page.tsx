'use client';

import { PageWrapper } from '@/components/layout/page-wrapper';
import { GlassCard } from '@/components/shared/glass-card';
import { GradientButton } from '@/components/shared/gradient-button';
import { AnimatedCounter } from '@/components/shared/animated-counter';
import { StatusPill } from '@/components/shared/status-pill';
import { EmptyState } from '@/components/shared/empty-state';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { QueueSession } from '@/types';
import {
  Play, Pause, Square, ListOrdered,
  Activity, Clock, Key, CheckCircle, SkipForward
} from 'lucide-react';

export default function QueuePage() {
  const [sessions, setSessions] = useState<QueueSession[]>([]);
  const [activeSession, setActiveSession] = useState<QueueSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/queue');
      const json = await res.json();
      if (json.success && json.data) {
        setSessions(json.data);
        setActiveSession(json.data.find((s: QueueSession) => s.status === 'active') || null);
      }
    } catch (err) {
      console.error('Failed to fetch queue sessions:', err);
    }
    setLoading(false);
  };

  const startQueue = async () => {
    setStarting(true);
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      if (res.ok) await fetchSessions();
    } finally {
      setStarting(false);
    }
  };

  const controlQueue = async (action: 'pause' | 'resume' | 'stop') => {
    if (!activeSession) return;
    await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, session_id: activeSession.id }),
    });
    await fetchSessions();
  };

  return (
    <PageWrapper
      title="Queue Management"
      subtitle="Control mail fetch queue sessions"
      actions={
        !activeSession ? (
          <GradientButton onClick={startQueue} size="sm" loading={starting}>
            <Play className="w-4 h-4" /> Start Queue
          </GradientButton>
        ) : undefined
      }
    >
      {/* Active Session */}
      {activeSession && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard glow className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-cyan-50/50" />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-400/20">
                    <Activity className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">Active Queue Session</h3>
                    <p className="text-xs text-slate-500">Started {new Date(activeSession.started_at).toLocaleString()}</p>
                  </div>
                </div>
                <StatusPill status={activeSession.status} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 rounded-xl bg-white/40">
                  <div className="text-2xl font-bold text-slate-800">
                    <AnimatedCounter value={activeSession.accounts_processed} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Processed</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/40">
                  <div className="text-2xl font-bold text-blue-600">
                    <AnimatedCounter value={activeSession.otps_found} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">OTPs Found</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/40">
                  <div className="text-2xl font-bold text-slate-800">
                    <AnimatedCounter value={0} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Remaining</p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                {activeSession.status === 'active' && (
                  <GradientButton variant="secondary" size="sm" onClick={() => controlQueue('pause')}>
                    <Pause className="w-4 h-4" /> Pause
                  </GradientButton>
                )}
                {activeSession.status === 'paused' && (
                  <GradientButton size="sm" onClick={() => controlQueue('resume')}>
                    <Play className="w-4 h-4" /> Resume
                  </GradientButton>
                )}
                <GradientButton variant="danger" size="sm" onClick={() => controlQueue('stop')}>
                  <Square className="w-4 h-4" /> Stop
                </GradientButton>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Session History */}
      <GlassCard>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Session History</h3>
        {sessions.length === 0 && !loading ? (
          <EmptyState
            title="No queue sessions"
            description="Start a queue session to begin processing accounts automatically"
            icon={<ListOrdered className="w-9 h-9 text-sky-500" />}
            actionLabel="Start Queue"
            onAction={startQueue}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Ended</th>
                  <th>Status</th>
                  <th>Processed</th>
                  <th>OTPs</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="text-xs text-slate-400">{new Date(session.started_at).toLocaleString()}</td>
                    <td className="text-xs text-slate-500">{session.ended_at ? new Date(session.ended_at).toLocaleString() : '—'}</td>
                    <td><StatusPill status={session.status} /></td>
                    <td className="text-sm font-medium text-slate-400">{session.accounts_processed}</td>
                    <td className="text-sm font-medium text-blue-600">{session.otps_found}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </PageWrapper>
  );
}
