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

  // تحقق من الحقول وشفّر كل حساب
  const items: Parameters<typeof accountsStore.insertBatch>[0] = [];
  const parseErrors: { email: string; error: string }[] = [];

  for (const acc of accounts) {
    const { email, password, client_id, refresh_token } = acc;
    if (!email || !password || !client_id || !refresh_token) {
      parseErrors.push({ email: email || '', error: 'Missing required fields' });
      continue;
    }
    try {
      items.push({
        email: email.trim(),
        encrypted_password:      encrypt(password),
        client_id:               client_id.trim(),
        encrypted_refresh_token: encrypt(refresh_token),
        status:  'active',
        health_score: 100,
      });
    } catch (err) {
      parseErrors.push({ email, error: `Encrypt error: ${String(err)}` });
    }
  }

  // إدخال الكل في عملية واحدة
  const result = await accountsStore.insertBatch(items);

  return NextResponse.json({
    success: true,
    data: {
      total:      accounts.length,
      success:    result.success,
      failed:     result.failed + parseErrors.length,
      errors:     [...parseErrors, ...result.errors],
      importedIds: result.importedIds,
    },
  });
}
