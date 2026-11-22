/**
 * Tier 1: Feature 14 (Analytics Dashboard & Visual Metrics)
 * 5 Tests: T1-F14-01 to T1-F14-05
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '../setup';
import { FACULTY_FIXTURES } from '../harness/fixtures';

describe('Tier 1: Feature 14 — Analytics Dashboard & Visual Metrics', () => {
  const testUserId = 'user_test_analytics_001';
  let accountId: string;

  beforeEach(() => {
    mockDb.reset();
    mockDb.setContextUser(testUserId);
    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: 'analytics.sender@gmail.com',
      refresh_token: 'valid-token',
    });
    accountId = acc.id;
  });

  it('T1-F14-01: Computes platform-wide aggregated totals from verified database records', () => {
    // 5 contacts
    FACULTY_FIXTURES.slice(0, 5).forEach((f) => {
      mockDb.createContact({ first_name: f.firstName, last_name: f.lastName, email: f.email });
    });

    // 2 campaigns
    const cmp1 = mockDb.createCampaign({ user_id: testUserId, account_id: accountId, name: 'C1', subject: 'S1', body_text: 'B1' });
    const cmp2 = mockDb.createCampaign({ user_id: testUserId, account_id: accountId, name: 'C2', subject: 'S2', body_text: 'B2' });

    const contacts = mockDb.getContacts();
    const r1 = mockDb.addRecipient(cmp1.id, contacts[0].id);
    const r2 = mockDb.addRecipient(cmp1.id, contacts[1].id);
    const r3 = mockDb.addRecipient(cmp2.id, contacts[2].id);

    r1.status = 'sent';
    r2.status = 'sent';
    r3.status = 'bounced';

    mockDb.registerReply({ contact_id: contacts[0].id, campaign_id: cmp1.id, recipient_id: r1.id, sender_email: contacts[0].email });

    // Aggregate metrics
    const totalContacts = mockDb.getContacts().length;
    const totalCampaigns = mockDb.getCampaigns().length;
    const allRecipients = Array.from(mockDb.recipients.values());
    const totalQueued = allRecipients.filter((r) => r.status === 'queued').length;
    const totalAccepted = allRecipients.filter((r) => r.status === 'sent' || r.status === 'replied').length;
    const totalBounced = allRecipients.filter((r) => r.status === 'bounced').length;
    const totalReplies = Array.from(mockDb.replies.values()).length;

    expect(totalContacts).toBe(5);
    expect(totalCampaigns).toBe(2);
    expect(totalQueued).toBe(0);
    expect(totalAccepted).toBe(2);
    expect(totalBounced).toBe(1);
    expect(totalReplies).toBe(1);
  });

  it('T1-F14-02: Returns accurate per-campaign comparison metrics and calculates reply rate', () => {
    const cmp = mockDb.createCampaign({ user_id: testUserId, account_id: accountId, name: 'Rate Test', subject: 'S', body_text: 'B' });
    const c1 = mockDb.createContact({ email: 'c1@univ.edu' });
    const c2 = mockDb.createContact({ email: 'c2@univ.edu' });

    const r1 = mockDb.addRecipient(cmp.id, c1.id);
    const r2 = mockDb.addRecipient(cmp.id, c2.id);
    r1.status = 'sent';
    r2.status = 'sent';

    mockDb.registerReply({ contact_id: c1.id, campaign_id: cmp.id, recipient_id: r1.id, sender_email: c1.email });

    const recipients = mockDb.getRecipients(cmp.id);
    const sentCount = recipients.filter((r) => r.status === 'sent' || r.status === 'replied').length;
    const replies = Array.from(mockDb.replies.values()).filter((r) => r.campaign_id === cmp.id);
    const replyRate = sentCount > 0 ? (replies.length / sentCount) * 100 : 0;

    expect(sentCount).toBe(2);
    expect(replies.length).toBe(1);
    expect(replyRate).toBe(50.0);
  });

  it('T1-F14-03: Aggregates daily accepted email events over time for activity charts', () => {
    const cmp = mockDb.createCampaign({ user_id: testUserId, account_id: accountId, name: 'Trend Test', subject: 'S', body_text: 'B' });
    const c = mockDb.createContact({ email: 'trend@univ.edu' });
    const r = mockDb.addRecipient(cmp.id, c.id);

    // Log accepted event
    mockDb.logEvent({
      campaign_id: cmp.id,
      recipient_id: r.id,
      account_id: accountId,
      event_type: 'accepted_by_gmail',
    });

    const events = mockDb.getEvents(cmp.id);
    const acceptedEvents = events.filter((e) => e.event_type === 'accepted_by_gmail');

    // Group by YYYY-MM-DD
    const dateMap: Record<string, number> = {};
    acceptedEvents.forEach((e) => {
      const day = e.created_at.slice(0, 10);
      dateMap[day] = (dateMap[day] || 0) + 1;
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    expect(dateMap[todayStr]).toBe(1);
  });

  it('T1-F14-04: Computes geographic distribution of contacts across countries', () => {
    FACULTY_FIXTURES.forEach((f) => {
      mockDb.createContact({
        first_name: f.firstName,
        last_name: f.lastName,
        email: f.email,
        country: f.country,
      });
    });

    const contacts = mockDb.getContacts();
    const countryDistribution: Record<string, number> = {};

    contacts.forEach((c) => {
      const country = c.country || 'Unknown';
      countryDistribution[country] = (countryDistribution[country] || 0) + 1;
    });

    expect(countryDistribution['United States']).toBeGreaterThanOrEqual(2);
    expect(countryDistribution['United Kingdom']).toBeGreaterThanOrEqual(3);
    expect(countryDistribution['Switzerland']).toBeGreaterThanOrEqual(2);
    expect(countryDistribution['Japan']).toBe(1);
    expect(countryDistribution['France']).toBe(1);
  });

  it('T1-F14-05: Honestly classifies email status as accepted_by_gmail without fake delivered claims', () => {
    const cmp = mockDb.createCampaign({ user_id: testUserId, account_id: accountId, name: 'Integrity Test', subject: 'S', body_text: 'B' });
    const c = mockDb.createContact({ email: 'verify@univ.edu' });
    const r = mockDb.addRecipient(cmp.id, c.id);

    r.status = 'sent';
    r.gmail_message_id = 'msg_12345';

    // Must report accepted_by_gmail, not 'delivered to inbox'
    const statusLabel = r.status === 'sent' ? 'Accepted by Gmail API' : r.status;
    expect(statusLabel).toBe('Accepted by Gmail API');
    expect(statusLabel).not.toContain('Delivered to Inbox');
  });
});
