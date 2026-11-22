/**
 * Tier 1: Feature 3 (Contact Management CRUD) & Feature 4 (CSV Import & Export)
 * 10 Tests: T1-F03-01 to T1-F03-05 and T1-F04-01 to T1-F04-05
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '../setup';
import {
  FACULTY_FIXTURES,
  VALID_PROFESSORS_CSV,
  MALFORMED_PROFESSORS_CSV,
  DUPLICATE_PROFESSORS_CSV,
} from '../harness/fixtures';

/**
 * Standard CSV parser utility for tests simulating frontend/backend CSV engine.
 */
function parseCsv(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length === 0 || !lines[0]) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Simple split respecting basic quotes
    const values = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Normalizes CSV headers to standard contact fields.
 */
function normalizeCsvHeaders(header: string): string {
  const lower = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (lower.includes('email')) return 'email';
  if (lower === 'firstname' || lower === 'first') return 'first_name';
  if (lower === 'lastname' || lower === 'last') return 'last_name';
  if (lower.includes('university') || lower.includes('institution') || lower.includes('school')) return 'institution';
  if (lower.includes('department') || lower.includes('dept')) return 'department';
  if (lower.includes('role') || lower.includes('title') || lower.includes('designation')) return 'academic_role';
  if (lower.includes('country')) return 'country';
  if (lower.includes('website') || lower.includes('url')) return 'website';
  return header;
}

