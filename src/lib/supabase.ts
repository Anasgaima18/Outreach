import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kiowzydhojinqonuvaxq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpb3d6eWRob2ppbnFvbnV2YXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzNDQyNzAsImV4cCI6MjExMDkyMDI3MH0.9AiNGXnE1cP07hWSidiGINUyVX_IgORNccLvhHv_bk4';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
}

/**
 * Strongly typed Supabase client for GamifyTL Professor Outreach Platform
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Health check helper to test database connectivity
 */
export async function checkDatabaseConnection(): Promise<{ ok: boolean; message?: string }> {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    // Note: If no user is logged in, RLS might return an empty array or 0 rows, which is ok (no error)
    if (error && error.code !== 'PGRST116') {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown connection error';
    return { ok: false, message };
  }
}
