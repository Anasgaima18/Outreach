/**
 * GamifyTL Dynamic Template Matcher & Randomizer Engine
 * 
 * Automatically analyzes professor contact metadata (department, academic role,
 * institution, notes) and matches them to the most relevant GamifyTL academic
 * templates from the 20 verified scenarios, randomizing among matching candidates
 * and cycling through 3 subject line alternatives to prevent spam clustering.
 */

import { GAMIFYTL_20_TEMPLATES } from './verified-templates';
import type { ProfessionalTemplate, TemplateFormat } from '../types/templates.types';
import type { Contact } from '../types/database.types';

export interface TemplateMatchResult {
  contactId: string;
  contactName: string;
  department: string;
  templateId: string;
  templateName: string;
  scenarioNumber: number;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  matchReason: string;
  subjectAlternativeIndex: number;
}

export interface BatchMatchSummary {
  assignments: Record<string, TemplateMatchResult>;
  templateCounts: Record<string, number>;
  scenarioBreakdown: Array<{ name: string; count: number }>;
  uniqueSubjectLinesCount: number;
}

// Keyword taxonomies for academic disciplines
const STEM_KEYWORDS = [
  'computer', 'software', 'data science', 'informatic', 'engineering', 'mechanical',
  'electrical', 'civil', 'chemical engineering', 'physics', 'math', 'calculus',
  'statistics', 'aerospace', 'robotics', 'cyber', 'artificial intelligence'
];

const BUSINESS_KEYWORDS = [
  'business', 'management', 'marketing', 'finance', 'accounting', 'economics',
  'mba', 'entrepreneur', 'strategy', 'supply chain', 'commerce', 'operations'
];

const LANGUAGE_KEYWORDS = [
  'language', 'linguistics', 'english', 'french', 'spanish', 'german', 'esl',
  'eap', 'literature', 'writing', 'composition', 'classics', 'translation'
];

const LIFE_SCIENCES_KEYWORDS = [
  'biology', 'medicine', 'medical', 'anatomy', 'physiology', 'pharmacy',
  'nursing', 'biochem', 'genetics', 'neuroscience', 'health', 'pathology'
];

const SOCIAL_SCIENCES_KEYWORDS = [
  'psychology', 'sociology', 'political science', 'politics', 'history',
  'philosophy', 'anthropology', 'law', 'legal', 'criminal justice', 'international relations'
];

const PEDAGOGY_KEYWORDS = [
  'education', 'curriculum', 'pedagogy', 'instructional', 'teaching', 'academic development'
];

const LARGE_LECTURE_KEYWORDS = [
  'large', 'auditorium', 'hall', 'introductory', '100+', '200+', 'mega', 'survey course', 'general education'
];

const ONLINE_HYBRID_KEYWORDS = [
  'online', 'hybrid', 'remote', 'distance', 'blended', 'zoom', 'virtual'
];

const LEADERSHIP_KEYWORDS = [
  'dean', 'chair', 'head', 'director', 'provost', 'vice chancellor', 'committee'
];

function textContainsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/**
 * Finds all candidate template IDs that match the contact's profile.
 */
