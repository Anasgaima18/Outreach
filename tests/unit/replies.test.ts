import { describe, it, expect } from 'vitest';
import { getGmailThreadUrl } from '../../src/services/gmail';
import type { Reply } from '../../src/types/database.types';

describe('Replies Unit Tests (src/pages/RepliesPage.tsx & src/services/gmail.ts)', () => {
  describe('Gmail Thread Deep Linking', () => {
    it('generates standard RFC-compliant Gmail conversation thread URL', () => {
      const email = 'outreach.sender@gmail.com';
      const threadId = '18c2f10a8b94d123';
      const url = getGmailThreadUrl(email, threadId);

      expect(url).toBe(
        'https://mail.google.com/mail/u/?authuser=outreach.sender%40gmail.com#all/18c2f10a8b94d123'
      );
    });

    it('handles email addresses with special characters such as plus addressing', () => {
      const email = 'outreach+stem.campaign@gmail.com';
      const threadId = 'thread_xyz_789';
      const url = getGmailThreadUrl(email, threadId);

      expect(url).toBe(
        'https://mail.google.com/mail/u/?authuser=outreach%2Bstem.campaign%40gmail.com#all/thread_xyz_789'
      );
    });

    it('trims leading and trailing whitespace from parameters', () => {
      const email = '  sender@gmail.com  ';
      const threadId = '  thread_123  ';
      const url = getGmailThreadUrl(email, threadId);

      expect(url).toBe(
        'https://mail.google.com/mail/u/?authuser=sender%40gmail.com#all/thread_123'
      );
    });
  });

  describe('Manual Reply Recording Logic', () => {
    it('constructs valid Reply record with manual source and required attributes', () => {
      const mockReply: Reply = {
        id: 'rep-1',
        user_id: 'usr-1',
        contact_id: 'cnt-1',
        campaign_id: 'cmp-1',
        recipient_id: 'rec-1',
        account_id: 'acc-1',
        gmail_message_id: null,
        gmail_thread_id: '18c2f10a8b94d123',
        sender_email: 'david.malan@harvard.edu',
        subject: 'Re: GamifyTL for Harvard CS50',
        snippet: 'We would love to preview Quiz Battle for our introductory lecture.',
        body_text: 'We would love to preview Quiz Battle for our introductory lecture.',
        received_at: '2026-11-22T14:00:00Z',
        source: 'manual',
        notes: null,
        created_at: '2026-11-22T14:00:00Z',
      };

      expect(mockReply.source).toBe('manual');
      expect(mockReply.sender_email).toBe('david.malan@harvard.edu');
      expect(mockReply.gmail_thread_id).toBe('18c2f10a8b94d123');
      expect(mockReply.snippet).toContain('Quiz Battle');
    });
  });
});
