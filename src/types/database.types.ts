export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AccountStatus = 'active' | 'expired' | 'revoked' | 'rate_limited';
export type ContactStatus = 'active' | 'contacted' | 'replied' | 'unsubscribed' | 'bounced' | 'suppressed';
export type CampaignStatus = 'draft' | 'awaiting_approval' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'cancelled' | 'failed';
export type RecipientStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'replied' | 'bounced' | 'unsubscribed' | 'suppressed';
export type FollowUpStatus = 'none' | 'scheduled' | 'sent' | 'skipped_replied' | 'skipped_unsubscribed' | 'skipped_bounced';
export type EventType = 'queued' | 'submitted_to_gmail' | 'accepted_by_gmail' | 'failed_send' | 'bounced' | 'reply_received' | 'unsubscribed' | 'suppressed';
export type ReplySource = 'manual' | 'api_sync';
export type SuppressionReason = 'unsubscribe' | 'bounce' | 'manual' | 'complaint';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      connected_accounts: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          display_name: string | null;
          encrypted_refresh_token: string;
          status: AccountStatus;
          daily_limit: number;
          sent_today_count: number;
          last_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          display_name?: string | null;
          encrypted_refresh_token: string;
          status?: AccountStatus;
          daily_limit?: number;
          sent_today_count?: number;
          last_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          display_name?: string | null;
          encrypted_refresh_token?: string;
          status?: AccountStatus;
          daily_limit?: number;
          sent_today_count?: number;
          last_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'connected_accounts_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      contacts: {
        Row: {
          id: string;
          user_id: string;
          first_name: string | null;
          last_name: string | null;
          full_name: string;
          email: string;
          institution: string | null;
          department: string | null;
          academic_role: string | null;
          country: string | null;
          website: string | null;
          contact_source: string | null;
          notes: string | null;
          status: ContactStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          first_name?: string | null;
          last_name?: string | null;
          full_name: string;
          email: string;
          institution?: string | null;
          department?: string | null;
          academic_role?: string | null;
          country?: string | null;
          website?: string | null;
          contact_source?: string | null;
          notes?: string | null;
          status?: ContactStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          first_name?: string | null;
          last_name?: string | null;
          full_name?: string;
          email?: string;
          institution?: string | null;
          department?: string | null;
          academic_role?: string | null;
          country?: string | null;
          website?: string | null;
          contact_source?: string | null;
          notes?: string | null;
          status?: ContactStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contacts_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      campaigns: {
        Row: {
          id: string;
          user_id: string;
          account_id: string | null;
          name: string;
          description: string | null;
          subject: string;
          body_text: string;
          body_html: string | null;
          status: CampaignStatus;
          min_delay_seconds: number;
          max_delay_seconds: number;
          follow_up_enabled: boolean;
          follow_up_delay_days: number;
          follow_up_subject: string | null;
          follow_up_body_text: string | null;
          follow_up_body_html: string | null;
          scheduled_at: string | null;
          approved_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id?: string | null;
          name: string;
          description?: string | null;
          subject: string;
          body_text: string;
          body_html?: string | null;
          status?: CampaignStatus;
          min_delay_seconds?: number;
          max_delay_seconds?: number;
          follow_up_enabled?: boolean;
          follow_up_delay_days?: number;
          follow_up_subject?: string | null;
          follow_up_body_text?: string | null;
          follow_up_body_html?: string | null;
          scheduled_at?: string | null;
          approved_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string | null;
          name?: string;
          description?: string | null;
          subject?: string;
          body_text?: string;
          body_html?: string | null;
          status?: CampaignStatus;
          min_delay_seconds?: number;
          max_delay_seconds?: number;
          follow_up_enabled?: boolean;
          follow_up_delay_days?: number;
          follow_up_subject?: string | null;
          follow_up_body_text?: string | null;
          follow_up_body_html?: string | null;
          scheduled_at?: string | null;
          approved_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaigns_account_id_fkey';
            columns: ['account_id'];
            referencedRelation: 'connected_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      campaign_recipients: {
        Row: {
          id: string;
          campaign_id: string;
          contact_id: string;
          status: RecipientStatus;
          personalized_subject: string | null;
          personalized_body: string | null;
          gmail_message_id: string | null;
          gmail_thread_id: string | null;
          scheduled_for: string;
          sent_at: string | null;
          error_message: string | null;
          retry_count: number;
          next_retry_at: string | null;
          follow_up_status: FollowUpStatus;
          follow_up_scheduled_at: string | null;
          follow_up_sent_at: string | null;
          follow_up_gmail_message_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          contact_id: string;
          status?: RecipientStatus;
          personalized_subject?: string | null;
          personalized_body?: string | null;
          gmail_message_id?: string | null;
          gmail_thread_id?: string | null;
          scheduled_for?: string;
          sent_at?: string | null;
          error_message?: string | null;
          retry_count?: number;
          next_retry_at?: string | null;
          follow_up_status?: FollowUpStatus;
          follow_up_scheduled_at?: string | null;
          follow_up_sent_at?: string | null;
          follow_up_gmail_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          contact_id?: string;
          status?: RecipientStatus;
          personalized_subject?: string | null;
          personalized_body?: string | null;
          gmail_message_id?: string | null;
          gmail_thread_id?: string | null;
          scheduled_for?: string;
          sent_at?: string | null;
          error_message?: string | null;
          retry_count?: number;
          next_retry_at?: string | null;
          follow_up_status?: FollowUpStatus;
          follow_up_scheduled_at?: string | null;
          follow_up_sent_at?: string | null;
          follow_up_gmail_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_recipients_campaign_id_fkey';
            columns: ['campaign_id'];
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaign_recipients_contact_id_fkey';
            columns: ['contact_id'];
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          }
        ];
      };
      email_events: {
        Row: {
          id: string;
          campaign_id: string;
          recipient_id: string;
          account_id: string | null;
          event_type: EventType;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          recipient_id: string;
          account_id?: string | null;
          event_type: EventType;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          recipient_id?: string;
          account_id?: string | null;
          event_type?: EventType;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'email_events_account_id_fkey';
            columns: ['account_id'];
            referencedRelation: 'connected_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_events_campaign_id_fkey';
            columns: ['campaign_id'];
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_events_recipient_id_fkey';
            columns: ['recipient_id'];
            referencedRelation: 'campaign_recipients';
            referencedColumns: ['id'];
          }
        ];
      };
      replies: {
        Row: {
          id: string;
          user_id: string;
          contact_id: string;
          campaign_id: string | null;
          recipient_id: string | null;
          account_id: string | null;
          gmail_message_id: string | null;
          gmail_thread_id: string | null;
          sender_email: string;
          subject: string | null;
          snippet: string | null;
          body_text: string | null;
          received_at: string;
          source: ReplySource;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
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
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          contact_id?: string;
          campaign_id?: string | null;
          recipient_id?: string | null;
          account_id?: string | null;
          gmail_message_id?: string | null;
          gmail_thread_id?: string | null;
          sender_email?: string;
          subject?: string | null;
          snippet?: string | null;
          body_text?: string | null;
          received_at?: string;
          source?: ReplySource;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'replies_account_id_fkey';
            columns: ['account_id'];
            referencedRelation: 'connected_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'replies_campaign_id_fkey';
            columns: ['campaign_id'];
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'replies_contact_id_fkey';
            columns: ['contact_id'];
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'replies_recipient_id_fkey';
            columns: ['recipient_id'];
            referencedRelation: 'campaign_recipients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'replies_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      suppressions: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          reason: SuppressionReason;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          reason: SuppressionReason;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          reason?: SuppressionReason;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'suppressions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      store_connected_account: {
        Args: {
          p_user_id: string;
          p_email: string;
          p_display_name?: string | null;
          p_refresh_token: string;
          p_encryption_key: string;
          p_daily_limit?: number;
        };
        Returns: string;
      };
      get_decrypted_refresh_token: {
        Args: {
          p_account_id: string;
          p_encryption_key: string;
        };
        Returns: string | null;
      };
      claim_recipients_for_sending: {
        Args: {
          p_campaign_id?: string | null;
          p_batch_size?: number;
        };
        Returns: Array<{
          recipient_id: string;
          campaign_id: string;
          contact_id: string;
          status: string;
          retry_count: number;
          campaign_name: string;
          campaign_subject: string;
          campaign_body_text: string;
          campaign_body_html: string | null;
          account_id: string;
          recipient_email: string;
          first_name: string | null;
          last_name: string | null;
          full_name: string;
          institution: string | null;
          department: string | null;
          academic_role: string | null;
          sender_email: string;
          sender_name: string | null;
          daily_limit: number;
          sent_today_count: number;
          account_status: string;
          last_sent_at: string | null;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenient Model Type Aliases
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ConnectedAccount = Database['public']['Tables']['connected_accounts']['Row'];
export type Contact = Database['public']['Tables']['contacts']['Row'];
export type Campaign = Database['public']['Tables']['campaigns']['Row'];
export type CampaignRecipient = Database['public']['Tables']['campaign_recipients']['Row'];
export type EmailEvent = Database['public']['Tables']['email_events']['Row'];
export type Reply = Database['public']['Tables']['replies']['Row'];
export type Suppression = Database['public']['Tables']['suppressions']['Row'];
