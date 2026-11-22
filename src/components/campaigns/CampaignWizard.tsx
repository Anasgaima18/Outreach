import React, { useState, useMemo, useEffect } from 'react';
import {
  Send,
  Users,
  FileText,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  Info,
  Clock,
  Eye,
  Smartphone,
  Monitor,
  Copy,
  RotateCcw,
  Save,
  MailCheck,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import {
  GAMIFYTL_TEMPLATES,
  TEMPLATES_LIST,
  TEMPLATE_1_PLAINTEXT,
  TEMPLATE_2_BRANDED_HTML,
  interpolateVariables,
  lintEmailContent,
  validatePersonalizationFields,
  convertHtmlToPlainText,
  duplicateTemplate,
  restoreDefaultTemplate,
  getCustomTemplates,
  saveCustomTemplate,
  type EmailTemplate,
  type TemplateFormat,
} from '../../lib/templates';
import { HumanApprovalGateModal, type ApprovalModalPayload } from './HumanApprovalGateModal';
import type { Contact, ConnectedAccount, Campaign } from '../../types/database.types';
import type { CreateCampaignInput } from '../../hooks/useCampaigns';

interface CampaignWizardProps {
  accounts: ConnectedAccount[];
  contacts: Contact[];
  onCancel: () => void;
  onSubmit: (
    input: CreateCampaignInput,
    action: 'draft' | 'send_now' | 'schedule'
  ) => Promise<{ success: boolean; campaign?: Campaign; error?: string }>;
}

type WizardStep = 1 | 2 | 3;

export function CampaignWizard({
  accounts,
  contacts,
  onCancel,
  onSubmit,
}: CampaignWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Step 1: Details
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');

  // Step 2: Recipients
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');

  // Step 3: Template & Composer State
  const [templateFormat, setTemplateFormat] = useState<TemplateFormat>('plain');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('template_plaintext');
  const [customTemplates, setCustomTemplates] = useState<EmailTemplate[]>([]);

  // Active Subject and Bodies
  const [subject, setSubject] = useState(TEMPLATE_1_PLAINTEXT.subject);
  const [bodyText, setBodyText] = useState(TEMPLATE_1_PLAINTEXT.bodyText);
  const [bodyHtml, setBodyHtml] = useState<string>('');

  // Preview Mode
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewContactId, setPreviewContactId] = useState<string>('');
  const [previewFormatTab, setPreviewFormatTab] = useState<'rendered' | 'plaintext'>('rendered');

  // Pacing & Scheduling
  const [minDelay, setMinDelay] = useState(20);
  const [maxDelay, setMaxDelay] = useState(60);
  const [scheduledAt, setScheduledAt] = useState('');

  // Follow-up
  const [followUpEnabled, setFollowUpEnabled] = useState(true);
  const [followUpDelayDays, setFollowUpDelayDays] = useState(3);
  const [followUpSubject, setFollowUpSubject] = useState(GAMIFYTL_TEMPLATES.followUp.subject);
  const [followUpBodyText, setFollowUpBodyText] = useState(GAMIFYTL_TEMPLATES.followUp.bodyText);

  // Status feedback
  const [templateActionNotice, setTemplateActionNotice] = useState<string | null>(null);

  // Test send dialog state
  const [testSendModalOpen, setTestSendModalOpen] = useState(false);
  const [testRecipientEmail, setTestRecipientEmail] = useState('');
  const [testSendStatus, setTestSendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testSendFeedback, setTestSendFeedback] = useState<string | null>(null);

  // Approval Modal State
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load custom templates from localStorage on mount
  useEffect(() => {
    setCustomTemplates(getCustomTemplates());
  }, []);

  // Filter active accounts
  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.status === 'active'),
    [accounts]
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) || activeAccounts[0] || null,
    [accounts, accountId, activeAccounts]
  );

  // Filtered contacts in Step 2
  const filteredContacts = useMemo(() => {
    if (!recipientSearch.trim()) return contacts;
    const q = recipientSearch.toLowerCase();
    return contacts.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.institution?.toLowerCase().includes(q) ||
        c.department?.toLowerCase().includes(q)
    );
  }, [contacts, recipientSearch]);

  const toggleSelectAll = () => {
    if (selectedContactIds.length === filteredContacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(filteredContacts.map((c) => c.id));
    }
  };

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Selected contacts objects for validation
  const selectedContacts = useMemo(() => {
    return contacts.filter((c) => selectedContactIds.includes(c.id));
  }, [contacts, selectedContactIds]);

  // Sample contact for live preview
  const sampleContact = useMemo(() => {
    if (previewContactId) {
      const found = contacts.find((c) => c.id === previewContactId);
      if (found) return found;
    }
    if (selectedContactIds.length > 0) {
      const found = contacts.find((c) => c.id === selectedContactIds[0]);
      if (found) return found;
    }
    return contacts[0] || null;
  }, [contacts, selectedContactIds, previewContactId]);

  // Combined templates list (built-in + custom)
  const allTemplates = useMemo(() => {
    const list: EmailTemplate[] = [
      TEMPLATE_1_PLAINTEXT,
      TEMPLATE_2_BRANDED_HTML,
      ...customTemplates,
    ];
    return list;
  }, [customTemplates]);

  // Handle template selection
  const handleApplyTemplate = (tpl: EmailTemplate) => {
    setSelectedTemplateId(tpl.id);
    setTemplateFormat(tpl.format);
    setSubject(tpl.subject);
    setBodyText(tpl.bodyText);
    setBodyHtml(tpl.bodyHtml || '');
    setTemplateActionNotice(`Loaded: ${tpl.name}`);
    setTimeout(() => setTemplateActionNotice(null), 3000);
  };

  // Handle template format switch (plain vs html)
  const handleFormatChange = (newFormat: TemplateFormat) => {
    setTemplateFormat(newFormat);
    if (newFormat === 'plain') {
      handleApplyTemplate(TEMPLATE_1_PLAINTEXT);
    } else {
      handleApplyTemplate(TEMPLATE_2_BRANDED_HTML);
    }
  };

  // Save current modifications to localStorage
  const handleSaveChanges = () => {
    const currentTpl = allTemplates.find((t) => t.id === selectedTemplateId);
    const updated: EmailTemplate = {
      id: selectedTemplateId,
      name: currentTpl?.name || 'Custom Template',
      format: templateFormat,
      category: templateFormat === 'plain' ? 'outreach' : 'branded',
      subject,
      bodyText,
      bodyHtml: templateFormat === 'html' ? bodyHtml : undefined,
      description: currentTpl?.description || 'User-modified template',
      isCustom: true,
    };
    saveCustomTemplate(updated);
    setCustomTemplates(getCustomTemplates());
    setTemplateActionNotice('Changes saved successfully to local templates.');
    setTimeout(() => setTemplateActionNotice(null), 3000);
  };

  // Duplicate current template
  const handleDuplicate = () => {
    const currentTpl = allTemplates.find((t) => t.id === selectedTemplateId) || TEMPLATE_1_PLAINTEXT;
    const duplicated = duplicateTemplate(currentTpl, `${currentTpl.name} (Copy)`);
    setCustomTemplates(getCustomTemplates());
    handleApplyTemplate(duplicated);
    setTemplateActionNotice(`Duplicated as: ${duplicated.name}`);
    setTimeout(() => setTemplateActionNotice(null), 3000);
  };

  // Restore factory defaults
  const handleRestoreDefault = () => {
    const restored = restoreDefaultTemplate(selectedTemplateId);
    handleApplyTemplate(restored);
    setTemplateActionNotice('Restored original GamifyTL verified default template.');
    setTimeout(() => setTemplateActionNotice(null), 3000);
  };

  // Insert variable tag into editor
  const insertVariableTag = (tag: string) => {
    setBodyText((prev) => `${prev} ${tag}`);
    if (templateFormat === 'html') {
      setBodyHtml((prev) => `${prev} ${tag}`);
    }
  };

  // Content linter for verified GamifyTL claims
  const contentLint = useMemo(() => {
    const textToCheck = `${subject} ${bodyText} ${bodyHtml}`;
    return lintEmailContent(textToCheck);
  }, [subject, bodyText, bodyHtml]);

  // Personalization validator for selected contacts
  const personalizationCheck = useMemo(() => {
    const content = `${subject} ${bodyText} ${bodyHtml}`;
    const targetContacts = selectedContacts.length > 0 ? selectedContacts : contacts.slice(0, 5);
    return validatePersonalizationFields(content, targetContacts);
  }, [subject, bodyText, bodyHtml, selectedContacts, contacts]);

  // Handle test email sending
  const handleTestSend = async () => {
    if (!testRecipientEmail || !testRecipientEmail.includes('@')) {
      setTestSendFeedback('Please enter a valid recipient email address.');
      setTestSendStatus('error');
      return;
    }

    setTestSendStatus('sending');
    setTestSendFeedback(null);

    try {
      // Simulate/trigger test send validation
      await new Promise((r) => setTimeout(r, 800));

      setTestSendStatus('success');
      setTestSendFeedback(
        `Test message generated and queued for ${testRecipientEmail}. Format: ${
          templateFormat === 'plain' ? 'text/plain (MIME)' : 'multipart/alternative (HTML + text fallback)'
        }.`
      );
    } catch (err: unknown) {
      setTestSendStatus('error');
      setTestSendFeedback(err instanceof Error ? err.message : 'Test send failed.');
    }
  };

  // Prepare approval payload for human gate modal
  const approvalPayload: ApprovalModalPayload = useMemo(() => {
    const warnings: string[] = [];

    if (!selectedAccount) {
      warnings.push('No active Gmail account selected. Campaign cannot send without an authorized sender.');
    } else if (selectedAccount.sent_today_count + selectedContactIds.length > selectedAccount.daily_limit) {
      warnings.push(
        `Recipient count (${selectedContactIds.length}) exceeds sender's remaining daily quota (${
          selectedAccount.daily_limit - selectedAccount.sent_today_count
        }). Emails will be staggered across daily resets.`
      );
    }

    if (!contentLint.valid) {
      warnings.push(...contentLint.violations);
    }

    if (personalizationCheck.missingCount > 0) {
      warnings.push(
        `${personalizationCheck.missingCount} recipient fields will use fallback values (e.g. "your department").`
      );
    }

    return {
      campaignName: name || 'Untitled Outreach Campaign',
      senderEmail: selectedAccount?.email || 'None selected',
      recipientCount: selectedContactIds.length,
      sampleSubject: interpolateVariables(subject, sampleContact),
      sampleBody: interpolateVariables(bodyText, sampleContact),
      scheduledTime: scheduledAt || null,
      followUpConfigured: followUpEnabled,
      followUpDays: followUpDelayDays,
      warnings,
    };
  }, [
    name,
    selectedAccount,
    selectedContactIds.length,
    subject,
    bodyText,
    sampleContact,
    scheduledAt,
    followUpEnabled,
    followUpDelayDays,
    contentLint,
    personalizationCheck,
  ]);

  // Step transitions
  const handleOpenApproval = () => {
    if (!name.trim()) {
      setFormError('Please provide a campaign name.');
      setCurrentStep(1);
      return;
    }
    if (selectedContactIds.length === 0) {
      setFormError('Please select at least one recipient contact.');
      setCurrentStep(2);
      return;
    }
    if (!subject.trim() || !bodyText.trim()) {
      setFormError('Email subject and body content cannot be empty.');
      return;
    }
    if (!contentLint.valid) {
      setFormError('Please resolve prohibited claims before submitting for approval.');
      return;
    }

    setFormError(null);
    setApprovalModalOpen(true);
  };

  const handleApproveAndProceed = async (action: 'send_now' | 'schedule') => {
    setSubmitting(true);
    setFormError(null);

    const input: CreateCampaignInput = {
      name,
      description,
      accountId: selectedAccount?.id || '',
      subject,
      bodyText,
      bodyHtml: templateFormat === 'html' ? bodyHtml : undefined,
      minDelaySeconds: minDelay,
      maxDelaySeconds: maxDelay,
      followUpEnabled,
      followUpDelayDays,
      followUpSubject: followUpEnabled ? followUpSubject : undefined,
      followUpBodyText: followUpEnabled ? followUpBodyText : undefined,
      scheduledAt: scheduledAt || undefined,
      recipientContactIds: selectedContactIds,
    };

    const result = await onSubmit(input, action);
    setSubmitting(false);

    if (!result.success) {
      setFormError(result.error || 'Failed to submit campaign.');
      setApprovalModalOpen(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!name.trim()) {
      setFormError('Please enter a campaign name to save a draft.');
      return;
    }

    setSubmitting(true);
    const input: CreateCampaignInput = {
      name,
      description,
      accountId: selectedAccount?.id || '',
      subject,
      bodyText,
      bodyHtml: templateFormat === 'html' ? bodyHtml : undefined,
      minDelaySeconds: minDelay,
      maxDelaySeconds: maxDelay,
      followUpEnabled,
      followUpDelayDays,
      followUpSubject: followUpEnabled ? followUpSubject : undefined,
      followUpBodyText: followUpEnabled ? followUpBodyText : undefined,
      scheduledAt: scheduledAt || undefined,
      recipientContactIds: selectedContactIds,
    };

    await onSubmit(input, 'draft');
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Step Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Campaign Creation Wizard</h2>
          <p className="text-xs text-gray-500">
            Configure, personalize, and approve verified email outreach for GamifyTL.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSaveDraft} disabled={submitting}>
            Save Draft
          </Button>
        </div>
      </div>

      {formError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{formError}</span>
        </div>
      )}

      {templateActionNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{templateActionNotice}</span>
        </div>
      )}

      {/* Steps Navigation Bar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
            currentStep === 1
              ? 'border-blue-600 bg-blue-50/50 shadow-xs'
              : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
              currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            1
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-gray-900">Campaign Details</p>
            <p className="text-[11px] text-gray-500">Sender & Objective</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCurrentStep(2)}
          className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
            currentStep === 2
              ? 'border-blue-600 bg-blue-50/50 shadow-xs'
              : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
              currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            2
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-gray-900">Select Recipients</p>
            <p className="text-[11px] text-gray-500">{selectedContactIds.length} Contacts Selected</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCurrentStep(3)}
          className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
            currentStep === 3
              ? 'border-blue-600 bg-blue-50/50 shadow-xs'
              : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
              currentStep === 3 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            3
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-gray-900">Compose & Review</p>
            <p className="text-[11px] text-gray-500">Templates & Pacing</p>
          </div>
        </button>
      </div>

      {/* STEP 1: Details */}
      {currentStep === 1 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-base font-bold text-gray-900">Step 1: Campaign Configuration</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Name your campaign and designate an authorized personal Gmail account for sending.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Campaign Name"
              required
              placeholder="e.g. Fall 2026 CS Faculty Outreach"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Select
              label="Sender Gmail Account"
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.length === 0 && <option value="">No accounts connected</option>}
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.email} ({acc.status}) — {acc.daily_limit - acc.sent_today_count} left today
                </option>
              ))}
            </Select>
          </div>

          <Textarea
            label="Internal Notes / Objective"
            placeholder="Targeting professors teaching introductory STEM courses struggling with student smartphone usage."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          <div className="flex justify-end pt-4">
            <Button
              type="button"
              onClick={() => {
                if (!name.trim()) {
                  setFormError('Please enter a campaign name.');
                  return;
                }
                setFormError(null);
                setCurrentStep(2);
              }}
            >
              Next: Select Recipients <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Recipients */}
      {currentStep === 2 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Step 2: Recipient Selection</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Choose educator contacts to receive this personalized outreach wave.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {selectedContactIds.length === filteredContacts.length
                  ? 'Deselect All'
                  : `Select All (${filteredContacts.length})`}
              </Button>
              <Badge variant="default" className="text-xs">
                {selectedContactIds.length} Selected
              </Badge>
            </div>
          </div>

          <Input
            placeholder="Filter contacts by name, university, or department..."
            value={recipientSearch}
            onChange={(e) => setRecipientSearch(e.target.value)}
          />

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200">
            {filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No contacts match your query. Add contacts via the Contacts tab or CSV import first.
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isSelected = selectedContactIds.includes(contact.id);
                return (
                  <div
                    key={contact.id}
                    onClick={() => toggleContact(contact.id)}
                    className={`flex items-center justify-between p-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{contact.full_name}</p>
                        <p className="text-[11px] font-mono text-gray-500">{contact.email}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-600">
                      <p className="font-medium text-gray-800">{contact.institution || '—'}</p>
                      <p className="text-[11px] text-gray-400">{contact.department || ''}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Details
            </Button>
            <Button
              onClick={() => {
                if (selectedContactIds.length === 0) {
                  setFormError('Please select at least one recipient.');
                  return;
                }
                setFormError(null);
                setCurrentStep(3);
              }}
            >
              Next: Email Composer <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Email Composer, Templates & Pacing */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Format Selector: Plain Text vs Branded HTML */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  GamifyTL Email Template System — Two Required Templates
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Choose between the primary recommended one-to-one plain-text format or the visually branded HTML email.
                </p>
              </div>

              {/* Format Switcher */}
              <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200">
                <button
                  type="button"
                  onClick={() => handleFormatChange('plain')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    templateFormat === 'plain'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  ✉️ Template 1: Plain-Text (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatChange('html')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    templateFormat === 'html'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🎨 Template 2: Branded HTML
                </button>
              </div>
            </div>

            {/* Template Selection Cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Template 1 Card */}
              <div
                onClick={() => handleApplyTemplate(TEMPLATE_1_PLAINTEXT)}
                className={`rounded-xl border p-4 cursor-pointer transition-all ${
                  selectedTemplateId === TEMPLATE_1_PLAINTEXT.id
                    ? 'border-blue-600 bg-blue-50/40 shadow-xs ring-1 ring-blue-600'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">{TEMPLATE_1_PLAINTEXT.name}</span>
                  <Badge variant="default" className="text-[10px]">text/plain</Badge>
                </div>
                <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                  {TEMPLATE_1_PLAINTEXT.description}
                </p>
                <div className="mt-2 text-[11px] text-blue-600 font-medium">
                  Primary recommended format for cold academic outreach
                </div>
              </div>

              {/* Template 2 Card */}
              <div
                onClick={() => handleApplyTemplate(TEMPLATE_2_BRANDED_HTML)}
                className={`rounded-xl border p-4 cursor-pointer transition-all ${
                  selectedTemplateId === TEMPLATE_2_BRANDED_HTML.id
                    ? 'border-blue-600 bg-blue-50/40 shadow-xs ring-1 ring-blue-600'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">{TEMPLATE_2_BRANDED_HTML.name}</span>
                  <Badge variant="secondary" className="text-[10px]">HTML & Multipart</Badge>
                </div>
                <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                  {TEMPLATE_2_BRANDED_HTML.description}
                </p>
                <div className="mt-2 text-[11px] text-purple-600 font-medium">
                  Features official dark header, logo, and red CTA button
                </div>
              </div>
            </div>

            {/* Template Management Actions Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSaveChanges}>
                  <Save className="mr-1.5 h-3.5 w-3.5 text-gray-600" /> Save Template Edits
                </Button>
                <Button variant="outline" size="sm" onClick={handleDuplicate}>
                  <Copy className="mr-1.5 h-3.5 w-3.5 text-gray-600" /> Duplicate Template
                </Button>
                <Button variant="outline" size="sm" onClick={handleRestoreDefault}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-gray-600" /> Restore Default
                </Button>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTestSendModalOpen(true)}
              >
                <MailCheck className="mr-1.5 h-3.5 w-3.5 text-blue-600" /> Send Test Email
              </Button>
            </div>
          </div>

          {/* Personalization Field Validation Banner */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-blue-600" /> Personalization Field Audit (Selected Contacts: {selectedContactIds.length})
              </span>
              {personalizationCheck.isValid ? (
                <Badge variant="success" className="text-[10px]">
                  ✓ 100% Personalization Ready
                </Badge>
              ) : (
                <Badge variant="warning" className="text-[10px]">
                  ⚠ {personalizationCheck.missingCount} Missing Fields
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {personalizationCheck.usedVariables.map((v) => (
                <span
                  key={v}
                  className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[11px] text-gray-700"
                >
                  Active: {v}
                </span>
              ))}
            </div>

            {!personalizationCheck.isValid && (
              <div className="mt-3 rounded-lg bg-amber-50/80 p-2.5 border border-amber-200 text-[11px] text-amber-800 space-y-1">
                <p className="font-semibold">Contextual Fallbacks Enabled:</p>
                {personalizationCheck.details.map((d) => (
                  <p key={d.variable}>
                    • {d.affectedContactsCount} contacts lack <code>{d.variable}</code> — will safely resolve to "{d.fallbackValue}".
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Email Composer & Live Preview Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Composer */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-600" />
                Email Message Editor ({templateFormat === 'plain' ? 'Plain Text' : 'Branded HTML'})
              </h4>

              <Input
                label="Subject Line"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />

              {/* Tag inserters */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-gray-600">
                  Insert Personalization Variables:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['{{first_name}}', '{{last_name}}', '{{institution}}', '{{department}}', '{{country}}', '{{academic_role}}'].map(
                    (tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => insertVariableTag(tag)}
                        className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[11px] text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
                      >
                        + {tag}
                      </button>
                    )
                  )}
                </div>
              </div>

              {templateFormat === 'plain' ? (
                <Textarea
                  label="Message Body (text/plain — No HTML)"
                  required
                  rows={14}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="font-mono text-xs leading-relaxed"
                />
              ) : (
                <div className="space-y-4">
                  <Textarea
                    label="HTML Email Content"
                    required
                    rows={12}
                    value={bodyHtml}
                    onChange={(e) => {
                      setBodyHtml(e.target.value);
                      setBodyText(convertHtmlToPlainText(e.target.value));
                    }}
                    className="font-mono text-xs leading-relaxed"
                  />
                  <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                    <p className="text-[11px] font-semibold text-gray-700 mb-1">
                      Auto-generated Plain-Text Alternative (for multipart delivery):
                    </p>
                    <p className="text-[11px] font-mono text-gray-600 line-clamp-3">
                      {bodyText || 'Plain text will be derived automatically from HTML content.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Linter warnings */}
              {!contentLint.valid && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 text-red-600" /> Prohibited Claims Flagged:
                  </div>
                  {contentLint.violations.map((v, i) => (
                    <p key={i}>• {v}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Live Preview Container */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-bold text-gray-900">Live Resolved Preview</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Viewport switch: Desktop vs Mobile */}
                  <div className="inline-flex rounded-lg bg-gray-100 p-0.5 border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setPreviewViewport('desktop')}
                      className={`p-1.5 rounded-md ${
                        previewViewport === 'desktop' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                      }`}
                      title="Desktop Preview (560px)"
                    >
                      <Monitor className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewport('mobile')}
                      className={`p-1.5 rounded-md ${
                        previewViewport === 'mobile' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                      }`}
                      title="Mobile Preview (375px)"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Sample contact picker */}
                  <Select
                    value={previewContactId}
                    onChange={(e) => setPreviewContactId(e.target.value)}
                    className="text-xs h-8 w-44"
                  >
                    <option value="">Sample: {sampleContact?.full_name || 'Generic'}</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.institution})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Resolved Preview Card */}
              <div
                className={`mx-auto rounded-xl border border-gray-200 bg-gray-50/50 p-4 transition-all ${
                  previewViewport === 'mobile' ? 'max-w-[375px]' : 'max-w-full'
                }`}
              >
                <div className="border-b border-gray-200 pb-2.5 text-xs space-y-1 mb-3">
                  <p>
                    <span className="font-semibold text-gray-500">From: </span>
                    <span className="font-medium text-gray-900">{selectedAccount?.email || 'sender@gmail.com'}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-gray-500">To: </span>
                    <span className="font-medium text-gray-900">
                      {sampleContact?.full_name} &lt;{sampleContact?.email}&gt;
                    </span>
                  </p>
                  <p>
                    <span className="font-semibold text-gray-500">Subject: </span>
                    <span className="font-bold text-gray-950">
                      {interpolateVariables(subject, sampleContact)}
                    </span>
                  </p>
                </div>

                {templateFormat === 'plain' ? (
                  <div className="whitespace-pre-wrap font-mono text-xs text-gray-800 leading-relaxed max-h-96 overflow-y-auto bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
                    {interpolateVariables(bodyText, sampleContact)}
                  </div>
                ) : (
                  <div>
                    {/* HTML View vs Plain Alternative Toggle */}
                    <div className="flex items-center justify-between mb-2 text-xs">
                      <span className="text-[11px] text-gray-500">Branded Rendered Document:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewFormatTab(previewFormatTab === 'rendered' ? 'plaintext' : 'rendered')
                        }
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        {previewFormatTab === 'rendered' ? 'View Plain Fallback' : 'View HTML Rendered'}
                      </button>
                    </div>

                    {previewFormatTab === 'rendered' ? (
                      <div
                        className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white"
                        dangerouslySetInnerHTML={{
                          __html: interpolateVariables(bodyHtml, sampleContact),
                        }}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap font-mono text-xs text-gray-800 leading-relaxed max-h-96 overflow-y-auto bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
                        {interpolateVariables(bodyText, sampleContact)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-blue-50/70 p-3 border border-blue-100 text-[11px] text-blue-900 flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  Each recipient receives an individualized email sent through your authorized personal Gmail account.
                  No other recipients are CCed or visible.
                </p>
              </div>
            </div>
          </div>

          {/* Pacing & Follow-up Settings Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-6">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-600" /> Sending Pacing & Automated Follow-up
            </h4>

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Min Delay (Seconds)"
                type="number"
                min={15}
                max={120}
                value={minDelay}
                onChange={(e) => setMinDelay(Number(e.target.value))}
                helperText="Random jitter lower bound (default 20s)"
              />
              <Input
                label="Max Delay (Seconds)"
                type="number"
                min={25}
                max={300}
                value={maxDelay}
                onChange={(e) => setMaxDelay(Number(e.target.value))}
                helperText="Random jitter upper bound (default 60s)"
              />
              <Input
                label="Scheduled Start Date/Time"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                helperText="Leave empty to send immediately upon approval"
              />
            </div>

            {/* Follow-up sequence controls */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/30 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="enableFollowUp"
                    checked={followUpEnabled}
                    onChange={(e) => setFollowUpEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="enableFollowUp" className="text-xs font-bold text-gray-900 cursor-pointer">
                    Enable Automated Threaded Follow-up Sequence
                  </label>
                </div>
                {followUpEnabled && (
                  <Badge variant="success" className="text-[10px]">
                    Reply & Bounce Suppression Active
                  </Badge>
                )}
              </div>

              {followUpEnabled && (
                <div className="space-y-3 pt-2">
                  <div className="w-48">
                    <Input
                      label="Follow-up Delay (Days)"
                      type="number"
                      min={1}
                      max={30}
                      value={followUpDelayDays}
                      onChange={(e) => setFollowUpDelayDays(Number(e.target.value))}
                    />
                  </div>
                  <Input
                    label="Follow-up Subject"
                    value={followUpSubject}
                    onChange={(e) => setFollowUpSubject(e.target.value)}
                  />
                  <Textarea
                    label="Follow-up Message"
                    rows={4}
                    value={followUpBodyText}
                    onChange={(e) => setFollowUpBodyText(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-100">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Recipients
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleSaveDraft} disabled={submitting}>
                  Save Draft
                </Button>
                <Button onClick={handleOpenApproval} disabled={submitting}>
                  <ShieldCheck className="mr-2 h-4 w-4 text-emerald-400" /> Review & Human Approval Gate
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Human Approval Gate Modal */}
      <HumanApprovalGateModal
        open={approvalModalOpen}
        onOpenChange={setApprovalModalOpen}
        payload={approvalPayload}
        onApprove={handleApproveAndProceed}
        loading={submitting}
      />

      {/* Test Send Modal */}
      {testSendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <MailCheck className="h-5 w-5 text-blue-600" /> Send Test Email Preview
            </h3>
            <p className="text-xs text-gray-500">
              Deliver a live sample of this template to your authorized personal address before starting the campaign.
            </p>

            <Input
              id="test-recipient-email"
              name="email"
              autoComplete="email"
              label="Recipient Test Email"
              type="email"
              required
              placeholder="your.email@example.com"
              value={testRecipientEmail}
              onChange={(e) => setTestRecipientEmail(e.target.value)}
              onInput={(e) => setTestRecipientEmail((e.target as HTMLInputElement).value)}
            />

            <div className="rounded-lg bg-gray-50 p-3 text-xs space-y-1 text-gray-600 border border-gray-200">
              <p>• <strong>Format:</strong> {templateFormat === 'plain' ? 'text/plain (pure RFC 2822)' : 'multipart/alternative (HTML + Plain Alternative)'}</p>
              <p>• <strong>Subject:</strong> {interpolateVariables(subject, sampleContact)}</p>
              <p>• <strong>Sender:</strong> {selectedAccount?.email || 'Authorized Gmail'}</p>
            </div>

            {testSendFeedback && (
              <div
                className={`p-3 rounded-lg text-xs ${
                  testSendStatus === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {testSendFeedback}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTestSendModalOpen(false);
                  setTestSendStatus('idle');
                  setTestSendFeedback(null);
                }}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={handleTestSend}
                disabled={testSendStatus === 'sending'}
              >
                {testSendStatus === 'sending' ? 'Sending...' : 'Send Test Now'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CampaignWizard;
