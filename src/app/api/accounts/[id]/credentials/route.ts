import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto';
import { verifyAdminSession } from '@/lib/auth';
import { accountsStore } from '@/lib/local-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const data = accountsStore.findById(id);
  if (!data) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  let password = '';
  try { password = decrypt(data.encrypted_password); } catch { password = '(decryption failed)'; }

  return NextResponse.json({ success: true, data: { email: data.email, password } });
}
