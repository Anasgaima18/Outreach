/**
 * Hook for Professor and Educator Contact Management
 * Handles CRUD operations, search, multi-filter, email validation,
 * duplicate detection, CSV import with column mapping, and CSV export.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Contact, ContactStatus } from '../types/database.types';

export interface ContactFilters {
  searchQuery: string;
  country: string;
  institution: string;
  department: string;
  status: string;
}

export interface CsvParsedResult {
  headers: string[];
  rawRows: Record<string, string>[];
}

export interface CsvValidationSummary {
  totalRows: number;
  validRows: Array<Omit<Contact, 'id' | 'created_at' | 'updated_at'>>;
  invalidRows: Array<{ rowNumber: number; raw: Record<string, string>; reason: string }>;
  duplicateRows: Array<{ rowNumber: number; email: string; existingContact?: Contact }>;
}

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;

export function validateEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Standard CSV parser handling commas, quotes, CRLF, and UTF-8 characters.
 */
export function parseCsvText(csvText: string): CsvParsedResult {
  const trimmed = csvText.trim();
  if (!trimmed) return { headers: [], rawRows: [] };

  const lines = trimmed.split(/\r?\n/);
  if (lines.length === 0 || !lines[0]) return { headers: [], rawRows: [] };

  // Parse header line respecting quotes
  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^["']|["']$/g, ''));
    return values;
  };

  const headers = parseLine(lines[0]);
  const rawRows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rawRows.push(row);
  }

  return { headers, rawRows };
}

/**
 * Auto-detects standard contact field mapping for a given CSV header name.
 */
