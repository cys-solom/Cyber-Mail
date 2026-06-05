'use client';

import { PageWrapper } from '@/components/layout/page-wrapper';
import { GlassCard } from '@/components/shared/glass-card';
import { StatusPill } from '@/components/shared/status-pill';
import { GradientButton } from '@/components/shared/gradient-button';
import { EmptyState } from '@/components/shared/empty-state';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { EmailAccount } from '@/types';
import {
  Plus, Search, Filter, MoreVertical, Edit2, Trash2,
  TestTube, RefreshCw, Mail, Shield, Activity,
  ChevronLeft, ChevronRight
} from 'lucide-react';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounts');
      const json = await res.json();
      if (json.success && json.data) {
        setAccounts(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
    setLoading(false);
  };

  const filtered = accounts.filter((a) => {
    const matchSearch = a.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <PageWrapper
      title="Email Accounts"
      subtitle="Manage your Outlook email accounts"
      actions={
        <GradientButton onClick={() => setShowAddModal(true)} size="sm">
          <Plus className="w-4 h-4" />
          Add Account
        </GradientButton>
      }
    >
      {/* Filters Bar */}
      <GlassCard padding="sm" className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/70 border border-blue-100 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white/90 focus:border-blue-300 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          {['all', 'active', 'inactive', 'expired', 'failed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                statusFilter === s
                  ? 'bg-blue-100 text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:bg-blue-50'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Accounts Table */}
      <GlassCard padding="sm">
        {filtered.length === 0 && !loading ? (
          <EmptyState
            title="No accounts found"
            description="Add your first Outlook email account to start managing mail operations."
            actionLabel="Add Account"
            onAction={() => setShowAddModal(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Health</th>
                  <th>Last Check</th>
                  <th>Last Code</th>
                  <th>Fetches</th>
                  <th>OTPs</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j}><div className="skeleton h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : (
                  filtered.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Mail className="w-3.5 h-3.5 text-blue-500" />
                          </div>
                          <span className="font-medium text-slate-700">{account.email}</span>
                        </div>
                      </td>
                      <td><StatusPill status={account.status} /></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                              style={{ width: `${account.health_score}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-400">{account.health_score}%</span>
                        </div>
                      </td>
                      <td className="text-xs text-slate-500">
                        {account.last_checked_at
                          ? new Date(account.last_checked_at).toLocaleString()
                          : '—'}
                      </td>
                      <td>
                        {account.last_code ? (
                          <span className="font-mono text-sm font-semibold text-blue-600">{account.last_code}</span>
                        ) : '—'}
                      </td>
                      <td className="text-sm font-medium text-slate-400">{account.total_fetches}</td>
                      <td className="text-sm font-medium text-slate-400">{account.total_otps}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Add Account Modal */}
      {showAddModal && (
        <AddAccountModal onClose={() => setShowAddModal(false)} onSaved={fetchAccounts} />
      )}
    </PageWrapper>
  );
}

function AddAccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ email: '', password: '', client_id: '', refresh_token: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        onSaved();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg glass p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-800 mb-5">Add Email Account</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {['email', 'password', 'client_id', 'refresh_token'].map((field) => (
            <div key={field}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                {field.replace('_', ' ')}
              </label>
              <input
                type={field === 'password' ? 'password' : 'text'}
                value={(form as Record<string, string>)[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                required
                className="w-full px-4 py-2.5 bg-white/70 border border-blue-100 rounded-xl text-sm focus:bg-white/90 focus:border-blue-300 transition-all"
              />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <GradientButton type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</GradientButton>
            <GradientButton type="submit" size="sm" loading={loading}>Add Account</GradientButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
