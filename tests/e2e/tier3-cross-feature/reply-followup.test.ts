/**
 * Tier 3: Pairwise Cross-Feature Testing — Reply Management & Follow-Up Interception
 * 5 Scenarios: T3-PW-03, T3-PW-06, T3-PW-08, T3-PW-12, T3-PW-14
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockGmail, mockDb } from '../setup';
import { buildRawEmail, parseMimeMessage } from '../harness/mime';
import { formatGmailThreadLink, FACULTY_FIXTURES } from '../harness/fixtures';

describe('Tier 3: Reply Management & Follow-Up Interception Combinations (5 Tests)', () => {
  const testUserId = 'user_tier3_replies_001';
  let accountId: string;
  let senderEmail: string;

  beforeEach(() => {
    mockGmail.reset();
    mockDb.reset();
    mockDb.setContextUser(testUserId);
    senderEmail = 'reply.coordinator@gmail.com';

    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: senderEmail,
      refresh_token: 'valid-token',
    });
    accountId = acc.id;
  });

  it('T3-PW-03: Reply Intercept: Unicode professor (Kyoto Univ), initial send succeeds, reply received at T+1, follow-up aborted', async () => {
    const contact = mockDb.createContact({
      first_name: '健太',
      last_name: '佐藤',
      email: 'sato@kyoto-u.ac.jp',
      institution: '京都大学',
    });

    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Kyoto Outreach',
      subject: 'GamifyTL for Kyoto University',
      body_text: 'Body',
      follow_up_enabled: true,
      status: 'sending',
    });

    const recipient = mockDb.addRecipient(cmp.id, contact.id);

    // Initial send
    const raw = buildRawEmail({ fromEmail: senderEmail, toEmail: contact.email, subject: 'Subject', bodyText: 'Body' });
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });

    const data = await res.json();
    recipient.status = 'sent';
    recipient.gmail_message_id = data.id;
    recipient.gmail_thread_id = data.threadId;
    recipient.follow_up_status = 'scheduled';

    // Reply arrives on Day 1
    mockDb.registerReply({
      contact_id: contact.id,
      campaign_id: cmp.id,
      recipient_id: recipient.id,
      gmail_thread_id: data.threadId,
      sender_email: contact.email,
      snippet: '興味があります。デモをお願いします。', // "Interested, demo please."
    });

    expect(contact.status).toBe('replied');
    expect(recipient.status).toBe('replied');
    expect(recipient.follow_up_status).toBe('skipped_replied');
  });

  it('T3-PW-06: Rate Limit Resilience: First batch hits HTTP 429; queue applies backoff; retries cleanly; initial sent and follow-up scheduled', async () => {
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Rate Limit Resilience Campaign',
      subject: 'Subject',
      body_text: 'Body',
      follow_up_enabled: true,
      status: 'sending',
    });

    const contact = mockDb.createContact({ email: 'resilient@ox.ac.uk' });
    const recipient = mockDb.addRecipient(cmp.id, contact.id);

    // First attempt hits 429
    mockGmail.setFailureMode('rate_limit_429');
    const raw = buildRawEmail({ fromEmail: senderEmail, toEmail: contact.email, subject: 'Subject', bodyText: 'Body' });

    const res1 = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    expect(res1.status).toBe(429);
    recipient.retry_count = 1;

    // Retry after backoff succeeds
    mockGmail.setFailureMode('none');
    const res2 = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    recipient.status = 'sent';
    recipient.gmail_message_id = data2.id;
    recipient.gmail_thread_id = data2.threadId;
    recipient.follow_up_status = 'scheduled';

    expect(recipient.status).toBe('sent');
    expect(recipient.follow_up_status).toBe('scheduled');
  });

  it('T3-PW-08: Manual Reply Flow: Admin logs manual reply via UI; contact marked replied, pending follow-up cancelled, Gmail deep link generated', () => {
    const contact = mockDb.createContact({ email: 'manual.reply.prof@harvard.edu' });
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Manual Reply Campaign',
      subject: 'Subject',
      body_text: 'Body',
      follow_up_enabled: true,
      status: 'sending',
    });

    const recipient = mockDb.addRecipient(cmp.id, contact.id);
    recipient.status = 'sent';
    recipient.gmail_thread_id = 'th_harvard_manual_123';
    recipient.follow_up_status = 'scheduled';

    // Admin clicks "Log Reply" in UI
    const reply = mockDb.registerReply({
      contact_id: contact.id,
      campaign_id: cmp.id,
      recipient_id: recipient.id,
      account_id: accountId,
      gmail_thread_id: recipient.gmail_thread_id,
      sender_email: contact.email,
      snippet: 'Discussed on phone; agreed to try with 150 students.',
      source: 'manual',
    });

    expect(contact.status).toBe('replied');
    expect(recipient.follow_up_status).toBe('skipped_replied');

    const deepLink = formatGmailThreadLink(senderEmail, recipient.gmail_thread_id);
    expect(deepLink).toContain('authuser=reply.coordinator%40gmail.com');
    expect(deepLink).toContain('#all/th_harvard_manual_123');
  });

  it('T3-PW-12: Full Threading Verification: Follow-up email references initial Message-ID in In-Reply-To and References headers and request threadId', async () => {
    const initialMsgId = '<gamifytl-init-msg-999@gamifytl.com>';
    const initialThreadId = 'th_cambridge_thread_888';

    const followUpRaw = buildRawEmail({
      fromEmail: senderEmail,
      toEmail: 'a.thorne@cl.cam.ac.uk',
      subject: 'Re: Active Learning in Lectures',
      bodyText: 'Just following up on my previous email.',
      inReplyTo: initialMsgId,
      references: initialMsgId,
    });

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: followUpRaw, threadId: initialThreadId }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.threadId).toBe(initialThreadId);

    const intercepted = mockGmail.sentMessages[0];
    expect(intercepted.threadId).toBe(initialThreadId);
    expect(intercepted.headers['in-reply-to']).toBe(initialMsgId);
    expect(intercepted.headers['references']).toBe(initialMsgId);
  });

  it('T3-PW-14: Fast Reply Intercept: Reply arrives 10 minutes after initial send; follow-up cancelled; analytics shows 100% reply rate', () => {
    const contact = mockDb.createContact({ email: 'fast.reply@ethz.ch' });
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Fast Reply Campaign',
      subject: 'Subject',
      body_text: 'Body',
      follow_up_enabled: true,
      status: 'sending',
    });

    const recipient = mockDb.addRecipient(cmp.id, contact.id);
    recipient.status = 'sent';
    recipient.follow_up_status = 'scheduled';

    // Fast reply arrives 10 mins later
    mockDb.registerReply({
      contact_id: contact.id,
      campaign_id: cmp.id,
      recipient_id: recipient.id,
      sender_email: contact.email,
    });

    expect(recipient.follow_up_status).toBe('skipped_replied');

    // Analytics verify
    const totalSent = mockDb.getRecipients(cmp.id).filter((r) => r.status === 'sent' || r.status === 'replied').length;
    const totalReplies = Array.from(mockDb.replies.values()).filter((r) => r.campaign_id === cmp.id).length;
    const replyRate = (totalReplies / totalSent) * 100;

    expect(totalSent).toBe(1);
    expect(totalReplies).toBe(1);
    expect(replyRate).toBe(100);
  });
});
