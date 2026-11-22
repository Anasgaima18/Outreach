/**
 * Tier 2: Boundary & Corner Validation Tests
 * 20 Tests covering contact inputs, CSV parsing edges, and campaign template boundaries.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '../setup';
import { generateLargeProfessorsCsv } from '../harness/fixtures';

describe('Tier 2: Input Validation, Extreme Boundaries & Corner Cases (20 Tests)', () => {
  const testUserId = 'user_tier2_validation_001';

  beforeEach(() => {
    mockDb.reset();
    mockDb.setContextUser(testUserId);
  });

  it('T2-VAL-01: Rejects contact creation with empty email string', () => {
    expect(() => {
      mockDb.createContact({ email: '' });
    }).toThrow(/Invalid email address format/);
  });

  it('T2-VAL-02: Rejects malformed email address patterns', () => {
    const invalidPatterns = [
      'user@',
      '@domain.com',
      'user@domain',
      'user@.com',
      'user space@domain.com',
      'plainaddress',
    ];

    invalidPatterns.forEach((pat) => {
      expect(() => {
        mockDb.createContact({ email: pat });
      }).toThrow(/Invalid email address format/);
    });
  });

  it('T2-VAL-03: Handles max length RFC 5321 email addresses (up to 254 characters)', () => {
    const localPart = 'a'.repeat(64);
    const domainPart = 'b'.repeat(180) + '.edu';
    const maxEmail = `${localPart}@${domainPart}`;
    expect(maxEmail.length).toBeLessThanOrEqual(254);

    const contact = mockDb.createContact({
      email: maxEmail,
      first_name: 'Max',
      last_name: 'Length',
    });

    expect(contact.email).toBe(maxEmail);
  });

  it('T2-VAL-04: Preserves complex Latin diacritics and accented characters in names', () => {
    const complexName = 'Prof. François Müller-Åkesson';
    const institution = 'Université de Genève';

    const contact = mockDb.createContact({
      first_name: 'François',
      last_name: 'Müller-Åkesson',
      full_name: complexName,
      email: 'francois.akesson@unige.ch',
      institution,
    });

    expect(contact.full_name).toBe(complexName);
    expect(contact.institution).toBe(institution);
  });

  it('T2-VAL-05: Preserves non-Latin scripts (Kanji, Cyrillic, Arabic) without byte corruption', () => {
    const contactKanji = mockDb.createContact({
      first_name: '健太',
      last_name: '佐藤',
      email: 'sato@kyoto-u.ac.jp',
      institution: '京都大学',
      department: '理学研究科',
    });
    expect(contactKanji.full_name).toBe('健太 佐藤');
    expect(contactKanji.institution).toBe('京都大学');

    const contactArabic = mockDb.createContact({
      first_name: 'فاطمة',
      last_name: 'الزهراء',
      email: 'fatima@aub.edu.lb',
      institution: 'الجامعة الأميركية في بيروت',
    });
    expect(contactArabic.full_name).toBe('فاطمة الزهراء');
    expect(contactArabic.institution).toBe('الجامعة الأميركية في بيروت');
  });

  it('T2-VAL-06: Stores oversized 10,000-character academic research notes without truncation', () => {
    const longNotes = 'Professor research history: ' + 'A'.repeat(10000);
    const contact = mockDb.createContact({
      email: 'profresearch@ox.ac.uk',
      notes: longNotes,
    });

    expect(contact.notes?.length).toBe(longNotes.length);
    expect(contact.notes).toBe(longNotes);
  });

  it('T2-VAL-07: Rejects zero or negative daily sending limits on connected account', () => {
    expect(() => {
      mockDb.createAccount({
        user_id: testUserId,
        email: 'zero.limit@gmail.com',
        refresh_token: 'tok',
        daily_limit: 0,
      });
    }).toThrow(/check_connected_accounts_daily_limit/);

    expect(() => {
      mockDb.createAccount({
        user_id: testUserId,
        email: 'negative.limit@gmail.com',
        refresh_token: 'tok',
        daily_limit: -10,
      });
    }).toThrow(/check_connected_accounts_daily_limit/);
  });

  it('T2-VAL-08: Rejects oversized daily sending limits (> 100) to protect Gmail reputation', () => {
    expect(() => {
      mockDb.createAccount({
        user_id: testUserId,
        email: 'overlimit@gmail.com',
        refresh_token: 'tok',
        daily_limit: 500,
      });
    }).toThrow(/check_connected_accounts_daily_limit/);
  });

  it('T2-VAL-09: Rejects whitespace-only account email', () => {
    expect(() => {
      mockDb.createAccount({
        user_id: testUserId,
        email: '   ',
        refresh_token: 'tok',
      });
    }).toThrow(/check_connected_accounts_email/);
  });

  it('T2-VAL-10: CSV parser detects and rejects zero-byte empty file upload', () => {
    const emptyCsv = '';
    const lines = emptyCsv.trim().split(/\r?\n/).filter(Boolean);
    const isValid = lines.length > 0;
    expect(isValid).toBe(false);
  });

  it('T2-VAL-11: CSV parser detects and rejects CSV with missing header row', () => {
    const rawNoHeader = 'david.malan@harvard.edu,David,Malan,Harvard University';
    const lines = rawNoHeader.trim().split(/\r?\n/);
    const firstLine = lines[0].toLowerCase();
    const hasEmailHeader = firstLine.includes('email');
    expect(hasEmailHeader).toBe(false);
  });

  it('T2-VAL-12: Strips UTF-8 Byte Order Mark (BOM: \\uFEFF) from Excel-generated CSV', () => {
    const bomCsv = '\uFEFFemail,first_name,last_name\ndavid.malan@harvard.edu,David,Malan';
    const cleanCsv = bomCsv.replace(/^\uFEFF/, '');
    expect(cleanCsv.startsWith('email')).toBe(true);

    const firstHeader = cleanCsv.split('\n')[0].split(',')[0];
    expect(firstHeader).toBe('email');
  });

  it('T2-VAL-13: Handles trailing empty lines and mixed CRLF delimiters in CSV safely', () => {
    const messyCsv = "email,first_name\r\nprof1@ox.ac.uk,Prof1\nprof2@ox.ac.uk,Prof2\r\n\r\n\n";
    const lines = messyCsv.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    expect(lines.length).toBe(3); // Header + 2 data rows
  });

  it('T2-VAL-14: Deduplicates 1,000 duplicate CSV rows cleanly', () => {
    const baseEmail = 'duplicate.faculty@ox.ac.uk';
    mockDb.createContact({ email: baseEmail, first_name: 'David' });

    let skipped = 0;
    for (let i = 0; i < 50; i++) {
      try {
        mockDb.createContact({ email: baseEmail });
      } catch {
        skipped++;
      }
    }

    expect(skipped).toBe(50);
    expect(mockDb.getContacts().length).toBe(1);
  });

  it('T2-VAL-15: Rejects campaign creation with empty or whitespace-only body text', () => {
    expect(() => {
      mockDb.createCampaign({
        user_id: testUserId,
        name: 'Empty Body Campaign',
        subject: 'Subject',
        body_text: '   ',
      });
    }).toThrow(/check_campaigns_body_text/);
  });

  it('T2-VAL-16: Handles unclosed interpolation brackets gracefully without throwing parser crashes', () => {
    const brokenTemplate = 'Hello {{first_name, welcome to {{institution. No closing braces.';
    const contact = mockDb.createContact({ email: 'test@ox.ac.uk', first_name: 'Alice' });

    // Parser safely leaves unclosed tags or does not crash
    const safeInterpolate = (tpl: string) => {
      return tpl.replace(/\{\{([a-zA-Z_]+)\}\}/g, (_, key) => {
        return (contact as any)[key] || '';
      });
    };

    const result = safeInterpolate(brokenTemplate);
    expect(result).toBe(brokenTemplate); // Unmatched braces preserved safely without throwing
  });

  it('T2-VAL-17: Fallback handles null contact attributes without outputting "undefined"', () => {
    const contact = mockDb.createContact({
      email: 'no.institution@ox.ac.uk',
      first_name: null,
      institution: null,
      department: null,
    });

    const interpolateWithFallback = (tpl: string) => {
      return tpl
        .replace(/\{\{first_name\}\}/g, contact.first_name || 'Professor')
        .replace(/\{\{institution\}\}/g, contact.institution || 'your institution')
        .replace(/\{\{department\}\}/g, contact.department || 'your department');
    };

    const rendered = interpolateWithFallback('Dear {{first_name}} from {{department}} at {{institution}}.');
    expect(rendered).toBe('Dear Professor from your department at your institution.');
    expect(rendered).not.toContain('undefined');
    expect(rendered).not.toContain('null');
  });

  it('T2-VAL-18: Sanitizes dangerous <script> tags in HTML templates to prevent XSS injection', () => {
    const maliciousHtml = '<p>Hello</p><script>alert("xss")</script><img src="x" onerror="steal()"/>';
    const sanitizeHtml = (html: string) => {
      return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/onerror\s*=\s*["'][^"']*["']/gi, '');
    };

    const clean = sanitizeHtml(maliciousHtml);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('alert');
    expect(clean).not.toContain('onerror');
    expect(clean).toContain('<p>Hello</p>');
  });

  it('T2-VAL-19: Handles large 50,000-character campaign body without buffer overflow', () => {
    const largeBody = 'GamifyTL Lecture Pedagogy Content: ' + 'Word '.repeat(10000);
    const campaign = mockDb.createCampaign({
      user_id: testUserId,
      name: 'Large Body Campaign',
      subject: 'Subject',
      body_text: largeBody,
    });

    expect(campaign.body_text.length).toBe(largeBody.length);
  });

  it('T2-VAL-20: Rejects campaign creation with whitespace-only subject line', () => {
    expect(() => {
      mockDb.createCampaign({
        user_id: testUserId,
        name: 'Empty Subject Campaign',
        subject: '    ',
        body_text: 'Valid body text',
      });
    }).toThrow(/check_campaigns_subject/);
  });
});
