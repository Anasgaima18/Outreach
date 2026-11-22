/**
 * Hook for Connected Gmail Accounts Management
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ConnectedAccount } from '../types/database.types';
import { getGoogleAuthUrl, disconnectAccount as serviceDisconnectAccount } from '../services/gmail';

export function useAccounts() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('connected_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setAccounts(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch connected accounts';
      console.error('fetchAccounts error:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const disconnect = async (accountId: string): Promise<boolean> => {
    try {
      const result = await serviceDisconnectAccount(accountId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to disconnect account');
      }
      await fetchAccounts();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error disconnecting account';
      setError(msg);
      return false;
    }
  };

  const removeAccount = async (accountId: string): Promise<boolean> => {
    try {
      const { error: delError } = await supabase
        .from('connected_accounts')
        .delete()
        .eq('id', accountId);

      if (delError) throw delError;
      await fetchAccounts();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error removing account';
      setError(msg);
      return false;
    }
  };

  const initiateOAuthConnect = (customParams?: {
    userId?: string;
    clientId?: string;
    redirectUri?: string;
  }): string => {
    const userId = customParams?.userId || 'default-user';
    const clientId =
      customParams?.clientId ||
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      'mock-google-client-id.apps.googleusercontent.com';
    const redirectUri =
      customParams?.redirectUri ||
      import.meta.env.VITE_GOOGLE_REDIRECT_URI ||
      'https://kiowzydhojinqonuvaxq.supabase.co/functions/v1/oauth-callback';

    return getGoogleAuthUrl({
      userId,
      clientId,
      redirectUri,
    });
  };

  return {
    accounts,
    loading,
    error,
    refresh: fetchAccounts,
    disconnect,
    removeAccount,
    initiateOAuthConnect,
  };
}
