/**
 * Mock Gmail API Service
 * Intercepts calls to https://gmail.googleapis.com/gmail/v1/users/me/messages/send
 * Validates payload schema, URL-safe Base64url encoding, and RFC 2822 MIME structure.
 */

import { fromBase64Url, parseMimeMessage } from './mime';

export interface InterceptedEmail {
  id: string;
  threadId: string;
  rawBase64Url: string;
  decodedMime: string;
  headers: Record<string, string>;
  plainTextBody: string;
  htmlBody?: string;
  timestamp: string;
}

export type MockGmailFailureMode =
  | 'none'
  | 'rate_limit_429'
  | 'auth_expired_401'
  | 'invalid_recipient_400'
  | 'server_error_503'
  | 'permanent_bounce_550';

export class MockGmailService {
  public sentMessages: InterceptedEmail[] = [];
  public failureMode: MockGmailFailureMode = 'none';
  public customRetryAfter = 30;
  public transientFailuresRemaining = 0;

  /**
   * Configures transient failure mode that fails N times then reverts to 'none'.
   */
  public setTransientFailure(mode: MockGmailFailureMode, count: number): void {
    this.failureMode = mode;
    this.transientFailuresRemaining = count;
  }

  public setFailureMode(mode: MockGmailFailureMode): void {
    this.failureMode = mode;
  }

  public handleSendRequest(
    authHeader?: string | null,
    bodyJson?: { raw?: string; threadId?: string }
  ): Response {
    // 1. Validate Authorization header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          error: {
            code: 401,
            message: 'Invalid Credentials: Missing or invalid Bearer token',
            status: 'UNAUTHENTICATED',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check transient or active failure modes
    let activeMode = this.failureMode;
    if (this.transientFailuresRemaining > 0) {
      this.transientFailuresRemaining--;
      if (this.transientFailuresRemaining === 0) {
        this.failureMode = 'none';
      }
    }

    if (activeMode === 'auth_expired_401') {
      return new Response(
        JSON.stringify({
          error: {
            code: 401,
            message: 'Access token expired or revoked',
            status: 'UNAUTHENTICATED',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (activeMode === 'rate_limit_429') {
      return new Response(
        JSON.stringify({
          error: {
            code: 429,
            message: 'User Rate Limit Exceeded',
            status: 'RESOURCE_EXHAUSTED',
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(this.customRetryAfter),
          },
        }
      );
    }

    if (activeMode === 'server_error_503') {
      return new Response(
        JSON.stringify({
          error: {
            code: 503,
            message: 'Backend Error / Service Unavailable',
            status: 'UNAVAILABLE',
          },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (activeMode === 'invalid_recipient_400' || activeMode === 'permanent_bounce_550') {
      return new Response(
        JSON.stringify({
          error: {
            code: 400,
            message: 'Invalid recipient address or mailbox not found',
            status: 'INVALID_ARGUMENT',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Validate body payload
    if (!bodyJson || typeof bodyJson.raw !== 'string' || bodyJson.raw.trim() === '') {
      return new Response(
        JSON.stringify({
          error: {
            code: 400,
            message: 'Missing required field: raw',
            status: 'INVALID_ARGUMENT',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validate URL-safe Base64url regex
    const isBase64Url = /^[A-Za-z0-9_-]+$/.test(bodyJson.raw);
    if (!isBase64Url) {
      return new Response(
        JSON.stringify({
          error: {
            code: 400,
            message: 'Malformed raw message: payload must be standard URL-safe Base64url encoded without padding',
            status: 'INVALID_ARGUMENT',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Decode MIME RFC 2822
    let decodedMime = '';
    try {
      decodedMime = fromBase64Url(bodyJson.raw);
    } catch {
      return new Response(
        JSON.stringify({
          error: {
            code: 400,
            message: 'Failed to decode Base64url string',
            status: 'INVALID_ARGUMENT',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const parsed = parseMimeMessage(decodedMime);

    // 6. Validate mandatory RFC 2822 headers
    if (!parsed.headers['from']) {
      return new Response(
        JSON.stringify({
          error: {
            code: 400,
            message: 'RFC 2822 compliance violation: Missing From header',
            status: 'INVALID_ARGUMENT',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!parsed.headers['to']) {
      return new Response(
        JSON.stringify({
          error: {
            code: 400,
            message: 'RFC 2822 compliance violation: Missing To header',
            status: 'INVALID_ARGUMENT',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 7. Generate IDs and record
    const msgId = `18c${crypto.randomUUID().replace(/-/g, '').slice(0, 13)}`;
    const threadId = bodyJson.threadId || msgId;

    const emailRecord: InterceptedEmail = {
      id: msgId,
      threadId,
      rawBase64Url: bodyJson.raw,
      decodedMime,
      headers: parsed.headers,
      plainTextBody: parsed.plainTextBody,
      htmlBody: parsed.htmlBody,
      timestamp: new Date().toISOString(),
    };

    this.sentMessages.push(emailRecord);

    return new Response(
      JSON.stringify({
        id: msgId,
        threadId,
        labelIds: ['SENT'],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  public reset(): void {
    this.sentMessages = [];
    this.failureMode = 'none';
    this.customRetryAfter = 30;
    this.transientFailuresRemaining = 0;
  }
}
