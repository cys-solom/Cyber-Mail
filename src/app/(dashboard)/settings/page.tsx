'use client';

import { PageWrapper } from '@/components/layout/page-wrapper';
import { GlassCard } from '@/components/shared/glass-card';
import { GradientButton } from '@/components/shared/gradient-button';
import { StatusPill } from '@/components/shared/status-pill';
import { useState, useEffect } from 'react';
import type { EmailAccount } from '@/types';
import {
  Settings as SettingsIcon, Users, Shield, Clock,
  Save, AlertTriangle, RefreshCw, Key
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'tokens' | 'employees'>('general');
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);

  useEffect(() => {
    if (activeTab === 'tokens') fetchAccounts();
  }, [activeTab]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const json = await res.json();
      if (json.success && json.data) setAccounts(json.data);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: SettingsIcon },
    { id: 'tokens' as const, label: 'Token Monitor', icon: Key },
    { id: 'employees' as const, label: 'Employees', icon: Users },
  ];

  return (
    <PageWrapper title="Settings" subtitle="Configure the dashboard and manage team">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white/60 backdrop-blur-lg rounded-xl border border-blue-100 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white shadow-sm text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <GlassCard>
          <h3 className="text-base font-semibold text-slate-800 mb-5">General Settings</h3>
          <div className="space-y-5 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">App Name</label>
              <input
                type="text"
                defaultValue="Diaa Store — Mail Dashboard"
                className="w-full px-4 py-2.5 bg-white/70 border border-blue-100 rounded-xl text-sm focus:bg-white/90 focus:border-blue-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Auto-refresh Interval (seconds)</label>
              <input
                type="number"
                defaultValue={30}
                className="w-full px-4 py-2.5 bg-white/70 border border-blue-100 rounded-xl text-sm focus:bg-white/90 focus:border-blue-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Default Queue Batch Size</label>
              <input
                type="number"
                defaultValue={10}
                className="w-full px-4 py-2.5 bg-white/70 border border-blue-100 rounded-xl text-sm focus:bg-white/90 focus:border-blue-300 transition-all"
              />
            </div>
            <GradientButton size="sm">
              <Save className="w-4 h-4" /> Save Changes
            </GradientButton>
          </div>
        </GlassCard>
      )}

      {/* Token Monitor */}
      {activeTab === 'tokens' && (
        <GlassCard padding="sm">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-base font-semibold text-slate-800">Token Expiry Monitor</h3>
            <GradientButton variant="secondary" size="sm" onClick={fetchAccounts}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </GradientButton>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Token Expires</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const isExpiringSoon = account.token_expires_at &&
                  new Date(account.token_expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000;
                return (
                  <tr key={account.id}>
                    <td className="font-medium text-slate-700">{account.email}</td>
                    <td><StatusPill status={account.status} /></td>
                    <td>
                      <span className={`text-xs ${isExpiringSoon ? 'text-amber-600 font-semibold' : 'text-slate-500'}`}>
                        {isExpiringSoon && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                        {account.token_expires_at
                          ? new Date(account.token_expires_at).toLocaleString()
                          : 'Unknown'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                            style={{ width: `${account.health_score}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{account.health_score}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </GlassCard>
      )}

      {/* Employees */}
      {activeTab === 'employees' && (
        <GlassCard>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-slate-800">Employee Management</h3>
            <GradientButton size="sm">
              <Users className="w-4 h-4" /> Add Employee
            </GradientButton>
          </div>
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-violet-500" />
            </div>
            <p className="text-sm text-slate-500">Employee management coming soon</p>
            <p className="text-xs text-slate-400 mt-1">Add and manage team members with role-based access</p>
          </div>
        </GlassCard>
      )}
    </PageWrapper>
  );
}
