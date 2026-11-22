import { ShieldCheck, AlertTriangle, Clock, Mail, Users, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface ApprovalModalPayload {
  campaignName: string;
  senderEmail: string;
  recipientCount: number;
  sampleSubject: string;
  sampleBody: string;
  scheduledTime?: string | null;
  followUpConfigured: boolean;
  followUpDays?: number;
  warnings: string[];
}

interface HumanApprovalGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: ApprovalModalPayload;
  onApprove: (action: 'send_now' | 'schedule') => Promise<void>;
  loading?: boolean;
}

export function HumanApprovalGateModal({
  open,
  onOpenChange,
  payload,
  onApprove,
  loading = false,
}: HumanApprovalGateModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="2xl" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Mandatory Human Approval Gate</DialogTitle>
              <DialogDescription>
                Review campaign dispatch parameters, personalization, and deliverability safeguards before authorization.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Key Dispatch Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <Mail className="h-3.5 w-3.5" /> Sender
              </div>
              <p className="mt-1 text-xs font-bold text-gray-900 truncate" title={payload.senderEmail}>
                {payload.senderEmail || 'Not selected'}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <Users className="h-3.5 w-3.5" /> Recipients
              </div>
              <p className="mt-1 text-xs font-bold text-gray-900">
                {payload.recipientCount} Educators
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5" /> Timing
              </div>
              <p className="mt-1 text-xs font-bold text-gray-900">
                {payload.scheduledTime ? new Date(payload.scheduledTime).toLocaleDateString() : 'Send Now'}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <CheckCircle className="h-3.5 w-3.5" /> Follow-up
              </div>
              <p className="mt-1 text-xs font-bold text-gray-900">
                {payload.followUpConfigured ? `+${payload.followUpDays || 3} days` : 'Disabled'}
              </p>
            </div>
          </div>

          {/* Deliverability Warnings if any */}
          {payload.warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-amber-950">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Deliverability Notice
              </div>
              {payload.warnings.map((w, idx) => (
                <p key={idx} className="leading-relaxed">{w}</p>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Deliverability verified: 20–60s randomized jitter, suppression pre-checks, pure RFC 2822 MIME.</span>
            </div>
          )}

          {/* Rendered Sample Preview Box */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xs">
            <div className="border-b border-gray-100 bg-gray-50/75 px-4 py-2 text-xs flex justify-between items-center">
              <span className="font-semibold text-gray-700">Sample Rendered Message Preview</span>
              <Badge variant="outline" className="text-[10px]">Variables Interpolated</Badge>
            </div>
            <div className="p-4 space-y-3 text-left">
              <div>
                <span className="text-xs font-semibold text-gray-500">Subject: </span>
                <span className="text-xs font-bold text-gray-900">{payload.sampleSubject}</span>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50/40 p-3 font-sans text-xs text-gray-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {payload.sampleBody}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-900 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              <strong>Human Sign-Off Requirement:</strong> Per platform rules, clicking approval records your explicit authorization with timestamp <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[10px]">approved_at</code> in the outreach ledger. No email leaves the queue unreviewed.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel / Edit Draft
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onApprove('schedule')}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Approve & Schedule'}
          </Button>
          <Button
            type="button"
            onClick={() => onApprove('send_now')}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Approve & Send Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
