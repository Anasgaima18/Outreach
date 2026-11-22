const token = 'SUPABASE_ACCESS_TOKEN_HERE';

async function query(sql) {
  const res = await fetch('https://api.supabase.com/v1/projects/kiowzydhojinqonuvaxq/database/query', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  return res.json();
}

async function verify() {
  console.log('--- 1. Tables & RLS ---');
  const tables = await query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename;
  `);
  console.log(tables);

  console.log('--- 2. Extensions ---');
  const ext = await query(`
    SELECT extname, extversion 
    FROM pg_extension 
    WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pg_cron', 'pg_net')
    ORDER BY extname;
  `);
  console.log(ext);

  console.log('--- 3. Key Indexes ---');
  const indexes = await query(`
    SELECT indexname, tablename 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    ORDER BY tablename, indexname;
  `);
  console.log(indexes);
}

verify().catch(console.error);
