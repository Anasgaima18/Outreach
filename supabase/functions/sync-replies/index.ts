/**
 * Supabase Edge Function: sync-replies
 * Checks incoming Gmail threads for professor responses or processes manual reply entries.
 * Updates recipient status to 'replied', cancels follow-up ('skipped_replied'),
 * and logs reply_received audit events.
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

  const supabase = createServiceClient();
  const clientId = getEnv('GOOGLE_CLIENT_ID') || '';
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET') || '';
  const encryptionKey = getEnv('OAUTH_ENCRYPTION_KEY');

  if (!encryptionKey) {
    return jsonResponse({ error: 'server_configuration_error', message: 'OAUTH_ENCRYPTION_KEY is not configured in environment' }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { account_id, manual_reply } = body;

    // --- MODE 1: Manual Reply Logging ---
    if (manual_reply) {
      const {
        contact_id,
        campaign_id,
        recipient_id,
        sender_email,
        subject,
        snippet,
        body_text,
        notes,
      } = manual_reply;

      if (!contact_id || !sender_email) {
        return jsonResponse({ error: 'contact_id and sender_email are required for manual reply' }, 400);
      }

      // 1. Get contact to identify user_id
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('user_id, status')
        .eq('id', contact_id)
        .single();

      if (contactError || !contact) {
        return jsonResponse({ error: 'Contact not found' }, 404);
      }

      const now = new Date().toISOString();

      // 2. Insert into replies table
      const { data: replyRecord, error: replyError } = await supabase
        .from('replies')
        .insert({
          user_id: contact.user_id,
          contact_id,
          campaign_id: campaign_id || null,
          recipient_id: recipient_id || null,
          account_id: account_id || null,
          sender_email,
          subject: subject || null,
          snippet: snippet || (body_text ? body_text.slice(0, 150) : null),
          body_text: body_text || null,
          source: 'manual',
          notes: notes || null,
          received_at: now,
        })
        .select()
        .single();

      if (replyError) {
        console.error('Failed to insert reply:', replyError);
        return jsonResponse({ error: 'insert_reply_failed', message: replyError.message }, 500);
      }

      // 3. Update contact status to 'replied'
      await supabase
        .from('contacts')
        .update({ status: 'replied', updated_at: now })
        .eq('id', contact_id);

      // 4. If recipient_id is known, update campaign_recipients
      if (recipient_id) {
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'replied',
            follow_up_status: 'skipped_replied',
            updated_at: now,
          })
          .eq('id', recipient_id);

        if (campaign_id) {
          await supabase.from('email_events').insert({
            campaign_id,
            recipient_id,
            account_id: account_id || null,
            event_type: 'reply_received',
            metadata: { source: 'manual', reply_id: replyRecord.id },
          });
        }
      }

      return jsonResponse({
        success: true,
        mode: 'manual',
        reply: replyRecord,
        message: 'Reply recorded successfully and follow-up cancelled.',
      });
    }

    // --- MODE 2: Automated Gmail Sync (when account_id is provided) ---
    if (!account_id) {
      return jsonResponse({ error: 'account_id or manual_reply payload is required' }, 400);
    }

    // Verify account existence and extract tenant user_id
    const { data: connectedAccount, error: accError } = await supabase
      .from('connected_accounts')
      .select('id, user_id, email')
      .eq('id', account_id)
      .single();

    if (accError || !connectedAccount) {
      return jsonResponse({ error: 'account_not_found', message: 'Connected account not found' }, 404);
    }

    // Decrypt refresh token
    const { data: refreshToken, error: rpcError } = await supabase.rpc(
      'get_decrypted_refresh_token',
      {
        p_account_id: account_id,
        p_encryption_key: encryptionKey,
      }
    );

    if (rpcError || !refreshToken) {
      return jsonResponse({ error: 'Account token not accessible' }, 404);
    }

    // Refresh Google access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return jsonResponse({ error: 'Failed to obtain access token', details: tokenData }, 401);
    }

    const accessToken = tokenData.access_token;

    // Fetch unread messages from Gmail
    const messagesRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=20',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (messagesRes.status === 403) {
      // gmail.readonly permission is restricted/not granted. Return graceful fallback.
      return jsonResponse({
        synced: 0,
        scope_status: 'restricted_or_unapproved',
        notice: 'Automated reply sync requires gmail.readonly scope. Manual reply logging is active.',
        replies: [],
      });
    }

    const messagesData = await messagesRes.json();
    const messageList = messagesData.messages || [];
    let syncedCount = 0;

    for (const msgRef of messageList) {
      // Get message details
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgRes.ok) continue;

      const msg = await msgRes.json();
      const headers = msg.payload?.headers || [];
      const fromHeader = headers.find((h: { name: string }) => h.name.toLowerCase() === 'from')?.value || '';
      const subjectHeader = headers.find((h: { name: string }) => h.name.toLowerCase() === 'subject')?.value || '';

      // Extract sender email address from "Name <email>"
      const emailMatch = fromHeader.match(/<([^>]+)>/) || [null, fromHeader.trim()];
      const senderEmail = emailMatch[1] ? emailMatch[1].toLowerCase() : fromHeader.toLowerCase();

      // Check if this sender matches an active contact belonging to the same user (scoped by tenant user_id)
      const { data: matchedContact } = await supabase
        .from('contacts')
        .select('id, user_id')
        .eq('user_id', connectedAccount.user_id)
        .ilike('email', senderEmail.trim())
        .maybeSingle();

      if (matchedContact) {
        // Find recipient record
        const { data: matchedRecipient } = await supabase
          .from('campaign_recipients')
          .select('id, campaign_id')
          .eq('contact_id', matchedContact.id)
          .eq('status', 'sent')
          .maybeSingle();

        const now = new Date().toISOString();

        // Insert into replies
        await supabase.from('replies').insert({
          user_id: matchedContact.user_id,
          contact_id: matchedContact.id,
          campaign_id: matchedRecipient?.campaign_id || null,
          recipient_id: matchedRecipient?.id || null,
          account_id,
          gmail_message_id: msg.id,
          gmail_thread_id: msg.threadId,
          sender_email: senderEmail,
          subject: subjectHeader,
          snippet: msg.snippet || null,
          source: 'api_sync',
          received_at: now,
        });

        // Update contact status
        await supabase
          .from('contacts')
          .update({ status: 'replied', updated_at: now })
          .eq('id', matchedContact.id);

        if (matchedRecipient) {
          await supabase
            .from('campaign_recipients')
            .update({
              status: 'replied',
              follow_up_status: 'skipped_replied',
              updated_at: now,
            })
            .eq('id', matchedRecipient.id);

          await supabase.from('email_events').insert({
            campaign_id: matchedRecipient.campaign_id,
            recipient_id: matchedRecipient.id,
            account_id,
            event_type: 'reply_received',
            metadata: { source: 'api_sync', gmail_message_id: msg.id },
          });
        }

        syncedCount++;
      }
    }

    return jsonResponse({
      synced: syncedCount,
      messages_checked: messageList.length,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error in sync-replies:', errorMsg);
    return jsonResponse({ error: 'sync_replies_error', message: errorMsg }, 500);
  }
});
