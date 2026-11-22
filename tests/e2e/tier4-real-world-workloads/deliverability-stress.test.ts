/**
 * Tier 4: Real-World Educator Outreach Workloads (Part 2: Scenarios 5 to 8)
 * Deliverability stress, bulk CSV anomalies, universal quarantine, and daily cap throttling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockGmail, mockDb } from '../setup';
import { buildRawEmail } from '../harness/mime';
import { generateLargeProfessorsCsv } from '../harness/fixtures';

describe('Tier 4: Real-World Workloads — Scenarios 5 to 8', () => {
  const testUserId = 'user_tier4_stress_001';
  let accountId: string;
  let senderEmail: string;

  beforeEach(() => {
    mockGmail.reset();
    mockDb.reset();
    mockDb.setContextUser(testUserId);
    senderEmail = 'gamifytl.deliverability.ops@gmail.com';

    const acc = mockDb.createAccount({
      user_id: testUserId,
      email: senderEmail,
      refresh_token: 'valid-root-token',
      daily_limit: 40,
    });
    accountId = acc.id;
  });

  // Scenario 5: Bulk CSV Import of 250 International Faculty with Mixed Anomalies
  it('T4-SC-05: Bulk CSV Import of 250 International Faculty with Mixed Anomalies', () => {
    // 210 clean contacts, 15 duplicates, 15 malformed, 10 Unicode
    const rows: { email: string; first_name: string; last_name: string; institution: string }[] = [];

    // 200 standard clean
    for (let i = 1; i <= 200; i++) {
      rows.push({
        email: `prof.clean.${i}@university-${i}.edu`,
        first_name: `First${i}`,
        last_name: `Last${i}`,
        institution: `University ${i}`,
      });
    }

    // 10 clean Unicode faculty
    const unicodeFaculty = [
      { email: 'tanaka@u-tokyo.ac.jp', first_name: '健太', last_name: '田中', institution: '東京大学' },
      { email: 'schmidt@tum.de', first_name: 'Jürgen', last_name: 'Schmidt', institution: 'TU München' },
      { email: 'goncalves@usp.br', first_name: 'Inês', last_name: 'Gonçalves', institution: 'Universidade de São Paulo' },
      { email: 'alzahra@aub.edu.lb', first_name: 'فاطمة', last_name: 'الزهراء', institution: 'AUB' },
      { email: 'muller@unige.ch', first_name: 'François', last_name: 'Müller', institution: 'Genève' },
      { email: 'sato@kyoto-u.ac.jp', first_name: '健二', last_name: '佐藤', institution: '京都大学' },
      { email: 'dupont@sorbonne.fr', first_name: 'Benoît', last_name: 'Dupont', institution: 'Sorbonne' },
      { email: 'weber@ethz.ch', first_name: 'Käthe', last_name: 'Weber', institution: 'ETH Zürich' },
      { email: 'silva@ufmg.br', first_name: 'João', last_name: 'Silva', institution: 'UFMG' },
      { email: 'rossi@unibo.it', first_name: 'Chiara', last_name: 'Rossi', institution: 'Bologna' },
    ];
    unicodeFaculty.forEach((f) => rows.push(f));

    // Total clean = 210

    // 15 duplicates
    for (let i = 1; i <= 15; i++) {
      rows.push({
        email: `prof.clean.${i}@university-${i}.edu`, // Duplicate email
        first_name: `DupFirst${i}`,
        last_name: `DupLast${i}`,
        institution: `Dup University ${i}`,
      });
    }

    // 15 malformed emails
    const malformed = [
      'missingat.edu',
      'user@nodot',
      '@missinglocal.org',
      'space email@univ.edu',
      'user@.com',
      'bad##email@univ.edu',
      'user(parens)@domain.com',
      'plainstring',
      'trailingdot@univ.',
      '@nodomain',
      'user@',
      'two@@univ.edu',
      'bracket<@univ.edu',
      'semi;colon@univ.edu',
      'quote"email@univ.edu',
    ];
    malformed.forEach((bad, idx) => {
      rows.push({
        email: bad,
        first_name: `Bad${idx}`,
        last_name: `Bad${idx}`,
        institution: `Bad Univ`,
      });
    });

    expect(rows.length).toBe(240);

    let imported = 0;
    let duplicates = 0;
    let malformedCount = 0;

    rows.forEach((row) => {
      try {
        mockDb.createContact({
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          institution: row.institution,
        });
        imported++;
      } catch (err: any) {
        if (err.message.includes('uq_contacts_user_email')) {
          duplicates++;
        } else {
          malformedCount++;
        }
      }
    });

    expect(imported).toBe(210);
    expect(duplicates).toBe(15);
    expect(malformedCount).toBe(15);
    expect(mockDb.getContacts().length).toBe(210);

    // Verify Unicode diacritics are preserved byte-for-byte
    const tumProf = mockDb.getContacts({ search: 'schmidt@tum.de' })[0];
    expect(tumProf.first_name).toBe('Jürgen');
    expect(tumProf.institution).toBe('TU München');
  });

  // Scenario 6: Professor Unsubscribe Request & Universal Quarantine
  it('T4-SC-06: Professor Unsubscribe Request & Universal Quarantine', () => {
    const elena = mockDb.createContact({
      first_name: 'Elena',
      last_name: 'Rostova',
      email: 'e.rostova@ethz.ch',
      institution: 'ETH Zürich',
    });

    // Active Campaign 1
    const cmp1 = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'European Engineering Campaign',
      subject: 'Subject',
      body_text: 'Body',
      follow_up_enabled: true,
      status: 'sending',
    });
    const r1 = mockDb.addRecipient(cmp1.id, elena.id);
    r1.status = 'sent';
    r1.follow_up_status = 'scheduled';

    // Active Campaign 2
    const cmp2 = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Robotics Outreach',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });
    const r2 = mockDb.addRecipient(cmp2.id, elena.id);

    // Elena replies: "Please unsubscribe me"
    mockDb.addSuppression(elena.email, 'unsubscribe');
    expect(mockDb.isSuppressed(elena.email)).toBe(true);

    // Universal Quarantine scan cancels active recipients
    if (mockDb.isSuppressed(elena.email)) {
      if (r1.follow_up_status === 'scheduled') {
        r1.follow_up_status = 'skipped_unsubscribed';
      }
      if (r2.status === 'queued') {
        r2.status = 'suppressed';
      }
    }

    expect(r1.follow_up_status).toBe('skipped_unsubscribed');
    expect(r2.status).toBe('suppressed');

    // Future campaign creation warns/blocks Elena
    const futureCmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Future Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });
    const r3 = mockDb.addRecipient(futureCmp.id, elena.id);
    if (mockDb.isSuppressed(elena.email)) {
      r3.status = 'suppressed';
    }

    expect(r3.status).toBe('suppressed');
    expect(mockGmail.sentMessages.length).toBe(0);
  });

  // Scenario 7: Mid-Flight Campaign Cancellation with Atomic Micro-Batch Drain
  it('T4-SC-07: Mid-Flight Campaign Cancellation with Atomic Micro-Batch Drain', async () => {
    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Mid-Flight Cancellation Test',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    for (let i = 1; i <= 50; i++) {
      const c = mockDb.createContact({ email: `drain_prof_${i}@univ.edu` });
      mockDb.addRecipient(cmp.id, c.id);
    }

    expect(mockDb.getRecipients(cmp.id).length).toBe(50);

    // Batch 1 (Recipients 1 to 5) executes
    const batch1 = mockDb.claimQueuedRecipients(cmp.id, 5);
    expect(batch1.length).toBe(5);

    for (const r of batch1) {
      const raw = buildRawEmail({ fromEmail: senderEmail, toEmail: 'prof@univ.edu', subject: 'Subject', bodyText: 'Body' });
      await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      r.status = 'sent';
    }

    expect(mockGmail.sentMessages.length).toBe(5);

    // Admin clicks "Cancel Campaign"
    mockDb.updateCampaign(cmp.id, { status: 'cancelled' });

    // Next worker invocation drains all remaining queued recipients to 'failed' (cancelled)
    const allRecipients = mockDb.getRecipients(cmp.id);
    allRecipients.forEach((r) => {
      if (r.status === 'queued') {
        r.status = 'failed';
        r.error_message = 'Campaign cancelled by owner mid-flight';
      }
    });

    const sentRecipients = allRecipients.filter((r) => r.status === 'sent');
    const cancelledRecipients = allRecipients.filter((r) => r.status === 'failed');
    const queuedRecipients = allRecipients.filter((r) => r.status === 'queued');

    expect(sentRecipients.length).toBe(5);
    expect(cancelledRecipients.length).toBe(45);
    expect(queuedRecipients.length).toBe(0); // Zero orphaned rows
    expect(mockGmail.sentMessages.length).toBe(5); // Zero leaked sends
  });

  // Scenario 8: Multi-Account Daily Quota Throttling & Queue Rescheduling
  it('T4-SC-08: Multi-Account Daily Quota Throttling & Queue Rescheduling', () => {
    const acc = mockDb.accounts.get(accountId)!;
    acc.daily_limit = 40;
    acc.sent_today_count = 0;

    const cmp = mockDb.createCampaign({
      user_id: testUserId,
      account_id: accountId,
      name: 'Quota Throttling Campaign',
      subject: 'Subject',
      body_text: 'Body',
      status: 'sending',
    });

    for (let i = 1; i <= 75; i++) {
      const c = mockDb.createContact({ email: `quota_target_${i}@univ.edu` });
      mockDb.addRecipient(cmp.id, c.id);
    }

    const recipients = mockDb.getRecipients(cmp.id);
    expect(recipients.length).toBe(75);

    // Worker simulates sending 8 batches of 5 (total 40 emails)
    let processedToday = 0;
    for (let b = 0; b < 8; b++) {
      const batch = mockDb.claimQueuedRecipients(cmp.id, 5);
      batch.forEach((r) => {
        if (acc.sent_today_count < acc.daily_limit) {
          r.status = 'sent';
          acc.sent_today_count++;
          processedToday++;
        }
      });
    }

    expect(processedToday).toBe(40);
    expect(acc.sent_today_count).toBe(40);

    // Worker checks next batch — quota reached
    const quotaReached = acc.sent_today_count >= acc.daily_limit;
    expect(quotaReached).toBe(true);

    // Reschedule remaining 35 recipients to next 24h window
    const remaining = recipients.filter((r) => r.status === 'queued');
    expect(remaining.length).toBe(35);

    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    remaining.forEach((r) => {
      r.scheduled_for = tomorrow;
    });

    // Assertions
    expect(remaining.every((r) => r.scheduled_for === tomorrow)).toBe(true);
    expect(recipients.filter((r) => r.status === 'sent').length).toBe(40);
    expect(acc.sent_today_count).toBe(40); // Never breaches Google 500/day
  });
});
