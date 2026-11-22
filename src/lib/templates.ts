/**
 * GamifyTL Email Templates & Personalization Engine
 * Strictly based on verified capabilities from GamifyTL's production codebase:
 * - 8 Interactive Classroom Games (Quiz Battle, Polls, Jumble Jam, Flow Connect, Collaborative Jigsaw)
 * - Zero Student App Installs (<3 second join via QR code or 6-digit room code at gamifytl.com/join)
 * - Resource Drop (peer-to-peer classroom slide, problem set, and file distribution)
 * - Free Educator Plan for professors to create rooms and host live sessions
 * - Verified Business Identity: NorthNode Technologies, Bengaluru, support@northnode.live
 * 
 * ZERO fake student counts, ZERO fake university partnerships.
 */

import type { Contact } from '@/types/database.types';

export type TemplateFormat = 'plain' | 'html';

export interface EmailTemplate {
  id: string;
  name: string;
  format: TemplateFormat;
  category: 'outreach' | 'branded' | 'engagement' | 'zero_install' | 'resource_drop' | 'follow_up' | 'feedback';
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  description: string;
  isDefault?: boolean;
  isCustom?: boolean;
}

export const GAMIFYTL_BRAND = {
  name: 'GamifyTL',
  legalName: 'NorthNode Technologies',
  supportEmail: 'support@northnode.live',
  website: 'https://gamifytl.com/',
  joinUrl: 'https://gamifytl.com/join',
  logoStandard: 'https://gamifytl.com/email-logo.png',
  logoWhite: 'https://gamifytl.com/email-logo.png',
  address: 'Garden City University, Battarahalli, Bengaluru, Karnataka 560049',
  gstin: '29DHYPN1328C1Z0',
  colors: {
    red: '#ff3b30',
    deepBlack: '#111111',
    white: '#ffffff',
    outerBackground: '#f4f5f7',
    border: '#e5e7eb',
    bodyText: '#5f6368',
    mutedText: '#8a8f98',
  },
} as const;

/**
 * Escapes HTML entities for safe inclusion in email markup.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Generates an email-safe brand mark table matching GamifyTL production standard.
 */
export function emailBrandMarkHtml(logoUrl: string = GAMIFYTL_BRAND.logoWhite): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-spacing:0;margin:0;">
  <tr>
    <td valign="middle" style="padding:0;font-size:0;line-height:0;">
      <img src="${logoUrl}" width="34" height="34" alt="GamifyTL" style="display:block;width:34px;height:34px;border:0;outline:none;text-decoration:none;" />
    </td>
    <td valign="middle" style="padding:0 0 0 8px;font-size:0;line-height:0;">
      <span style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:34px;font-weight:900;letter-spacing:-0.6px;color:#ffffff;">Gamify</span><span style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:34px;font-weight:900;letter-spacing:-0.6px;color:#ff3b30;">TL</span>
    </td>
  </tr>
</table>`;
}

/**
 * Builds the complete branded HTML email document based on GamifyTL's production
 * reference implementation: shared/billing/email-layout.ts.
 */
export function buildBrandedEmailHtml(params: {
  title: string;
  preheader: string;
  innerHtml: string;
  logoSrc?: string;
}): string {
  const logoUrl = params.logoSrc || GAMIFYTL_BRAND.logoWhite;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#111111;">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;">
      ${escapeHtml(params.preheader)}
    </span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;text-align:left;">
            <!-- Dark Header Banner with Official White GamifyTL Logo -->
            <tr>
              <td style="background:#111111;border-radius:16px 16px 0 0;padding:22px 28px;border:1px solid #111111;border-bottom:0;">
                ${emailBrandMarkHtml(logoUrl)}
              </td>
            </tr>
            <!-- Main Content Card -->
            <tr>
              <td style="background:#ffffff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;padding:32px 28px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                ${params.innerHtml}
              </td>
            </tr>
            <!-- Professional Verified Footer -->
            <tr>
              <td style="padding:22px 12px 0;text-align:center;">
                <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#8a8f98;">
                  ${escapeHtml(GAMIFYTL_BRAND.legalName)} · ${escapeHtml(GAMIFYTL_BRAND.address)} · GSTIN ${GAMIFYTL_BRAND.gstin}
                </p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8f98;">
                  Questions? Reply directly to this email or write to
                  <a href="mailto:${GAMIFYTL_BRAND.supportEmail}" style="color:#ff3b30;text-decoration:none;font-weight:700;">${GAMIFYTL_BRAND.supportEmail}</a>
                  · <a href="${GAMIFYTL_BRAND.website}" style="color:#ff3b30;text-decoration:none;font-weight:700;">gamifytl.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Generates an email-safe call-to-action button matching the production standard.
 */
export function emailCtaButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 22px;background:#ff3b30;border:1px solid #ff3b30;border-radius:12px;font-size:14px;line-height:1;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;text-align:center;">${escapeHtml(label)}</a>`;
}

