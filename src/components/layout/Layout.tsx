import React from 'react';
import { Sidebar, type ViewType } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onLogout?: () => void;
  currentUser?: string;
  children: React.ReactNode;
}

const viewTitles: Record<ViewType, string> = {
  dashboard: 'Overview & Operations',
  accounts: 'Connected Accounts',
  contacts: 'Educator Directory',
  campaigns: 'Outreach Campaigns',
  'follow-ups': 'Follow-up Sequences',
  replies: 'Professor Replies',
  analytics: 'Outreach Analytics',
  settings: 'Platform Settings',
  templates: 'Email Template Library',
};

export function Layout({ currentView, onNavigate, onLogout, currentUser, children }: LayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50/70">
      {/* Sidebar */}
      <Sidebar currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header activeViewTitle={viewTitles[currentView]} onLogout={onLogout} currentUser={currentUser} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
