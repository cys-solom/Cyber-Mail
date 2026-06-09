import { NextResponse } from 'next/server';
import { accountsStore } from '@/lib/local-store';

export async function GET() {
  const accounts = await accountsStore.findAll();
  return NextResponse.json({
    backend:      process.env.KV_REST_API_URL ? 'KV (Vercel Redis)' : 'File (/tmp — ephemeral on Vercel!)',
    isVercel:     !!process.env.VERCEL,
    hasKV:        !!process.env.KV_REST_API_URL,
    accountCount: accounts.length,
    emails:       accounts.map(a => a.email),
  });
}
