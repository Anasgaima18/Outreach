import { describe, it, expect } from 'vitest';
import {
  findMatchingTemplateCandidates,
  matchAndRandomizeTemplate,
  matchAndRandomizeBatch,
} from '../../src/lib/dynamic-template-matcher';
import type { Contact } from '../../src/types/database.types';

describe('Dynamic Template Matcher & Randomizer Unit Tests', () => {
  const csProfessor: Contact = {
    id: 'contact-cs-1',
    user_id: '00000000-0000-0000-0000-000000000000',
    first_name: 'David',
    last_name: 'Malan',
    full_name: 'David Malan',
    email: 'malan@harvard.edu',
    institution: 'Harvard University',
    department: 'Computer Science',
    academic_role: 'Professor of the Practice',
    notes: 'Teaches large lecture intro course with 800 students',
    country: 'United States',
    website: 'https://cs50.harvard.edu',
    status: 'active',
    contact_source: 'manual',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const businessProfessor: Contact = {
    id: 'contact-biz-1',
    user_id: '00000000-0000-0000-0000-000000000000',
    first_name: 'Clayton',
    last_name: 'Christensen',
    full_name: 'Clayton Christensen',
    email: 'cchristensen@hbs.edu',
    institution: 'Harvard Business School',
    department: 'Business Administration',
    academic_role: 'Professor of Management',
    notes: 'Focuses on disruptive innovation case studies and executive MBA seminars',
    country: 'United States',
    website: null,
    status: 'active',
    contact_source: 'manual',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const departmentChair: Contact = {
    id: 'contact-chair-1',
    user_id: '00000000-0000-0000-0000-000000000000',
    first_name: 'Elena',
    last_name: 'Rostova',
    full_name: 'Elena Rostova',
    email: 'erostova@oxford.ac.uk',
    institution: 'University of Oxford',
    department: 'Faculty of Linguistics',
    academic_role: 'Department Chair & Professor',
    notes: 'Oversees faculty curriculum updates and tech adoption',
    country: 'United Kingdom',
    website: null,
    status: 'active',
    contact_source: 'manual',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  describe('Discipline & Context Candidate Matching', () => {
    it('identifies STEM and Engineering candidates for Computer Science faculty', () => {
      const { templateIds, primaryReason } = findMatchingTemplateCandidates(csProfessor);

      expect(templateIds).toContain('gtl_08_stem_engineering');
      expect(templateIds).toContain('gtl_13_resource_drop');
      expect(templateIds).toContain('gtl_06_large_lectures');
      expect(primaryReason).toBeDefined();
    });

    it('identifies Business and Case Study candidates for Business school faculty', () => {
      const { templateIds, primaryReason } = findMatchingTemplateCandidates(businessProfessor);

      expect(templateIds).toContain('gtl_09_business_management');
      expect(templateIds).toContain('gtl_04_live_quizzes');
      expect(primaryReason).toContain('Business');
    });

    it('identifies Department Overview and Leadership candidates for Department Chairs', () => {
      const { templateIds, primaryReason } = findMatchingTemplateCandidates(departmentChair);

      expect(templateIds).toContain('gtl_18_department_intro');
      expect(primaryReason).toContain('Leadership');
    });
  });

  describe('Randomization & Subject Line Cycling', () => {
    it('picks a valid template from candidate pool and populates all fields', () => {
      const match = matchAndRandomizeTemplate(csProfessor, { format: 'plain' });

      expect(match.templateId).toBeDefined();
      expect(match.subject).toBeDefined();
      expect(match.bodyText).toBeDefined();
      expect(match.bodyText.length).toBeGreaterThan(50);
      expect([0, 1, 2]).toContain(match.subjectAlternativeIndex);
    });

    it('cycles subject lines across different salt iterations for the same contact', () => {
      const matchA = matchAndRandomizeTemplate(csProfessor, { salt: 1 });
      const matchB = matchAndRandomizeTemplate(csProfessor, { salt: 7 });

      // Over varying salts, valid templates and alternative subjects are chosen
      expect(matchA.subject).toBeDefined();
      expect(matchB.subject).toBeDefined();
    });

    it('cleanly resolves subject lines without un-interpolated {{department}} tags for general faculty', () => {
      const generalFaculty: Contact = {
        id: 'contact-anas-1',
        user_id: '00000000-0000-0000-0000-000000000000',
        first_name: 'Mohammed',
        last_name: 'Anas',
        full_name: 'Mohammed Anas',
        email: 'anas@gmail.com',
        institution: null,
        department: null,
        academic_role: 'General Faculty',
        notes: null,
        country: null,
        website: null,
        status: 'active',
        contact_source: 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const match = matchAndRandomizeTemplate(generalFaculty, { format: 'plain' });
      expect(match.subject).not.toContain('{{department}}');
      expect(match.subject).not.toContain('{{institution}}');
      expect(match.subject).not.toContain('your your department');
      expect(match.bodyText).not.toContain('{{department}}');
      expect(match.bodyText).not.toContain('{{last_name}}');
      expect(match.bodyText).toContain('Dear Professor Anas,');
    });
  });

  describe('Batch Matching & Distribution Across Cohorts', () => {
    it('generates a rich multi-template distribution for a batch of professors', () => {
      const cohort: Contact[] = [
        csProfessor,
        businessProfessor,
        departmentChair,
        {
          ...csProfessor,
          id: 'contact-cs-2',
          email: 'linus@helsinki.fi',
          full_name: 'Linus Torvalds',
          department: 'Computer Science',
        },
        {
          ...businessProfessor,
          id: 'contact-biz-2',
          email: 'michael.porter@hbs.edu',
          full_name: 'Michael Porter',
          department: 'Strategy & Economics',
        },
      ];

      const batch = matchAndRandomizeBatch(cohort, { format: 'plain' });

      expect(Object.keys(batch.assignments)).toHaveLength(5);
      expect(batch.uniqueSubjectLinesCount).toBeGreaterThan(1);
      expect(batch.scenarioBreakdown.length).toBeGreaterThan(1);
    });
  });
});
