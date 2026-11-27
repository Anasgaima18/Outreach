import React from 'react';
import {
  LayoutDashboard,
  MailCheck,
  Users,
  Send,
  Clock,
  MessageSquare,
  BarChart3,
  Settings,
  GraduationCap,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type ViewType =
  | 'dashboard'
  | 'accounts'
  | 'contacts'
  | 'campaigns'
  | 'follow-ups'
  | 'replies'
  | 'analytics'
  | 'settings'
  | 'templates';

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onLogout?: () => void;
}

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'accounts', label: 'Connected Accounts', icon: MailCheck },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'campaigns', label: 'Campaigns', icon: Send },
  { id: 'follow-ups', label: 'Follow-ups', icon: Clock },
  { id: 'replies', label: 'Replies', icon: MessageSquare },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentView, onNavigate, onLogout }: SidebarProps) {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white select-none">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white p-1 border border-gray-100 shadow-2xs ring-2 ring-red-50">
          <img src="/portal-logo.webp" alt="GamifyTL Logo" className="h-7 w-7 object-contain" />
        </div>
        <div>
          <span className="text-base font-bold text-gray-900 tracking-tight">GamifyTL</span>
          <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 uppercase">
            Outreach
          </span>
          <p className="text-[11px] text-gray-500 font-normal">Professor Outreach</p>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Main Navigation">
        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Core Platform
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'h-4 w-4 transition-colors',
                    isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-600'
                  )}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-3">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Outreach Design
          </div>
          <button
            onClick={() => onNavigate('templates')}
            className={cn(
              'group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              currentView === 'templates'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <div className="flex items-center gap-3">
              <Sparkles
                className={cn(
                  'h-4 w-4 transition-colors',
                  currentView === 'templates' ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-600'
                )}
              />
              <span>Email Templates</span>
            </div>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
              20
            </span>
          </button>
        </div>
      </nav>

      {/* Footer Info Box */}
      <div className="border-t border-gray-200 p-4">
        <div className="rounded-lg bg-gray-50 p-3 border border-gray-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>GamifyTL.com</span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
            Interactive classroom games with 0 app installs for university professors.
          </p>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 hover:text-red-800 transition-colors shadow-2xs"
            title="Lock Portal and Sign Out"
          >
            <LogOut className="h-3.5 w-3.5 text-red-600" />
            <span>Lock Portal &amp; Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
