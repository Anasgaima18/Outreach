/**
 * Pure TypeScript RFC 2822 MIME & Base64url Engine for GamifyTL Outreach.
 * Shared utility for Supabase Edge Functions.
 * Strictly complies with RFC 2822, RFC 2047, and RFC 4648 §5.
 * Zero external dependencies. Uses native Web Standards (TextEncoder, TextDecoder, btoa, atob, crypto).
 */

export interface EmailParams {
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  toName?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  date?: Date;
  extraHeaders?: Record<string, string>;
}

export type EmailOptions = EmailParams;

export interface DecodedMimeMessage {
  headers: Record<string, string>;
  plainTextBody: string;
  htmlBody?: string;
  rawMime: string;
}

/**
 * Encodes a string to URL-safe Base64 without padding (RFC 4648 §5).
 * Allowed alphabet: [A-Za-z0-9_-], no '+', '/', or '='.
 * Handles full multi-byte UTF-8 without byte truncation.
 */
export function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const len = bytes.byteLength;
  const CHUNK_SIZE = 8192;
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  const base64 = btoa(binary);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodes a URL-safe Base64 string back to standard UTF-8 string (RFC 4648 §5).
 */
export function base64UrlDecode(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// Aliases for compatibility
export const toBase64Url = base64UrlEncode;
export const fromBase64Url = base64UrlDecode;

/**
 * Sanitizes header values by stripping carriage return (\r) and line feed (\n)
 * control characters to prevent CRLF / header injection (RFC 2822).
 */
export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Sanitizes email addresses, message IDs, and tokens by removing carriage returns,
 * line feeds, and whitespace to prevent header splitting.
 */
export function sanitizeHeaderAtom(value: string): string {
  return value.replace(/[\r\n]+/g, '').trim();
}

/**
 * Encodes header value using RFC 2047 B-encoding (=?UTF-8?B?...?=)
 * when value contains non-ASCII or reserved MIME header characters.
 * Automatically sanitizes any CRLF characters before encoding.
 */
export function encodeHeaderValue(value: string): string {
  const sanitized = sanitizeHeaderValue(value);
  // Check if sanitized contains non-ASCII characters
  // eslint-disable-next-line no-control-regex
  const hasNonAscii = /[^\x20-\x7E]/.test(sanitized);
  if (!hasNonAscii) {
    return sanitized;
  }
  const bytes = new TextEncoder().encode(sanitized);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  return `=?UTF-8?B?${b64}?=`;
}

/**
 * Formats display name and email address according to RFC 2822.
 * Safely escapes quotes and backslashes, sanitizes CRLF characters,
 * and encodes non-ASCII display names.
 */
export function formatAddress(email: string, name?: string): string {
  const cleanEmail = sanitizeHeaderAtom(email);
  if (!name || name.trim() === '') {
    return cleanEmail;
  }
  const cleanName = sanitizeHeaderValue(name);
  const encodedName = encodeHeaderValue(cleanName);
  if (encodedName.startsWith('=?UTF-8?B?')) {
    return `${encodedName} <${cleanEmail}>`;
  }
  if (/[",;<>@\\]/.test(cleanName)) {
    const escaped = cleanName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}" <${cleanEmail}>`;
  }
  return `"${cleanName}" <${cleanEmail}>`;
}

/**
 * Folds header lines exceeding recommended limit according to RFC 2822 §2.2.3.
 */
export function foldHeader(headerName: string, headerValue: string, maxLen = 76): string {
  const cleanName = headerName.replace(/[\r\n:]+/g, '').trim();
  const cleanValue = sanitizeHeaderValue(headerValue);
  const full = `${cleanName}: ${cleanValue}`;
  if (full.length <= maxLen) {
    return full;
  }

  const words = cleanValue.split(' ');
  let currentLine = `${cleanName}:`;
  const lines: string[] = [];

  for (const word of words) {
    if ((currentLine + ' ' + word).length > maxLen) {
      lines.push(currentLine);
      currentLine = ` ${word}`;
    } else {
      currentLine += ` ${word}`;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  return lines.join('\r\n');
}

/**
 * Normalizes string line endings to canonical RFC 2822 CRLF (\r\n).
 */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
}

/**
 * Builds standard RFC 2822 raw email MIME string.
 * Supports plain-text fallback and multipart/alternative with HTML.
 * Strictly sanitizes all headers to prevent CRLF injection.
 */
export function buildRfc2822Mime(params: EmailParams): string {
  const dateStr = (params.date || new Date()).toUTCString();
  const rawMsgId = params.messageId || `<gamifytl-${crypto.randomUUID()}@gamifytl.com>`;
  const messageId = sanitizeHeaderAtom(rawMsgId);
  const boundary = `====_GamifyTL_Boundary_${crypto.randomUUID().replace(/-/g, '')}_====`;

  const headers: string[] = [
    foldHeader('From', formatAddress(params.fromEmail, params.fromName)),
    foldHeader('To', formatAddress(params.toEmail, params.toName)),
    foldHeader('Subject', encodeHeaderValue(params.subject)),
    `Date: ${dateStr}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
  ];

  if (params.inReplyTo) {
    const cleanInReplyTo = sanitizeHeaderAtom(params.inReplyTo);
    const formatted = cleanInReplyTo.startsWith('<') && cleanInReplyTo.endsWith('>')
      ? cleanInReplyTo
      : `<${cleanInReplyTo.replace(/[<>]/g, '')}>`;
    headers.push(`In-Reply-To: ${formatted}`);
  }

  if (params.references) {
    const cleanRefs = sanitizeHeaderAtom(params.references);
    const formatted = cleanRefs.startsWith('<') && cleanRefs.endsWith('>')
      ? cleanRefs
      : `<${cleanRefs.replace(/[<>]/g, '')}>`;
    headers.push(`References: ${formatted}`);
  }

  if (params.extraHeaders) {
    for (const [key, val] of Object.entries(params.extraHeaders)) {
      const cleanKey = key.replace(/[\r\n:]+/g, '').trim();
      const cleanVal = sanitizeHeaderValue(val);
      if (cleanKey) {
        headers.push(foldHeader(cleanKey, cleanVal));
      }
    }
  }

  const plainText = normalizeLineEndings(params.bodyText);

  if (params.bodyHtml) {
    const htmlText = normalizeLineEndings(params.bodyHtml);
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

    const mime = [
      headers.join('\r\n'),
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      plainText,
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      htmlText,
      `--${boundary}--`,
      '',
    ].join('\r\n');

    return mime;
  } else {
    headers.push('Content-Type: text/plain; charset=UTF-8');
    headers.push('Content-Transfer-Encoding: 8bit');

    const mime = [
      headers.join('\r\n'),
      '',
      plainText,
    ].join('\r\n');

    return mime;
  }
}

/**
 * Builds RFC 4648 §5 URL-safe Base64 encoded payload ready for Gmail API `users.messages.send`.
 */
export function buildRawEmail(params: EmailParams): string {
  const mime = buildRfc2822Mime(params);
  return base64UrlEncode(mime);
}

/**
 * Parses raw RFC 2822 MIME string into headers and body parts.
 */
export function parseMimeMessage(rawMime: string): DecodedMimeMessage {
  const separator = rawMime.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
  const sepIndex = rawMime.indexOf(separator);
  if (sepIndex === -1) {
    return { headers: {}, plainTextBody: rawMime, rawMime };
  }

  const headerBlock = rawMime.slice(0, sepIndex);
  const bodyBlock = rawMime.slice(sepIndex + separator.length);

  const headers: Record<string, string> = {};
  const headerLines = headerBlock.split(separator === '\r\n\r\n' ? '\r\n' : '\n');

  let currentKey = '';
  for (const line of headerLines) {
    if (/^[ \t]/.test(line) && currentKey) {
      headers[currentKey] += ' ' + line.trim();
    } else {
      const colon = line.indexOf(':');
      if (colon > -1) {
        currentKey = line.slice(0, colon).trim().toLowerCase();
        headers[currentKey] = line.slice(colon + 1).trim();
      }
    }
  }

  const contentType = headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=["']?([^"';]+)["']?/i);

  if (boundaryMatch && boundaryMatch[1]) {
    const boundary = boundaryMatch[1];
    const parts = bodyBlock.split(`--${boundary}`);
    let plainText = '';
    let html = '';

    for (const part of parts) {
      if (part.trim() === '' || part.trim() === '--') continue;
      const partSep = part.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
      const partSepIdx = part.indexOf(partSep);
      if (partSepIdx > -1) {
        const partHeader = part.slice(0, partSepIdx);
        const partBody = part.slice(partSepIdx + partSep.length).trim();
        if (/text\/plain/i.test(partHeader)) {
          plainText = partBody;
        } else if (/text\/html/i.test(partHeader)) {
          html = partBody;
        }
      }
    }

    return {
      headers,
      plainTextBody: plainText,
      htmlBody: html || undefined,
      rawMime,
    };
  }

  return {
    headers,
    plainTextBody: bodyBlock,
    rawMime,
  };
}
