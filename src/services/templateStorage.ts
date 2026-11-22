/**
 * Template Storage & Management Service
 * Manages the 20 official GamifyTL templates and user-created custom templates,
 * drafts, and archived templates with LocalStorage persistence.
 * Protects system templates from accidental overwrites.
 */

import { GAMIFYTL_20_TEMPLATES } from '../lib/verified-templates';
import type { ProfessionalTemplate, TemplateStatus } from '../types/templates.types';

const STORAGE_CUSTOM_KEY = 'gamifytl_custom_templates_v2';

/**
 * Loads all custom templates from local storage.
 */
export function getStoredCustomTemplates(): ProfessionalTemplate[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = localStorage.getItem(STORAGE_CUSTOM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error loading custom templates:', err);
    return [];
  }
}

/**
 * Persists custom templates array to local storage.
 */
export function saveCustomTemplates(templates: ProfessionalTemplate[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(templates));
  } catch (err) {
    console.error('Error saving custom templates:', err);
  }
}

/**
 * Retrieves all templates combined: the 20 official GamifyTL system templates
 * plus user-created custom templates, drafts, and archived templates.
 */
export function getAllTemplates(): ProfessionalTemplate[] {
  const custom = getStoredCustomTemplates();
  return [...GAMIFYTL_20_TEMPLATES, ...custom];
}

/**
 * Creates a brand new custom template from scratch.
 */
export function createCustomTemplate(input: {
  name: string;
  purpose: string;
  category: ProfessionalTemplate['category'];
  subject: string;
  subjectAlternatives?: [string, string, string];
  bodyText: string;
  bodyHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  format?: 'plain' | 'html';
  status?: TemplateStatus;
  suitableDisciplines?: string[];
  whenToUse?: string;
  followUpApproach?: string;
}): ProfessionalTemplate {
  const custom = getStoredCustomTemplates();
  const now = new Date().toISOString();
  const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newTemplate: ProfessionalTemplate = {
    id,
    name: input.name.trim(),
    scenarioNumber: 100 + custom.length + 1,
    category: input.category || 'custom',
    purpose: input.purpose.trim() || 'Custom educator outreach template',
    targetAudience: 'University faculty & educators',
    suitableDisciplines: input.suitableDisciplines || ['Multidisciplinary'],
    whenToUse: input.whenToUse || 'Direct educator communication',
    personalizationRequirements: ['{{first_name}}', '{{last_name}}', '{{institution}}'],
    subjectAlternatives: input.subjectAlternatives || [
      input.subject.trim(),
      `Follow-up regarding ${input.subject.trim()}`,
      `Quick note: ${input.subject.trim()}`,
    ],
    subject: input.subject.trim(),
    bodyText: input.bodyText.trim(),
    bodyHtml: input.bodyHtml?.trim() || undefined,
    ctaLabel: input.ctaLabel || 'Learn More',
    ctaUrl: input.ctaUrl || 'https://gamifytl.com/',
    signature: 'Academic Outreach Team\nNorthNode Technologies · GamifyTL\nsupport@northnode.live',
    followUpApproach: input.followUpApproach || 'Follow up politely after 4 business days.',
    format: input.format || 'plain',
    status: input.status || 'published',
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  };

  custom.unshift(newTemplate);
  saveCustomTemplates(custom);
  return newTemplate;
}

/**
 * Updates an existing custom template. System templates cannot be directly overwritten.
 */
export function updateCustomTemplate(
  id: string,
  updates: Partial<ProfessionalTemplate>
): { success: boolean; error?: string } {
  // Guard: Protect system templates
  if (GAMIFYTL_20_TEMPLATES.some((t) => t.id === id)) {
    return {
      success: false,
      error: 'GamifyTL official templates are protected. Use "Duplicate" to customize your own version.',
    };
  }

  const custom = getStoredCustomTemplates();
  const index = custom.findIndex((t) => t.id === id);
  if (index === -1) {
    return { success: false, error: 'Custom template not found' };
  }

  custom[index] = {
    ...custom[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveCustomTemplates(custom);
  return { success: true };
}

/**
 * Duplicates any template (system or custom) to create an editable user copy.
 */
export function duplicateTemplateById(templateId: string, customName?: string): ProfessionalTemplate {
  const all = getAllTemplates();
  const source = all.find((t) => t.id === templateId) || GAMIFYTL_20_TEMPLATES[0];

  const custom = getStoredCustomTemplates();
  const now = new Date().toISOString();
  const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const duplicated: ProfessionalTemplate = {
    ...source,
    id,
    name: customName || `${source.name} (Copy)`,
    scenarioNumber: 200 + custom.length + 1,
    isSystem: false,
    isDefault: false,
    status: 'published',
    createdAt: now,
    updatedAt: now,
  };

  custom.unshift(duplicated);
  saveCustomTemplates(custom);
  return duplicated;
}

/**
 * Archives a custom template.
 */
export function archiveCustomTemplate(id: string): { success: boolean; error?: string } {
  return updateCustomTemplate(id, { status: 'archived' });
}

/**
 * Restores an archived custom template to published.
 */
export function restoreArchivedTemplate(id: string): { success: boolean; error?: string } {
  return updateCustomTemplate(id, { status: 'published' });
}

/**
 * Permanently deletes a custom template.
 */
export function deleteCustomTemplate(id: string): { success: boolean; error?: string } {
  if (GAMIFYTL_20_TEMPLATES.some((t) => t.id === id)) {
    return { success: false, error: 'Cannot delete official GamifyTL system templates.' };
  }

  const custom = getStoredCustomTemplates();
  const filtered = custom.filter((t) => t.id !== id);
  saveCustomTemplates(filtered);
  return { success: true };
}
