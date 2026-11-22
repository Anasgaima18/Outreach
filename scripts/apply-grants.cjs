const token = 'SUPABASE_ACCESS_TOKEN_HERE';
const projectRef = 'kiowzydhojinqonuvaxq';

async function runSql() {
  const query = `
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.profiles (id, email, full_name)
      VALUES (new.id, coalesce(new.email, ''), new.raw_user_meta_data->>'full_name')
      ON CONFLICT (id) DO UPDATE
      SET email = excluded.email,
          full_name = coalesce(excluded.full_name, public.profiles.full_name),
          updated_at = now();
      RETURN new;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public;
  `;

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  const data = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', data);
}

runSql().catch(console.error);
