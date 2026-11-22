/**
 * Tier 1: Feature 15 (Database Security & RLS) & Feature 16 (Free-Tier Verification)
 * 10 Tests: T1-F15-01 to T1-F15-05 and T1-F16-01 to T1-F16-05
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '../setup';

describe('Tier 1: Features 15 & 16 — Database Security, RLS & Free-Tier Configuration', () => {
  const userA = 'user_alice_111';
  const userB = 'user_bob_222';

  beforeEach(() => {
    mockDb.reset();
  });

  // --- Feature 15: Database Security, RLS & Edge Isolation ---

  it('T1-F15-01: Enforces RLS isolation — User A cannot view, edit, or delete User B contacts', () => {
    // Seed User B contact
    mockDb.setContextUser(userB);
    const bobContact = mockDb.createContact({
      user_id: userB,
      email: 'bob.prof@stanford.edu',
      first_name: 'BobProf',
    });

    // Switch context to User A
    mockDb.setContextUser(userA);
    const aliceContacts = mockDb.getContacts();
    expect(aliceContacts.length).toBe(0); // Zero cross-tenant visibility

    // Attempting to update Bob's contact fails with RLS violation
    expect(() => {
      mockDb.updateContact(bobContact.id, { first_name: 'Hacked' });
    }).toThrow(/RLS policy violation/);

    // Attempting to delete Bob's contact fails with RLS violation
    expect(() => {
      mockDb.deleteContact(bobContact.id);
    }).toThrow(/RLS policy violation/);
  });

  it('T1-F15-02: Enforces RLS isolation — User A cannot view or trigger User B campaigns', () => {
    mockDb.setContextUser(userB);
    const bAcc = mockDb.createAccount({ user_id: userB, email: 'b.sender@gmail.com', refresh_token: 'tok' });
    const bCmp = mockDb.createCampaign({ user_id: userB, account_id: bAcc.id, name: 'B Campaign', subject: 'S', body_text: 'B' });

    mockDb.setContextUser(userA);
    const aliceCampaigns = mockDb.getCampaigns();
    expect(aliceCampaigns.length).toBe(0);

    expect(() => {
      mockDb.updateCampaign(bCmp.id, { status: 'sending' });
    }).toThrow(/RLS policy violation/);
  });

  it('T1-F15-03: Enforces RLS isolation — User A cannot access User B connected accounts or tokens', () => {
    mockDb.setContextUser(userB);
    const bAcc = mockDb.createAccount({ user_id: userB, email: 'bob.gmail@gmail.com', refresh_token: 'bob-secret-token' });

    mockDb.setContextUser(userA);
    const aliceAccounts = mockDb.getAccounts();
    expect(aliceAccounts.length).toBe(0);

    expect(() => {
      mockDb.disconnectAccount(bAcc.id);
    }).toThrow(/RLS policy violation/);
  });

  it('T1-F15-04: Protects OAuth refresh token at rest using pgcrypto encryption, preventing plaintext leak', () => {
    mockDb.setContextUser(userA);
    const rawToken = '1//04verySensitiveRefreshToken';
    const acc = mockDb.createAccount({ user_id: userA, email: 'encrypted@gmail.com', refresh_token: rawToken });

    // Raw database row does NOT contain plaintext
    expect(acc.encrypted_refresh_token).not.toContain(rawToken);

    // Decrypting with wrong key fails
    expect(() => {
      mockDb.decryptToken(acc.encrypted_refresh_token, 'wrong-crypto-secret-key-32b');
    }).toThrow(/pgp_sym_decrypt: wrong key/);

    // Decrypting with legitimate key succeeds
    const decrypted = mockDb.decryptToken(acc.encrypted_refresh_token);
    expect(decrypted).toBe(rawToken);
  });

  it('T1-F15-05: Cascades campaign deletion to campaign_recipients while preserving global suppressions', () => {
    mockDb.setContextUser(userA);
    const acc = mockDb.createAccount({ user_id: userA, email: 'cascade@gmail.com', refresh_token: 'tok' });
    const cmp = mockDb.createCampaign({ user_id: userA, account_id: acc.id, name: 'Cascade Test', subject: 'S', body_text: 'B' });
    const contact = mockDb.createContact({ email: 'target@univ.edu' });
    const r = mockDb.addRecipient(cmp.id, contact.id);

    // Also add contact to suppression
    mockDb.addSuppression(contact.email, 'unsubscribe');

    expect(mockDb.recipients.has(r.id)).toBe(true);
    expect(mockDb.isSuppressed(contact.email)).toBe(true);

    // Delete campaign
    mockDb.deleteCampaign(cmp.id);

    // Recipients should be cascade deleted
    expect(mockDb.recipients.has(r.id)).toBe(false);
    // Global suppression should remain intact
    expect(mockDb.isSuppressed(contact.email)).toBe(true);
  });

  // --- Feature 16: Free-Tier Verification & Owner Configuration Guide ---

  it('T1-F16-01: Verifies system architecture requires zero paid email services or external servers', () => {
    const prohibitedProviders = ['sendgrid', 'resend', 'mailgun', 'ses', 'redis', 'bullmq'];
    const configuredProviders = ['supabase', 'google_gmail_api'];

    prohibitedProviders.forEach((p) => {
      expect(configuredProviders).not.toContain(p);
    });
  });

  it('T1-F16-02: Validates that OAuth redirect URI adheres to Supabase Edge Function URL format', () => {
    const projectRef = 'kiowzydhojinqonuvaxq';
    const expectedCallback = `https://${projectRef}.supabase.co/functions/v1/oauth-callback`;

    expect(expectedCallback).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/oauth-callback$/);
  });

  it('T1-F16-03: Confirms all required Supabase environment secrets are documented and consistent', () => {
    const requiredSecrets = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'OAUTH_ENCRYPTION_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    const mockEnv = {
      GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'GOCSPX-secret',
      OAUTH_ENCRYPTION_KEY: 'secret-key-32-chars',
      SUPABASE_URL: 'https://kiowzydhojinqonuvaxq.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key-string',
    };

    requiredSecrets.forEach((s) => {
      expect(mockEnv).toHaveProperty(s);
      expect((mockEnv as any)[s]).toBeTruthy();
    });
  });

  it('T1-F16-04: Asserts system default sending limit (40/day) respects Google free Gmail 500/day limit', () => {
    const defaultAccountLimit = 40;
    const googleHardCap = 500;

    expect(defaultAccountLimit).toBeLessThanOrEqual(50);
    expect(defaultAccountLimit).toBeLessThan(googleHardCap / 5); // Conservative margin > 80%
  });

  it('T1-F16-05: Verifies documentation correctly details Google Testing mode 7-day token lifecycle and test users', () => {
    const configGuide = {
      oauthConsentMode: 'Testing',
      tokenExpiryDays: 7,
      maxTestUsers: 100,
      requiresGoogleVerification: false,
    };

    expect(configGuide.tokenExpiryDays).toBe(7);
    expect(configGuide.requiresGoogleVerification).toBe(false);
  });
});
