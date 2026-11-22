/**
 * In-Memory Transactional PostgreSQL Engine modeling all 8 Supabase tables.
 * Enforces schemas, unique constraints, foreign key cascades, RLS isolation,
 * check constraints, pgcrypto encryption, and SKIP LOCKED queue semantics.
 */

import {
  AccountStatus,
  ContactStatus,
  CampaignStatus,
  RecipientStatus,
  FollowUpStatus,
  EventType,
  ReplySource,
  SuppressionReason,
  Profile,
  ConnectedAccount,
  Contact,
  Campaign,
  CampaignRecipient,
  EmailEvent,
  Reply,
  Suppression,
} from '@/types/database.types';

export class MockDatabase {
  public profiles: Map<string, Profile> = new Map();
  public accounts: Map<string, ConnectedAccount> = new Map();
  public contacts: Map<string, Contact> = new Map();
  public campaigns: Map<string, Campaign> = new Map();
  public recipients: Map<string, CampaignRecipient> = new Map();
  public emailEvents: EmailEvent[] = [];
  public replies: Map<string, Reply> = new Map();
  public suppressions: Map<string, Suppression> = new Map();

  // Active user context for RLS
  public currentUserId: string | null = null;
  public encryptionSecret = 'gamifytl-super-secret-oauth-key-32b';

  public reset(): void {
    this.profiles.clear();
    this.accounts.clear();
    this.contacts.clear();
    this.campaigns.clear();
    this.recipients.clear();
    this.emailEvents = [];
    this.replies.clear();
    this.suppressions.clear();
    this.currentUserId = null;
  }

  public setContextUser(userId: string | null): void {
    this.currentUserId = userId;
  }

  // --- pgcrypto emulation ---
  public encryptToken(token: string, key = this.encryptionSecret): string {
    const combined = `${key}:${token}`;
    return `enc:pgp:${btoa(combined)}`;
  }

  public decryptToken(encrypted: string, key = this.encryptionSecret): string {
    if (!encrypted.startsWith('enc:pgp:')) {
      throw new Error('pgp_sym_decrypt: invalid armor format or corrupt ciphertext');
    }
    let raw = '';
    try {
      raw = atob(encrypted.slice(8));
    } catch {
      throw new Error('pgp_sym_decrypt: corrupt ciphertext');
    }
    const [storedKey, ...tokenParts] = raw.split(':');
    if (storedKey !== key) {
      throw new Error('pgp_sym_decrypt: wrong key or corrupted ciphertext');
    }
    return tokenParts.join(':');
  }

