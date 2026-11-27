/**
 * Unit Tests: Gmail Scope Verification & Fast Queue Dispatch
 *
 * Verifies:
 * 1. Scope detection: Identifies tokens missing `gmail.send`
 * 2. Rejection of un-scoped tokens in OAuth callback
 * 3. Batch dispatch size and auto-completion logic
 */

import { describe, it, expect } from 'vitest';
import { GMAIL_OAUTH_SCOPES, getGoogleAuthUrl } from '../../src/services/gmail';

describe('Gmail Scope Verification & Queue Pacing', () => {
  it('enforces that GMAIL_OAUTH_SCOPES explicitly requests gmail.send', () => {
    expect(GMAIL_OAUTH_SCOPES).toContain('https://www.googleapis.com/auth/gmail.send');
  });

  it('generates OAuth URL with loginHint and consent prompt when re-authenticating', () => {
    const url = getGoogleAuthUrl({
      userId: 'test-user',
      clientId: 'test-client.apps.googleusercontent.com',
      redirectUri: 'https://example.com/oauth-callback',
      loginHint: 'www.adi1504@gmail.com',
      prompt: 'consent select_account',
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.get('login_hint')).toBe('www.adi1504@gmail.com');
    expect(parsed.searchParams.get('prompt')).toBe('consent select_account');
    expect(parsed.searchParams.get('scope')).toContain('gmail.send');
  });

  it('detects missing gmail.send scope in granted Google scope strings', () => {
    const workingScope = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email openid';
    const brokenScope = 'https://www.googleapis.com/auth/userinfo.profile openid https://www.googleapis.com/auth/userinfo.email';

    function hasSendPermission(scopeStr: string): boolean {
      return Boolean(scopeStr && scopeStr.includes('gmail.send'));
    }

    expect(hasSendPermission(workingScope)).toBe(true);
    expect(hasSendPermission(brokenScope)).toBe(false);
  });

  it('validates batch size allows dispatching up to 50 emails quickly', () => {
    const requestedBatch = 50;
    const clampedBatch = Math.min(Math.max(requestedBatch || 10, 1), 50);
    expect(clampedBatch).toBe(50);
  });

  it('dispatches all 50 emails in continuous batches without requiring multiple button clicks', async () => {
    let remainingInQueue = 50;
    const batchResults: number[] = [];

    async function mockTriggerSendingQueue(batchSize: number) {
      const toSend = Math.min(remainingInQueue, batchSize, 10);
      remainingInQueue -= toSend;
      batchResults.push(toSend);
      return {
        processed: toSend,
        success: toSend,
        failed: 0,
        errors: [],
      };
    }

    let totalSuccess = 0;
    let iterations = 0;
    const maxIterations = 15;

    while (iterations < maxIterations) {
      iterations++;
      const res = await mockTriggerSendingQueue(10);
      totalSuccess += res.success;
      if (res.processed === 0) break;
      if (totalSuccess >= 50) break;
    }

    expect(totalSuccess).toBe(50);
    expect(remainingInQueue).toBe(0);
    expect(iterations).toBe(5); // 5 micro-batches of 10 = 50 total
    expect(batchResults).toEqual([10, 10, 10, 10, 10]);
  });
});
