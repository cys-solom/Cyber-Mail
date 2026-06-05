import crypto from 'crypto';
import { cookies } from 'next/headers';

/**
 * Creates a stateless HMAC session token based on the admin password.
 * Survives server restarts — no in-memory store needed.
 */
export function createSessionToken(password: string): string {
  const secret = process.env.ENCRYPTION_KEY || '0aa27fa28e4a6bce9a9c8c90fedb1a77aa404003bdf06f42c447c7125c0022d6';
  return crypto.createHmac('sha256', secret).update(`auth:${password}`).digest('hex');
}

export async function verifyAdminSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;
    if (!token || token.length !== 64) return false;

    const adminPassword = process.env.ADMIN_PASSWORD || 'Hub2030@';
    const expected = createSessionToken(adminPassword);

    // Timing-safe comparison
    return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
