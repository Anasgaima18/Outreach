import { useState } from 'react';
import { Layout } from './components/layout/Layout';
import type { ViewType } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { AccountsPage } from './pages/AccountsPage';
import { ContactsPage } from './pages/ContactsPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { FollowUpsPage } from './pages/FollowUpsPage';
import { RepliesPage } from './pages/RepliesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardPage onNavigate={setCurrentView} />;
      case 'accounts':
        return <AccountsPage />;
      case 'contacts':
        return <ContactsPage />;
      case 'campaigns':
        return <CampaignsPage />;
      case 'follow-ups':
        return <FollowUpsPage />;
      case 'replies':
        return <RepliesPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={setCurrentView} />;
    }
  };

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {renderView()}
    </Layout>
  );
}

export default App;
