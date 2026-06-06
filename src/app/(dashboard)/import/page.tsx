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
    const items: ImportLine[] = [];

    for (const raw of lines) {
      const line = raw.trim();

      // تجاهل الخطوط الفاصلة مثل ────────────
      if (!line.includes('@')) continue;

      let emailField = '', password = '', thirdField = '', fourthField = '';

      if (line.includes('----')) {
        // صيغة: email----password----client_id----refresh_token
        const parts = line.split('----');
        if (parts.length < 4) {
          items.push({ email: parts[0] || '', password: '', client_id: '', refresh_token: '', valid: false, error: 'Invalid format — need 4 fields' });
          continue;
        }
        emailField  = parts[0]?.trim() || '';
        password    = parts[1]?.trim() || '';
        thirdField  = parts[2]?.trim() || '';
        fourthField = parts[3]?.trim() || '';
      } else {
        // صيغة: email|password|refresh_token|client_id
        const p1 = line.indexOf('|');
        const p2 = p1 !== -1 ? line.indexOf('|', p1 + 1) : -1;
        const p3 = p2 !== -1 ? line.indexOf('|', p2 + 1) : -1;
        if (p1 === -1 || p2 === -1 || p3 === -1) {
          items.push({ email: line.slice(0, p1 > -1 ? p1 : undefined) || line, password: '', client_id: '', refresh_token: '', valid: false, error: 'Invalid format — need 4 fields separated by |' });
          continue;
        }
        emailField  = line.slice(0, p1).trim();
        password    = line.slice(p1 + 1, p2).trim();
        thirdField  = line.slice(p2 + 1, p3).trim();
        fourthField = line.slice(p3 + 1).trim();
      }

      // استخرج الإيميل الصحيح (يتجاهل الأرقام والرموز قبله مثل "9. ")
      const emailMatch = emailField.match(/[\w.+\-]+@[\w\-]+\.[\w.]+/);
      if (!emailMatch) {
        items.push({ email: emailField, password, client_id: '', refresh_token: '', valid: false, error: 'Invalid email address' });
        continue;
      }
      const email = emailMatch[0].trim();

      // حدد client_id و refresh_token بناءً على أيهما UUID
      const uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let client_id: string, refresh_token: string;
      if (uuidRx.test(fourthField))      { refresh_token = thirdField;  client_id = fourthField; }
      else if (uuidRx.test(thirdField))  { client_id = thirdField;      refresh_token = fourthField; }
      else                               { refresh_token = thirdField;   client_id = fourthField; }

      if (!email || !password || !client_id || !refresh_token) {
        items.push({ email, password, client_id, refresh_token, valid: false, error: 'Missing required fields' });
        continue;
      }

      items.push({ email, password, client_id, refresh_token, valid: true });
    }

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
      if (data.success) {
        try {
          const backup = JSON.parse(localStorage.getItem('ds_import_backup') || '{}');
          validItems.forEach(item => {
            backup[item.email] = {
              email: item.email,
              password: item.password,
              client_id: item.client_id,
              refresh_token: item.refresh_token
            };
          });
          localStorage.setItem('ds_import_backup', JSON.stringify(backup));
        } catch (e) {
          console.error('Failed to update ds_import_backup:', e);
        }
      }
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
                <p className="text-sm font-medium text-sky-400">Supported Import Formats</p>
                <code className="block mt-1 text-xs text-sky-400 font-mono bg-sky-500/15/60 p-2 rounded-lg">
                  email|password|refresh_token|client_id
                </code>
                <code className="block mt-1 text-xs text-sky-400 font-mono bg-sky-500/15/60 p-2 rounded-lg">
                  email----password----client_id----refresh_token
                </code>
                <p className="text-xs text-sky-400/70 mt-1">One account per line. Numbered lines (e.g. "9. email@...") and separator lines (────) are automatically skipped.</p>
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
                placeholder={`email@hotmail.com|password123|M.C515_BAY...$$ |9e5f94bc-e8a4-4e73-b8be-63364c29d753\n9. email2@hotmail.com|pass2|token...|client-uuid\n────────────  (separator lines are ignored)`}
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
