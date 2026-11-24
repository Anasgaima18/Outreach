/**
 * Analytics Hook — GamifyTL Outreach Platform
 *
 * Fetches real metrics strictly from verified Supabase database events.
 * No tracking pixels. No speculative open-rate claims.
 * Data sources: campaigns, campaign_recipients, email_events, replies,
 *               suppressions, contacts, connected_accounts.
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

export interface SenderEmailAnalytics {
  id: string;
  email: string;
  displayName: string;
  status: string;
  dailyLimit: number; // strictly capped at 50
  sentToday: number;
  remainingToday: number;
  lastSentAt: string | null;
  counts: {
    today: number;
    week: number;
    month: number;
    overall: number;
  };
}

export interface SentEmailLogItem {
  id: string;
  senderEmail: string;
  recipientEmail: string;
  campaignName: string;
  campaignId: string;
  eventType: string; // 'accepted_by_gmail'
  sentAt: string;
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

  // Sender email volume & filters
  senderAnalytics: SenderEmailAnalytics[];
  sentLogs: SentEmailLogItem[];
  totalSentByPeriod: {
    today: number;
    week: number;
    month: number;
    overall: number;
  };

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

export type TimeFilterPeriod = 'today' | 'week' | 'month' | 'overall';

/** Helpers for period classification */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function isWithinWeek(date: Date, now: Date): boolean {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  return date >= sevenDaysAgo && date <= now;
}