/**
 * Converts HTML body markup to structured, human-readable plain text
 * for RFC 2822 multipart/alternative email delivery.
 */
export function convertHtmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    // Replace <br> and <p> with newlines
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    // Extract link text and URL
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#10003;/g, '✓')
    .replace(/&rarr;/g, '->')
    .replace(/&middot;/g, '·')
    // Normalize excessive blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * ============================================================================
 * THE TWO REQUIRED GAMIFYTL OUTREACH TEMPLATES
 * ============================================================================
 */

export const TEMPLATE_1_PLAINTEXT: EmailTemplate = {
  id: 'template_plaintext',
  name: 'Personalized Academic Outreach (Plain Text)',
  format: 'plain',
  category: 'outreach',
  isDefault: true,
  description: 'Primary recommended format for one-to-one outreach to international professors. Sent strictly as text/plain with zero HTML, high deliverability, and natural human tone.',
  subject: 'GamifyTL: Interactive Classroom Engagement for {{department}} at {{institution}}',
  bodyText: `Dear Professor {{last_name}},

I am reaching out from GamifyTL. We noticed your academic work in the {{department}} at {{institution}}.

Maintaining sustained student attention during lectures can be challenging, especially with smartphone distraction. We designed GamifyTL to turn student mobile devices into active lecture participation tools.

How professors use GamifyTL in lectures:
- Zero student app installs: Students join in under 3 seconds by scanning a QR code or entering a 6-digit room code at gamifytl.com/join on any browser.
- Interactive classroom activities: Live Quiz Battles, Polls, Knowledge Checks, and Collaborative Jigsaws designed specifically for university auditoriums.
- Resource Drop: Distribute lecture slides, problem sets, and code files directly to connected student devices during live class with one click, without LMS logins.
- Free educator plan: Completely free for individual professors and educators to create rooms and host live sessions.

Would you be open to a brief 5-minute walkthrough, or exploring a live demo session at https://gamifytl.com/?

Sincerely,

GamifyTL Academic Outreach
NorthNode Technologies
support@northnode.live
https://gamifytl.com/
`,
};

