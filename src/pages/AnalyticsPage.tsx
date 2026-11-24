/**
 * Analytics & Health Dashboard — GamifyTL Outreach Platform
 *
 * Dedicated to showing: Which email has sent how many emails.
 * Supports filters: Today, This Week, This Month, and Overall.
 * Enforces strict restriction: Maximum 50 emails sent per day per sender account.
 *
 * Integrity constraint: NO open-rate tracking pixels. Only verified Gmail API
 * responses (event_type = 'accepted_by_gmail') count as sent emails.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Mail,
  Users,
  Inbox,
  ShieldCheck,
  Search,
  Calendar,
  ChevronDown,
  ChevronUp,
  Send,
  SlidersHorizontal,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Progress } from '../components/ui/Progress';
import { useAnalytics, TimeFilterPeriod, isSameDay, isWithinWeek, isSameMonth } from '../hooks/useAnalytics';

// ─── Status badge helper ──────────────────────────────────────────────────────

function accountStatusBadge(status: string, sentToday: number, dailyLimit: number) {
  if (sentToday >= dailyLimit) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
        <AlertCircle className="h-3 w-3" />
        50/50 Daily Limit Reached
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3" />
        Active (Sending Allowed)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200">
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Mini CSS bar chart for daily trend ───────────────────────────────────────

interface BarPoint {
  label: string;
  sent: number;
  failed: number;
  replies: number;
}

function MiniBarChart({ points, maxVal }: { points: BarPoint[]; maxVal: number }) {
  if (points.length === 0) {
    return (
      <div className="h-36 flex items-center justify-center text-xs text-gray-400 border border-dashed rounded-lg bg-gray-50/50">
        No sending data yet
      </div>
    );
  }

  const scale = maxVal > 0 ? maxVal : 1;

  return (
    <div className="flex items-end gap-1 h-36 w-full overflow-x-auto pb-6 relative">
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="border-t border-gray-100 w-full" />
        ))}
      </div>
      {points.map((p) => {
        const sentH = Math.round((p.sent / scale) * 100);
        const hasData = p.sent > 0;
        return (
          <div
            key={p.label}
            className="flex-1 min-w-[12px] flex flex-col-reverse items-center gap-px group relative"
            title={`${p.label}: ${p.sent} sent`}
          >
            {hasData && (
              <div className="hidden group-hover:flex absolute bottom-full mb-1 z-10 flex-col bg-gray-900 text-white text-[9px] rounded px-1.5 py-1 whitespace-nowrap shadow-lg">
                <span>{p.label}</span>
                <span>✓ {p.sent} sent</span>
              </div>
            )}
            {sentH > 0 && (
              <div className="w-full bg-blue-600 rounded-t-sm" style={{ height: `${sentH}%` }} />
            )}
            <span className="absolute -bottom-5 text-[8px] text-gray-400 rotate-45 origin-top-left">
              {p.label.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Analytics Page ──────────────────────────────────────────────────────

export function AnalyticsPage() {
  const { data, loading, error, refresh } = useAnalytics();
  const [timeFilter, setTimeFilter] = useState<TimeFilterPeriod>('overall');
  const [logSearch, setLogSearch] = useState('');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Total sent in selected period
  const totalSentInFilter = useMemo(() => {
    return data.totalSentByPeriod[timeFilter] ?? 0;
  }, [data.totalSentByPeriod, timeFilter]);

  // Total sent today across all accounts
  const totalSentToday = useMemo(() => {
    return data.senderAnalytics.reduce((sum, s) => sum + s.sentToday, 0);
  }, [data.senderAnalytics]);

  // Filtered sent logs matching the time filter and search query
  const filteredLogs = useMemo(() => {
    const now = new Date();
    return data.sentLogs.filter((log) => {
      const logDate = new Date(log.sentAt);

      // Period filter
      if (timeFilter === 'today' && !isSameDay(logDate, now)) return false;
      if (timeFilter === 'week' && !isWithinWeek(logDate, now)) return false;
      if (timeFilter === 'month' && !isSameMonth(logDate, now)) return false;

      // Text search filter
      if (logSearch.trim()) {
        const query = logSearch.toLowerCase().trim();
        const matchesSender = log.senderEmail.toLowerCase().includes(query);
        const matchesRecipient = log.recipientEmail.toLowerCase().includes(query);
        const matchesCampaign = log.campaignName.toLowerCase().includes(query);
        return matchesSender || matchesRecipient || matchesCampaign;
      }

      return true;
    });
  }, [data.sentLogs, timeFilter, logSearch]);

  const filterLabels: Record<TimeFilterPeriod, string> = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    overall: 'Overall (All Time)',
  };

  const maxDailyVol = Math.max(
    ...data.dailyVolume.map((d) => d.sent),
    1
  );

  const barPoints: BarPoint[] = data.dailyVolume.map((d) => ({
    label: d.date,
    sent: d.sent,
    failed: d.failed,
    replies: d.replies,
  }));

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">
            Outreach Analytics &amp; Health: Email Sending Volume
          </h2>
          <p className="text-sm text-gray-500">
            Dedicated sender-level metrics. Track exactly which email has sent how many emails, with strict daily 50-mail restrictions.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing…' : 'Refresh Metrics'}
        </Button>
      </div>

      {/* ── Strict Integrity & 50 Emails/Day Restriction Callout ── */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 p-4 text-blue-900 shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-700 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1.5 leading-relaxed">
            <p className="font-bold text-blue-950 text-sm">
              Strict Analytics Integrity Mandate — Daily 50 Emails Restriction Enforced
            </p>
            <p className="text-blue-900/90">
              <strong>Strict Daily Cap:</strong> For domain health and sender reputation safety, only a maximum of{' '}
              <span className="font-bold text-blue-950 underline decoration-blue-400">50 emails per day</span> can be
              sent from each connected email account. Senders reaching 50 emails pause automatically until midnight.
            </p>
            <p className="text-blue-800 text-[11px]">
              <strong>Verified Delivery:</strong> Every count on this page reflects confirmed Gmail API responses
              (<code>accepted_by_gmail</code>) with verified message IDs. No tracking pixels, no speculative open claims.
            </p>
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Time Filter Bar (Today, This Week, This Month, Overall) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-white rounded-xl border border-gray-200 shadow-2xs">
        <div className="flex items-center gap-2 px-2 text-xs font-semibold text-gray-700">
          <Calendar className="h-4 w-4 text-blue-600" />
          <span>Filter Sending Period:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(['today', 'week', 'month', 'overall'] as TimeFilterPeriod[]).map((period) => {
            const isSelected = timeFilter === period;
            const count = data.totalSentByPeriod[period] ?? 0;
            const labels: Record<TimeFilterPeriod, string> = {
              today: 'Today',
              week: 'This Week',
              month: 'This Month',
              overall: 'Overall',
            };
            return (
              <button
                key={period}
                type="button"
                onClick={() => setTimeFilter(period)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                <span>{labels[period]}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-blue-700 text-blue-100' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Top Metric Cards for Selected Time Period ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-100 bg-gradient-to-br from-white to-blue-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Mails Sent ({filterLabels[timeFilter]})
            </CardTitle>
            <Send className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-blue-900">{totalSentInFilter}</div>
            <p className="text-[11px] text-gray-500 mt-1">
              Accepted by Gmail API in {filterLabels[timeFilter].toLowerCase()}
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-gradient-to-br from-white to-amber-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Daily Limit Restriction
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-amber-900">50 / day</div>
            <p className="text-[11px] text-gray-500 mt-1">
              {totalSentToday} total emails sent today across all accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Active Sender Accounts
            </CardTitle>
            <Users className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-gray-900">{data.senderAnalytics.length}</div>
            <p className="text-[11px] text-gray-500 mt-1">
              Connected Gmail sending mailboxes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Total Inbound Replies
            </CardTitle>
            <Inbox className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-700">{data.totalReplies}</div>
            <p className="text-[11px] text-gray-500 mt-1">
              Replies detected in connected mailboxes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── CORE SECTION: WHICH EMAIL HAS SENT HOW MANY MAILS ── */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                Sender Email Sending Volume &amp; Daily Quota Status
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Breakdown of emails sent by each connected email address, with live {filterLabels[timeFilter].toLowerCase()} totals and daily 50-limit progress.
              </CardDescription>
            </div>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
              Selected Period: {filterLabels[timeFilter]}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {data.senderAnalytics.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              No sender email accounts found. Connect a Gmail account to view sending volume.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.senderAnalytics.map((sender) => {
                const countForPeriod = sender.counts[timeFilter] ?? 0;
                const dailyLimit = 50; // Strict platform restriction
                const pctDaily = Math.min(100, Math.round((sender.sentToday / dailyLimit) * 100));
                const remaining = Math.max(0, dailyLimit - sender.sentToday);

                return (
                  <div key={sender.id} className="p-5 hover:bg-gray-50/60 transition-colors space-y-4">
                    {/* Header Row: Email + Period Count + Status Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {sender.email.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-900 font-mono">{sender.email}</span>
                            {accountStatusBadge(sender.status, sender.sentToday, dailyLimit)}
                          </div>
                          {sender.displayName && sender.displayName !== sender.email && (
                            <p className="text-xs text-gray-500">{sender.displayName}</p>
                          )}
                        </div>
                      </div>

                      {/* Prominent count in selected period */}
                      <div className="flex items-baseline gap-2 bg-blue-50/80 border border-blue-100 px-3.5 py-1.5 rounded-xl self-start sm:self-auto">
                        <span className="text-2xl font-black text-blue-800">{countForPeriod}</span>
                        <span className="text-xs font-semibold text-blue-700">
                          mails sent ({filterLabels[timeFilter].toLowerCase()})
                        </span>
                      </div>
                    </div>

                    {/* Strict 50/day Daily Limit Progress Bar */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                          <SlidersHorizontal className="h-3.5 w-3.5 text-gray-500" />
                          Strict Daily Quota (Max 50 Mails/Day)
                        </span>
                        <span className="font-mono font-bold text-gray-800">
                          {sender.sentToday} / {dailyLimit} sent today
                          <span className="ml-1.5 text-gray-500 font-normal">({remaining} remaining today)</span>
                        </span>
                      </div>
                      <Progress
                        value={sender.sentToday}
                        max={dailyLimit}
                        indicatorClassName={
                          sender.sentToday >= dailyLimit
                            ? 'bg-amber-500'
                            : sender.sentToday >= 40
                            ? 'bg-orange-500'
                            : 'bg-blue-600'
                        }
                      />
                      {sender.sentToday >= dailyLimit && (
                        <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Daily 50-email ceiling reached. Further dispatches will resume automatically tomorrow.
                        </p>
                      )}
                    </div>

                    {/* All Periods Breakdown Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                      <div
                        className={`p-2.5 rounded-lg border text-xs ${
                          timeFilter === 'today'
                            ? 'border-blue-300 bg-blue-50/50 font-bold text-blue-900'
                            : 'border-gray-100 bg-white text-gray-600'
                        }`}
                      >
                        <span className="text-[10px] text-gray-400 block uppercase font-semibold">Today</span>
                        <span className="text-base font-extrabold">{sender.counts.today}</span>
                      </div>
                      <div
                        className={`p-2.5 rounded-lg border text-xs ${
                          timeFilter === 'week'
                            ? 'border-blue-300 bg-blue-50/50 font-bold text-blue-900'
                            : 'border-gray-100 bg-white text-gray-600'
                        }`}
                      >
                        <span className="text-[10px] text-gray-400 block uppercase font-semibold">This Week</span>
                        <span className="text-base font-extrabold">{sender.counts.week}</span>
                      </div>
                      <div
                        className={`p-2.5 rounded-lg border text-xs ${
                          timeFilter === 'month'
                            ? 'border-blue-300 bg-blue-50/50 font-bold text-blue-900'
                            : 'border-gray-100 bg-white text-gray-600'
                        }`}
                      >
                        <span className="text-[10px] text-gray-400 block uppercase font-semibold">This Month</span>
                        <span className="text-base font-extrabold">{sender.counts.month}</span>
                      </div>
                      <div
                        className={`p-2.5 rounded-lg border text-xs ${
                          timeFilter === 'overall'
                            ? 'border-blue-300 bg-blue-50/50 font-bold text-blue-900'
                            : 'border-gray-100 bg-white text-gray-600'
                        }`}
                      >
                        <span className="text-[10px] text-gray-400 block uppercase font-semibold">Overall Total</span>
                        <span className="text-base font-extrabold">{sender.counts.overall}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── SENT EMAILS HISTORY LOG TABLE ── */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-100 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Send className="h-4 w-4 text-emerald-600" />
                Sent Emails History Log ({filterLabels[timeFilter]})
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Verified sends with sender email, recipient, and campaign details. Showing {filteredLogs.length} record(s).
              </CardDescription>
            </div>
            {/* Search filter input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search sender or recipient…"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              No sent email logs found matching {filterLabels[timeFilter].toLowerCase()}
              {logSearch ? ` and "${logSearch}"` : ''}.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase font-semibold text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Sender Email (From)</th>
                    <th className="px-4 py-2.5 text-left">Recipient Email (To)</th>
                    <th className="px-4 py-2.5 text-left">Campaign</th>
                    <th className="px-4 py-2.5 text-left">Time Sent</th>
                    <th className="px-4 py-2.5 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLogs.slice(0, 100).map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-semibold text-blue-900 truncate max-w-[200px]">
                        {log.senderEmail}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-700 truncate max-w-[200px]">
                        {log.recipientEmail}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 truncate max-w-[180px]">
                        {log.campaignName}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                        {new Date(log.sentAt).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Accepted by Gmail API
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Collapsible Section: Technical Health & 14-Day Activity Chart ── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails((v) => !v)}
          className="w-full flex items-center justify-between p-4 bg-gray-50/80 hover:bg-gray-100/70 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-bold text-gray-800">
              Technical Health &amp; 14-Day Activity Charts
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>{showTechnicalDetails ? 'Hide' : 'Show'} details</span>
            {showTechnicalDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {showTechnicalDetails && (
          <div className="p-4 space-y-6 border-t border-gray-200">
            {/* Daily volume bar chart */}
            <div>
              <h3 className="text-xs font-bold text-gray-800 mb-1">Sending Activity — Last 14 Days</h3>
              <p className="text-[11px] text-gray-500 mb-3">Daily Gmail API submissions across all campaigns.</p>
              <MiniBarChart points={barPoints} maxVal={maxDailyVol} />
            </div>

            {/* Campaign Performance Table */}
            {data.campaignSummaries.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-800 mb-2">Campaign Performance Summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50/70 text-left text-[10px] uppercase font-semibold text-gray-500">
                        <th className="px-3 py-2">Campaign</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-right text-emerald-700">Sent</th>
                        <th className="px-3 py-2 text-right text-red-600">Failed</th>
                        <th className="px-3 py-2 text-right text-indigo-700">Replies</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.campaignSummaries.map((c) => (
                        <tr key={c.id}>
                          <td className="px-3 py-2 font-medium text-gray-900">{c.name}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{c.total}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-700">{c.sent}</td>
                          <td className="px-3 py-2 text-right font-semibold text-red-600">{c.failed}</td>
                          <td className="px-3 py-2 text-right font-semibold text-indigo-700">{c.replies}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <p className="text-[10px] text-gray-400 text-center pb-2">
        Figures update live from Supabase. All counts represent verified Gmail API submissions. Maximum 50 emails per sender per day.
      </p>
    </div>
  );
}
