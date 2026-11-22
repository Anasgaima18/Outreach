import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  HumanApprovalGateModal,
  type ApprovalModalPayload,
} from '../../src/components/campaigns/HumanApprovalGateModal';

describe('Human Approval Gate Modal Unit Tests (src/components/campaigns/HumanApprovalGateModal.tsx)', () => {
  const basePayload: ApprovalModalPayload = {
    campaignName: 'CS Faculty Active Learning Wave',
    senderEmail: 'prof.outreach@gmail.com',
    recipientCount: 25,
    sampleSubject: 'GamifyTL for Computer Science at Harvard University',
    sampleBody: 'Dear Professor Malan,\n\nIntroducing GamifyTL classroom mini-games.',
    scheduledTime: '2026-11-25T10:00:00Z',
    followUpConfigured: true,
    followUpDays: 4,
    warnings: [],
  };

  it('renders campaign metadata, sender account, and recipient count correctly', () => {
    const onOpenChange = vi.fn();
    const onApprove = vi.fn();

    render(
      <HumanApprovalGateModal
        open={true}
        onOpenChange={onOpenChange}
        payload={basePayload}
        onApprove={onApprove}
      />
    );

    expect(screen.getByText('Mandatory Human Approval Gate')).toBeInTheDocument();
    expect(screen.getByText('prof.outreach@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('25 Educators')).toBeInTheDocument();
    expect(screen.getByText('+4 days')).toBeInTheDocument();
    expect(screen.getByText(basePayload.sampleSubject)).toBeInTheDocument();
    expect(screen.getByText(/Dear Professor Malan/i)).toBeInTheDocument();
  });

  it('displays deliverability verified badge when no warnings exist', () => {
    render(
      <HumanApprovalGateModal
        open={true}
        onOpenChange={vi.fn()}
        payload={basePayload}
        onApprove={vi.fn()}
      />
    );

    expect(screen.getByText(/Deliverability verified: 20–60s randomized jitter/i)).toBeInTheDocument();
  });

  it('displays deliverability notices when warnings are present in payload', () => {
    const warningPayload: ApprovalModalPayload = {
      ...basePayload,
      warnings: ['Recipient count (25) exceeds remaining daily limit (15) for sender.'],
    };

    render(
      <HumanApprovalGateModal
        open={true}
        onOpenChange={vi.fn()}
        payload={warningPayload}
        onApprove={vi.fn()}
      />
    );

    expect(screen.getByText('Deliverability Notice')).toBeInTheDocument();
    expect(screen.getByText(/exceeds remaining daily limit/i)).toBeInTheDocument();
  });

  it('triggers onApprove("send_now") when clicking "Approve & Send Now"', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);

    render(
      <HumanApprovalGateModal
        open={true}
        onOpenChange={vi.fn()}
        payload={basePayload}
        onApprove={onApprove}
      />
    );

    const sendNowButton = screen.getByRole('button', { name: /Approve & Send Now/i });
    fireEvent.click(sendNowButton);

    expect(onApprove).toHaveBeenCalledWith('send_now');
  });

  it('triggers onApprove("schedule") when clicking "Approve & Schedule"', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);

    render(
      <HumanApprovalGateModal
        open={true}
        onOpenChange={vi.fn()}
        payload={basePayload}
        onApprove={onApprove}
      />
    );

    const scheduleButton = screen.getByRole('button', { name: /Approve & Schedule/i });
    fireEvent.click(scheduleButton);

    expect(onApprove).toHaveBeenCalledWith('schedule');
  });

  it('does not render modal when open is false', () => {
    render(
      <HumanApprovalGateModal
        open={false}
        onOpenChange={vi.fn()}
        payload={basePayload}
        onApprove={vi.fn()}
      />
    );

    expect(screen.queryByText('Mandatory Human Approval Gate')).not.toBeInTheDocument();
  });
});
