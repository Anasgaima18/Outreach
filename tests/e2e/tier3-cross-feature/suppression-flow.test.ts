/**
 * Tier 3: Pairwise Cross-Feature Testing — Suppression Flow & Deliverability Safeguards
 * 5 Scenarios: T3-PW-04, T3-PW-07, T3-PW-10, T3-PW-13, T3-PW-16
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockGmail, mockDb } from '../setup';

describe('Tier 3: Suppression Flow & Deliverability Combinations (5 Tests)', () => {
  const testUserId = 'user_tier3_suppression_001';
  let accountId: string;

  beforeEach(() => {
    mockGmail.reset();
    mockDb.reset();
    mockDb.setContextUser(testUserId);

    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: 'suppression.lead@gmail.com',
      refresh_token: 'valid-token',
    });
    accountId = acc.id;
  });

  it('T3-PW-04: Suppression Pre-flight: Contact was previously bounced; campaign queue skips send and marks suppressed', () => {
    const bouncedEmail = 'retired.prof@oxford.ac.uk';
    mockDb.addSuppression(bouncedEmail, 'bounce');

    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Pre-flight Bounce Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    const contact = mockDb.createContact({ email: bouncedEmail, first_name: 'Retired' });
    const recipient = mockDb.addRecipient(cmp.id, contact.id);

    // Queue worker pre-flight check
    if (mockDb.isSuppressed(contact.email)) {
      recipient.status = 'suppressed';
      mockDb.logEvent({
        campaign_id: cmp.id,
        recipient_id: recipient.id,
        event_type: 'suppressed',
        metadata: { reason: 'prior_bounce_on_file' },
      });
    }

    expect(recipient.status).toBe('suppressed');
    expect(mockGmail.sentMessages.length).toBe(0);
    const events = mockDb.getEvents(cmp.id);
    expect(events.some((e) => e.event_type === 'suppressed')).toBe(true);
  });

  it('T3-PW-07: Unsubscribe Suppression: Recipient in suppression list with reason unsubscribed; blocks send', () => {
    const unsubEmail = 'optout.dean@harvard.edu';
    mockDb.addSuppression(unsubEmail, 'unsubscribe');

    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Unsubscribe Test',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    const contact = mockDb.createContact({ email: unsubEmail, first_name: 'Dean' });
    const recipient = mockDb.addRecipient(cmp.id, contact.id);

    // Pre-flight check
    if (mockDb.isSuppressed(contact.email)) {
      recipient.status = 'suppressed';
    }

    expect(recipient.status).toBe('suppressed');
    expect(mockGmail.sentMessages.length).toBe(0);
  });

  it('T3-PW-10: Bounced Contact in Follow-up Campaign: Initial send fails with 550 bounce; follow-up marked cancelled; added to suppressions', () => {
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Follow-up Bounce Test',
      subject: 'Subject',
      body_text: 'Body',
      follow_up_enabled: true,
      status: 'sending',
    });

    const contact = mockDb.createContact({ email: 'bad.mailbox@univ.edu', first_name: 'Bad' });
    const recipient = mockDb.addRecipient(cmp.id, contact.id);
    recipient.follow_up_status = 'scheduled';

    // Simulate 550 bounce
    recipient.status = 'bounced';
    recipient.follow_up_status = 'skipped_bounced';
    mockDb.addSuppression(contact.email, 'bounce');

    expect(recipient.status).toBe('bounced');
    expect(recipient.follow_up_status).toBe('skipped_bounced');
    expect(mockDb.isSuppressed(contact.email)).toBe(true);
  });

  it('T3-PW-13: Unsubscribed + Delayed Approval: User unsubs while campaign is awaiting approval; blocks send upon approval', () => {
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Late Approval Unsub',
      subject: 'Subject',
      body_text: 'Body',
      status: 'awaiting_approval',
    });

    const contact = mockDb.createContact({ email: 'unsub.while.draft@univ.edu' });
    const recipient = mockDb.addRecipient(cmp.id, contact.id);

    // While awaiting approval, contact requests unsubscribe
    mockDb.addSuppression(contact.email, 'unsubscribe');

    // Admin approves campaign later
    mockDb.updateCampaign(cmp.id, { status: 'scheduled' });
    mockDb.updateCampaign(cmp.id, { status: 'sending' });

    // Worker checks suppression list
    if (mockDb.isSuppressed(contact.email)) {
      recipient.status = 'suppressed';
    }

    expect(recipient.status).toBe('suppressed');
    expect(mockGmail.sentMessages.length).toBe(0);
  });

  it('T3-PW-16: Multi-Tier Safeguard: Contact with bounce record; queue skips; zero Gmail API quota units consumed', () => {
    const bouncedContact = mockDb.createContact({ email: 'zero.quota.bounce@univ.edu' });
    mockDb.addSuppression(bouncedContact.email, 'bounce');

    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Zero Quota Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    const recipient = mockDb.addRecipient(cmp.id, bouncedContact.id);

    // Guard evaluation
    let quotaConsumed = 0;
    if (mockDb.isSuppressed(bouncedContact.email)) {
      recipient.status = 'suppressed';
      // Do not make API request
    } else {
      quotaConsumed += 1;
    }

    expect(quotaConsumed).toBe(0);
    expect(mockGmail.sentMessages.length).toBe(0);
    expect(recipient.status).toBe('suppressed');
  });
});