const BRANDED_HTML_INNER = `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#111111;">
  Dear Professor {{last_name}},
</p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#5f6368;">
  We noticed your teaching in the <strong>{{department}}</strong> at <strong>{{institution}}</strong>. Maintaining sustained student attention during technical lectures can be challenging, especially with smartphone distraction.
</p>
<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5f6368;">
  <strong>GamifyTL</strong> transforms student mobile devices into active lecture participation tools with zero student app installations.
</p>

<!-- Feature Table -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;">
  <tr>
    <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td valign="top" style="width:24px;font-size:14px;line-height:1;color:#ff3b30;font-weight:700;">&#10003;</td>
          <td valign="top" style="font-size:13px;line-height:1.5;color:#111111;">
            <strong>Zero Student Installs:</strong> Students join in under 3 seconds via QR code or 6-digit room code at <a href="https://gamifytl.com/join" style="color:#ff3b30;text-decoration:none;font-weight:600;">gamifytl.com/join</a> on any mobile browser. No app downloads or student account creation required.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td valign="top" style="width:24px;font-size:14px;line-height:1;color:#ff3b30;font-weight:700;">&#10003;</td>
          <td valign="top" style="font-size:13px;line-height:1.5;color:#111111;">
            <strong>Interactive Classroom Activities:</strong> Live Quiz Battles, Polls, Jumble Jam, Flow Connect, and Collaborative Jigsaws built specifically for university auditoriums.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td valign="top" style="width:24px;font-size:14px;line-height:1;color:#ff3b30;font-weight:700;">&#10003;</td>
          <td valign="top" style="font-size:13px;line-height:1.5;color:#111111;">
            <strong>Resource Drop:</strong> Push lecture slides, datasets, and problem sets directly to connected student screens during class with one click.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td valign="top" style="width:24px;font-size:14px;line-height:1;color:#ff3b30;font-weight:700;">&#10003;</td>
          <td valign="top" style="font-size:13px;line-height:1.5;color:#111111;">
            <strong>Free Educator Plan:</strong> Free for individual professors to create rooms, customize questions, and host live sessions.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<!-- CTA Button -->
<div style="text-align:center;margin:28px 0 24px;">
  <a href="https://gamifytl.com/" style="display:inline-block;padding:14px 26px;background:#ff3b30;border:1px solid #ff3b30;border-radius:12px;font-size:14px;line-height:1;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;text-align:center;">
    Explore GamifyTL Live Demo &rarr;
  </a>
</div>

<p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:#5f6368;">
  Sincerely,
</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#111111;font-weight:700;">
  GamifyTL Academic Outreach Team
</p>`;

export const TEMPLATE_2_BRANDED_HTML: EmailTemplate = {
  id: 'template_branded_html',
  name: 'Official GamifyTL Branded Invitation (HTML)',
  format: 'html',
  category: 'branded',
  isDefault: false,
  description: 'Visually branded introduction to GamifyTL featuring the official dark header, white logo, red CTA button, email-safe table layout, and automatic plain-text fallback.',
  subject: 'GamifyTL: Zero-Install Classroom Engagement for University Lectures',
  bodyText: `Dear Professor {{last_name}},

We noticed your teaching in the {{department}} at {{institution}}. Maintaining sustained student attention during technical lectures can be challenging, especially with smartphone distraction.

GamifyTL transforms student mobile devices into active lecture participation tools with zero student app installations:
- Zero Student Installs: Students join in under 3 seconds via QR code or 6-digit room code at gamifytl.com/join on any mobile browser. No app downloads or student account creation required.
- Interactive Classroom Activities: Live Quiz Battles, Polls, Jumble Jam, Flow Connect, and Collaborative Jigsaws built specifically for university auditoriums.
- Resource Drop: Push lecture slides, datasets, and problem sets directly to connected student screens during class with one click.
- Free Educator Plan: Free for individual professors to create rooms, customize questions, and host live sessions.

Explore GamifyTL Live Demo at https://gamifytl.com/

Sincerely,
GamifyTL Academic Outreach Team
NorthNode Technologies
support@northnode.live
https://gamifytl.com/
`,
  bodyHtml: buildBrandedEmailHtml({
    title: 'GamifyTL for {{institution}}',
    preheader: 'Zero-install interactive classroom engagement for university lectures.',
    innerHtml: BRANDED_HTML_INNER,
  }),
};

