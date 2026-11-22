import { Sliders, Database } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900">Platform Settings</h2>
        <p className="text-sm text-gray-500">
          Sending parameters, OAuth configuration, and Supabase database infrastructure.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sending Safety Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sliders className="h-4 w-4 text-blue-600" />
              Sending Rate & Deliverability Limits
            </CardTitle>
            <CardDescription>
              Configured conservatively to mimic authentic human sending behavior.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Minimum Delay Between Emails (seconds)</label>
              <input
                type="number"
                defaultValue={20}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-[11px] text-gray-500">Google recommends spacing out programmatic personal sends.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Maximum Delay Between Emails (seconds)</label>
              <input
                type="number"
                defaultValue={60}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-[11px] text-gray-500">Randomized jitter adds variation to prevent pattern detection.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Daily Account Send Ceiling</label>
              <input
                type="number"
                defaultValue={50}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-[11px] text-gray-500">Capped at 50/day (far below Google's 500 hard daily ceiling).</p>
            </div>

            <Button size="sm" className="mt-2">Save Parameters</Button>
          </CardContent>
        </Card>

        {/* Infrastructure & Security */}
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
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <span className="text-gray-600">Project Reference:</span>
              <span className="font-mono font-medium text-gray-900">kiowzydhojinqonuvaxq</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <span className="text-gray-600">Region:</span>
              <span className="font-medium text-gray-900">ap-southeast-2 (Sydney)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <span className="text-gray-600">PostgreSQL Engine:</span>
              <span className="font-medium text-gray-900">Postgres 17 (Official GA)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <span className="text-gray-600">Row Level Security:</span>
              <Badge variant="success">8/8 Tables Enabled</Badge>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <span className="text-gray-600">Sensitive Storage:</span>
              <span className="font-medium text-gray-900">pgcrypto Symmetric Encryption</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
