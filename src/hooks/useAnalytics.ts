/**
 * Analytics Hook — GamifyTL Outreach Platform
 *
 * Fetches real metrics strictly from verified Supabase database events.
 * No tracking pixels. No speculative open-rate claims.
 * Data sources: campaigns, campaign_recipients, email_events, replies,
 *               suppressions, contacts.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  replies: number;
  created_at: string;
}

export interface DailyVolume {
  date: string; // 'YYYY-MM-DD'
  sent: number;
  failed: number;
  replies: number;
}

export interface CountryCount {
  country: string;
  count: number;
}

export interface AnalyticsData {
  // Top-level metric cards
  totalCampaigns: number;
  totalContacts: number;
  totalQueued: number;
  totalSent: number;
  totalFailed: number;
  totalReplies: number;
  totalSuppressions: number;

  // Campaign breakdown table
  campaignSummaries: CampaignSummary[];

  // Status distribution (for mini breakdown)
  statusCounts: Record<string, number>;

  // Daily volume (last 14 days)
  dailyVolume: DailyVolume[];

  // Geographic distribution of contacts
  countryDistribution: CountryCount[];

  // Error breakdown
  failureReasons: { reason: string; count: number }[];
}

const EMPTY: AnalyticsData = {
  totalCampaigns: 0,
  totalContacts: 0,
  totalQueued: 0,
  totalSent: 0,
  totalFailed: 0,
  totalReplies: 0,
  totalSuppressions: 0,
  campaignSummaries: [],
  statusCounts: {},
  dailyVolume: [],
  countryDistribution: [],
  failureReasons: [],
};

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Run all independent queries in parallel
      const [
        campaignsRes,
        recipientsRes,
        eventsRes,
        repliesRes,
        suppressionsRes,
        contactsRes,
      ] = await Promise.all([
        supabase.from('campaigns').select('id, name, status, created_at').order('created_at', { ascending: false }),
        supabase.from('campaign_recipients').select('campaign_id, status, follow_up_status'),
        supabase.from('email_events').select('campaign_id, event_type, metadata, created_at').order('created_at', { ascending: true }),
        supabase.from('replies').select('campaign_id, received_at'),
        supabase.from('suppressions').select('id'),
        supabase.from('contacts').select('country'),
      ]);

      if (campaignsRes.error) throw campaignsRes.error;
      if (recipientsRes.error) throw recipientsRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (repliesRes.error) throw repliesRes.error;
      if (suppressionsRes.error) throw suppressionsRes.error;
      if (contactsRes.error) throw contactsRes.error;

      const campaigns = campaignsRes.data || [];
      const recipients = recipientsRes.data || [];
      const events = eventsRes.data || [];
      const replies = repliesRes.data || [];
      const suppressions = suppressionsRes.data || [];
      const contacts = contactsRes.data || [];

      // ── Top-level counts ──────────────────────────────────────────────
      const totalCampaigns = campaigns.length;
      const totalContacts = contacts.length;
      const totalSuppressions = suppressions.length;
      const totalReplies = replies.length;

      // Recipient status tallies
      const totalQueued = recipients.filter((r) => r.status === 'queued').length;
      const totalSent = recipients.filter((r) => r.status === 'sent').length;
      const totalFailed = recipients.filter((r) => r.status === 'failed').length;

      // ── Campaign-level summaries ──────────────────────────────────────
      const repliesPerCampaign: Record<string, number> = {};
      for (const r of replies) {
        if (r.campaign_id) {
          repliesPerCampaign[r.campaign_id] = (repliesPerCampaign[r.campaign_id] || 0) + 1;
        }
      }

      const recipientsByCampaign: Record<string, { total: number; sent: number; failed: number }> = {};
      for (const r of recipients) {
        if (!recipientsByCampaign[r.campaign_id]) {
          recipientsByCampaign[r.campaign_id] = { total: 0, sent: 0, failed: 0 };
        }
        recipientsByCampaign[r.campaign_id].total++;
        if (r.status === 'sent') recipientsByCampaign[r.campaign_id].sent++;
        if (r.status === 'failed') recipientsByCampaign[r.campaign_id].failed++;
      }

      const campaignSummaries: CampaignSummary[] = campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        total: recipientsByCampaign[c.id]?.total ?? 0,
        sent: recipientsByCampaign[c.id]?.sent ?? 0,
        failed: recipientsByCampaign[c.id]?.failed ?? 0,
        replies: repliesPerCampaign[c.id] ?? 0,
        created_at: c.created_at,
      }));

      // ── Campaign status distribution ──────────────────────────────────
      const statusCounts: Record<string, number> = {};
      for (const c of campaigns) {
        statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      }

      // ── Daily volume (last 14 days) ───────────────────────────────────
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 13);

      const dailyMap: Record<string, DailyVolume> = {};

      // Pre-populate 14 days with zeros
      for (let i = 0; i < 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        const key = d.toISOString().slice(0, 10);
        dailyMap[key] = { date: key, sent: 0, failed: 0, replies: 0 };
      }

      for (const ev of events) {
        const day = (ev.created_at || '').slice(0, 10);
        if (!dailyMap[day]) continue;
        if (ev.event_type === 'accepted_by_gmail') dailyMap[day].sent++;
        else if (ev.event_type === 'failed_send' || ev.event_type === 'bounced') dailyMap[day].failed++;
      }
      for (const r of replies) {
        const day = (r.received_at || '').slice(0, 10);
        if (dailyMap[day]) dailyMap[day].replies++;
      }

      const dailyVolume = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

      // ── Country distribution ──────────────────────────────────────────
      const countryMap: Record<string, number> = {};
      for (const c of contacts) {
        const country = (c.country || '').trim() || 'Unknown';
        countryMap[country] = (countryMap[country] || 0) + 1;
      }
      const countryDistribution: CountryCount[] = Object.entries(countryMap)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // ── Failure reason breakdown ──────────────────────────────────────
      const failureMap: Record<string, number> = {};
      for (const ev of events) {
        if (ev.event_type === 'failed_send' || ev.event_type === 'bounced') {
          // Error info stored in metadata JSON field
          const meta = ev.metadata as Record<string, unknown> | null;
          const reason = categoriseError(typeof meta?.error === 'string' ? meta.error : '');
          failureMap[reason] = (failureMap[reason] || 0) + 1;
        }
      }
      const failureReasons = Object.entries(failureMap)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      setData({
        totalCampaigns,
        totalContacts,
        totalQueued,
        totalSent,
        totalFailed,
        totalReplies,
        totalSuppressions,
        campaignSummaries,
        statusCounts,
        dailyVolume,
        countryDistribution,
        failureReasons,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load analytics';
      console.error('useAnalytics error:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

/** Maps raw API error strings to human-readable failure categories. */
function categoriseError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('429')) return 'Gmail Rate Limit';
  if (lower.includes('invalid_grant') || lower.includes('token')) return 'OAuth Token Expired';
  if (lower.includes('network') || lower.includes('timeout') || lower.includes('fetch')) return 'Network / Timeout';
  if (lower.includes('recipient') || lower.includes('address') || lower.includes('invalid')) return 'Invalid Recipient';
  if (lower.includes('suppressed')) return 'Suppressed Contact';
  if (lower.includes('not approved') || lower.includes('approval')) return 'Missing Approval';
  if (msg.trim()) return msg.length > 60 ? msg.slice(0, 57) + '…' : msg;
  return 'Unknown Error';
}