export function findMatchingTemplateCandidates(contact: Partial<Contact>): {
  templateIds: string[];
  primaryReason: string;
} {
  const dept = contact.department || '';
  const role = contact.academic_role || '';
  const notes = contact.notes || '';
  const combinedContext = `${dept} ${role} ${notes}`.trim();

  const candidates: string[] = [];
  let reason = 'General Academic Engagement';

  // 1. Leadership / Department Chair check
  if (textContainsAny(role, LEADERSHIP_KEYWORDS) || textContainsAny(notes, LEADERSHIP_KEYWORDS)) {
    candidates.push('gtl_18_department_intro', 'gtl_16_innovation_pilot');
    reason = 'Academic Leadership & Department Overview';
  }

  // 2. Large Lecture detection
  if (textContainsAny(notes, LARGE_LECTURE_KEYWORDS) || textContainsAny(role, ['lecturer', 'coordinator'])) {
    candidates.push('gtl_06_large_lectures', 'gtl_02_classroom_engagement');
    if (!reason.includes('Leadership')) reason = 'Large Auditorium & Class Engagement';
  }

  // 3. Online / Hybrid detection
  if (textContainsAny(notes, ONLINE_HYBRID_KEYWORDS) || textContainsAny(dept, ONLINE_HYBRID_KEYWORDS)) {
    candidates.push('gtl_07_hybrid_online');
    if (!reason.includes('Leadership')) reason = 'Hybrid & Online Teaching';
  }

  // 4. Discipline Matching
  if (textContainsAny(combinedContext, STEM_KEYWORDS)) {
    candidates.push('gtl_08_stem_engineering', 'gtl_13_resource_drop', 'gtl_04_live_quizzes', 'gtl_11_collaborative_problems');
    if (reason === 'General Academic Engagement') reason = 'STEM & Engineering Practice';
  } else if (textContainsAny(combinedContext, BUSINESS_KEYWORDS)) {
    candidates.push('gtl_09_business_management', 'gtl_04_live_quizzes');
    if (reason === 'General Academic Engagement') reason = 'Business, Case Studies & Polling';
  } else if (textContainsAny(combinedContext, LANGUAGE_KEYWORDS)) {
    candidates.push('gtl_10_language_vocabulary', 'gtl_03_student_participation');
    if (reason === 'General Academic Engagement') reason = 'Language & Vocabulary Learning';
  } else if (textContainsAny(combinedContext, LIFE_SCIENCES_KEYWORDS)) {
    candidates.push('gtl_12_visual_learning', 'gtl_04_live_quizzes', 'gtl_08_stem_engineering');
    if (reason === 'General Academic Engagement') reason = 'Visual Learning & Science Diagrams';
  } else if (textContainsAny(combinedContext, SOCIAL_SCIENCES_KEYWORDS)) {
    candidates.push('gtl_03_student_participation', 'gtl_02_classroom_engagement');
    if (reason === 'General Academic Engagement') reason = 'Active Discussion & Participation';
  } else if (textContainsAny(combinedContext, PEDAGOGY_KEYWORDS)) {
    candidates.push('gtl_05_active_learning', 'gtl_17_faculty_feedback', 'gtl_16_innovation_pilot');
    if (reason === 'General Academic Engagement') reason = 'Pedagogical Innovation & Active Learning';
  }

  // 5. Always include high-performing universal fallbacks for natural randomization
  candidates.push('gtl_01_general_intro', 'gtl_02_classroom_engagement', 'gtl_14_no_installation', 'gtl_15_free_plan_intro');

  // De-duplicate candidate list
  const uniqueCandidateIds = Array.from(new Set(candidates));

  return {
    templateIds: uniqueCandidateIds,
    primaryReason: reason,
  };
}

/**
 * Matches a single contact and picks a randomized candidate template and subject line alternative.
 */
export function matchAndRandomizeTemplate(
  contact: Contact,
  options?: {
    format?: TemplateFormat;
    preferredSubjectIndex?: number;
    salt?: number;
  }
): TemplateMatchResult {
  const format = options?.format || 'plain';
  const { templateIds, primaryReason } = findMatchingTemplateCandidates(contact);

  // Map IDs to template objects
  const availableTemplates = GAMIFYTL_20_TEMPLATES.filter((t) => templateIds.includes(t.id));
  const pool = availableTemplates.length > 0 ? availableTemplates : GAMIFYTL_20_TEMPLATES;

  // Pseudo-random selection based on contact ID string + salt for deterministic re-rolls
  let hash = 0;
  const seedString = `${contact.id || contact.email}_${options?.salt || 0}`;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);

  const selectedTemplate = pool[positiveHash % pool.length];

  // Subject line alternative index (0, 1, or 2)
  const subjectIndex =
    options?.preferredSubjectIndex !== undefined && options.preferredSubjectIndex >= 0 && options.preferredSubjectIndex <= 2
      ? options.preferredSubjectIndex
      : (positiveHash >> 2) % 3;

  const subject = selectedTemplate.subjectAlternatives[subjectIndex] || selectedTemplate.subject;
  const bodyText = selectedTemplate.bodyText;
  const bodyHtml = format === 'html' ? selectedTemplate.bodyHtml : undefined;

  return {
    contactId: contact.id,
    contactName: contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email,
    department: contact.department || 'General Faculty',
    templateId: selectedTemplate.id,
    templateName: selectedTemplate.name,
    scenarioNumber: selectedTemplate.scenarioNumber,
    subject,
    bodyText,
    bodyHtml,
    matchReason: primaryReason,
    subjectAlternativeIndex: subjectIndex,
  };
}

/**
 * Matches and randomizes templates across a list of contacts with summary metrics.
 */
export function matchAndRandomizeBatch(
  contacts: Contact[],
  options?: {
    format?: TemplateFormat;
    salt?: number;
  }
): BatchMatchSummary {
  const assignments: Record<string, TemplateMatchResult> = {};
  const templateCounts: Record<string, number> = {};
  const uniqueSubjects = new Set<string>();

  contacts.forEach((contact, idx) => {
    // Add idx to salt for natural distribution across the list
    const assignment = matchAndRandomizeTemplate(contact, {
      format: options?.format || 'plain',
      salt: (options?.salt || 0) + idx,
    });
    assignments[contact.id] = assignment;

    templateCounts[assignment.templateName] = (templateCounts[assignment.templateName] || 0) + 1;
    uniqueSubjects.add(assignment.subject);
  });

  const scenarioBreakdown = Object.entries(templateCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    assignments,
    templateCounts,
    scenarioBreakdown,
    uniqueSubjectLinesCount: uniqueSubjects.size,
  };
}
