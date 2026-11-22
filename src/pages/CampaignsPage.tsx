import { useState } from 'react';
import {
  Send,
  Plus,
  ShieldCheck,
  Play,
  Pause,
  XCircle,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Mail,
  UserCheck,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/shared/EmptyState';
import { useCampaigns } from '../hooks/useCampaigns';
import { useAccounts } from '../hooks/useAccounts';
import { useContacts } from '../hooks/useContacts';
import { CampaignEditorPage } from './CampaignEditorPage';
import { HumanApprovalGateModal, type ApprovalModalPayload } from '../components/campaigns/HumanApprovalGateModal';
import { formatDate } from '../lib/utils';
import { interpolateVariables } from '../lib/templates';
import type { Campaign, CampaignStatus } from '../types/database.types';

export function CampaignsPage() {
  const {
    campaigns,
    loading,
    error,
    refresh,
    approveCampaign,
    pauseCampaign,
    resumeCampaign,
    cancelCampaign,
    deleteCampaign,
    getCampaignRecipients,
    dispatchCampaignQueue,
  } = useCampaigns();

  const { accounts } = useAccounts();
  const { contacts } = useContacts();

  const [isCreating, setIsCreating] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchFeedback, setDispatchFeedback] = useState<string | null>(null);

  // Approval modal for awaiting_approval or draft campaigns in the list
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalCampaign, setApprovalCampaign] = useState<Campaign | null>(null);
  const [approvalPayload, setApprovalPayload] = useState<ApprovalModalPayload | null>(null);
  const [approving, setApproving] = useState(false);

  const handleOpenApprovalForCampaign = async (campaign: Campaign) => {
    setApprovalCampaign(campaign);
    const sender = accounts.find((a) => a.id === campaign.account_id);
    const recips = await getCampaignRecipients(campaign.id);
    const sampleRecip = recips[0]?.contact || contacts[0] || null;

    setApprovalPayload({
      campaignName: campaign.name,
      senderEmail: sender?.email || 'Authorized Sender',
      recipientCount: recips.length || 1,
      sampleSubject: interpolateVariables(campaign.subject, sampleRecip),
      sampleBody: interpolateVariables(campaign.body_text, sampleRecip),
      scheduledTime: campaign.scheduled_at,
      followUpConfigured: campaign.follow_up_enabled,
      followUpDays: campaign.follow_up_delay_days,
      warnings: [],
    });
    setApprovalModalOpen(true);
  };

  const handleApprove = async (action: 'send_now' | 'schedule') => {
    if (!approvalCampaign) return;
    setApproving(true);
    await approveCampaign(approvalCampaign.id, action);
    setApproving(false);
    setApprovalModalOpen(false);
    setApprovalCampaign(null);
  };

  const getStatusBadge = (status: CampaignStatus) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'awaiting_approval':
        return <Badge variant="warning">Awaiting Human Approval</Badge>;
      case 'scheduled':
        return <Badge variant="default">Scheduled</Badge>;
      case 'sending':
        return <Badge variant="success">Sending Live</Badge>;
      case 'paused':
        return <Badge variant="warning">Paused</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isCreating) {
    return (
      <CampaignEditorPage
        onBack={() => setIsCreating(false)}
        onCampaignCreated={() => {
          setIsCreating(false);
          refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Outreach Campaigns</h2>
          <p className="text-sm text-gray-500">
            Targeted email campaigns introducing GamifyTL classroom engagement games to educators.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Campaign
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      {dispatchFeedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{dispatchFeedback}</span>
          <button
            onClick={() => setDispatchFeedback(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Human Approval Gate Protocol Notice */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-blue-900 shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1 leading-relaxed">
            <p className="font-semibold text-blue-950">
              Mandatory Human Approval Gate Enforced
            </p>
            <p>
              Per project specifications, no campaign is ever sent automatically without explicit pre-flight review.
              Before dispatching, the system displays the sender account, recipient count, personalized email preview,
              and suppression warnings, requiring explicit human sign-off.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-500">Loading campaigns...</span>
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Send className="h-6 w-6" />}
          title="No Campaigns Created Yet"
          description="Create your first outreach campaign with GamifyTL email templates, variable tags ({{first_name}}, {{institution}}), and schedule safe sending."
          actionLabel="Create First Campaign"
          onAction={() => setIsCreating(true)}
        />
      ) : (
        <div className="grid gap-4">
          {campaigns.map((camp) => {
            const sender = accounts.find((a) => a.id === camp.account_id);
            return (
              <div
                key={camp.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h4 className="text-base font-bold text-gray-900">{camp.name}</h4>
                      {getStatusBadge(camp.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <p className="text-xs text-gray-500 font-medium">
                        Base Subject: <span className="text-gray-800">{camp.subject}</span>
                      </p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        ⚡ 70+ Dynamic Personalized Variations Active
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Action buttons based on campaign status */}
                    {(camp.status === 'draft' || camp.status === 'awaiting_approval') && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenApprovalForCampaign(camp)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Approve & Dispatch
                      </Button>
                    )}

                    {camp.status === 'sending' && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          setDispatchingId(camp.id);
                          try {
                            const res = await dispatchCampaignQueue(camp.id, 5);
                            if (res.success > 0) {
                              setDispatchFeedback(`Dispatched ${res.success} email(s) successfully!`);
                            } else if (res.processed === 0) {
                              setDispatchFeedback('All queued emails have already been dispatched.');
                            } else if (res.failed > 0) {
                              setDispatchFeedback(`Sending issue: ${res.errors.join('; ')}`);
                            }
                          } catch (e: unknown) {
                            const msg = e instanceof Error ? e.message : String(e);
                            setDispatchFeedback(`Dispatch failed: ${msg}`);
                          } finally {
                            setDispatchingId(null);
                          }
                        }}
                        disabled={dispatchingId === camp.id}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        {dispatchingId === camp.id ? 'Sending...' : 'Dispatch Queue'}
                      </Button>
                    )}

                    {(camp.status === 'sending' || camp.status === 'scheduled') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => pauseCampaign(camp.id)}
                      >
                        <Pause className="mr-1.5 h-3.5 w-3.5 text-amber-600" /> Pause
                      </Button>
                    )}

                    {camp.status === 'paused' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resumeCampaign(camp.id)}
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Resume
                      </Button>
                    )}

                    {(camp.status === 'sending' || camp.status === 'scheduled' || camp.status === 'paused') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelCampaign(camp.id)}
                        className="text-red-600 hover:bg-red-50"
                        title="Cancel campaign"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCampaign(camp.id)}
                      className="text-gray-400 hover:text-red-600 hover:bg-gray-100"
                      title="Delete Campaign"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {camp.description && (
                  <p className="text-xs text-gray-600 bg-gray-50/50 p-2.5 rounded-lg border border-gray-100">
                    {camp.description}
                  </p>
                )}

                {/* Metadata Row */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-gray-100 bg-gray-50/40 p-3 text-xs">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase">Sender</span>
                    <p className="font-semibold text-gray-800 truncate" title={sender?.email}>
                      {sender?.email || 'Personal Gmail'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase">Pacing Jitter</span>
                    <p className="font-semibold text-gray-800">
                      {camp.min_delay_seconds}s – {camp.max_delay_seconds}s
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase">Follow-up Sequence</span>
                    <p className="font-semibold text-gray-800">
                      {camp.follow_up_enabled ? `Active (+${camp.follow_up_delay_days}d)` : 'Disabled'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase">Human Approval</span>
                    <p className="font-semibold text-gray-800">
                      {camp.approved_at ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                        </span>
                      ) : (
                        <span className="text-amber-700 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> Pending Sign-off
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approval Modal */}
      {approvalPayload && (
        <HumanApprovalGateModal
          open={approvalModalOpen}
          onOpenChange={setApprovalModalOpen}
          payload={approvalPayload}
          onApprove={handleApprove}
          loading={approving}
        />
      )}
    </div>
  );
}

export default CampaignsPage;
