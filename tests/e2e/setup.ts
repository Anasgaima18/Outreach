/**
 * Global E2E Test Setup & Network Interceptor
 * Intercepts Google OAuth & Gmail API requests deterministically.
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { MockGmailService } from './harness/mock-gmail';
import { MockOAuthService } from './harness/mock-oauth';
import { MockDatabase } from './harness/mock-db';

export const mockGmail = new MockGmailService();
export const mockOAuth = new MockOAuthService();
export const mockDb = new MockDatabase();

const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // 1. Intercept Gmail API Send
    if (urlStr.includes('gmail.googleapis.com/gmail/v1/users/me/messages/send')) {
      const headers = init?.headers as Record<string, string> | undefined;
      let authHeader: string | undefined;
      if (headers) {
        authHeader = headers['Authorization'] || headers['authorization'];
      }
      let body: any = {};
      if (typeof init?.body === 'string') {
        try {
          body = JSON.parse(init.body);
        } catch {
          body = {};
        }
      }
      return mockGmail.handleSendRequest(authHeader, body);
    }

    // 2. Intercept Google OAuth token endpoint
    if (urlStr.includes('oauth2.googleapis.com/token')) {
      const bodyParams = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
      return mockOAuth.handleTokenRequest(bodyParams);
    }

    // 3. Intercept Google UserInfo endpoint
    if (urlStr.includes('googleapis.com/oauth2/v2/userinfo')) {
      return new Response(
        JSON.stringify({
          email: 'outreach.gamifytl@gmail.com',
          name: 'GamifyTL Outreach Sender',
          verified_email: true,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return originalFetch(input, init);
  };
});

beforeEach(() => {
  mockGmail.reset();
  mockOAuth.reset();
  mockDb.reset();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});