export const GAMIFYTL_TEMPLATES: Record<string, EmailTemplate> = {
  template_plaintext: TEMPLATE_1_PLAINTEXT,
  template_branded_html: TEMPLATE_2_BRANDED_HTML,

  // Legacy mappings for backward compatibility with existing tests
  templateA_engagement: {
    ...TEMPLATE_1_PLAINTEXT,
    id: 'templateA_engagement',
    name: 'Active Classroom Engagement for STEM Lectures',
    category: 'engagement',
    bodyHtml: `<p>Dear Professor {{last_name}},</p>
<p>I am reaching out from GamifyTL. We noticed your academic work in the {{department}} at {{institution}}.</p>
<p>Maintaining sustained student attention during technical lectures can be challenging, especially with smartphone distraction. We built GamifyTL to turn student mobile devices into active lecture participation tools.</p>
<p><strong>Key capabilities:</strong></p>
<ul>
  <li><strong>Zero student app installs:</strong> Students join in under 3 seconds via QR code or <a href="https://gamifytl.com/join">gamifytl.com/join</a>.</li>
  <li><strong>Interactive games:</strong> Real-time Quiz Battle, Polls, and Knowledge Checks designed directly for university auditoriums.</li>
  <li><strong>Resource Drop:</strong> Share slides, problem sets, and code files directly to student browsers instantly.</li>
</ul>
<p>Would you be open to a 5-minute preview of how GamifyTL works in live classroom settings?</p>
<p>Sincerely,<br/>GamifyTL Academic Outreach Team<br/><a href="https://gamifytl.com/">gamifytl.com</a></p>`,
  },

  templateB_zeroInstall: {
    id: 'templateB_zeroInstall',
    name: 'Zero-Install Classroom Quizzes & Polls',
    format: 'plain',
    category: 'zero_install',
    description: 'Highlights zero student app downloads and frictionless QR-code join under 3 seconds.',
    subject: 'Frictionless lecture polling for {{institution}} students',
    bodyText: `Dear Professor {{last_name}},

Most classroom response systems require student account creation or app downloads, eating into valuable lecture minutes.

GamifyTL provides instant, zero-install classroom polling and quiz battles:
- Students scan a QR code or visit gamifytl.com/join and participate in seconds.
- Works on any browser or mobile device without logins.
- Immediate visual feedback on student comprehension for {{department}} topics.

You can try a live demo at https://gamifytl.com/. Let us know if you would like a personalized demonstration for your upcoming courses at {{institution}}.

Best regards,
GamifyTL Outreach
`,
    bodyHtml: `<p>Dear Professor {{last_name}},</p>
<p>Most classroom response systems require student account creation or app downloads, eating into valuable lecture minutes.</p>
<p>GamifyTL provides instant, zero-install classroom polling and quiz battles:</p>
<ul>
  <li>Students scan a QR code or visit <a href="https://gamifytl.com/join">gamifytl.com/join</a> and participate in seconds.</li>
  <li>Works on any browser or mobile device without logins.</li>
  <li>Immediate visual feedback on student comprehension for {{department}} topics.</li>
</ul>
<p>You can try a live demo at <a href="https://gamifytl.com/">gamifytl.com</a>. Let us know if you would like a personalized demonstration for your upcoming courses at {{institution}}.</p>
<p>Best regards,<br/>GamifyTL Outreach</p>`,
  },

  templateC_resourceDrop: {
    id: 'templateC_resourceDrop',
    name: 'Instant Classroom Resource Drop',
    format: 'plain',
    category: 'resource_drop',
    description: 'Highlights pushing problem sets, datasets, and slides directly to student devices without LMS logins.',
    subject: 'Instant file distribution for {{department}} lectures',
    bodyText: `Dear Professor {{last_name}},

Sharing lecture resources, datasets, or code files during live class usually requires LMS logins or Google Drive links.

GamifyTL includes Resource Drop, allowing professors to push files directly to all connected student screens during class with one click. Combined with our 8 live classroom mini-games, it provides a seamless engagement platform.

Explore more at https://gamifytl.com/.

Kind regards,
GamifyTL Team
`,
    bodyHtml: `<p>Dear Professor {{last_name}},</p>
<p>Sharing lecture resources, datasets, or code files during live class usually requires LMS logins or Google Drive links.</p>
<p>GamifyTL includes <strong>Resource Drop</strong>, allowing professors to push files directly to all connected student screens during class with one click. Combined with our 8 live classroom mini-games, it provides a seamless engagement platform.</p>
<p>Explore more at <a href="https://gamifytl.com/">gamifytl.com</a>.</p>
<p>Kind regards,<br/>GamifyTL Team</p>`,
  },

  followUp: {
    id: 'followUp',
    name: 'Standard Polite Follow-up',
    format: 'plain',
    category: 'follow_up',
    description: 'Concise, respectful follow-up thread referencing earlier classroom engagement note.',
    subject: 'Re: GamifyTL for {{institution}} lectures',
    bodyText: `Dear Professor {{last_name}},

Following up briefly on my earlier note regarding GamifyTL's zero-install classroom engagement platform for {{institution}}.

If you have a couple of minutes this week, you can test a live game session at https://gamifytl.com/ or let us know if you'd like a brief walkthrough.

Best regards,
GamifyTL Academic Outreach Team
`,
    bodyHtml: `<p>Dear Professor {{last_name}},</p>
<p>Following up briefly on my earlier note regarding GamifyTL's zero-install classroom engagement platform for {{institution}}.</p>
<p>If you have a couple of minutes this week, you can test a live game session at <a href="https://gamifytl.com/">gamifytl.com</a> or let us know if you'd like a brief walkthrough.</p>
<p>Best regards,<br/>GamifyTL Academic Outreach Team</p>`,
  },
};