export function isSameMonth(date: Date, now: Date): boolean {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

const EMPTY: AnalyticsData = {
  totalCampaigns: 0,
  totalContacts: 0,
  totalQueued: 0,
  totalSent: 0,
  totalFailed: 0,
  totalReplies: 0,
  totalSuppressions: 0,
  senderAnalytics: [],
  sentLogs: [],
  totalSentByPeriod: {
    today: 0,
    week: 0,
    month: 0,
    overall: 0,
  },
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
        accountsRes,
      ] = await Promise.all([
        supabase.from('campaigns').select('id, name, account_id, status, created_at').order('created_at', { ascending: false }),
        supabase.from('campaign_recipients').select('id, campaign_id, contact_id, status, follow_up_status'),
        supabase.from('email_events').select('id, campaign_id, recipient_id, account_id, event_type, metadata, created_at').order('created_at', { ascending: false }),
        supabase.from('replies').select('campaign_id, received_at'),
        supabase.from('suppressions').select('id'),
        supabase.from('contacts').select('id, email, country, first_name, last_name, full_name'),
        supabase.from('connected_accounts').select('id, email, display_name, daily_limit, sent_today_count, status, last_sent_at').order('created_at', { ascending: true }),
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
      const accounts = accountsRes.data || [];

      // ── Top-level counts ──────────────────────────────────────────────
      const totalCampaigns = campaigns.length;
      const totalContacts = contacts.length;
      const totalSuppressions = suppressions.length;
      const totalReplies = replies.length;

      // Recipient status tallies
      const totalQueued = recipients.filter((r) => r.status === 'queued').length;
      const totalSent = recipients.filter((r) => r.status === 'sent').length;
      const totalFailed = recipients.filter((r) => r.status === 'failed').length;

      // ── Lookups for mapping ────────────────────────────────────────────
      const campaignsMap = new Map<string, { id: string; name: string; account_id: string | null }>();
      for (const c of campaigns) {
        campaignsMap.set(c.id, { id: c.id, name: c.name, account_id: c.account_id || null });
      }

      const contactsMap = new Map<string, { email: string; name: string }>();
      for (const ct of contacts) {
        contactsMap.set(ct.id, { email: ct.email, name: ct.full_name || ct.first_name || '' });
      }

      const recipientToEmailMap = new Map<string, string>();
      for (const r of recipients) {
        if (r.contact_id && contactsMap.has(r.contact_id)) {
          recipientToEmailMap.set(r.id, contactsMap.get(r.contact_id)!.email);
        }
      }

      const accountsMap = new Map<string, { id: string; email: string; displayName: string; status: string; dailyLimit: number; sentToday: number; lastSentAt: string | null }>();
      const senderCounts: Record<string, { today: number; week: number; month: number; overall: number }> = {};

      for (const acc of accounts) {
        const cappedLimit = Math.min(acc.daily_limit || 50, 50);
        accountsMap.set(acc.id, {
          id: acc.id,
          email: acc.email,
          displayName: acc.display_name || acc.email,
          status: acc.status,
          dailyLimit: cappedLimit,
          sentToday: acc.sent_today_count || 0,
          lastSentAt: acc.last_sent_at || null,
        });
        senderCounts[acc.id] = { today: 0, week: 0, month: 0, overall: 0 };
      }

      // ── Process email events for per-sender metrics & sent logs ────────
      const now = new Date();
      const sentLogs: SentEmailLogItem[] = [];

      for (const ev of events) {
        if (ev.event_type !== 'accepted_by_gmail') continue;

        // Determine sender account
        let accId = ev.account_id;
        if (!accId && ev.campaign_id && campaignsMap.has(ev.campaign_id)) {
          accId = campaignsMap.get(ev.campaign_id)!.account_id;
        }
        if (!accId) accId = 'unknown';

        if (!senderCounts[accId]) {
          senderCounts[accId] = { today: 0, week: 0, month: 0, overall: 0 };
        }

        const evDate = new Date(ev.created_at);
        senderCounts[accId].overall++;
        if (isSameDay(evDate, now)) senderCounts[accId].today++;
        if (isWithinWeek(evDate, now)) senderCounts[accId].week++;
        if (isSameMonth(evDate, now)) senderCounts[accId].month++;

        // Metadata fallback for recipient email if recipient_id not in map
        const meta = (ev.metadata && typeof ev.metadata === 'object' ? ev.metadata : {}) as Record<string, unknown>;
        const recipientEmail =
          recipientToEmailMap.get(ev.recipient_id) ||
          (typeof meta.recipient_email === 'string' ? meta.recipient_email : '') ||
          (typeof meta.to === 'string' ? meta.to : '') ||
          'Recipient';

        const senderEmail = accountsMap.get(accId)?.email || (accId !== 'unknown' ? accId : 'Outreach Sender');
        const campaignName = (ev.campaign_id && campaignsMap.get(ev.campaign_id)?.name) || 'Direct Outreach';

        sentLogs.push({
          id: ev.id,
          senderEmail,
          recipientEmail,
          campaignName,
          campaignId: ev.campaign_id,
          eventType: ev.event_type,
          sentAt: ev.created_at,
        });
      }

      // ── Assemble senderAnalytics ───────────────────────────────────────
      const senderAnalytics: SenderEmailAnalytics[] = accounts.map((acc) => {
        const counts = senderCounts[acc.id] || { today: 0, week: 0, month: 0, overall: 0 };
        const dailyLimit = Math.min(acc.daily_limit || 50, 50);
        // Ensure sentToday reflects highest of DB counter and today's accepted event count
        const sentToday = Math.max(acc.sent_today_count || 0, counts.today);
        const remainingToday = Math.max(0, dailyLimit - sentToday);

        return {
          id: acc.id,
          email: acc.email,
          displayName: acc.display_name || acc.email,
          status: acc.status,
          dailyLimit,
          sentToday,
          remainingToday,
          lastSentAt: acc.last_sent_at || null,
          counts,
        };
      });

      // Handle any sender with events not present in accounts table (e.g. historical/mock)
      for (const [accId, counts] of Object.entries(senderCounts)) {
        if (!accounts.some((a) => a.id === accId) && counts.overall > 0) {
          senderAnalytics.push({
            id: accId,
            email: accId === 'unknown' ? 'Unassigned / System' : accId,
            displayName: accId === 'unknown' ? 'Unassigned' : accId,
            status: 'active',
            dailyLimit: 50,
            sentToday: counts.today,
            remainingToday: Math.max(0, 50 - counts.today),
            lastSentAt: null,
            counts,
          });
        }
      }

      // ── Calculate totalSentByPeriod ────────────────────────────────────
      const totalSentByPeriod = {
        today: senderAnalytics.reduce((sum, s) => sum + s.counts.today, 0),
        week: senderAnalytics.reduce((sum, s) => sum + s.counts.week, 0),
        month: senderAnalytics.reduce((sum, s) => sum + s.counts.month, 0),
        overall: senderAnalytics.reduce((sum, s) => sum + s.counts.overall, 0),
      };

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
      const dailyMap: Record<string, DailyVolume> = {};
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
        senderAnalytics,
        sentLogs,
        totalSentByPeriod,
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
  return 'General Send Error';
}
