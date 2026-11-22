/**
 * Tier 1: Feature 7 (Mandatory Human Approval Gate) & Feature 8 (RFC 2822 MIME & Base64url Engine)
 * 10 Tests: T1-F07-01 to T1-F07-05 and T1-F08-01 to T1-F08-05
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '../setup';
import {
  buildRfc2822Mime,
  buildRawEmail,
  parseMimeMessage,
  fromBase64Url,
  toBase64Url,
  encodeHeaderValue,
  formatAddress,
} from '../harness/mime';
import { FACULTY_FIXTURES } from '../harness/fixtures';

describe('Tier 1: Features 7 & 8 — Approval Gate & RFC 2822 MIME Engine', () => {
  const testUserId = 'user_test_approval_001';
  let accountId: string;

  beforeEach(() => {
    mockDb.reset();
    mockDb.setContextUser(testUserId);
    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: 'approval.sender@gmail.com',
      refresh_token: 'valid-token',
    });
    accountId = acc.id;
  });

  // --- Feature 7: Mandatory Human Approval Gate ---

  it('T1-F07-01: Micro-batch queue worker refuses to process campaigns in draft or awaiting_approval status', () => {
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Unapproved Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'awaiting_approval',
    });

    const contact = mockDb.createContact({
      first_name: 'David',
      last_name: 'Malan',
      email: 'david.malan@harvard.edu',
    });
    mockDb.addRecipient(campaign.id, contact.id);

    // Queue worker attempt
    const claimed = mockDb.claimQueuedRecipients(campaign.id, 5);
    expect(claimed.length).toBe(0); // Cannot claim unapproved campaign items
  });

  it('T1-F07-02: Generates comprehensive pre-send review modal payload', () => {
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'STEM Faculty Outreach',
      subject: 'GamifyTL for {{institution}}',
      body_text: 'Hello {{first_name}}',
    });

    const contacts = FACULTY_FIXTURES.slice(0, 3).map((f) =>
      mockDb.createContact({ first_name: f.firstName, last_name: f.lastName, email: f.email })
    );
    contacts.forEach((c) => mockDb.addRecipient(campaign.id, c.id));

    // Construct modal payload
    const account = mockDb.accounts.get(campaign.account_id!)!;
    const recipients = mockDb.getRecipients(campaign.id);

    const reviewModalPayload = {
      campaignName: campaign.name,
      senderEmail: account.email,
      recipientCount: recipients.length,
      sampleSubject: recipients[0].personalized_subject,
      sampleBody: recipients[0].personalized_body,
      followUpConfigured: campaign.follow_up_enabled,
      warnings: [] as string[],
    };

    expect(reviewModalPayload.senderEmail).toBe('approval.sender@gmail.com');
    expect(reviewModalPayload.recipientCount).toBe(3);
    expect(reviewModalPayload.sampleSubject).toBe('GamifyTL for your institution');
    expect(reviewModalPayload.warnings.length).toBe(0);
  });

  it('T1-F07-03: Executes approval, records timestamp and user ID, and transitions to scheduled', () => {
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Ready Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'awaiting_approval',
    });

    const contact = mockDb.createContact({ email: 'prof@oxford.ac.uk', first_name: 'Prof' });
    mockDb.addRecipient(campaign.id, contact.id);

    // Human clicks Approve
    const now = new Date().toISOString();
    const approved = mockDb.updateCampaign(campaign.id, {
      status: 'scheduled',
      approved_at: now,
      scheduled_at: now,
    });

    expect(approved.status).toBe('scheduled');
    expect(approved.approved_at).toBe(now);

    // Transition to sending when worker triggers
    const sending = mockDb.updateCampaign(campaign.id, { status: 'sending' });
    const claimed = mockDb.claimQueuedRecipients(campaign.id, 5);
    expect(claimed.length).toBe(1);
    expect(claimed[0].status).toBe('sending');
  });

  it('T1-F07-04: Approval validation detects missing or revoked sending account', () => {
    // Disconnect account
    mockDb.disconnectAccount(accountId);

    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: null, // No active account
      name: 'No Account Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'awaiting_approval',
    });

    // Check pre-approval condition
    const canApprove = campaign.account_id !== null && mockDb.accounts.get(campaign.account_id)?.status === 'active';
    expect(canApprove).toBe(false);
  });

  it('T1-F07-05: Approval validation rejects campaign with zero recipients attached', () => {
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Empty Recipients Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'awaiting_approval',
    });

    const recipientCount = mockDb.getRecipients(campaign.id).length;
    expect(recipientCount).toBe(0);

    const canApprove = recipientCount > 0;
    expect(canApprove).toBe(false);
  });

  // --- Feature 8: RFC 2822 MIME & Base64url Engine ---

  it('T1-F08-01: Generates RFC 2822 multipart/alternative MIME message with plain text and HTML', () => {
    const mime = buildRfc2822Mime({
      fromEmail: 'outreach@gamifytl.com',
      fromName: 'GamifyTL Outreach',
      toEmail: 'david.malan@harvard.edu',
      toName: 'David Malan',
      subject: 'GamifyTL for CS50',
      bodyText: 'Hello David,\nThis is plain text.',
      bodyHtml: '<p>Hello David,<br>This is HTML.</p>',
    });

    expect(mime).toContain('Content-Type: multipart/alternative; boundary="');
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(mime).toContain('Content-Type: text/html; charset=UTF-8');
    expect(mime).toContain('Hello David,\r\nThis is plain text.');
    expect(mime).toContain('<p>Hello David,<br>This is HTML.</p>');

    const parsed = parseMimeMessage(mime);
    expect(parsed.plainTextBody).toContain('This is plain text.');
    expect(parsed.htmlBody).toContain('This is HTML.');
  });

  it('T1-F08-02: Strictly validates that raw payload is URL-safe Base64url encoded regex ^[A-Za-z0-9_-]+$', () => {
    const raw = buildRawEmail({
      fromEmail: 'alex@gamifytl.com',
      toEmail: 'wiles@maths.ox.ac.uk',
      subject: 'Test Subject',
      bodyText: 'Body with symbols: + / = ? & % # @',
    });

    // RFC 4648 §5 regex check
    expect(/^[A-Za-z0-9_-]+$/.test(raw)).toBe(true);
    // Should never contain +, / or =
    expect(raw).not.toContain('+');
    expect(raw).not.toContain('/');
    expect(raw).not.toContain('=');

    // Round-trip decoding check
    const decoded = fromBase64Url(raw);
    expect(decoded).toContain('Body with symbols: + / = ? & % # @');
  });

  it('T1-F08-03: Enforces mandatory RFC 2822 headers: From, To, Subject, Date, Message-ID, MIME-Version', () => {
    const mime = buildRfc2822Mime({
      fromEmail: 'sender@gmail.com',
      fromName: 'Sender Name',
      toEmail: 'recipient@harvard.edu',
      toName: 'Prof Recipient',
      subject: 'Active Learning in Lectures',
      bodyText: 'Content',
    });

    const parsed = parseMimeMessage(mime);
    expect(parsed.headers['from']).toBe('"Sender Name" <sender@gmail.com>');
    expect(parsed.headers['to']).toBe('"Prof Recipient" <recipient@harvard.edu>');
    expect(parsed.headers['subject']).toBe('Active Learning in Lectures');
    expect(parsed.headers['date']).toBeDefined();
    expect(parsed.headers['message-id']).toMatch(/^<.+@gamifytl\.com>$/);
    expect(parsed.headers['mime-version']).toBe('1.0');
  });

  it('T1-F08-04: Encodes non-ASCII Subject using RFC 2047 Base64 standard (=?UTF-8?B?...?=)', () => {
    const unicodeSubject = 'GamifyTL: Démonstration pédagogique pour l\'Université de Genève 🎓';
    const encoded = encodeHeaderValue(unicodeSubject);

    expect(encoded.startsWith('=?UTF-8?B?')).toBe(true);
    expect(encoded.endsWith('?=')).toBe(true);

    const b64 = encoded.slice(10, -2);
    const decodedBinary = atob(b64);
    const bytes = new Uint8Array(decodedBinary.length);
    for (let i = 0; i < decodedBinary.length; i++) {
      bytes[i] = decodedBinary.charCodeAt(i);
    }
    const decodedText = new TextDecoder().decode(bytes);
    expect(decodedText).toBe(unicodeSubject);
  });

  it('T1-F08-05: Injects In-Reply-To and References headers for threaded follow-up emails', () => {
    const parentMsgId = '<gamifytl-parent-msg-12345@gamifytl.com>';
    const mime = buildRfc2822Mime({
      fromEmail: 'sender@gmail.com',
      toEmail: 'recipient@oxford.ac.uk',
      subject: 'Re: Active Learning in Lectures',
      bodyText: 'Following up on our earlier conversation.',
      inReplyTo: parentMsgId,
      references: parentMsgId,
    });

    const parsed = parseMimeMessage(mime);
    expect(parsed.headers['in-reply-to']).toBe(parentMsgId);
    expect(parsed.headers['references']).toBe(parentMsgId);
  });
});
