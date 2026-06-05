'use client';

import { PageWrapper } from '@/components/layout/page-wrapper';
import { GlassCard } from '@/components/shared/glass-card';
import { GradientButton } from '@/components/shared/gradient-button';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Copy } from 'lucide-react';

interface ImportLine {
  email: string;
  password: string;
  client_id: string;
  refresh_token: string;
  valid: boolean;
  error?: string;
}

export default function ImportPage() {
  const [rawInput, setRawInput] = useState('');
  const [parsed, setParsed] = useState<ImportLine[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const [step, setStep] = useState<'input' | 'preview' | 'result'>('input');

  const parseInput = () => {
    const lines = rawInput.trim().split('\n').filter(Boolean);
    const items: ImportLine[] = lines.map((line) => {
      const parts = line.split('----');
      if (parts.length < 4) {
        return {
          email: parts[0] || '',
          password: '',
          client_id: '',
          refresh_token: '',
          valid: false,
          error: 'Invalid format — need 4 fields separated by ----',
        };
      }
      return {
        email: parts[0].trim(),
        password: parts[1].trim(),
        client_id: parts[2].trim(),
        refresh_token: parts[3].trim(),
        valid: true,
      };
    });
    setParsed(items);
    setStep('preview');
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const validItems = parsed.filter((p) => p.valid);
      const res = await fetch('/api/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: validItems }),
      });
      const data = await res.json();
      setResult({ success: data.data?.success ?? 0, failed: data.data?.failed ?? 0 });
      setStep('result');
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsed.filter((p) => p.valid).length;
  const invalidCount = parsed.filter((p) => !p.valid).length;

  return (
    <PageWrapper
      title="Batch Import"
      subtitle="Import email accounts in bulk using the standard format"
    >
      {step === 'input' && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard>
            {/* Format hint */}
            <div className="flex items-start gap-3 p-4 mb-5 rounded-xl bg-sky-500/8/60 border border-sky-200/30">
              <AlertCircle className="w-5 h-5 text-sky-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-sky-400">Import Format</p>
                <code className="block mt-1 text-xs text-sky-400 font-mono bg-sky-500/15/60 p-2 rounded-lg">
                  email----password----client_id----refresh_token
                </code>
                <p className="text-xs text-sky-400/70 mt-1">One account per line. Fields separated by four dashes (----).</p>
              </div>
            </div>

            {/* Input Area */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Paste Account Data
              </label>
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="user@outlook.com----password123----abc-client-id----refresh-token-here"
                rows={12}
                className="w-full px-4 py-3 bg-white/70 border border-blue-100 rounded-xl text-sm font-mono text-slate-700 placeholder:text-slate-400 focus:bg-white/90 focus:border-blue-300 transition-all resize-none"
              />
            </div>

            <div className="flex items-center justify-between mt-5">
              <p className="text-xs text-slate-500">
                {rawInput.trim().split('\n').filter(Boolean).length} lines detected
              </p>
              <GradientButton onClick={parseInput} disabled={!rawInput.trim()}>
                <FileText className="w-4 h-4" />
                Preview Import
              </GradientButton>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {step === 'preview' && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <GlassCard padding="sm" className="text-center">
              <p className="text-2xl font-bold text-slate-800">{parsed.length}</p>
              <p className="text-xs text-slate-500 mt-1">Total Entries</p>
            </GlassCard>
            <GlassCard padding="sm" className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{validCount}</p>
              <p className="text-xs text-slate-500 mt-1">Valid</p>
            </GlassCard>
            <GlassCard padding="sm" className="text-center">
              <p className="text-2xl font-bold text-red-500">{invalidCount}</p>
              <p className="text-xs text-slate-500 mt-1">Invalid</p>
            </GlassCard>
          </div>

          {/* Preview Table */}
          <GlassCard padding="sm">
            <div className="overflow-x-auto max-h-96">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Email</th>
                    <th>Client ID</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((p, i) => (
                    <tr key={i}>
                      <td className="text-xs text-slate-400">{i + 1}</td>
                      <td className="font-medium text-slate-700">{p.email || '—'}</td>
                      <td className="text-xs text-slate-500 font-mono">{p.client_id ? p.client_id.slice(0, 12) + '...' : '—'}</td>
                      <td>
                        {p.valid ? (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                            <CheckCircle className="w-3.5 h-3.5" /> Valid
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
                            <XCircle className="w-3.5 h-3.5" /> {p.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between mt-5">
              <GradientButton variant="secondary" size="sm" onClick={() => setStep('input')}>Back</GradientButton>
              <GradientButton onClick={handleImport} loading={importing} disabled={validCount === 0}>
                <Upload className="w-4 h-4" />
                Import {validCount} Accounts
              </GradientButton>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {step === 'result' && result && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <GlassCard className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-400/30">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Import Complete</h2>
            <p className="text-sm text-slate-500 mb-6">
              {result.success} accounts imported successfully, {result.failed} failed
            </p>
            <div className="flex justify-center gap-3">
              <GradientButton variant="secondary" onClick={() => { setStep('input'); setRawInput(''); setParsed([]); }}>
                Import More
              </GradientButton>
              <GradientButton onClick={() => window.location.href = '/accounts'}>
                View Accounts
              </GradientButton>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </PageWrapper>
  );
}