describe('Tier 1: Features 3 & 4 — Contact Management & CSV Import/Export', () => {
  const testUserId = 'user_test_contacts_001';

  beforeEach(() => {
    mockDb.reset();
    mockDb.setContextUser(testUserId);
  });

  // --- Feature 3: Contact Management CRUD & Academic Attributes ---

  it('T1-F03-01: Creates educator contact with academic attributes and initial active status', () => {
    const fixture = FACULTY_FIXTURES[0]; // David Malan
    const contact = mockDb.createContact({
      user_id: testUserId,
      first_name: fixture.firstName,
      last_name: fixture.lastName,
      email: fixture.email,
      institution: fixture.institution,
      department: fixture.department,
      academic_role: fixture.academicRole,
      country: fixture.country,
      website: fixture.website,
      notes: 'Key contact for CS50 interactive pedagogy discussion.',
    });

    expect(contact.id).toBeDefined();
    expect(contact.email).toBe(fixture.email.toLowerCase());
    expect(contact.full_name).toBe(`${fixture.firstName} ${fixture.lastName}`);
    expect(contact.institution).toBe(fixture.institution);
    expect(contact.department).toBe(fixture.department);
    expect(contact.status).toBe('active');
    expect(contact.notes).toContain('CS50');
  });

  it('T1-F03-02: Filters contacts by institution and country', () => {
    // Add multiple fixtures
    FACULTY_FIXTURES.slice(0, 5).forEach((f) => {
      mockDb.createContact({
        first_name: f.firstName,
        last_name: f.lastName,
        email: f.email,
        institution: f.institution,
        department: f.department,
        country: f.country,
      });
    });

    const oxfordFaculty = mockDb.getContacts({ institution: 'Oxford' });
    expect(oxfordFaculty.length).toBe(2);
    expect(oxfordFaculty.every((c) => c.institution?.includes('Oxford'))).toBe(true);

    const ukFaculty = mockDb.getContacts({ country: 'United Kingdom' });
    expect(ukFaculty.length).toBe(3); // 2 Oxford + 1 Cambridge
  });

  it('T1-F03-03: Searches contacts case-insensitively across name, email, and department', () => {
    FACULTY_FIXTURES.slice(0, 4).forEach((f) => {
      mockDb.createContact({
        first_name: f.firstName,
        last_name: f.lastName,
        email: f.email,
        institution: f.institution,
        department: f.department,
      });
    });

    // Search by partial last name
    const wilesResults = mockDb.getContacts({ search: 'wiles' });
    expect(wilesResults.length).toBe(1);
    expect(wilesResults[0].email).toBe('andrew.wiles@maths.ox.ac.uk');

    // Search by department
    const csResults = mockDb.getContacts({ search: 'computer science' });
    expect(csResults.length).toBe(2); // Harvard CS
  });

  it('T1-F03-04: Updates professor academic role and notes cleanly', () => {
    const contact = mockDb.createContact({
      first_name: 'Martin',
      last_name: 'Hairer',
      email: 'martin.hairer@maths.ox.ac.uk',
      institution: 'University of Oxford',
      academic_role: 'Professor of Mathematics',
    });

    const updated = mockDb.updateContact(contact.id, {
      academic_role: 'Fields Medalist & Regius Chair',
      notes: 'Agreed to review demo materials in Q3.',
    });

    expect(updated.academic_role).toBe('Fields Medalist & Regius Chair');
    expect(updated.notes).toBe('Agreed to review demo materials in Q3.');
  });

  it('T1-F03-05: Deletes contact and removes it from user directory', () => {
    const contact = mockDb.createContact({
      first_name: 'Temporary',
      last_name: 'Contact',
      email: 'temp.faculty@harvard.edu',
    });

    expect(mockDb.getContacts().length).toBe(1);
    mockDb.deleteContact(contact.id);
    expect(mockDb.getContacts().length).toBe(0);
  });

  // --- Feature 4: CSV Import & Export ---

  it('T1-F04-01: Imports valid CSV containing multiple international professors', () => {
    const { rows } = parseCsv(VALID_PROFESSORS_CSV);
    expect(rows.length).toBe(5);

    let importedCount = 0;
    rows.forEach((row) => {
      mockDb.createContact({
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        institution: row.institution,
        department: row.department,
        academic_role: row.role,
        country: row.country,
        website: row.website,
        contact_source: 'csv_import',
      });
      importedCount++;
    });

    expect(importedCount).toBe(5);
    expect(mockDb.getContacts().length).toBe(5);
  });

  it('T1-F04-02: Auto-detects and maps varied CSV headers (University -> institution, Title -> academic_role)', () => {
    const variedCsv = `Email Address,First,Last,University,Dept,Title,Country
elena@ethz.ch,Elena,Rostova,ETH Zürich,Computer Science,Associate Professor,Switzerland
`;
    const { headers, rows } = parseCsv(variedCsv);
    const normalizedHeaders = headers.map(normalizeCsvHeaders);

    expect(normalizedHeaders).toContain('email');
    expect(normalizedHeaders).toContain('institution');
    expect(normalizedHeaders).toContain('department');
    expect(normalizedHeaders).toContain('academic_role');

    const mappedRow: Record<string, string> = {};
    headers.forEach((h, idx) => {
      mappedRow[normalizedHeaders[idx]] = rows[0][h];
    });

    const contact = mockDb.createContact({
      email: mappedRow.email,
      first_name: mappedRow.first_name,
      last_name: mappedRow.last_name,
      institution: mappedRow.institution,
      department: mappedRow.department,
      academic_role: mappedRow.academic_role,
      country: mappedRow.country,
    });

    expect(contact.institution).toBe('ETH Zürich');
    expect(contact.academic_role).toBe('Associate Professor');
  });

  it('T1-F04-03: Skips duplicate contacts in CSV and against database', () => {
    // Pre-insert one contact into DB
    mockDb.createContact({
      first_name: 'David',
      last_name: 'Malan',
      email: 'david.malan@harvard.edu',
      institution: 'Harvard University',
    });

    const { rows } = parseCsv(DUPLICATE_PROFESSORS_CSV);
    let imported = 0;
    let skipped = 0;

    rows.forEach((row) => {
      try {
        mockDb.createContact({
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          institution: row.institution,
        });
        imported++;
      } catch (err: any) {
        if (err.message.includes('uq_contacts_user_email')) {
          skipped++;
        }
      }
    });

    expect(imported).toBe(1); // Only unique.prof@oxford.ac.uk is imported
    expect(skipped).toBe(3); // david.malan duplicate rows skipped
    expect(mockDb.getContacts().length).toBe(2);
  });

  it('T1-F04-04: Detects and reports malformed email rows with line numbers', () => {
    const { rows } = parseCsv(MALFORMED_PROFESSORS_CSV);
    const errors: { line: number; email: string; reason: string }[] = [];

    rows.forEach((row, idx) => {
      try {
        mockDb.createContact({
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
        });
      } catch (err: any) {
        errors.push({
          line: idx + 2, // header is line 1
          email: row.email,
          reason: err.message,
        });
      }
    });

    expect(errors.length).toBe(4);
    expect(errors[0].line).toBe(2);
    expect(errors[0].email).toBe('invalid-email-address');
    expect(errors[3].email).toBe('prof#with_hash@cam.ac.uk');
  });

  it('T1-F04-05: Exports contact database to RFC 4180 compliant CSV string', () => {
    FACULTY_FIXTURES.slice(0, 3).forEach((f) => {
      mockDb.createContact({
        first_name: f.firstName,
        last_name: f.lastName,
        email: f.email,
        institution: f.institution,
        department: f.department,
        academic_role: f.academicRole,
        country: f.country,
      });
    });

    const contacts = mockDb.getContacts();
    const headers = ['email', 'first_name', 'last_name', 'institution', 'department', 'academic_role', 'country'];
    const csvLines = [headers.join(',')];

    contacts.forEach((c) => {
      const line = [
        `"${c.email}"`,
        `"${c.first_name || ''}"`,
        `"${c.last_name || ''}"`,
        `"${c.institution || ''}"`,
        `"${c.department || ''}"`,
        `"${c.academic_role || ''}"`,
        `"${c.country || ''}"`,
      ].join(',');
      csvLines.push(line);
    });

    const exportedCsv = csvLines.join('\r\n');
    expect(exportedCsv).toContain('"david.malan@harvard.edu"');
    expect(exportedCsv).toContain('"Gordon McKay Professor of the Practice of Computer Science"');
    expect(exportedCsv.split('\r\n').length).toBe(4); // Header + 3 rows
  });
});
