import React, { useState, useEffect } from 'react';
import { Sliders, Database, CheckCircle2, AlertCircle, RefreshCw, Mail } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAccounts } from '../hooks/useAccounts';

function getStorageItem(key: string, defaultVal: number): number {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const val = window.localStorage.getItem(key);
      if (val) return Number(val) || defaultVal;
    } catch {
      // ignore in tests / restricted environments
    }
  }
  return defaultVal;
}

function setStorageItem(key: string, val: string) {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(key, val);
    } catch {
      // ignore
    }
  }
}

export function SettingsPage() {
  const { accounts, loading: accountsLoading, updateAllDailyLimits, updateDailyLimit, refresh } = useAccounts();

  const [minDelay, setMinDelay] = useState<number>(() => getStorageItem('gamifytl_min_delay', 20));
  const [maxDelay, setMaxDelay] = useState<number>(() => getStorageItem('gamifytl_max_delay', 60));
  const [dailyLimit, setDailyLimit] = useState<number>(() => getStorageItem('gamifytl_daily_limit', 50));

  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync dailyLimit from accounts if present
  useEffect(() => {
    if (accounts.length > 0 && accounts[0].daily_limit) {
      setDailyLimit(accounts[0].daily_limit);
    }
  }, [accounts]);

  const handleSaveParameters = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveFeedback(null);

    const safeLimit = Math.max(1, Math.min(Number(dailyLimit) || 50, 50));
    const safeMin = Math.max(5, Number(minDelay) || 20);
    const safeMax = Math.max(safeMin, Number(maxDelay) || 60);

    // Save to localStorage safely
    setStorageItem('gamifytl_daily_limit', safeLimit.toString());
    setStorageItem('gamifytl_min_delay', safeMin.toString());
    setStorageItem('gamifytl_max_delay', safeMax.toString());

    // Update in Supabase across all accounts
    const res = await updateAllDailyLimits(safeLimit);
    setSaving(false);

    if (res.success) {
      setDailyLimit(safeLimit);
      setMinDelay(safeMin);
      setMaxDelay(safeMax);
      setSaveFeedback({
        type: 'success',
        message: `Settings saved successfully! Updated daily send ceiling to ${safeLimit} emails/day across ${accounts.length} connected account(s).`,
      });
      setTimeout(() => setSaveFeedback(null), 5000);
    } else {
      setSaveFeedback({
        type: 'error',
        message: res.error || 'Failed to update daily limits in database.',
      });
    }
  };

  const handleUpdateIndividualLimit = async (accountId: string, newLimit: number) => {
    const res = await updateDailyLimit(accountId, newLimit);
    if (res.success) {
      setSaveFeedback({
        type: 'success',
        message: `Updated account limit to ${newLimit} emails/day.`,
      });
      setTimeout(() => setSaveFeedback(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900">Platform Settings</h2>
        <p className="text-sm text-gray-500">
          Sending parameters, OAuth configuration, and Supabase database infrastructure.
        </p>
      </div>

      {saveFeedback && (
        <div
          className={`flex items-center gap-2.5 rounded-xl border p-4 text-xs font-medium animate-fade-in ${
            saveFeedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {saveFeedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          <span>{saveFeedback.message}</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sending Safety Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sliders className="h-4 w-4 text-blue-600" />
              Sending Rate & Deliverability Limits
            </CardTitle>
            <CardDescription>
              Configured conservatively to mimic authentic human sending behavior and avoid spam filters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveParameters} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Minimum Delay Between Emails (seconds)</label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={minDelay}
                  onChange={(e) => setMinDelay(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-gray-500">Google recommends spacing out programmatic personal sends (default 20s).</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Maximum Delay Between Emails (seconds)</label>
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={maxDelay}
                  onChange={(e) => setMaxDelay(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-gray-500">Randomized jitter adds variation to prevent bot pattern detection (default 60s).</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700">Daily Account Send Ceiling</label>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {dailyLimit} / day
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Math.min(50, Math.max(1, Number(e.target.value))))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-gray-500">
                  Strict restriction: Maximum 50 emails allowed per connected Gmail account per day.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? 'Saving to Database...' : 'Save Parameters'}
                </Button>
                <span className="text-[11px] text-gray-400">Updates live Supabase limits</span>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Infrastructure & Connected Accounts Status */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-indigo-600" />
                  Active Account Limits
                </div>
                <Button variant="ghost" size="sm" onClick={() => refresh()} disabled={accountsLoading} className="h-7 px-2 text-xs">
                  <RefreshCw className={`h-3 w-3 ${accountsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
              <CardDescription>
                Live daily quota status from connected accounts in Supabase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No connected Gmail accounts found.</p>
              ) : (
                <div className="space-y-3">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/60"
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-gray-900">{acc.email}</p>
                        <p className="text-[11px] text-gray-500">
                          Sent today: <span className="font-semibold text-gray-800">{acc.sent_today_count}</span> / {acc.daily_limit}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={acc.daily_limit}
                          onChange={(e) => handleUpdateIndividualLimit(acc.id, Number(e.target.value))}
                          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
                        >
                          <option value={10}>10/day</option>
                          <option value={20}>20/day</option>
                          <option value={35}>35/day</option>
                          <option value={50}>50/day (Max Limit)</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-600" />
                Supabase Infrastructure
              </CardTitle>
              <CardDescription>
                Active database and security settings for this project.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-gray-600">Project Reference:</span>
                <span className="font-mono font-medium text-gray-900">kiowzydhojinqonuvaxq</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-gray-600">PostgreSQL Engine:</span>
                <span className="font-medium text-gray-900">Postgres 17 (Official GA)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-gray-600">Row Level Security:</span>
                <Badge variant="success">8/8 Tables Enabled</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-gray-600">Sensitive Storage:</span>
                <span className="font-medium text-gray-900">pgcrypto Symmetric Encryption</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
