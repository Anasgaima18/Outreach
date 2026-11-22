/**
 * Supabase Edge Function: refresh-token
 * Decrypts connected_account refresh token, requests fresh access token from Google,
 * handles token revocation ('invalid_grant'), and returns refreshed access token.
 */

// @ts-ignore: Deno serve import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { createServiceClient, getEnv } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { account_id } = body;

    if (!account_id) {
      return jsonResponse({ error: 'account_id is required' }, 400);
    }

    const clientId = getEnv('GOOGLE_CLIENT_ID') || '';
    const clientSecret = getEnv('GOOGLE_CLIENT_SECRET') || '';
    const encryptionKey = getEnv('OAUTH_ENCRYPTION_KEY');

    if (!encryptionKey) {
      return jsonResponse({ error: 'server_configuration_error', message: 'OAUTH_ENCRYPTION_KEY is not configured in environment' }, 500);
    }

    const supabase = createServiceClient();

    // 1. Decrypt refresh token using database RPC
    const { data: refreshToken, error: rpcError } = await supabase.rpc('get_decrypted_refresh_token', {
      p_account_id: account_id,
      p_encryption_key: encryptionKey,
    });

    if (rpcError || !refreshToken) {
      console.error('Failed to decrypt refresh token:', rpcError);
      return jsonResponse(
        { error: 'account_not_found_or_unreadable', message: rpcError?.message || 'Token not found' },
        404
      );
    }

    // 2. Call Google OAuth token endpoint to refresh
    const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const googleData = await googleResponse.json();

    // 3. Handle revocation or error
    if (!googleResponse.ok) {
      console.error('Google token refresh failed:', googleData);

      if (googleData.error === 'invalid_grant') {
        // Mark account as revoked in database
        await supabase
          .from('connected_accounts')
          .update({ status: 'revoked', updated_at: new Date().toISOString() })
          .eq('id', account_id);

        return jsonResponse(
          {
            error: 'invalid_grant',
            message: 'Gmail authorization has been revoked or expired. Please re-authenticate.',
            status: 'revoked',
          },
          401
        );
      }

      return jsonResponse(
        { error: googleData.error || 'refresh_failed', details: googleData },
        googleResponse.status
      );
    }

    // 4. Return new access token and validity
    return jsonResponse({
      access_token: googleData.access_token,
      expires_in: googleData.expires_in,
      token_type: googleData.token_type || 'Bearer',
      scope: googleData.scope,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error in refresh-token handler:', errorMsg);
    return jsonResponse({ error: 'internal_server_error', message: errorMsg }, 500);
  }
});
