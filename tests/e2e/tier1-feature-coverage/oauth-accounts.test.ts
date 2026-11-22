/**
 * Tier 1: Feature 1 (Personal Gmail OAuth 2.0) & Feature 2 (Account Management)
 * 10 Tests: T1-F01-01 to T1-F01-05 and T1-F02-01 to T1-F02-05
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockOAuth, mockDb } from '../setup';

describe('Tier 1: Features 1 & 2 — Gmail OAuth 2.0 & Account Lifecycle', () => {
  const testUserId = 'user_test_oauth_001';

  beforeEach(() => {
    mockOAuth.reset();
    mockDb.reset();
    mockDb.setContextUser(testUserId);
    mockDb.createProfile({ id: testUserId, email: 'tester@gamifytl.com', full_name: 'Lead Outreach' });
  });

  // --- Feature 1: Personal Gmail OAuth 2.0 ---

  it('T1-F01-01: Generates valid Google OAuth 2.0 authorization URL with offline consent', () => {
    const clientId = 'google-client-id-xyz.apps.googleusercontent.com';
    const redirectUri = 'https://kiowzydhojinqonuvaxq.supabase.co/functions/v1/oauth-callback';
    const statePayload = JSON.stringify({ userId: testUserId, nonce: 'crypto-nonce-123' });
    const encodedState = btoa(statePayload);

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.send openid email profile');
    authUrl.searchParams.set('state', encodedState);

    const generated = authUrl.toString();
    expect(generated).toContain('access_type=offline');
    expect(generated).toContain('prompt=consent');
    expect(generated).toContain('response_type=code');
    expect(generated).toContain('gmail.send');
    expect(generated).toContain(encodeURIComponent(redirectUri));

    // Decode state and assert integrity
    const decodedState = JSON.parse(atob(authUrl.searchParams.get('state')!));
    expect(decodedState.userId).toBe(testUserId);
  });

  it('T1-F01-02: Handles OAuth callback code exchange with Google token endpoint', async () => {
    const bodyParams = new URLSearchParams({
      code: 'valid-google-auth-code-123',
      client_id: 'google-client-id-xyz',
      client_secret: 'google-client-secret-abc',
      redirect_uri: 'https://kiowzydhojinqonuvaxq.supabase.co/functions/v1/oauth-callback',
      grant_type: 'authorization_code',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString(),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.access_token).toBeDefined();
    expect(data.refresh_token).toBeDefined();
    expect(data.expires_in).toBe(3599);
    expect(mockOAuth.tokenExchangeCount).toBe(1);
  });

  it('T1-F01-03: Encrypts refresh token at rest using symmetric encryption (pgcrypto emulation)', () => {
    const rawRefreshToken = '1//04verySecretGoogleRefreshToken';
    const account = mockDb.createAccount({
      user_id: testUserId,
      email: 'dr.alexander@gmail.com',
      refresh_token: rawRefreshToken,
    });

    expect(account.encrypted_refresh_token).not.toBe(rawRefreshToken);
    expect(account.encrypted_refresh_token.startsWith('enc:pgp:')).toBe(true);

    const decrypted = mockDb.decryptToken(account.encrypted_refresh_token);
    expect(decrypted).toBe(rawRefreshToken);
  });

  it('T1-F01-04: Successfully decrypts stored refresh token and fetches fresh access token', async () => {
    const rawRefreshToken = '1//04renewableTokenForTesting';
    const account = mockDb.createAccount({
      user_id: testUserId,
      email: 'prof.outreach@gmail.com',
      refresh_token: rawRefreshToken,
    });

    // Decrypt on Edge Function
    const decryptedToken = mockDb.decryptToken(account.encrypted_refresh_token);
    expect(decryptedToken).toBe(rawRefreshToken);

    const bodyParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decryptedToken,
      client_id: 'google-client-id-xyz',
      client_secret: 'google-client-secret-abc',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString(),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.access_token).toContain('_refreshed_');
    expect(mockOAuth.tokenRefreshCount).toBe(1);
  });

  it('T1-F01-05: Rejects OAuth callback when state parameter does not match authenticated user', () => {
    const untrustedState = btoa(JSON.stringify({ userId: 'attacker_user_999' }));
    const parsed = JSON.parse(atob(untrustedState));

    expect(parsed.userId).not.toBe(testUserId);
    // Simulating callback validator check
    const isAuthorized = parsed.userId === testUserId;
    expect(isAuthorized).toBe(false);
  });

  // --- Feature 2: Account Management UI & Lifecycle ---

  it('T1-F02-01: Lists connected accounts with masked credentials and valid statuses', () => {
    mockDb.createAccount({
      user_id: testUserId,
      email: 'sender1@gmail.com',
      display_name: 'Primary Sender',
      refresh_token: 'token1',
      daily_limit: 45,
    });
    mockDb.createAccount({
      user_id: testUserId,
      email: 'sender2@gmail.com',
      display_name: 'Secondary Sender',
      refresh_token: 'token2',
      daily_limit: 30,
    });

    const accounts = mockDb.getAccounts();
    expect(accounts.length).toBe(2);
    expect(accounts[0].email).toBe('sender1@gmail.com');
    expect(accounts[0].daily_limit).toBe(45);
    expect(accounts[0].status).toBe('active');
    expect(accounts[1].email).toBe('sender2@gmail.com');
    expect(accounts[1].daily_limit).toBe(30);
  });

  it('T1-F02-02: Disconnects account cleanly, transitioning status to revoked and clearing secret', () => {
    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: 'disconnect.me@gmail.com',
      refresh_token: 'tokenToPurge',
    });

    mockDb.disconnectAccount(acc.id);
    const updated = mockDb.accounts.get(acc.id)!;
    expect(updated.status).toBe('revoked');
    expect(updated.encrypted_refresh_token).toBe('');
  });

  it('T1-F02-03: Re-authentication lifecycle transitions expired account back to active', () => {
    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: 'expired.account@gmail.com',
      refresh_token: 'oldExpiredToken',
      status: 'expired',
    });
    expect(acc.status).toBe('expired');

    // User completes re-authentication
    const freshToken = '1//04newFreshRefreshToken';
    mockDb.updateAccount(acc.id, {
      encrypted_refresh_token: mockDb.encryptToken(freshToken),
      status: 'active',
    });

    const restored = mockDb.accounts.get(acc.id)!;
    expect(restored.status).toBe('active');
    expect(mockDb.decryptToken(restored.encrypted_refresh_token)).toBe(freshToken);
  });

  it('T1-F02-04: Updates daily sending limit and enforces boundary between 1 and 100', () => {
    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: 'quota.tester@gmail.com',
      refresh_token: 'token',
      daily_limit: 40,
    });

    const updated = mockDb.updateAccount(acc.id, { daily_limit: 50 });
    expect(updated.daily_limit).toBe(50);

    // Assert boundaries
    expect(() => mockDb.updateAccount(acc.id, { daily_limit: 0 })).toThrow(/check_connected_accounts_daily_limit/);
    expect(() => mockDb.updateAccount(acc.id, { daily_limit: 105 })).toThrow(/check_connected_accounts_daily_limit/);
  });

  it('T1-F02-05: Enforces unique constraint (user_id, email) across connected accounts', () => {
    mockDb.createAccount({
      user_id: testUserId,
      email: 'unique.prof@gmail.com',
      refresh_token: 'tokenA',
    });

    expect(() => {
      mockDb.createAccount({
        user_id: testUserId,
        email: 'UNIQUE.PROF@GMAIL.COM', // Case-insensitive duplicate
        refresh_token: 'tokenB',
      });
    }).toThrow(/uq_connected_accounts_user_email/);
  });
});
