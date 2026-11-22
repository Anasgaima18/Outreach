import { describe, it, expect } from 'vitest';
import {
  validateEmailFormat,
  parseCsvText,
  autoMapHeader,
} from '../../src/hooks/useContacts';

describe('Contacts Unit Tests (src/hooks/useContacts.ts)', () => {
  describe('Email Format Validation', () => {
    it('accepts valid academic and institutional email addresses', () => {
      expect(validateEmailFormat('david.malan@harvard.edu')).toBe(true);
      expect(validateEmailFormat('andrew.wiles@maths.ox.ac.uk')).toBe(true);
      expect(validateEmailFormat('prof_smith+lab@cs.stanford.edu')).toBe(true);
      expect(validateEmailFormat('juergen.schmidt@tum.de')).toBe(true);
      expect(validateEmailFormat('ines.goncalves@usp.br')).toBe(true);
      expect(validateEmailFormat('contact@gamifytl.com')).toBe(true);
    });

    it('rejects invalid email formats', () => {
      expect(validateEmailFormat('')).toBe(false);
      expect(validateEmailFormat('   ')).toBe(false);
      expect(validateEmailFormat('plainaddress')).toBe(false);
      expect(validateEmailFormat('@missing-username.com')).toBe(false);
      expect(validateEmailFormat('missing.domain@')).toBe(false);
      expect(validateEmailFormat('user@domain-without-tld')).toBe(false);
      expect(validateEmailFormat('user@.leading-dot.com')).toBe(false);
      expect(validateEmailFormat('user with space@domain.com')).toBe(false);
    });
  });

  describe('CSV Parsing Engine', () => {
    it('parses standard comma-separated lines and extracts headers and rows', () => {
      const csv = `email,first_name,last_name,institution
david.malan@harvard.edu,David,Malan,Harvard University
andrew.wiles@ox.ac.uk,Andrew,Wiles,University of Oxford`;

      const parsed = parseCsvText(csv);
      expect(parsed.headers).toEqual(['email', 'first_name', 'last_name', 'institution']);
      expect(parsed.rawRows).toHaveLength(2);
      expect(parsed.rawRows[0].email).toBe('david.malan@harvard.edu');
      expect(parsed.rawRows[0].first_name).toBe('David');
      expect(parsed.rawRows[0].institution).toBe('Harvard University');
      expect(parsed.rawRows[1].email).toBe('andrew.wiles@ox.ac.uk');
    });

    it('handles quoted fields with commas and leading/trailing whitespace', () => {
      const csv = `email,first_name,institution,notes
"elena.rostova@ethz.ch","Elena","ETH Zürich, Systems Dept","Key speaker, CS education"
"yuki.tanaka@u-tokyo.ac.jp","Yuki","University of Tokyo","Specializes in algorithms"`;

      const parsed = parseCsvText(csv);
      expect(parsed.rawRows[0].institution).toBe('ETH Zürich, Systems Dept');
      expect(parsed.rawRows[0].notes).toBe('Key speaker, CS education');
      expect(parsed.rawRows[1].institution).toBe('University of Tokyo');
    });

    it('handles empty text gracefully', () => {
      const parsed = parseCsvText('');
      expect(parsed.headers).toEqual([]);
      expect(parsed.rawRows).toEqual([]);
    });

    it('handles CRLF line breaks correctly', () => {
      const csv = "email,first_name\r\ntest@harvard.edu,David\r\ntest2@ox.ac.uk,Andrew\r\n";
      const parsed = parseCsvText(csv);
      expect(parsed.rawRows).toHaveLength(2);
      expect(parsed.rawRows[0].email).toBe('test@harvard.edu');
      expect(parsed.rawRows[0].first_name).toBe('David');
      expect(parsed.rawRows[1].first_name).toBe('Andrew');
    });
  });

  describe('Header Auto-mapping Logic', () => {
    it('accurately detects standard contact fields regardless of casing or formatting', () => {
      expect(autoMapHeader('Email')).toBe('email');
      expect(autoMapHeader('E-mail Address')).toBe('email');
      expect(autoMapHeader('First Name')).toBe('first_name');
      expect(autoMapHeader('firstname')).toBe('first_name');
      expect(autoMapHeader('Last Name')).toBe('last_name');
      expect(autoMapHeader('lastname')).toBe('last_name');
      expect(autoMapHeader('University')).toBe('institution');
      expect(autoMapHeader('Institution Name')).toBe('institution');
      expect(autoMapHeader('Department')).toBe('department');
      expect(autoMapHeader('Dept')).toBe('department');
      expect(autoMapHeader('Academic Role')).toBe('academic_role');
      expect(autoMapHeader('Designation')).toBe('academic_role');
      expect(autoMapHeader('Country')).toBe('country');
      expect(autoMapHeader('Website')).toBe('website');
      expect(autoMapHeader('Lab URL')).toBe('website');
      expect(autoMapHeader('Notes')).toBe('notes');
    });

    it('returns empty string for unrecognized columns', () => {
      expect(autoMapHeader('Random_Column_XYZ')).toBe('');
      expect(autoMapHeader('12345')).toBe('');
    });
  });
});
