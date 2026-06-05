import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import { accountsStore } from '@/lib/local-store';

// DELETE — Delete ALL accounts (clear)
export async function DELETE() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await accountsStore.deleteAll();
  return NextResponse.json({ success: true });
}
