export interface IMSUser {
  userId: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
}

export interface IMSTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export function getIMSAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'openid,AdobeID,read_organizations',
    response_type: 'code',
    state,
    redirect_uri: redirectUri,
  });
  return `https://ims-na1.adobelogin.com/ims/authorize/v2?${params}`;
}

export async function exchangeIMSCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<IMSTokenResponse> {
  const response = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`IMS token exchange failed: ${response.status}`);
  }

  return response.json() as Promise<IMSTokenResponse>;
}

export async function getIMSProfile(accessToken: string): Promise<IMSUser> {
  const response = await fetch('https://ims-na1.adobelogin.com/ims/profile/v1', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`IMS profile fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    userId: string;
    email: string;
    displayName: string;
    first_name: string;
    last_name: string;
  };

  return {
    userId: data.userId,
    email: data.email,
    displayName: data.displayName,
    firstName: data.first_name,
    lastName: data.last_name,
    avatarUrl: `https://cc-api-storage.adobe.io/id/urn:aaid:sc:VA6:${data.userId}/avatar`,
  };
}

export async function getIMSOrganizations(accessToken: string): Promise<Array<{ orgId: string; orgName: string; orgType: string }>> {
  const response = await fetch('https://ims-na1.adobelogin.com/ims/organizations/v6', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return [];

  const data = (await response.json()) as Array<{
    orgRef: { ident: string; authSrc: string };
    orgName: string;
    orgType: string;
  }>;

  return data.map((org) => ({
    orgId: org.orgRef.ident,
    orgName: org.orgName,
    orgType: org.orgType,
  }));
}
