import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  ShieldAlert,
  GitCommit,
  CheckCircle,
  Ban,
  Search,
  RefreshCw,
  Mail,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/shared/EmptyState';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import type { FollowUpStatus } from '../types/database.types';

interface FollowUpItem {
  id: string;
  campaign_id: string;
  contact_id: string;
  follow_up_status: FollowUpStatus;
  follow_up_scheduled_at: string | null;
  follow_up_sent_at: string | null;
  campaign_name: string;
  recipient_email: string;
  recipient_name: string;
  institution: string | null;
}

export function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchFollowUps = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Query campaign_recipients where follow_up_status is not 'none'
      const { data, error: err } = await supabase
        .from('campaign_recipients')
        .select(`
          id,
          campaign_id,
          contact_id,
          follow_up_status,
          follow_up_scheduled_at,
          follow_up_sent_at,
          campaign:campaigns(name),
          contact:contacts(email, full_name, institution)
        `)
        .neq('follow_up_status', 'none')
        .order('follow_up_scheduled_at', { ascending: true });

      if (err) throw err;

      const formatted: FollowUpItem[] = (data || []).map((row: any) => ({
        id: row.id,
        campaign_id: row.campaign_id,
        contact_id: row.contact_id,
        follow_up_status: row.follow_up_status,
        follow_up_scheduled_at: row.follow_up_scheduled_at,
        follow_up_sent_at: row.follow_up_sent_at,
        campaign_name: row.campaign?.name || 'Unknown Campaign',
        recipient_email: row.contact?.email || 'Unknown Email',
        recipient_name: row.contact?.full_name || 'Unknown',
        institution: row.contact?.institution || null,
      }));

      setFollowUps(formatted);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch follow-ups';
      console.error('fetchFollowUps error:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  const handleCancelFollowUp = async (recipientId: string) => {
    try {
      const { error: err } = await supabase
        .from('campaign_recipients')
        .update({
          follow_up_status: 'none',
          updated_at: new Date().toISOString(),
        })
        .eq('id', recipientId);

      if (err) throw err;
      await fetchFollowUps();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error cancelling follow-up';
      setError(msg);
    }
  };

  const filteredFollowUps = useMemo(() => {
    return followUps.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesEmail = item.recipient_email.toLowerCase().includes(q);
        const matchesName = item.recipient_name.toLowerCase().includes(q);
        const matchesCamp = item.campaign_name.toLowerCase().includes(q);
        if (!matchesEmail && !matchesName && !matchesCamp) return false;
      }

      if (statusFilter !== 'all' && item.follow_up_status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [followUps, searchQuery, statusFilter]);

  const getStatusBadge = (status: FollowUpStatus) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="warning">Scheduled</Badge>;
      case 'sent':
        return <Badge variant="success">Sent</Badge>;
      case 'skipped_replied':
        return <Badge variant="default">Skipped (Professor Replied)</Badge>;
      case 'skipped_unsubscribed':
        return <Badge variant="destructive">Skipped (Unsubscribed)</Badge>;
      case 'skipped_bounced':
        return <Badge variant="destructive">Skipped (Bounced)</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Follow-up Sequences</h2>
          <p className="text-sm text-gray-500">
            Intelligent Gmail threading (In-Reply-To, References) with strict deliverability suppression.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchFollowUps()}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* Suppression Safeguards Card */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span>Reply Suppression</span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 leading-normal">
            Follow-ups automatically cancel the instant a professor reply is logged.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
            <Ban className="h-4 w-4 text-red-600" />
            <span>Unsubscribe Suppression</span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 leading-normal">
            Immediate permanent suppression across all campaigns upon opt-out.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <span>Bounce Protection</span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 leading-normal">
            Hard bounces suppress subsequent follow-ups to protect sender domain score.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
            <GitCommit className="h-4 w-4 text-blue-600" />
            <span>Native Threading</span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 leading-normal">
            Follow-ups nest cleanly inside the existing Gmail conversation thread.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by recipient, email, or campaign..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-gray-50/50 pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="sent">Sent</option>
            <option value="skipped_replied">Skipped (Replied)</option>
            <option value="skipped_unsubscribed">Skipped (Unsubscribed)</option>
            <option value="skipped_bounced">Skipped (Bounced)</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-500">Loading follow-up sequences...</span>
        </div>
      ) : followUps.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-6 w-6" />}
          title="No Scheduled Follow-ups"
          description="Follow-up sequences will appear here when campaigns configured with follow-up intervals are launched."
        />
      ) : filteredFollowUps.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
          <p className="text-sm font-semibold text-gray-700">No follow-ups match your current filter.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Follow-up Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFollowUps.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-semibold text-gray-900">{item.recipient_name}</div>
                    <div className="text-xs font-mono text-gray-500 flex items-center gap-1.5 mt-0.5">
                      <Mail className="h-3 w-3 text-gray-400" />
                      {item.recipient_email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-gray-800">{item.campaign_name}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-gray-700 font-medium">
                      {item.follow_up_scheduled_at ? formatDate(item.follow_up_scheduled_at) : '—'}
                    </div>
                    {item.follow_up_sent_at && (
                      <div className="text-[11px] text-emerald-600">
                        Sent {formatDate(item.follow_up_sent_at)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(item.follow_up_status)}</TableCell>
                  <TableCell className="text-right">
                    {item.follow_up_status === 'scheduled' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelFollowUp(item.id)}
                        className="text-xs text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Skip
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default FollowUpsPage;
