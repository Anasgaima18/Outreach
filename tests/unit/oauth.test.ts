/**
 * Unit Test Suite: Gmail OAuth & URL Services
 * Validates src/services/gmail.ts for Google OAuth 2.0 URL construction,
 * CSRF state generation, and Gmail conversation deep links.
 */

import { describe, it, expect } from 'vitest';
import {
  getGoogleAuthUrl,
  getGmailThreadUrl,
  generateOAuthState,
  parseOAuthState,
  GMAIL_OAUTH_SCOPES,
} from '@/services/gmail';
import { base64UrlEncode } from '@/lib/mime';

describe('Unit Test: Gmail OAuth & URL Services (src/services/gmail.ts)', () => {
  const mockUserId = 'usr_11111111-2222-3333-4444-555555555555';
  const mockClientId = 'google-client-id-12345.apps.googleusercontent.com';
  const mockRedirectUri = 'https://kiowzydhojinqonuvaxq.supabase.co/functions/v1/oauth-callback';

  // 1. Google OAuth Authorization URL Parameters
  it('constructs Google OAuth URL with required parameters: offline access, consent prompt, and scopes', () => {
    const authUrl = getGoogleAuthUrl({
      userId: mockUserId,
      clientId: mockClientId,
      redirectUri: mockRedirectUri,
    });

    const parsed = new URL(authUrl);
    expect(parsed.origin).toBe('https://accounts.google.com');
    expect(parsed.pathname).toBe('/o/oauth2/v2/auth');

    const params = parsed.searchParams;
    expect(params.get('client_id')).toBe(mockClientId);
    expect(params.get('redirect_uri')).toBe(mockRedirectUri);
    expect(params.get('response_type')).toBe('code');
    expect(params.get('access_type')).toBe('offline');
    expect(params.get('prompt')).toBe('consent');
    expect(params.get('scope')).toBe(GMAIL_OAUTH_SCOPES);
    expect(params.get('state')).toBeDefined();
  });

  // 2. Verified Minimum Sensitive Scopes
  it('includes only gmail.send, openid, email, and profile (sensitive, non-restricted)', () => {
    expect(GMAIL_OAUTH_SCOPES).toContain('https://www.googleapis.com/auth/gmail.send');
    expect(GMAIL_OAUTH_SCOPES).toContain('openid');
    expect(GMAIL_OAUTH_SCOPES).toContain('email');
    expect(GMAIL_OAUTH_SCOPES).toContain('profile');

    // Never request restricted scopes by default to avoid CASA audit fees
    expect(GMAIL_OAUTH_SCOPES).not.toContain('gmail.readonly');
    expect(GMAIL_OAUTH_SCOPES).not.toContain('mail.google.com');
    expect(GMAIL_OAUTH_SCOPES).not.toContain('gmail.modify');
  });

  // 3. CSRF State Token Structure & Validation
  it('generates and safely validates CSRF state token payload', () => {
    const nonce = 'custom-nonce-abc-123';
    const stateToken = generateOAuthState(mockUserId, nonce);

    // URL-safe base64 regex
    expect(/^[A-Za-z0-9_-]+$/.test(stateToken)).toBe(true);

    const parsed = parseOAuthState(stateToken);
    expect(parsed).not.toBeNull();
    expect(parsed?.userId).toBe(mockUserId);
    expect(parsed?.nonce).toBe(nonce);
    expect(parsed?.timestamp).toBeGreaterThan(0);
    expect(Date.now() - (parsed?.timestamp || 0)).toBeLessThan(5000);
  });

  // 4. Invalid or Tampered State Handling
  it('gracefully returns null when decoding invalid or tampered CSRF state tokens', () => {
    expect(parseOAuthState('not-valid-base64-$$$')).toBeNull();
    expect(parseOAuthState('')).toBeNull();
    expect(parseOAuthState('e30')).toBeNull(); // Empty JSON object {} without userId
  });

  // 5. Input Validation
  it('throws an error if required parameters are missing when constructing Google OAuth URL', () => {
    expect(() =>
      getGoogleAuthUrl({ userId: '', clientId: mockClientId, redirectUri: mockRedirectUri })
    ).toThrow('userId is required');

    expect(() =>
      getGoogleAuthUrl({ userId: mockUserId, clientId: '', redirectUri: mockRedirectUri })
    ).toThrow('clientId is required');

    expect(() =>
      getGoogleAuthUrl({ userId: mockUserId, clientId: mockClientId, redirectUri: '' })
    ).toThrow('redirectUri is required');
  });

  // 6. Gmail Conversation Deep Links
  it('formats Gmail thread deep-link URL correctly with authuser query param and encoded thread ID', () => {
    const accountEmail = 'outreach.prof@gmail.com';
    const threadId = '18bf9999a00b12cd';

    const threadUrl = getGmailThreadUrl(accountEmail, threadId);
    expect(threadUrl).toBe(
      `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(accountEmail)}#all/${threadId}`
    );
  });

  // 7. Gmail Thread URL Special Characters & Trimming
  it('properly encodes special characters and trims whitespace in Gmail thread deep link', () => {
    const emailWithPlus = ' outreach+prof@gmail.com ';
    const threadId = ' thread_12345 ';

    const threadUrl = getGmailThreadUrl(emailWithPlus, threadId);
    expect(threadUrl).toContain('authuser=outreach%2Bprof%40gmail.com');
    expect(threadUrl).toContain('#all/thread_12345');
    expect(threadUrl).not.toContain(' ');
  });

  // 8. OAuth State Expiration (15-Minute TTL)
  it('enforces 15-minute TTL expiration on OAuth state tokens', () => {
    const nonce = 'exp-test-nonce';

    // Fresh token (created just now)
    const freshToken = generateOAuthState(mockUserId, nonce);
    expect(parseOAuthState(freshToken)).not.toBeNull();

    // Expired token (16 minutes ago = 960,000 ms)
    const sixteenMinutesAgo = Date.now() - (16 * 60 * 1000);
    const expiredPayload = { userId: mockUserId, nonce, timestamp: sixteenMinutesAgo };
    const expiredToken = base64UrlEncode(JSON.stringify(expiredPayload));
    expect(parseOAuthState(expiredToken)).toBeNull();

    // Custom TTL (e.g. 5 seconds)
    const fiveSecAgo = Date.now() - 6000;
    const customPayload = { userId: mockUserId, nonce, timestamp: fiveSecAgo };
    const customToken = base64UrlEncode(JSON.stringify(customPayload));
    expect(parseOAuthState(customToken, 5000)).toBeNull();
    expect(parseOAuthState(customToken, 10000)).not.toBeNull();

    // Future clock skew beyond 1 minute should also be rejected
    const farFuture = Date.now() + 120000; // 2 minutes in future
    const futurePayload = { userId: mockUserId, nonce, timestamp: farFuture };
    const futureToken = base64UrlEncode(JSON.stringify(futurePayload));
    expect(parseOAuthState(futureToken)).toBeNull();
  });
});
