import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';
import { verifyAdminSession } from '@/lib/auth';
import { accountsStore } from '@/lib/local-store';

// GET — List accounts
export async function GET() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const data = accountsStore.findAll();
  return NextResponse.json({ success: true, data, count: data.length });
}

// POST — Create account
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { email, password, client_id, refresh_token } = body;

  if (!email || !password || !client_id || !refresh_token) {
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
  }

  const data = accountsStore.insert({
    email,
    encrypted_password: encrypt(password),
    client_id,
    encrypted_refresh_token: encrypt(refresh_token),
    status: 'active',
    health_score: 100,
  });

  return NextResponse.json({ success: true, data });
}
