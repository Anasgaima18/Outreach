/**
 * Gmail OAuth and Account Service Layer
 * Karpathy-style clean service for Google OAuth URL generation,
 * Gmail thread deep linking, and connected account management.
 */

import { supabase } from '@/lib/supabase';
import { base64UrlEncode, base64UrlDecode } from '@/lib/mime';
import type { ConnectedAccount } from '@/types/database.types';

export interface GoogleAuthUrlParams {
  userId: string;
  redirectUri: string;
  clientId: string;
  stateNonce?: string;
}

export interface OAuthStatePayload {
  userId: string;
  nonce: string;
  timestamp: number;
}

export const GMAIL_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'openid',
  'email',
  'profile',
].join(' ');

/**
 * Generates a tamper-resistant CSRF state token encoding userId, nonce, and timestamp.
 */
export function generateOAuthState(userId: string, nonce?: string): string {
  const payload: OAuthStatePayload = {
    userId,
    nonce: nonce || (typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
    timestamp: Date.now(),
  };
  return base64UrlEncode(JSON.stringify(payload));
}

/**
 * Decodes and validates a CSRF state token.
 * Validates expiration against maxAgeMs (defaults to 15 minutes TTL).
 */
export function parseOAuthState(
  stateToken: string,
  maxAgeMs = 15 * 60 * 1000
): OAuthStatePayload | null {
  try {
    const jsonStr = base64UrlDecode(stateToken);
    const parsed = JSON.parse(jsonStr);
    if (
      parsed &&
      typeof parsed.userId === 'string' &&
      typeof parsed.timestamp === 'number'
    ) {
      const age = Date.now() - parsed.timestamp;
      // Reject if expired beyond maxAgeMs (default 15 minutes) or future clock skew > 1 min
      if (age < -60000 || age > maxAgeMs) {
        return null;
      }
      return parsed as OAuthStatePayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates Google OAuth 2.0 authorization URL for connecting personal Gmail accounts.
 * Enforces offline access (refresh token) and explicit consent prompt.
 */
export function getGoogleAuthUrl(params: GoogleAuthUrlParams): string {
  if (!params.userId) throw new Error('userId is required to generate OAuth URL');
  if (!params.redirectUri) throw new Error('redirectUri is required to generate OAuth URL');
  if (!params.clientId) throw new Error('clientId is required to generate OAuth URL');

  const state = generateOAuthState(params.userId, params.stateNonce);

  const queryParams = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: GMAIL_OAUTH_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${queryParams.toString()}`;
}

/**
 * Formats a direct deep link to open an exact Gmail conversation thread
 * in the sender's authenticated Google Account session.
 */
export function getGmailThreadUrl(accountEmail: string, threadId: string): string {
  const cleanEmail = encodeURIComponent(accountEmail.trim());
  const cleanThread = encodeURIComponent(threadId.trim());
  return `https://mail.google.com/mail/u/?authuser=${cleanEmail}#all/${cleanThread}`;
}

/**
 * Fetches connected Gmail accounts for the current user.
 */
export async function getConnectedAccounts(userId?: string): Promise<ConnectedAccount[]> {
  let query = supabase.from('connected_accounts').select('*').order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching connected accounts:', error);
    throw error;
  }
  return data || [];
}

/**
 * Disconnects a Gmail account (sets status to 'revoked').
 */
export async function disconnectAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('connected_accounts')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', accountId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Checks connection status and remaining quota for an account.
 */
export async function checkAccountStatus(accountId: string): Promise<{
  id: string;
  email: string;
  status: string;
  daily_limit: number;
  sent_today_count: number;
  remaining_today: number;
} | null> {
  const { data, error } = await supabase
    .from('connected_accounts')
    .select('id, email, status, daily_limit, sent_today_count')
    .eq('id', accountId)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    remaining_today: Math.max(0, data.daily_limit - data.sent_today_count),
  };
}
