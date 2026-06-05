/**
 * LOCAL STORE — File-Persisted
 * =============================
 * يحل محل Supabase للتشغيل المحلي.
 * البيانات تُحفظ في ملف JSON على الـ disk — تبقى بعد إعادة تشغيل السيرفر.
 * للرجوع إلى بنية قاعدة البيانات الحقيقية، راجع: DATABASE_SCHEMA.md
 */

import crypto from 'crypto';
import fs   from 'fs';
import path from 'path';
import type { EmailAccount, MailMessage, OTPResult, QueueSession, AuditLog, AppSettings, AccountStatus } from '@/types';

function uuid(): string  { return crypto.randomUUID(); }
function now(): string   { return new Date().toISOString(); }

// ─── Persistence ────────────────────────────────────────────────────────────

const DATA_DIR  = path.join(process.cwd(), '.local-data');
const DATA_FILE = path.join(DATA_DIR, 'accounts.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadAccounts(): typeof db.email_accounts {
  try {
    ensureDir();
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw) || [];
  } catch { return []; }
}

function saveAccounts() {
  try {
    ensureDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(db.email_accounts, null, 2), 'utf-8');
  } catch (err) { console.error('[local-store] Failed to save:', err); }
}

// ─── Tables ────────────────────────────────────────────────────────────────

export const db = {
  email_accounts: loadAccounts() as (EmailAccount & { encrypted_password: string; encrypted_refresh_token: string; is_used: boolean })[],
  mail_messages:  [] as MailMessage[],
  otp_results:    [] as OTPResult[],
  queue_sessions: [] as QueueSession[],
  audit_logs:     [] as AuditLog[],
  settings:       [] as AppSettings[],
};

// ─── email_accounts helpers ────────────────────────────────────────────────

export const accountsStore = {
  findAll() {
    return [...db.email_accounts].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  },

  findById(id: string) {
    return db.email_accounts.find((a) => a.id === id) ?? null;
  },

  insert(data: {
    email: string;
    encrypted_password: string;
    client_id: string;
    encrypted_refresh_token: string;
    status?: AccountStatus;
    health_score?: number;
  }) {
    // Prevent duplicate emails
    const existing = db.email_accounts.find(a => a.email.toLowerCase() === data.email.trim().toLowerCase());
    if (existing) {
      // Update existing record
      Object.assign(existing, {
        encrypted_password:       data.encrypted_password,
        client_id:                data.client_id.trim(),
        encrypted_refresh_token:  data.encrypted_refresh_token,
        status:                   data.status ?? 'active',
        health_score:             data.health_score ?? 100,
        updated_at:               now(),
      });
      saveAccounts();
      return existing;
    }

    const record = {
      id:                        uuid(),
      email:                     data.email.trim(),
      encrypted_password:        data.encrypted_password,
      client_id:                 data.client_id.trim(),
      encrypted_refresh_token:   data.encrypted_refresh_token,
      status:                    (data.status ?? 'active') as AccountStatus,
      health_score:              data.health_score ?? 100,
      last_checked_at:           undefined,
      last_code:                 undefined,
      last_code_at:              undefined,
      notes:                     undefined,
      assigned_to:               undefined,
      token_expires_at:          undefined,
      total_fetches:             0,
      total_otps:                0,
      is_used:                   false,
      created_at:                now(),
      updated_at:                now(),
    };
    db.email_accounts.push(record);
    saveAccounts();
    return record;
  },

  update(id: string, patch: Record<string, unknown>) {
    const idx = db.email_accounts.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    db.email_accounts[idx] = { ...db.email_accounts[idx], ...patch, updated_at: now() };
    saveAccounts();
    return db.email_accounts[idx];
  },

  delete(id: string) {
    const idx = db.email_accounts.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    db.email_accounts.splice(idx, 1);
    saveAccounts();
    return true;
  },

  usedIds() {
    return db.email_accounts.filter((a) => a.is_used).map((a) => a.id);
  },

  clearUsed() {
    db.email_accounts.forEach((a) => { a.is_used = false; });
    saveAccounts();
  },
};

// ─── mail_messages helpers ─────────────────────────────────────────────────

export const messagesStore = {
  findById(id: string) {
    return db.mail_messages.find((m) => m.id === id) ?? null;
  },

  findByGraphId(graphId: string) {
    return db.mail_messages.find((m) => m.graph_message_id === graphId) ?? null;
  },

  upsert(data: Omit<MailMessage, 'id' | 'created_at' | 'has_otp'> & { graph_message_id?: string }) {
    const existing = data.graph_message_id ? this.findByGraphId(data.graph_message_id) : null;
    if (existing) {
      const idx = db.mail_messages.findIndex((m) => m.id === existing.id);
      db.mail_messages[idx] = { ...db.mail_messages[idx], ...data };
      return db.mail_messages[idx];
    }
    const record: MailMessage = { id: uuid(), has_otp: false, created_at: now(), ...data };
    db.mail_messages.push(record);
    return record;
  },

  update(id: string, patch: Partial<MailMessage>) {
    const idx = db.mail_messages.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    db.mail_messages[idx] = { ...db.mail_messages[idx], ...patch };
    return db.mail_messages[idx];
  },
};

// ─── otp_results helpers ───────────────────────────────────────────────────

export const otpStore = {
  findByMessageAndCode(messageId: string, code: string) {
    return db.otp_results.find((o) => o.message_id === messageId && o.code === code) ?? null;
  },

  insert(data: Omit<OTPResult, 'id' | 'extracted_at' | 'status'>) {
    const record: OTPResult = { id: uuid(), extracted_at: now(), status: 'fresh', ...data };
    db.otp_results.push(record);
    return record;
  },
};

// ─── queue_sessions helpers ────────────────────────────────────────────────

export const queueStore = {
  findAll() {
    return [...db.queue_sessions]
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 20);
  },

  insert() {
    const record: QueueSession = { id: uuid(), user_id: 'local', started_at: now(), accounts_processed: 0, otps_found: 0, status: 'active' };
    db.queue_sessions.push(record);
    return record;
  },

  update(id: string, patch: Partial<QueueSession>) {
    const idx = db.queue_sessions.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    db.queue_sessions[idx] = { ...db.queue_sessions[idx], ...patch };
    return db.queue_sessions[idx];
  },
};

// ─── audit_logs helpers ────────────────────────────────────────────────────

export const logsStore = {
  findAll(limit = 100) {
    return [...db.audit_logs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  },

  insert(data: Omit<AuditLog, 'id' | 'created_at'>) {
    const record: AuditLog = { id: uuid(), created_at: now(), ...data };
    db.audit_logs.push(record);
    return record;
  },
};

// ─── settings helpers ──────────────────────────────────────────────────────

export const settingsStore = {
  findAll() { return [...db.settings]; },

  upsert(key: string, value: Record<string, unknown>) {
    const idx = db.settings.findIndex((s) => s.key === key);
    if (idx !== -1) {
      db.settings[idx] = { key, value, updated_at: now() };
      return db.settings[idx];
    }
    const record: AppSettings = { key, value, updated_at: now() };
    db.settings.push(record);
    return record;
  },
};
