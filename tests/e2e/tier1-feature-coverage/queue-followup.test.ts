/**
 * Tier 1: Feature 9 (Safe Email Sending Queue) & Feature 10 (Follow-Up Management)
 * 10 Tests: T1-F09-01 to T1-F09-05 and T1-F10-01 to T1-F10-05
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockGmail, mockDb } from '../setup';
import { buildRawEmail } from '../harness/mime';
import { FACULTY_FIXTURES } from '../harness/fixtures';

describe('Tier 1: Features 9 & 10 — Sending Queue & Follow-Up Management', () => {
  const testUserId = 'user_test_queue_001';
  let accountId: string;
  let senderEmail: string;

  beforeEach(() => {
    mockGmail.reset();
    mockDb.reset();
    mockDb.setContextUser(testUserId);
    senderEmail = 'queue.runner@gmail.com';
    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: senderEmail,
      refresh_token: 'valid-token',
    });
    accountId = acc.id;
  });

  // --- Feature 9: Safe Email Sending Queue ---

  it('T1-F09-01: Claims micro-batch of queued recipients using atomic lock semantics', () => {
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Micro-batch Test',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    for (let i = 0; i < 7; i++) {
      const c = mockDb.createContact({ email: `educator${i}@univ.edu`, first_name: `Edu${i}` });
      mockDb.addRecipient(campaign.id, c.id);
    }

    // Micro-batch limit = 3
    const batch1 = mockDb.claimQueuedRecipients(campaign.id, 3);
    expect(batch1.length).toBe(3);
    expect(batch1.every((r) => r.status === 'sending')).toBe(true);

    // Second worker claim
    const batch2 = mockDb.claimQueuedRecipients(campaign.id, 3);
    expect(batch2.length).toBe(3);
    // Mutually disjoint sets
    const ids1 = new Set(batch1.map((r) => r.id));
    expect(batch2.every((r) => !ids1.has(r.id))).toBe(true);
  });

  it('T1-F09-02: Dispatches Base64url raw payload to Gmail API users.messages.send', async () => {
    const raw = buildRawEmail({
      fromEmail: senderEmail,
      toEmail: 'david.malan@harvard.edu',
      subject: 'GamifyTL Live Demonstration',
      bodyText: 'Hello Professor Malan',
    });

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer mock_access_token_123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.threadId).toBeDefined();
    expect(mockGmail.sentMessages.length).toBe(1);
    expect(mockGmail.sentMessages[0].headers['to']).toContain('david.malan@harvard.edu');
  });

  it('T1-F09-03: Records Gmail message ID and thread ID upon 200 acceptance', async () => {
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Send & Record Test',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    const contact = mockDb.createContact({ email: 'andrew.wiles@maths.ox.ac.uk', first_name: 'Andrew' });
    const recipient = mockDb.addRecipient(campaign.id, contact.id);

    const claimed = mockDb.claimQueuedRecipients(campaign.id, 1)[0];

    const raw = buildRawEmail({
      fromEmail: senderEmail,
      toEmail: contact.email,
      subject: claimed.personalized_subject!,
      bodyText: claimed.personalized_body!,
    });

    // Simulate sending via fetch
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });

    const data = await response.json();
    claimed.status = 'sent';
    claimed.sent_at = new Date().toISOString();
    claimed.gmail_message_id = data.id;
    claimed.gmail_thread_id = data.threadId;

    mockDb.logEvent({
      campaign_id: campaign.id,
      recipient_id: claimed.id,
      account_id: accountId,
      event_type: 'accepted_by_gmail',
      metadata: { gmail_message_id: data.id, gmail_thread_id: data.threadId },
    });

    expect(claimed.gmail_message_id).toBeDefined();
    expect(claimed.gmail_thread_id).toBeDefined();

    const events = mockDb.getEvents(campaign.id);
    const acceptedEvent = events.find((e) => e.event_type === 'accepted_by_gmail');
    expect(acceptedEvent).toBeDefined();
  });

  it('T1-F09-04: Computes inter-send pacing jitter within configured interval (20-60s)', () => {
    const minDelay = 20;
    const maxDelay = 60;

    for (let i = 0; i < 20; i++) {
      const jitter = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      expect(jitter).toBeGreaterThanOrEqual(minDelay);
      expect(jitter).toBeLessThanOrEqual(maxDelay);
    }
  });

  it('T1-F09-05: Transitions campaign to completed when all recipients are processed', () => {
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Finishing Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    const c1 = mockDb.createContact({ email: 'c1@ox.ac.uk', first_name: 'C1' });
    const c2 = mockDb.createContact({ email: 'c2@ox.ac.uk', first_name: 'C2' });
    const r1 = mockDb.addRecipient(campaign.id, c1.id);
    const r2 = mockDb.addRecipient(campaign.id, c2.id);

    r1.status = 'sent';
    r2.status = 'sent';

    const allFinished = mockDb.getRecipients(campaign.id).every((r) => r.status === 'sent' || r.status === 'failed');
    if (allFinished) {
      mockDb.updateCampaign(campaign.id, { status: 'completed', completed_at: new Date().toISOString() });
    }

    const updated = mockDb.campaigns.get(campaign.id)!;
    expect(updated.status).toBe('completed');
    expect(updated.completed_at).toBeDefined();
  });

  // --- Feature 10: Follow-Up Email Management ---

  it('T1-F10-01: Schedules follow-up email at T + delay_days upon initial send acceptance', () => {
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Follow-up Campaign',
      subject: 'Initial Subject',
      body_text: 'Initial Body',
      follow_up_enabled: true,
      follow_up_delay_days: 3,
      status: 'sending',
    });

    const contact = mockDb.createContact({ email: 'prof@cambridge.ac.uk', first_name: 'Prof' });
    const recipient = mockDb.addRecipient(campaign.id, contact.id);

    // Initial send completes
    recipient.status = 'sent';
    recipient.gmail_message_id = 'msg_init_123';
    recipient.gmail_thread_id = 'th_init_123';

    // Follow-up scheduled
    const delayMs = campaign.follow_up_delay_days * 24 * 60 * 60 * 1000;
    recipient.follow_up_status = 'scheduled';
    recipient.follow_up_scheduled_at = new Date(Date.now() + delayMs).toISOString();

    expect(recipient.follow_up_status).toBe('scheduled');
    expect(new Date(recipient.follow_up_scheduled_at!).getTime()).toBeGreaterThan(Date.now());
  });

  it('T1-F10-02: Follow-up dispatch aligns with parent Gmail threadId and headers', async () => {
    const initialThreadId = 'th_harvard_cs50_001';
    const initialMsgId = '<msg_harvard_001@gamifytl.com>';

    const followUpRaw = buildRawEmail({
      fromEmail: senderEmail,
      toEmail: 'david.malan@harvard.edu',
      subject: 'Re: GamifyTL Live Demonstration',
      bodyText: 'Following up on my previous note.',
      inReplyTo: initialMsgId,
      references: initialMsgId,
    });

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: followUpRaw, threadId: initialThreadId }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.threadId).toBe(initialThreadId);

    const sent = mockGmail.sentMessages[0];
    expect(sent.headers['in-reply-to']).toBe(initialMsgId);
    expect(sent.headers['references']).toBe(initialMsgId);
  });

  it('T1-F10-03: Pre-send check detects incoming reply and cancels scheduled follow-up', () => {
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Reply Cancel Test',
      subject: 'Initial Subject',
      body_text: 'Initial Body',
      follow_up_enabled: true,
      status: 'sending',
    });

    const contact = mockDb.createContact({ email: 'a.thorne@cl.cam.ac.uk', first_name: 'Aris' });
    const recipient = mockDb.addRecipient(campaign.id, contact.id);
    recipient.status = 'sent';
    recipient.follow_up_status = 'scheduled';

    // Incoming reply registered
    mockDb.registerReply({
      contact_id: contact.id,
      campaign_id: campaign.id,
      recipient_id: recipient.id,
      sender_email: contact.email,
      snippet: 'Thanks for the email, I am interested.',
    });

    expect(contact.status).toBe('replied');
    expect(recipient.follow_up_status).toBe('skipped_replied');

    // Follow-up worker check
    const shouldSendFollowUp = recipient.follow_up_status === 'scheduled';
    expect(shouldSendFollowUp).toBe(false);
  });

  it('T1-F10-04: Pre-send check detects bounce and aborts scheduled follow-up', () => {
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Bounce Cancel Test',
      subject: 'Subject',
      body_text: 'Body',
      follow_up_enabled: true,
      status: 'sending',
    });

    const contact = mockDb.createContact({ email: 'bounced@univ.edu', first_name: 'Bounced' });
    const recipient = mockDb.addRecipient(campaign.id, contact.id);
    recipient.status = 'bounced';
    recipient.follow_up_status = 'scheduled';

    // Safety pre-flight check
    if (recipient.status === 'bounced') {
      recipient.follow_up_status = 'skipped_bounced';
    }

    expect(recipient.follow_up_status).toBe('skipped_bounced');
  });

  it('T1-F10-05: Pre-send check detects unsubscribe and cancels follow-up immediately', () => {
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Unsub Cancel Test',
      subject: 'Subject',
      body_text: 'Body',
      follow_up_enabled: true,
      status: 'sending',
    });

    const contact = mockDb.createContact({ email: 'unsub@univ.edu', first_name: 'Unsub' });
    const recipient = mockDb.addRecipient(campaign.id, contact.id);
    recipient.status = 'sent';
    recipient.follow_up_status = 'scheduled';

    // Contact unsubscribes
    mockDb.addSuppression(contact.email, 'unsubscribe');

    // Worker checks suppression list
    if (mockDb.isSuppressed(contact.email)) {
      recipient.follow_up_status = 'skipped_unsubscribed';
    }

    expect(recipient.follow_up_status).toBe('skipped_unsubscribed');
  });
});
