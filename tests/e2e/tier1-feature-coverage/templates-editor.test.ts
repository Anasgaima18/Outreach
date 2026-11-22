/**
 * Tier 1: Feature 5 (GamifyTL Templates & Content) & Feature 6 (Campaign Creation & Editor)
 * 10 Tests: T1-F05-01 to T1-F05-05 and T1-F06-01 to T1-F06-05
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '../setup';
import {
  GAMIFYTL_TEMPLATES,
  lintEmailContent,
  FACULTY_FIXTURES,
} from '../harness/fixtures';

describe('Tier 1: Features 5 & 6 — GamifyTL Templates & Campaign Editor', () => {
  const testUserId = 'user_test_campaigns_001';
  let accountId: string;

  beforeEach(() => {
    mockDb.reset();
    mockDb.setContextUser(testUserId);
    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: 'campaign.manager@gmail.com',
      refresh_token: 'valid-refresh-token',
    });
    accountId = acc.id;
  });

  // --- Feature 5: GamifyTL Email Content & Verified Templates ---

  it('T1-F05-01: Template A validates verified GamifyTL games and smartphone distraction focus', () => {
    const tpl = GAMIFYTL_TEMPLATES.templateA_engagement;
    expect(tpl.subject).toContain('GamifyTL');
    expect(tpl.bodyText).toContain('Quiz Battle');
    expect(tpl.bodyText).toContain('Polls');
    expect(tpl.bodyText).toContain('smartphone distraction');
    expect(tpl.bodyText).toContain('Zero student app installs');
    expect(tpl.bodyText).toContain('Resource Drop');
    expect(tpl.bodyHtml).toContain('<a href="https://gamifytl.com/join">gamifytl.com/join</a>');

    const lint = lintEmailContent(tpl.bodyText);
    expect(lint.valid).toBe(true);
    expect(lint.violations.length).toBe(0);
  });

  it('T1-F05-02: Template B verifies zero student app installs and QR code join', () => {
    const tpl = GAMIFYTL_TEMPLATES.templateB_zeroInstall;
    expect(tpl.bodyText).toContain('zero-install');
    expect(tpl.bodyText).toContain('gamifytl.com/join');
    expect(tpl.bodyText).toContain('QR code');
    expect(tpl.bodyText).not.toContain('app store');

    const lint = lintEmailContent(tpl.bodyText);
    expect(lint.valid).toBe(true);
  });

  it('T1-F05-03: Template C verifies instant lecture file distribution via Resource Drop', () => {
    const tpl = GAMIFYTL_TEMPLATES.templateC_resourceDrop;
    expect(tpl.bodyText).toContain('Resource Drop');
    expect(tpl.bodyText).toContain('push files directly');
    expect(tpl.bodyText).toContain('LMS logins');

    const lint = lintEmailContent(tpl.bodyText);
    expect(lint.valid).toBe(true);
  });

  it('T1-F05-04: Prohibited claims linter flags unverified student numbers and fake partnerships', () => {
    const dirtyText = `GamifyTL is used by millions of students across 500 universities and endorsed by Harvard! Also revolutionary AI-powered algorithms guarantee 100% inbox placement.`;
    const lint = lintEmailContent(dirtyText);

    expect(lint.valid).toBe(false);
    expect(lint.violations).toContain('Unverified student count claim');
    expect(lint.violations).toContain('Fabricated institutional partnership count');
    expect(lint.violations).toContain('Fabricated university endorsement');
    expect(lint.violations).toContain('Unrealistic deliverability guarantee');
    expect(lint.violations).toContain('Violates AI exclusion constraint');
  });

  it('T1-F05-05: Supports custom user templates with persistent storage and markdown/html separation', () => {
    const customTpl = {
      name: 'Custom Distributed Systems Outreach',
      subject: 'GamifyTL for {{department}} Labs at {{institution}}',
      bodyText: 'Hello Professor {{last_name}},\n\nCustom text for {{institution}}.\n\nBest,\nGamifyTL',
      bodyHtml: '<p>Hello Professor {{last_name}},</p><p>Custom text for {{institution}}.</p><p>Best,<br>GamifyTL</p>',
    };

    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: customTpl.name,
      subject: customTpl.subject,
      body_text: customTpl.bodyText,
      body_html: customTpl.bodyHtml,
    });

    expect(campaign.name).toBe(customTpl.name);
    expect(campaign.body_text).toBe(customTpl.bodyText);
    expect(campaign.body_html).toBe(customTpl.bodyHtml);
  });

  // --- Feature 6: Campaign Creation & Editor ---

  it('T1-F06-01: Creates campaign with subject, body, account ID, and initial draft status', () => {
    const tpl = GAMIFYTL_TEMPLATES.templateA_engagement;
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Harvard & Oxford Fall 2026 Outreach',
      description: 'Outreach to STEM department heads',
      subject: tpl.subject,
      body_text: tpl.bodyText,
      body_html: tpl.bodyHtml,
      min_delay_seconds: 25,
      max_delay_seconds: 50,
      follow_up_enabled: true,
      follow_up_delay_days: 4,
    });

    expect(campaign.id).toBeDefined();
    expect(campaign.status).toBe('draft');
    expect(campaign.min_delay_seconds).toBe(25);
    expect(campaign.max_delay_seconds).toBe(50);
    expect(campaign.follow_up_enabled).toBe(true);
    expect(campaign.follow_up_delay_days).toBe(4);
  });

  it('T1-F06-02: Performs variable interpolation for recipient personalization', () => {
    const contact = mockDb.createContact({
      first_name: 'David',
      last_name: 'Malan',
      email: 'david.malan@harvard.edu',
      institution: 'Harvard University',
      department: 'Computer Science',
    });

    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Personalization Test',
      subject: 'GamifyTL for {{institution}}',
      body_text: 'Dear Professor {{last_name}}, greetings to {{department}} at {{institution}}.',
    });

    const recipient = mockDb.addRecipient(campaign.id, contact.id);

    expect(recipient.personalized_subject).toBe('GamifyTL for Harvard University');
    expect(recipient.personalized_body).toBe('Dear Professor Malan, greetings to Computer Science at Harvard University.');
  });

  it('T1-F06-03: Associates contacts with campaign and generates queued recipient rows', () => {
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Batch Association Campaign',
      subject: 'Hello {{first_name}}',
      body_text: 'Hello {{full_name}}',
    });

    const contacts = FACULTY_FIXTURES.slice(0, 3).map((f) =>
      mockDb.createContact({
        first_name: f.firstName,
        last_name: f.lastName,
        email: f.email,
        institution: f.institution,
      })
    );

    contacts.forEach((c) => {
      mockDb.addRecipient(campaign.id, c.id);
    });

    const recipients = mockDb.getRecipients(campaign.id);
    expect(recipients.length).toBe(3);
    expect(recipients.every((r) => r.status === 'queued')).toBe(true);
  });

  it('T1-F06-04: Renders live preview for selected educator contact', () => {
    const contact = mockDb.createContact({
      first_name: 'Andrew',
      last_name: 'Wiles',
      email: 'andrew.wiles@maths.ox.ac.uk',
      institution: 'University of Oxford',
      department: 'Mathematical Institute',
    });

    const template = GAMIFYTL_TEMPLATES.templateA_engagement;
    const previewSubject = template.subject
      .replace(/\{\{department\}\}/g, contact.department!)
      .replace(/\{\{institution\}\}/g, contact.institution!);

    const previewBody = template.bodyText
      .replace(/\{\{last_name\}\}/g, contact.last_name!)
      .replace(/\{\{department\}\}/g, contact.department!)
      .replace(/\{\{institution\}\}/g, contact.institution!);

    expect(previewSubject).toContain('Mathematical Institute at University of Oxford');
    expect(previewBody).toContain('Dear Professor Wiles');
    expect(previewBody).toContain('work in the Mathematical Institute at University of Oxford');
  });

  it('T1-F06-05: Transitions campaign through valid lifecycle states', () => {
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Lifecycle Campaign',
      subject: 'Subject',
      body_text: 'Body',
    });

    expect(campaign.status).toBe('draft');

    const awaiting = mockDb.updateCampaign(campaign.id, { status: 'awaiting_approval' });
    expect(awaiting.status).toBe('awaiting_approval');

    const scheduled = mockDb.updateCampaign(campaign.id, {
      status: 'scheduled',
      approved_at: new Date().toISOString(),
      scheduled_at: new Date().toISOString(),
    });
    expect(scheduled.status).toBe('scheduled');
    expect(scheduled.approved_at).toBeDefined();

    const sending = mockDb.updateCampaign(campaign.id, { status: 'sending', started_at: new Date().toISOString() });
    expect(sending.status).toBe('sending');

    const completed = mockDb.updateCampaign(campaign.id, { status: 'completed', completed_at: new Date().toISOString() });
    expect(completed.status).toBe('completed');
  });
});
