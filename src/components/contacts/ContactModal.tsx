import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import type { Contact, ContactStatus } from '../../types/database.types';
import { validateEmailFormat } from '../../hooks/useContacts';

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  onSave: (contactData: Partial<Contact>) => Promise<{ success: boolean; error?: string }>;
}

export function ContactModal({ open, onOpenChange, contact, onSave }: ContactModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [department, setDepartment] = useState('');
  const [academicRole, setAcademicRole] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ContactStatus>('active');

  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (contact) {
      setFirstName(contact.first_name || '');
      setLastName(contact.last_name || '');
      setEmail(contact.email || '');
      setInstitution(contact.institution || '');
      setDepartment(contact.department || '');
      setAcademicRole(contact.academic_role || '');
      setCountry(contact.country || '');
      setWebsite(contact.website || '');
      setNotes(contact.notes || '');
      setStatus(contact.status || 'active');
    } else {
      setFirstName('');
      setLastName('');
      setEmail('');
      setInstitution('');
      setDepartment('');
      setAcademicRole('');
      setCountry('');
      setWebsite('');
      setNotes('');
      setStatus('active');
    }
    setEmailError(null);
    setSubmitError(null);
  }, [contact, open]);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (val.trim() && !validateEmailFormat(val.trim())) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setEmailError('Email address is required');
      return;
    }

    if (!validateEmailFormat(cleanEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const payload: Partial<Contact> = {
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      email: cleanEmail.toLowerCase(),
      institution: institution.trim() || null,
      department: department.trim() || null,
      academic_role: academicRole.trim() || null,
      country: country.trim() || null,
      website: website.trim() || null,
      notes: notes.trim() || null,
      status,
    };

    const res = await onSave(payload);
    setSubmitting(false);

    if (res.success) {
      onOpenChange(false);
    } else {
      setSubmitError(res.error || 'Failed to save contact');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="lg" onClose={() => onOpenChange(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{contact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
            <DialogDescription>
              {contact
                ? 'Update contact details or outreach status.'
                : 'Enter contact details or any email address (personal, corporate, or academic) to include in campaigns.'}
            </DialogDescription>
          </DialogHeader>

          {submitError && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 font-medium border border-red-200">
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="First Name"
              placeholder="e.g. David"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              label="Last Name"
              placeholder="e.g. Malan"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <Input
            label="Email Address"
            type="email"
            required
            placeholder="e.g. name@university.edu or contact@gmail.com"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            error={emailError || undefined}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="University / Institution"
              placeholder="e.g. Harvard University"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
            <Input
              label="Department"
              placeholder="e.g. Computer Science"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Academic Role / Title"
              placeholder="e.g. Professor of the Practice"
              value={academicRole}
              onChange={(e) => setAcademicRole(e.target.value)}
            />
            <Input
              label="Country"
              placeholder="e.g. United States"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Academic Website / Lab URL"
              placeholder="https://..."
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
            <Select
              label="Contact Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ContactStatus)}
            >
              <option value="active">Active (Available for outreach)</option>
              <option value="contacted">Contacted (Campaign sent)</option>
              <option value="replied">Replied (Engaged)</option>
              <option value="unsubscribed">Unsubscribed (Opted out)</option>
              <option value="bounced">Bounced (Delivery failed)</option>
              <option value="suppressed">Suppressed</option>
            </Select>
          </div>

          <Textarea
            label="Outreach Notes & Research"
            placeholder="e.g. Teaches 800 students in introductory computer science; expressed interest in smartphone engagement."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : contact ? 'Save Changes' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
