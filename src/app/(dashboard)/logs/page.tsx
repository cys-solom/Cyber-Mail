'use client';

import { PageWrapper } from '@/components/layout/page-wrapper';
import { GlassCard } from '@/components/shared/glass-card';
import { GradientButton } from '@/components/shared/gradient-button';
import { EmptyState } from '@/components/shared/empty-state';
import { useState, useEffect } from 'react';
import type { AuditLog } from '@/types';
import { ScrollText, Download, Filter, Clock, User, Activity } from 'lucide-react';

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/logs');
      const json = await res.json();
      if (json.success && json.data) setLogs(json.data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
    setLoading(false);
  };

  const exportLogs = () => {
    const csv = [
      'Timestamp,Action,Target,Details',
      ...logs.map((l) =>
        `${l.created_at},${l.action},${l.target_type || ''},${JSON.stringify(l.details || {})}`
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const actionColors: Record<string, string> = {
    create: 'bg-emerald-100 text-emerald-700',
    update: 'bg-sky-100 text-sky-700',
    delete: 'bg-red-100 text-red-700',
    fetch: 'bg-cyan-100 text-cyan-700',
    login: 'bg-violet-100 text-violet-700',
  };

  return (
    <PageWrapper
      title="Audit Logs"
      subtitle="Track all actions and events across the platform"
      actions={
        <GradientButton variant="secondary" size="sm" onClick={exportLogs}>
          <Download className="w-4 h-4" /> Export CSV
        </GradientButton>
      }
    >
      <GlassCard padding="sm">
        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 px-2">
          <Filter className="w-4 h-4 text-slate-400" />
          {['all', 'create', 'update', 'delete', 'fetch', 'login'].map((action) => (
            <button
              key={action}
              onClick={() => setActionFilter(action)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                actionFilter === action
                   ? 'bg-blue-100 text-blue-700'
                   : 'text-slate-500 hover:bg-blue-50'
              }`}
            >
              {action.charAt(0).toUpperCase() + action.slice(1)}
            </button>
          ))}
        </div>

        {logs.length === 0 && !loading ? (
          <EmptyState
            title="No audit logs"
            description="Actions will be recorded here as they happen"
            icon={<ScrollText className="w-9 h-9 text-sky-500" />}
          />
        ) : (
          <div className="space-y-1">
            {(actionFilter === 'all' ? logs : logs.filter((l) => l.action.startsWith(actionFilter))).map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-blue-50/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        actionColors[log.action.split('.')[0]] || 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {log.action}
                    </span>
                    {log.target_type && (
                      <span className="text-xs text-slate-400">{log.target_type}</span>
                    )}
                  </div>
                  {log.details && (
                    <p className="text-xs text-slate-500 mt-1 font-mono truncate">
                      {JSON.stringify(log.details).slice(0, 100)}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                  {log.ip_address && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{log.ip_address}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </PageWrapper>
  );
}
