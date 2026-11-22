import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_1_PLAINTEXT,
  TEMPLATE_2_BRANDED_HTML,
  GAMIFYTL_BRAND,
  buildBrandedEmailHtml,
  emailBrandMarkHtml,
  emailCtaButton,
  convertHtmlToPlainText,
  interpolateVariables,
  validatePersonalizationFields,
  lintEmailContent,
  duplicateTemplate,
  restoreDefaultTemplate,
} from '../../src/lib/templates';
import { buildRfc2822Mime } from '../../src/lib/mime';

describe('GamifyTL Email Template System — Two Required Templates', () => {
  const mockProfessor = {
    first_name: 'David',
    last_name: 'Malan',
    full_name: 'David Malan',
    email: 'david.malan@harvard.edu',
    institution: 'Harvard University',
    department: 'Computer Science',
    academic_role: 'Professor of the Practice',
    country: 'United States',
  };

  describe('Template 1: Personalized Plain-Text Email', () => {
    it('is configured as pure text/plain with zero HTML markup', () => {
      expect(TEMPLATE_1_PLAINTEXT.format).toBe('plain');
      expect(TEMPLATE_1_PLAINTEXT.bodyHtml).toBeUndefined();
      expect(TEMPLATE_1_PLAINTEXT.bodyText).not.toContain('<p>');
      expect(TEMPLATE_1_PLAINTEXT.bodyText).not.toContain('<table');
      expect(TEMPLATE_1_PLAINTEXT.bodyText).not.toContain('<img');
      expect(TEMPLATE_1_PLAINTEXT.bodyText).not.toContain('<script');
    });

    it('contains personalized greeting, verified features, clear CTA, and professional signature', () => {
      const text = TEMPLATE_1_PLAINTEXT.bodyText;
      expect(text).toContain('Dear Professor {{last_name}},');
      expect(text).toContain('smartphone distraction');
      expect(text).toContain('Zero student app installs');
      expect(text).toContain('gamifytl.com/join');
      expect(text).toContain('Quiz Battles');
      expect(text).toContain('Resource Drop');
      expect(text).toContain('Free educator plan');
      expect(text).toContain('https://gamifytl.com/');
      expect(text).toContain('NorthNode Technologies');
      expect(text).toContain('support@northnode.live');
    });

    it('interpolates professor variables cleanly without unescaped tags', () => {
      const resolvedSubject = interpolateVariables(TEMPLATE_1_PLAINTEXT.subject, mockProfessor);
      const resolvedBody = interpolateVariables(TEMPLATE_1_PLAINTEXT.bodyText, mockProfessor);

      expect(resolvedSubject).toContain('Computer Science');
      expect(resolvedSubject).toContain('Harvard University');
      expect(resolvedBody).toContain('Dear Professor Malan,');
      expect(resolvedBody).toContain('work in the Computer Science at Harvard University.');
      expect(resolvedBody).not.toContain('{{');
      expect(resolvedBody).not.toContain('}}');
    });

    it('passes verified claims linting with zero violations', () => {
      const lint = lintEmailContent(TEMPLATE_1_PLAINTEXT.bodyText);
      expect(lint.valid).toBe(true);
      expect(lint.violations).toHaveLength(0);
    });

    it('generates standard RFC 2822 pure text/plain MIME message', () => {
      const mime = buildRfc2822Mime({
        fromEmail: 'outreach@northnode.live',
        fromName: 'GamifyTL Outreach',
        toEmail: mockProfessor.email,
        toName: mockProfessor.full_name,
        subject: interpolateVariables(TEMPLATE_1_PLAINTEXT.subject, mockProfessor),
        bodyText: interpolateVariables(TEMPLATE_1_PLAINTEXT.bodyText, mockProfessor),
      });

      expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
      expect(mime).not.toContain('multipart/alternative');
      expect(mime).toContain('Dear Professor Malan,');
    });
  });

  describe('Template 2: Official GamifyTL Branded HTML Email', () => {
    it('is configured as html format and generates both HTML and plain-text fallback', () => {
      expect(TEMPLATE_2_BRANDED_HTML.format).toBe('html');
      expect(TEMPLATE_2_BRANDED_HTML.bodyHtml).toBeDefined();
      expect(TEMPLATE_2_BRANDED_HTML.bodyText).toBeDefined();
      expect(TEMPLATE_2_BRANDED_HTML.bodyText.length).toBeGreaterThan(100);
    });

    it('uses official GamifyTL brand assets and color specifications', () => {
      const html = TEMPLATE_2_BRANDED_HTML.bodyHtml || '';
      expect(html).toContain(GAMIFYTL_BRAND.logoWhite);
      expect(html).toContain(GAMIFYTL_BRAND.colors.deepBlack); // #111111
      expect(html).toContain(GAMIFYTL_BRAND.colors.red);       // #ff3b30
      expect(html).toContain(GAMIFYTL_BRAND.colors.outerBackground); // #f4f5f7
      expect(html).toContain(GAMIFYTL_BRAND.colors.border);    // #e5e7eb
    });

    it('incorporates table-based email safe structure and dark header', () => {
      const html = TEMPLATE_2_BRANDED_HTML.bodyHtml || '';
      expect(html).toContain('<table role="presentation"');
      expect(html).toContain('max-width:560px');
      expect(html).toContain('border-radius:16px 16px 0 0'); // Dark header top radius
      expect(html).toContain('border-radius:0 0 16px 16px'); // White card bottom radius
    });

    it('includes verified company contact information and support in footer', () => {
      const html = TEMPLATE_2_BRANDED_HTML.bodyHtml || '';
      expect(html).toContain(GAMIFYTL_BRAND.legalName);
      expect(html).toContain(GAMIFYTL_BRAND.address);
      expect(html).toContain(GAMIFYTL_BRAND.supportEmail);
      expect(html).toContain(GAMIFYTL_BRAND.gstin);
    });

    it('generates standard RFC 2822 multipart/alternative MIME with plain text fallback', () => {
      const mime = buildRfc2822Mime({
        fromEmail: 'outreach@northnode.live',
        fromName: 'GamifyTL Outreach',
        toEmail: mockProfessor.email,
        toName: mockProfessor.full_name,
        subject: interpolateVariables(TEMPLATE_2_BRANDED_HTML.subject, mockProfessor),
        bodyText: interpolateVariables(TEMPLATE_2_BRANDED_HTML.bodyText, mockProfessor),
        bodyHtml: interpolateVariables(TEMPLATE_2_BRANDED_HTML.bodyHtml || '', mockProfessor),
      });

      expect(mime).toContain('Content-Type: multipart/alternative; boundary=');
      expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
      expect(mime).toContain('Content-Type: text/html; charset=UTF-8');
      expect(mime).toContain('Dear Professor Malan,');
      expect(mime).toContain('Explore GamifyTL Live Demo');
    });
  });

  describe('Template Management & Editor Capabilities', () => {
    it('validates personalization fields and detects missing contact data', () => {
      const templateText = 'Dear {{first_name}} {{last_name}} at {{institution}} in {{department}}';
      const contactsSample = [
        { first_name: 'Alice', last_name: 'Smith', institution: 'MIT', department: 'Physics' },
        { first_name: 'Bob', last_name: 'Jones', institution: 'Stanford', department: '' }, // Missing department
      ];

      const validation = validatePersonalizationFields(templateText, contactsSample);
      expect(validation.isValid).toBe(false);
      expect(validation.usedVariables).toContain('{{department}}');
      expect(validation.usedVariables).toContain('{{institution}}');
      expect(validation.details).toHaveLength(1);
      expect(validation.details[0].variable).toBe('{{department}}');
      expect(validation.details[0].fallbackValue).toBe('your department');
    });

    it('converts HTML content to clean structured plain text', () => {
      const sampleHtml = `
        <p>Hello Professor,</p>
        <p>Visit <a href="https://gamifytl.com">GamifyTL</a> for interactive games.</p>
        <ul>
          <li>Zero student installs</li>
          <li>Resource Drop</li>
        </ul>
      `;
      const plainText = convertHtmlToPlainText(sampleHtml);
      expect(plainText).toContain('Hello Professor,');
      expect(plainText).toContain('GamifyTL (https://gamifytl.com)');
      expect(plainText).toContain('- Zero student installs');
      expect(plainText).toContain('- Resource Drop');
      expect(plainText).not.toContain('<p>');
      expect(plainText).not.toContain('<ul>');
    });

    it('duplicates a template with a custom name and unique ID', () => {
      const duplicate = duplicateTemplate(TEMPLATE_1_PLAINTEXT, 'Custom CS Outreach');
      expect(duplicate.id).not.toBe(TEMPLATE_1_PLAINTEXT.id);
      expect(duplicate.name).toBe('Custom CS Outreach');
      expect(duplicate.isCustom).toBe(true);
      expect(duplicate.subject).toBe(TEMPLATE_1_PLAINTEXT.subject);
    });

    it('restores default factory templates accurately', () => {
      const restoredPlain = restoreDefaultTemplate('template_plaintext');
      expect(restoredPlain.subject).toBe(TEMPLATE_1_PLAINTEXT.subject);

      const restoredHtml = restoreDefaultTemplate('template_branded_html');
      expect(restoredHtml.subject).toBe(TEMPLATE_2_BRANDED_HTML.subject);
    });
  });
});
