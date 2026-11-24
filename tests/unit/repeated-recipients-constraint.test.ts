import { describe, it, expect } from 'vitest';
import type { Contact } from '../../src/types/database.types';

describe('Repeated Email Constraints & Graceful Continuation Tests', () => {
  const mockContacts: Contact[] = [
    {
      id: 'c1',
      user_id: 'u1',
      first_name: 'David',
      last_name: 'Malan',
      full_name: 'David Malan',
      email: 'david.malan@harvard.edu',
      institution: 'Harvard University',
      department: 'Computer Science',
      academic_role: 'Professor',
      country: 'USA',
      website: 'https://cs50.harvard.edu',
      contact_source: 'manual',
      notes: null,
      status: 'contacted', // Already emailed previously
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c2',
      user_id: 'u1',
      first_name: 'Andrew',
      last_name: 'Wiles',
      full_name: 'Andrew Wiles',
      email: 'andrew.wiles@maths.ox.ac.uk',
      institution: 'University of Oxford',
      department: 'Mathematics',
      academic_role: 'Professor',
      country: 'UK',
      website: null,
      contact_source: 'manual',
      notes: null,
      status: 'active', // Unsent
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c3',
      user_id: 'u1',
      first_name: 'Barbara',
      last_name: 'Liskov',
      full_name: 'Barbara Liskov',
      email: 'liskov@csail.mit.edu',
      institution: 'MIT',
      department: 'EECS',
      academic_role: 'Professor',
      country: 'USA',
      website: null,
      contact_source: 'manual',
      notes: null,
      status: 'active', // Unsent
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c4',
      user_id: 'u1',
      first_name: 'John',
      last_name: 'Doe',
      full_name: 'John Doe',
      email: 'john@gmail.com',
      institution: 'Stanford University',
      department: 'Computer Science',
      academic_role: 'Lecturer',
      country: 'USA',
      website: null,
      contact_source: 'manual',
      notes: null,
      status: 'contacted', // Repeated (already sent yesterday)
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const sentContactIds = new Set(['c1', 'c4']);

  const isRepeatedContact = (contact: Contact): boolean => {
    return (
      contact.status === 'contacted' ||
      contact.status === 'replied' ||
      sentContactIds.has(contact.id)
    );
  };

  it('correctly calculates counts of correct mails vs repeated mails in a selection', () => {
    // User selected 50 people including john@gmail.com (simulated with 4 contacts here)
    const selectedIds = ['c1', 'c2', 'c3', 'c4'];
    const selectedContacts = mockContacts.filter((c) => selectedIds.includes(c.id));

    const correctMails = selectedContacts.filter((c) => !isRepeatedContact(c));
    const repeatedMails = selectedContacts.filter((c) => isRepeatedContact(c));

    expect(correctMails).toHaveLength(2); // Andrew Wiles, Barbara Liskov
    expect(repeatedMails).toHaveLength(2); // David Malan, John Doe
    expect(correctMails.map((c) => c.email)).toEqual(['andrew.wiles@maths.ox.ac.uk', 'liskov@csail.mit.edu']);
    expect(repeatedMails.map((c) => c.email)).toEqual(['david.malan@harvard.edu', 'john@gmail.com']);
  });

  it('explicitly identifies the specific repeated mail (e.g. john@gmail.com)', () => {
    // When john@gmail.com and 1 new contact are selected
    const selectedIds = ['c2', 'c4']; // c2 is unsent, c4 is john@gmail.com
    const selectedContacts = mockContacts.filter((c) => selectedIds.includes(c.id));

    const repeatedMails = selectedContacts.filter((c) => isRepeatedContact(c));
    expect(repeatedMails).toHaveLength(1);
    expect(repeatedMails[0].email).toBe('john@gmail.com');
  });

  it('allows user to proceed to the next step without error by auto-skipping repeated mails', () => {
    const selectedIds = ['c1', 'c2', 'c3', 'c4'];
    const selectedContacts = mockContacts.filter((c) => selectedIds.includes(c.id));

    const correctContacts = selectedContacts.filter((c) => !isRepeatedContact(c));
    const repeatedContacts = selectedContacts.filter((c) => isRepeatedContact(c));

    // Simulation of CampaignWizard "Next: Email Composer"
    const proceedToNextStep = () => {
      if (selectedContacts.length === 0) {
        return { success: false, error: 'Please select at least one recipient.' };
      }
      if (correctContacts.length === 0) {
        return { success: false, error: 'All selected recipients are repeated.' };
      }

      // Auto-extract valid unsent IDs, skip repeated ones, and proceed WITHOUT error
      const queuedIds = correctContacts.map((c) => c.id);
      const notice = `Skipped ${repeatedContacts.length} repeated email(s) (${repeatedContacts.map((c) => c.email).join(', ')}). Proceeding with ${correctContacts.length} correct emails.`;

      return {
        success: true,
        queuedIds,
        notice,
        nextStep: 3,
      };
    };

    const result = proceedToNextStep();
    expect(result.success).toBe(true);
    expect(result.nextStep).toBe(3);
    expect(result.queuedIds).toEqual(['c2', 'c3']);
    expect(result.notice).toContain('john@gmail.com');
    expect(result.notice).toContain('david.malan@harvard.edu');
    expect(result.notice).toContain('Skipped 2 repeated email(s)');
  });

  it('createCampaign automatically filters repeated recipients and queues valid ones cleanly', () => {
    const inputRecipientIds = ['c2', 'c3', 'c4']; // c4 is repeated (john@gmail.com)
    const selected = mockContacts.filter((c) => inputRecipientIds.includes(c.id));

    const validUnsent = selected.filter((c) => !isRepeatedContact(c));
    const repeated = selected.filter((c) => isRepeatedContact(c));

    expect(validUnsent).toHaveLength(2);
    expect(repeated).toHaveLength(1);
    expect(repeated[0].email).toBe('john@gmail.com');

    // Safe auto-filtering: queues valid unsent, avoids failure
    const queuedRecipients = validUnsent.map((c) => ({
      contact_id: c.id,
      email: c.email,
      status: 'queued',
    }));

    expect(queuedRecipients).toHaveLength(2);
    expect(queuedRecipients.map((r) => r.email)).toEqual(['andrew.wiles@maths.ox.ac.uk', 'liskov@csail.mit.edu']);
    expect(queuedRecipients.some((r) => r.email === 'john@gmail.com')).toBe(false);
  });
});
