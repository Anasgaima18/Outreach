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

  let derivedFirstName = vars.first_name?.trim() || '';
  let derivedLastName = vars.last_name?.trim() || '';
  if (!derivedLastName && hasFullName) {
    const parts = vars.full_name!.trim().split(/\s+/);
    if (parts.length > 1) {
      derivedLastName = parts[parts.length - 1];
      if (!derivedFirstName) derivedFirstName = parts.slice(0, -1).join(' ');
    } else {
      derivedFirstName = parts[0];
    }
  }

  // 1. Salutation handling
  if (derivedLastName) {
    resolved = resolved.replace(/Dear Professor\s*\{\{\s*last_name\s*\}\},?/gi, `Dear Professor ${derivedLastName},`);
    resolved = resolved.replace(/Dear Professor\/dean,?/gi, `Dear Professor ${derivedLastName},`);
  } else if (derivedFirstName) {
    resolved = resolved.replace(/Dear Professor\s*\{\{\s*last_name\s*\}\},?/gi, `Hi ${derivedFirstName},`);
    resolved = resolved.replace(/Dear Professor\/dean,?/gi, `Hi ${derivedFirstName},`);
  } else {
    resolved = resolved.replace(/Dear Professor\s*\{\{\s*last_name\s*\}\},?/gi, 'Dear Professor,');
    resolved = resolved.replace(/Dear Professor\/colleague,?/gi, 'Dear Professor,');
    resolved = resolved.replace(/Dear Professor\/dean,?/gi, 'Dear Professor,');
  }

  // 2. Department & institution combination phrases - prevent "in the your department at your institution"
  if (!hasDepartment && !hasInstitution) {
    resolved = resolved
      .replace(/for\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, 'for university lectures')
      .replace(/in\s*the\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, 'in higher education')
      .replace(/in\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, 'in higher education')
      .replace(/your\s*\{\{\s*department\s*\}\}\s*lectures/gi, 'your lectures')
      .replace(/regarding\s*your\s*\{\{\s*department\s*\}\}\s*courses/gi, 'regarding your courses')
      .replace(/regarding\s*your\s*\{\{\s*department\s*\}\}\s*lectures/gi, 'regarding your lectures')
      .replace(/for\s*\{\{\s*department\s*\}\}\s*courses/gi, 'for your courses')
      .replace(/for\s*\{\{\s*department\s*\}\}\s*students/gi, 'for your students')
      .replace(/for\s*\{\{\s*department\s*\}\}\s*faculty/gi, 'for university faculty')
      .replace(/in\s*\{\{\s*department\s*\}\}\s*lectures/gi, 'in your lectures')
      .replace(/in\s*\{\{\s*department\s*\}\}\s*courses/gi, 'in your courses')
      .replace(/for\s*\{\{\s*department\s*\}\}/gi, 'for your courses')
      .replace(/in\s*the\s*\{\{\s*department\s*\}\}/gi, 'in higher education')
      .replace(/for\s*your\s*\{\{\s*institution\s*\}\}\s*courses/gi, 'for your courses')
      .replace(/for\s*your\s*\{\{\s*institution\s*\}\}\s*students/gi, 'for your students')
      .replace(/in\s*\{\{\s*institution\s*\}\}\s*lectures/gi, 'in your lectures')
      .replace(/in\s*\{\{\s*institution\s*\}\}\s*classrooms/gi, 'in your classrooms')
      .replace(/for\s*\{\{\s*institution\s*\}\}\s*(?:lectures|classes|courses|faculty)?/gi, 'for university courses')
      .replace(/at\s*\{\{\s*institution\s*\}\}/gi, 'in your lectures');
  } else if (!hasDepartment && hasInstitution) {
    const inst = vars.institution!.trim();
    resolved = resolved
      .replace(/for\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `at ${inst}`)
      .replace(/in\s*the\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `at ${inst}`)
      .replace(/in\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `at ${inst}`)
      .replace(/your\s*\{\{\s*department\s*\}\}\s*lectures/gi, `your lectures at ${inst}`)
      .replace(/regarding\s*your\s*\{\{\s*department\s*\}\}\s*courses/gi, `regarding your courses at ${inst}`)
      .replace(/regarding\s*your\s*\{\{\s*department\s*\}\}\s*lectures/gi, `regarding your lectures at ${inst}`)
      .replace(/for\s*\{\{\s*department\s*\}\}\s*courses/gi, `for courses at ${inst}`)
      .replace(/for\s*\{\{\s*department\s*\}\}\s*students/gi, `for students at ${inst}`)
      .replace(/for\s*\{\{\s*department\s*\}\}\s*faculty/gi, `for faculty at ${inst}`)
      .replace(/in\s*\{\{\s*department\s*\}\}\s*lectures/gi, `in your lectures at ${inst}`)
      .replace(/in\s*\{\{\s*department\s*\}\}\s*courses/gi, `in courses at ${inst}`)
      .replace(/for\s*\{\{\s*department\s*\}\}/gi, `for ${inst} courses`)
      .replace(/in\s*the\s*\{\{\s*department\s*\}\}/gi, `at ${inst}`)
      .replace(/for\s*your\s*\{\{\s*institution\s*\}\}\s*courses/gi, `for your ${inst} courses`)
      .replace(/for\s*your\s*\{\{\s*institution\s*\}\}\s*students/gi, `for your ${inst} students`)
      .replace(/in\s*\{\{\s*institution\s*\}\}\s*lectures/gi, `in ${inst} lectures`)
      .replace(/in\s*\{\{\s*institution\s*\}\}\s*classrooms/gi, `in ${inst} classrooms`)
      .replace(/for\s*\{\{\s*institution\s*\}\}/gi, `for ${inst}`)
      .replace(/at\s*\{\{\s*institution\s*\}\}/gi, `at ${inst}`);
  } else if (hasDepartment && !hasInstitution) {
    const dept = vars.department!.trim();
    resolved = resolved
      .replace(/for\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `for ${dept}`)
      .replace(/in\s*the\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `in the ${dept}`)
      .replace(/in\s*\{\{\s*department\s*\}\}\s*at\s*\{\{\s*institution\s*\}\}/gi, `in ${dept}`)
      .replace(/your\s*\{\{\s*department\s*\}\}\s*lectures/gi, `your ${dept} lectures`)
      .replace(/regarding\s*your\s*\{\{\s*department\s*\}\}\s*courses/gi, `regarding your ${dept} courses`)
      .replace(/regarding\s*your\s*\{\{\s*department\s*\}\}\s*lectures/gi, `regarding your ${dept} lectures`)
      .replace(/for\s*\{\{\s*department\s*\}\}\s*courses/gi, `for ${dept} courses`)
      .replace(/for\s*\{\{\s*department\s*\}\}\s*students/gi, `for ${dept} students`)
      .replace(/for\s*\{\{\s*department\s*\}\}\s*faculty/gi, `for ${dept} faculty`)
      .replace(/in\s*\{\{\s*department\s*\}\}\s*lectures/gi, `in ${dept} lectures`)
      .replace(/in\s*\{\{\s*department\s*\}\}\s*courses/gi, `in ${dept} courses`)
      .replace(/for\s*\{\{\s*department\s*\}\}/gi, `for ${dept}`)
      .replace(/in\s*the\s*\{\{\s*department\s*\}\}/gi, `in the ${dept}`)
      .replace(/for\s*your\s*\{\{\s*institution\s*\}\}\s*courses/gi, `for your ${dept} courses`)
      .replace(/for\s*your\s*\{\{\s*institution\s*\}\}\s*students/gi, `for your ${dept} students`)
      .replace(/in\s*\{\{\s*institution\s*\}\}\s*lectures/gi, `in ${dept} lectures`)
      .replace(/for\s*\{\{\s*institution\s*\}\}/gi, `for ${dept}`)
      .replace(/at\s*\{\{\s*institution\s*\}\}/gi, `in ${dept}`);
  }

  // 3. Fallbacks for remaining placeholders
  const inst = hasInstitution ? vars.institution!.trim() : 'your institution';
  const dept = hasDepartment ? vars.department!.trim() : 'your department';
  const role = vars.academic_role?.trim() || 'Educator';
  const fname = derivedFirstName || 'Professor';
  const lname = derivedLastName || 'Colleague';
  const fullName = hasFullName ? vars.full_name!.trim() : (derivedFirstName ? derivedFirstName : 'Educator');

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

        // Enforce strict platform-wide daily sending ceiling of 50 emails per sender account per day
        const DAILY_SENDING_CAP = 50;
        const effectiveDailyLimit = Math.min(item.daily_limit || DAILY_SENDING_CAP, DAILY_SENDING_CAP);

        if (item.sent_today_count >= effectiveDailyLimit) {
          const rateLimitMsg = `Daily sending limit reached for ${item.sender_email} (${item.sent_today_count}/${effectiveDailyLimit} emails sent today - strict 50 emails/day cap)`;
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

        // D. Repeated email check: verify if recipient was already sent an email previously
        const { data: priorSent } = await supabase
          .from('campaign_recipients')
          .select('id')
          .eq('contact_id', item.contact_id)
          .eq('status', 'sent')
          .neq('id', item.recipient_id)
          .limit(1)
          .maybeSingle();

        const isRepeatedSend = Boolean(priorSent) || contactRecord?.status === 'contacted';

        const isSuppressed =
          Boolean(suppressionRecord) ||
          Boolean(priorReply) ||
          isRepeatedSend ||
          contactRecord?.status === 'unsubscribed' ||
          contactRecord?.status === 'bounced' ||
          contactRecord?.status === 'suppressed' ||
          contactRecord?.status === 'replied';

        if (isSuppressed) {
          const suppressionReason =
            isRepeatedSend
              ? 'repeated_email_already_sent'
              : (suppressionRecord?.reason ||
                (priorReply ? 'prior_reply' : contactRecord?.status || 'suppressed'));

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

        const { data: recipientRow } = await supabase
          .from('campaign_recipients')
          .select('personalized_subject, personalized_body')
          .eq('id', item.recipient_id)
          .maybeSingle();

        const baseSubject = recipientRow?.personalized_subject || item.campaign_subject;
        const baseBodyText = recipientRow?.personalized_body || item.campaign_body_text;

        const personalizedSubject = interpolateVariables(baseSubject, vars);
        const personalizedBodyText = interpolateVariables(baseBodyText, vars);
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

        // Update contact status to 'contacted' to prevent repeated sends
        await supabase
          .from('contacts')
          .update({
            status: 'contacted',
            updated_at: now,
          })
          .eq('id', item.contact_id);

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
