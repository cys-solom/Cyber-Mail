/**
 * STORAGE ADAPTER
 * ===============
 * - Local dev  → File system (.local-data/accounts.json)
 * - Vercel     → Vercel KV  (Redis, free tier)
 *
 * البنية متوافقة مع Supabase للرجوع إليها مستقبلاً.
 */

import crypto from 'crypto';
import type { EmailAccount, MailMessage, OTPResult, QueueSession, AuditLog, AppSettings, AccountStatus } from '@/types';

// ─── Types ─────────────────────────────────────────────────────────────────

type AccountRecord = EmailAccount & {
  encrypted_password: string;
  encrypted_refresh_token: string;
  is_used: boolean;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function uuid(): string  { return crypto.randomUUID(); }
function getStableId(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}
function now():  string  { return new Date().toISOString(); }

// ─── Storage Backend (lazy loaded) ──────────────────────────────────────────

let _backend: StorageBackend | null = null;

async function getBackend(): Promise<StorageBackend> {
  if (_backend) return _backend;
  if (process.env.KV_REST_API_URL) {
    const { KVBackend } = await import('./storage/kv-backend');
    _backend = new KVBackend();
  } else {
    const { FileBackend } = await import('./storage/file-backend');
    _backend = new FileBackend();
  }
  return _backend;
}

export interface StorageBackend {
  loadAccounts(): Promise<AccountRecord[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveAccounts(accounts: any[]): Promise<void>;
}

// ─── In-Process Cache ────────────────────────────────────────────────────────
// Avoids hitting storage on every request within the same Node.js process.

let _cache: AccountRecord[] | null = null;
let _cacheLoaded = false;

async function getAccounts(): Promise<AccountRecord[]> {
  if (_cacheLoaded && _cache !== null) return _cache;
  const backend = await getBackend();
  _cache = await backend.loadAccounts();
  _cacheLoaded = true;
  return _cache;
}

/** Reset in-process cache — call after delete/clear operations */
function invalidateCache(): void {
  _cache = [];
  _cacheLoaded = true;  // keep as loaded so we don't re-read stale disk data
}

async function persistAccounts(): Promise<void> {
  if (!_cache) return;
  const backend = await getBackend();
  await backend.saveAccounts(_cache);
}

// ─── In-Memory Tables (non-persisted) ───────────────────────────────────────

export const db = {
  mail_messages:  [] as MailMessage[],
  otp_results:    [] as OTPResult[],
  queue_sessions: [] as QueueSession[],
  audit_logs:     [] as AuditLog[],
  settings:       [] as AppSettings[],
};

// ─── accountsStore ──────────────────────────────────────────────────────────

export const accountsStore = {
  async findAll(): Promise<AccountRecord[]> {
    const all = await getAccounts();
    return [...all].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  },

  async findById(id: string): Promise<AccountRecord | null> {
    const all = await getAccounts();
    return all.find(a => a.id === id) ?? null;
  },

  async insert(data: {
    email: string;
    encrypted_password: string;
    client_id: string;
    encrypted_refresh_token: string;
    status?: AccountStatus;
    health_score?: number;
  }): Promise<AccountRecord> {
    const all = await getAccounts();
    const existing = all.find(a => a.email.toLowerCase() === data.email.trim().toLowerCase());
    if (existing) {
      Object.assign(existing, {
        encrypted_password:      data.encrypted_password,
        client_id:               data.client_id.trim(),
        encrypted_refresh_token: data.encrypted_refresh_token,
        status:                  data.status ?? 'active',
        health_score:            data.health_score ?? 100,
        updated_at:              now(),
      });
      await persistAccounts();
      return existing;
    }
    const record: AccountRecord = {
      id:                       getStableId(data.email),
      email:                    data.email.trim(),
      encrypted_password:       data.encrypted_password,
      client_id:                data.client_id.trim(),
      encrypted_refresh_token:  data.encrypted_refresh_token,
      status:                   (data.status ?? 'active') as AccountStatus,
      health_score:             data.health_score ?? 100,
      last_checked_at:          undefined,
      last_code:                undefined,
      last_code_at:             undefined,
      notes:                    undefined,
      assigned_to:              undefined,
      token_expires_at:         undefined,
      total_fetches:            0,
      total_otps:               0,
      is_used:                  false,
      created_at:               now(),
      updated_at:               now(),
    };
    all.push(record);
    await persistAccounts();
    return record;
  },

  async update(id: string, patch: Record<string, unknown>): Promise<AccountRecord | null> {
    const all = await getAccounts();
    const idx = all.findIndex(a => a.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...patch, updated_at: now() };
    await persistAccounts();
    return all[idx];
  },

  async delete(id: string): Promise<boolean> {
    const all = await getAccounts();
    const idx = all.findIndex(a => a.id === id);
    if (idx === -1) return false;
    all.splice(idx, 1);
    await persistAccounts();
    return true;
  },

  async usedIds(): Promise<string[]> {
    const all = await getAccounts();
    return all.filter(a => a.is_used).map(a => a.id);
  },

  async clearUsed(): Promise<void> {
    const all = await getAccounts();
    all.forEach(a => { a.is_used = false; });
    await persistAccounts();
  },

  /** Delete ALL accounts from storage and reset cache */
  async deleteAll(): Promise<void> {
    invalidateCache();           // reset in-memory cache to empty
    if (!_cache) _cache = [];
    _cache.length = 0;           // clear the array in-place
    const backend = await getBackend();
    await backend.saveAccounts([]);  // persist empty array
  },
};

// ─── messagesStore (in-memory only) ────────────────────────────────────────

export const messagesStore = {
  findById(id: string) {
    return db.mail_messages.find(m => m.id === id) ?? null;
  },
  findByGraphId(graphId: string) {
    return db.mail_messages.find(m => m.graph_message_id === graphId) ?? null;
  },
  upsert(data: Omit<MailMessage, 'id' | 'created_at' | 'has_otp'> & { graph_message_id?: string }) {
    const existing = data.graph_message_id ? this.findByGraphId(data.graph_message_id) : null;
    if (existing) {
      const idx = db.mail_messages.findIndex(m => m.id === existing.id);
      db.mail_messages[idx] = { ...db.mail_messages[idx], ...data };
      return db.mail_messages[idx];
    }
    const record: MailMessage = { id: uuid(), has_otp: false, created_at: now(), ...data };
    db.mail_messages.push(record);
    return record;
  },
  update(id: string, patch: Partial<MailMessage>) {
    const idx = db.mail_messages.findIndex(m => m.id === id);
    if (idx === -1) return null;
    db.mail_messages[idx] = { ...db.mail_messages[idx], ...patch };
    return db.mail_messages[idx];
  },
};

// ─── otpStore ───────────────────────────────────────────────────────────────

export const otpStore = {
  findByMessageAndCode(messageId: string, code: string) {
    return db.otp_results.find(o => o.message_id === messageId && o.code === code) ?? null;
  },
  insert(data: Omit<OTPResult, 'id' | 'extracted_at' | 'status'>) {
    const record: OTPResult = { id: uuid(), extracted_at: now(), status: 'fresh', ...data };
    db.otp_results.push(record);
    return record;
  },
};

// ─── queueStore ─────────────────────────────────────────────────────────────

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
    const idx = db.queue_sessions.findIndex(q => q.id === id);
    if (idx === -1) return null;
    db.queue_sessions[idx] = { ...db.queue_sessions[idx], ...patch };
    return db.queue_sessions[idx];
  },
};

// ─── logsStore ──────────────────────────────────────────────────────────────

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

// ─── settingsStore ──────────────────────────────────────────────────────────

export const settingsStore = {
  findAll() { return [...db.settings]; },
  upsert(key: string, value: Record<string, unknown>) {
    const idx = db.settings.findIndex(s => s.key === key);
    if (idx !== -1) { db.settings[idx] = { key, value, updated_at: now() }; return db.settings[idx]; }
    const record: AppSettings = { key, value, updated_at: now() };
    db.settings.push(record);
    return record;
  },
};
