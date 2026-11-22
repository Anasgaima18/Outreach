import React, { useState } from 'react';
import { MailCheck, Plus, AlertTriangle, ShieldCheck, RefreshCw, PowerOff, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Progress } from '../components/ui/Progress';
import { EmptyState } from '../components/shared/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/Dialog';
import { useAccounts } from '../hooks/useAccounts';
import { formatDate } from '../lib/utils';
import type { ConnectedAccount, AccountStatus } from '../types/database.types';

export function AccountsPage() {
  const {
    accounts,
    loading,
    error,
    refresh,
    disconnect,
    removeAccount,
    initiateOAuthConnect,
  } = useAccounts();

  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [targetAccount, setTargetAccount] = useState<ConnectedAccount | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Custom client ID / redirect URI overrides if user wants to configure on the fly
  const [clientId, setClientId] = useState(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || 'mock-google-client-id.apps.googleusercontent.com'
  );
  const [redirectUri, setRedirectUri] = useState(
    import.meta.env.VITE_GOOGLE_REDIRECT_URI ||
      'https://kiowzydhojinqonuvaxq.supabase.co/functions/v1/oauth-callback'
  );

  const handleOpenConnect = () => {
    setConnectModalOpen(true);
  };

  const handleAuthorizeGoogle = () => {
    const authUrl = initiateOAuthConnect({
      clientId,
      redirectUri,
      userId: 'current-user',
    });
    // In production browser environment, redirect to Google OAuth
    if (typeof window !== 'undefined') {
      window.location.href = authUrl;
    }
  };

  const handleOpenDisconnect = (acc: ConnectedAccount) => {
    setTargetAccount(acc);
    setDisconnectModalOpen(true);
  };

  const handleConfirmDisconnect = async () => {
    if (!targetAccount) return;
    setDisconnecting(true);
    await disconnect(targetAccount.id);
    setDisconnecting(false);
    setDisconnectModalOpen(false);
    setTargetAccount(null);
  };

  const handleReauthenticate = (acc: ConnectedAccount) => {
    const authUrl = initiateOAuthConnect({
      clientId,
      redirectUri,
      userId: acc.user_id,
    });
    if (typeof window !== 'undefined') {
      window.location.href = authUrl;
    }
  };

  const getStatusBadge = (status: AccountStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'expired':
        return <Badge variant="warning">Token Expired (7-Day)</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>;
      case 'rate_limited':
        return <Badge variant="destructive">Rate Limited</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Connected Gmail Accounts</h2>
          <p className="text-sm text-gray-500">
            Personal Gmail accounts authorized via official Google OAuth 2.0 for outreach delivery.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleOpenConnect} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Connect Gmail Account
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* Google OAuth & Testing Mode Notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1.5 leading-relaxed">
            <p className="font-semibold text-amber-950">
              Google OAuth 2.0 Security & Token Lifecycle Policy
            </p>
            <p>
              In Google Cloud Console <strong>Testing mode</strong>, refresh tokens for external personal
              accounts expire strictly every 7 days. For permanent tokens without weekly re-authentication,
              the Google Cloud project Publishing Status can be set to <strong>In Production</strong>{' '}
              (permits up to 100 internal users under the unverified app flow with zero CASA audit fees).
            </p>
            <p className="text-amber-800 font-medium">
              Refresh tokens are securely encrypted at rest using PostgreSQL{' '}
              <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">pgcrypto</code> symmetric encryption.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-500">Loading connected accounts...</span>
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<MailCheck className="h-6 w-6" />}
          title="No Gmail Accounts Connected"
          description="Connect your personal Gmail account to start scheduling and sending personalized outreach campaigns to educators."
          actionLabel="Authorize Personal Gmail"
          onAction={handleOpenConnect}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((acc) => {
            const remaining = Math.max(0, acc.daily_limit - acc.sent_today_count);
            return (
              <div
                key={acc.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm space-y-4"
              >
                {/* Account Top Row */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-900">{acc.email}</h4>
                      {getStatusBadge(acc.status)}
                    </div>
                    <p className="text-xs text-gray-500">
                      {acc.display_name || 'Personal Gmail Account'} • Connected {formatDate(acc.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {acc.status === 'expired' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReauthenticate(acc)}
                        className="text-amber-700 border-amber-300 hover:bg-amber-50"
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Re-auth
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenDisconnect(acc)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                      title="Disconnect Account"
                    >
                      <PowerOff className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAccount(acc.id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                      title="Remove from DB"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Daily Sending Limit Progress */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>Daily Sending Limit</span>
                    <span>
                      {acc.sent_today_count} / {acc.daily_limit} emails sent
                    </span>
                  </div>
                  <Progress
                    value={acc.sent_today_count}
                    max={acc.daily_limit}
                    indicatorClassName={
                      acc.sent_today_count >= acc.daily_limit
                        ? 'bg-amber-500'
                        : 'bg-blue-600'
                    }
                  />
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span>Conservative policy (20–50/day)</span>
                    <span className="font-medium text-gray-800">{remaining} remaining today</span>
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-100">
                  <span>Last sent: {acc.last_sent_at ? formatDate(acc.last_sent_at) : 'Never'}</span>
                  <span className="flex items-center gap-1 text-emerald-700 font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" /> pgcrypto encrypted
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connect Account OAuth Modal */}
      <Dialog open={connectModalOpen} onOpenChange={setConnectModalOpen}>
        <DialogContent maxWidth="md" onClose={() => setConnectModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Connect Personal Gmail via Google OAuth 2.0</DialogTitle>
            <DialogDescription>
              Authorize your personal Gmail account to deliver personalized GamifyTL educator invitations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs text-gray-600 leading-relaxed">
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2">
              <p className="font-semibold text-blue-900">OAuth Security & Permission Scopes:</p>
              <ul className="list-disc pl-4 space-y-1 text-blue-800">
                <li><code className="font-mono font-bold">gmail.send</code>: Send individualized emails on your behalf</li>
                <li><code className="font-mono">openid, email, profile</code>: Identify the connected account address</li>
                <li>Zero invasive read permissions (<code className="font-mono">gmail.readonly</code>) to prevent $5k–$15k CASA audits</li>
              </ul>
            </div>

            <p className="text-gray-500 text-[11px]">
              You will be redirected to Google's sign-in page. Pick the Gmail account you want to use for outreach. Your credentials are never stored — only an encrypted OAuth token is saved.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAuthorizeGoogle}>
              Authorize with Google <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={disconnectModalOpen} onOpenChange={setDisconnectModalOpen}>
        <DialogContent maxWidth="sm" onClose={() => setDisconnectModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Disconnect Gmail Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect{' '}
              <strong className="text-gray-900">{targetAccount?.email}</strong>?
              This will revoke its sending authorization until re-authenticated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisconnectModalOpen(false)}
              disabled={disconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AccountsPage;
