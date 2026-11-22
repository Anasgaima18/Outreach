import { describe, it, expect } from 'vitest';
import type {
  Database,
  Profile,
  ConnectedAccount,
  Contact,
  Campaign,
  CampaignRecipient,
  EmailEvent,
  Reply,
  Suppression,
  AccountStatus,
  ContactStatus,
  CampaignStatus,
  RecipientStatus,
  FollowUpStatus,
  EventType,
  ReplySource,
  SuppressionReason,
} from '../src/types/database.types';

describe('Database Type Contract Verification (src/types/database.types.ts)', () => {
  it('validates Database interface and Profile structure', () => {
    const mockProfile: Profile = {
      id: 'usr-123',
      email: 'admin@gamifytl.com',
      full_name: 'GamifyTL Admin',
      created_at: '2026-11-22T00:00:00Z',
      updated_at: '2026-11-22T00:00:00Z',
    };
    expect(mockProfile.email).toBe('admin@gamifytl.com');

    // Type check on Database schema contract
    const tableCheck: keyof Database['public']['Tables'] = 'profiles';
    expect(tableCheck).toBe('profiles');
  });

  it('validates ConnectedAccount model structure and status unions', () => {
    const validStatus: AccountStatus[] = ['active', 'expired', 'revoked', 'rate_limited'];
    expect(validStatus).toHaveLength(4);

    const mockAccount: ConnectedAccount = {
      id: 'acc-123',
      user_id: 'usr-123',
      email: 'dr.smith@gmail.com',
      display_name: 'Dr. Smith Outreach',
      encrypted_refresh_token: 'pgp_encrypted_data',
      status: 'active',
      daily_limit: 50,
      sent_today_count: 0,
      last_sent_at: null,
      created_at: '2026-11-22T00:00:00Z',
      updated_at: '2026-11-22T00:00:00Z',
    };

    expect(mockAccount.daily_limit).toBe(50);
    expect(mockAccount.status).toBe('active');
  });

  it('validates Contact model structure with academic attributes', () => {
    const validContactStatus: ContactStatus[] = [
      'active',
      'contacted',
      'replied',
      'unsubscribed',
      'bounced',
      'suppressed',
    ];
    expect(validContactStatus).toHaveLength(6);

    const mockContact: Contact = {
      id: 'con-123',
      user_id: 'usr-123',
      first_name: 'Alan',
      last_name: 'Turing',
      full_name: 'Prof. Alan Turing',
      email: 'alan.turing@cam.ac.uk',
      institution: 'University of Cambridge',
      department: 'Computer Science',
      academic_role: 'Professor',
      country: 'United Kingdom',
      website: 'https://cam.ac.uk/turing',
      contact_source: 'manual',
      notes: 'Interested in interactive logic quizzes',
      status: 'active',
      created_at: '2026-11-22T00:00:00Z',
      updated_at: '2026-11-22T00:00:00Z',
    };

    expect(mockContact.email).toBe('alan.turing@cam.ac.uk');
    expect(mockContact.institution).toBe('University of Cambridge');
  });

  it('validates Campaign model lifecycle statuses and delays', () => {
    const validCampaignStatus: CampaignStatus[] = [
      'draft',
      'awaiting_approval',
      'scheduled',
      'sending',
      'paused',
      'completed',
      'cancelled',
      'failed',
    ];
    expect(validCampaignStatus).toHaveLength(8);

    const mockCampaign: Campaign = {
      id: 'cmp-123',
      user_id: 'usr-123',
      account_id: 'acc-123',
      name: 'UK CS Professors Outreach',
      description: 'Introducing GamifyTL Quiz Battle and Resource Drop',
      subject: 'Interactive Teaching Tools for {{institution}} Lectures',
      body_text: 'Dear {{full_name}},\n\nGamifyTL helps professors...',
      body_html: '<p>Dear {{full_name}},</p>',
      status: 'awaiting_approval',
      min_delay_seconds: 20,
      max_delay_seconds: 60,
      follow_up_enabled: true,
      follow_up_delay_days: 4,
      follow_up_subject: 'Re: Interactive Teaching Tools',
      follow_up_body_text: 'Following up on GamifyTL...',
      follow_up_body_html: null,
      scheduled_at: '2026-11-23T09:00:00Z',
      approved_at: null,
      started_at: null,
      completed_at: null,
      created_at: '2026-11-22T00:00:00Z',
      updated_at: '2026-11-22T00:00:00Z',
    };

    expect(mockCampaign.status).toBe('awaiting_approval');
    expect(mockCampaign.min_delay_seconds).toBe(20);
    expect(mockCampaign.max_delay_seconds).toBe(60);
  });

  it('validates CampaignRecipient queue status and threading', () => {
    const validRecipientStatus: RecipientStatus[] = [
      'queued',
      'sending',
      'sent',
      'failed',
      'replied',
      'bounced',
      'unsubscribed',
      'suppressed',
    ];
    const validFollowUpStatus: FollowUpStatus[] = [
      'none',
      'scheduled',
      'sent',
      'skipped_replied',
      'skipped_unsubscribed',
      'skipped_bounced',
    ];
    expect(validRecipientStatus).toHaveLength(8);
    expect(validFollowUpStatus).toHaveLength(6);

    const mockRecipient: CampaignRecipient = {
      id: 'rec-123',
      campaign_id: 'cmp-123',
      contact_id: 'con-123',
      status: 'queued',
      personalized_subject: 'Interactive Teaching Tools for Cambridge Lectures',
      personalized_body: 'Dear Prof. Alan Turing,\n...',
      gmail_message_id: null,
      gmail_thread_id: null,
      scheduled_for: '2026-11-23T09:05:00Z',
      sent_at: null,
      error_message: null,
      retry_count: 0,
      next_retry_at: null,
      follow_up_status: 'none',
      follow_up_scheduled_at: null,
      follow_up_sent_at: null,
      follow_up_gmail_message_id: null,
      created_at: '2026-11-22T00:00:00Z',
      updated_at: '2026-11-22T00:00:00Z',
    };

    expect(mockRecipient.status).toBe('queued');
  });

  it('validates EmailEvent ledger audit event types', () => {
    const validEventTypes: EventType[] = [
      'queued',
      'submitted_to_gmail',
      'accepted_by_gmail',
      'failed_send',
      'bounced',
      'reply_received',
      'unsubscribed',
      'suppressed',
    ];
    expect(validEventTypes).toHaveLength(8);

    const mockEvent: EmailEvent = {
      id: 'evt-123',
      campaign_id: 'cmp-123',
      recipient_id: 'rec-123',
      account_id: 'acc-123',
      event_type: 'accepted_by_gmail',
      metadata: { gmail_message_id: 'msg_987654' },
      created_at: '2026-11-23T09:05:32Z',
    };

    expect(mockEvent.event_type).toBe('accepted_by_gmail');
  });

  it('validates Reply model attributes and source', () => {
    const validSources: ReplySource[] = ['manual', 'api_sync'];
    expect(validSources).toHaveLength(2);

    const mockReply: Reply = {
      id: 'rpl-123',
      user_id: 'usr-123',
      contact_id: 'con-123',
      campaign_id: 'cmp-123',
      recipient_id: 'rec-123',
      account_id: 'acc-123',
      gmail_message_id: 'msg_reply_1',
      gmail_thread_id: 'thread_123',
      sender_email: 'alan.turing@cam.ac.uk',
      subject: 'Re: Interactive Teaching Tools',
      snippet: 'Thanks for sharing, I would love to try Quiz Battle next Tuesday.',
      body_text: 'Thanks for sharing, I would love to try Quiz Battle next Tuesday.',
      received_at: '2026-11-23T14:20:00Z',
      source: 'manual',
      notes: 'Follow up before Tuesday lecture',
      created_at: '2026-11-23T14:22:00Z',
    };

    expect(mockReply.source).toBe('manual');
    expect(mockReply.sender_email).toBe('alan.turing@cam.ac.uk');
  });

  it('validates Suppression model reasons', () => {
    const validReasons: SuppressionReason[] = ['unsubscribe', 'bounce', 'manual', 'complaint'];
    expect(validReasons).toHaveLength(4);

    const mockSuppression: Suppression = {
      id: 'sup-123',
      user_id: 'usr-123',
      email: 'optout@university.edu',
      reason: 'unsubscribe',
      created_at: '2026-11-22T00:00:00Z',
    };

    expect(mockSuppression.reason).toBe('unsubscribe');
  });

  it('validates Database RPC Function definitions in type contract', () => {
    type Funcs = Database['public']['Functions'];
    const storeFn: keyof Funcs = 'store_connected_account';
    const decryptFn: keyof Funcs = 'get_decrypted_refresh_token';
    const claimFn: keyof Funcs = 'claim_recipients_for_sending';

    expect(storeFn).toBe('store_connected_account');
    expect(decryptFn).toBe('get_decrypted_refresh_token');
    expect(claimFn).toBe('claim_recipients_for_sending');
  });
});
