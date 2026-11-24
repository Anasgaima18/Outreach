const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kiowzydhojinqonuvaxq.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpb3d6eWRob2ppbnFvbnV2YXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzNDQyNzAsImV4cCI6MjExMDkyMDI3MH0.9AiNGXnE1cP07hWSidiGINUyVX_IgORNccLvhHv_bk4';

const client = createClient(supabaseUrl, anonKey);

async function run() {
  const { data: accounts, error } = await client.from('connected_accounts').select('*');
  if (error) {
    console.error('Error fetching accounts:', error);
    return;
  }

  const todayUtc = new Date().toISOString().slice(0, 10);
  console.log('Today UTC:', todayUtc);

  for (const acc of accounts) {
    const lastSentDay = acc.last_sent_at ? new Date(acc.last_sent_at).toISOString().slice(0, 10) : null;
    const isOutdated = !lastSentDay || lastSentDay < todayUtc;
    const newSentToday = isOutdated ? 0 : acc.sent_today_count;
    const newStatus = acc.status === 'rate_limited' && isOutdated ? 'active' : acc.status;

    console.log(`Account ${acc.email}: lastSent=${lastSentDay}, currentSentToday=${acc.sent_today_count}, updatingTo=${newSentToday}, dailyLimit=50`);

    await client
      .from('connected_accounts')
      .update({
        daily_limit: 50,
        sent_today_count: newSentToday,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', acc.id);
  }

  const { data: updated } = await client.from('connected_accounts').select('id, email, display_name, status, daily_limit, sent_today_count, last_sent_at');
  console.log('Updated accounts:', updated);
}

run();
