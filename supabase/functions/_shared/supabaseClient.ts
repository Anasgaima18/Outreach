import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Retrieves environment variable from Deno or Node runtime.
 */
export function getEnv(key: string): string | undefined {
  // @ts-ignore: Deno runtime check
  if (typeof Deno !== 'undefined' && Deno.env) {
    // @ts-ignore: Deno runtime
    return Deno.env.get(key);
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

/**
 * Creates Supabase client using Service Role key for administrative operations in Edge Functions.
 */
export function createServiceClient() {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
