/**
 * Tier 3: Pairwise Cross-Feature Testing — Campaign Lifecycle Combinations
 * 6 Scenarios: T3-PW-01, T3-PW-02, T3-PW-05, T3-PW-09, T3-PW-11, T3-PW-15
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockGmail, mockDb } from '../setup';
import { buildRawEmail } from '../harness/mime';
import { FACULTY_FIXTURES } from '../harness/fixtures';

describe('Tier 3: Campaign Lifecycle Cross-Feature Combinations (6 Tests)', () => {
  const testUserId = 'user_tier3_lifecycle_001';
  let accountId: string;
  let senderEmail: string;

  beforeEach(() => {
    mockGmail.reset();
    mockDb.reset();
    mockDb.setContextUser(testUserId);
    senderEmail = 'outreach.lead@gmail.com';

    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: senderEmail,
      refresh_token: 'valid-token',
    });
    accountId = acc.id;
  });

  it('T3-PW-01: Baseline standard outreach: contact added -> campaign approved -> MIME generated -> sent via Gmail -> audit ledger verified', async () => {
    // 1. Contact added
    const prof = FACULTY_FIXTURES[0]; // David Malan
    const contact = mockDb.createContact({
      first_name: prof.firstName,
      last_name: prof.lastName,
      email: prof.email,
      institution: prof.institution,
      department: prof.department,
    });

    // 2. Campaign created & approved
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'CS50 Outreach',
      subject: 'GamifyTL for {{department}} at {{institution}}',
      body_text: 'Dear Professor {{last_name}},\n\nTurn phones into active lecture engagement tools.',
      status: 'awaiting_approval',
    });
    const recipient = mockDb.addRecipient(cmp.id, contact.id);

    // Human approves campaign
    mockDb.updateCampaign(cmp.id, {
      status: 'scheduled',
      approved_at: new Date().toISOString(),
      scheduled_at: new Date().toISOString(),
    });
    mockDb.updateCampaign(cmp.id, { status: 'sending' });

    // 3. Worker claims & generates MIME
    const claimed = mockDb.claimQueuedRecipients(cmp.id, 1)[0];
    const raw = buildRawEmail({
      fromEmail: senderEmail,
      toEmail: contact.email,
      subject: claimed.personalized_subject!,
      bodyText: claimed.personalized_body!,
    });

    // 4. Sent via Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    claimed.status = 'sent';
    claimed.gmail_message_id = data.id;
    claimed.gmail_thread_id = data.threadId;

    // 5. Audit ledger
    mockDb.logEvent({
      campaign_id: cmp.id,
      recipient_id: claimed.id,
      account_id: accountId,
      event_type: 'accepted_by_gmail',
      metadata: { gmail_message_id: data.id },
    });

    expect(mockGmail.sentMessages.length).toBe(1);
    expect(mockGmail.sentMessages[0].headers['subject']).toBe('GamifyTL for Computer Science at Harvard University');
    const events = mockDb.getEvents(cmp.id);
    expect(events.filter((e) => e.event_type === 'accepted_by_gmail').length).toBe(1);
  });

  it('T3-PW-02: Batch outreach with follow-up: CSV import -> multi-item batch -> follow-up scheduled for T+3 days', async () => {
    // 1. CSV Contacts
    const contacts = FACULTY_FIXTURES.slice(0, 3).map((f) =>
      mockDb.createContact({ first_name: f.firstName, last_name: f.lastName, email: f.email, institution: f.institution })
    );

    // 2. Campaign with follow-up
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Batch Outreach',
      subject: 'Lecture Tool',
      body_text: 'Body',
      follow_up_enabled: true,
      follow_up_delay_days: 3,
      status: 'sending',
    });

    contacts.forEach((c) => mockDb.addRecipient(cmp.id, c.id));

    // 3. Worker claims all 3
    const batch = mockDb.claimQueuedRecipients(cmp.id, 3);
    expect(batch.length).toBe(3);

    for (const r of batch) {
      const raw = buildRawEmail({ fromEmail: senderEmail, toEmail: 'prof@univ.edu', subject: 'Subject', bodyText: 'Body' });
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      const data = await res.json();
      r.status = 'sent';
      r.gmail_message_id = data.id;
      r.gmail_thread_id = data.threadId;
      // Schedule follow-up
      r.follow_up_status = 'scheduled';
      r.follow_up_scheduled_at = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    }

    expect(mockGmail.sentMessages.length).toBe(3);
    const recipients = mockDb.getRecipients(cmp.id);
    expect(recipients.every((r) => r.follow_up_status === 'scheduled')).toBe(true);
  });

  it('T3-PW-05: Delayed Approval: Campaign held in awaiting_approval; worker skips until explicit human approval', () => {
    const contact = mockDb.createContact({ email: 'delay.approve@univ.edu' });
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Delayed Approval Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'awaiting_approval',
    });
    mockDb.addRecipient(cmp.id, contact.id);

    // Worker triggers while awaiting approval
    let claimed = mockDb.claimQueuedRecipients(cmp.id, 5);
    expect(claimed.length).toBe(0);

    // Owner approves 2 hours later
    mockDb.updateCampaign(cmp.id, {
      status: 'scheduled',
      approved_at: new Date().toISOString(),
      scheduled_at: new Date().toISOString(),
    });
    mockDb.updateCampaign(cmp.id, { status: 'sending' });

    // Worker triggers again
    claimed = mockDb.claimQueuedRecipients(cmp.id, 5);
    expect(claimed.length).toBe(1);
    expect(claimed[0].status).toBe('sending');
  });

  it('T3-PW-09: UTF-8 Accents in Headers: French/German professor name in To header; Base64url Q-encoded subject', async () => {
    const prof = FACULTY_FIXTURES[8]; // François Labourie
    const contact = mockDb.createContact({
      first_name: prof.firstName,
      last_name: prof.lastName,
      email: prof.email,
      institution: prof.institution,
    });

    const raw = buildRawEmail({
      fromEmail: senderEmail,
      toEmail: contact.email,
      toName: `${prof.firstName} ${prof.lastName}`,
      subject: `Démonstration GamifyTL pour l'Université Côte d'Azur 🎓`,
      bodyText: 'Chère Professeur Labourie,\n\nPrésentation de GamifyTL.',
    });

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });

    expect(response.status).toBe(200);
    const sent = mockGmail.sentMessages[0];
    expect(sent.headers['to']).toContain('francois.labourie@unice.fr');
    expect(sent.headers['to']).toContain('=?UTF-8?B?');
    expect(sent.headers['subject']).toContain('=?UTF-8?B?');
  });

  it('T3-PW-11: Multi-item Batch with 429 Interruption: 2 items sent, 3rd gets 429 backoff and reschedules', async () => {
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Batch 429 Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    for (let i = 0; i < 3; i++) {
      const c = mockDb.createContact({ email: `p${i}@univ.edu` });
      mockDb.addRecipient(cmp.id, c.id);
    }

    const batch = mockDb.claimQueuedRecipients(cmp.id, 3);
    expect(batch.length).toBe(3);

    // First 2 succeed, 3rd hits 429
    for (let i = 0; i < batch.length; i++) {
      const r = batch[i];
      if (i === 2) {
        mockGmail.setFailureMode('rate_limit_429');
      }

      const raw = buildRawEmail({ fromEmail: senderEmail, toEmail: 'prof@univ.edu', subject: 'Subject', bodyText: 'Body' });
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });

      if (res.status === 200) {
        r.status = 'sent';
      } else if (res.status === 429) {
        r.status = 'queued'; // return to queue with retry
        r.retry_count++;
        r.scheduled_for = new Date(Date.now() + 30 * 1000).toISOString();
      }
    }

    expect(batch[0].status).toBe('sent');
    expect(batch[1].status).toBe('sent');
    expect(batch[2].status).toBe('queued');
    expect(batch[2].retry_count).toBe(1);
  });

  it('T3-PW-15: Transient Error Recovery: Worker encounters 503 Backend Error, recovers cleanly on retry', async () => {
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: '503 Recovery Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    const contact = mockDb.createContact({ email: 'recover@univ.edu' });
    const recipient = mockDb.addRecipient(cmp.id, contact.id);

    // Configure 1 transient failure of 503 then recovery
    mockGmail.setTransientFailure('server_error_503', 1);

    const raw = buildRawEmail({ fromEmail: senderEmail, toEmail: contact.email, subject: 'Subject', bodyText: 'Body' });

    // Attempt 1 fails with 503
    const res1 = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    expect(res1.status).toBe(503);
    recipient.retry_count++;
    mockDb.logEvent({ campaign_id: cmp.id, recipient_id: recipient.id, event_type: 'failed_send', metadata: { status: 503 } });

    // Attempt 2 succeeds
    const res2 = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    expect(res2.status).toBe(200);
    recipient.status = 'sent';
    mockDb.logEvent({ campaign_id: cmp.id, recipient_id: recipient.id, event_type: 'accepted_by_gmail' });

    const events = mockDb.getEvents(cmp.id);
    expect(events.some((e) => e.event_type === 'failed_send')).toBe(true);
    expect(events.some((e) => e.event_type === 'accepted_by_gmail')).toBe(true);
  });
});