  // --- Profiles Table ---
  public createProfile(data: { id: string; email: string; full_name?: string | null }): Profile {
    const profile: Profile = {
      id: data.id,
      email: data.email,
      full_name: data.full_name || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.profiles.set(profile.id, profile);
    return profile;
  }

  // --- Connected Accounts Table ---
  public createAccount(data: {
    user_id: string;
    email: string;
    display_name?: string | null;
    refresh_token: string;
    daily_limit?: number;
    status?: AccountStatus;
  }): ConnectedAccount {
    const userId = this.currentUserId || data.user_id;
    if (data.email.trim() === '' || !data.email.includes('@')) {
      throw new Error('check_connected_accounts_email: invalid email format');
    }

    const limit = data.daily_limit !== undefined ? data.daily_limit : 40;
    if (limit <= 0 || limit > 100) {
      throw new Error('check_connected_accounts_daily_limit: must be between 1 and 100');
    }

    // Unique constraint on (user_id, email)
    for (const acc of this.accounts.values()) {
      if (acc.user_id === userId && acc.email.toLowerCase() === data.email.toLowerCase()) {
        throw new Error('uq_connected_accounts_user_email: duplicate account for user');
      }
    }

    const account: ConnectedAccount = {
      id: `acc_${crypto.randomUUID()}`,
      user_id: userId,
      email: data.email.trim().toLowerCase(),
      display_name: data.display_name || null,
      encrypted_refresh_token: this.encryptToken(data.refresh_token),
      status: data.status || 'active',
      daily_limit: limit,
      sent_today_count: 0,
      last_sent_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.accounts.set(account.id, account);
    return account;
  }

  public getAccounts(userId?: string): ConnectedAccount[] {
    const targetUser = userId || this.currentUserId;
    if (!targetUser) return [];
    return Array.from(this.accounts.values()).filter((a) => a.user_id === targetUser);
  }

  public updateAccount(id: string, updates: Partial<ConnectedAccount>): ConnectedAccount {
    const acc = this.accounts.get(id);
    if (!acc) throw new Error('Account not found');
    if (this.currentUserId && acc.user_id !== this.currentUserId) {
      throw new Error('RLS policy violation: cannot update another user account');
    }
    if (updates.daily_limit !== undefined && (updates.daily_limit <= 0 || updates.daily_limit > 100)) {
      throw new Error('check_connected_accounts_daily_limit: must be between 1 and 100');
    }
    const updated = { ...acc, ...updates, updated_at: new Date().toISOString() };
    this.accounts.set(id, updated);
    return updated;
  }

  public disconnectAccount(id: string): void {
    const acc = this.accounts.get(id);
    if (!acc) throw new Error('Account not found');
    if (this.currentUserId && acc.user_id !== this.currentUserId) {
      throw new Error('RLS policy violation: cannot disconnect another user account');
    }
    acc.status = 'revoked';
    acc.encrypted_refresh_token = '';
    acc.updated_at = new Date().toISOString();
  }

  // --- Contacts Table ---
  public createContact(data: {
    user_id?: string;
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string;
    email: string;
    institution?: string | null;
    department?: string | null;
    academic_role?: string | null;
    country?: string | null;
    website?: string | null;
    contact_source?: string | null;
    notes?: string | null;
    status?: ContactStatus;
  }): Contact {
    const userId = this.currentUserId || data.user_id;
    if (!userId) throw new Error('Missing user_id for contact creation');

    const cleanEmail = data.email?.trim().toLowerCase() || '';
    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.startsWith('@') || cleanEmail.endsWith('@')) {
      throw new Error('Invalid email address format');
    }
    // Stricter pattern
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error('Invalid email address format');
    }

    // Unique constraint on (user_id, email)
    for (const c of this.contacts.values()) {
      if (c.user_id === userId && c.email.toLowerCase() === cleanEmail) {
        throw new Error('uq_contacts_user_email: duplicate contact email for user');
      }
    }

    const firstName = data.first_name || '';
    const lastName = data.last_name || '';
    const fullName = data.full_name || `${firstName} ${lastName}`.trim() || cleanEmail;

    const contact: Contact = {
      id: `cnt_${crypto.randomUUID()}`,
      user_id: userId,
      first_name: data.first_name || null,
      last_name: data.last_name || null,
      full_name: fullName,
      email: cleanEmail,
      institution: data.institution || null,
      department: data.department || null,
      academic_role: data.academic_role || null,
      country: data.country || null,
      website: data.website || null,
      contact_source: data.contact_source || 'manual',
      notes: data.notes || null,
      status: data.status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.contacts.set(contact.id, contact);
    return contact;
  }

  public getContacts(filter?: {
    institution?: string;
    country?: string;
    search?: string;
    status?: ContactStatus;
  }): Contact[] {
    const userId = this.currentUserId;
    let list = Array.from(this.contacts.values());
    if (userId) {
      list = list.filter((c) => c.user_id === userId);
    }
    if (filter?.institution) {
      list = list.filter((c) => c.institution?.toLowerCase().includes(filter.institution!.toLowerCase()));
    }
    if (filter?.country) {
      list = list.filter((c) => c.country?.toLowerCase() === filter.country!.toLowerCase());
    }
    if (filter?.status) {
      list = list.filter((c) => c.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.institution?.toLowerCase().includes(q) ||
          c.department?.toLowerCase().includes(q)
      );
    }
    return list;
  }

  public updateContact(id: string, updates: Partial<Contact>): Contact {
    const contact = this.contacts.get(id);
    if (!contact) throw new Error('Contact not found');
    if (this.currentUserId && contact.user_id !== this.currentUserId) {
      throw new Error('RLS policy violation: cannot update another user contact');
    }
    const updated = { ...contact, ...updates, updated_at: new Date().toISOString() };
    this.contacts.set(id, updated);
    return updated;
  }

  public deleteContact(id: string): void {
    const contact = this.contacts.get(id);
    if (!contact) return;
    if (this.currentUserId && contact.user_id !== this.currentUserId) {
      throw new Error('RLS policy violation: cannot delete another user contact');
    }
    this.contacts.delete(id);
  }

  // --- Campaigns Table ---
  public createCampaign(data: {
    user_id?: string;
    account_id?: string | null;
    name: string;
    description?: string | null;
    subject: string;
    body_text: string;
    body_html?: string | null;
    min_delay_seconds?: number;
    max_delay_seconds?: number;
    follow_up_enabled?: boolean;
    follow_up_delay_days?: number;
    follow_up_subject?: string | null;
    follow_up_body_text?: string | null;
    follow_up_body_html?: string | null;
    status?: CampaignStatus;
  }): Campaign {
    const userId = this.currentUserId || data.user_id;
    if (!userId) throw new Error('Missing user_id for campaign creation');

    if (!data.subject || data.subject.trim() === '') {
      throw new Error('check_campaigns_subject: Subject cannot be empty or whitespace');
    }
    if (!data.body_text || data.body_text.trim() === '') {
      throw new Error('check_campaigns_body_text: Body cannot be empty or whitespace');
    }

    const minDelay = data.min_delay_seconds !== undefined ? data.min_delay_seconds : 20;
    const maxDelay = data.max_delay_seconds !== undefined ? data.max_delay_seconds : 60;

    if (minDelay < 10) {
      throw new Error('check_campaigns_min_delay: Minimum delay must be at least 10 seconds');
    }
    if (minDelay > maxDelay) {
      throw new Error('check_campaigns_delay_range: Minimum delay cannot exceed maximum delay');
    }

    if (data.follow_up_delay_days !== undefined && data.follow_up_delay_days < 1) {
      throw new Error('check_campaigns_follow_up_delay: Follow-up delay must be at least 1 day');
    }

    if (data.account_id) {
      const acc = this.accounts.get(data.account_id);
      if (!acc) throw new Error('Foreign key violation: connected account does not exist');
      if (acc.user_id !== userId) {
        throw new Error('RLS policy violation: cannot bind campaign to another user account');
      }
      if (acc.status === 'revoked') {
        throw new Error('Cannot bind campaign to disconnected account');
      }
    }

    const campaign: Campaign = {
      id: `cmp_${crypto.randomUUID()}`,
      user_id: userId,
      account_id: data.account_id || null,
      name: data.name,
      description: data.description || null,
      subject: data.subject.trim(),
      body_text: data.body_text,
      body_html: data.body_html || null,
      status: data.status || 'draft',
      min_delay_seconds: minDelay,
      max_delay_seconds: maxDelay,
      follow_up_enabled: !!data.follow_up_enabled,
      follow_up_delay_days: data.follow_up_delay_days || 3,
      follow_up_subject: data.follow_up_subject || null,
      follow_up_body_text: data.follow_up_body_text || null,
      follow_up_body_html: data.follow_up_body_html || null,
      scheduled_at: null,
      approved_at: null,
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  public getCampaigns(userId?: string): Campaign[] {
    const targetUser = userId || this.currentUserId;
    if (!targetUser) return [];
    return Array.from(this.campaigns.values()).filter((c) => c.user_id === targetUser);
  }

  public updateCampaign(id: string, updates: Partial<Campaign>): Campaign {
    const campaign = this.campaigns.get(id);
    if (!campaign) throw new Error('Campaign not found');
    if (this.currentUserId && campaign.user_id !== this.currentUserId) {
      throw new Error('RLS policy violation: cannot update another user campaign');
    }
    const updated = { ...campaign, ...updates, updated_at: new Date().toISOString() };
    this.campaigns.set(id, updated);
    return updated;
  }

  public deleteCampaign(id: string): void {
    const campaign = this.campaigns.get(id);
    if (!campaign) return;
    if (this.currentUserId && campaign.user_id !== this.currentUserId) {
      throw new Error('RLS policy violation: cannot delete another user campaign');
    }
    // Cascade delete campaign_recipients
    for (const [rId, r] of this.recipients.entries()) {
      if (r.campaign_id === id) {
        this.recipients.delete(rId);
      }
    }
    this.campaigns.delete(id);
  }

  // --- Campaign Recipients Table ---
  public addRecipient(campaignId: string, contactId: string): CampaignRecipient {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    const contact = this.contacts.get(contactId);
    if (!contact) throw new Error('Contact not found');

    if (this.currentUserId && campaign.user_id !== this.currentUserId) {
      throw new Error('RLS policy violation: cannot add recipient to another user campaign');
    }

    // Unique constraint (campaign_id, contact_id)
    for (const r of this.recipients.values()) {
      if (r.campaign_id === campaignId && r.contact_id === contactId) {
        throw new Error('uq_campaign_recipients_campaign_contact: Contact already in campaign');
      }
    }

    // Variable interpolation
    const interpolate = (tpl: string) => {
      return tpl
        .replace(/\{\{first_name\}\}/g, contact.first_name || 'Professor')
        .replace(/\{\{last_name\}\}/g, contact.last_name || '')
        .replace(/\{\{full_name\}\}/g, contact.full_name)
        .replace(/\{\{institution\}\}/g, contact.institution || 'your institution')
        .replace(/\{\{department\}\}/g, contact.department || 'your department');
    };

    const recipient: CampaignRecipient = {
      id: `rcp_${crypto.randomUUID()}`,
      campaign_id: campaignId,
      contact_id: contactId,
      status: 'queued',
      personalized_subject: interpolate(campaign.subject),
      personalized_body: interpolate(campaign.body_text),
      gmail_message_id: null,
      gmail_thread_id: null,
      scheduled_for: new Date().toISOString(),
      sent_at: null,
      error_message: null,
      retry_count: 0,
      next_retry_at: null,
      follow_up_status: campaign.follow_up_enabled ? 'scheduled' : 'none',
      follow_up_scheduled_at: null,
      follow_up_sent_at: null,
      follow_up_gmail_message_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.recipients.set(recipient.id, recipient);

    // Audit event: queued
    this.logEvent({
      campaign_id: campaignId,
      recipient_id: recipient.id,
      account_id: campaign.account_id,
      event_type: 'queued',
      metadata: { contact_email: contact.email },
    });

    return recipient;
  }

  public getRecipients(campaignId: string): CampaignRecipient[] {
    return Array.from(this.recipients.values()).filter((r) => r.campaign_id === campaignId);
  }

  /**
   * Simulates micro-batch queue claim with `FOR UPDATE SKIP LOCKED`.
   * Atomically claims up to `limit` recipients where status = 'queued' and scheduled_for <= NOW().
   */
  public claimQueuedRecipients(campaignId: string, limit: number): CampaignRecipient[] {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign || campaign.status !== 'sending') {
      return [];
    }

    const now = new Date();
    const claimed: CampaignRecipient[] = [];

    for (const r of this.recipients.values()) {
      if (claimed.length >= limit) break;
      if (r.campaign_id === campaignId && r.status === 'queued') {
        const scheduledTime = new Date(r.scheduled_for);
        if (scheduledTime <= now) {
          r.status = 'sending';
          r.updated_at = now.toISOString();
          claimed.push(r);
        }
      }
    }
    return claimed;
  }

  // --- Audit Events Table (Append-Only) ---
  public logEvent(data: {
    campaign_id: string;
    recipient_id: string;
    account_id?: string | null;
    event_type: EventType;
    metadata?: Record<string, unknown>;
  }): EmailEvent {
    const allowedTypes: EventType[] = [
      'queued',
      'submitted_to_gmail',
      'accepted_by_gmail',
      'failed_send',
      'bounced',
      'reply_received',
      'unsubscribed',
      'suppressed',
    ];

    if (!allowedTypes.includes(data.event_type)) {
      throw new Error(`check_email_events_type: invalid event_type: ${data.event_type}`);
    }

    const event: EmailEvent = {
      id: `evt_${crypto.randomUUID()}`,
      campaign_id: data.campaign_id,
      recipient_id: data.recipient_id,
      account_id: data.account_id || null,
      event_type: data.event_type,
      metadata: (data.metadata || {}) as any,
      created_at: new Date().toISOString(),
    };

    this.emailEvents.push(event);
    return event;
  }

  public getEvents(campaignId?: string): EmailEvent[] {
    if (campaignId) {
      return this.emailEvents.filter((e) => e.campaign_id === campaignId);
    }
    return [...this.emailEvents];
  }

  // --- Replies Table ---
  public registerReply(data: {
    user_id?: string;
    contact_id: string;
    campaign_id?: string | null;
    recipient_id?: string | null;
    account_id?: string | null;
    gmail_message_id?: string | null;
    gmail_thread_id?: string | null;
    sender_email: string;
    subject?: string | null;
    snippet?: string | null;
    body_text?: string | null;
    received_at?: string;
    source?: ReplySource;
  }): Reply {
    const userId = this.currentUserId || data.user_id;
    if (!userId) throw new Error('Missing user_id for reply');

    const contact = this.contacts.get(data.contact_id);
    if (!contact) throw new Error('Contact not found');
    if (this.currentUserId && contact.user_id !== this.currentUserId) {
      throw new Error('RLS policy violation: cannot register reply for another user contact');
    }

    // Unique constraint on gmail_message_id if provided
    if (data.gmail_message_id) {
      for (const r of this.replies.values()) {
        if (r.gmail_message_id === data.gmail_message_id) {
          throw new Error('uq_replies_gmail_message_id: duplicate reply message id');
        }
      }
    }

    const reply: Reply = {
      id: `rpl_${crypto.randomUUID()}`,
      user_id: userId,
      contact_id: data.contact_id,
      campaign_id: data.campaign_id || null,
      recipient_id: data.recipient_id || null,
      account_id: data.account_id || null,
      gmail_message_id: data.gmail_message_id || null,
      gmail_thread_id: data.gmail_thread_id || null,
      sender_email: data.sender_email.toLowerCase(),
      subject: data.subject || null,
      snippet: data.snippet || null,
      body_text: data.body_text || null,
      received_at: data.received_at || new Date().toISOString(),
      source: data.source || 'manual',
      notes: null,
      created_at: new Date().toISOString(),
    };

    this.replies.set(reply.id, reply);

    // Update contact status
    contact.status = 'replied';
    contact.updated_at = new Date().toISOString();

    // Cancel pending follow-up for recipient
    if (data.recipient_id) {
      const recipient = this.recipients.get(data.recipient_id);
      if (recipient) {
        recipient.status = 'replied';
        if (recipient.follow_up_status === 'scheduled') {
          recipient.follow_up_status = 'skipped_replied';
        }
        recipient.updated_at = new Date().toISOString();
      }
    }

    // Log reply event
    if (data.campaign_id && data.recipient_id) {
      this.logEvent({
        campaign_id: data.campaign_id,
        recipient_id: data.recipient_id,
        account_id: data.account_id,
        event_type: 'reply_received',
        metadata: {
          gmail_thread_id: data.gmail_thread_id,
          sender: data.sender_email,
        },
      });
    }

    return reply;
  }

  // --- Suppressions Table ---
  public addSuppression(email: string, reason: SuppressionReason = 'manual', userId?: string): Suppression {
    const targetUser = userId || this.currentUserId;
    if (!targetUser) throw new Error('Missing user_id for suppression');

    const cleanEmail = email.trim().toLowerCase();

    // Check if already suppressed (ON CONFLICT DO NOTHING)
    for (const s of this.suppressions.values()) {
      if (s.user_id === targetUser && s.email.toLowerCase() === cleanEmail) {
        return s;
      }
    }

    const suppression: Suppression = {
      id: `sup_${crypto.randomUUID()}`,
      user_id: targetUser,
      email: cleanEmail,
      reason,
      created_at: new Date().toISOString(),
    };

    this.suppressions.set(suppression.id, suppression);

    // Also update any matching contact's status to suppressed or unsubscribed
    for (const c of this.contacts.values()) {
      if (c.user_id === targetUser && c.email.toLowerCase() === cleanEmail) {
        c.status = reason === 'bounce' ? 'bounced' : reason === 'unsubscribe' ? 'unsubscribed' : 'suppressed';
      }
    }

    return suppression;
  }

  public isSuppressed(email: string, userId?: string): boolean {
    const targetUser = userId || this.currentUserId;
    if (!targetUser) return false;
    const cleanEmail = email.trim().toLowerCase();
    for (const s of this.suppressions.values()) {
      if (s.user_id === targetUser && s.email.toLowerCase() === cleanEmail) {
        return true;
      }
    }
    return false;
  }
}