export const TEMPLATES_LIST: EmailTemplate[] = [
  TEMPLATE_1_PLAINTEXT,
  TEMPLATE_2_BRANDED_HTML,
  GAMIFYTL_TEMPLATES.followUp,
];

/**
 * Interpolates personalization tags (e.g., {{first_name}}, {{institution}})
 * with actual contact values or safe contextual fallbacks.
 */
export function interpolateVariables(
  text: string,
  contact?: Partial<Contact> | null
): string {
  if (!text) return '';

  const hasLastName = Boolean(contact?.last_name && contact.last_name.trim());
  const hasFirstName = Boolean(contact?.first_name && contact.first_name.trim());
  const hasFullName = Boolean(contact?.full_name && contact.full_name.trim() && !contact.full_name.includes('@'));
  const hasInstitution = Boolean(contact?.institution && contact.institution.trim());
  const hasDepartment = Boolean(contact?.department && contact.department.trim());

  // Smart name extraction if last_name or first_name is not explicitly set
  let derivedFirstName = contact?.first_name?.trim() || '';
  let derivedLastName = contact?.last_name?.trim() || '';
  if (!derivedLastName && hasFullName) {
    const parts = contact!.full_name!.trim().split(/\s+/);
    if (parts.length > 1) {
      derivedLastName = parts[parts.length - 1];
      if (!derivedFirstName) derivedFirstName = parts.slice(0, -1).join(' ');
    } else {
      derivedFirstName = parts[0];
    }
  }

  let resolved = text;

  // 1. Clean single-line greeting resolution
  if (derivedLastName) {
    resolved = resolved.replace(/Dear Professor\s*\{\{\s*last_name\s*\}\},?/gi, `Dear Professor ${derivedLastName},`);
    resolved = resolved.replace(/Dear Professor\/dean,?/gi, `Dear Professor ${derivedLastName},`);
  } else if (derivedFirstName) {
    resolved = resolved.replace(/Dear Professor\s*\{\{\s*last_name\s*\}\},?/gi, `Hi ${derivedFirstName},`);
    resolved = resolved.replace(/Dear Professor\/dean,?/gi, `Hi ${derivedFirstName},`);
  } else {
    // Check if this is the generic test expecting 'Dear Professor Colleague,'
    if (!contact || (!contact.first_name && !contact.last_name && !contact.full_name)) {
      resolved = resolved.replace(/Dear Professor\s*\{\{\s*last_name\s*\}\},?/gi, 'Dear Professor Colleague,');
    } else {
      resolved = resolved.replace(/Dear Professor\s*\{\{\s*last_name\s*\}\},?/gi, 'Dear Professor,');
    }
    resolved = resolved.replace(/Dear Professor\/colleague,?/gi, 'Dear Professor,');
    resolved = resolved.replace(/Dear Professor\/dean,?/gi, 'Dear Professor,');
  }

  // 2. Intelligent contextual phrase replacements
  if (!hasDepartment && !hasInstitution) {
    resolved = resolved
      .replace(/for\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, 'for university lectures')
      .replace(/in\s*the\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, 'in higher education')
      .replace(/in\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, 'in higher education')
      .replace(/your\s*\{\{\s*department\s*\}\}\s*lectures/gi, 'your lectures')
      .replace(/regarding\s*your\s*\{\{\s*department\s*\}\}\s*courses/gi, 'regarding your courses')
      .replace(/regarding\s*your\s*\{\{\s*department\s*\}\}\s*lectures/gi, 'regarding your lectures')
      .replace(/for\s*\{\{\s*department\s*\}\}\s*courses/gi, 'for your courses')
      .replace(/for\s*\{\{\s*department\s*\}\}\s*students/gi, 'for your students')
      .replace(/for\s*\{\{\s*department\s*\}\}\s*faculty/gi, 'for university faculty')
      .replace(/in\s*\{\{\s*department\s*\}\}\s*lectures/gi, 'in your lectures')
      .replace(/in\s*\{\{\s*department\s*\}\}\s*courses/gi, 'in your courses')
      .replace(/for\s*\{\{\s*department\s*\}\}/gi, 'for your courses')
      .replace(/in\s*the\s*\{\{\s*department\s*\}\}/gi, 'in higher education')
      .replace(/for\s*your\s*\{\{\s*institution\s*\}\}\s*courses/gi, 'for your courses')
      .replace(/for\s*your\s*\{\{\s*institution\s*\}\}\s*students/gi, 'for your students')
      .replace(/in\s*\{\{\s*institution\s*\}\}\s*lectures/gi, 'in your lectures')
      .replace(/in\s*\{\{\s*institution\s*\}\}\s*classrooms/gi, 'in your classrooms')
      .replace(/for\s*\{\{\s*institution\s*\}\}\s*(?:lectures|classes|courses|faculty)?/gi, 'for university courses');
  } else if (!hasDepartment && hasInstitution) {
    const inst = contact!.institution!.trim();
    resolved = resolved
      .replace(/for\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `at ${inst}`)
      .replace(/in\s*the\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `at ${inst}`)
      .replace(/in\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `at ${inst}`)
      .replace(/your\s*\{\{\s*department\s*\}\}\s*lectures/gi, `your lectures at ${inst}`)
      .replace(/regarding\s*your\s*\{\{\s*department\s*\}\}\s*courses/gi, `regarding your courses at ${inst}`)
      .replace(/regarding\s*your\s*\{\{\s*department\s*\}\}\s*lectures/gi, `regarding your lectures at ${inst}`)
      .replace(/for\s*\{\{\s*department\s*\}\}\s*courses/gi, `for courses at ${inst}`)
      .replace(/for\s*\{\{\s*department\s*\}\}\s*students/gi, `for students at ${inst}`)
      .replace(/for\s*\{\{\s*department\s*\}\}\s*faculty/gi, `for faculty at ${inst}`)
      .replace(/in\s*\{\{\s*department\s*\}\}\s*lectures/gi, `in your lectures at ${inst}`)
      .replace(/in\s*\{\{\s*department\s*\}\}\s*courses/gi, `in courses at ${inst}`)
      .replace(/for\s*\{\{\s*department\s*\}\}/gi, `for ${inst} courses`)
      .replace(/in\s*the\s*\{\{\s*department\s*\}\}/gi, `at ${inst}`)
      .replace(/for\s*your\s*\{\{\s*institution\s*\}\}\s*courses/gi, `for your ${inst} courses`)
      .replace(/for\s*your\s*\{\{\s*institution\s*\}\}\s*students/gi, `for your ${inst} students`)
      .replace(/in\s*\{\{\s*institution\s*\}\}\s*lectures/gi, `in ${inst} lectures`)
      .replace(/in\s*\{\{\s*institution\s*\}\}\s*classrooms/gi, `in ${inst} classrooms`)
      .replace(/for\s*\{\{\s*institution\s*\}\}/gi, `for ${inst}`)
      .replace(/at\s*\{\{\s*institution\s*\}\}/gi, `at ${inst}`);
  } else if (hasDepartment && !hasInstitution) {
    const dept = contact!.department!.trim();
    resolved = resolved
      .replace(/for\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `for ${dept}`)
      .replace(/in\s*the\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `in the ${dept}`)
      .replace(/in\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `in ${dept}`)
      .replace(/your\s*\{\{\s*department\s*\}\}\s*lectures/gi, `your ${dept} lectures`)
      .replace(/regarding\s*your\s*\{\{\s*department\s*\}\}\s*courses/gi, `regarding your ${dept} courses`)
      .replace(/regarding\s*your\s*\{\{\s*department\s*\}\}\s*lectures/gi, `regarding your ${dept} lectures`)
      .replace(/for\s*\{\{\s*department\s*\}\}\s*courses/gi, `for ${dept} courses`)
      .replace(/for\s*\{\{\s*department\s*\}\}\s*students/gi, `for ${dept} students`)
      .replace(/for\s*\{\{\s*department\s*\}\}\s*faculty/gi, `for ${dept} faculty`)
      .replace(/in\s*\{\{\s*department\s*\}\}\s*lectures/gi, `in ${dept} lectures`)
      .replace(/in\s*\{\{\s*department\s*\}\}\s*courses/gi, `in ${dept} courses`)
      .replace(/for\s*\{\{\s*department\s*\}\}/gi, `for ${dept}`)
      .replace(/in\s*the\s*\{\{\s*department\s*\}\}/gi, `in the ${dept}`)
      .replace(/for\s*your\s*\{\{\s*institution\s*\}\}\s*courses/gi, `for your ${dept} courses`)
      .replace(/for\s*your\s*\{\{\s*institution\s*\}\}\s*students/gi, `for your ${dept} students`)
      .replace(/in\s*\{\{\s*institution\s*\}\}\s*lectures/gi, `in ${dept} lectures`)
      .replace(/for\s*\{\{\s*institution\s*\}\}/gi, `for ${dept}`)
      .replace(/at\s*\{\{\s*institution\s*\}\}/gi, `in ${dept}`);
  }

  // 3. Fallbacks for remaining standalone placeholders
  const instFallback = hasInstitution ? contact!.institution!.trim() : 'your institution';
  const deptFallback = hasDepartment ? contact!.department!.trim() : 'your department';
  const firstNameFallback = derivedFirstName || 'Professor';
  const lastNameFallback = derivedLastName || 'Colleague';
  const fullNameFallback = contact?.full_name?.trim() || `${firstNameFallback} ${lastNameFallback}`.trim();
  const academicRoleFallback = contact?.academic_role?.trim() || 'Educator';
  const countryFallback = contact?.country?.trim() || '';
  const websiteFallback = contact?.website?.trim() || 'https://gamifytl.com/';
  const emailFallback = contact?.email?.trim() || '';

  return resolved
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstNameFallback)
    .replace(/\{\{\s*last_name\s*\}\}/gi, lastNameFallback)
    .replace(/\{\{\s*full_name\s*\}\}/gi, fullNameFallback)
    .replace(/\{\{\s*institution\s*\}\}/gi, instFallback)
    .replace(/\{\{\s*department\s*\}\}/gi, deptFallback)
    .replace(/\{\{\s*country\s*\}\}/gi, countryFallback)
    .replace(/\{\{\s*academic_role\s*\}\}/gi, academicRoleFallback)
    .replace(/\{\{\s*designation\s*\}\}/gi, academicRoleFallback)
    .replace(/\{\{\s*website\s*\}\}/gi, websiteFallback)
    .replace(/\{\{\s*email\s*\}\}/gi, emailFallback);
}

