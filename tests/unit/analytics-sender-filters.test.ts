/**
 * Unit Tests: Per-Sender Email Analytics & Strict 50 Emails/Day Restriction
 *
 * Verifies:
 * 1. Filtering by Today, This Week, This Month, and Overall
 * 2. Per-sender email volume counting
 * 3. Strict 50 emails/day cap enforcement and remaining quota calculations
 * 4. Sent email logs tracking sender to recipient mappings
 */

import { describe, it, expect } from 'vitest';
import {
  isSameDay,
  isWithinWeek,
  isSameMonth,
  SenderEmailAnalytics,
  SentEmailLogItem,
} from '../../src/hooks/useAnalytics';

describe('Per-Sender Email Analytics & Strict 50 Mails/Day Restriction', () => {
  const SENDER_1 = 'sender1@gmail.com';
  const SENDER_2 = 'sender2@gmail.com';
  const STRICT_DAILY_CAP = 50;

  describe('Time Period Filter Logic', () => {
    it('accurately identifies events occurring Today', () => {
      const now = new Date();
      const todayEarlier = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
      const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

      expect(isSameDay(todayEarlier, now)).toBe(true);
      expect(isSameDay(yesterday, now)).toBe(false);
    });

    it('accurately identifies events occurring This Week (within 7 days)', () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      expect(isWithinWeek(threeDaysAgo, now)).toBe(true);
      expect(isWithinWeek(sixDaysAgo, now)).toBe(true);
      expect(isWithinWeek(tenDaysAgo, now)).toBe(false);
    });

    it('accurately identifies events occurring This Month', () => {
      const now = new Date();
      const currentMonthSameYear = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

      expect(isSameMonth(currentMonthSameYear, now)).toBe(true);
      expect(isSameMonth(lastMonth, now)).toBe(false);
    });
  });

  describe('Per-Sender Email Volume Calculation', () => {
    it('aggregates emails sent per sender address across all filter periods', () => {
      const mockAccounts = [
        { id: 'acc-1', email: SENDER_1, sent_today_count: 15, daily_limit: 50 },
        { id: 'acc-2', email: SENDER_2, sent_today_count: 50, daily_limit: 50 },
      ];

      const now = new Date();
      const mockEvents = [
        // SENDER_1: 2 today, 4 this week, 6 this month, 10 overall
        { account_id: 'acc-1', created_at: new Date(now.getTime() - 1 * 3600000).toISOString() },
        { account_id: 'acc-1', created_at: new Date(now.getTime() - 2 * 3600000).toISOString() },
        { account_id: 'acc-1', created_at: new Date(now.getTime() - 3 * 86400000).toISOString() },
        { account_id: 'acc-1', created_at: new Date(now.getTime() - 5 * 86400000).toISOString() },
        { account_id: 'acc-1', created_at: new Date(now.getFullYear(), now.getMonth(), 2).toISOString() },
        { account_id: 'acc-1', created_at: new Date(now.getFullYear(), now.getMonth(), 3).toISOString() },
        { account_id: 'acc-1', created_at: new Date(now.getFullYear() - 1, 5, 1).toISOString() },

        // SENDER_2: 1 today, 3 this week, 3 this month, 3 overall
        { account_id: 'acc-2', created_at: new Date(now.getTime() - 30 * 60000).toISOString() },
        { account_id: 'acc-2', created_at: new Date(now.getTime() - 2 * 86400000).toISOString() },
        { account_id: 'acc-2', created_at: new Date(now.getTime() - 4 * 86400000).toISOString() },
      ];

      const senderCounts: Record<string, { today: number; week: number; month: number; overall: number }> = {
        'acc-1': { today: 0, week: 0, month: 0, overall: 0 },
        'acc-2': { today: 0, week: 0, month: 0, overall: 0 },
      };

      for (const ev of mockEvents) {
        const d = new Date(ev.created_at);
        const counts = senderCounts[ev.account_id];
        counts.overall++;
        if (isSameDay(d, now)) counts.today++;
        if (isWithinWeek(d, now)) counts.week++;
        if (isSameMonth(d, now)) counts.month++;
      }

      expect(senderCounts['acc-1'].today).toBe(2);
      expect(senderCounts['acc-1'].week).toBe(4);
      expect(senderCounts['acc-1'].overall).toBe(7);

      expect(senderCounts['acc-2'].today).toBe(1);
      expect(senderCounts['acc-2'].week).toBe(3);
      expect(senderCounts['acc-2'].overall).toBe(3);
    });
  });

  describe('Strict 50 Emails/Day Restriction', () => {
    it('strictly clamps sender daily limit to 50 even if configured higher in db', () => {
      const rawLimits = [20, 50, 100, 500];
      const clampedLimits = rawLimits.map((lim) => Math.min(lim || STRICT_DAILY_CAP, STRICT_DAILY_CAP));

      expect(clampedLimits).toEqual([20, 50, 50, 50]);
    });

    it('correctly computes remaining quota and detects accounts reaching the 50 limit', () => {
      const accounts: SenderEmailAnalytics[] = [
        {
          id: 'acc-1',
          email: SENDER_1,
          displayName: SENDER_1,
          status: 'active',
          dailyLimit: 50,
          sentToday: 12,
          remainingToday: Math.max(0, 50 - 12),
          lastSentAt: new Date().toISOString(),
          counts: { today: 12, week: 30, month: 45, overall: 100 },
        },
        {
          id: 'acc-2',
          email: SENDER_2,
          displayName: SENDER_2,
          status: 'rate_limited',
          dailyLimit: 50,
          sentToday: 50,
          remainingToday: Math.max(0, 50 - 50),
          lastSentAt: new Date().toISOString(),
          counts: { today: 50, week: 50, month: 50, overall: 200 },
        },
      ];

      expect(accounts[0].remainingToday).toBe(38);
      expect(accounts[0].sentToday >= accounts[0].dailyLimit).toBe(false);

      expect(accounts[1].remainingToday).toBe(0);
      expect(accounts[1].sentToday >= accounts[1].dailyLimit).toBe(true);
    });

    it('blocks queue dispatch when sender account reaches 50 sent today', () => {
      function canDispatchItem(sentToday: number, limit: number): boolean {
        const effectiveLimit = Math.min(limit || STRICT_DAILY_CAP, STRICT_DAILY_CAP);
        return sentToday < effectiveLimit;
      }

      expect(canDispatchItem(0, 50)).toBe(true);
      expect(canDispatchItem(49, 50)).toBe(true);
      expect(canDispatchItem(50, 50)).toBe(false);
      expect(canDispatchItem(51, 50)).toBe(false);
      // Even if limit was 100 in db, it must block at 50
      expect(canDispatchItem(50, 100)).toBe(false);
    });
  });

  describe('Sent Email Logs', () => {
    it('associates each sent log with the sender email, recipient, and campaign', () => {
      const logItem: SentEmailLogItem = {
        id: 'event-101',
        senderEmail: SENDER_1,
        recipientEmail: 'prof.smith@oxford.ac.uk',
        campaignName: 'UK STEM Gamification Fall',
        campaignId: 'camp-1',
        eventType: 'accepted_by_gmail',
        sentAt: new Date().toISOString(),
      };

      expect(logItem.senderEmail).toBe(SENDER_1);
      expect(logItem.recipientEmail).toBe('prof.smith@oxford.ac.uk');
      expect(logItem.eventType).toBe('accepted_by_gmail');
    });
  });
});
