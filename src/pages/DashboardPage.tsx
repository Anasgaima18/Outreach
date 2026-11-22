import {
  Users,
  Send,
  MailCheck,
  MessageSquare,
  TrendingUp,
  AlertCircle,
  PlusCircle,
  Upload,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAccounts } from '../hooks/useAccounts';
import { useContacts } from '../hooks/useContacts';
import { useCampaigns } from '../hooks/useCampaigns';
import { useAnalytics } from '../hooks/useAnalytics';
import type { ViewType } from '../components/layout/Sidebar';

interface DashboardPageProps {
  onNavigate: (view: ViewType) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { accounts } = useAccounts();
  const { contacts } = useContacts();
  const { campaigns } = useCampaigns();
  const { data: analytics } = useAnalytics();

  const totalContacts = contacts.length || analytics?.totalContacts || 0;
  const totalAccounts = accounts.length;
  const totalCampaigns = campaigns.length || analytics?.totalCampaigns || 0;
  const totalReplies = analytics?.totalReplies || 0;

  const hasAccount = totalAccounts > 0;
  const hasContacts = totalContacts > 0;
  const hasCampaign = totalCampaigns > 0;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 p-6 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">GamifyTL Professor Outreach</h2>
            <p className="mt-1 text-sm text-blue-100 max-w-2xl leading-relaxed">
              Connect personal Gmail accounts, manage educator directories, and introduce GamifyTL's
              zero-install classroom engagement suite to international university professors.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="secondary"
              onClick={() => onNavigate('campaigns')}
              className="bg-white text-blue-700 hover:bg-blue-50 font-semibold"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
            <Button
              variant="outline"
              onClick={() => onNavigate('contacts')}
              className="border-white/40 bg-transparent text-white hover:bg-white/10"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Contacts
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:border-blue-200 transition-colors cursor-pointer" onClick={() => onNavigate('contacts')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Contacts Directory</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{totalContacts}</div>
            <p className="text-xs text-gray-500 mt-1">Ready for outreach campaigns</p>
          </CardContent>
        </Card>

        <Card className="hover:border-emerald-200 transition-colors cursor-pointer" onClick={() => onNavigate('accounts')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Connected Accounts</CardTitle>
            <MailCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{totalAccounts}</div>
            <p className="text-xs text-gray-500 mt-1">Personal Gmail accounts active</p>
          </CardContent>
        </Card>

        <Card className="hover:border-indigo-200 transition-colors cursor-pointer" onClick={() => onNavigate('campaigns')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Campaigns</CardTitle>
            <Send className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{totalCampaigns}</div>
            <p className="text-xs text-gray-500 mt-1">Managed outreach campaigns</p>
          </CardContent>
        </Card>

        <Card className="hover:border-purple-200 transition-colors cursor-pointer" onClick={() => onNavigate('replies')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Replies Received</CardTitle>
            <MessageSquare className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{totalReplies}</div>
            <p className="text-xs text-gray-500 mt-1">Tracked via thread association</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Setup & Next Steps */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Outreach Readiness Checklist
            </CardTitle>
            <CardDescription>
              Follow these foundational steps before launching cold email outreach.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                  ✓
                </span>
                <span className="text-sm font-medium text-gray-800">
                  Database & RLS Security Initialized
                </span>
              </div>
              <Badge variant="success">Completed</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    hasAccount ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {hasAccount ? '✓' : '2'}
                </span>
                <span className="text-sm font-medium text-gray-800">
                  Connect Personal Gmail Account (OAuth 2.0)
                </span>
              </div>
              {hasAccount ? (
                <Badge variant="success">Connected</Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={() => onNavigate('accounts')}>
                  Connect
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    hasContacts ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {hasContacts ? '✓' : '3'}
                </span>
                <span className="text-sm font-medium text-gray-800">
                  Add or Import Contacts Directory
                </span>
              </div>
              {hasContacts ? (
                <Badge variant="success">{totalContacts} Added</Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={() => onNavigate('contacts')}>
                  Add Contacts
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    hasCampaign ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {hasCampaign ? '✓' : '4'}
                </span>
                <span className="text-sm font-medium text-gray-800">
                  Create First Outreach Campaign & Approve
                </span>
              </div>
              {hasCampaign ? (
                <Badge variant="success">{totalCampaigns} Active</Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={() => onNavigate('campaigns')}>
                  Create
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Deliverability & Google Compliance Safeguards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-indigo-600" />
              Deliverability & Sender Safeguards
            </CardTitle>
            <CardDescription>
              Built-in protections to maintain healthy inbox placement and prevent spam blocks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
              <h4 className="font-semibold text-blue-900 text-xs uppercase tracking-wider mb-1">
                Conservative Sending Rate
              </h4>
              <p className="text-xs text-blue-800 leading-relaxed">
                Paced at 20–60 second intervals with randomized jitter. Daily limits capped at 50
                emails per personal Gmail account (well within Google's 500/day limit).
              </p>
            </div>

            <div className="p-3 rounded-lg bg-purple-50/50 border border-purple-100">
              <h4 className="font-semibold text-purple-900 text-xs uppercase tracking-wider mb-1">
                Automatic Pre-flight Suppression
              </h4>
              <p className="text-xs text-purple-800 leading-relaxed">
                Recipients who reply, unsubscribe, or bounce are automatically suppressed from future
                follow-up sequences.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
              <h4 className="font-semibold text-emerald-900 text-xs uppercase tracking-wider mb-1">
                Zero Hidden Tracking Pixels
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Transparent clean email content without deceptive 1x1 pixels or redirects that trigger
                academic mail filters (Proofpoint, Cisco IronPort).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
