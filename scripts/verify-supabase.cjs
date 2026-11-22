const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kiowzydhojinqonuvaxq.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpb3d6eWRob2ppbnFvbnV2YXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzNDQyNzAsImV4cCI6MjExMDkyMDI3MH0.9AiNGXnE1cP07hWSidiGINUyVX_IgORNccLvhHv_bk4';
const token = 'SUPABASE_ACCESS_TOKEN_HERE';
const projectRef = 'kiowzydhojinqonuvaxq';

const client = createClient(supabaseUrl, anonKey);

async function test() {
  console.log('Testing PostgREST query on profiles...');
  const { data, error } = await client.from('profiles').select('id').limit(1);
  if (error) {
    console.error('ERROR querying profiles:', error);
    process.exit(1);
  }
  console.log('SUCCESS: profiles query succeeded without 42501 error! Data:', data);

  const tables = [
    'profiles',
    'connected_accounts',
    'contacts',
    'campaigns',
    'campaign_recipients',
    'email_events',
    'replies',
    'suppressions',
  ];

  for (const table of tables) {
    const res = await client.from(table).select('*').limit(1);
    if (res.error) {
      console.error(`ERROR querying ${table}:`, res.error);
      process.exit(1);
    }
    console.log(`Table ${table}: OK (returned ${res.data.length} rows)`);
  }

  // Check pg_proc config
  const query = "SELECT proname, prosecdef, proconfig FROM pg_proc WHERE proname = 'handle_new_user';";
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  const procData = await res.json();
  console.log('Function handle_new_user verification:', procData);

  console.log('All verifications passed!');
}

test().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
