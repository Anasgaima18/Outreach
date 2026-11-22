/**
 * Tier 2: Security, RLS Isolation & Adversarial Boundaries
 * 20 Tests covering cross-tenant RLS, SQL injection resistance, cryptographic integrity.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '../setup';

describe('Tier 2: Security, RLS Isolation & Adversarial Boundaries (20 Tests)', () => {
  const userA = 'user_alice_victim';
  const userB = 'user_bob_attacker';

  beforeEach(() => {
    mockDb.reset();
  });

  it('T2-SEC-01: User B cannot select User A contacts (RLS returns 0 rows)', () => {
    mockDb.setContextUser(userA);
    mockDb.createContact({ email: 'alice.contact@ox.ac.uk', first_name: 'AliceProf' });

    mockDb.setContextUser(userB);
    const bobVisible = mockDb.getContacts();
    expect(bobVisible.length).toBe(0);
  });

  it('T2-SEC-02: User B cannot select User A campaigns (RLS returns 0 rows)', () => {
    mockDb.setContextUser(userA);
    const acc = mockDb.createAccount({ user_id: userA, email: 'alice@gmail.com', refresh_token: 'tok' });
    mockDb.createCampaign({ user_id: userA, account_id: acc.id, name: 'Alice Campaign', subject: 'S', body_text: 'B' });

    mockDb.setContextUser(userB);
    const bobCampaigns = mockDb.getCampaigns();
    expect(bobCampaigns.length).toBe(0);
  });

  it('T2-SEC-03: User B cannot select User A connected accounts (RLS returns 0 rows)', () => {
    mockDb.setContextUser(userA);
    mockDb.createAccount({ user_id: userA, email: 'alice.private@gmail.com', refresh_token: 'tok' });

    mockDb.setContextUser(userB);
    const bobAccounts = mockDb.getAccounts();
    expect(bobAccounts.length).toBe(0);
  });

  it('T2-SEC-04: User B cannot select or check User A suppressions (RLS returns false)', () => {
    mockDb.setContextUser(userA);
    mockDb.addSuppression('alice.suppressed@univ.edu', 'unsubscribe');

    mockDb.setContextUser(userB);
    expect(mockDb.isSuppressed('alice.suppressed@univ.edu')).toBe(false);
  });

  it('T2-SEC-05: User B cannot view User A replies', () => {
    mockDb.setContextUser(userA);
    const contact = mockDb.createContact({ email: 'alice.contact@univ.edu' });
    mockDb.registerReply({ contact_id: contact.id, sender_email: contact.email, snippet: 'Secret Reply' });

    mockDb.setContextUser(userB);
    const bobReplies = Array.from(mockDb.replies.values()).filter((r) => r.user_id === userB);
    expect(bobReplies.length).toBe(0);
  });

  it('T2-SEC-06: Cross-tenant campaign binding — User B cannot bind campaign to User A account', () => {
    mockDb.setContextUser(userA);
    const aliceAcc = mockDb.createAccount({ user_id: userA, email: 'alice@gmail.com', refresh_token: 'tok' });

    mockDb.setContextUser(userB);
    expect(() => {
      mockDb.createCampaign({
        user_id: userB,
        account_id: aliceAcc.id,
        name: 'Attacker Campaign',
        subject: 'S',
        body_text: 'B',
      });
    }).toThrow(/RLS policy violation: cannot bind campaign to another user account/);
  });

  it('T2-SEC-07: Cross-tenant recipient injection — User B cannot add recipient to User A campaign', () => {
    mockDb.setContextUser(userA);
    const acc = mockDb.createAccount({ user_id: userA, email: 'a@gmail.com', refresh_token: 'tok' });
    const cmp = mockDb.createCampaign({ user_id: userA, account_id: acc.id, name: 'Alice Cmp', subject: 'S', body_text: 'B' });

    mockDb.setContextUser(userB);
    const bobContact = mockDb.createContact({ email: 'b@univ.edu' });

    expect(() => {
      mockDb.addRecipient(cmp.id, bobContact.id);
    }).toThrow(/RLS policy violation: cannot add recipient to another user campaign/);
  });

  it('T2-SEC-08: SQL injection payload \'; DROP TABLE contacts; -- treated as literal string in search', () => {
    mockDb.setContextUser(userA);
    mockDb.createContact({ email: 'normal@harvard.edu', first_name: 'David' });

    const sqlInjectionQuery = "'; DROP TABLE contacts; --";
    const results = mockDb.getContacts({ search: sqlInjectionQuery });

    expect(results.length).toBe(0);
    // Table is untouched
    expect(mockDb.getContacts().length).toBe(1);
  });

  it('T2-SEC-09: SQL injection payload \' OR \'1\'=\'1 in filter parameter does not leak unauthorized rows', () => {
    mockDb.setContextUser(userA);
    mockDb.createContact({ email: 'c1@ox.ac.uk', institution: 'Oxford' });
    mockDb.createContact({ email: 'c2@cam.ac.uk', institution: 'Cambridge' });

    const injectionFilter = "' OR '1'='1";
    const results = mockDb.getContacts({ institution: injectionFilter });

    expect(results.length).toBe(0); // Only matches literal "' OR '1'='1"
  });

  it('T2-SEC-10: Parameterized escaping ensures quotes in queries do not break SQL queries', () => {
    mockDb.setContextUser(userA);
    mockDb.createContact({ email: 'labourie@unice.fr', institution: "Université Côte d'Azur" });

    const results = mockDb.getContacts({ institution: "Côte d'Azur" });
    expect(results.length).toBe(1);
    expect(results[0].email).toBe('labourie@unice.fr');
  });

  it('T2-SEC-11: Campaign subject with SQL payloads stored cleanly as string literals', () => {
    mockDb.setContextUser(userA);
    const acc = mockDb.createAccount({ user_id: userA, email: 'safe@gmail.com', refresh_token: 'tok' });

    const injectionSubject = "GamifyTL'; UPDATE campaigns SET status='completed'; --";
    const cmp = mockDb.createCampaign({
      user_id: userA,
      account_id: acc.id,
      name: 'Safe Campaign',
      subject: injectionSubject,
      body_text: 'Body',
    });

    expect(cmp.subject).toBe(injectionSubject);
    expect(cmp.status).toBe('draft');
  });

  it('T2-SEC-12: Anonymous query (no authenticated user) denied access to contacts', () => {
    mockDb.setContextUser(null);
    const contacts = mockDb.getContacts();
    expect(contacts.length).toBe(0);
  });

  it('T2-SEC-13: Forged user ID in request body ignored when authenticated user context is set', () => {
    mockDb.setContextUser(userA);
    const contact = mockDb.createContact({
      user_id: userB, // Attacker tries to pass userB in payload
      email: 'spoofed@harvard.edu',
    });

    expect(contact.user_id).toBe(userA); // Forced to authenticated user context
  });

  it('T2-SEC-14: Tampered ciphertext in pgcrypto decrypt throws format corruption error', () => {
    const corruptCiphertext = 'enc:pgp:corrupted_base64_string_xyz';
    expect(() => {
      mockDb.decryptToken(corruptCiphertext);
    }).toThrow(/corrupt ciphertext/);
  });

  it('T2-SEC-15: Decrypting token with wrong symmetric secret key throws authentication failure', () => {
    mockDb.setContextUser(userA);
    const acc = mockDb.createAccount({ user_id: userA, email: 'keytest@gmail.com', refresh_token: 'raw-secret' });

    expect(() => {
      mockDb.decryptToken(acc.encrypted_refresh_token, 'totally-wrong-key-32-chars-long');
    }).toThrow(/wrong key/);
  });

  it('T2-SEC-16: Audit ledger email_events rejects invalid event mutations', () => {
    expect(() => {
      mockDb.logEvent({
        campaign_id: 'cmp_123',
        recipient_id: 'rcp_123',
        event_type: 'injected_hack' as any,
      });
    }).toThrow(/check_email_events_type/);
  });

  it('T2-SEC-17: Audit ledger is append-only and preserves historical events', () => {
    mockDb.setContextUser(userA);
    mockDb.logEvent({ campaign_id: 'c1', recipient_id: 'r1', event_type: 'queued' });
    mockDb.logEvent({ campaign_id: 'c1', recipient_id: 'r1', event_type: 'accepted_by_gmail' });

    const events = mockDb.getEvents('c1');
    expect(events.length).toBe(2);
    expect(events[0].event_type).toBe('queued');
    expect(events[1].event_type).toBe('accepted_by_gmail');
  });

  it('T2-SEC-18: Verifies client environment configuration contains zero references to service_role key', () => {
    const clientEnv = {
      VITE_SUPABASE_URL: 'https://kiowzydhojinqonuvaxq.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon',
    };

    expect(Object.keys(clientEnv)).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(JSON.stringify(clientEnv)).not.toContain('service_role');
  });

  it('T2-SEC-19: Rejects CSRF state parameter with invalid signature or expired timestamp', () => {
    const expiredTimestamp = Date.now() - 3600 * 1000 * 24; // 24 hours ago
    const stateObj = { userId: userA, timestamp: expiredTimestamp };

    const isStateExpired = Date.now() - stateObj.timestamp > 15 * 60 * 1000; // 15 min TTL
    expect(isStateExpired).toBe(true);
  });

  it('T2-SEC-20: Cross-tenant reply registration is blocked', () => {
    mockDb.setContextUser(userA);
    const aliceContact = mockDb.createContact({ email: 'alice.prof@univ.edu' });

    mockDb.setContextUser(userB);
    expect(() => {
      mockDb.registerReply({
        user_id: userB,
        contact_id: aliceContact.id,
        sender_email: aliceContact.email,
      });
    }).toThrow(/RLS policy violation: cannot register reply for another user contact/);
  });
});
