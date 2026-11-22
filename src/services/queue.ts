/**
 * Queue Management Service Layer
 * Orchestrates micro-batch sending execution, queue status polling,
 * failure rescheduling, and exponential backoff calculations.
 */

import { supabase } from '@/lib/supabase';
import type { RecipientStatus } from '@/types/database.types';

export interface SendingQueueResult {
  processed: number;
  success: number;
  failed: number;
  suppressed: number;
  errors: string[];
}

export interface QueueStatusSummary {
  campaignId: string;
  total: number;
  queued: number;
  sending: number;
  sent: number;
  failed: number;
  replied: number;
  suppressed: number;
  bounced: number;
  unsubscribed: number;
  isComplete: boolean;
}

/**
 * Calculates exponential backoff delay in milliseconds.
 * Formula: 2^(retry_count) * 60 seconds (2m, 4m, 8m).
 * Clamped to a maximum of 24 hours (86,400,000 ms) to prevent numeric overflow.
 */
export function calculateBackoffDelay(retryCount: number): number {
  if (retryCount <= 0 || !Number.isFinite(retryCount)) return 0;
  const maxDelayMs = 24 * 60 * 60 * 1000; // 24 hours cap (86,400,000 ms)
  const delay = Math.pow(2, Math.floor(retryCount)) * 60 * 1000;
  return Math.min(delay, maxDelayMs);
}

/**
 * Computes next scheduled retry timestamp given current retry count.
 */
export function calculateNextRetryAt(retryCount: number, baseDate = new Date()): string {
  const delayMs = calculateBackoffDelay(retryCount);
  return new Date(baseDate.getTime() + delayMs).toISOString();
}

/**
 * Triggers the micro-batch sending Edge Function (`process-sending-queue`).
 */
export async function triggerSendingQueue(params: {
  campaignId?: string;
  batchSize?: number;
}): Promise<SendingQueueResult> {
  const { data, error } = await supabase.functions.invoke('process-sending-queue', {
    body: {
      campaign_id: params.campaignId || null,
      batch_size: params.batchSize !== undefined ? params.batchSize : 3,
    },
  });

  if (error) {
    console.error('Failed to trigger sending queue:', error);
    throw error;
  }

  return {
    processed: data?.processed || 0,
    success: data?.success || 0,
    failed: data?.failed || 0,
    suppressed: data?.suppressed || 0,
    errors: data?.errors || [],
  };
}

/**
 * Retrieves aggregate queue delivery statuses for a given campaign.
 */
export async function getQueueStatus(campaignId: string): Promise<QueueStatusSummary> {
  const { data, error } = await supabase
    .from('campaign_recipients')
    .select('status')
    .eq('campaign_id', campaignId);

  if (error) {
    console.error('Error fetching queue status:', error);
    throw error;
  }

  const counts: Record<RecipientStatus, number> = {
    queued: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    replied: 0,
    suppressed: 0,
    bounced: 0,
    unsubscribed: 0,
  };

  const rows = data || [];
  for (const row of rows) {
    const status = row.status as RecipientStatus;
    if (status in counts) {
      counts[status] += 1;
    }
  }

  const remaining = counts.queued + counts.sending;
  const isComplete = rows.length > 0 && remaining === 0;

  return {
    campaignId,
    total: rows.length,
    queued: counts.queued,
    sending: counts.sending,
    sent: counts.sent,
    failed: counts.failed,
    replied: counts.replied,
    suppressed: counts.suppressed,
    bounced: counts.bounced,
    unsubscribed: counts.unsubscribed,
    isComplete,
  };
}

/**
 * Reschedules all failed recipients in a campaign back to 'queued' with retry count reset.
 */
export async function rescheduleFailedRecipients(
  campaignId: string
): Promise<{ count: number; error?: string }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('campaign_recipients')
    .update({
      status: 'queued',
      retry_count: 0,
      error_message: null,
      next_retry_at: null,
      scheduled_for: now,
      updated_at: now,
    })
    .eq('campaign_id', campaignId)
    .eq('status', 'failed')
    .select('id');

  if (error) {
    console.error('Error rescheduling failed recipients:', error);
    return { count: 0, error: error.message };
  }

  return { count: data?.length || 0 };
}
