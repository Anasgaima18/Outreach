import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPage } from '../../src/pages/LoginPage';
import { App } from '../../src/App';

describe('Portal Authentication Gate & LoginPage Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('LoginPage Component', () => {
    it('renders GamifyTL branding, portal badge, and inputs', () => {
      const onLoginSuccess = vi.fn();
      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      expect(screen.getByRole('heading', { level: 1, name: /GamifyTL/i })).toBeInTheDocument();
      expect(screen.getByText('Portal')).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter your password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In to Portal/i })).toBeInTheDocument();
    });

    it('toggles password visibility when the eye button is clicked', () => {
      const onLoginSuccess = vi.fn();
      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      const passwordInput = screen.getByPlaceholderText(/Enter your password/i) as HTMLInputElement;
      const toggleBtn = screen.getByRole('button', { name: /Show password/i });

      expect(passwordInput.type).toBe('password');
      fireEvent.click(toggleBtn);
      expect(passwordInput.type).toBe('text');
      fireEvent.click(screen.getByRole('button', { name: /Hide password/i }));
      expect(passwordInput.type).toBe('password');
    });

    it('rejects an incorrect password with an error message', async () => {
      const onLoginSuccess = vi.fn();
      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
      const submitBtn = screen.getByRole('button', { name: /Sign In to Portal/i });

      fireEvent.change(emailInput, { target: { value: 'gamifytl1315@gmail.com' } });
      fireEvent.change(passwordInput, { target: { value: 'WrongPassword@123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
      });

      expect(onLoginSuccess).not.toHaveBeenCalled();
      expect(localStorage.getItem('gamifytl_portal_session')).toBeNull();
    });

    it('authenticates successfully with gamifytl1315@gmail.com and Create@gamifytl1315', async () => {
      const onLoginSuccess = vi.fn();
      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
      const submitBtn = screen.getByRole('button', { name: /Sign In to Portal/i });

      fireEvent.change(emailInput, { target: { value: 'gamifytl1315@gmail.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Create@gamifytl1315' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onLoginSuccess).toHaveBeenCalledWith('gamifytl1315@gmail.com');
      });

      const session = JSON.parse(localStorage.getItem('gamifytl_portal_session') || '{}');
      expect(session.authenticated).toBe(true);
      expect(session.email).toBe('gamifytl1315@gmail.com');
    });
  });

  describe('App Authentication Gate Integration', () => {
    it('locks portal and displays LoginPage when bypassAuth is false and no session exists', () => {
      render(<App bypassAuth={false} />);

      expect(screen.getByRole('heading', { level: 1, name: /GamifyTL/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In to Portal/i })).toBeInTheDocument();
      // Main dashboard should NOT be visible
      expect(screen.queryByRole('heading', { level: 2, name: /GamifyTL Professor Outreach/i })).not.toBeInTheDocument();
    });

    it('unlocks portal on valid credentials submit and allows signing out back to login screen', async () => {
      render(<App bypassAuth={false} />);

      // Fill in valid credentials
      const emailInput = screen.getByLabelText(/Email Address/i);
      const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
      fireEvent.change(emailInput, { target: { value: 'gamifytl1315@gmail.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Create@gamifytl1315' } });
      fireEvent.click(screen.getByRole('button', { name: /Sign In to Portal/i }));

      // Dashboard is now rendered
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: /GamifyTL Professor Outreach/i })).toBeInTheDocument();
      });

      // Verify sign out button exists in sidebar and header
      const signOutBtns = screen.getAllByRole('button', { name: /Sign Out/i });
      expect(signOutBtns.length).toBeGreaterThan(0);

      // Click sign out
      fireEvent.click(signOutBtns[0]);

      // Returns to login screen and removes session
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Sign In to Portal/i })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { level: 2, name: /GamifyTL Professor Outreach/i })).not.toBeInTheDocument();
      });

      expect(localStorage.getItem('gamifytl_portal_session')).toBeNull();
    });
  });
});
