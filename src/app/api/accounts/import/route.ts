import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import { accountsStore } from '@/lib/local-store';
import { encrypt } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { accounts } = body;

  if (!Array.isArray(accounts) || accounts.length === 0) {
    return NextResponse.json({ success: false, error: 'No accounts provided' }, { status: 400 });
  }

  let success = 0;
  let failed = 0;
  const errors: { line: number; email: string; error: string }[] = [];

  for (let i = 0; i < accounts.length; i++) {
    const { email, password, client_id, refresh_token } = accounts[i];

    if (!email || !password || !client_id || !refresh_token) {
      failed++;
      errors.push({ line: i + 1, email: email || '', error: 'Missing required fields' });
      continue;
    }

    try {
      await accountsStore.insert({
        email: email.trim(),
        encrypted_password: encrypt(password),
        client_id: client_id.trim(),
        encrypted_refresh_token: encrypt(refresh_token),
        status: 'active',
        health_score: 100,
      });
      success++;
    } catch (err: unknown) {
      failed++;
      errors.push({ line: i + 1, email, error: String(err) });
    }
  }

  return NextResponse.json({
    success: true,
    data: { total: accounts.length, success, failed, errors },
  });
}