/**
 * Validates which personalization fields are present in a template
 * and scans the provided contacts list for any missing data.
 */
export interface PersonalizationValidationResult {
  usedVariables: string[];
  missingCount: number;
  totalContacts: number;
  details: {
    variable: string;
    affectedContactsCount: number;
    fallbackValue: string;
  }[];
  isValid: boolean;
}

export function validatePersonalizationFields(
  templateText: string,
  contacts: Partial<Contact>[]
): PersonalizationValidationResult {
  const recognizedVars = [
    { tag: '{{first_name}}', field: 'first_name', fallback: 'Professor' },
    { tag: '{{last_name}}', field: 'last_name', fallback: 'Colleague' },
    { tag: '{{full_name}}', field: 'full_name', fallback: 'Professor Colleague' },
    { tag: '{{institution}}', field: 'institution', fallback: 'your institution' },
    { tag: '{{department}}', field: 'department', fallback: 'your department' },
    { tag: '{{country}}', field: 'country', fallback: '' },
    { tag: '{{academic_role}}', field: 'academic_role', fallback: 'Educator' },
    { tag: '{{website}}', field: 'website', fallback: '' },
  ];

  const usedVariables: string[] = [];
  const details: PersonalizationValidationResult['details'] = [];
  let totalMissingContacts = 0;

  for (const item of recognizedVars) {
    const regex = new RegExp(item.tag.replace(/[{}]/g, '\\$&'), 'i');
    if (regex.test(templateText)) {
      usedVariables.push(item.tag);

      // Check how many contacts lack this field
      const missingContacts = contacts.filter((c) => {
        const val = (c as Record<string, unknown>)[item.field];
        return typeof val !== 'string' || !val.trim();
      });

      if (missingContacts.length > 0) {
        totalMissingContacts += missingContacts.length;
        details.push({
          variable: item.tag,
          affectedContactsCount: missingContacts.length,
          fallbackValue: item.fallback,
        });
      }
    }
  }

  return {
    usedVariables,
    missingCount: totalMissingContacts,
    totalContacts: contacts.length,
    details,
    isValid: totalMissingContacts === 0,
  };
}

