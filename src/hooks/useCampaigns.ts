/**
 * Hook for Campaign Management & Lifecycle Operations
 * Handles campaign CRUD, recipient assignment, lifecycle transitions,
 * mandatory human approval gate sign-off, and sending controls.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Campaign, CampaignRecipient, CampaignStatus, FollowUpStatus } from '../types/database.types';
import { interpolateVariables } from '../lib/templates';
import { triggerSendingQueue } from '../services/queue';

export interface CreateCampaignInput {
  name: string;
  description?: string;
  accountId: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
  followUpEnabled?: boolean;
  followUpDelayDays?: number;
  followUpSubject?: string;
  followUpBodyText?: string;
  followUpBodyHtml?: string;
  scheduledAt?: string;
  recipientContactIds: string[];
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setCampaigns(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch campaigns';
      console.error('fetchCampaigns error:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  /**
   * Creates a campaign and its recipient entries.
   * Defaults to 'awaiting_approval' (or 'draft' if requested).
   */
  const createCampaign = async (
    input: CreateCampaignInput,
    status: CampaignStatus = 'awaiting_approval'
  ): Promise<{ success: boolean; campaign?: Campaign; error?: string }> => {
    if (!input.name.trim()) {
      return { success: false, error: 'Campaign name is required' };
    }
    if (!input.subject.trim()) {
      return { success: false, error: 'Email subject is required' };
    }
    if (!input.bodyText.trim()) {
      return { success: false, error: 'Email body text is required' };
    }
    if (input.recipientContactIds.length === 0) {
      return { success: false, error: 'At least one recipient contact must be selected' };
    }

    try {
      const userId = '00000000-0000-0000-0000-000000000000';

      // 1. Insert campaign
      const { data: campaign, error: campError } = await supabase
        .from('campaigns')
        .insert({
          user_id: userId,
          account_id: input.accountId || null,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          subject: input.subject.trim(),
          body_text: input.bodyText.trim(),
          body_html: input.bodyHtml || null,
          status,
          min_delay_seconds: input.minDelaySeconds ?? 20,
          max_delay_seconds: input.maxDelaySeconds ?? 60,
          follow_up_enabled: input.followUpEnabled ?? false,
          follow_up_delay_days: input.followUpDelayDays ?? 3,
          follow_up_subject: input.followUpSubject?.trim() || null,
          follow_up_body_text: input.followUpBodyText?.trim() || null,
          follow_up_body_html: input.followUpBodyHtml || null,
          scheduled_at: input.scheduledAt || null,
          approved_at: null, // Strictly null until explicit human approval
        })
        .select()
        .single();

      if (campError || !campaign) {
        throw campError || new Error('Failed to create campaign record');
      }

      // 2. Fetch contact info for selected recipients to personalize preview/stored fields
      const { data: selectedContacts, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .in('id', input.recipientContactIds);

      if (contactError) throw contactError;

      const baseSchedule = input.scheduledAt ? new Date(input.scheduledAt) : new Date();
      const followUpDelayDays = input.followUpDelayDays ?? 3;

      // 3. Insert campaign_recipients
      const recipientInserts = (selectedContacts || []).map((contact, idx) => {
        // Stagger schedule by random delay (e.g. 20-60s per contact)
        const delaySeconds = idx * ((input.minDelaySeconds ?? 20) + Math.floor(Math.random() * 15));
        const scheduledTime = new Date(baseSchedule.getTime() + delaySeconds * 1000).toISOString();

        const followUpScheduledTime = input.followUpEnabled
          ? new Date(new Date(scheduledTime).getTime() + followUpDelayDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

        return {
          campaign_id: campaign.id,
          contact_id: contact.id,
          status: 'queued' as const,
          personalized_subject: interpolateVariables(input.subject, contact),
          personalized_body: interpolateVariables(input.bodyText, contact),
          scheduled_for: scheduledTime,
          follow_up_status: (input.followUpEnabled ? 'scheduled' : 'none') as FollowUpStatus,
          follow_up_scheduled_at: followUpScheduledTime,
        };
      });

      if (recipientInserts.length > 0) {
        const { error: recipError } = await supabase
          .from('campaign_recipients')
          .insert(recipientInserts);

        if (recipError) throw recipError;
      }

      await fetchCampaigns();
      return { success: true, campaign };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating campaign';
      console.error('createCampaign error:', err);
      return { success: false, error: msg };
    }
  };

  /**
   * Mandatory Human Approval Gate:
   * Sets approved_at timestamp and transitions campaign to 'scheduled' or 'sending'.
   * Never allows unreviewed campaigns to be sent.
   */
  const approveCampaign = async (
    campaignId: string,
    action: 'send_now' | 'schedule'
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const targetStatus: CampaignStatus = action === 'send_now' ? 'sending' : 'scheduled';
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('campaigns')
        .update({
          status: targetStatus,
          approved_at: now,
          started_at: action === 'send_now' ? now : null,
          updated_at: now,
        })
        .eq('id', campaignId);

      if (updateError) throw updateError;

      // If send_now, trigger first batch send in background
      if (action === 'send_now') {
        try {
          await triggerSendingQueue({ campaignId, batchSize: 3 });
        } catch (queueErr) {
          console.warn('Initial micro-batch send trigger deferred to cron:', queueErr);
        }
      }

      await fetchCampaigns();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error approving campaign';
      return { success: false, error: msg };
    }
  };

  /**
   * Pause an active sending or scheduled campaign
   */
  const pauseCampaign = async (campaignId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: err } = await supabase
        .from('campaigns')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (err) throw err;
      await fetchCampaigns();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error pausing campaign';
      return { success: false, error: msg };
    }
  };

  /**
   * Resume a paused campaign
   */
  const resumeCampaign = async (campaignId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: err } = await supabase
        .from('campaigns')
        .update({ status: 'sending', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (err) throw err;
      await fetchCampaigns();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error resuming campaign';
      return { success: false, error: msg };
    }
  };

  /**
   * Cancel campaign and suppress remaining queued items
   */
  const cancelCampaign = async (campaignId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const now = new Date().toISOString();
      const { error: err } = await supabase
        .from('campaigns')
        .update({ status: 'cancelled', updated_at: now })
        .eq('id', campaignId);

      if (err) throw err;

      // Cancel unsent follow-ups
      await supabase
        .from('campaign_recipients')
        .update({ follow_up_status: 'none', updated_at: now })
        .eq('campaign_id', campaignId)
        .eq('follow_up_status', 'scheduled');

      await fetchCampaigns();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error cancelling campaign';
      return { success: false, error: msg };
    }
  };

  /**
   * Delete campaign
   */
  const deleteCampaign = async (campaignId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: err } = await supabase.from('campaigns').delete().eq('id', campaignId);
      if (err) throw err;
      await fetchCampaigns();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting campaign';
      return { success: false, error: msg };
    }
  };

  /**
   * Fetch recipients for a campaign with their delivery status
   */
  const getCampaignRecipients = async (
    campaignId: string
  ): Promise<Array<CampaignRecipient & { contact?: any }>> => {
    const { data, error: err } = await supabase
      .from('campaign_recipients')
      .select('*, contact:contacts(*)')
      .eq('campaign_id', campaignId)
      .order('scheduled_for', { ascending: true });

    if (err) {
      console.error('Error fetching campaign recipients:', err);
      return [];
    }
    return data || [];
  };

  return {
    campaigns,
    loading,
    error,
    refresh: fetchCampaigns,
    createCampaign,
    approveCampaign,
    pauseCampaign,
    resumeCampaign,
    cancelCampaign,
    deleteCampaign,
    getCampaignRecipients,
  };
}
