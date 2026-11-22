/**
 * Professional Email Template Definitions for GamifyTL Outreach.
 * Covers 20 academic scenarios, Section 508 accessibility,
 * Plain-Text & Branded HTML formats, and Custom Template Management.
 */

import type { Contact } from './database.types';

export type TemplateFormat = 'plain' | 'html';

export type TemplateStatus = 'published' | 'draft' | 'archived';

export type TemplateCategory =
  | 'general'
  | 'engagement'
  | 'participation'
  | 'quizzes'
  | 'active_learning'
  | 'large_lectures'
  | 'hybrid_online'
  | 'stem'
  | 'business'
  | 'language'
  | 'collaboration'
  | 'visual_learning'
  | 'resource_drop'
  | 'zero_install'
  | 'free_plan'
  | 'pilot'
  | 'feedback'
  | 'department'
  | 'workshop'
  | 'follow_up'
  | 'custom';

export interface ProfessionalTemplate {
  id: string;
  name: string;
  scenarioNumber: number;
  category: TemplateCategory;
  purpose: string;
  targetAudience: string;
  suitableDisciplines: string[];
  whenToUse: string;
  personalizationRequirements: string[];
  subjectAlternatives: [string, string, string];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  ctaLabel: string;
  ctaUrl: string;
  signature: string;
  followUpApproach: string;
  format: TemplateFormat;
  status: TemplateStatus;
  isSystem: boolean;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateFilterOptions {
  searchQuery: string;
  category: string;
  discipline: string;
  format: 'all' | 'plain' | 'html';
  statusTab: 'all' | 'gamifytl' | 'my_templates' | 'drafts' | 'archived';
}

export interface SampleProfessorContext {
  first_name: string;
  last_name: string;
  full_name: string;
  institution: string;
  department: string;
  designation: string;
  country: string;
  email: string;
}