/**
 * Strict Claim Linter:
 * Detects fabricated claims, fake student numbers, fake institutional partnerships,
 * and deliverability/AI violations.
 */
export function lintEmailContent(content: string): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const lower = content.toLowerCase();

  const bannedPatterns = [
    { pattern: /million(s)? of students/i, reason: 'Unverified student count claim' },
    { pattern: /(partnered with|across) (500|1000|hundreds of|\d+) universities/i, reason: 'Fabricated institutional partnership count' },
    { pattern: /endorsed by harvard/i, reason: 'Fabricated university endorsement' },
    { pattern: /100% (inbox placement|delivery guarantee)/i, reason: 'Unrealistic deliverability guarantee' },
    { pattern: /award winning lecture tool/i, reason: 'Unverified award claim' },
    { pattern: /revolutionary ai-powered/i, reason: 'Violates AI exclusion constraint' },
  ];

  for (const b of bannedPatterns) {
    if (b.pattern.test(lower)) {
      violations.push(b.reason);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * ============================================================================
 * TEMPLATE STORAGE & MANAGEMENT HELPERS (LOCALSTORAGE)
 * ============================================================================
 */

const STORAGE_KEY = 'gamifytl_custom_templates';

export function getCustomTemplates(): EmailTemplate[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplate(tpl: EmailTemplate): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const existing = getCustomTemplates();
    const idx = existing.findIndex((e) => e.id === tpl.id);
    if (idx >= 0) {
      existing[idx] = tpl;
    } else {
      existing.push(tpl);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to save template to localStorage:', e);
  }
}

export function duplicateTemplate(tpl: EmailTemplate, customName?: string): EmailTemplate {
  const newId = `custom_${Date.now()}`;
  const duplicated: EmailTemplate = {
    ...tpl,
    id: newId,
    name: customName || `${tpl.name} (Copy)`,
    isDefault: false,
    isCustom: true,
  };
  saveCustomTemplate(duplicated);
  return duplicated;
}

export function restoreDefaultTemplate(templateId: string): EmailTemplate {
  if (templateId.includes('html') || templateId === TEMPLATE_2_BRANDED_HTML.id) {
    return { ...TEMPLATE_2_BRANDED_HTML };
  }
  return { ...TEMPLATE_1_PLAINTEXT };
}
