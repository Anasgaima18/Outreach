-- Migration: 20261122000001_m2_sending_engine.sql
-- Description: RPC functions for secure token encryption/decryption and atomic queue locking with SKIP LOCKED
-- Database: Supabase PostgreSQL 17

-- 1. Store connected account with encrypted refresh token
create or replace function public.store_connected_account(
  p_user_id text,
  p_email text,
  p_display_name text,
  p_refresh_token text,
  p_encryption_key text,
  p_daily_limit int default 50
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_account_id uuid;
  v_encrypted text;
  v_user_id uuid;
begin
  begin
    v_user_id := p_user_id::uuid;
  exception when others then
    v_user_id := '00000000-0000-0000-0000-000000000000'::uuid;
  end;

  if v_user_id is null then
    v_user_id := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  v_encrypted := encode(extensions.pgp_sym_encrypt(p_refresh_token, p_encryption_key), 'base64');
  
  insert into public.connected_accounts (
    user_id,
    email,
    display_name,
    encrypted_refresh_token,
    status,
    daily_limit,
    sent_today_count,
    updated_at
  )
  values (
    v_user_id,
    p_email,
    p_display_name,
    v_encrypted,
    'active',
    coalesce(p_daily_limit, 50),
    0,
    now()
  )
  on conflict (user_id, email) do update
  set display_name = excluded.display_name,
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      status = 'active',
      updated_at = now()
  returning id into v_account_id;

  return v_account_id;
end;
$$;

-- 2. Decrypt refresh token
create or replace function public.get_decrypted_refresh_token(
  p_account_id uuid,
  p_encryption_key text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_encrypted text;
  v_decrypted text;
begin
  select encrypted_refresh_token into v_encrypted
  from public.connected_accounts
  where id = p_account_id;

  if v_encrypted is null then
    return null;
  end if;

  begin
    v_decrypted := extensions.pgp_sym_decrypt(decode(v_encrypted, 'base64'), p_encryption_key);
    return v_decrypted;
  exception when others then
    raise exception 'Decryption failed for account %: %', p_account_id, SQLERRM;
  end;
end;
$$;

-- 3. Atomic Queue Claiming using FOR UPDATE SKIP LOCKED
drop function if exists public.claim_recipients_for_sending(uuid, int);

create or replace function public.claim_recipients_for_sending(
  p_campaign_id uuid default null,
  p_batch_size int default 5
)
returns table (
  recipient_id uuid,
  campaign_id uuid,
  contact_id uuid,
  status text,
  retry_count int,
  campaign_name text,
  campaign_subject text,
  campaign_body_text text,
  campaign_body_html text,
  account_id uuid,
  recipient_email text,
  first_name text,
  last_name text,
  full_name text,
  institution text,
  department text,
  academic_role text,
  sender_email text,
  sender_name text,
  daily_limit int,
  sent_today_count int,
  account_status text,
  last_sent_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- 1. Daily Quota Rollover: Reset sent_today_count for accounts where last_sent_at is from a previous calendar day (UTC)
  update public.connected_accounts
  set sent_today_count = 0,
      status = case when status = 'rate_limited' then 'active' else status end,
      updated_at = now()
  where last_sent_at is not null
    and (last_sent_at at time zone 'UTC')::date < (now() at time zone 'UTC')::date
    and (status = 'active' or status = 'rate_limited');

  -- 2. Claim queued recipients respecting schedule, backoff retry time, active account status, and quota
  return query
  with claimed as (
    select r.id
    from public.campaign_recipients r
    join public.campaigns c on c.id = r.campaign_id
    join public.connected_accounts acc on acc.id = c.account_id
    where r.status = 'queued'
      and r.scheduled_for <= now()
      and (r.next_retry_at is null or r.next_retry_at <= now())
      and c.status in ('scheduled', 'sending')
      and acc.status = 'active'
      and acc.sent_today_count < acc.daily_limit
      and (p_campaign_id is null or r.campaign_id = p_campaign_id)
    order by r.scheduled_for asc
    limit p_batch_size
    for update of r skip locked
  ),
  updated as (
    update public.campaign_recipients r
    set status = 'sending',
        updated_at = now()
    from claimed
    where r.id = claimed.id
    returning r.id, r.campaign_id, r.contact_id, r.status, r.retry_count
  )
  select 
    u.id as recipient_id,
    u.campaign_id,
    u.contact_id,
    u.status,
    u.retry_count,
    c.name as campaign_name,
    c.subject as campaign_subject,
    c.body_text as campaign_body_text,
    c.body_html as campaign_body_html,
    c.account_id,
    ct.email as recipient_email,
    ct.first_name,
    ct.last_name,
    ct.full_name,
    ct.institution,
    ct.department,
    ct.academic_role,
    acc.email as sender_email,
    acc.display_name as sender_name,
    acc.daily_limit,
    acc.sent_today_count,
    acc.status as account_status,
    acc.last_sent_at
  from updated u
  join public.campaigns c on c.id = u.campaign_id
  join public.contacts ct on ct.id = u.contact_id
  join public.connected_accounts acc on acc.id = c.account_id;
end;
$$;

-- 4. Routine Privileges: Granted to service_role, anon, and authenticated for seamless execution
revoke execute on function public.store_connected_account(text, text, text, text, text, int) from public;
grant execute on function public.store_connected_account(text, text, text, text, text, int) to service_role, anon, authenticated;

revoke execute on function public.get_decrypted_refresh_token(uuid, text) from public, anon, authenticated;
grant execute on function public.get_decrypted_refresh_token(uuid, text) to service_role;

revoke execute on function public.claim_recipients_for_sending(uuid, int) from public, anon, authenticated;
grant execute on function public.claim_recipients_for_sending(uuid, int) to service_role;
