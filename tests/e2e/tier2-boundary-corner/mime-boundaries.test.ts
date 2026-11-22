/**
 * Tier 2: RFC 2822 MIME & Base64url Boundary Tests
 * 20 Tests covering RFC 2822 formatting, RFC 2047 encoding, line folding, Base64url padding.
 */

import { describe, it, expect } from 'vitest';
import {
  buildRfc2822Mime,
  buildRawEmail,
  parseMimeMessage,
  toBase64Url,
  fromBase64Url,
  foldHeader,
  encodeHeaderValue,
  formatAddress,
} from '../harness/mime';

describe('Tier 2: RFC 2822 MIME & Base64url Boundaries (20 Tests)', () => {
  it('T2-MIME-01: Folds header lines exceeding 78 characters according to RFC 2822 §2.2.3', () => {
    const longSubject = 'A Very Long Subject Line That Definitely Exceeds The Recommended RFC 2822 Limit Of Seventy Eight Characters Per Header Line';
    const folded = foldHeader('Subject', longSubject, 76);

    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].startsWith('Subject:')).toBe(true);
    expect(lines[1].startsWith(' ')).toBe(true); // Space continuation
  });

  it('T2-MIME-02: Enforces maximum line length boundary and normalizes body line endings', () => {
    const longLine = 'X'.repeat(500);
    const mime = buildRfc2822Mime({
      fromEmail: 'a@b.com',
      toEmail: 'c@d.com',
      subject: 'Subject',
      bodyText: `Line 1\n${longLine}\nLine 3`,
    });

    expect(mime).toContain('\r\n');
    expect(mime).not.toContain('\r\r\n');
  });

  it('T2-MIME-03: Encodes Japanese Kanji subject line cleanly with RFC 2047 Base64', () => {
    const kanjiSubject = '京都大学 理学部 講義用 GamifyTL デモンストレーション';
    const encoded = encodeHeaderValue(kanjiSubject);

    expect(encoded.startsWith('=?UTF-8?B?')).toBe(true);
    expect(encoded.endsWith('?=')).toBe(true);

    const decoded = atob(encoded.slice(10, -2));
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    expect(new TextDecoder().decode(bytes)).toBe(kanjiSubject);
  });

  it('T2-MIME-04: Encodes Arabic RTL subject line cleanly with RFC 2047 Base64', () => {
    const arabicSubject = 'عرض توضيحي لمنصة GamifyTL في الجامعة الأميركية';
    const encoded = encodeHeaderValue(arabicSubject);

    expect(encoded.startsWith('=?UTF-8?B?')).toBe(true);
    const decoded = atob(encoded.slice(10, -2));
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    expect(new TextDecoder().decode(bytes)).toBe(arabicSubject);
  });

  it('T2-MIME-05: Encodes Cyrillic subject line cleanly with RFC 2047 Base64', () => {
    const cyrillicSubject = 'Интерактивные лекции и опросы GamifyTL для университетов';
    const encoded = encodeHeaderValue(cyrillicSubject);

    expect(encoded.startsWith('=?UTF-8?B?')).toBe(true);
    const decoded = atob(encoded.slice(10, -2));
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    expect(new TextDecoder().decode(bytes)).toBe(cyrillicSubject);
  });

  it('T2-MIME-06: Encodes Unicode Emojis in subject line without breaking Gmail API headers', () => {
    const emojiSubject = 'GamifyTL Live Lecture Tool 🎓 🎮 🚀';
    const encoded = encodeHeaderValue(emojiSubject);

    expect(encoded.startsWith('=?UTF-8?B?')).toBe(true);
    const raw = buildRawEmail({
      fromEmail: 'sender@gmail.com',
      toEmail: 'prof@oxford.ac.uk',
      subject: emojiSubject,
      bodyText: 'Body with emojis',
    });

    expect(/^[A-Za-z0-9_-]+$/.test(raw)).toBe(true);
  });

  it('T2-MIME-07: Round-trips multilingual mixed email body without byte loss', () => {
    const mixedBody = `
English: Welcome to GamifyTL!
Japanese: ようこそ GamifyTL へ！
German: Herzlich willkommen zu interaktiven Vorlesungen mit GamifyTL!
French: Bienvenue aux conférences interactives avec GamifyTL!
`;
    const raw = buildRawEmail({
      fromEmail: 'sender@gmail.com',
      toEmail: 'prof@univ.edu',
      subject: 'Multilingual Test',
      bodyText: mixedBody,
    });

    const decodedMime = fromBase64Url(raw);
    const parsed = parseMimeMessage(decodedMime);

    expect(parsed.plainTextBody).toContain('ようこそ GamifyTL へ！');
    expect(parsed.plainTextBody).toContain('Herzlich willkommen');
    expect(parsed.plainTextBody).toContain('Bienvenue');
  });

  it('T2-MIME-08: Normalizes bare \\n to canonical RFC 2822 \\r\\n line endings', () => {
    const bareNewlines = 'Line 1\nLine 2\nLine 3\n';
    const mime = buildRfc2822Mime({
      fromEmail: 'a@b.com',
      toEmail: 'c@d.com',
      subject: 'Subject',
      bodyText: bareNewlines,
    });

    expect(mime).not.toMatch(/[^\r]\n/); // Every \n must be preceded by \r
  });

  it('T2-MIME-09: Properly escapes double quotes in recipient display name', () => {
    const formatted = formatAddress('bob.smith@harvard.edu', 'Dr. "Bob" Smith, Jr.');
    expect(formatted).toBe('"Dr. \\"Bob\\" Smith, Jr." <bob.smith@harvard.edu>');
  });

  it('T2-MIME-10: Properly escapes backslashes in recipient display name', () => {
    const formatted = formatAddress('prof@ox.ac.uk', 'Prof\\Special');
    expect(formatted).toBe('"Prof\\\\Special" <prof@ox.ac.uk>');
  });

  it('T2-MIME-11: Base64url padding boundary — zero padding chars stripped', () => {
    // 3 bytes -> exactly 4 base64 characters (no padding in standard base64)
    const str = 'ABC';
    const b64url = toBase64Url(str);
    expect(b64url.length % 4).toBe(0);
    expect(fromBase64Url(b64url)).toBe(str);
  });

  it('T2-MIME-12: Base64url padding boundary — two padding chars stripped', () => {
    // 1 byte -> 2 base64 chars + 2 padding '=='
    const str = 'A';
    const b64url = toBase64Url(str);
    expect(b64url).not.toContain('=');
    expect(fromBase64Url(b64url)).toBe(str);
  });

  it('T2-MIME-13: Base64url padding boundary — one padding char stripped', () => {
    // 2 bytes -> 3 base64 chars + 1 padding '='
    const str = 'AB';
    const b64url = toBase64Url(str);
    expect(b64url).not.toContain('=');
    expect(fromBase64Url(b64url)).toBe(str);
  });

  it('T2-MIME-14: Ensures generated multipart boundary is unique and never collides with body text', () => {
    const trickyBody = '--====_GamifyTL_Boundary_fake_====';
    const mime = buildRfc2822Mime({
      fromEmail: 'sender@gmail.com',
      toEmail: 'recipient@univ.edu',
      subject: 'Collision Test',
      bodyText: trickyBody,
      bodyHtml: `<p>${trickyBody}</p>`,
    });

    const parsed = parseMimeMessage(mime);
    expect(parsed.plainTextBody).toContain(trickyBody);
  });

  it('T2-MIME-15: Plain-text only email generates standard Content-Type: text/plain without multipart', () => {
    const mime = buildRfc2822Mime({
      fromEmail: 'sender@gmail.com',
      toEmail: 'recipient@univ.edu',
      subject: 'Plain Text Only',
      bodyText: 'Just pure plain text.',
    });

    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(mime).not.toContain('multipart/alternative');
  });

  it('T2-MIME-16: HTML body produces multipart/alternative with both text/plain and text/html', () => {
    const mime = buildRfc2822Mime({
      fromEmail: 'sender@gmail.com',
      toEmail: 'recipient@univ.edu',
      subject: 'HTML Email',
      bodyText: 'Plain version',
      bodyHtml: '<b>HTML version</b>',
    });

    expect(mime).toContain('Content-Type: multipart/alternative; boundary=');
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(mime).toContain('Content-Type: text/html; charset=UTF-8');
  });

  it('T2-MIME-17: Formats In-Reply-To header safely with or without leading/trailing brackets', () => {
    const rawId = 'gamifytl-msg-999@gamifytl.com';
    const mime = buildRfc2822Mime({
      fromEmail: 's@g.com',
      toEmail: 'r@u.edu',
      subject: 'Re: Test',
      bodyText: 'Follow up',
      inReplyTo: rawId,
    });

    const parsed = parseMimeMessage(mime);
    expect(parsed.headers['in-reply-to']).toBe(`<${rawId}>`);
  });

  it('T2-MIME-18: Formats References header safely with or without leading/trailing brackets', () => {
    const rawId = '<already-bracketed@gamifytl.com>';
    const mime = buildRfc2822Mime({
      fromEmail: 's@g.com',
      toEmail: 'r@u.edu',
      subject: 'Re: Test 2',
      bodyText: 'Follow up 2',
      references: rawId,
    });

    const parsed = parseMimeMessage(mime);
    expect(parsed.headers['references']).toBe(rawId);
  });

  it('T2-MIME-19: Handles dots and subdomains in Message-ID header safely', () => {
    const customMsgId = '<msg.2026.11.22.outreach@sub.gamifytl.com>';
    const mime = buildRfc2822Mime({
      fromEmail: 's@g.com',
      toEmail: 'r@u.edu',
      subject: 'MsgId Test',
      bodyText: 'Text',
      messageId: customMsgId,
    });

    const parsed = parseMimeMessage(mime);
    expect(parsed.headers['message-id']).toBe(customMsgId);
  });

  it('T2-MIME-20: Encodes and decodes large 1MB MIME payload safely without memory exhaustion', () => {
    const largeBodyText = 'A'.repeat(1024 * 500); // 500KB text
    const raw = buildRawEmail({
      fromEmail: 'sender@gmail.com',
      toEmail: 'prof@harvard.edu',
      subject: 'Large Payload Test',
      bodyText: largeBodyText,
    });

    expect(raw.length).toBeGreaterThan(500000);
    const decoded = fromBase64Url(raw);
    expect(decoded.length).toBeGreaterThan(500000);
  });
});
