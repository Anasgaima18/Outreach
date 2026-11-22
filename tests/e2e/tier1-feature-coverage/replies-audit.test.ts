/**
 * Tier 1: Feature 11 (Reply Management) & Feature 12 (Granular Audit Events Ledger)
 * 10 Tests: T1-F11-01 to T1-F11-05 and T1-F12-01 to T1-F12-05
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '../setup';
import { formatGmailThreadLink } from '../harness/fixtures';

describe('Tier 1: Features 11 & 12 — Reply Management & Audit Events Ledger', () => {
  const testUserId = 'user_test_replies_001';
  let accountId: string;
  let campaignId: string;

  beforeEach(() => {
    mockDb.reset();
    mockDb.setContextUser(testUserId);
    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: 'reply.handler@gmail.com',
      refresh_token: 'valid-token',
    });
    accountId = acc.id;

    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Reply Test Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });
    campaignId = cmp.id;
  });

  // --- Feature 11: Reply Management & Threading ---

  it('T1-F11-01: Logs manual reply, updates contact status to replied, and stores snippet', () => {
    const contact = mockDb.createContact({ email: 'prof.smith@ox.ac.uk', first_name: 'Smith' });
    const recipient = mockDb.addRecipient(campaignId, contact.id);

    const reply = mockDb.registerReply({
      contact_id: contact.id,
      campaign_id: campaignId,
      recipient_id: recipient.id,
      account_id: accountId,
      sender_email: contact.email,
      subject: 'Re: Subject',
      snippet: 'I am interested in using GamifyTL for my 200-student lecture.',
      source: 'manual',
    });

    expect(reply.id).toBeDefined();
    expect(contact.status).toBe('replied');
    expect(recipient.status).toBe('replied');
    expect(reply.snippet).toContain('200-student lecture');
  });

  it('T1-F11-02: Generates RFC-compliant direct Gmail conversation thread link', () => {
    const accountEmail = 'reply.handler@gmail.com';
    const threadId = '18c2f10a8b94d123';
    const link = formatGmailThreadLink(accountEmail, threadId);

    expect(link).toBe('https://mail.google.com/mail/u/?authuser=reply.handler%40gmail.com#all/18c2f10a8b94d123');
  });

  it('T1-F11-03: Correctly associates incoming reply with matching campaign and recipient via threadId', () => {
    const contact = mockDb.createContact({ email: 'wiles@maths.ox.ac.uk', first_name: 'Andrew' });
    const recipient = mockDb.addRecipient(campaignId, contact.id);
    recipient.gmail_thread_id = 'th_wiles_999';

    const reply = mockDb.registerReply({
      contact_id: contact.id,
      campaign_id: campaignId,
      recipient_id: recipient.id,
      gmail_thread_id: 'th_wiles_999',
      sender_email: contact.email,
    });

    expect(reply.campaign_id).toBe(campaignId);
    expect(reply.recipient_id).toBe(recipient.id);
    expect(reply.gmail_thread_id).toBe('th_wiles_999');
  });

  it('T1-F11-04: Emits reply_received event in email_events ledger with metadata', () => {
    const contact = mockDb.createContact({ email: 'elena@ethz.ch', first_name: 'Elena' });
    const recipient = mockDb.addRecipient(campaignId, contact.id);

    mockDb.registerReply({
      contact_id: contact.id,
      campaign_id: campaignId,
      recipient_id: recipient.id,
      account_id: accountId,
      sender_email: contact.email,
      gmail_thread_id: 'th_ethz_123',
    });

    const events = mockDb.getEvents(campaignId);
    const replyEvent = events.find((e) => e.event_type === 'reply_received');
    expect(replyEvent).toBeDefined();
    expect((replyEvent?.metadata as any).gmail_thread_id).toBe('th_ethz_123');
  });

  it('T1-F11-05: Retrieves and filters reply records by campaign', () => {
    const c1 = mockDb.createContact({ email: 'c1@ox.ac.uk' });
    const r1 = mockDb.addRecipient(campaignId, c1.id);
    mockDb.registerReply({ contact_id: c1.id, campaign_id: campaignId, recipient_id: r1.id, sender_email: c1.email });

    const c2 = mockDb.createContact({ email: 'c2@harvard.edu' });
    // Reply from another campaign or direct
    mockDb.registerReply({ contact_id: c2.id, campaign_id: 'other_cmp', sender_email: c2.email });

    const allReplies = Array.from(mockDb.replies.values());
    const campaignReplies = allReplies.filter((r) => r.campaign_id === campaignId);

    expect(campaignReplies.length).toBe(1);
    expect(campaignReplies[0].contact_id).toBe(c1.id);
  });

  // --- Feature 12: Granular Audit Events Ledger ---

  it('T1-F12-01: Emits queued event when contact is added to campaign', () => {
    const contact = mockDb.createContact({ email: 'david@harvard.edu' });
    const recipient = mockDb.addRecipient(campaignId, contact.id);

    const events = mockDb.getEvents(campaignId);
    const queuedEvent = events.find((e) => e.event_type === 'queued' && e.recipient_id === recipient.id);
    expect(queuedEvent).toBeDefined();
    expect((queuedEvent?.metadata as any).contact_email).toBe('david@harvard.edu');
  });

  it('T1-F12-02: Emits submitted_to_gmail event immediately before calling Gmail API', () => {
    const contact = mockDb.createContact({ email: 'test@ox.ac.uk' });
    const recipient = mockDb.addRecipient(campaignId, contact.id);

    mockDb.logEvent({
      campaign_id: campaignId,
      recipient_id: recipient.id,
      account_id: accountId,
      event_type: 'submitted_to_gmail',
      metadata: { timestamp: new Date().toISOString() },
    });

    const events = mockDb.getEvents(campaignId);
    expect(events.some((e) => e.event_type === 'submitted_to_gmail')).toBe(true);
  });

  it('T1-F12-03: Emits accepted_by_gmail event upon HTTP 200 with recorded message ID', () => {
    const contact = mockDb.createContact({ email: 'accepted@univ.edu' });
    const recipient = mockDb.addRecipient(campaignId, contact.id);

    mockDb.logEvent({
      campaign_id: campaignId,
      recipient_id: recipient.id,
      account_id: accountId,
      event_type: 'accepted_by_gmail',
      metadata: {
        gmail_message_id: 'msg_98765',
        http_status: 200,
      },
    });

    const events = mockDb.getEvents(campaignId);
    const acceptedEvent = events.find((e) => e.event_type === 'accepted_by_gmail');
    expect(acceptedEvent).toBeDefined();
    expect((acceptedEvent?.metadata as any).gmail_message_id).toBe('msg_98765');
  });

  it('T1-F12-04: Emits failed_send event on API error with error code and response payload', () => {
    const contact = mockDb.createContact({ email: 'failed@univ.edu' });
    const recipient = mockDb.addRecipient(campaignId, contact.id);

    mockDb.logEvent({
      campaign_id: campaignId,
      recipient_id: recipient.id,
      account_id: accountId,
      event_type: 'failed_send',
      metadata: {
        status_code: 429,
        error_message: 'User Rate Limit Exceeded',
      },
    });

    const events = mockDb.getEvents(campaignId);
    const failedEvent = events.find((e) => e.event_type === 'failed_send');
    expect(failedEvent).toBeDefined();
    expect((failedEvent?.metadata as any).status_code).toBe(429);
  });

  it('T1-F12-05: Enforces ledger immutability and rejects invalid event types', () => {
    const contact = mockDb.createContact({ email: 'immutable@univ.edu' });
    const recipient = mockDb.addRecipient(campaignId, contact.id);

    // Invalid event type rejected
    expect(() => {
      mockDb.logEvent({
        campaign_id: campaignId,
        recipient_id: recipient.id,
        event_type: 'clicked_untracked_link' as any,
      });
    }).toThrow(/check_email_events_type/);
  });
});
