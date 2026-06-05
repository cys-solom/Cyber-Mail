import { NextRequest, NextResponse } from 'next/server';
import { decrypt, encrypt } from '@/lib/crypto';
import { refreshAccessToken } from '@/lib/graph/token';
import { fetchMessages } from '@/lib/graph/mail';
import { extractOTP } from '@/lib/otp-extractor';
import { verifyAdminSession } from '@/lib/auth';
import { accountsStore, messagesStore, otpStore } from '@/lib/local-store';

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { account_id, search, top = 15 } = body;

  if (!account_id) {
    return NextResponse.json({ success: false, error: 'account_id required' }, { status: 400 });
  }

  const account = await accountsStore.findById(account_id);
  if (!account) {
    return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
  }

  try {
    const refreshToken = decrypt(account.encrypted_refresh_token);
    const tokenData = await refreshAccessToken(account.client_id, refreshToken);

    if (tokenData.refresh_token && tokenData.refresh_token !== refreshToken) {
      await accountsStore.update(account_id, {
        encrypted_refresh_token: encrypt(tokenData.refresh_token),
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      });
    }

    const graphMessages = await fetchMessages(tokenData.access_token, { top, search });

    const messages = [];
    const otps = [];

    for (const gMsg of graphMessages) {
      const savedMsg = messagesStore.upsert({
        account_id,
        graph_message_id: gMsg.id,
        sender: gMsg.from.emailAddress.address,
        subject: gMsg.subject,
        body_preview: gMsg.bodyPreview,
        raw_body: gMsg.body.content,
        received_at: gMsg.receivedDateTime,
        is_read: gMsg.isRead,
      });

      messages.push(savedMsg);

      const extractions = extractOTP(gMsg.subject || '', gMsg.body.content || '');
      if (extractions.length > 0) {
        messagesStore.update(savedMsg.id, { has_otp: true });
        savedMsg.has_otp = true;

        for (const ext of extractions) {
          const existing = otpStore.findByMessageAndCode(savedMsg.id, ext.code);
          if (!existing) {
            const otpData = otpStore.insert({
              message_id: savedMsg.id,
              account_id,
              code: ext.code,
              code_type: ext.type,
              sender: gMsg.from.emailAddress.address,
              subject: gMsg.subject,
            });
            otps.push(otpData);
          }
        }
      }
    }

    await accountsStore.update(account_id, {
      last_checked_at: new Date().toISOString(),
      last_code: otps.length > 0 ? otps[0].code : account.last_code,
      last_code_at: otps.length > 0 ? new Date().toISOString() : account.last_code_at,
      total_fetches: (account.total_fetches || 0) + 1,
      total_otps: (account.total_otps || 0) + otps.length,
      status: 'active',
    });

    return NextResponse.json({ success: true, data: { messages, otps, account_id } });
  } catch (err: unknown) {
    await accountsStore.update(account_id, {
      status: 'failed',
      health_score: Math.max(0, (account.health_score || 100) - 10),
      last_checked_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
