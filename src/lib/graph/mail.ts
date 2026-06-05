interface GraphMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  isRead: boolean;
}

interface GraphMailResponse {
  value: GraphMessage[];
  '@odata.nextLink'?: string;
}

/**
 * Fetch messages from a user's mailbox using Microsoft Graph API.
 */
export async function fetchMessages(
  accessToken: string,
  options?: {
    top?: number;
    filter?: string;
    orderBy?: string;
    search?: string;
  }
): Promise<GraphMessage[]> {
  const params = new URLSearchParams();
  params.set('$top', String(options?.top ?? 20));
  params.set('$orderby', options?.orderBy ?? 'receivedDateTime desc');
  params.set('$select', 'id,subject,bodyPreview,body,from,receivedDateTime,isRead');

  if (options?.filter) params.set('$filter', options.filter);
  if (options?.search) params.set('$search', `"${options.search}"`);

  const url = `https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Graph API error: ${response.status} - ${error}`);
  }

  const data: GraphMailResponse = await response.json();
  return data.value;
}

export type { GraphMessage };
