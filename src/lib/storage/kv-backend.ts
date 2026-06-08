/**
 * Vercel KV Backend — Production (Vercel Deployment)
 * Uses @vercel/kv (Redis-compatible, free tier)
 * Setup: Vercel Dashboard → Storage → Create KV Database
 */

import type { StorageBackend } from '../local-store';

const KV_KEY = 'cyber_mail:accounts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = any;

export class KVBackend implements StorageBackend {
  async loadAccounts(): Promise<AnyRecord[]> {
    try {
      const { kv } = await import('@vercel/kv');
      const data = await kv.get<AnyRecord[]>(KV_KEY);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[kv-backend] load error:', err);
      // أعد مصفوفة فارغة فقط كـ fallback — الـ cache في local-store سيعوّض
      return [];
    }
  }

  async saveAccounts(accounts: AnyRecord[]): Promise<void> {
    try {
      const { kv } = await import('@vercel/kv');
      await kv.set(KV_KEY, accounts);
    } catch (err) {
      console.error('[kv-backend] save error (attempt 1):', err);
      // retry مرة واحدة بعد ثانية
      try {
        await new Promise(r => setTimeout(r, 1000));
        const { kv } = await import('@vercel/kv');
        await kv.set(KV_KEY, accounts);
        console.log('[kv-backend] save succeeded on retry');
      } catch (err2) {
        console.error('[kv-backend] save error (attempt 2 — giving up):', err2);
      }
    }
  }
}

