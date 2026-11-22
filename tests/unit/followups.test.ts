import { describe, it, expect } from 'vitest';
import type { FollowUpStatus, RecipientStatus } from '../../src/types/database.types';

/**
 * Pure domain logic helper simulating follow-up suppression evaluation
 */
function evaluateFollowUpSuppression(params: {
  currentStatus: FollowUpStatus;
  recipientStatus: RecipientStatus;
  isSuppressed: boolean;
  campaignStatus: string;
}): { shouldSend: boolean; nextStatus: FollowUpStatus; reason?: string } {
  if (params.campaignStatus === 'cancelled') {
    return { shouldSend: false, nextStatus: 'none', reason: 'Campaign cancelled' };
  }

  if (params.recipientStatus === 'replied') {
    return { shouldSend: false, nextStatus: 'skipped_replied', reason: 'Professor replied' };
  }

  if (params.recipientStatus === 'unsubscribed' || params.isSuppressed) {
    return { shouldSend: false, nextStatus: 'skipped_unsubscribed', reason: 'Recipient unsubscribed or suppressed' };
  }

  if (params.recipientStatus === 'bounced') {
    return { shouldSend: false, nextStatus: 'skipped_bounced', reason: 'Hard bounce recorded' };
  }

  if (params.currentStatus === 'scheduled') {
    return { shouldSend: true, nextStatus: 'scheduled' };
  }

  return { shouldSend: false, nextStatus: params.currentStatus };
}

describe('Follow-up Sequences & Suppression Unit Tests', () => {
  it('suppresses follow-up immediately if recipient has replied', () => {
    const res = evaluateFollowUpSuppression({
      currentStatus: 'scheduled',
      recipientStatus: 'replied',
      isSuppressed: false,
      campaignStatus: 'sending',
    });

    expect(res.shouldSend).toBe(false);
    expect(res.nextStatus).toBe('skipped_replied');
    expect(res.reason).toContain('replied');
  });

  it('suppresses follow-up if recipient has unsubscribed or is in suppression ledger', () => {
    const resUnsub = evaluateFollowUpSuppression({
      currentStatus: 'scheduled',
      recipientStatus: 'unsubscribed',
      isSuppressed: false,
      campaignStatus: 'sending',
    });
    expect(resUnsub.shouldSend).toBe(false);
    expect(resUnsub.nextStatus).toBe('skipped_unsubscribed');

    const resSupp = evaluateFollowUpSuppression({
      currentStatus: 'scheduled',
      recipientStatus: 'sent',
      isSuppressed: true,
      campaignStatus: 'sending',
    });
    expect(resSupp.shouldSend).toBe(false);
    expect(resSupp.nextStatus).toBe('skipped_unsubscribed');
  });

  it('suppresses follow-up if delivery hard bounced', () => {
    const res = evaluateFollowUpSuppression({
      currentStatus: 'scheduled',
      recipientStatus: 'bounced',
      isSuppressed: false,
      campaignStatus: 'sending',
    });
    expect(res.shouldSend).toBe(false);
    expect(res.nextStatus).toBe('skipped_bounced');
  });

  it('cancels scheduled follow-ups if entire campaign is cancelled', () => {
    const res = evaluateFollowUpSuppression({
      currentStatus: 'scheduled',
      recipientStatus: 'sent',
      isSuppressed: false,
      campaignStatus: 'cancelled',
    });
    expect(res.shouldSend).toBe(false);
    expect(res.nextStatus).toBe('none');
  });

  it('allows follow-up to proceed if recipient has no replies, bounces, or suppressions', () => {
    const res = evaluateFollowUpSuppression({
      currentStatus: 'scheduled',
      recipientStatus: 'sent',
      isSuppressed: false,
      campaignStatus: 'sending',
    });
    expect(res.shouldSend).toBe(true);
    expect(res.nextStatus).toBe('scheduled');
  });

  it('accurately calculates follow-up scheduled timestamp from initial send date and delay days', () => {
    const baseDate = new Date('2026-11-22T10:00:00Z');
    const delayDays = 3;
    const scheduledTime = new Date(baseDate.getTime() + delayDays * 24 * 60 * 60 * 1000).toISOString();

    expect(scheduledTime).toBe('2026-11-25T10:00:00.000Z');
  });
});
