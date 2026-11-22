import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../src/components/layout/Sidebar';
import { Header } from '../src/components/layout/Header';
import { App } from '../src/App';

describe('Layout & Navigation Component Tests', () => {
  describe('Sidebar Component', () => {
    it('renders all 8 primary navigation items', () => {
      const onNavigate = vi.fn();
      render(<Sidebar currentView="dashboard" onNavigate={onNavigate} />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Connected Accounts')).toBeInTheDocument();
      expect(screen.getByText('Contacts')).toBeInTheDocument();
      expect(screen.getByText('Campaigns')).toBeInTheDocument();
      expect(screen.getByText('Follow-ups')).toBeInTheDocument();
      expect(screen.getByText('Replies')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('triggers onNavigate callback when an item is clicked', () => {
      const onNavigate = vi.fn();
      render(<Sidebar currentView="dashboard" onNavigate={onNavigate} />);

      fireEvent.click(screen.getByText('Contacts'));
      expect(onNavigate).toHaveBeenCalledWith('contacts');

      fireEvent.click(screen.getByText('Campaigns'));
      expect(onNavigate).toHaveBeenCalledWith('campaigns');
    });
  });

  describe('Header Component', () => {
    it('renders active view title, GamifyTL branding, and live Supabase reference', () => {
      render(<Header activeViewTitle="Overview & Operations" />);

      expect(screen.getByText('Overview & Operations')).toBeInTheDocument();
      expect(screen.getByText(/GamifyTL Professor Outreach Platform/i)).toBeInTheDocument();
      expect(screen.getByText('kiowzydhojinqonuvaxq')).toBeInTheDocument();
      expect(screen.getByText(/RLS Enforced/i)).toBeInTheDocument();
    });
  });

  describe('App View Switcher Integration', () => {
    it('switches between all 8 view shells cleanly', () => {
      render(<App />);

      // Initial view is Dashboard
      expect(screen.getByRole('heading', { level: 2, name: /GamifyTL Professor Outreach/i })).toBeInTheDocument();
      expect(screen.getByText(/Outreach Readiness Checklist/i)).toBeInTheDocument();

      // Switch to Connected Accounts
      fireEvent.click(screen.getByRole('button', { name: /Connected Accounts/i }));
      expect(screen.getByRole('heading', { level: 2, name: /Connected Gmail Accounts/i })).toBeInTheDocument();
      expect(screen.getByText(/Google OAuth 2.0 Security & Token Lifecycle Policy/i)).toBeInTheDocument();

      // Switch to Contacts
      fireEvent.click(screen.getByRole('button', { name: /Contacts/i }));
      expect(screen.getByRole('heading', { level: 2, name: /Professor & Educator Contacts/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search by professor name/i)).toBeInTheDocument();

      // Switch to Campaigns
      fireEvent.click(screen.getByRole('button', { name: /Campaigns/i }));
      expect(screen.getByRole('heading', { level: 2, name: /Outreach Campaigns/i })).toBeInTheDocument();
      expect(screen.getByText(/Mandatory Human Approval Gate Enforced/i)).toBeInTheDocument();

      // Switch to Follow-ups
      fireEvent.click(screen.getByRole('button', { name: /Follow-ups/i }));
      expect(screen.getByRole('heading', { level: 2, name: /Follow-up Sequences/i })).toBeInTheDocument();
      expect(screen.getByText(/Reply Suppression/i)).toBeInTheDocument();

      // Switch to Replies
      fireEvent.click(screen.getByRole('button', { name: /Replies/i }));
      expect(screen.getByRole('heading', { level: 2, name: /Professor Replies/i })).toBeInTheDocument();
      expect(screen.getByText(/Hybrid Reply Architecture/i)).toBeInTheDocument();

      // Switch to Analytics
      fireEvent.click(screen.getByRole('button', { name: /Analytics/i }));
      expect(screen.getByRole('heading', { level: 2, name: /Outreach Analytics & Health/i })).toBeInTheDocument();
      expect(screen.getByText(/Strict Analytics Integrity Mandate/i)).toBeInTheDocument();

      // Switch to Settings
      fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
      expect(screen.getByRole('heading', { level: 2, name: /Platform Settings/i })).toBeInTheDocument();
      expect(screen.getByText(/Daily Account Send Ceiling/i)).toBeInTheDocument();
    });
  });
});
