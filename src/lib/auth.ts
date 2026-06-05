import crypto from 'crypto';
import { cookies } from 'next/headers';

/**
 * Creates a stateless HMAC session token based on the admin password.
 * Survives server restarts — no in-memory store needed.
 */
export function createSessionToken(password: string): string {
  const secret = process.env.ENCRYPTION_KEY || 'cyber-mail-local-secret-2024';
  return crypto.createHmac('sha256', secret).update(`auth:${password}`).digest('hex');
}

export async function verifyAdminSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;
    if (!token || token.length !== 64) return false;

    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const expected = createSessionToken(adminPassword);

    // Timing-safe comparison
    return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