export function autoMapHeader(header: string): string {
  const lower = header.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Prevent URL sources that contain 'email' (e.g. 'Email Source URL') from overriding actual email
  if (lower.includes('emailsource') || lower.includes('sourceurl')) return 'contact_source';

  // Academic Profile / Websites
  if (lower.includes('facultyprofile') || lower.includes('profileurl') || lower.includes('website')) return 'website';
  if (lower.includes('url')) return 'website';

  // Primary Email address mapping
  if (
    lower === 'email' ||
    lower === 'institutionalemail' ||
    lower.includes('emailaddress') ||
    lower.includes('primaryemail') ||
    (lower.includes('email') && !lower.includes('source'))
  ) {
    return 'email';
  }

  // Name fields
  if (lower === 'firstname' || lower === 'first') return 'first_name';
  if (lower === 'lastname' || lower === 'last') return 'last_name';
  if (lower === 'fullname' || lower === 'name') return 'full_name';

  // Institutional and Academic fields
  if (lower.includes('university') || lower.includes('institution') || lower.includes('school')) return 'institution';
  if (lower.includes('department') || lower.includes('dept')) return 'department';
  if (
    lower.includes('designation') ||
    lower === 'role' ||
    lower.includes('academicrole') ||
    lower.includes('academicdesignation') ||
    lower.includes('title')
  ) {
    return 'academic_role';
  }

  if (lower.includes('country')) return 'country';

  // Personalization Relevance and Notes
  if (lower.includes('relevance') || lower.includes('notes') || lower.includes('note')) return 'notes';

  // Contact Source / Directory reference
  if (lower.includes('source') || lower.includes('directory')) return 'contact_source';

  return '';
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ContactFilters>({
    searchQuery: '',
    country: 'all',
    institution: 'all',
    department: 'all',
    status: 'all',
  });

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setContacts(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch contacts';
      console.error('fetchContacts error:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  /**
   * Filtered contacts derived from active filters
   */
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // Search query
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase().trim();
        const matchesName = c.full_name?.toLowerCase().includes(q);
        const matchesEmail = c.email?.toLowerCase().includes(q);
        const matchesInst = c.institution?.toLowerCase().includes(q);
        const matchesDept = c.department?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesInst && !matchesDept) {
          return false;
        }
      }

      // Country filter
      if (filters.country !== 'all' && c.country !== filters.country) {
        return false;
      }

      // Institution filter
      if (filters.institution !== 'all' && c.institution !== filters.institution) {
        return false;
      }

      // Department filter
      if (filters.department !== 'all' && c.department !== filters.department) {
        return false;
      }

      // Status filter
      if (filters.status !== 'all' && c.status !== filters.status) {
        return false;
      }

      return true;
    });
  }, [contacts, filters]);

  /**
   * Distinct filter options
   */
  const distinctOptions = useMemo(() => {
    const countries = Array.from(new Set(contacts.map((c) => c.country).filter(Boolean))) as string[];
    const institutions = Array.from(new Set(contacts.map((c) => c.institution).filter(Boolean))) as string[];
    const departments = Array.from(new Set(contacts.map((c) => c.department).filter(Boolean))) as string[];
    return {
      countries: countries.sort(),
      institutions: institutions.sort(),
      departments: departments.sort(),
    };
  }, [contacts]);

  /**
   * Add a new contact with email validation & duplicate checking
   */
  const addContact = async (
    contactData: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'user_id'> & { user_id?: string }
  ): Promise<{ success: boolean; contact?: Contact; error?: string }> => {
    const cleanEmail = contactData.email.trim().toLowerCase();

    // 1. Format validation
    if (!validateEmailFormat(cleanEmail)) {
      return { success: false, error: 'Invalid email address format' };
    }

    const firstName = contactData.first_name?.trim() || '';
    const lastName = contactData.last_name?.trim() || '';
    const fullName =
      contactData.full_name?.trim() ||
      `${firstName} ${lastName}`.trim() ||
      cleanEmail.split('@')[0];

    const userId = contactData.user_id || '00000000-0000-0000-0000-000000000000';

    try {
      const { data, error: insertError } = await supabase
        .from('contacts')
        .upsert(
          {
            user_id: userId,
            first_name: firstName || null,
            last_name: lastName || null,
            full_name: fullName,
            email: cleanEmail,
            institution: contactData.institution?.trim() || null,
            department: contactData.department?.trim() || null,
            academic_role: contactData.academic_role?.trim() || null,
            country: contactData.country?.trim() || null,
            website: contactData.website?.trim() || null,
            notes: contactData.notes?.trim() || null,
            status: contactData.status || 'active',
            contact_source: contactData.contact_source || 'manual',
          },
          { onConflict: 'user_id,email' }
        )
        .select();

      if (insertError) throw insertError;
      await fetchContacts();
      const savedContact = data && data.length > 0 ? data[0] : undefined;
      return { success: true, contact: savedContact };
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        (err as { details?: string })?.details ||
        (err instanceof Error ? err.message : 'Error adding contact');
      return { success: false, error: msg };
    }
  };

  /**
   * Update an existing contact
   */
  const updateContact = async (
    id: string,
    updates: Partial<Omit<Contact, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<{ success: boolean; error?: string }> => {
    if (updates.email) {
      const cleanEmail = updates.email.trim().toLowerCase();
      if (!validateEmailFormat(cleanEmail)) {
        return { success: false, error: 'Invalid email address format' };
      }
      const duplicate = contacts.find((c) => c.id !== id && c.email.toLowerCase() === cleanEmail);
      if (duplicate) {
        return { success: false, error: `Another contact already has the email ${cleanEmail}` };
      }
      updates.email = cleanEmail;
    }

    // Recompute full_name if first_name or last_name changed
    if (updates.first_name !== undefined || updates.last_name !== undefined) {
      const current = contacts.find((c) => c.id === id);
      const first = (updates.first_name !== undefined ? updates.first_name : current?.first_name) || '';
      const last = (updates.last_name !== undefined ? updates.last_name : current?.last_name) || '';
      updates.full_name = `${first} ${last}`.trim() || current?.full_name || '';
    }

    try {
      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;
      await fetchContacts();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating contact';
      return { success: false, error: msg };
    }
  };

  /**
   * Delete contact
   */
  const deleteContact = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: delError } = await supabase.from('contacts').delete().eq('id', id);
      if (delError) throw delError;
      await fetchContacts();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting contact';
      return { success: false, error: msg };
    }
  };

  /**
   * Validate and analyze parsed CSV data against field mapping and existing DB contacts
   */
  const validateCsvRows = (
    rawRows: Record<string, string>[],
    mapping: Record<string, string>
  ): CsvValidationSummary => {
    const validRows: Array<Omit<Contact, 'id' | 'created_at' | 'updated_at'>> = [];
    const invalidRows: Array<{ rowNumber: number; raw: Record<string, string>; reason: string }> = [];
    const duplicateRows: Array<{ rowNumber: number; email: string; existingContact?: Contact }> = [];

    const seenEmailsInCsv = new Set<string>();

    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // Line 1 is header
      const mappedRow: Record<string, string> = {};

      Object.entries(mapping).forEach(([csvHeader, contactField]) => {
        if (contactField) {
          mappedRow[contactField] = (row[csvHeader] || '').trim();
        }
      });

      let email = mappedRow.email?.toLowerCase();

      // Auto-recovery: if the mapped email column is invalid (e.g., user mapped 'Email Source URL' instead of 'Institutional Email'),
      // inspect row columns for any field with a valid RFC 5322 email address
      if (!email || !validateEmailFormat(email)) {
        const emailCol = Object.keys(row).find((k) => validateEmailFormat((row[k] || '').trim()));
        if (emailCol) {
          email = (row[emailCol] || '').trim().toLowerCase();
          mappedRow.email = email;
        }
      }

      // Check required email
      if (!email) {
        invalidRows.push({ rowNumber: rowNum, raw: row, reason: 'Missing email address' });
        return;
      }

      // Check email format
      if (!validateEmailFormat(email)) {
        invalidRows.push({ rowNumber: rowNum, raw: row, reason: `Invalid email format: "${email}"` });
        return;
      }

      // Check duplicate within CSV
      if (seenEmailsInCsv.has(email)) {
        duplicateRows.push({ rowNumber: rowNum, email, existingContact: undefined });
        return;
      }
      seenEmailsInCsv.add(email);

      // Check duplicate against existing database contacts
      const existing = contacts.find((c) => c.email.toLowerCase() === email);
      if (existing) {
        duplicateRows.push({ rowNumber: rowNum, email, existingContact: existing });
        return;
      }

      let firstName = mappedRow.first_name || '';
      let lastName = mappedRow.last_name || '';
      const fullName = mappedRow.full_name || `${firstName} ${lastName}`.trim() || email.split('@')[0];

      // Automatically split full_name into first_name and last_name if missing
      if ((!firstName || !lastName) && fullName && !fullName.includes('@')) {
        let cleaned = fullName;
        const titles = ['dr.', 'prof.', 'professor', 'assoc. prof.', 'assistant professor', 'mr.', 'ms.', 'mrs.'];
        for (const t of titles) {
          if (cleaned.toLowerCase().startsWith(t)) {
            cleaned = cleaned.slice(t.length).trim();
          }
        }
        const parts = cleaned.split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
          firstName = firstName || parts[0];
          lastName = lastName || parts[0];
        } else if (parts.length >= 2) {
          firstName = firstName || parts[0];
          lastName = lastName || parts[parts.length - 1];
        }
      }

      validRows.push({
        user_id: '00000000-0000-0000-0000-000000000000',
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: fullName,
        email,
        institution: mappedRow.institution || null,
        department: mappedRow.department || null,
        academic_role: mappedRow.academic_role || null,
        country: mappedRow.country || null,
        website: mappedRow.website || null,
        notes: mappedRow.notes || null,
        status: 'active' as ContactStatus,
        contact_source: mappedRow.contact_source || 'csv_import',
      });
    });

    return {
      totalRows: rawRows.length,
      validRows,
      invalidRows,
      duplicateRows,
    };
  };

  /**
   * Bulk insert validated contacts from CSV
   */
  const importContacts = async (
    validRows: Array<Omit<Contact, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<{ success: boolean; insertedCount: number; error?: string }> => {
    if (validRows.length === 0) {
      return { success: true, insertedCount: 0 };
    }

    try {
      const { error: insertError } = await supabase
        .from('contacts')
        .upsert(validRows, { onConflict: 'user_id,email' });
      if (insertError) throw insertError;
      await fetchContacts();
      return { success: true, insertedCount: validRows.length };
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        (err instanceof Error ? err.message : 'Error importing contacts');
      return { success: false, insertedCount: 0, error: msg };
    }
  };

  /**
   * Export contacts as CSV string & trigger client-side download
   */
  const exportContactsCsv = (exportList: Contact[] = filteredContacts, filename = 'gamifytl-educator-contacts.csv') => {
    const headers = [
      'email',
      'first_name',
      'last_name',
      'full_name',
      'institution',
      'department',
      'academic_role',
      'country',
      'website',
      'status',
      'notes',
    ];

    const escapeValue = (val: string | null | undefined): string => {
      if (!val) return '""';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    };

    const csvLines = [headers.join(',')];

    exportList.forEach((c) => {
      const row = [
        escapeValue(c.email),
        escapeValue(c.first_name),
        escapeValue(c.last_name),
        escapeValue(c.full_name),
        escapeValue(c.institution),
        escapeValue(c.department),
        escapeValue(c.academic_role),
        escapeValue(c.country),
        escapeValue(c.website),
        escapeValue(c.status),
        escapeValue(c.notes),
      ];
      csvLines.push(row.join(','));
    });

    const csvContent = csvLines.join('\n');

    // Trigger browser download if in DOM environment
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    return csvContent;
  };

  return {
    contacts,
    filteredContacts,
    distinctOptions,
    filters,
    setFilters,
    loading,
    error,
    refresh: fetchContacts,
    addContact,
    updateContact,
    deleteContact,
    validateCsvRows,
    importContacts,
    exportContactsCsv,
  };
}
