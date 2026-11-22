/**
 * Supabase Edge Function: process-sending-queue
 * Micro-batch worker (1–5 emails per invocation).
 * Locks queued recipients atomically using FOR UPDATE SKIP LOCKED via RPC,
 * verifies deliverability safeguards & suppression, builds RFC 2822 MIME,
 * submits via Gmail API, and logs audit events in email_events.
 */

// @ts-ignore: Deno serve import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { createServiceClient, getEnv } from '../_shared/supabaseClient.ts';
import { buildRawEmail } from '../_shared/mime.ts';

/**
 * Interpolates personalization tags in email subject and body.
 */
function interpolateVariables(
  template: string,
  vars: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    institution?: string | null;
    department?: string | null;
    academic_role?: string | null;
    email?: string | null;
  }
): string {
  let resolved = template;

  const hasLastName = Boolean(vars.last_name && vars.last_name.trim());
  const hasFirstName = Boolean(vars.first_name && vars.first_name.trim());
  const hasFullName = Boolean(vars.full_name && vars.full_name.trim() && !vars.full_name.includes('@'));
  const hasInstitution = Boolean(vars.institution && vars.institution.trim());
  const hasDepartment = Boolean(vars.department && vars.department.trim());

  // 1. Salutation handling - never produce "Dear Professor ," or "Dear Professor Colleague," or "Dear Professor/dean,"
  if (hasLastName) {
    resolved = resolved.replace(/Dear Professor\s*\{\{\s*last_name\s*\}\},?/gi, `Dear Professor ${vars.last_name!.trim()},`);
  } else if (hasFirstName) {
    resolved = resolved.replace(/Dear Professor\s*\{\{\s*last_name\s*\}\},?/gi, `Hi ${vars.first_name!.trim()},`);
  } else if (hasFullName) {
    resolved = resolved.replace(/Dear Professor\s*\{\{\s*last_name\s*\}\},?/gi, `Hi ${vars.full_name!.trim()},`);
  } else {
    resolved = resolved.replace(/Dear Professor\s*\{\{\s*last_name\s*\}\},?/gi, 'Hello,');
    resolved = resolved.replace(/Dear Professor\/dean,?/gi, 'Hello,');
  }

  // 2. Department & institution combination phrases - prevent "in the your department at your institution"
  if (!hasDepartment && !hasInstitution) {
    resolved = resolved
      .replace(/in the\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, 'in higher education')
      .replace(/for\s*\{\{\s*institution\s*\}\}\s*(?:lectures|classes|students)?/gi, 'for university lectures')
      .replace(/at\s*\{\{\s*institution\s*\}\}/gi, 'at your university');
  } else if (!hasDepartment && hasInstitution) {
    resolved = resolved
      .replace(/in the\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `at ${vars.institution!.trim()}`)
      .replace(/for\s*\{\{\s*institution\s*\}\}/gi, `for ${vars.institution!.trim()}`);
  } else if (hasDepartment && !hasInstitution) {
    resolved = resolved
      .replace(/in the\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `in ${vars.department!.trim()}`)
      .replace(/for\s*\{\{\s*institution\s*\}\}/gi, 'for your courses');
  }

  // 3. Fallbacks for remaining placeholders
  const inst = hasInstitution ? vars.institution!.trim() : 'your university';
  const dept = hasDepartment ? vars.department!.trim() : 'your department';
  const role = vars.academic_role?.trim() || 'Educator';
  const fname = hasFirstName ? vars.first_name!.trim() : (hasFullName ? vars.full_name!.trim().split(' ')[0] : 'Colleague');
  const lname = hasLastName ? vars.last_name!.trim() : '';
  const fullName = hasFullName ? vars.full_name!.trim() : (hasFirstName ? vars.first_name!.trim() : 'Educator');

  return resolved
    .replace(/\{\{\s*first_name\s*\}\}/gi, fname)
    .replace(/\{\{\s*last_name\s*\}\}/gi, lname)
    .replace(/\{\{\s*full_name\s*\}\}/gi, fullName)
    .replace(/\{\{\s*institution\s*\}\}/gi, inst)
    .replace(/\{\{\s*department\s*\}\}/gi, dept)
    .replace(/\{\{\s*academic_role\s*\}\}/gi, role)
    .replace(/\{\{\s*designation\s*\}\}/gi, role)
    .replace(/\{\{\s*email\s*\}\}/gi, vars.email || '');
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const clientId = getEnv('GOOGLE_CLIENT_ID') || '';
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET') || '';
  const encryptionKey = getEnv('OAUTH_ENCRYPTION_KEY');

  if (!encryptionKey) {
    return jsonResponse({ error: 'server_configuration_error', message: 'OAUTH_ENCRYPTION_KEY is not configured in environment' }, 500);
  }

  const supabase = createServiceClient();
  const processedRecipientIds = new Set<string>();
  let claimedItems: Array<{
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
  }> = [];

  try {
    const body = await req.json().catch(() => ({}));
    const campaignId = body.campaign_id || null;
    const batchSize = Math.min(Math.max(body.batch_size || 3, 1), 10);

    // 1. Atomically claim queued recipients using SKIP LOCKED via database RPC
    const { data, error: claimError } = await supabase.rpc('claim_recipients_for_sending', {
      p_campaign_id: campaignId,
      p_batch_size: batchSize,
    });

    if (claimError) {
      console.error('Error claiming recipients:', claimError);
      return jsonResponse({ error: 'claim_recipients_failed', message: claimError.message }, 500);
    }

    claimedItems = data || [];

    if (!claimedItems || claimedItems.length === 0) {
      return jsonResponse({
        processed: 0,
        success: 0,
        failed: 0,
        suppressed: 0,
        errors: [],
        message: 'No queued recipients ready to send.',
      });
    }

    let successCount = 0;
    let failedCount = 0;
    let suppressedCount = 0;
    const errors: string[] = [];

    // Map of accountId -> accessToken to avoid refreshing multiple times in one batch
    const tokenCache = new Map<string, string>();

    for (let idx = 0; idx < claimedItems.length; idx++) {
      const item = claimedItems[idx];
      try {
        // --- SAFEGUARD 0: Daily Quota Rollover Check (UTC) ---
        if (item.last_sent_at) {
          const lastSentDate = new Date(item.last_sent_at).toISOString().slice(0, 10);
          const todayDate = new Date().toISOString().slice(0, 10);
          if (lastSentDate < todayDate) {
            item.sent_today_count = 0;
            await supabase
              .from('connected_accounts')
              .update({
                sent_today_count: 0,
                status: item.account_status === 'rate_limited' ? 'active' : item.account_status,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.account_id);
            if (item.account_status === 'rate_limited') {
              item.account_status = 'active';
            }
          }
        }

        // --- SAFEGUARD 1: Account Status & Rate Limit Check ---
        if (item.account_status !== 'active') {
          errors.push(`Account ${item.sender_email} is not active (${item.account_status})`);
          // Return item to queued
          await supabase
            .from('campaign_recipients')
            .update({ status: 'queued', updated_at: new Date().toISOString() })
            .eq('id', item.recipient_id);
          processedRecipientIds.add(item.recipient_id);
          failedCount++;
          continue;
        }

        if (item.sent_today_count >= item.daily_limit) {
          const rateLimitMsg = `Daily sending limit reached for ${item.sender_email} (${item.sent_today_count}/${item.daily_limit})`;
          errors.push(rateLimitMsg);

          // Mark account as rate_limited
          await supabase
            .from('connected_accounts')
            .update({ status: 'rate_limited', updated_at: new Date().toISOString() })
            .eq('id', item.account_id);

          // Batch-revert all remaining unprocessed items in claimedItems back to 'queued'
          const remainingItems = claimedItems.slice(idx);
          const remainingIds = remainingItems.map(it => it.recipient_id);

          await supabase
            .from('campaign_recipients')
            .update({ status: 'queued', updated_at: new Date().toISOString() })
            .in('id', remainingIds);

          for (const id of remainingIds) {
            processedRecipientIds.add(id);
          }

          failedCount += remainingIds.length;
          break; // Stop processing further emails from this batch
        }

        // --- SAFEGUARD 2: Pre-flight Suppression Check (Case-Insensitive) ---
        // A. Global & user suppressions table
        const { data: suppressionRecord } = await supabase
          .from('suppressions')
          .select('reason')
          .ilike('email', item.recipient_email.trim())
          .maybeSingle();

        // B. Prior replies from this contact
        const { data: priorReply } = await supabase
          .from('replies')
          .select('id')
          .eq('contact_id', item.contact_id)
          .maybeSingle();

        // C. Contact status
        const { data: contactRecord } = await supabase
          .from('contacts')
          .select('status')
          .eq('id', item.contact_id)
          .maybeSingle();

        const isSuppressed =
          Boolean(suppressionRecord) ||
          Boolean(priorReply) ||
          contactRecord?.status === 'unsubscribed' ||
          contactRecord?.status === 'bounced' ||
          contactRecord?.status === 'suppressed' ||
          contactRecord?.status === 'replied';

        if (isSuppressed) {
          const suppressionReason =
            suppressionRecord?.reason ||
            (priorReply ? 'prior_reply' : contactRecord?.status || 'suppressed');

          // Mark recipient as suppressed
          await supabase
            .from('campaign_recipients')
            .update({
              status: 'suppressed',
              error_message: `Pre-flight suppressed: ${suppressionReason}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.recipient_id);

          // Log suppressed event in email_events
          await supabase.from('email_events').insert({
            campaign_id: item.campaign_id,
            recipient_id: item.recipient_id,
            account_id: item.account_id,
            event_type: 'suppressed',
            metadata: { reason: suppressionReason },
          });

          processedRecipientIds.add(item.recipient_id);
          suppressedCount++;
          continue;
        }

        // --- 3. Obtain Google Access Token ---
        let accessToken = tokenCache.get(item.account_id);
        if (!accessToken) {
          // Decrypt refresh token
          const { data: refreshToken, error: rpcError } = await supabase.rpc(
            'get_decrypted_refresh_token',
            {
              p_account_id: item.account_id,
              p_encryption_key: encryptionKey,
            }
          );

          if (rpcError || !refreshToken) {
            throw new Error(`Failed to decrypt refresh token for ${item.sender_email}: ${rpcError?.message}`);
          }

          // Exchange refresh token for fresh access token
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
            if (tokenData.error === 'invalid_grant') {
              await supabase
                .from('connected_accounts')
                .update({ status: 'revoked', updated_at: new Date().toISOString() })
                .eq('id', item.account_id);
              throw new Error(`Account authorization revoked by user (${item.sender_email})`);
            }
            throw new Error(`Token refresh failed: ${tokenData.error_description || tokenData.error}`);
          }

          accessToken = tokenData.access_token;
          tokenCache.set(item.account_id, accessToken!);
        }

        // --- 4. Personalize Content & Build RFC 2822 MIME ---
        const vars = {
          first_name: item.first_name,
          last_name: item.last_name,
          full_name: item.full_name,
          institution: item.institution,
          department: item.department,
          academic_role: item.academic_role,
          email: item.recipient_email,
        };

        const personalizedSubject = interpolateVariables(item.campaign_subject, vars);
        const personalizedBodyText = interpolateVariables(item.campaign_body_text, vars);
        const personalizedBodyHtml = item.campaign_body_html
          ? interpolateVariables(item.campaign_body_html, vars)
          : undefined;

        // Deliverability Safeguard: Do NOT inject synthetic Message-ID for Gmail accounts.
        // When sending through Gmail API, omitting Message-ID lets Google's mail server generate
        // its own canonical <...@mail.gmail.com> Message-ID, signed by Google's DKIM keys.
        // Injecting an external synthetic ID on @gmail.com accounts is a major trigger for spam flagging.
        const rawMimeBase64 = buildRawEmail({
          fromName: item.sender_name || undefined,
          fromEmail: item.sender_email,
          toName: item.full_name || undefined,
          toEmail: item.recipient_email,
          subject: personalizedSubject,
          bodyText: personalizedBodyText,
          bodyHtml: personalizedBodyHtml || undefined,
        });

        // --- 5. Submit to Google Gmail API ---
        const gmailResponse = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              raw: rawMimeBase64,
            }),
          }
        );

        const gmailData = await gmailResponse.json();

        if (!gmailResponse.ok) {
          const errMsg = gmailData.error?.message || `Gmail API error (${gmailResponse.status})`;
          throw new Error(errMsg);
        }

        const now = new Date().toISOString();

        // --- 6. Success: Update Recipient, Log Event, Increment Send Count ---
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'sent',
            sent_at: now,
            personalized_subject: personalizedSubject,
            personalized_body: personalizedBodyText,
            gmail_message_id: gmailData.id,
            gmail_thread_id: gmailData.threadId,
            error_message: null,
            updated_at: now,
          })
          .eq('id', item.recipient_id);

        await supabase.from('email_events').insert({
          campaign_id: item.campaign_id,
          recipient_id: item.recipient_id,
          account_id: item.account_id,
          event_type: 'accepted_by_gmail',
          metadata: {
            gmail_message_id: gmailData.id,
            gmail_thread_id: gmailData.threadId,
            label_ids: gmailData.labelIds || ['SENT'],
          },
        });

        // Increment sent_today_count and last_sent_at
        await supabase
          .from('connected_accounts')
          .update({
            sent_today_count: item.sent_today_count + 1,
            last_sent_at: now,
            updated_at: now,
          })
          .eq('id', item.account_id);

        item.sent_today_count += 1;
        processedRecipientIds.add(item.recipient_id);
        successCount++;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to send email to ${item.recipient_email}:`, errorMsg);
        errors.push(`${item.recipient_email}: ${errorMsg}`);

        const newRetryCount = (item.retry_count || 0) + 1;
        const now = new Date().toISOString();

        if (newRetryCount >= 3) {
          // Permanent failure after 3 retries
          await supabase
            .from('campaign_recipients')
            .update({
              status: 'failed',
              retry_count: newRetryCount,
              error_message: errorMsg,
              updated_at: now,
            })
            .eq('id', item.recipient_id);
        } else {
          // Exponential backoff: 2 min, 4 min
          const delayMinutes = Math.pow(2, newRetryCount);
          const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

          await supabase
            .from('campaign_recipients')
            .update({
              status: 'queued',
              retry_count: newRetryCount,
              next_retry_at: nextRetryAt,
              error_message: errorMsg,
              updated_at: now,
            })
            .eq('id', item.recipient_id);
        }

        // Log failed_send event in audit ledger
        await supabase.from('email_events').insert({
          campaign_id: item.campaign_id,
          recipient_id: item.recipient_id,
          account_id: item.account_id,
          event_type: 'failed_send',
          metadata: { error: errorMsg, retry_count: newRetryCount },
        });

        processedRecipientIds.add(item.recipient_id);
        failedCount++;
      }
    }

    return jsonResponse({
      processed: claimedItems.length,
      success: successCount,
      failed: failedCount,
      suppressed: suppressedCount,
      errors,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Fatal queue worker error:', errorMsg);

    // Safeguard: revert any claimed items not yet finalized back to 'queued'
    try {
      if (typeof claimedItems !== 'undefined' && Array.isArray(claimedItems)) {
        const unfinalizedIds = claimedItems
          .map(i => i.recipient_id)
          .filter(id => !processedRecipientIds.has(id));
        if (unfinalizedIds.length > 0) {
          await supabase
            .from('campaign_recipients')
            .update({ status: 'queued', updated_at: new Date().toISOString() })
            .in('id', unfinalizedIds);
        }
      }
    } catch (cleanupErr) {
      console.error('Failed to revert orphaned recipients:', cleanupErr);
    }

    return jsonResponse({ error: 'queue_worker_fatal', message: errorMsg }, 500);
  }
});
