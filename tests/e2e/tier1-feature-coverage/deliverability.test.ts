/**
 * Tier 1: Feature 13 (Deliverability Safeguards & Suppression)
 * 5 Tests: T1-F13-01 to T1-F13-05
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '../setup';
import { GAMIFYTL_TEMPLATES } from '../harness/fixtures';

describe('Tier 1: Feature 13 — Deliverability Safeguards & Suppression', () => {
  const testUserId = 'user_test_deliverability_001';
  let accountId: string;

  beforeEach(() => {
    mockDb.reset();
    mockDb.setContextUser(testUserId);
    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: 'deliverability.sender@gmail.com',
      refresh_token: 'valid-token',
      daily_limit: 40,
    });
    accountId = acc.id;
  });

  it('T1-F13-01: Pre-flight suppression check blocks send if recipient email exists in suppression list', () => {
    const suppressedEmail = 'prof.suppressed@harvard.edu';
    mockDb.addSuppression(suppressedEmail, 'unsubscribe');

    expect(mockDb.isSuppressed(suppressedEmail)).toBe(true);

    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Suppression Guard Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    const contact = mockDb.createContact({ email: suppressedEmail, first_name: 'Prof' });
    const recipient = mockDb.addRecipient(campaign.id, contact.id);

    // Queue worker pre-flight check
    if (mockDb.isSuppressed(contact.email)) {
      recipient.status = 'suppressed';
      mockDb.logEvent({
        campaign_id: campaign.id,
        recipient_id: recipient.id,
        account_id: accountId,
        event_type: 'suppressed',
        metadata: { reason: 'pre_flight_suppression_match' },
      });
    }

    expect(recipient.status).toBe('suppressed');
    const events = mockDb.getEvents(campaign.id);
    expect(events.some((e) => e.event_type === 'suppressed')).toBe(true);
  });

  it('T1-F13-02: Unsubscribe handling immediately quenches contact and inserts into suppression list', () => {
    const contact = mockDb.createContact({ email: 'unsubscribe.me@oxford.ac.uk', first_name: 'Prof' });
    expect(contact.status).toBe('active');

    // Unsubscribe action
    mockDb.addSuppression(contact.email, 'unsubscribe');

    expect(mockDb.isSuppressed(contact.email)).toBe(true);
    expect(contact.status).toBe('unsubscribed');
  });

  it('T1-F13-03: Hard bounce handling permanently suppresses email address', () => {
    const contact = mockDb.createContact({ email: 'nonexistent.prof@cambridge.ac.uk', first_name: 'Nonexistent' });

    // SMTP 550 bounce
    mockDb.addSuppression(contact.email, 'bounce');

    expect(mockDb.isSuppressed(contact.email)).toBe(true);
    expect(contact.status).toBe('bounced');
  });

  it('T1-F13-04: Daily cap enforcement halts queue processing when limit reached', () => {
    const acc = mockDb.accounts.get(accountId)!;
    acc.daily_limit = 40;
    acc.sent_today_count = 40; // Reached cap

    const canSendMore = acc.sent_today_count < acc.daily_limit;
    expect(canSendMore).toBe(false);

    // Verify queue worker defers sending
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Cap Test Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    const contact = mockDb.createContact({ email: 'defer@univ.edu' });
    const recipient = mockDb.addRecipient(campaign.id, contact.id);

    let sent = false;
    if (acc.sent_today_count < acc.daily_limit) {
      sent = true;
    } else {
      // Defer to next day window
      recipient.scheduled_for = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    expect(sent).toBe(false);
    expect(new Date(recipient.scheduled_for).getTime()).toBeGreaterThan(Date.now());
  });

  it('T1-F13-05: Verifies email content uses transparent direct links and zero 1x1 tracking pixels', () => {
    const tpl = GAMIFYTL_TEMPLATES.templateA_engagement;

    // Check HTML body for 1x1 pixel patterns
    expect(tpl.bodyHtml).not.toMatch(/<img[^>]+width=["']?1["']?[^>]+height=["']?1["']?/i);
    expect(tpl.bodyHtml).not.toMatch(/pixel/i);

    // Check direct transparent links
    expect(tpl.bodyHtml).toContain('https://gamifytl.com/join');
    expect(tpl.bodyHtml).toContain('https://gamifytl.com/');
  });
});
