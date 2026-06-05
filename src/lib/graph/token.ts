import type { GraphTokenResponse } from '@/types';

/**
 * Refresh an OAuth2 access token using a refresh token.
 * Uses the Microsoft common endpoint (works for any tenant).
 */
export async function refreshAccessToken(
  clientId: string,
  refreshToken: string
): Promise<GraphTokenResponse> {
  const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'https://graph.microsoft.com/Mail.Read offline_access',
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token,
  };
}
