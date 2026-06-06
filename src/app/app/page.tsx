'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail, Users, Plus, Search, Download, Trash2, X, Copy, Check,
  ChevronLeft, ChevronRight, Key, User as UserIcon, ArrowLeft,
  RefreshCw, Eye, EyeOff, LogOut, FileDown, Zap, Shield, Activity, Send, AlertTriangle
} from 'lucide-react';

interface EmailAccount { id: string; email: string; status: string; health_score: number; }
interface MailMessage { id: string; sender: string; subject: string; body_preview: string; body?: string; raw_body?: string; received_at: string; has_otp: boolean; }
interface OTPResult { code: string; code_type: string; status: string; }

// ── Colours ─────────────────────────────────────────
const C = {
  blue:    '#3b82f6',
  cyan:    '#06b6d4',
  purple:  '#8b5cf6',
  green:   '#10b981',
  red:     '#ef4444',
  amber:   '#f59e0b',
  text1:   '#f1f5f9',
  text2:   '#94a3b8',
  text3:   '#475569',
  card:    'rgba(12,18,32,0.85)',
  border:  'rgba(255,255,255,0.06)',
};

export default function AppPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated]   = useState(false);
  const [authChecked,   setAuthChecked]     = useState(false);
  const [accounts,      setAccounts]        = useState<EmailAccount[]>([]);
  const [currentIndex,  setCurrentIndex]    = useState(-1);
  const [messages,      setMessages]        = useState<MailMessage[]>([]);
  const [otpResults,    setOtpResults]      = useState<OTPResult[]>([]);
  const [fetching,      setFetching]        = useState(false);
  const [showImport,    setShowImport]      = useState(false);
  const [importText,    setImportText]      = useState('');
  const [importing,     setImporting]       = useState(false);
  const [searchQuery,   setSearchQuery]     = useState('');
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [senderFilter,  setSenderFilter]    = useState('');
  const [mailCount,     setMailCount]       = useState('10');
  const [copiedCode,    setCopiedCode]      = useState('');
  const [usedAccounts,  setUsedAccounts]    = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ds_used') || '[]')); } catch { return new Set(); }
  });
  const [activatedAccounts, setActivatedAccounts] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ds_activated') || '[]')); } catch { return new Set(); }
  });
  const [plusTagged, setPlusTagged] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ds_plus1') || '[]')); } catch { return new Set(); }
  });
  const [authCodes, setAuthCodes] = useState<Record<string,string>>(() => {
    try { return JSON.parse(localStorage.getItem('ds_auth_codes') || '{}'); } catch { return {}; }
  });
  const [showAuthInput, setShowAuthInput] = useState<string|null>(null);
  const [authInputVal,  setAuthInputVal]  = useState('');
  const [brokenAccounts, setBrokenAccounts] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ds_broken') || '[]')); } catch { return new Set(); }
  });
  const [jumpedAccounts, setJumpedAccounts] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ds_jumped') || '[]')); } catch { return new Set(); }
  });
  const [showBroken, setShowBroken] = useState(false);
  const [showExport,    setShowExport]      = useState(false);
  const [exportCopied,  setExportCopied]    = useState(false);
  const [exportData,    setExportData]      = useState<{email:string;password:string;authCode?:string;originalEmail?:string;isPlusTagged?:boolean}[]>([]);
  const [loadingExport, setLoadingExport]   = useState(false);
  const [openMessage,   setOpenMessage]     = useState<MailMessage|null>(null);
  const [credentials,   setCredentials]     = useState<{email:string;password:string}|null>(null);
  const [showCreds,     setShowCreds]       = useState(false);
  const [loadingCreds,  setLoadingCreds]    = useState(false);
  const [fetchError,    setFetchError]      = useState<string|null>(null);

  const currentAccount = currentIndex >= 0 ? accounts[currentIndex] : null;

  const visibleAccounts = accounts.filter(a => !brokenAccounts.has(a.id) && !jumpedAccounts.has(a.id));
  const filteredAccounts = visibleAccounts.filter(a => !accountSearchQuery || a.email.toLowerCase().includes(accountSearchQuery.toLowerCase()));
  const displayedAccounts = [...filteredAccounts].sort((a, b) => {
    const aAct = activatedAccounts.has(a.id) ? 1 : 0;
    const bAct = activatedAccounts.has(b.id) ? 1 : 0;
    return bAct - aAct; // Activated accounts float to top
  });
  const currentAccDispIdx = currentAccount ? displayedAccounts.findIndex(a => a.id === currentAccount.id) : -1;

  // ── Auth ────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/login').then(r => r.json()).then(async d => {
      if (d.success) {
        setAuthenticated(true); setAuthChecked(true);
        // جلب الأكونتات من السيرفر
        const res  = await fetch('/api/accounts');
        const json = await res.json();
        if (json.success && json.data && json.data.length === 0) {
          // السيرفر فاضل (cold start) — استعادة من الـ backup تلقائياً
          const backup: Record<string,{email:string;password:string;client_id:string;refresh_token:string}> =
            JSON.parse(localStorage.getItem('ds_import_backup') || '{}');
          const items = Object.values(backup);
          if (items.length > 0) {
            console.log('[auto-restore] restoring', items.length, 'accounts from localStorage backup');
            await fetch('/api/accounts/import', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ accounts: items }) });
          }
        }
        fetchAccounts();
      } else { setAuthChecked(true); router.push('/login'); }
    }).catch(() => { setAuthChecked(true); router.push('/login'); });
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/login');
  };

  // ── Accounts ────────────────────────────────────────
  const fetchAccounts = async () => {
    // معالجة قائمة الاستعادة من صفحة activated
    try {
      const restoreQueue: string[] = JSON.parse(localStorage.getItem('ds_restore_queue') || '[]');
      if (restoreQueue.length > 0) {
        const jumped: string[] = JSON.parse(localStorage.getItem('ds_jumped') || '[]');
        // جلب الأكونتات لمعرفة الـ IDs
        const res0 = await fetch('/api/accounts');
        const json0 = await res0.json();
        if (json0.success && json0.data) {
          const toRestoreIds = json0.data
            .filter((a: EmailAccount) => restoreQueue.includes(a.email))
            .map((a: EmailAccount) => a.id);
          const newJumped = jumped.filter(id => !toRestoreIds.includes(id));
          localStorage.setItem('ds_jumped', JSON.stringify(newJumped));
          setJumpedAccounts(new Set(newJumped));
        }
        localStorage.removeItem('ds_restore_queue');
      }
    } catch {}

    try {
      const res  = await fetch('/api/accounts');
      const json = await res.json();
      console.log('[fetchAccounts] raw:', json.count, 'accounts');
      if (json.success && json.data) {
        // Show all accounts (not just 'active') — filter out only explicitly failed
        const visible = json.data.filter((a: EmailAccount) => a.status !== 'deleted');
        console.log('[fetchAccounts] visible:', visible.length);
        setAccounts(visible);

        // Clean up invalid/old IDs from localStorage and states
        const validIds = new Set(visible.map((a: EmailAccount) => a.id));
        setActivatedAccounts(prev => {
          const next = new Set([...prev].filter(id => validIds.has(id)));
          try { localStorage.setItem('ds_activated', JSON.stringify([...next])); } catch {}
          return next;
        });
        setPlusTagged(prev => {
          const next = new Set([...prev].filter(id => validIds.has(id)));
          try { localStorage.setItem('ds_plus1', JSON.stringify([...next])); } catch {}
          return next;
        });
        setBrokenAccounts(prev => {
          const next = new Set([...prev].filter(id => validIds.has(id)));
          try { localStorage.setItem('ds_broken', JSON.stringify([...next])); } catch {}
          return next;
        });
        setJumpedAccounts(prev => {
          const next = new Set([...prev].filter(id => validIds.has(id)));
          try { localStorage.setItem('ds_jumped', JSON.stringify([...next])); } catch {}
          return next;
        });
        setAuthCodes(prev => {
          const next = { ...prev };
          let changed = false;
          Object.keys(next).forEach(id => {
            if (!validIds.has(id)) { delete next[id]; changed = true; }
          });
          if (changed) {
            try { localStorage.setItem('ds_auth_codes', JSON.stringify(next)); } catch {}
          }
          return next;
        });

        setCurrentIndex(prev => {
          const savedIdx = parseInt(localStorage.getItem('ds_currentIndex') || '-1');
          if (visible.length === 0) return -1;
          if (savedIdx >= 0 && savedIdx < visible.length) return savedIdx;
          if (prev === -1 || prev >= visible.length) return 0;
          return prev;
        });
        // ✅ حفظ خريطة email→id في localStorage لاستخدامها في صفحة activated عند الـ Restore
        try {
          localStorage.setItem('ds_accounts_map', JSON.stringify(visible.map((a: EmailAccount) => ({ id: a.id, email: a.email }))));
        } catch {}
        // Merge server-side is_used with localStorage persisted used
        const serverUsedIds = json.data.filter((a: any) => a.is_used).map((a: any) => a.id);
        const localUsed: Set<string> = (() => { try { return new Set(JSON.parse(localStorage.getItem('ds_used') || '[]')); } catch { return new Set(); } })();
        const mergedUsed = new Set([...serverUsedIds, ...[...localUsed].filter(id => validIds.has(id))]);
        setUsedAccounts(mergedUsed);
        try { localStorage.setItem('ds_used', JSON.stringify([...mergedUsed])); } catch {}
      }
    } catch (err) { console.error('[fetchAccounts]', err); }
  };

  const selectAccount = (idx: number) => {
    setCurrentIndex(idx);
    localStorage.setItem('ds_currentIndex', String(idx));
    setMessages([]); setOtpResults([]); setCredentials(null); setShowCreds(false);
  };

  const goNext = useCallback(() => {
    const currentAcc = currentIndex >= 0 ? accounts[currentIndex] : null;
    if (!currentAcc) {
      if (displayedAccounts.length > 0) selectAccount(accounts.indexOf(displayedAccounts[0]));
      return;
    }
    const dispIdx = displayedAccounts.findIndex(a => a.id === currentAcc.id);
    if (dispIdx >= 0 && dispIdx < displayedAccounts.length - 1) {
      const nextAcc = displayedAccounts[dispIdx + 1];
      const nextRealIdx = accounts.indexOf(nextAcc);
      setCurrentIndex(nextRealIdx);
      localStorage.setItem('ds_currentIndex', String(nextRealIdx));
      setMessages([]); setOtpResults([]);
    }
  }, [currentIndex, accounts, displayedAccounts]);

  const goPrev = useCallback(() => {
    const currentAcc = currentIndex >= 0 ? accounts[currentIndex] : null;
    if (!currentAcc) return;
    const dispIdx = displayedAccounts.findIndex(a => a.id === currentAcc.id);
    if (dispIdx > 0) {
      const prevAcc = displayedAccounts[dispIdx - 1];
      const prevRealIdx = accounts.indexOf(prevAcc);
      setCurrentIndex(prevRealIdx);
      localStorage.setItem('ds_currentIndex', String(prevRealIdx));
      setMessages([]); setOtpResults([]);
    }
  }, [currentIndex, accounts, displayedAccounts]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goNext, goPrev]);

  // ── Used / Activated ────────────────────────────────
  const markUsedOnServer = async (id: string, is_used: boolean) => {
    try { await fetch('/api/accounts/used', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ account_id: id, is_used }) }); } catch {}
  };

  const toggleUsed = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUsedAccounts(prev => {
      const next = new Set(prev);
      const will = !next.has(id);
      will ? next.add(id) : next.delete(id);
      markUsedOnServer(id, will);
      try { localStorage.setItem('ds_used', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const toggleActivated = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActivatedAccounts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem('ds_activated', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // ── Mail Fetch ──────────────────────────────────────
  const fetchMail = async () => {
    if (!currentAccount) return;
    setFetching(true); setFetchError(null); setMessages([]); setOtpResults([]);
    try {
      const res  = await fetch('/api/mail/fetch', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ account_id: currentAccount.id, top: parseInt(mailCount) }) });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFetchError(data.error || `Error ${res.status}`);
        return;
      }
      if (data.data?.messages) setMessages(data.data.messages);
      if (data.data?.otps)     setOtpResults(data.data.otps);
      setUsedAccounts(prev => {
        const n = new Set([...prev, currentAccount.id]);
        try { localStorage.setItem('ds_used', JSON.stringify([...n])); } catch {}
        return n;
      });
      markUsedOnServer(currentAccount.id, true);
    } catch(e) {
      setFetchError(String(e));
    } finally { setFetching(false); }
  };

  const fetchAndNext = async () => {
    const currentAcc = currentIndex >= 0 ? accounts[currentIndex] : null;
    if (!currentAcc) return;
    const dispIdx = displayedAccounts.findIndex(a => a.id === currentAcc.id);
    if (dispIdx >= 0 && dispIdx < displayedAccounts.length - 1) {
      const nextAcc = displayedAccounts[dispIdx + 1];
      const nextRealIdx = accounts.indexOf(nextAcc);
      setCurrentIndex(nextRealIdx);
      localStorage.setItem('ds_currentIndex', String(nextRealIdx));
      setMessages([]); setOtpResults([]); setCredentials(null); setShowCreds(false); setFetchError(null);
      if (!nextAcc) return;
      setFetching(true);
      try {
        const res  = await fetch('/api/mail/fetch', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ account_id: nextAcc.id, top: parseInt(mailCount) }) });
        const data = await res.json();
        if (!res.ok || !data.success) { setFetchError(data.error || `Error ${res.status}`); return; }
        if (data.data?.messages) setMessages(data.data.messages);
        if (data.data?.otps)     setOtpResults(data.data.otps);
        setUsedAccounts(prev => {
          const n = new Set([...prev, nextAcc.id]);
          try { localStorage.setItem('ds_used', JSON.stringify([...n])); } catch {}
          return n;
        });
        markUsedOnServer(nextAcc.id, true);
      } catch(e) {
        setFetchError(String(e));
      } finally { setFetching(false); }
    }
  };

  const fetchCredentials = async () => {
    if (!currentAccount) return;
    if (credentials) { setShowCreds(!showCreds); return; }
    setLoadingCreds(true);
    try {
      const res  = await fetch(`/api/accounts/${currentAccount.id}/credentials`);
      const data = await res.json();
      if (data.success) { setCredentials(data.data); setShowCreds(true); }
    } finally { setLoadingCreds(false); }
  };

  // ── OTP ─────────────────────────────────────────────
  const extractOTP = (text: string): string | null => {
    const patterns = [
      /(?:code|otp|pin|verification|verify|confirm|security)\s*(?:is|:)?\s*(\d{4,8})/i,
      /(\d{4,8})\s*(?:is your|is the)\s*(?:code|otp|pin)/i,
      /\b(\d{6})\b/,
    ];
    for (const p of patterns) { const m = text.match(p); if (m?.[1]) return m[1]; }
    return null;
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  // ── Import ──────────────────────────────────────────
  /** يستخرج الأكونتات من أي نص — يتجاهل الإيموجي والترقيم والخطوط */
  const parseLine = (raw: string): { email: string; password: string; client_id: string; refresh_token: string } | null => {
    // أزل الترقيم في البداية مثل "1. " أو "20. " ثم تحقق من وجود @
    const line = raw.trim();
    if (!line.includes('@')) return null;

    let emailField = '', password = '', thirdField = '', fourthField = '';

    if (line.includes('----')) {
      const parts = line.split('----');
      emailField  = parts[0]?.trim() || '';
      password    = parts[1]?.trim() || '';
      thirdField  = parts[2]?.trim() || '';
      fourthField = parts[3]?.trim() || '';
    } else {
      const p1 = line.indexOf('|');
      const p2 = line.indexOf('|', p1 + 1);
      const p3 = line.indexOf('|', p2 + 1);
      if (p1 === -1 || p2 === -1 || p3 === -1) return null;
      emailField  = line.slice(0, p1).trim();
      password    = line.slice(p1 + 1, p2).trim();
      thirdField  = line.slice(p2 + 1, p3).trim();
      fourthField = line.slice(p3 + 1).trim();
    }

    // استخرج الإيميل الصحيح بـ regex (يتجاهل أي إيموجي أو أرقام أو رموز قبله)
    const emailMatch = emailField.match(/[\w.+\-]+@[\w\-]+\.[\w.]+/);
    if (!emailMatch) return null;
    const email = emailMatch[0].trim();

    const uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let client_id: string, refresh_token: string;
    if (uuidRx.test(fourthField))     { refresh_token = thirdField;  client_id = fourthField; }
    else if (uuidRx.test(thirdField)) { client_id = thirdField;      refresh_token = fourthField; }
    else                              { refresh_token = thirdField;   client_id = fourthField; }

    if (!(email && password && client_id && refresh_token)) return null;
    return { email, password, client_id, refresh_token };
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const lines = importText.trim().split('\n');
      const items = lines.map(l => parseLine(l)).filter(Boolean) as { email:string; password:string; client_id:string; refresh_token:string }[];

      console.log(`[import] found ${items.length} accounts from ${lines.length} lines`);
      if (items.length === 0) { alert('لم يتم العثور على أكونتات صحيحة في النص'); return; }

      const importRes  = await fetch('/api/accounts/import', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ accounts: items }) });
      const importData = await importRes.json();
      console.log('[import result]', importData);

      // ✅ حفظ backup في localStorage عشان ما تضيعش عند الـ refresh
      const existing: Record<string,typeof items[0]> = JSON.parse(localStorage.getItem('ds_import_backup') || '{}');
      for (const item of items) existing[item.email] = item;
      localStorage.setItem('ds_import_backup', JSON.stringify(existing));

      setShowImport(false); setImportText('');
      await new Promise(r => setTimeout(r, 150));
      await fetchAccounts();
    } finally { setImporting(false); }
  };

  const clearAll = async () => {
    if (!confirm('هل أنت متأكد؟ سيتم مسح كل الأكونتات والـ backup')) return;
    try { await fetch('/api/accounts/clear', { method: 'DELETE' }); } catch {}
    setAccounts([]); setCurrentIndex(-1); setMessages([]); setOtpResults([]);
    setUsedAccounts(new Set()); setCredentials(null); setShowCreds(false);
    localStorage.removeItem('ds_currentIndex');
    localStorage.removeItem('ds_activated');
    localStorage.removeItem('ds_plus1');
    localStorage.removeItem('ds_auth_codes');
    localStorage.removeItem('ds_broken');
    localStorage.removeItem('ds_jumped');
    localStorage.removeItem('ds_used');
    localStorage.removeItem('ds_accounts_map');
    localStorage.removeItem('ds_restore_queue');
    localStorage.removeItem('ds_import_backup');
    // ds_exported_accounts يبقى عمداً (سجل دائم للمُصدَّرة)
    setPlusTagged(new Set()); setAuthCodes({}); setShowAuthInput(null);
    setBrokenAccounts(new Set()); setJumpedAccounts(new Set());
  };

  // ── Export ──────────────────────────────────────────
  // الأكونتات المُفعَّلة الصحيحة (بدون broken)
  const trueActivated = accounts.filter(a => activatedAccounts.has(a.id) && !brokenAccounts.has(a.id));

  const openExportModal = async () => {
    setShowExport(true); setExportCopied(false);
    const activated = trueActivated;
    if (!activated.length) { setExportData([]); return; }
    setLoadingExport(true);
    // جلب الـ backup للاستخدام كـ fallback للـ password
    let backup: Record<string, {email:string;password:string;client_id?:string;refresh_token?:string}> = {};
    try { backup = JSON.parse(localStorage.getItem('ds_import_backup') || '{}'); } catch {}
    try {
      const results = await Promise.all(
        activated.map(async acc => {
          try {
            const res  = await fetch(`/api/accounts/${acc.id}/credentials`);
            const data = await res.json();
            // إذا كان الأكونت معلم بـ +1 نضيف +1 قبل @ في التصدير فقط
            const exportEmail = plusTagged.has(acc.id)
              ? acc.email.replace('@', '+1@')
              : acc.email;
            const authCode = authCodes[acc.id] || undefined;
            // إذا فشلت الـ credentials API، نستخدم الـ backup كـ fallback
            let password = '???' ;
            if (data.success && data.data?.password) {
              password = data.data.password;
            } else {
              // fallback: ابحث في الـ backup بالإيميل
              const backupEntry = backup[acc.email] || Object.values(backup).find(b => b.email === acc.email);
              if (backupEntry?.password) password = backupEntry.password;
            }
            return { email: exportEmail, password, originalEmail: acc.email, isPlusTagged: plusTagged.has(acc.id), authCode };
          } catch {
            // fallback من الـ backup عند الخطأ
            const backupEntry = backup[acc.email] || Object.values(backup).find(b => b.email === acc.email);
            const password = backupEntry?.password || '???';
            return { email: acc.email, password, originalEmail: acc.email, isPlusTagged: false };
          }
        })
      );
      setExportData(results);
      // ✅ حفظ في localStorage للصفحة المستقلة
      try {
        const existingExported: Record<string, {email:string;password:string;authCode?:string;exportedAt:string}> =
          JSON.parse(localStorage.getItem('ds_exported_accounts') || '{}');
        results.forEach(r => {
          if (r.password !== '???') {
            existingExported[r.originalEmail || r.email] = {
              email: r.email,
              password: r.password,
              authCode: r.authCode,
              exportedAt: new Date().toISOString(),
            };
          }
        });
        localStorage.setItem('ds_exported_accounts', JSON.stringify(existingExported));
      } catch {}
    } finally { setLoadingExport(false); }
  };

  const togglePlusTag = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlusTagged(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('ds_plus1', JSON.stringify([...next]));
      return next;
    });
  };

  const toggleBroken = (id: string, email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBrokenAccounts(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else { next.add(id); }
      localStorage.setItem('ds_broken', JSON.stringify([...next]));
      return next;
    });
  };

  // ── Jump to Activated ──────────────────────────────
  const jumpToActivated = async (acc: EmailAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    // 1. أخفي من القائمة الرئيسية
    setJumpedAccounts(prev => {
      const next = new Set(prev);
      next.add(acc.id);
      try { localStorage.setItem('ds_jumped', JSON.stringify([...next])); } catch {}
      return next;
    });
    // 2. احفظ في صفحة الـ activated
    try {
      let backup: Record<string, {email:string;password:string}> = {};
      try { backup = JSON.parse(localStorage.getItem('ds_import_backup') || '{}'); } catch {}
      let password = '???';
      // حاول تجيب الباسورد من السيرفر أولاً
      try {
        const res = await fetch(`/api/accounts/${acc.id}/credentials`);
        const data = await res.json();
        if (data.success && data.data?.password) password = data.data.password;
      } catch {}
      // fallback من الـ backup
      if (password === '???') {
        const entry = backup[acc.email] || Object.values(backup).find(b => b.email === acc.email);
        if (entry?.password) password = entry.password;
      }
      const existing: Record<string, {email:string;password:string;authCode?:string;exportedAt:string;jumped?:boolean}> =
        JSON.parse(localStorage.getItem('ds_exported_accounts') || '{}');
      existing[acc.email] = {
        email: acc.email,
        password,
        authCode: authCodes[acc.id],
        exportedAt: new Date().toISOString(),
        jumped: true,
      };
      localStorage.setItem('ds_exported_accounts', JSON.stringify(existing));
    } catch {}
  };

  const openAuthInput = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (showAuthInput === id) { setShowAuthInput(null); return; }
    setAuthInputVal(authCodes[id] || '');
    setShowAuthInput(id);
  };

  const saveAuthCode = (id: string) => {
    const val = authInputVal.trim();
    setAuthCodes(prev => {
      const next = { ...prev };
      if (val) next[id] = val; else delete next[id];
      localStorage.setItem('ds_auth_codes', JSON.stringify(next));
      return next;
    });
    setShowAuthInput(null);
  };

  const exportText = exportData.map(d => {
    const base = `${d.email}|${d.password}`;
    return d.authCode ? `${base}|${d.authCode}` : base;
  }).join('\n');
  const copyExport = () => { navigator.clipboard.writeText(exportText); setExportCopied(true); setTimeout(() => setExportCopied(false), 2000); };
  const downloadTxt = () => {
    const blob = new Blob([exportText], { type:'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `activated_${new Date().toISOString().slice(0,10)}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const filteredMessages = messages.filter(m => {
    const ms = !searchQuery || m.subject?.toLowerCase().includes(searchQuery.toLowerCase()) || m.body_preview?.toLowerCase().includes(searchQuery.toLowerCase());
    const mf = !senderFilter || m.sender?.toLowerCase().includes(senderFilter.toLowerCase());
    return ms && mf;
  });

  if (!authChecked) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:20, height:20, border:`2px solid rgba(59,130,246,0.2)`, borderTopColor: C.blue, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <span style={{ color: C.text3, fontSize:14 }}>Loading...</span>
      </div>
    </div>
  );
  if (!authenticated) return null;

  // ── Styles (reusable) ───────────────────────────────
  const card = { background: C.card, backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:`1px solid ${C.border}`, borderRadius: 16, boxShadow:'0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)' };

  return (
    <div style={{ minHeight:'100vh', background:'#070b14', display:'flex', flexDirection:'column' }}>

      {/* ══ HEADER ══════════════════════════════════════════ */}
      <header style={{ ...card, borderRadius:0, borderLeft:'none', borderRight:'none', borderTop:'none', padding:'0 28px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50, background:'rgba(7,11,20,0.95)' }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.15))', border:'1px solid rgba(59,130,246,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Zap style={{ width:18, height:18, color:'#60a5fa' }} />
          </div>
          <div>
            <span style={{ fontSize:16, fontWeight:900, color: C.text1, letterSpacing:'-0.02em' }}>Cyber</span>
            <span style={{ fontSize:16, fontWeight:900, background:'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', letterSpacing:'-0.02em' }}> Mail</span>
          </div>
          <div style={{ width:1, height:20, background: C.border, margin:'0 8px' }} />
          <span style={{ fontSize:11, color: C.text3, fontWeight:600, letterSpacing:'0.08em' }}>OUTLOOK FETCHER</span>
        </div>

        {/* Stats + Actions */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:100, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.15)' }}>
            <div style={{ width:6, height:6, background: C.green, borderRadius:'50%', boxShadow:`0 0 8px ${C.green}` }} />
            <span style={{ fontSize:11, fontWeight:700, color: C.green }}>{accounts.length} Accounts</span>
          </div>
          {brokenAccounts.size > 0 && (
            <button onClick={() => router.push('/broken')} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:100, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', cursor:'pointer', transition:'all 0.2s' }}>
              <AlertTriangle style={{ width:13, height:13, color: C.red }} />
              <span style={{ fontSize:11, fontWeight:700, color: C.red }}>تالف ({brokenAccounts.size})</span>
            </button>
          )}
          {trueActivated.length > 0 && (
            <button onClick={openExportModal} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:100, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)', cursor:'pointer', transition:'all 0.2s' }}>
              <FileDown style={{ width:13, height:13, color: C.green }} />
              <span style={{ fontSize:11, fontWeight:700, color: C.green }}>Export ({trueActivated.length})</span>
            </button>
          )}
          <button onClick={() => router.push('/activated')} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:100, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.15)', cursor:'pointer', transition:'all 0.2s' }}>
            <Shield style={{ width:13, height:13, color: C.purple }} />
            <span style={{ fontSize:11, fontWeight:700, color: C.purple }}>Activated</span>
          </button>
          <button onClick={handleLogout} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:100, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.1)', cursor:'pointer', transition:'all 0.2s' }}>
            <LogOut style={{ width:13, height:13, color: C.red }} />
            <span style={{ fontSize:11, fontWeight:700, color: C.red }}>Logout</span>
          </button>
        </div>
      </header>

      {/* ══ BODY ════════════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:0, flex:1, overflow:'hidden', height:'calc(100vh - 60px)' }}>

        {/* ── LEFT SIDEBAR ─────────────────────────────────── */}
        <aside style={{ ...card, borderRadius:0, borderTop:'none', borderBottom:'none', borderLeft:'none', display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Sidebar Header */}
          <div style={{ padding:'16px 16px 12px', borderBottom:`1px solid ${C.border}`, display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <Users style={{ width:14, height:14, color: C.text3 }} />
                <span style={{ fontSize:12, fontWeight:700, color: C.text2, letterSpacing:'0.05em', textTransform:'uppercase' }}>Mailboxes</span>
              </div>
              <span style={{ padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:700, color: C.blue, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.15)' }}>{accounts.filter(a => !brokenAccounts.has(a.id)).length}</span>
            </div>
            <button onClick={() => setShowImport(true)} style={{ width:'100%', padding:'10px 0', borderRadius:10, border:'none', background:'linear-gradient(135deg, #3b82f6, #6366f1)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, boxShadow:'0 4px 16px rgba(59,130,246,0.25)', transition:'all 0.2s' }}>
              <Plus style={{ width:15, height:15 }} /> Import Accounts
            </button>
            {accounts.filter(a => !brokenAccounts.has(a.id)).length > 0 && (
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="text"
                  placeholder="البحث في الحسابات..."
                  value={accountSearchQuery}
                  onChange={e => setAccountSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 30px',
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: 'rgba(0,0,0,0.2)',
                    color: C.text1,
                    fontSize: 12,
                    outline: 'none',
                    boxSizing: 'border-box',
                    textAlign: 'right',
                    direction: 'rtl'
                  }}
                />
                <Search style={{ position: 'absolute', left: 10, top: 10, width: 12, height: 12, color: C.text3 }} />
                {accountSearchQuery && (
                  <button
                    onClick={() => setAccountSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: 8,
                      background: 'none',
                      border: 'none',
                      color: C.text3,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Account List */}
          <div style={{ flex:1, overflowY:'auto', padding:'6px 8px' }}>
            {visibleAccounts.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', minHeight:200, gap:10 }}>
                <Mail style={{ width:36, height:36, color:'#1e293b' }} />
                <p style={{ fontSize:13, color: C.text3 }}>No mailboxes yet</p>
                <p style={{ fontSize:11, color:'#334155' }}>Click Import above</p>
              </div>
            ) : displayedAccounts.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding: '20px 10px', gap:10 }}>
                <Search style={{ width:24, height:24, color: C.text3 }} />
                <p style={{ fontSize:12, color: C.text3, textAlign: 'center' }}>لا توجد حسابات تطابق البحث</p>
              </div>
            ) : (
              displayedAccounts.map(acc => {
                const realIdx = accounts.indexOf(acc);
                const isSelected  = realIdx === currentIndex;
                const isUsed      = usedAccounts.has(acc.id);
                const isActivated = activatedAccounts.has(acc.id);
                const isPlus      = plusTagged.has(acc.id);
                const hasAuth     = !!authCodes[acc.id];
                return (
                  <div key={acc.id} style={{ marginBottom:2 }}>
                    <div onClick={() => selectAccount(realIdx)} style={{
                      display:'flex', alignItems:'center', gap:6, padding:'9px 10px', borderRadius:showAuthInput===acc.id ? '10px 10px 0 0' : 10, cursor:'pointer', transition:'all 0.15s',
                      background: isSelected ? 'rgba(59,130,246,0.1)' : isActivated ? 'rgba(16,185,129,0.05)' : 'transparent',
                      border: `1px solid ${isSelected ? 'rgba(59,130,246,0.2)' : isActivated ? 'rgba(16,185,129,0.12)' : showAuthInput===acc.id ? 'rgba(168,85,247,0.25)' : 'transparent'}`,
                      borderBottom: showAuthInput===acc.id ? 'none' : undefined,
                    }}>
                      {/* زر تالف — على أقصى اليسار */}
                      <button onClick={e => toggleBroken(acc.id, acc.email, e)} title="تحديد كتالف/معطوب" style={{ width:16, height:16, borderRadius:4, border:'1px solid rgba(239,68,68,0.15)', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all 0.15s', opacity:0.5 }}
                        onMouseEnter={e => (e.currentTarget.style.opacity='1')} onMouseLeave={e => (e.currentTarget.style.opacity='0.5')}>
                        <span style={{ fontSize:8, color:'#f87171' }}>✕</span>
                      </button>
                      {/* زر Jump — إرسال للـ activated وإخفاء من القائمة */}
                      <button onClick={e => jumpToActivated(acc, e)} title="إرسال لصفحة المفعّلة وإخفاء من القائمة" style={{ width:16, height:16, borderRadius:4, border:'1px solid rgba(139,92,246,0.2)', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all 0.15s', opacity:0.5 }}
                        onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.background='rgba(139,92,246,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity='0.5'; e.currentTarget.style.background='transparent'; }}>
                        <Send style={{ width:8, height:8, color:'#c084fc' }} />
                      </button>
                      {/* Status dot */}
                      <div style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, background: isSelected ? C.blue : isActivated ? C.green : isUsed ? C.amber : C.text3, boxShadow: isSelected ? `0 0 8px ${C.blue}` : isActivated ? `0 0 8px ${C.green}` : 'none', transition:'all 0.2s' }} />
                      {/* Email */}
                      <span style={{ flex:1, fontSize:12, fontWeight: isSelected || isActivated ? 600 : 400, color: isSelected ? '#93c5fd' : isActivated ? '#6ee7b7' : C.text2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{acc.email}</span>
                      {/* AUTH button */}
                      <button onClick={e => openAuthInput(acc.id, e)} title={hasAuth ? `Auth: ${authCodes[acc.id]}` : 'إضافة Auth Code'} style={{ width:20, height:20, borderRadius:5, border:`1px solid ${hasAuth || showAuthInput===acc.id ? 'rgba(168,85,247,0.4)' : C.border}`, background: hasAuth || showAuthInput===acc.id ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}>
                        <span style={{ fontSize:8, fontWeight:800, color: hasAuth || showAuthInput===acc.id ? '#c084fc' : C.text3, lineHeight:1 }}>AUTH</span>
                      </button>
                      {/* +1 tag toggle */}
                      <button onClick={e => togglePlusTag(acc.id, e)} title={isPlus ? 'إلغاء +1' : 'تعليم بـ +1 في التصدير'} style={{ width:20, height:20, borderRadius:5, border:`1px solid ${isPlus ? 'rgba(251,146,60,0.4)' : C.border}`, background: isPlus ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.03)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}>
                        <span style={{ fontSize:9, fontWeight:800, color: isPlus ? '#fb923c' : C.text3, lineHeight:1 }}>+1</span>
                      </button>
                      {/* Activate toggle */}
                      <button onClick={e => toggleActivated(acc.id, e)} title={isActivated ? 'Click to deactivate' : 'Mark as activated'} style={{ width:20, height:20, borderRadius:5, border:`1px solid ${isActivated ? 'rgba(16,185,129,0.3)' : C.border}`, background: isActivated ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}>
                        {isActivated ? <Check style={{ width:10, height:10, color: C.green }} /> : <Plus style={{ width:9, height:9, color: C.text3 }} />}
                      </button>
                      {isUsed && (
                        <button onClick={e => toggleUsed(acc.id, e)} style={{ padding:'1px 5px', borderRadius:4, fontSize:9, fontWeight:700, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.15)', color: C.amber, cursor:'pointer', flexShrink:0 }}>USED</button>
                      )}
                    </div>
                    {showAuthInput === acc.id && (
                      <div onClick={e => e.stopPropagation()} style={{ padding:'8px 10px', background:'rgba(168,85,247,0.05)', border:'1px solid rgba(168,85,247,0.25)', borderTop:'none', borderRadius:'0 0 10px 10px', display:'flex', gap:6 }}>
                        <input autoFocus value={authInputVal} onChange={e => setAuthInputVal(e.target.value)}
                          onKeyDown={e => { if(e.key==='Enter') saveAuthCode(acc.id); if(e.key==='Escape') setShowAuthInput(null); }}
                          placeholder="اكتب Auth Code..."
                          style={{ flex:1, padding:'5px 9px', borderRadius:7, border:'1px solid rgba(168,85,247,0.3)', background:'rgba(0,0,0,0.3)', color:'#e2e8f0', fontSize:12, fontFamily:"'JetBrains Mono',monospace", outline:'none' }} />
                        <button onClick={() => saveAuthCode(acc.id)} style={{ padding:'5px 10px', borderRadius:7, border:'none', background:'rgba(168,85,247,0.2)', color:'#c084fc', fontSize:11, fontWeight:700, cursor:'pointer' }}>حفظ</button>
                        {authCodes[acc.id] && <button onClick={() => { setAuthInputVal(''); saveAuthCode(acc.id); }} style={{ padding:'5px 8px', borderRadius:7, border:'none', background:'rgba(239,68,68,0.1)', color:'#fca5a5', fontSize:11, cursor:'pointer' }}>✕</button>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>


          {/* Sidebar Footer */}
          <div style={{ padding:'10px 12px', borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'flex-start' }}>
            <button onClick={clearAll} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', color: C.text3, fontSize:11, fontWeight:600, cursor:'pointer' }}>
              <Trash2 style={{ width:11, height:11 }} /> Clear
            </button>
          </div>

          {/* ── Navigation ── */}
          <div style={{ padding:'12px 16px', borderTop:`1px solid ${C.border}`, background:'rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={goPrev} disabled={currentAccDispIdx <= 0} style={{ width:40, height:40, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${currentAccDispIdx > 0 ? 'rgba(59,130,246,0.2)' : C.border}`, background: currentAccDispIdx > 0 ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)', color: currentAccDispIdx > 0 ? C.blue : C.text3, cursor: currentAccDispIdx > 0 ? 'pointer' : 'not-allowed', transition:'all 0.15s', flexShrink:0 }}>
                <ChevronLeft style={{ width:18, height:18 }} />
              </button>
              <div style={{ flex:1, textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:900, color: C.text1 }}>
                  {currentAccDispIdx >= 0 ? currentAccDispIdx + 1 : '—'}
                  <span style={{ fontSize:12, color: C.text3, fontWeight:500 }}> / {displayedAccounts.length}</span>
                </div>
              </div>
              <button onClick={goNext} disabled={currentAccDispIdx === -1 || currentAccDispIdx >= displayedAccounts.length - 1} style={{ width:40, height:40, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${currentAccDispIdx !== -1 && currentAccDispIdx < displayedAccounts.length - 1 ? 'rgba(59,130,246,0.2)' : C.border}`, background: currentAccDispIdx !== -1 && currentAccDispIdx < displayedAccounts.length - 1 ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)', color: currentAccDispIdx !== -1 && currentAccDispIdx < displayedAccounts.length - 1 ? C.blue : C.text3, cursor: currentAccDispIdx !== -1 && currentAccDispIdx < displayedAccounts.length - 1 ? 'pointer' : 'not-allowed', transition:'all 0.15s', flexShrink:0 }}>
                <ChevronRight style={{ width:18, height:18 }} />
              </button>
            </div>
          </div>
        </aside>

        {/* ── RIGHT PANEL ──────────────────────────────────── */}
        <main style={{ display:'flex', flexDirection:'column', overflow:'hidden', background:'rgba(7,11,20,0.5)' }}>

          {/* Account Bar */}
          {currentAccount ? (
            <div style={{ padding:'10px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10, background:'rgba(12,18,32,0.6)', flexShrink:0, flexWrap:'wrap' }}>

              {/* ── Email | Password block ── */}
              <div style={{ display:'flex', alignItems:'center', gap:0, flex:1, minWidth:0, background:'rgba(0,0,0,0.25)', borderRadius:10, border:`1px solid ${C.border}`, overflow:'hidden' }}>
                {/* Email + copy */}
                <div style={{ flex:1, minWidth:0, padding:'7px 12px', borderRight:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:10, fontWeight:700, color: C.text3, letterSpacing:'0.07em', marginBottom:2 }}>EMAIL</p>
                    <p style={{ fontSize:13, fontWeight:700, color:'#93c5fd', fontFamily:"'JetBrains Mono',monospace", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{currentAccount.email}</p>
                  </div>
                  <button onClick={async () => {
                      try { await navigator.clipboard.writeText(currentAccount.email); }
                      catch {
                        const el = document.createElement('textarea');
                        el.value = currentAccount.email; el.style.position = 'fixed'; el.style.opacity = '0';
                        document.body.appendChild(el); el.focus(); el.select();
                        document.execCommand('copy'); document.body.removeChild(el);
                      }
                      setCopiedCode('email'); setTimeout(() => setCopiedCode(''), 2000);
                    }}
                    title="Copy email" style={{ width:28, height:28, borderRadius:7, border:`1px solid ${copiedCode==='email' ? 'rgba(16,185,129,0.4)' : C.border}`, background: copiedCode==='email' ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                    {copiedCode==='email' ? <Check style={{ width:12, height:12, color: C.green }} /> : <Copy style={{ width:12, height:12, color:'#60a5fa' }} />}
                  </button>
                </div>
                {/* Password + copy */}
                <div style={{ flex:1, minWidth:0, padding:'7px 12px', display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:10, fontWeight:700, color: C.text3, letterSpacing:'0.07em', marginBottom:2 }}>PASSWORD</p>
                    {credentials ? (
                      <p style={{ fontSize:13, fontWeight:700, color:'#c4b5fd', fontFamily:"'JetBrains Mono',monospace", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{credentials.password}</p>
                    ) : (
                      <p style={{ fontSize:13, color: C.text3, fontFamily:"'JetBrains Mono',monospace" }}>••••••••</p>
                    )}
                  </div>
                  <button onClick={async () => {
                    let pass = credentials?.password;
                    if (!pass) {
                      try {
                        const r = await fetch(`/api/accounts/${currentAccount.id}/credentials`);
                        const d = await r.json();
                        if (d.success) { setCredentials(d.data); pass = d.data.password; }
                      } catch {}
                      // fallback من الـ backup
                      if (!pass) {
                        try {
                          const backup: Record<string,{email:string;password:string}> = JSON.parse(localStorage.getItem('ds_import_backup') || '{}');
                          const entry = backup[currentAccount.email] || Object.values(backup).find((b:any) => b.email === currentAccount.email);
                          if (entry?.password) pass = entry.password;
                        } catch {}
                      }
                    }
                    if (pass) {
                      try {
                        await navigator.clipboard.writeText(pass);
                      } catch {
                        // fallback للمتصفحات التي لا تدعم Clipboard API
                        const el = document.createElement('textarea');
                        el.value = pass; el.style.position = 'fixed'; el.style.opacity = '0';
                        document.body.appendChild(el); el.focus(); el.select();
                        document.execCommand('copy');
                        document.body.removeChild(el);
                      }
                      setCopiedCode('pass'); setTimeout(() => setCopiedCode(''), 2000);
                    }
                  }} title="Copy password" style={{ width:28, height:28, borderRadius:7, border:`1px solid ${copiedCode==='pass' ? 'rgba(16,185,129,0.4)' : C.border}`, background: copiedCode==='pass' ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                    {copiedCode==='pass' ? <Check style={{ width:12, height:12, color: C.green }} /> : <Copy style={{ width:12, height:12, color:'#c4b5fd' }} />}
                  </button>
                </div>
              </div>

              {/* Mail count */}
              <select value={mailCount} onChange={e => setMailCount(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.04)', fontSize:12, color: C.text2, cursor:'pointer', outline:'none', flexShrink:0 }}>
                {[5,10,20,50].map(n => <option key={n} value={n}>{n} mails</option>)}
              </select>
              {/* Fetch btn */}
              <button onClick={fetchMail} disabled={fetching} style={{ padding:'8px 16px', borderRadius:9, border:'none', background:'linear-gradient(135deg, #3b82f6, #6366f1)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(59,130,246,0.3)', opacity: fetching ? 0.5 : 1, whiteSpace:'nowrap', transition:'all 0.2s', flexShrink:0 }}>
                <Download style={{ width:14, height:14 }} /> {fetching ? 'Loading...' : 'Fetch'}
              </button>
              {/* Next btn */}
              <button onClick={fetchAndNext} disabled={fetching || currentIndex >= accounts.length - 1} style={{ padding:'8px 16px', borderRadius:9, border:'none', background:'linear-gradient(135deg, #8b5cf6, #6366f1)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(139,92,246,0.3)', opacity: (fetching || currentIndex >= accounts.length - 1) ? 0.35 : 1, whiteSpace:'nowrap', transition:'all 0.2s', flexShrink:0 }}>
                <ChevronRight style={{ width:14, height:14 }} /> Next
              </button>
            </div>
          ) : (
            <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10, background:'rgba(12,18,32,0.4)', flexShrink:0 }}>
              <Shield style={{ width:16, height:16, color: C.text3 }} />
              <span style={{ fontSize:13, color: C.text3 }}>Select an account from the left panel</span>
            </div>
          )}

          {/* Error Banner */}
          {fetchError && (
            <div className="animate-in" style={{ padding:'10px 20px', borderBottom:`1px solid rgba(239,68,68,0.2)`, background:'rgba(239,68,68,0.06)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', flexShrink:0 }} />
              <span style={{ fontSize:12, color:'#fca5a5', flex:1, fontFamily:"'JetBrains Mono',monospace" }}>❌ {fetchError}</span>
              <button onClick={() => setFetchError(null)} style={{ fontSize:11, color:'#94a3b8', background:'none', border:'none', cursor:'pointer' }}>✕</button>
            </div>
          )}

          {/* OTP Banner — shows when otps found */}
          {otpResults.length > 0 && (
            <div className="animate-in" style={{ padding:'12px 20px', borderBottom:`1px solid rgba(59,130,246,0.12)`, background:'rgba(59,130,246,0.05)', display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Key style={{ width:16, height:16, color: C.blue }} />
                <span style={{ fontSize:12, fontWeight:700, color: C.blue }}>OTP Codes Found</span>
              </div>
              <div style={{ display:'flex', gap:8, flex:1, flexWrap:'wrap' }}>
                {otpResults.slice(0, 5).map((otp, i) => (
                  <button key={i} onClick={() => copyCode(otp.code)} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:8, border:`1px solid ${copiedCode === otp.code ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.2)'}`, background: copiedCode === otp.code ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.08)', cursor:'pointer', transition:'all 0.15s' }}>
                    <span style={{ fontSize:16, fontWeight:800, fontFamily:"'JetBrains Mono', monospace", color: copiedCode === otp.code ? C.green : '#93c5fd', letterSpacing:'0.12em' }}>{otp.code}</span>
                    {copiedCode === otp.code ? <Check style={{ width:12, height:12, color: C.green }} /> : <Copy style={{ width:12, height:12, color:'#60a5fa' }} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div style={{ padding:'10px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', gap:8, alignItems:'center', flexShrink:0, background:'rgba(12,18,32,0.3)' }}>
            <div style={{ flex:1, position:'relative' }}>
              <Search style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', width:13, height:13, color: C.text3 }} />
              <input className="app-input" placeholder="Search subject / body..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft:32, padding:'8px 12px 8px 32px', fontSize:12 }} />
            </div>
            <div style={{ width:180, position:'relative' }}>
              <UserIcon style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', width:13, height:13, color: C.text3 }} />
              <input className="app-input" placeholder="Filter sender..." value={senderFilter} onChange={e => setSenderFilter(e.target.value)} style={{ paddingLeft:32, padding:'8px 12px 8px 32px', fontSize:12 }} />
            </div>
          </div>

          {/* Messages List */}
          <div style={{ flex:1, overflowY:'auto', padding:'4px 0' }}>
            {filteredMessages.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', minHeight:300, gap:12 }}>
                <div style={{ width:60, height:60, borderRadius:18, background:'rgba(59,130,246,0.06)', border:`1px solid rgba(59,130,246,0.1)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Mail style={{ width:26, height:26, color:'#1e3a5f' }} />
                </div>
                <p style={{ fontSize:14, color: C.text3 }}>{accounts.length === 0 ? 'Import mailboxes to start' : currentAccount ? 'Click Fetch Mail to load emails' : 'Select an account'}</p>
              </div>
            ) : (
              filteredMessages.map((msg, i) => {
                const otp = msg.has_otp ? extractOTP((msg.subject || '') + ' ' + (msg.body_preview || '') + ' ' + (msg.raw_body || '')) : null;
                return (
                  <div key={msg.id || i} onClick={() => setOpenMessage(msg)} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 20px', borderBottom:`1px solid rgba(255,255,255,0.03)`, cursor:'pointer', transition:'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Icon */}
                    <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background: msg.has_otp ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)', border:`1px solid ${msg.has_otp ? 'rgba(59,130,246,0.15)' : C.border}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {msg.has_otp ? <Key style={{ width:16, height:16, color:'#60a5fa' }} /> : <Mail style={{ width:16, height:16, color: C.text3 }} />}
                    </div>
                    {/* Content */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:13, fontWeight:600, color: C.text1 }}>{msg.sender}</span>
                        {msg.has_otp && <span style={{ padding:'1px 6px', borderRadius:4, fontSize:9, fontWeight:700, background:'rgba(59,130,246,0.1)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.15)', letterSpacing:'0.05em' }}>OTP</span>}
                      </div>
                      <p style={{ fontSize:12, color: C.text2, marginBottom:2 }}>{msg.subject}</p>
                      <p style={{ fontSize:11, color: C.text3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{msg.body_preview}</p>
                    </div>
                    {/* OTP or time */}
                    {otp ? (
                      <button onClick={e => { e.stopPropagation(); copyCode(otp); }} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:9, border:`1px solid ${copiedCode === otp ? 'rgba(16,185,129,0.25)' : 'rgba(59,130,246,0.2)'}`, background: copiedCode === otp ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.06)', cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}>
                        <span style={{ fontSize:16, fontWeight:800, fontFamily:"'JetBrains Mono', monospace", color: copiedCode === otp ? C.green : '#93c5fd', letterSpacing:'0.1em' }}>{otp}</span>
                        {copiedCode === otp ? <Check style={{ width:13, height:13, color: C.green }} /> : <Copy style={{ width:13, height:13, color:'#60a5fa' }} />}
                      </button>
                    ) : (
                      <span style={{ fontSize:11, color: C.text3, whiteSpace:'nowrap', marginTop:3 }}>{new Date(msg.received_at).toLocaleTimeString()}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* ══ MESSAGE MODAL ════════════════════════════════════ */}
      {openMessage && (() => {
        const fullText = (openMessage.subject || '') + ' ' + (openMessage.body_preview || '') + ' ' + (openMessage.raw_body || openMessage.body || '');
        const msgOtp   = extractOTP(fullText);
        const htmlBody = openMessage.raw_body || openMessage.body || '';
        return (
          <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={() => setOpenMessage(null)}>
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(10px)' }} />
            <div className="slide-up" onClick={e => e.stopPropagation()} style={{ position:'relative', width:'100%', maxWidth:660, maxHeight:'82vh', background:'rgba(10,15,26,0.97)', borderRadius:20, border:`1px solid rgba(59,130,246,0.15)`, boxShadow:'0 24px 64px rgba(0,0,0,0.6)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
              {/* Header */}
              <div style={{ padding:'18px 22px 14px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <button onClick={() => setOpenMessage(null)} style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', color: C.text3, fontSize:12, cursor:'pointer' }}>
                    <ArrowLeft style={{ width:14, height:14 }} /> Back
                  </button>
                  <span style={{ fontSize:11, color: C.text3 }}>{new Date(openMessage.received_at).toLocaleString()}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: msgOtp ? 12 : 0 }}>
                  <div style={{ width:38, height:38, borderRadius:11, background: openMessage.has_otp ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.04)', border:`1px solid ${openMessage.has_otp ? 'rgba(59,130,246,0.15)' : C.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {openMessage.has_otp ? <Key style={{ width:17, height:17, color:'#60a5fa' }} /> : <Mail style={{ width:17, height:17, color: C.text3 }} />}
                  </div>
                  <div>
                    <p style={{ fontSize:14, fontWeight:700, color: C.text1 }}>{openMessage.sender}</p>
                    <p style={{ fontSize:12, color: C.text2, marginTop:2 }}>{openMessage.subject}</p>
                  </div>
                </div>
                {msgOtp && (
                  <button onClick={() => copyCode(msgOtp)} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 18px', borderRadius:12, cursor:'pointer', background: copiedCode === msgOtp ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.06)', border:`1px solid ${copiedCode === msgOtp ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.15)'}`, transition:'all 0.2s' }}>
                    <Key style={{ width:17, height:17, color: copiedCode === msgOtp ? C.green : '#60a5fa' }} />
                    <span style={{ fontSize:24, fontWeight:900, fontFamily:"'JetBrains Mono', monospace", color: copiedCode === msgOtp ? C.green : '#93c5fd', letterSpacing:'0.15em' }}>{msgOtp}</span>
                    <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:8, background: copiedCode === msgOtp ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.1)' }}>
                      {copiedCode === msgOtp ? <Check style={{ width:13, height:13, color: C.green }} /> : <Copy style={{ width:13, height:13, color:'#60a5fa' }} />}
                      <span style={{ fontSize:12, fontWeight:700, color: copiedCode === msgOtp ? C.green : '#93c5fd' }}>{copiedCode === msgOtp ? 'Copied!' : 'Copy OTP'}</span>
                    </div>
                  </button>
                )}
              </div>
              {/* Body */}
              <div style={{ flex:1, overflow:'hidden' }}>
                {htmlBody ? (
                  <iframe srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:20px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#1a1a1a;background:white;line-height:1.6;word-break:break-word}img{max-width:100%;height:auto}a{color:#2563eb}*{max-width:100%!important;box-sizing:border-box}</style></head><body>${htmlBody}</body></html>`}
                    style={{ width:'100%', height:'100%', border:'none', background:'white', minHeight:300 }}
                    sandbox="allow-same-origin" title="Email content"
                  />
                ) : (
                  <div style={{ padding:'20px 22px' }}>
                    <p style={{ fontSize:14, color: C.text2, lineHeight:1.8, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{openMessage.body_preview}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ IMPORT MODAL ═════════════════════════════════════ */}
      {showImport && (
        <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={() => setShowImport(false)}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(10px)' }} />
          <div className="slide-up" onClick={e => e.stopPropagation()} style={{ position:'relative', width:'100%', maxWidth:540, background:'rgba(10,15,26,0.97)', borderRadius:20, padding:28, border:`1px solid rgba(59,130,246,0.15)`, boxShadow:'0 24px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Plus style={{ width:17, height:17, color: C.blue }} />
                </div>
                <div>
                  <h2 style={{ fontSize:16, fontWeight:800, color: C.text1 }}>Import Accounts</h2>
                  <p style={{ fontSize:11, color: C.text3, marginTop:1 }}>Paste your account data below</p>
                </div>
              </div>
              <button onClick={() => setShowImport(false)} style={{ width:30, height:30, borderRadius:8, border:`1px solid ${C.border}`, cursor:'pointer', background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X style={{ width:14, height:14, color: C.text3 }} />
              </button>
            </div>
            <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(59,130,246,0.05)', border:'1px solid rgba(59,130,246,0.1)', marginBottom:16 }}>
              <p style={{ fontSize:11, color:'#60a5fa', fontWeight:600, marginBottom:4 }}>FORMAT</p>
              <code style={{ fontSize:11, color:'#93c5fd', fontFamily:"'JetBrains Mono', monospace" }}>email|password|refresh_token|client_id</code>
              <p style={{ fontSize:10, color: C.text3, marginTop:4 }}>One account per line · Fields separated by | or ----</p>
            </div>
            <textarea value={importText} onChange={e => setImportText(e.target.value)}
              placeholder={'user@hotmail.com|password|M.C531_SN1...|9e5f94bc-e8a4-4e73-b8be-63364c29d753'} rows={7}
              style={{ width:'100%', padding:14, borderRadius:10, border:`1px solid rgba(59,130,246,0.12)`, background:'rgba(255,255,255,0.03)', fontSize:12, fontFamily:"'JetBrains Mono', monospace", color: C.text1, outline:'none', resize:'vertical', lineHeight:1.6 }}
            />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14 }}>
              <span style={{ fontSize:11, color: C.text3 }}>{importText.trim().split('\n').filter(Boolean).length} lines</span>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setShowImport(false)} style={{ padding:'9px 20px', borderRadius:9, border:`1px solid ${C.border}`, background:'transparent', color: C.text2, fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancel</button>
                <button onClick={handleImport} disabled={importing || !importText.trim()} style={{ padding:'9px 22px', borderRadius:9, border:'none', background:'linear-gradient(135deg, #3b82f6, #6366f1)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, opacity: !importText.trim() ? 0.4 : 1, boxShadow:'0 4px 16px rgba(59,130,246,0.3)', transition:'all 0.2s' }}>
                  {importing ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} /> Importing...</> : <><Download style={{ width:14, height:14 }} /> Import</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ EXPORT MODAL ═════════════════════════════════════ */}
      {showExport && (
        <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={() => setShowExport(false)}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(10px)' }} />
          <div className="slide-up" onClick={e => e.stopPropagation()} style={{ position:'relative', width:'100%', maxWidth:560, background:'rgba(10,15,26,0.97)', borderRadius:20, padding:28, border:'1px solid rgba(16,185,129,0.15)', boxShadow:'0 24px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <FileDown style={{ width:17, height:17, color: C.green }} />
                </div>
                <div>
                  <h2 style={{ fontSize:16, fontWeight:800, color: C.text1 }}>Export Activated</h2>
                  <p style={{ fontSize:11, color: C.text3, marginTop:1 }}>{exportData.length} accounts · email:password</p>
                </div>
              </div>
              <button onClick={() => setShowExport(false)} style={{ width:30, height:30, borderRadius:8, border:`1px solid ${C.border}`, cursor:'pointer', background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X style={{ width:14, height:14, color: C.text3 }} />
              </button>
            </div>
            {loadingExport ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'36px 0', gap:10 }}>
                <div style={{ width:18, height:18, border:`2px solid rgba(16,185,129,0.2)`, borderTopColor: C.green, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                <span style={{ color: C.text3, fontSize:13 }}>Loading credentials...</span>
              </div>
            ) : exportData.length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px 0', color: C.text3 }}>
                <p>No activated accounts</p>
                <p style={{ fontSize:12, marginTop:6 }}>Press ✓ on accounts to mark as activated</p>
              </div>
            ) : (
              <>
                <div style={{ maxHeight:280, overflowY:'auto', marginBottom:16, background:'rgba(0,0,0,0.3)', borderRadius:12, border:`1px solid ${C.border}` }}>
                  {exportData.map((item, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom: i < exportData.length-1 ? `1px solid rgba(255,255,255,0.03)` : 'none' }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background: C.green, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:12, color:'#6ee7b7', fontFamily:"'JetBrains Mono', monospace", fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.email}</span>
                        {item.isPlusTagged && <span style={{ fontSize:9, fontWeight:800, color:'#fb923c', background:'rgba(251,146,60,0.15)', border:'1px solid rgba(251,146,60,0.3)', borderRadius:4, padding:'1px 5px', flexShrink:0 }}>+1</span>}
                        {item.authCode && <span style={{ fontSize:9, fontWeight:800, color:'#c084fc', background:'rgba(168,85,247,0.12)', border:'1px solid rgba(168,85,247,0.3)', borderRadius:4, padding:'1px 5px', flexShrink:0, fontFamily:"'JetBrains Mono',monospace" }}>{item.authCode}</span>}
                      </div>
                      <span style={{ fontSize:12, color: C.text3, fontFamily:"'JetBrains Mono', monospace" }}>|</span>
                      <span style={{ fontSize:12, color: C.text2, fontFamily:"'JetBrains Mono', monospace", flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.password}</span>
                      <button onClick={() => navigator.clipboard.writeText(`${item.email}|${item.password}`)} style={{ width:26, height:26, borderRadius:6, border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.03)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Copy style={{ width:11, height:11, color: C.text3 }} />
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={copyExport} style={{ flex:1, padding:'11px 0', borderRadius:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, fontWeight:700, fontSize:13, transition:'all 0.15s', background: exportCopied ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)', border:`1px solid ${exportCopied ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.15)'}`, color: C.green }}>
                    {exportCopied ? <Check style={{ width:14, height:14 }} /> : <Copy style={{ width:14, height:14 }} />}
                    {exportCopied ? 'Copied!' : 'Copy All'}
                  </button>
                  <button onClick={downloadTxt} style={{ flex:1, padding:'11px 0', borderRadius:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, fontWeight:700, fontSize:13, background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', color:'#a5b4fc', transition:'all 0.15s' }}>
                    <FileDown style={{ width:14, height:14 }} /> Download .TXT
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
