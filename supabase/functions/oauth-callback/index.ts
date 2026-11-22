/**
 * Supabase Edge Function: oauth-callback
 * Handles Google OAuth 2.0 authorization code callback.
 * Exchanges code for tokens, encrypts refresh_token using pgcrypto,
 * stores account in connected_accounts, and redirects to frontend.
 */

// @ts-ignore: Deno serve import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { createServiceClient, getEnv } from '../_shared/supabaseClient.ts';
import { fromBase64Url } from '../_shared/mime.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const appUrl = getEnv('APP_URL') || 'http://localhost:5173';
  const clientId = getEnv('GOOGLE_CLIENT_ID') || '';
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET') || '';
  const redirectUri = getEnv('GOOGLE_REDIRECT_URI') || `${url.origin}/functions/v1/oauth-callback`;
  const encryptionKey = getEnv('OAUTH_ENCRYPTION_KEY');

  if (!encryptionKey) {
    console.error('OAUTH_ENCRYPTION_KEY is not configured in Supabase Secrets');
    return Response.redirect(`${appUrl}/accounts?status=error&message=Server+configuration+error:+encryption+key+missing`, 303);
  }

  // If user denied access in Google consent screen
  if (errorParam) {
    console.error('Google OAuth error callback:', errorParam);
    return Response.redirect(`${appUrl}/accounts?status=error&message=${encodeURIComponent(errorParam)}`, 303);
  }

  if (!code || !state) {
    return Response.redirect(`${appUrl}/accounts?status=error&message=Missing+authorization+code+or+state`, 303);
  }

  // 1. Validate CSRF state token and 15-minute expiration window
  let userId = '';
  try {
    const decodedState = JSON.parse(fromBase64Url(state));
    userId = decodedState.userId;
    if (!userId) {
      throw new Error('State missing userId');
    }
    const stateTimestamp = decodedState.timestamp;
    const now = Date.now();
    const maxAgeMs = 15 * 60 * 1000; // 15 minutes TTL
    if (typeof stateTimestamp !== 'number' || (now - stateTimestamp) > maxAgeMs || (now - stateTimestamp) < -60000) {
      throw new Error('OAuth state token has expired. Please initiate authentication again.');
    }
  } catch (err) {
    console.error('Invalid or expired state token:', err);
    return Response.redirect(`${appUrl}/accounts?status=error&message=Invalid+or+expired+state+token`, 303);
  }

  try {
    // 2. Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      return Response.redirect(
        `${appUrl}/accounts?status=error&message=${encodeURIComponent(tokenData.error_description || tokenData.error || 'Token exchange failed')}`,
        303
      );
    }

    const { access_token, refresh_token } = tokenData;

    if (!refresh_token) {
      console.warn('Google did not return a refresh_token. User may need prompt=consent.');
      return Response.redirect(
        `${appUrl}/accounts?status=error&message=No+refresh+token+returned.+Please+re-authenticate+with+consent.`,
        303
      );
    }

    // 3. Query Google userinfo endpoint
    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userinfoResponse.ok) {
      const err = await userinfoResponse.text();
      throw new Error(`Failed to fetch userinfo: ${err}`);
    }

    const profile = await userinfoResponse.json();
    const accountEmail = profile.email;
    const displayName = profile.name || accountEmail;

    // 4. Encrypt refresh token & upsert into connected_accounts via RPC
    const supabase = createServiceClient();
    const { data: accountId, error: dbError } = await supabase.rpc('store_connected_account', {
      p_user_id: userId,
      p_email: accountEmail,
      p_display_name: displayName,
      p_refresh_token: refresh_token,
      p_encryption_key: encryptionKey,
      p_daily_limit: 50,
    });

    if (dbError) {
      console.error('Database store_connected_account error:', dbError);
      throw new Error(`Failed to store connected account: ${dbError.message}`);
    }

    console.log(`Successfully connected Gmail account ${accountEmail} (ID: ${accountId})`);

    // 5. Redirect back to frontend accounts page with success
    return Response.redirect(
      `${appUrl}/accounts?status=success&email=${encodeURIComponent(accountEmail)}&account_id=${accountId}`,
      303
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('OAuth callback execution error:', errorMsg);
    return Response.redirect(`${appUrl}/accounts?status=error&message=${encodeURIComponent(errorMsg)}`, 303);
  }
});
