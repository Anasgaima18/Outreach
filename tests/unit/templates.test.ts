import { describe, it, expect } from 'vitest';
import {
  GAMIFYTL_TEMPLATES,
  interpolateVariables,
  lintEmailContent,
} from '../../src/lib/templates';

describe('Templates & Email Content Unit Tests (src/lib/templates.ts)', () => {
  describe('Verified GamifyTL Template Integrity', () => {
    it('verifies Template A (engagement) focuses on smartphone distraction, 8 games, and zero app installs', () => {
      const tpl = GAMIFYTL_TEMPLATES.templateA_engagement;
      expect(tpl).toBeDefined();
      expect(tpl.subject).toContain('GamifyTL');
      expect(tpl.subject).toContain('{{department}}');
      expect(tpl.subject).toContain('{{institution}}');
      expect(tpl.bodyText).toContain('smartphone distraction');
      expect(tpl.bodyText).toContain('Zero student app installs');
      expect(tpl.bodyText).toContain('gamifytl.com/join');
      expect(tpl.bodyText).toContain('Quiz Battle');
      expect(tpl.bodyText).toContain('Resource Drop');

      const lint = lintEmailContent(tpl.bodyText);
      expect(lint.valid).toBe(true);
      expect(lint.violations).toHaveLength(0);
    });

    it('verifies Template B (zero install) focuses on QR code join under 3s and browser compatibility', () => {
      const tpl = GAMIFYTL_TEMPLATES.templateB_zeroInstall;
      expect(tpl).toBeDefined();
      expect(tpl.bodyText).toContain('zero-install');
      expect(tpl.bodyText).toContain('QR code');
      expect(tpl.bodyText).toContain('gamifytl.com/join');
      expect(tpl.bodyText).not.toContain('app store');

      const lint = lintEmailContent(tpl.bodyText);
      expect(lint.valid).toBe(true);
      expect(lint.violations).toHaveLength(0);
    });

    it('verifies Template C (resource drop) focuses on direct file distribution without LMS login barriers', () => {
      const tpl = GAMIFYTL_TEMPLATES.templateC_resourceDrop;
      expect(tpl).toBeDefined();
      expect(tpl.bodyText).toContain('Resource Drop');
      expect(tpl.bodyText).toContain('push files directly');
      expect(tpl.bodyText).toContain('LMS logins');

      const lint = lintEmailContent(tpl.bodyText);
      expect(lint.valid).toBe(true);
      expect(lint.violations).toHaveLength(0);
    });

    it('verifies Follow-up template maintains professional and concise tone', () => {
      const tpl = GAMIFYTL_TEMPLATES.followUp;
      expect(tpl).toBeDefined();
      expect(tpl.subject).toContain('Re:');
      expect(tpl.bodyText).toContain('https://gamifytl.com/');

      const lint = lintEmailContent(tpl.bodyText);
      expect(lint.valid).toBe(true);
      expect(lint.violations).toHaveLength(0);
    });
  });

  describe('Variable Interpolation Engine', () => {
    const mockContact = {
      id: 'cnt-1',
      user_id: 'usr-1',
      first_name: 'David',
      last_name: 'Malan',
      full_name: 'David Malan',
      email: 'david.malan@harvard.edu',
      institution: 'Harvard University',
      department: 'Computer Science',
      academic_role: 'Professor of the Practice',
      country: 'United States',
      website: 'https://cs50.harvard.edu',
      contact_source: 'manual',
      notes: null,
      status: 'active' as const,
      created_at: '2026-11-22T00:00:00Z',
      updated_at: '2026-11-22T00:00:00Z',
    };

    it('interpolates all standard contact attributes into template placeholders', () => {
      const template = 'Dear {{first_name}} {{last_name}}, regarding {{department}} at {{institution}} in {{country}}.';
      const resolved = interpolateVariables(template, mockContact);
      expect(resolved).toBe('Dear David Malan, regarding Computer Science at Harvard University in United States.');
    });

    it('uses sensible fallback defaults when contact attributes are missing', () => {
      const emptyContact = {
        email: 'prof@unknown.edu',
      };
      const template = 'Dear {{first_name}} {{last_name}}, regarding {{department}} at {{institution}}.';
      const resolved = interpolateVariables(template, emptyContact);
      expect(resolved).toBe('Dear Professor Colleague, regarding your department at your institution.');
    });

    it('handles null contact gracefully', () => {
      const template = 'Dear {{first_name}}, welcome to {{institution}}.';
      const resolved = interpolateVariables(template, null);
      expect(resolved).toBe('Dear Professor, welcome to your institution.');
    });

    it('handles empty template string gracefully', () => {
      expect(interpolateVariables('', mockContact)).toBe('');
    });
  });

  describe('Claim Linter Rules', () => {
    it('flags unverified student numbers and fake partnership claims', () => {
      const text = 'GamifyTL is used by millions of students across 500 universities and endorsed by Harvard!';
      const lint = lintEmailContent(text);
      expect(lint.valid).toBe(false);
      expect(lint.violations).toContain('Unverified student count claim');
      expect(lint.violations).toContain('Fabricated institutional partnership count');
      expect(lint.violations).toContain('Fabricated university endorsement');
    });

    it('flags deliverability guarantees and AI buzzword violations', () => {
      const text = 'Our revolutionary AI-powered tool guarantees 100% inbox placement!';
      const lint = lintEmailContent(text);
      expect(lint.valid).toBe(false);
      expect(lint.violations).toContain('Violates AI exclusion constraint');
      expect(lint.violations).toContain('Unrealistic deliverability guarantee');
    });

    it('passes verified factual claims about GamifyTL features', () => {
      const text = 'GamifyTL features 8 interactive classroom games including Quiz Battle and Resource Drop with zero student app installs.';
      const lint = lintEmailContent(text);
      expect(lint.valid).toBe(true);
      expect(lint.violations).toHaveLength(0);
    });
  });
});
