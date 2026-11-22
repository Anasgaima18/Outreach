/**
 * Mock Google OAuth 2.0 Service
 * Intercepts token requests to https://oauth2.googleapis.com/token
 */

export interface TokenExchangeResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

export interface TokenRefreshResult {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export class MockOAuthService {
  public tokenExchangeCount = 0;
  public tokenRefreshCount = 0;
  public isRevoked = false;
  public isExpired = false;
  public forceMissingRefreshToken = false;
  public simulateNetworkTimeout = false;

  public handleTokenRequest(bodyParams: URLSearchParams): Response {
    if (this.simulateNetworkTimeout) {
      return new Response(JSON.stringify({ error: 'gateway_timeout', error_description: 'Connection timed out' }), {
        status: 504,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const grantType = bodyParams.get('grant_type');

    if (this.isRevoked || this.isExpired) {
      return new Response(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Token has been expired or revoked.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (grantType === 'authorization_code') {
      const code = bodyParams.get('code');
      if (!code || code.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'invalid_request', error_description: 'Missing required parameter: code' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (code === 'EXPIRED_CODE') {
        return new Response(
          JSON.stringify({ error: 'invalid_grant', error_description: 'Code has expired' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      this.tokenExchangeCount++;

      const result: Record<string, unknown> = {
        access_token: `ya29.a0AfH6S${crypto.randomUUID().replace(/-/g, '')}`,
        expires_in: 3599,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/gmail.send openid email profile',
      };

      if (!this.forceMissingRefreshToken) {
        result.refresh_token = `1//04${crypto.randomUUID().replace(/-/g, '')}`;
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (grantType === 'refresh_token') {
      const refreshToken = bodyParams.get('refresh_token');
      if (!refreshToken || refreshToken.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'invalid_request', error_description: 'Missing required parameter: refresh_token' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (refreshToken === 'REVOKED_REFRESH_TOKEN') {
        return new Response(
          JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been revoked by user.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      this.tokenRefreshCount++;

      const refreshResult: TokenRefreshResult = {
        access_token: `ya29.a0AfH6S_refreshed_${crypto.randomUUID().replace(/-/g, '')}`,
        expires_in: 3599,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/gmail.send openid email profile',
      };

      return new Response(JSON.stringify(refreshResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'unsupported_grant_type', error_description: `Unsupported grant_type: ${grantType}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  public reset(): void {
    this.tokenExchangeCount = 0;
    this.tokenRefreshCount = 0;
    this.isRevoked = false;
    this.isExpired = false;
    this.forceMissingRefreshToken = false;
    this.simulateNetworkTimeout = false;
  }
}
