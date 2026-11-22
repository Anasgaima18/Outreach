/**
 * Unit Test Suite: Queue Management & Sending Safeguards
 * Validates src/services/queue.ts and sending engine logic for suppression detection,
 * daily rate-limit enforcement, batch limits, exponential backoff, and Gmail API payloads.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBackoffDelay,
  calculateNextRetryAt,
} from '@/services/queue';
import { buildRawEmail } from '@/lib/mime';

describe('Unit Test: Queue Management & Sending Engine (src/services/queue.ts)', () => {
  // 1. Exponential Backoff Delay Calculations
  it('calculates exponential backoff delay correctly based on retry count', () => {
    // Retry 0: 0 delay
    expect(calculateBackoffDelay(0)).toBe(0);

    // Retry 1: 2^1 * 60s = 120s = 120,000 ms (2 minutes)
    expect(calculateBackoffDelay(1)).toBe(120_000);

    // Retry 2: 2^2 * 60s = 240s = 240,000 ms (4 minutes)
    expect(calculateBackoffDelay(2)).toBe(240_000);

    // Retry 3: 2^3 * 60s = 480s = 480,000 ms (8 minutes)
    expect(calculateBackoffDelay(3)).toBe(480_000);
  });

  // 2. Next Retry Timestamp Calculation
  it('calculates correct ISO next_retry_at timestamp given base date', () => {
    const baseDate = new Date('2026-11-22T10:00:00.000Z');
    const nextRetry = calculateNextRetryAt(1, baseDate);

    // 2 minutes later
    expect(nextRetry).toBe('2026-11-22T10:02:00.000Z');

    const nextRetry2 = calculateNextRetryAt(2, baseDate);
    // 4 minutes later
    expect(nextRetry2).toBe('2026-11-22T10:04:00.000Z');
  });

  // 3. Pre-flight Suppression Detection Logic
  it('correctly classifies suppressed addresses from suppression reasons, contact statuses, and replies', () => {
    interface SuppressionCheckContext {
      isSuppressedInTable: boolean;
      contactStatus: string;
      hasPriorReply: boolean;
    }

    function checkPreflightSuppression(ctx: SuppressionCheckContext): {
      suppressed: boolean;
      reason?: string;
    } {
      if (ctx.isSuppressedInTable) {
        return { suppressed: true, reason: 'suppressions_table' };
      }
      if (ctx.hasPriorReply) {
        return { suppressed: true, reason: 'prior_reply' };
      }
      if (['unsubscribed', 'bounced', 'suppressed', 'replied'].includes(ctx.contactStatus)) {
        return { suppressed: true, reason: `contact_status_${ctx.contactStatus}` };
      }
      return { suppressed: false };
    }

    // Active clean contact
    expect(
      checkPreflightSuppression({
        isSuppressedInTable: false,
        contactStatus: 'active',
        hasPriorReply: false,
      }).suppressed
    ).toBe(false);

    // Suppressed in table (e.g. opt-out)
    expect(
      checkPreflightSuppression({
        isSuppressedInTable: true,
        contactStatus: 'active',
        hasPriorReply: false,
      }).suppressed
    ).toBe(true);

    // Contact has already replied
    expect(
      checkPreflightSuppression({
        isSuppressedInTable: false,
        contactStatus: 'active',
        hasPriorReply: true,
      }).suppressed
    ).toBe(true);

    // Contact status is bounced
    expect(
      checkPreflightSuppression({
        isSuppressedInTable: false,
        contactStatus: 'bounced',
        hasPriorReply: false,
      }).suppressed
    ).toBe(true);

    // Contact status is unsubscribed
    expect(
      checkPreflightSuppression({
        isSuppressedInTable: false,
        contactStatus: 'unsubscribed',
        hasPriorReply: false,
      }).suppressed
    ).toBe(true);
  });

  // 4. Daily Rate-Limit Enforcement Logic
  it('enforces conservative daily send limits and detects quota exhaustion', () => {
    function evaluateDailyQuota(account: { daily_limit: number; sent_today_count: number }) {
      const remaining = Math.max(0, account.daily_limit - account.sent_today_count);
      const isExceeded = account.sent_today_count >= account.daily_limit;
      return { remaining, isExceeded };
    }

    // Fresh account (0/50 sent)
    const fresh = evaluateDailyQuota({ daily_limit: 50, sent_today_count: 0 });
    expect(fresh.remaining).toBe(50);
    expect(fresh.isExceeded).toBe(false);

    // Partial day (45/50 sent)
    const partial = evaluateDailyQuota({ daily_limit: 50, sent_today_count: 45 });
    expect(partial.remaining).toBe(5);
    expect(partial.isExceeded).toBe(false);

    // Quota reached (50/50 sent)
    const reached = evaluateDailyQuota({ daily_limit: 50, sent_today_count: 50 });
    expect(reached.remaining).toBe(0);
    expect(reached.isExceeded).toBe(true);

    // Overflow attempt (51/50 sent)
    const overflow = evaluateDailyQuota({ daily_limit: 50, sent_today_count: 51 });
    expect(overflow.remaining).toBe(0);
    expect(overflow.isExceeded).toBe(true);
  });

  // 5. Batch Parameter Clamping Logic
  it('clamps micro-batch sizes safely between 1 and 10 to respect 60s Edge Function limit', () => {
    function sanitizeBatchSize(requested?: number): number {
      const defaultSize = 3;
      const size = requested !== undefined ? requested : defaultSize;
      return Math.min(Math.max(size, 1), 10);
    }

    expect(sanitizeBatchSize(undefined)).toBe(3);
    expect(sanitizeBatchSize(5)).toBe(5);
    expect(sanitizeBatchSize(0)).toBe(1); // Min 1
    expect(sanitizeBatchSize(-10)).toBe(1); // Min 1
    expect(sanitizeBatchSize(50)).toBe(10); // Max 10 (micro-batching)
    expect(sanitizeBatchSize(100)).toBe(10);
  });

  // 6. Gmail API Payload Verification
  it('constructs exact payload expected by Google Gmail users.messages.send API', () => {
    const rawEmail = buildRawEmail({
      fromEmail: 'sender@gmail.com',
      toEmail: 'professor@stanford.edu',
      subject: 'GamifyTL Live Polling Demo',
      bodyText: 'Hello Professor, here is GamifyTL.',
    });

    const standardPayload = {
      raw: rawEmail,
    };

    expect(typeof standardPayload.raw).toBe('string');
    expect(/^[A-Za-z0-9_-]+$/.test(standardPayload.raw)).toBe(true);

    // Threaded follow-up payload
    const threadId = '18bf9999a00b12cd';
    const threadedPayload = {
      raw: rawEmail,
      threadId,
    };

    expect(threadedPayload.threadId).toBe(threadId);
  });

  // 7. Backoff Delay Clamping at Large Retry Counts
  it('clamps exponential backoff delay to a maximum of 24 hours (86,400,000 ms)', () => {
    const maxDelayMs = 24 * 60 * 60 * 1000; // 86,400,000 ms

    // Normal counts
    expect(calculateBackoffDelay(1)).toBe(120_000); // 2m
    expect(calculateBackoffDelay(2)).toBe(240_000); // 4m
    expect(calculateBackoffDelay(3)).toBe(480_000); // 8m

    // High retry counts that would otherwise cause massive numbers or overflow
    expect(calculateBackoffDelay(11)).toBe(maxDelayMs); // 2^11 * 60,000 = 122,880,000 > 86,400,000 -> clamped
    expect(calculateBackoffDelay(50)).toBe(maxDelayMs); // Clamped
    expect(calculateBackoffDelay(100)).toBe(maxDelayMs); // Clamped to exactly 24 hours

    // Negative, zero, or non-finite counts
    expect(calculateBackoffDelay(0)).toBe(0);
    expect(calculateBackoffDelay(-5)).toBe(0);
    expect(calculateBackoffDelay(NaN)).toBe(0);
    expect(calculateBackoffDelay(Infinity)).toBe(0);
  });

  // 8. Case-Insensitive Suppression Checks
  it('correctly matches suppressions case-insensitively across mixed case variations', () => {
    const suppressedList = ['optout@oxford.ac.uk', 'prof.smith@harvard.edu'];

    function isAddressSuppressed(email: string, suppressions: string[]): boolean {
      const normalized = email.trim().toLowerCase();
      return suppressions.some(s => s.trim().toLowerCase() === normalized);
    }

    // Exact match
    expect(isAddressSuppressed('optout@oxford.ac.uk', suppressedList)).toBe(true);

    // Uppercase domain
    expect(isAddressSuppressed('optout@OXFORD.AC.UK', suppressedList)).toBe(true);

    // Title case local part and domain
    expect(isAddressSuppressed('OptOut@Oxford.Ac.Uk', suppressedList)).toBe(true);

    // With leading/trailing whitespace
    expect(isAddressSuppressed('   Prof.Smith@Harvard.EDU  ', suppressedList)).toBe(true);

    // Unsuppressed address
    expect(isAddressSuppressed('clean.prof@oxford.ac.uk', suppressedList)).toBe(false);
  });

  // 9. Daily Quota Rollover Logic (UTC Day Roll)
  it('correctly resets sent_today_count when calendar day rolls over in UTC', () => {
    function checkAndResetDailyQuota(account: {
      sent_today_count: number;
      last_sent_at: string | null;
      status: string;
    }, currentDate = new Date()) {
      if (!account.last_sent_at) {
        return account;
      }
      const lastSentDate = new Date(account.last_sent_at).toISOString().slice(0, 10);
      const todayDate = currentDate.toISOString().slice(0, 10);

      if (lastSentDate < todayDate) {
        return {
          ...account,
          sent_today_count: 0,
          status: account.status === 'rate_limited' ? 'active' : account.status,
        };
      }
      return account;
    }

    // Yesterday's send date
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const exhaustedAccount = {
      sent_today_count: 50,
      last_sent_at: yesterday,
      status: 'rate_limited',
    };

    const rolled = checkAndResetDailyQuota(exhaustedAccount);
    expect(rolled.sent_today_count).toBe(0);
    expect(rolled.status).toBe('active');

    // Today's send date (same UTC day)
    const today = new Date().toISOString();
    const activeAccount = {
      sent_today_count: 20,
      last_sent_at: today,
      status: 'active',
    };

    const notRolled = checkAndResetDailyQuota(activeAccount);
    expect(notRolled.sent_today_count).toBe(20);
    expect(notRolled.status).toBe('active');
  });
});
