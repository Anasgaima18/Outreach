-- Migration: 20261122000000_initial_schema.sql
-- Description: Core schema for GamifyTL Professor Outreach Platform
-- Database: Supabase PostgreSQL 17

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";
create extension if not exists "pg_net";

-- 2. CORE TABLES

-- Table 1: PROFILES (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Table 2: CONNECTED_ACCOUNTS (Personal Gmail Accounts connected via OAuth 2.0)
create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  email text not null,
  display_name text,
  encrypted_refresh_token text not null,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'rate_limited')),
  daily_limit int not null default 50,
  sent_today_count int not null default 0,
  last_sent_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint uq_connected_accounts_user_email unique (user_id, email)
);

-- Table 3: CONTACTS (Professors, Lecturers, Academic Contacts)
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  first_name text,
  last_name text,
  full_name text not null,
  email text not null,
  institution text,
  department text,
  academic_role text,
  country text,
  website text,
  contact_source text default 'manual',
  notes text,
  status text not null default 'active' check (status in ('active', 'contacted', 'replied', 'unsubscribed', 'bounced', 'suppressed')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint uq_contacts_user_email unique (user_id, email)
);

-- Table 4: CAMPAIGNS (Outreach campaigns with human approval and lifecycle)
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.connected_accounts(id) on delete set null,
  name text not null,
  description text,
  subject text not null,
  body_text text not null,
  body_html text,
  status text not null default 'draft' check (status in ('draft', 'awaiting_approval', 'scheduled', 'sending', 'paused', 'completed', 'cancelled', 'failed')),
  min_delay_seconds int not null default 20,
  max_delay_seconds int not null default 60,
  follow_up_enabled boolean not null default false,
  follow_up_delay_days int not null default 4,
  follow_up_subject text,
  follow_up_body_text text,
  follow_up_body_html text,
  scheduled_at timestamptz,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Table 5: CAMPAIGN_RECIPIENTS (Join Contacts <-> Campaigns with queue & lifecycle status)
create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete cascade not null,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'replied', 'bounced', 'unsubscribed', 'suppressed')),
  personalized_subject text,
  personalized_body text,
  gmail_message_id text,
  gmail_thread_id text,
  scheduled_for timestamptz default now() not null,
  sent_at timestamptz,
  error_message text,
  retry_count int not null default 0,
  next_retry_at timestamptz,
  follow_up_status text not null default 'none' check (follow_up_status in ('none', 'scheduled', 'sent', 'skipped_replied', 'skipped_unsubscribed', 'skipped_bounced')),
  follow_up_scheduled_at timestamptz,
  follow_up_sent_at timestamptz,
  follow_up_gmail_message_id text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint uq_campaign_recipients_campaign_contact unique (campaign_id, contact_id)
);

-- Table 6: EMAIL_EVENTS (Granular Audit & Analytics Ledger)
create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  recipient_id uuid references public.campaign_recipients(id) on delete cascade not null,
  account_id uuid references public.connected_accounts(id) on delete set null,
  event_type text not null check (event_type in ('queued', 'submitted_to_gmail', 'accepted_by_gmail', 'failed_send', 'bounced', 'reply_received', 'unsubscribed', 'suppressed')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);

-- Table 7: REPLIES (Incoming Professor Replies)
create table if not exists public.replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  recipient_id uuid references public.campaign_recipients(id) on delete set null,
  account_id uuid references public.connected_accounts(id) on delete set null,
  gmail_message_id text,
  gmail_thread_id text,
  sender_email text not null,
  subject text,
  snippet text,
  body_text text,
  received_at timestamptz default now() not null,
  source text not null default 'manual' check (source in ('manual', 'api_sync')),
  notes text,
  created_at timestamptz default now() not null
);

-- Table 8: SUPPRESSIONS (Global & User Suppression List for unsubs, bounces, opt-outs)
create table if not exists public.suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  email text not null,
  reason text not null check (reason in ('unsubscribe', 'bounce', 'manual', 'complaint')),
  created_at timestamptz default now() not null,
  constraint uq_suppressions_user_email unique (user_id, email)
);

-- 3. INDEXES FOR PERFORMANCE & QUEUE LOCKING
create index if not exists idx_contacts_user_email on public.contacts(user_id, email);
create index if not exists idx_contacts_status on public.contacts(status);
create index if not exists idx_recipients_queue on public.campaign_recipients(status, scheduled_for) where status = 'queued';
create index if not exists idx_recipients_follow_up on public.campaign_recipients(follow_up_status, follow_up_scheduled_at) where follow_up_status = 'scheduled';
create index if not exists idx_recipients_campaign_id on public.campaign_recipients(campaign_id);
create index if not exists idx_recipients_contact_id on public.campaign_recipients(contact_id);
create index if not exists idx_events_campaign_type on public.email_events(campaign_id, event_type);
create index if not exists idx_events_recipient on public.email_events(recipient_id);
create index if not exists idx_suppressions_user_email on public.suppressions(user_id, email);
create index if not exists idx_replies_user_contact on public.replies(user_id, contact_id);
create index if not exists idx_replies_campaign on public.replies(campaign_id);

-- 4. ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.connected_accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.email_events enable row level security;
alter table public.replies enable row level security;
alter table public.suppressions enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Users manage own profiles" on public.profiles;
drop policy if exists "Users manage own accounts" on public.connected_accounts;
drop policy if exists "Users manage own contacts" on public.contacts;
drop policy if exists "Users manage own campaigns" on public.campaigns;
drop policy if exists "Users manage own campaign recipients" on public.campaign_recipients;
drop policy if exists "Users manage own email events" on public.email_events;
drop policy if exists "Users manage own replies" on public.replies;
drop policy if exists "Users manage own suppressions" on public.suppressions;

-- Create policies
create policy "Users manage own profiles" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage own accounts" on public.connected_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own contacts" on public.contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own campaigns" on public.campaigns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own campaign recipients" on public.campaign_recipients
  for all
  using (exists (select 1 from public.campaigns where campaigns.id = campaign_recipients.campaign_id and campaigns.user_id = auth.uid()))
  with check (exists (select 1 from public.campaigns where campaigns.id = campaign_recipients.campaign_id and campaigns.user_id = auth.uid()));

create policy "Users manage own email events" on public.email_events
  for all
  using (exists (select 1 from public.campaigns where campaigns.id = email_events.campaign_id and campaigns.user_id = auth.uid()))
  with check (exists (select 1 from public.campaigns where campaigns.id = email_events.campaign_id and campaigns.user_id = auth.uid()));

create policy "Users manage own replies" on public.replies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own suppressions" on public.suppressions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. PROFILE TRIGGER ON NEW AUTH USER
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data->>'full_name')
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now();
  return new;
end;
$$ language plpgsql security definer
set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. DCL GRANTS & DEFAULT PRIVILEGES
-- Grant schema, table, sequence, and routine permissions to Supabase roles
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

