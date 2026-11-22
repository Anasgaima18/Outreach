import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Plus,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Mail,
  UserCheck,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/shared/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { supabase } from '../lib/supabase';
import { getGmailThreadUrl } from '../services/gmail';
import { formatDate } from '../lib/utils';
import { useAccounts } from '../hooks/useAccounts';
import { useContacts } from '../hooks/useContacts';
import { useCampaigns } from '../hooks/useCampaigns';
import type { Reply } from '../types/database.types';

export function RepliesPage() {
  const [replies, setReplies] = useState<Array<Reply & { account_email?: string; contact_name?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Manual Log Reply Modal
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replySnippet, setReplySnippet] = useState('');
  const [replyThreadId, setReplyThreadId] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const { accounts } = useAccounts();
  const { contacts } = useContacts();
  const { campaigns } = useCampaigns();

  const fetchReplies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('replies')
        .select(`
          *,
          contact:contacts(full_name, email),
          account:connected_accounts(email)
        `)
        .order('received_at', { ascending: false });

      if (err) throw err;

      const formatted = (data || []).map((r: any) => ({
        ...r,
        account_email: r.account?.email || (accounts[0]?.email ?? ''),
        contact_name: r.contact?.full_name || r.sender_email,
      }));

      setReplies(formatted);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch replies';
      console.error('fetchReplies error:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [accounts]);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  const handleSyncReplies = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const { data, error: syncErr } = await supabase.functions.invoke('sync-replies', {
        body: {},
      });
      if (syncErr) throw syncErr;
      setSyncMessage(
        `Sync completed: ${data?.synced_count ?? 0} new replies retrieved.`
      );
      await fetchReplies();
    } catch (err: unknown) {
      // Free-tier compliant notice: Testing mode without restricted scopes
      const msg = err instanceof Error ? err.message : 'API reply sync unavailable in testing mode.';
      setSyncMessage(`Sync notice: ${msg} Use manual reply logging for zero-cost operation.`);
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenLogModal = () => {
    setSelectedContactId(contacts[0]?.id || '');
    setSelectedAccountId(accounts[0]?.id || '');
    setSelectedCampaignId(campaigns[0]?.id || '');
    setReplySubject('');
    setReplySnippet('');
    setReplyThreadId('');
    setLogError(null);
    setLogModalOpen(true);
  };

  const handleSubmitManualReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId) {
      setLogError('Please select a professor contact.');
      return;
    }

    const contact = contacts.find((c) => c.id === selectedContactId);
    if (!contact) {
      setLogError('Contact not found.');
      return;
    }

    setSubmittingLog(true);
    setLogError(null);

    try {
      const now = new Date().toISOString();
      const userId = '00000000-0000-0000-0000-000000000000';

      // 1. Insert into replies table
      const { data: insertedReply, error: replyErr } = await supabase
        .from('replies')
        .insert({
          user_id: userId,
          contact_id: contact.id,
          campaign_id: selectedCampaignId || null,
          account_id: selectedAccountId || null,
          sender_email: contact.email,
          subject: replySubject.trim() || 'Re: GamifyTL Outreach',
          snippet: replySnippet.trim() || 'Professor replied to outreach email.',
          body_text: replySnippet.trim() || null,
          gmail_thread_id: replyThreadId.trim() || null,
          received_at: now,
          source: 'manual',
        })
        .select()
        .single();

      if (replyErr) throw replyErr;

      // 2. Update contact status to 'replied'
      await supabase
        .from('contacts')
        .update({ status: 'replied', updated_at: now })
        .eq('id', contact.id);

      // 3. Update any campaign_recipients for this contact: status='replied' and follow_up_status='skipped_replied'
      await supabase
        .from('campaign_recipients')
        .update({
          status: 'replied',
          follow_up_status: 'skipped_replied',
          updated_at: now,
        })
        .eq('contact_id', contact.id);

      // 4. Log event in email_events ledger
      if (selectedCampaignId && insertedReply) {
        // Query recipient_id if exists
        const { data: recip } = await supabase
          .from('campaign_recipients')
          .select('id')
          .eq('campaign_id', selectedCampaignId)
          .eq('contact_id', contact.id)
          .maybeSingle();

        if (recip) {
          await supabase.from('email_events').insert({
            campaign_id: selectedCampaignId,
            recipient_id: recip.id,
            account_id: selectedAccountId || null,
            event_type: 'reply_received',
            metadata: {
              source: 'manual',
              sender: contact.email,
              thread_id: replyThreadId.trim() || null,
            },
          });
        }
      }

      await fetchReplies();
      setLogModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error recording manual reply';
      setLogError(msg);
    } finally {
      setSubmittingLog(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Professor Replies</h2>
          <p className="text-sm text-gray-500">
            Review incoming inquiries, track sentiment, and open discussions directly in Gmail.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSyncReplies} disabled={syncing}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Replies'}
          </Button>
          <Button size="sm" onClick={handleOpenLogModal}>
            <Plus className="mr-2 h-4 w-4" />
            Log Reply Manually
          </Button>
        </div>
      </div>

      {syncMessage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex items-center justify-between">
          <span>{syncMessage}</span>
          <button
            type="button"
            onClick={() => setSyncMessage(null)}
            className="text-xs font-semibold text-blue-700 hover:underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* Zero CASA Fee & Privacy Compliance Note */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 text-indigo-900 shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1 leading-relaxed">
            <p className="font-semibold text-indigo-950">
              Hybrid Reply Architecture (100% Free & Privacy Compliant)
            </p>
            <p>
              To maintain permanent zero-cost operation and avoid mandatory $5,000–$15,000/yr CASA restricted-scope audits,
              the platform provides direct Gmail thread deep links (
              <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono text-[11px]">
                mail.google.com/mail/u/?authuser=...#all/...
              </code>
              ) alongside convenient manual reply logging, preserving personal inbox privacy without requiring invasive read permissions.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-500">Loading replies...</span>
        </div>
      ) : replies.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title="No Replies Logged Yet"
          description="When professors reply to your outreach emails, log their response here to immediately pause follow-ups and update contact status."
          actionLabel="Log a Professor Reply"
          onAction={handleOpenLogModal}
        />
      ) : (
        <div className="space-y-3">
          {replies.map((reply) => {
            const threadUrl = reply.gmail_thread_id && reply.account_email
              ? getGmailThreadUrl(reply.account_email, reply.gmail_thread_id)
              : null;

            return (
              <div
                key={reply.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{reply.contact_name}</span>
                      <span className="text-xs font-mono text-gray-500">&lt;{reply.sender_email}&gt;</span>
                      <Badge variant={reply.source === 'manual' ? 'secondary' : 'default'} className="text-[10px]">
                        {reply.source === 'manual' ? 'Manual Log' : 'API Sync'}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-gray-800">
                      Subject: {reply.subject || 'Re: GamifyTL'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(reply.received_at)}
                    </span>
                    {threadUrl && (
                      <a
                        href={threadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Open in Gmail <ExternalLink className="ml-1.5 h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                {reply.snippet && (
                  <p className="text-xs text-gray-700 bg-gray-50/70 p-3 rounded-xl border border-gray-100 whitespace-pre-wrap leading-relaxed">
                    {reply.snippet}
                  </p>
                )}

                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-100">
                  <span className="flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Contact marked 'replied' • Follow-ups suppressed
                  </span>
                  {reply.gmail_thread_id && (
                    <span className="font-mono text-gray-500">Thread: {reply.gmail_thread_id}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Reply Log Modal */}
      <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
        <DialogContent maxWidth="md" onClose={() => setLogModalOpen(false)}>
          <form onSubmit={handleSubmitManualReply} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Log Professor Reply Manually</DialogTitle>
              <DialogDescription>
                Record an educator response received in your personal Gmail inbox. This automatically updates their status to 'replied' and cancels pending follow-up sequences.
              </DialogDescription>
            </DialogHeader>

            {logError && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 font-medium border border-red-200">
                {logError}
              </div>
            )}

            <Select
              label="Select Professor Contact"
              required
              value={selectedContactId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedContactId(e.target.value)}
            >
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.email}) — {c.institution || 'No institution'}
                </option>
              ))}
            </Select>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Sender Gmail Account"
                value={selectedAccountId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.email}</option>
                ))}
              </Select>

              <Select
                label="Related Campaign (Optional)"
                value={selectedCampaignId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCampaignId(e.target.value)}
              >
                <option value="">-- None / General Inquiry --</option>
                {campaigns.map((camp) => (
                  <option key={camp.id} value={camp.id}>{camp.name}</option>
                ))}
              </Select>
            </div>

            <Input
              label="Email Subject"
              placeholder="e.g. Re: GamifyTL classroom games"
              value={replySubject}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReplySubject(e.target.value)}
            />

            <Input
              label="Gmail Thread ID (Optional for deep link)"
              placeholder="e.g. 18c2f10a8b94d123"
              value={replyThreadId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReplyThreadId(e.target.value)}
              helperText="Find thread ID in Gmail URL #all/{thread_id} to enable direct deep linking."
            />

            <Textarea
              label="Reply Snippet / Professor Feedback"
              placeholder="e.g. Interested in using Quiz Battle for CS lecture; asked for 5-min walkthrough."
              value={replySnippet}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplySnippet(e.target.value)}
              rows={3}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLogModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingLog}>
                {submittingLog ? 'Recording...' : 'Record Reply & Suppress Follow-ups'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RepliesPage;
