'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Download, Copy, Check, FileDown,
  RotateCcw, Trash2, ArrowLeft, Send, Shield
} from 'lucide-react';

const C = {
  bg:     '#070b14',
  card:   'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.07)',
  text1:  '#f1f5f9',
  text2:  '#94a3b8',
  text3:  '#475569',
  red:    '#ef4444',
  green:  '#10b981',
  amber:  '#f59e0b',
  blue:   '#3b82f6',
  purple: '#8b5cf6',
};

interface BrokenAccount {
  id: string;
  email: string;
  password?: string;
}

export default function BrokenPage() {
  const router = useRouter();

  const [brokenIds,    setBrokenIds]    = useState<Set<string>>(new Set());
  const [allAccounts,  setAllAccounts]  = useState<{id:string;email:string}[]>([]);
  const [exportData,   setExportData]   = useState<BrokenAccount[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [exported,     setExported]     = useState(false);
  const [copiedAll,    setCopiedAll]    = useState(false);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [jumpedSet,    setJumpedSet]    = useState<Set<string>>(new Set()); // الأكونتات المُرسلة بـ Jump

  useEffect(() => {
    fetch('/api/auth/login').then(r => r.json()).then(d => {
      if (!d.success) router.push('/login');
    });
  }, []);

  useEffect(() => {
    let ids = new Set<string>();
    try { ids = new Set<string>(JSON.parse(localStorage.getItem('ds_broken') || '[]')); } catch {}
    setBrokenIds(ids);
    setSelected(new Set(ids));

    fetch('/api/accounts').then(r => r.json()).then(async d => {
      if (d.success) {
        if (d.data && d.data.length === 0) {
          let backup: Record<string, unknown> = {};
          try { backup = JSON.parse(localStorage.getItem('ds_import_backup') || '{}'); } catch {}
          const items = Object.values(backup);
          if (items.length > 0) {
            const res = await fetch('/api/accounts/import', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ accounts: items }) });
            const json = await res.json();
            if (json.success) {
              const res2 = await fetch('/api/accounts');
              const json2 = await res2.json();
              if (json2.success) setAllAccounts(json2.data || []);
            }
          }
        } else {
          setAllAccounts(d.data || []);
        }
      }
    });
  }, []);

  const brokenAccounts = allAccounts.filter(a => brokenIds.has(a.id));

  // ── استعادة أكونت للقائمة الرئيسية
  const restore = (id: string) => {
    setBrokenIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      localStorage.setItem('ds_broken', JSON.stringify([...next]));
      return next;
    });
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  // ── Jump: إرسال للـ activated وإخفاء من التالفة
  const jumpToActivated = async (acc: {id:string;email:string}) => {
    setJumpedSet(prev => new Set([...prev, acc.id]));

    // جيب الباسورد
    let password = '???';
    try {
      const r = await fetch(`/api/accounts/${acc.id}/credentials`);
      const d = await r.json();
      if (d.success && d.data?.password) password = d.data.password;
    } catch {}
    // fallback من الـ backup
    if (password === '???') {
      try {
        const backup: Record<string, {email:string;password:string}> = JSON.parse(localStorage.getItem('ds_import_backup') || '{}');
        const entry = backup[acc.email] || Object.values(backup).find(b => b.email === acc.email);
        if (entry?.password) password = entry.password;
      } catch {}
    }

    // احفظ في ds_exported_accounts
    try {
      const existing: Record<string, {email:string;password:string;exportedAt:string;jumped?:boolean}> =
        JSON.parse(localStorage.getItem('ds_exported_accounts') || '{}');
      existing[acc.email] = { email: acc.email, password, exportedAt: new Date().toISOString(), jumped: true };
      localStorage.setItem('ds_exported_accounts', JSON.stringify(existing));
    } catch {}

    // أضف لـ ds_jumped (لإخفائه من الرئيسية أيضاً)
    try {
      const jumped: string[] = JSON.parse(localStorage.getItem('ds_jumped') || '[]');
      if (!jumped.includes(acc.id)) {
        jumped.push(acc.id);
        localStorage.setItem('ds_jumped', JSON.stringify(jumped));
      }
    } catch {}

    // أزله من التالفة
    restore(acc.id);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // ── Export عادي + حفظ في ds_exported_accounts
  const doExport = async () => {
    const toExport = brokenAccounts.filter(a => selected.has(a.id));
    if (!toExport.length) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        toExport.map(async acc => {
          let password = '???';
          try {
            const r = await fetch(`/api/accounts/${acc.id}/credentials`);
            const d = await r.json();
            if (d.success && d.data?.password) password = d.data.password;
          } catch {}
          // fallback
          if (password === '???') {
            try {
              const backup: Record<string, {email:string;password:string}> = JSON.parse(localStorage.getItem('ds_import_backup') || '{}');
              const entry = backup[acc.email] || Object.values(backup).find(b => b.email === acc.email);
              if (entry?.password) password = entry.password;
            } catch {}
          }
          return { id: acc.id, email: acc.email, password };
        })
      );
      setExportData(results);
      setExported(true);
      // ✅ حفظ في ds_exported_accounts
      try {
        const existing: Record<string, {email:string;password:string;exportedAt:string}> =
          JSON.parse(localStorage.getItem('ds_exported_accounts') || '{}');
        results.forEach(r => {
          if (r.password !== '???') {
            existing[r.email] = { email: r.email, password: r.password, exportedAt: new Date().toISOString() };
          }
        });
        localStorage.setItem('ds_exported_accounts', JSON.stringify(existing));
      } catch {}
    } finally { setLoading(false); }
  };

  const exportText = exportData.map(d => `${d.email}|${d.password}`).join('\n');
  const copyAll = () => { navigator.clipboard.writeText(exportText); setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2000); };
  const downloadTxt = () => {
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `broken_${new Date().toISOString().slice(0, 10)}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── مسح كل التالفة نهائياً
  const clearAllBroken = async () => {
    if (!confirm('مسح كل الأكونتات التالفة نهائياً؟')) return;
    const toDelete = [...brokenAccounts];
    try {
      await Promise.all(toDelete.map(acc => fetch(`/api/accounts/${acc.id}`, { method: 'DELETE' })));
    } catch {}
    // مسح من ds_import_backup
    try {
      const backup: Record<string, unknown> = JSON.parse(localStorage.getItem('ds_import_backup') || '{}');
      toDelete.forEach(acc => { delete backup[acc.email]; });
      localStorage.setItem('ds_import_backup', JSON.stringify(backup));
    } catch {}
    // مسح من ds_jumped أيضاً
    try {
      const jumped: string[] = JSON.parse(localStorage.getItem('ds_jumped') || '[]');
      const newJumped = jumped.filter(id => !toDelete.some(a => a.id === id));
      localStorage.setItem('ds_jumped', JSON.stringify(newJumped));
    } catch {}
    localStorage.setItem('ds_broken', '[]');
    setBrokenIds(new Set());
    setExportData([]);
    setAllAccounts(prev => prev.filter(a => !toDelete.some(td => td.id === a.id)));
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text1, fontFamily: "'Inter', sans-serif" }}>

      {/* ══ Header ══ */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 28px', borderBottom: `1px solid ${C.border}`, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', flexWrap: 'wrap', gap: 12 } as React.CSSProperties}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/app')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', color: C.text2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <ArrowLeft style={{ width: 15, height: 15 }} /> رجوع
          </button>
          {/* ── زر Jump / Activated ── */}
          <button onClick={() => router.push('/activated')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.08)', color: '#c084fc', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.08)'}
          >
            <Shield style={{ width: 14, height: 14 }} /> Activated
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle style={{ width: 18, height: 18, color: '#f87171' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: C.text1, margin: 0 }}>الأكونتات التالفة</h1>
            <p style={{ fontSize: 12, color: C.text3, margin: 0 }}>{brokenAccounts.length} أكونت محفوظ هنا</p>
          </div>
        </div>

        {brokenAccounts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setSelected(new Set(brokenAccounts.map(a => a.id)))}
              style={{ padding: '7px 14px', borderRadius: 9, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', color: C.text2, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              تحديد الكل
            </button>
            <button onClick={doExport} disabled={loading || selected.size === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 9, border: 'none', background: selected.size > 0 ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'rgba(255,255,255,0.05)', color: selected.size > 0 ? 'white' : C.text3, fontSize: 13, fontWeight: 700, cursor: selected.size > 0 ? 'pointer' : 'not-allowed', boxShadow: selected.size > 0 ? '0 4px 14px rgba(239,68,68,0.3)' : 'none' }}>
              <Download style={{ width: 14, height: 14 }} />
              {loading ? 'جاري...' : `Export (${selected.size})`}
            </button>
            <button onClick={clearAllBroken} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: `1px solid rgba(239,68,68,0.2)`, background: 'rgba(239,68,68,0.05)', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Trash2 style={{ width: 13, height: 13 }} /> مسح الكل
            </button>
          </div>
        )}
      </header>

      <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {brokenAccounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.text1, marginBottom: 8 }}>لا توجد أكونتات تالفة</p>
            <p style={{ fontSize: 14, color: C.text3, marginBottom: 24 }}>الأكونتات التي تعلّمها كتالفة ستظهر هنا</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => router.push('/app')} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                العودة للقائمة
              </button>
              <button onClick={() => router.push('/activated')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.08)', color: '#c084fc', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                <Shield style={{ width: 14, height: 14 }} /> صفحة المُفعَّلة
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Accounts list */}
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.04)' }}>
                <AlertTriangle style={{ width: 14, height: 14, color: '#f87171' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171', letterSpacing: '0.05em' }}>قائمة الأكونتات التالفة</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: C.text3 }}>اضغط الصح لتحديد للتصدير</span>
              </div>

              {brokenAccounts.map((acc, i) => {
                const isJumped = jumpedSet.has(acc.id);
                return (
                  <div key={acc.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px',
                    borderBottom: i < brokenAccounts.length - 1 ? `1px solid ${C.border}` : 'none',
                    background: selected.has(acc.id) ? 'rgba(239,68,68,0.04)' : 'transparent',
                    transition: 'all 0.15s',
                  }}>
                    {/* Checkbox */}
                    <button onClick={() => toggleSelect(acc.id)} style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      border: `1px solid ${selected.has(acc.id) ? 'rgba(239,68,68,0.5)' : C.border}`,
                      background: selected.has(acc.id) ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}>
                      {selected.has(acc.id) && <Check style={{ width: 12, height: 12, color: '#f87171' }} />}
                    </button>

                    {/* Dot */}
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.5)', flexShrink: 0 }} />

                    {/* Email */}
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#fca5a5', fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {acc.email}
                    </span>

                    {/* Copy email */}
                    <button onClick={() => navigator.clipboard.writeText(acc.email)} title="نسخ الإيميل"
                      style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      <Copy style={{ width: 12, height: 12, color: C.text3 }} />
                    </button>

                    {/* ── زر Jump to Activated ── */}
                    <button
                      onClick={() => jumpToActivated(acc)}
                      disabled={isJumped}
                      title="إرسال لصفحة المُفعَّلة وإخفاء"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, border: isJumped ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(139,92,246,0.3)', background: isJumped ? 'rgba(16,185,129,0.08)' : 'rgba(139,92,246,0.08)', color: isJumped ? C.green : '#c084fc', fontSize: 11, fontWeight: 700, cursor: isJumped ? 'default' : 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
                      onMouseEnter={e => { if (!isJumped) e.currentTarget.style.background = 'rgba(139,92,246,0.15)'; }}
                      onMouseLeave={e => { if (!isJumped) e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; }}
                    >
                      {isJumped
                        ? <><Check style={{ width: 11, height: 11 }} /> تم الإرسال</>
                        : <><Send style={{ width: 11, height: 11 }} /> Jump</>
                      }
                    </button>

                    {/* ── زر Restore للقائمة الرئيسية ── */}
                    <button onClick={() => restore(acc.id)} title="استعادة للقائمة الرئيسية"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.06)', color: C.green, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      <RotateCcw style={{ width: 11, height: 11 }} /> استعادة
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Export result */}
            {exported && exportData.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: `1px solid rgba(239,68,68,0.15)`, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid rgba(239,68,68,0.1)`, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.04)' }}>
                  <FileDown style={{ width: 14, height: 14, color: '#f87171' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>نتيجة التصدير — {exportData.length} أكونت</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button onClick={copyAll} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: `1px solid ${copiedAll ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.2)'}`, background: copiedAll ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)', color: copiedAll ? C.green : '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {copiedAll ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                      {copiedAll ? 'تم النسخ!' : 'نسخ الكل'}
                    </button>
                    <button onClick={downloadTxt} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.08)', color: '#a5b4fc', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      <FileDown style={{ width: 12, height: 12 }} /> تنزيل .TXT
                    </button>
                  </div>
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {exportData.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < exportData.length - 1 ? `1px solid rgba(255,255,255,0.03)` : 'none' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#fca5a5', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</span>
                      <span style={{ fontSize: 12, color: C.text3 }}>|</span>
                      <span style={{ fontSize: 12, color: C.text2, fontFamily: "'JetBrains Mono',monospace", flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.password}</span>
                      <button onClick={() => navigator.clipboard.writeText(`${item.email}|${item.password}`)}
                        style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Copy style={{ width: 11, height: 11, color: C.text3 }} />
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
                  <textarea readOnly value={exportText}
                    style={{ width: '100%', minHeight: 100, padding: '10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'rgba(0,0,0,0.3)', color: C.text2, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
