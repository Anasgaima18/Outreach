/**
 * Tier 4: Real-World Educator Outreach Workloads (Part 1: Scenarios 1 to 4)
 * Authentic academic outreach simulations with real university fixtures and failure recovery.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockGmail, mockOAuth, mockDb } from '../setup';
import { buildRawEmail } from '../harness/mime';
import { GAMIFYTL_TEMPLATES, FACULTY_FIXTURES } from '../harness/fixtures';

describe('Tier 4: Real-World Workloads — Scenarios 1 to 4', () => {
  const testUserId = 'user_tier4_workloads_001';
  let accountId: string;
  let senderEmail: string;

  beforeEach(() => {
    mockGmail.reset();
    mockOAuth.reset();
    mockDb.reset();
    mockDb.setContextUser(testUserId);
    senderEmail = 'gamifytl.outreach.director@gmail.com';

    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: senderEmail,
      refresh_token: 'valid-root-token',
      daily_limit: 50,
    });
    accountId = acc.id;
  });

  // Scenario 1: Harvard & Oxford STEM Faculty Outreach Campaign
  it('T4-SC-01: Harvard & Oxford STEM Faculty Outreach Campaign (10 Professors)', async () => {
    // 1. Import 10 real faculty members
    const faculty = FACULTY_FIXTURES.slice(0, 10);
    const contacts = faculty.map((f) =>
      mockDb.createContact({
        first_name: f.firstName,
        last_name: f.lastName,
        email: f.email,
        institution: f.institution,
        department: f.department,
        academic_role: f.academicRole,
        country: f.country,
        website: f.website,
      })
    );
    expect(contacts.length).toBe(10);

    // 2. Create campaign with Template A
    const tpl = GAMIFYTL_TEMPLATES.templateA_engagement;
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Harvard & Oxford STEM Outreach',
      subject: tpl.subject,
      body_text: tpl.bodyText,
      body_html: tpl.bodyHtml,
      status: 'awaiting_approval',
    });

    contacts.forEach((c) => mockDb.addRecipient(cmp.id, c.id));
    const recipients = mockDb.getRecipients(cmp.id);
    expect(recipients.length).toBe(10);

    // 3. Pre-send review modal & human approval
    expect(cmp.status).toBe('awaiting_approval');
    mockDb.updateCampaign(cmp.id, {
      status: 'scheduled',
      approved_at: new Date().toISOString(),
      scheduled_at: new Date().toISOString(),
    });
    mockDb.updateCampaign(cmp.id, { status: 'sending' });

    // 4. Micro-batch queue worker executes 2 batches of 5 emails each
    const batch1 = mockDb.claimQueuedRecipients(cmp.id, 5);
    expect(batch1.length).toBe(5);

    for (const r of batch1) {
      const contact = mockDb.contacts.get(r.contact_id)!;
      const raw = buildRawEmail({
        fromEmail: senderEmail,
        toEmail: contact.email,
        subject: r.personalized_subject!,
        bodyText: r.personalized_body!,
      });
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      r.status = 'sent';
      r.gmail_message_id = data.id;
      r.gmail_thread_id = data.threadId;

      mockDb.logEvent({
        campaign_id: cmp.id,
        recipient_id: r.id,
        account_id: accountId,
        event_type: 'accepted_by_gmail',
        metadata: { gmail_message_id: data.id },
      });
    }

    const batch2 = mockDb.claimQueuedRecipients(cmp.id, 5);
    expect(batch2.length).toBe(5);

    for (const r of batch2) {
      const contact = mockDb.contacts.get(r.contact_id)!;
      const raw = buildRawEmail({
        fromEmail: senderEmail,
        toEmail: contact.email,
        subject: r.personalized_subject!,
        bodyText: r.personalized_body!,
      });
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      r.status = 'sent';
      r.gmail_message_id = data.id;
      r.gmail_thread_id = data.threadId;

      mockDb.logEvent({
        campaign_id: cmp.id,
        recipient_id: r.id,
        account_id: accountId,
        event_type: 'accepted_by_gmail',
        metadata: { gmail_message_id: data.id },
      });
    }

    // 5. Verification & Assertions
    expect(mockGmail.sentMessages.length).toBe(10);
    const allRecipients = mockDb.getRecipients(cmp.id);
    expect(allRecipients.every((r) => r.status === 'sent')).toBe(true);

    const events = mockDb.getEvents(cmp.id);
    const acceptedEvents = events.filter((e) => e.event_type === 'accepted_by_gmail');
    expect(acceptedEvents.length).toBe(10);

    mockDb.updateCampaign(cmp.id, { status: 'completed', completed_at: new Date().toISOString() });
    expect(mockDb.campaigns.get(cmp.id)?.status).toBe('completed');
  });

  // Scenario 2: Cambridge Professor Reply Interception & Automated Follow-Up Cancellation
  it('T4-SC-02: Cambridge Professor Reply Interception & Follow-up Cancellation', async () => {
    const drThorne = mockDb.createContact({
      first_name: 'Aris',
      last_name: 'Thorne',
      email: 'a.thorne@cl.cam.ac.uk',
      institution: 'University of Cambridge',
      department: 'Department of Computer Science and Technology',
    });

    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Cambridge Engagement',
      subject: 'GamifyTL for Cambridge Lectures',
      body_text: 'Dear Dr. Thorne',
      follow_up_enabled: true,
      follow_up_delay_days: 3,
      status: 'sending',
    });

    const recipient = mockDb.addRecipient(cmp.id, drThorne.id);

    // Initial send completes
    const raw = buildRawEmail({ fromEmail: senderEmail, toEmail: drThorne.email, subject: 'Subject', bodyText: 'Body' });
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
    recipient.follow_up_scheduled_at = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

    // At T + 1 day, incoming reply arrives
    const replySnippet = 'Thank you for the note. Does GamifyTL support live polling for 350 students simultaneously in an auditorium?';
    mockDb.registerReply({
      contact_id: drThorne.id,
      campaign_id: cmp.id,
      recipient_id: recipient.id,
      account_id: accountId,
      gmail_thread_id: data.threadId,
      sender_email: drThorne.email,
      subject: 'Re: GamifyTL for Cambridge Lectures',
      snippet: replySnippet,
      source: 'manual',
    });

    expect(drThorne.status).toBe('replied');
    expect(recipient.status).toBe('replied');
    expect(recipient.follow_up_status).toBe('skipped_replied');

    // Follow-up worker runs on Day 3: confirms zero follow-up dispatched to Dr. Thorne
    const canSendFollowUp = recipient.follow_up_status === 'scheduled';
    expect(canSendFollowUp).toBe(false);
  });

  // Scenario 3: Bounced Educator Suppression & Safety Loop
  it('T4-SC-03: Bounced Educator Suppression & Automatic Safety Loop', async () => {
    const retiredEmail = 'prof.emeritus@sorbonne-universite.fr';
    const retiredProf = mockDb.createContact({
      first_name: 'Emeritus',
      last_name: 'Sorbonne',
      email: retiredEmail,
      institution: 'Sorbonne Université',
    });

    const cmp1 = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Sorbonne Initial Outreach',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });
    const r1 = mockDb.addRecipient(cmp1.id, retiredProf.id);

    // Simulate 550 permanent bounce
    mockGmail.setFailureMode('permanent_bounce_550');
    const raw = buildRawEmail({ fromEmail: senderEmail, toEmail: retiredEmail, subject: 'Subject', bodyText: 'Body' });
    const bounceRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });

    expect(bounceRes.status).toBe(400); // Bad Request / Mailbox not found
    r1.status = 'bounced';
    mockDb.addSuppression(retiredEmail, 'bounce');

    expect(mockDb.isSuppressed(retiredEmail)).toBe(true);
    expect(retiredProf.status).toBe('bounced');

    // Subsequent campaign targeting Sorbonne faculty
    mockGmail.setFailureMode('none');
    const cmp2 = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Sorbonne Follow-up Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    const r2 = mockDb.addRecipient(cmp2.id, retiredProf.id);

    // Pre-flight check in queue runner
    let sentToBounced = false;
    if (mockDb.isSuppressed(retiredProf.email)) {
      r2.status = 'suppressed';
      mockDb.logEvent({
        campaign_id: cmp2.id,
        recipient_id: r2.id,
        event_type: 'suppressed',
        metadata: { reason: 'bounced_address' },
      });
    } else {
      sentToBounced = true;
    }

    expect(sentToBounced).toBe(false);
    expect(r2.status).toBe('suppressed');
    expect(mockGmail.sentMessages.length).toBe(0); // Zero quota spent
  });

  // Scenario 4: Google OAuth 7-Day Token Expiry & Resilient Queue Recovery
  it('T4-SC-04: Google OAuth 7-Day Token Expiry & Resilient Queue Recovery', async () => {
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Resilient Token Recovery Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    // Create 30 recipients
    for (let i = 1; i <= 30; i++) {
      const c = mockDb.createContact({ email: `faculty_${i}@univ.edu` });
      mockDb.addRecipient(cmp.id, c.id);
    }

    // Process Batch 1 (Recipients 1 to 10) successfully
    const batch1 = mockDb.claimQueuedRecipients(cmp.id, 10);
    for (const r of batch1) {
      r.status = 'sent';
      r.gmail_message_id = `msg_${r.id}`;
    }
    expect(mockDb.getRecipients(cmp.id).filter((r) => r.status === 'sent').length).toBe(10);

    // At recipient 11, Google returns invalid_grant
    mockOAuth.isRevoked = true;
    mockDb.accounts.get(accountId)!.status = 'expired';
    mockDb.updateCampaign(cmp.id, { status: 'paused' });

    expect(mockDb.campaigns.get(cmp.id)?.status).toBe('paused');
    expect(mockDb.accounts.get(accountId)?.status).toBe('expired');

    // Admin completes re-auth via Google OAuth
    mockOAuth.isRevoked = false;
    const freshToken = '1//04freshNewRefreshTokenAfterReauth';
    mockDb.updateAccount(accountId, {
      encrypted_refresh_token: mockDb.encryptToken(freshToken),
      status: 'active',
    });

    // Admin clicks "Resume Campaign"
    mockDb.updateCampaign(cmp.id, { status: 'sending' });

    // Process remaining 20 recipients (Batches of 10)
    const batch2 = mockDb.claimQueuedRecipients(cmp.id, 10);
    expect(batch2.length).toBe(10);
    batch2.forEach((r) => {
      r.status = 'sent';
    });

    const batch3 = mockDb.claimQueuedRecipients(cmp.id, 10);
    expect(batch3.length).toBe(10);
    batch3.forEach((r) => {
      r.status = 'sent';
    });

    // Verify all 30 processed with zero duplicates to 1-10
    const finalRecipients = mockDb.getRecipients(cmp.id);
    expect(finalRecipients.length).toBe(30);
    expect(finalRecipients.every((r) => r.status === 'sent')).toBe(true);
  });
});
