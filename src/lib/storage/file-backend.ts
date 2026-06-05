/**
 * File System Backend — Local Development
 * Saves accounts to .local-data/accounts.json
 */

import fs   from 'fs';
import path from 'path';
import type { StorageBackend } from '../local-store';

const DATA_DIR  = path.join(process.cwd(), '.local-data');
const DATA_FILE = path.join(DATA_DIR, 'accounts.json');

export class FileBackend implements StorageBackend {
  async loadAccounts() {
    try {
      if (!fs.existsSync(DATA_DIR))  fs.mkdirSync(DATA_DIR, { recursive: true });
      if (!fs.existsSync(DATA_FILE)) return [];
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) || [];
    } catch { return []; }
  }

  async saveAccounts(accounts: unknown[]) {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(accounts, null, 2), 'utf-8');
    } catch (err) { console.error('[file-backend] save error:', err); }
  }
}
