/**
 * Analytics & Health Dashboard — GamifyTL Outreach Platform
 *
 * Displays real metrics from Supabase: campaign stats, sending volume,
 * failure breakdown, reply trends, and geographic distribution.
 *
 * Integrity constraint: NO open-rate tracking pixels, NO speculative inbox
 * placement claims. Only Gmail API confirmation (message ID received) counts
 * as "Sent". Apple MPP and proxy prefetches are NOT counted.
 */

import { useEffect } from 'react';
import {
  BarChart3,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Mail,
  Users,
  Inbox,
  Ban,
  TrendingUp,
  Globe,
  Activity,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAnalytics } from '../hooks/useAnalytics';

// ─── Status colour helpers ────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  awaiting_approval: 'bg-amber-100 text-amber-800',
  scheduled: 'bg-blue-100 text-blue-800',
  sending: 'bg-indigo-100 text-indigo-800',
  sent: 'bg-emerald-100 text-emerald-800',
  paused: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
};

function statusBadge(status: string) {
  const cls = STATUS_COLORS[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Mini CSS bar chart ───────────────────────────────────────────────────────

interface BarPoint {
  label: string;
  sent: number;
  failed: number;
  replies: number;
}

function MiniBarChart({ points, maxVal }: { points: BarPoint[]; maxVal: number }) {
  if (points.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-gray-400 border border-dashed rounded-lg bg-gray-50/50">
        No data yet — activate a campaign to begin
      </div>
    );
  }

  const scale = maxVal > 0 ? maxVal : 1;

  return (
    <div className="flex items-end gap-0.5 h-40 w-full overflow-x-auto pb-6 relative">
      {/* Y-axis guideline */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="border-t border-gray-100 w-full" />
        ))}
      </div>
      {points.map((p) => {
        const sentH = Math.round((p.sent / scale) * 100);
        const failH = Math.round((p.failed / scale) * 100);
        const repH = Math.round((p.replies / scale) * 100);
        const hasData = p.sent + p.failed + p.replies > 0;
        return (
          <div
            key={p.label}
            className="flex-1 min-w-[8px] flex flex-col-reverse items-center gap-px group relative"
            title={`${p.label}: sent ${p.sent}, failed ${p.failed}, replies ${p.replies}`}
          >
            {/* Tooltip */}
            {hasData && (
              <div className="hidden group-hover:flex absolute bottom-full mb-1 z-10 flex-col bg-gray-900 text-white text-[9px] rounded px-1.5 py-1 whitespace-nowrap shadow-lg">
                <span>{p.label}</span>
                <span>✓ {p.sent} sent</span>
                {p.failed > 0 && <span>✗ {p.failed} failed</span>}
                {p.replies > 0 && <span>↩ {p.replies} replies</span>}
              </div>
            )}
            {repH > 0 && (
              <div className="w-full bg-indigo-400 rounded-t-sm" style={{ height: `${repH}%` }} />
            )}
            {failH > 0 && (
              <div className="w-full bg-red-400" style={{ height: `${failH}%` }} />
            )}
            {sentH > 0 && (
              <div className="w-full bg-emerald-400 rounded-t-sm" style={{ height: `${sentH}%` }} />
            )}
            {/* Date label */}
            <span className="absolute -bottom-5 text-[8px] text-gray-400 rotate-45 origin-top-left">
              {p.label.slice(5)} {/* MM-DD */}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Horizontal bar for country distribution ──────────────────────────────────

function HorizBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 truncate text-gray-700 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right text-gray-500 shrink-0">{count}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const { data, loading, error, refresh } = useAnalytics();

  // Auto-refresh every 60 s while page is mounted
  useEffect(() => {
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const maxDailyVol = Math.max(
    ...data.dailyVolume.map((d) => d.sent + d.failed + d.replies),
    1
  );

  const barPoints: BarPoint[] = data.dailyVolume.map((d) => ({
    label: d.date,
    sent: d.sent,
    failed: d.failed,
    replies: d.replies,
  }));

  const maxCountry = data.countryDistribution[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Outreach Analytics &amp; Health</h2>
          <p className="text-sm text-gray-500">
            Live figures from your Supabase database. Auto-refreshes every 60 s.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {/* ── Integrity Notice ── */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-blue-900 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1 leading-relaxed">
            <p className="font-semibold text-blue-950">Strict Analytics Integrity Mandate — No Open-Rate Tracking</p>
            <p>
              Apple Mail Privacy Protection (MPP) and academic mail proxies cause 100% false-positive image
              prefetches. This platform does not embed tracking pixels and does not report open rates.
              <br />
              <strong>Sent</strong> = Gmail API accepted with a message ID.{' '}
              <strong>Failed</strong> = API rejected or rate-limited.{' '}
              <strong>Replied</strong> = Inbound message detected in connected Gmail inbox.
            </p>
          </div>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Metric Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Contacts"
          value={data.totalContacts}
          icon={<Users className="h-4 w-4 text-gray-400" />}
          sub="In your outreach database"
        />
        <MetricCard
          title="Accepted by Gmail API"
          value={data.totalSent}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          sub="Confirmed with message ID"
          highlight="emerald"
        />
        <MetricCard
          title="Failed Sends"
          value={data.totalFailed}
          icon={<XCircle className="h-4 w-4 text-red-600" />}
          sub="Quota, token, or network errors"
          highlight={data.totalFailed > 0 ? 'red' : undefined}
        />
        <MetricCard
          title="Replies Received"
          value={data.totalReplies}
          icon={<Inbox className="h-4 w-4 text-indigo-600" />}
          sub="Detected in Gmail inbox"
          highlight="indigo"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Campaigns"
          value={data.totalCampaigns}
          icon={<Mail className="h-4 w-4 text-gray-400" />}
          sub="Total created"
        />
        <MetricCard
          title="Queued"
          value={data.totalQueued}
          icon={<Activity className="h-4 w-4 text-amber-500" />}
          sub="Pending dispatch"
        />
        <MetricCard
          title="Suppressions"
          value={data.totalSuppressions}
          icon={<Ban className="h-4 w-4 text-orange-500" />}
          sub="Opt-outs &amp; bounces blocked"
        />
        <MetricCard
          title="Reply Rate"
          value={
            data.totalSent > 0
              ? `${((data.totalReplies / data.totalSent) * 100).toFixed(1)}%`
              : '—'
          }
          icon={<TrendingUp className="h-4 w-4 text-indigo-400" />}
          sub="Replies ÷ accepted sends"
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Daily volume bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Sending Volume — Last 14 Days
            </CardTitle>
            <CardDescription>
              Daily Gmail API submissions, failures, and inbound replies.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2">
            <MiniBarChart points={barPoints} maxVal={maxDailyVol} />
            {/* Legend */}
            <div className="flex items-center gap-4 mt-6 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-400" />Sent</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400" />Failed</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-400" />Replies</span>
            </div>
          </CardContent>
        </Card>

        {/* Geographic distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-indigo-600" />
              Contact Geography — Top 10 Countries
            </CardTitle>
            <CardDescription>
              Educator contacts by country from your database.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2">
            {data.countryDistribution.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-gray-400 border border-dashed rounded-lg bg-gray-50/50">
                Import contacts to see geographic distribution
              </div>
            ) : (
              <div className="space-y-2.5 mt-2">
                {data.countryDistribution.map((c) => (
                  <HorizBar key={c.country} label={c.country} count={c.count} max={maxCountry} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Campaign Status Distribution ── */}
      {Object.keys(data.statusCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign Status Breakdown</CardTitle>
            <CardDescription>Count of campaigns by current lifecycle status.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 px-4 pb-4">
            {Object.entries(data.statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5">
                {statusBadge(status)}
                <span className="text-xs font-semibold text-gray-700">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Failure Reason Breakdown ── */}
      {data.failureReasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Failure Reason Analysis
            </CardTitle>
            <CardDescription>
              Categorised Gmail API and queue errors from your email_events log.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {data.failureReasons.map((f) => {
                const pct = data.totalFailed > 0 ? Math.round((f.count / data.totalFailed) * 100) : 0;
                return (
                  <div key={f.reason} className="flex items-center gap-2 text-xs">
                    <span className="w-48 truncate text-gray-700 shrink-0">{f.reason}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-red-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right text-gray-500 shrink-0">{f.count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Campaign Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Performance Table</CardTitle>
          <CardDescription>
            Per-campaign recipient counts and reply totals. Sorted by most recent.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {data.campaignSummaries.length === 0 ? (
            <div className="px-4 pb-4 text-xs text-gray-400 text-center py-8">
              No campaigns yet. Create your first campaign to see performance data.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50/70 text-left text-[10px] uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 font-semibold">Campaign</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Total</th>
                    <th className="px-4 py-3 font-semibold text-right text-emerald-700">Sent</th>
                    <th className="px-4 py-3 font-semibold text-right text-red-600">Failed</th>
                    <th className="px-4 py-3 font-semibold text-right text-indigo-700">Replies</th>
                    <th className="px-4 py-3 font-semibold text-right">Reply Rate</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.campaignSummaries.map((c) => {
                    const replyRate =
                      c.sent > 0 ? `${((c.replies / c.sent) * 100).toFixed(1)}%` : '—';
                    return (
                      <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                          {c.name}
                        </td>
                        <td className="px-4 py-3">{statusBadge(c.status)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{c.total}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700">{c.sent}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          {c.failed > 0 ? c.failed : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-indigo-700">
                          {c.replies > 0 ? c.replies : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{replyRate}</td>
                        <td className="px-4 py-3 text-gray-400">
                          {new Date(c.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: '2-digit',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Footer note ── */}
      <p className="text-[10px] text-gray-400 text-center pb-2">
        Figures update every 60 s. All metrics are derived strictly from Gmail API responses and your Supabase
        database — no third-party analytics, no open-rate pixels, no speculative deliverability claims.
      </p>
    </div>
  );
}

// ─── Shared metric card ───────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  icon,
  sub,
  highlight,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  sub: string;
  highlight?: 'emerald' | 'red' | 'indigo';
}) {
  const valueClass =
    highlight === 'emerald'
      ? 'text-emerald-700'
      : highlight === 'red'
      ? 'text-red-600'
      : highlight === 'indigo'
      ? 'text-indigo-700'
      : 'text-gray-900';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold text-gray-500 uppercase">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
        <p className="text-[11px] text-gray-500 mt-1" dangerouslySetInnerHTML={{ __html: sub }} />
      </CardContent>
    </Card>
  );
}
