/**
 * Unit Test Suite: RFC 2822 MIME & Base64url Builder
 * Validates src/lib/mime.ts for strict compliance with RFC 2822, RFC 2047, and RFC 4648 §5.
 */

import { describe, it, expect } from 'vitest';
import {
  buildRfc2822Mime,
  buildRawEmail,
  parseMimeMessage,
  base64UrlEncode,
  base64UrlDecode,
  toBase64Url,
  fromBase64Url,
  encodeHeaderValue,
  formatAddress,
  foldHeader,
  EmailParams,
} from '@/lib/mime';

describe('Unit Test: RFC 2822 MIME & Base64url Builder (src/lib/mime.ts)', () => {
  // 1. Plain Text RFC 2822 Generation
  it('generates standard RFC 2822 plain text email with required headers', () => {
    const params: EmailParams = {
      fromEmail: 'sender@gmail.com',
      fromName: 'Prof Outreach',
      toEmail: 'lecturer@oxford.ac.uk',
      toName: 'Dr. John Doe',
      subject: 'GamifyTL for Thermodynamics',
      bodyText: 'Dear Dr. Doe,\n\nGamifyTL makes lecture slides interactive.',
    };

    const mime = buildRfc2822Mime(params);
    expect(mime).toContain('From: "Prof Outreach" <sender@gmail.com>');
    expect(mime).toContain('To: "Dr. John Doe" <lecturer@oxford.ac.uk>');
    expect(mime).toContain('Subject: GamifyTL for Thermodynamics');
    expect(mime).toContain('MIME-Version: 1.0');
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(mime).toContain('Content-Transfer-Encoding: 8bit');
    expect(mime).not.toContain('multipart/alternative');

    const parsed = parseMimeMessage(mime);
    expect(parsed.headers['from']).toBe('"Prof Outreach" <sender@gmail.com>');
    expect(parsed.headers['to']).toBe('"Dr. John Doe" <lecturer@oxford.ac.uk>');
    expect(parsed.plainTextBody).toContain('GamifyTL makes lecture slides interactive.');
  });

  // 2. Multi-part MIME Generation with HTML and Boundary Formatting
  it('generates valid multipart/alternative MIME with isolated plain text and HTML parts', () => {
    const params: EmailParams = {
      fromEmail: 'outreach@gamifytl.com',
      fromName: 'GamifyTL Team',
      toEmail: 'prof@cambridge.ac.uk',
      toName: 'Prof. Turing',
      subject: 'Interactive Classrooms',
      bodyText: 'Hello Professor,\nCheck out our 8 games.',
      bodyHtml: '<p>Hello Professor,<br>Check out our <strong>8 games</strong>.</p>',
    };

    const mime = buildRfc2822Mime(params);
    expect(mime).toContain('Content-Type: multipart/alternative; boundary="====_GamifyTL_Boundary_');
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(mime).toContain('Content-Type: text/html; charset=UTF-8');

    const parsed = parseMimeMessage(mime);
    expect(parsed.plainTextBody).toContain('Check out our 8 games.');
    expect(parsed.htmlBody).toContain('<strong>8 games</strong>');
  });

  // 3. Boundary Isolation and Collision Resistance
  it('ensures boundary markers are unique and do not collide with body contents', () => {
    const boundaryLikeString = '====_GamifyTL_Boundary_fake12345_====';
    const params: EmailParams = {
      fromEmail: 'test@example.com',
      toEmail: 'test@example.com',
      subject: 'Boundary Collision Test',
      bodyText: `Here is a tricky string: ${boundaryLikeString}`,
      bodyHtml: `<p>HTML contains ${boundaryLikeString}</p>`,
    };

    const mime = buildRfc2822Mime(params);
    const parsed = parseMimeMessage(mime);
    expect(parsed.plainTextBody).toContain(boundaryLikeString);
    expect(parsed.htmlBody).toContain(boundaryLikeString);
  });

  // 4. RFC 2047 Encoded Words for UTF-8 Subjects
  it('encodes UTF-8 subjects containing non-ASCII, accents, and emojis using RFC 2047 format', () => {
    const accentsSubject = 'GamifyTL: Présentation pédagogique pour l\'Université de Genève';
    const encodedAccents = encodeHeaderValue(accentsSubject);
    expect(encodedAccents.startsWith('=?UTF-8?B?')).toBe(true);
    expect(encodedAccents.endsWith('?=')).toBe(true);

    const emojiSubject = 'GamifyTL Live Classroom 🚀 🎓 🎮';
    const encodedEmoji = encodeHeaderValue(emojiSubject);
    expect(encodedEmoji.startsWith('=?UTF-8?B?')).toBe(true);
    expect(encodedEmoji.endsWith('?=')).toBe(true);

    // ASCII-only subjects must remain unencoded
    const plainAscii = 'Simple ASCII Subject Without Accents';
    expect(encodeHeaderValue(plainAscii)).toBe(plainAscii);
  });

  // 5. Threading Headers: In-Reply-To and References
  it('formats In-Reply-To and References headers for email threading', () => {
    const parentMsgId = 'parent-msg-12345@gmail.com';
    const mime = buildRfc2822Mime({
      fromEmail: 'sender@gmail.com',
      toEmail: 'recipient@edu.au',
      subject: 'Re: Previous Conversation',
      bodyText: 'Following up on our earlier email.',
      inReplyTo: parentMsgId,
      references: `<${parentMsgId}>`, // Already bracketed
    });

    const parsed = parseMimeMessage(mime);
    expect(parsed.headers['in-reply-to']).toBe(`<${parentMsgId}>`);
    expect(parsed.headers['references']).toBe(`<${parentMsgId}>`);
  });

  // 6. Strict RFC 4648 §5 Base64url Encoding
  it('produces strict URL-safe Base64 without +, /, or = (RFC 4648 §5)', () => {
    const raw = buildRawEmail({
      fromEmail: 'test@gamifytl.com',
      toEmail: 'test@harvard.edu',
      subject: 'Testing Base64url Characters: + / = ? & % # @ !',
      bodyText: 'Arbitrary content with characters that could produce plus or slash: >>> ??? === +++',
    });

    // Must match regex ^[A-Za-z0-9_-]+$
    expect(/^[A-Za-z0-9_-]+$/.test(raw)).toBe(true);
    expect(raw).not.toContain('+');
    expect(raw).not.toContain('/');
    expect(raw).not.toContain('=');

    // Round-trip test
    const decoded = base64UrlDecode(raw);
    expect(decoded).toContain('Arbitrary content with characters');
  });

  // 7. Multi-byte UTF-8 Encoding Round-Trip
  it('correctly round-trips complex multi-byte UTF-8 strings in multiple languages', () => {
    const multilingual = `
      English: Welcome!
      Japanese: ようこそ！
      Arabic: أهلاً وسهلاً
      Greek: Καλώς ορίσατε
      Chinese: 欢迎光临
      German: Herzlich Willkommen! Ä Ö Ü ß
      Emojis: 🎓 🎮 💡 🚀 🔬
    `;

    const encoded = base64UrlEncode(multilingual);
    expect(/^[A-Za-z0-9_-]+$/.test(encoded)).toBe(true);

    const decoded = base64UrlDecode(encoded);
    expect(decoded).toBe(multilingual);
  });

  // 8. Line Folding (RFC 2822 §2.2.3)
  it('folds header lines exceeding 76 characters on whitespace boundaries', () => {
    const longHeader = 'This is an extremely long header value designed to test RFC 2822 section 2.2.3 header line folding on whitespace';
    const folded = foldHeader('X-Custom-Header', longHeader, 76);

    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].startsWith('X-Custom-Header:')).toBe(true);
    expect(lines[1].startsWith(' ')).toBe(true); // Folds with space continuation
  });

  // 9. Recipient Address Formatting and Escaping
  it('safely formats and escapes recipient display names containing special characters', () => {
    expect(formatAddress('test@edu.com')).toBe('test@edu.com');
    expect(formatAddress('test@edu.com', 'Dr. Smith')).toBe('"Dr. Smith" <test@edu.com>');
    expect(formatAddress('test@edu.com', 'Dr. "Bob" Smith')).toBe('"Dr. \\"Bob\\" Smith" <test@edu.com>');
    expect(formatAddress('test@edu.com', 'Prof\\Special')).toBe('"Prof\\\\Special" <test@edu.com>');
  });

  // 10. Compatibility Aliases
  it('provides toBase64Url and fromBase64Url aliases', () => {
    const text = 'Compatibility Test';
    expect(toBase64Url(text)).toBe(base64UrlEncode(text));
    expect(fromBase64Url(toBase64Url(text))).toBe(text);
  });

  // 11. CRLF Header Injection Prevention
  it('strictly sanitizes carriage returns and line feeds to prevent CRLF injection in all headers', () => {
    const maliciousParams: EmailParams = {
      fromEmail: 'legit@gamifytl.com\r\nBcc: evil_bcc@attacker.com',
      fromName: 'GamifyTL Admin\r\nInjected-Header: evil',
      toEmail: 'professor@university.edu\r\nCc: spy@attacker.com',
      toName: 'Dr. Professor\r\nX-Bad: 1',
      subject: 'Urgent Grant Proposal\r\nBcc: evil_subject@attacker.com',
      bodyText: 'Regular email body.\r\nMultiline is permitted in body.',
      messageId: '<legit-id-123>\r\nBcc: evil_id@attacker.com',
      inReplyTo: '<parent-thread-999>\r\nBcc: evil_reply@attacker.com',
      references: '<parent-ref-888>\r\nBcc: evil_ref@attacker.com',
      extraHeaders: {
        'X-Track-Id\r\nInjected-Key': 'valid-value',
        'X-Campaign-Id': 'camp-123\r\nBcc: evil_extra@attacker.com',
      },
    };

    const mime = buildRfc2822Mime(maliciousParams);

    // The header block is everything before the first blank line
    const headerBlock = mime.split('\r\n\r\n')[0];

    // Assert that no injected Bcc:, Cc:, or malicious headers exist anywhere in the header block
    expect(headerBlock).not.toMatch(/\r\nBcc:/i);
    expect(headerBlock).not.toMatch(/\r\nCc:/i);
    expect(headerBlock).not.toMatch(/\r\nInjected-Header:/i);
    expect(headerBlock).not.toMatch(/\r\nX-Bad:/i);
    expect(headerBlock).not.toMatch(/\r\nInjected-Key:/i);

    // Parsed representation confirms safe values
    const parsed = parseMimeMessage(mime);
    expect(parsed.headers['bcc']).toBeUndefined();
    expect(parsed.headers['cc']).toBeUndefined();
    expect(parsed.headers['injected-header']).toBeUndefined();
    expect(parsed.headers['x-bad']).toBeUndefined();
  });
});
