import { useState } from 'react';
import { CampaignWizard } from '../components/campaigns/CampaignWizard';
import { useAccounts } from '../hooks/useAccounts';
import { useContacts } from '../hooks/useContacts';
import { useCampaigns, type CreateCampaignInput } from '../hooks/useCampaigns';
import type { Campaign } from '../types/database.types';

interface CampaignEditorPageProps {
  onBack?: () => void;
  onCampaignCreated?: (campaign: Campaign) => void;
}

export function CampaignEditorPage({ onBack, onCampaignCreated }: CampaignEditorPageProps) {
  const { accounts, loading: accountsLoading } = useAccounts();
  const { contacts, loading: contactsLoading } = useContacts();
  const { createCampaign, approveCampaign } = useCampaigns();

  const handleWizardSubmit = async (
    input: CreateCampaignInput,
    action: 'draft' | 'send_now' | 'schedule'
  ): Promise<{ success: boolean; campaign?: Campaign; error?: string }> => {
    // 1. If draft, create directly as draft
    if (action === 'draft') {
      const res = await createCampaign(input, 'draft');
      if (res.success && res.campaign) {
        onCampaignCreated?.(res.campaign);
        onBack?.();
      }
      return res;
    }

    // 2. If send_now or schedule, create campaign in awaiting_approval then immediately approve
    const res = await createCampaign(input, 'awaiting_approval');
    if (!res.success || !res.campaign) {
      return res;
    }

    const approveRes = await approveCampaign(res.campaign.id, action);
    if (!approveRes.success) {
      return { success: false, error: approveRes.error };
    }

    onCampaignCreated?.(res.campaign);
    onBack?.();
    return { success: true, campaign: res.campaign };
  };

  if (accountsLoading || contactsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <span className="ml-3 text-sm text-gray-500">Loading campaign resources...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CampaignWizard
        accounts={accounts}
        contacts={contacts}
        onCancel={() => onBack?.()}
        onSubmit={handleWizardSubmit}
      />
    </div>
  );
}

export default CampaignEditorPage;
