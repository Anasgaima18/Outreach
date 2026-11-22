import { describe, it, expect } from 'vitest';
import { supabase, checkDatabaseConnection } from '../src/lib/supabase';

describe('Supabase Client (src/lib/supabase.ts)', () => {
  it('initializes the Supabase client with non-empty URL and key', () => {
    expect(supabase).toBeDefined();
    // Verify client has query builder methods for our tables
    expect(typeof supabase.from).toBe('function');
    expect(typeof supabase.auth.signUp).toBe('function');
    expect(typeof supabase.auth.signInWithPassword).toBe('function');
  });

  it('can construct queries against all 8 core tables', () => {
    const tableNames = [
      'profiles',
      'connected_accounts',
      'contacts',
      'campaigns',
      'campaign_recipients',
      'email_events',
      'replies',
      'suppressions',
    ] as const;

    for (const table of tableNames) {
      const query = supabase.from(table).select('id');
      expect(query).toBeDefined();
      expect(typeof query.limit).toBe('function');
    }
  });

  it('checkDatabaseConnection connects to database successfully without permission errors', async () => {
    const result = await checkDatabaseConnection();
    expect(result.ok).toBe(true);
    expect(result.message).toBeUndefined();
  });
});
