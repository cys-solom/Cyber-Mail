import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import { accountsStore } from '@/lib/local-store';

// GET — Get all used account IDs
export async function GET() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const ids = await accountsStore.usedIds();
  return NextResponse.json({ success: true, used_ids: ids });
}

// POST — Toggle used status
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { account_id, is_used } = body;

  if (!account_id || typeof is_used !== 'boolean') {
    return NextResponse.json({ success: false, error: 'account_id and is_used (boolean) required' }, { status: 400 });
  }

  await accountsStore.update(account_id, { is_used });
  return NextResponse.json({ success: true });
}

// DELETE — Clear all used statuses
export async function DELETE() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await accountsStore.clearUsed();
  return NextResponse.json({ success: true });
}
