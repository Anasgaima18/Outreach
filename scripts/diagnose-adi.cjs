const { createClient } = require('@supabase/supabase-js');

const client = createClient(
  'https://kiowzydhojinqonuvaxq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpb3d6eWRob2ppbnFvbnV2YXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzNDQyNzAsImV4cCI6MjExMDkyMDI3MH0.9AiNGXnE1cP07hWSidiGINUyVX_IgORNccLvhHv_bk4'
);

async function check() {
  console.log('=== ACCOUNTS ===');
  const { data: accounts, error: accErr } = await client
    .from('connected_accounts')
    .select('id, email, status, daily_limit, sent_today_count, last_sent_at, updated_at');
  console.log(accounts, accErr);

  console.log('\n=== CAMPAIGNS FOR ADI ===');
  const adiAccount = accounts?.find((a) => a.email.includes('adi1504'));
  if (adiAccount) {
    const { data: campaigns, error: campErr } = await client
      .from('campaigns')
      .select('*')
      .eq('account_id', adiAccount.id);
    console.log(campaigns, campErr);

    if (campaigns && campaigns.length > 0) {
      for (const camp of campaigns) {
        console.log(`Campaign "${camp.name}" (${camp.id}) status: ${camp.status}`);
        const { data: recDetails } = await client
          .from('campaign_recipients')
          .select('id, status, error_details, retry_count')
          .eq('campaign_id', camp.id);
        const statusMap = {};
        recDetails?.forEach((r) => {
          statusMap[r.status] = (statusMap[r.status] || 0) + 1;
        });
        console.log('Recipients summary:', statusMap);
        const errors = recDetails?.filter((r) => r.error_details);
        if (errors?.length > 0) {
          console.log('Sample error_details:', errors.slice(0, 3));
        }
      }
    }
  }

  console.log('\n=== RECENT EMAIL EVENTS ===');
  const { data: events, error: evErr } = await client
    .from('email_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log(events, evErr);
}

check();
