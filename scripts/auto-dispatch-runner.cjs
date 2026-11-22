/**
 * Fast & Safe Automated Queue Dispatch Runner
 * Paced at ~15 minutes total completion time.
 */
const https = require('https');

const SUPABASE_URL = 'https://kiowzydhojinqonuvaxq.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpb3d6eWRob2ppbnFvbnV2YXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzNDQyNzAsImV4cCI6MjExMDkyMDI3MH0.9AiNGXnE1cP07hWSidiGINUyVX_IgORNccLvhHv_bk4';
const CAMPAIGN_ID = '56ea892f-62ce-4959-be41-1f75f3cfba8c';

function triggerQueue(batchSize = 5) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      campaign_id: CAMPAIGN_ID,
      batch_size: batchSize,
    });

    const url = new URL('/functions/v1/process-sending-queue', SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('[Runner] Starting Fast & Safe Dispatch Runner for Campaign:', CAMPAIGN_ID);
  let emptyCycles = 0;
  let totalProcessed = 0;

  while (emptyCycles < 10) {
    try {
      const res = await triggerQueue(5);
      const processed = res.processed || 0;
      const success = res.success || 0;
      const failed = res.failed || 0;

      if (processed > 0) {
        emptyCycles = 0;
        totalProcessed += success;
        console.log(`[Runner] Batch sent: ${success} success, ${failed} failed. Cumulative dispatched this run: ${totalProcessed}`);
      } else {
        emptyCycles++;
        console.log(`[Runner] No ready recipients right now (empty cycle ${emptyCycles}/10). Waiting for next scheduled slot...`);
      }

      // Check if message said all done
      if (res.message && res.message.includes('No queued recipients')) {
        console.log('[Runner] Queue check message:', res.message);
      }
    } catch (err) {
      console.error('[Runner] Error triggering queue:', err.message);
    }

    // Sleep 15 seconds before next micro-batch
    await sleep(15000);
  }

  console.log('[Runner] Finished queue runner execution. Total emails dispatched this run:', totalProcessed);
}

run();
