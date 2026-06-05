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
      return [];
    }
  }

  async saveAccounts(accounts: AnyRecord[]): Promise<void> {
    try {
      const { kv } = await import('@vercel/kv');
      await kv.set(KV_KEY, accounts);
    } catch (err) {
      console.error('[kv-backend] save error:', err);
    }
  }
}
