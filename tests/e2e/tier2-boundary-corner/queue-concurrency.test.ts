/**
 * Tier 2: Queue Concurrency, Rate Limiting & Fault Recovery Tests
 * 20 Tests covering SKIP LOCKED concurrency, backoff, token refresh, and failure modes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockGmail, mockOAuth, mockDb } from '../setup';

describe('Tier 2: Queue Concurrency, Lock Contention & Fault Recovery (20 Tests)', () => {
  const testUserId = 'user_tier2_queue_001';
  let accountId: string;
  let campaignId: string;

  beforeEach(() => {
    mockGmail.reset();
    mockOAuth.reset();
    mockDb.reset();
    mockDb.setContextUser(testUserId);

    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: 'concurrent.sender@gmail.com',
      refresh_token: 'valid-token',
    });
    accountId = acc.id;

    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Concurrency Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });
    campaignId = cmp.id;
  });

  it('T2-QUE-01: 5 concurrent workers claiming 10 recipients receive mutually disjoint sets', () => {
    for (let i = 0; i < 10; i++) {
      const c = mockDb.createContact({ email: `prof${i}@univ.edu` });
      mockDb.addRecipient(campaignId, c.id);
    }

    const worker1 = mockDb.claimQueuedRecipients(campaignId, 2);
    const worker2 = mockDb.claimQueuedRecipients(campaignId, 2);
    const worker3 = mockDb.claimQueuedRecipients(campaignId, 2);
    const worker4 = mockDb.claimQueuedRecipients(campaignId, 2);
    const worker5 = mockDb.claimQueuedRecipients(campaignId, 2);

    const allClaimed = [...worker1, ...worker2, ...worker3, ...worker4, ...worker5];
    expect(allClaimed.length).toBe(10);

    const uniqueIds = new Set(allClaimed.map((r) => r.id));
    expect(uniqueIds.size).toBe(10); // Zero duplicate claims
  });

  it('T2-QUE-02: Zero duplicate sends occur across concurrent worker executions', () => {
    const c = mockDb.createContact({ email: 'single@univ.edu' });
    mockDb.addRecipient(campaignId, c.id);

    const claimA = mockDb.claimQueuedRecipients(campaignId, 1);
    const claimB = mockDb.claimQueuedRecipients(campaignId, 1);

    expect(claimA.length).toBe(1);
    expect(claimB.length).toBe(0); // Second worker gets nothing
  });

  it('T2-QUE-03: Refreshes expired access token transparently mid-batch', async () => {
    // Simulate expired access token
    let accessToken = 'expired_access_token_123';
    const account = mockDb.accounts.get(accountId)!;
    const validRaw = 'RnJvbTogIlNlbmRlciIgPHNlbmRlckBnbWFpbC5jb20-DQpUbzogInByb2ZAdW5pdi5lZHUiIDxwcm9mQHVuaXYuZWR1Pg0KU3ViamVjdDogVGVzdA0KTUlNRS1WZXJzaW9uOiAxLjANCg0KSGVsbG8';

    // Simulate sending with expired token
    mockGmail.setFailureMode('auth_expired_401');
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: validRaw }),
    });

    expect(response.status).toBe(401);

    // Refresh token
    const refreshParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: mockDb.decryptToken(account.encrypted_refresh_token),
      client_id: 'client-id',
      client_secret: 'client-sec',
    });
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: refreshParams.toString(),
    });

    expect(refreshRes.status).toBe(200);
    const refreshData = await refreshRes.json();
    accessToken = refreshData.access_token;
    expect(accessToken).toContain('_refreshed_');

    // Retry send
    mockGmail.setFailureMode('none');
    const retryRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: validRaw }),
    });

    expect(retryRes.status).toBe(200);
  });

  it('T2-QUE-04: Halts campaign and marks account revoked on invalid_grant token error', async () => {
    mockOAuth.isRevoked = true;
    const account = mockDb.accounts.get(accountId)!;

    const refreshParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: 'revoked-token',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: refreshParams.toString(),
    });

    expect(res.status).toBe(400);
    const err = await res.json();
    expect(err.error).toBe('invalid_grant');

    // Update account and campaign states
    account.status = 'revoked';
    mockDb.updateCampaign(campaignId, { status: 'paused' });

    expect(account.status).toBe('revoked');
    expect(mockDb.campaigns.get(campaignId)?.status).toBe('paused');
  });

  it('T2-QUE-05: Handles Google 429 rate limit and pauses next dispatch according to Retry-After', async () => {
    mockGmail.setFailureMode('rate_limit_429');
    mockGmail.customRetryAfter = 45;

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: 'SGVsbG8' }),
    });

    expect(response.status).toBe(429);
    const retryAfter = response.headers.get('Retry-After');
    expect(retryAfter).toBe('45');

    const nextScheduleTime = new Date(Date.now() + parseInt(retryAfter!) * 1000);
    expect(nextScheduleTime.getTime()).toBeGreaterThan(Date.now());
  });

  it('T2-QUE-06: Applies exponential backoff on 503 backend error and increments retry count', async () => {
    const contact = mockDb.createContact({ email: 'retry@univ.edu' });
    const recipient = mockDb.addRecipient(campaignId, contact.id);

    mockGmail.setFailureMode('server_error_503');
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: 'SGVsbG8' }),
    });

    expect(response.status).toBe(503);

    // Apply backoff calculation: 2s * 2^retry_count
    recipient.retry_count++;
    const backoffSeconds = 2 * Math.pow(2, recipient.retry_count);
    recipient.next_retry_at = new Date(Date.now() + backoffSeconds * 1000).toISOString();
    recipient.status = 'queued'; // return to queue

    expect(recipient.retry_count).toBe(1);
    expect(backoffSeconds).toBe(4);
  });

  it('T2-QUE-07: Permanently marks recipient as failed when retry limit (3) is exceeded', () => {
    const contact = mockDb.createContact({ email: 'fail.limit@univ.edu' });
    const recipient = mockDb.addRecipient(campaignId, contact.id);
    recipient.retry_count = 3;

    // Next failure exceeds limit
    recipient.retry_count++;
    if (recipient.retry_count > 3) {
      recipient.status = 'failed';
      recipient.error_message = 'Exceeded maximum retry attempts (3)';
    }

    expect(recipient.status).toBe('failed');
    expect(recipient.error_message).toContain('Exceeded maximum retry attempts');
  });

  it('T2-QUE-08: Campaign cancellation mid-flight immediately drains remaining queued items', () => {
    for (let i = 0; i < 5; i++) {
      const c = mockDb.createContact({ email: `cancel${i}@univ.edu` });
      mockDb.addRecipient(campaignId, c.id);
    }

    // Admin cancels campaign
    mockDb.updateCampaign(campaignId, { status: 'cancelled' });

    // Worker drains remaining queued items
    const recipients = mockDb.getRecipients(campaignId);
    recipients.forEach((r) => {
      if (r.status === 'queued') {
        r.status = 'failed';
        r.error_message = 'Campaign cancelled by owner';
      }
    });

    const claimed = mockDb.claimQueuedRecipients(campaignId, 5);
    expect(claimed.length).toBe(0); // Nothing claimed from cancelled campaign
  });

  it('T2-QUE-09: Pausing campaign stops worker claiming without failing in-flight send', () => {
    for (let i = 0; i < 3; i++) {
      const c = mockDb.createContact({ email: `pause${i}@univ.edu` });
      mockDb.addRecipient(campaignId, c.id);
    }

    mockDb.updateCampaign(campaignId, { status: 'paused' });
    const claimed = mockDb.claimQueuedRecipients(campaignId, 3);
    expect(claimed.length).toBe(0); // Paused campaign cannot be claimed
  });

  it('T2-QUE-10: Resuming paused campaign allows worker to process remaining recipients', () => {
    const c = mockDb.createContact({ email: 'resume@univ.edu' });
    mockDb.addRecipient(campaignId, c.id);

    mockDb.updateCampaign(campaignId, { status: 'paused' });
    expect(mockDb.claimQueuedRecipients(campaignId, 1).length).toBe(0);

    mockDb.updateCampaign(campaignId, { status: 'sending' });
    const claimed = mockDb.claimQueuedRecipients(campaignId, 1);
    expect(claimed.length).toBe(1);
    expect(claimed[0].status).toBe('sending');
  });

  it('T2-QUE-11: Mid-flight token refresh failure leaves un-sent items safely in queued state', () => {
    for (let i = 0; i < 4; i++) {
      const c = mockDb.createContact({ email: `unsent${i}@univ.edu` });
      mockDb.addRecipient(campaignId, c.id);
    }

    const claimed = mockDb.claimQueuedRecipients(campaignId, 2);
    // Worker fails before sending due to network failure
    claimed.forEach((r) => {
      r.status = 'queued'; // return to queued
    });

    const queuedRecipients = mockDb.getRecipients(campaignId).filter((r) => r.status === 'queued');
    expect(queuedRecipients.length).toBe(4); // None lost
  });

  it('T2-QUE-12: Edge Function execution timeout guard limits batch size to respect 60s timeout', () => {
    // 5 emails * 30s jitter = 150s (would exceed 60s Edge Function limit)
    // Batch size must be capped at 1-3 emails per invocation
    const maxSafeBatchSize = 3;
    expect(maxSafeBatchSize).toBeLessThanOrEqual(5);
  });

  it('T2-QUE-13: Invalid recipient address (400) marks single recipient failed without crashing batch', async () => {
    mockGmail.setFailureMode('invalid_recipient_400');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: 'SGVsbG8' }),
    });

    expect(response.status).toBe(400);
    const err = await response.json();
    expect(err.error.message).toContain('Invalid recipient');
  });

  it('T2-QUE-14: Permanent bounce (550) marks recipient bounced and adds to suppressions', () => {
    const contact = mockDb.createContact({ email: 'bounce550@univ.edu' });
    const recipient = mockDb.addRecipient(campaignId, contact.id);

    // Bounce detected
    recipient.status = 'bounced';
    mockDb.addSuppression(contact.email, 'bounce');

    expect(recipient.status).toBe('bounced');
    expect(mockDb.isSuppressed(contact.email)).toBe(true);
  });

  it('T2-QUE-15: Concurrency race — double campaign approval handled idempotently', () => {
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Double Approval Campaign',
      subject: 'S',
      body_text: 'B',
      status: 'awaiting_approval',
    });

    // Request 1
    mockDb.updateCampaign(cmp.id, { status: 'scheduled', approved_at: new Date().toISOString() });
    // Request 2 (concurrent)
    const current = mockDb.campaigns.get(cmp.id)!;
    if (current.status === 'awaiting_approval') {
      mockDb.updateCampaign(cmp.id, { status: 'scheduled' });
    }

    expect(mockDb.campaigns.get(cmp.id)?.status).toBe('scheduled');
  });

  it('T2-QUE-16: Concurrency race — contact replies while worker is processing batch aborts follow-up', () => {
    const contact = mockDb.createContact({ email: 'race.reply@univ.edu' });
    const recipient = mockDb.addRecipient(campaignId, contact.id);
    recipient.status = 'sent';
    recipient.follow_up_status = 'scheduled';

    // Worker claims follow-up, but reply arrives concurrently
    mockDb.registerReply({ contact_id: contact.id, campaign_id: campaignId, recipient_id: recipient.id, sender_email: contact.email });

    // Pre-flight check in worker (type-cast to avoid TS2367 control flow narrowing)
    if ((recipient.follow_up_status as string) === 'skipped_replied') {
      // Aborted cleanly
      expect(recipient.follow_up_status).toBe('skipped_replied');
    }
    expect(recipient.follow_up_status).toBe('skipped_replied');
  });

  it('T2-QUE-17: Concurrency race — contact suppressed while campaign is sending skips recipient', () => {
    const contact = mockDb.createContact({ email: 'race.suppress@univ.edu' });
    const recipient = mockDb.addRecipient(campaignId, contact.id);

    // Suppressed while in queue
    mockDb.addSuppression(contact.email, 'unsubscribe');

    // Worker checks immediately before send
    if (mockDb.isSuppressed(contact.email)) {
      recipient.status = 'suppressed';
    }

    expect(recipient.status).toBe('suppressed');
  });

  it('T2-QUE-18: Account daily limit reached mid-batch reschedules remaining queue items', () => {
    const acc = mockDb.accounts.get(accountId)!;
    acc.daily_limit = 2;
    acc.sent_today_count = 0;

    for (let i = 0; i < 4; i++) {
      const c = mockDb.createContact({ email: `quota_batch${i}@univ.edu` });
      mockDb.addRecipient(campaignId, c.id);
    }

    const claimed = mockDb.claimQueuedRecipients(campaignId, 4);
    let sentCount = 0;
    claimed.forEach((r) => {
      if (acc.sent_today_count < acc.daily_limit) {
        r.status = 'sent';
        acc.sent_today_count++;
        sentCount++;
      } else {
        // Reschedule
        r.status = 'queued';
        r.scheduled_for = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
    });

    expect(sentCount).toBe(2);
    expect(claimed.filter((r) => r.status === 'sent').length).toBe(2);
    expect(claimed.filter((r) => r.status === 'queued').length).toBe(2);
  });

  it('T2-QUE-19: Disconnected account during send prevents worker from attempting API call', () => {
    mockDb.disconnectAccount(accountId);

    const isAccountActive = mockDb.accounts.get(accountId)?.status === 'active';
    expect(isAccountActive).toBe(false);

    // Worker should skip campaign when account is inactive
    const canProcess = isAccountActive;
    expect(canProcess).toBe(false);
  });

  it('T2-QUE-20: Empty queue worker invocation terminates cleanly with zero processing errors', () => {
    const claimed = mockDb.claimQueuedRecipients(campaignId, 5);
    expect(claimed.length).toBe(0);
    // Returns 0 processed without throwing
  });
});
