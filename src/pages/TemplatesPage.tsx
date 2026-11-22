import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Sparkles,
  BookOpen,
  Lock,
  Archive,
  CheckCircle2,
  Send,
  Layers,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { TemplateCard } from '../components/templates/TemplateCard';
import { TemplateDetailModal } from '../components/templates/TemplateDetailModal';
import { TemplateEditorModal } from '../components/templates/TemplateEditorModal';
import {
  getAllTemplates,
  createCustomTemplate,
  updateCustomTemplate,
  duplicateTemplateById,
  archiveCustomTemplate,
  restoreArchivedTemplate,
  deleteCustomTemplate,
} from '../services/templateStorage';
import type { ProfessionalTemplate } from '../types/templates.types';

interface TemplatesPageProps {
  onSelectForCampaign?: (template: ProfessionalTemplate) => void;
}

export function TemplatesPage({ onSelectForCampaign }: TemplatesPageProps) {
  const [templates, setTemplates] = useState<ProfessionalTemplate[]>(() => getAllTemplates());
  const [activeTab, setActiveTab] = useState<'all' | 'gamifytl' | 'my_templates' | 'drafts' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState<'all' | 'plain' | 'html'>('all');

  // Modal states
  const [previewTemplate, setPreviewTemplate] = useState<ProfessionalTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ProfessionalTemplate | null>(null);
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const refreshTemplates = () => {
    setTemplates(getAllTemplates());
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Distinct disciplines for filter dropdown
  const allDisciplines = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => t.suitableDisciplines?.forEach((d) => set.add(d)));
    return Array.from(set).sort();
  }, [templates]);

  // Tab counts
  const counts = useMemo(() => {
    return {
      all: templates.filter((t) => t.status !== 'archived').length,
      gamifytl: templates.filter((t) => t.isSystem && t.status !== 'archived').length,
      my_templates: templates.filter((t) => !t.isSystem && t.status === 'published').length,
      drafts: templates.filter((t) => !t.isSystem && t.status === 'draft').length,
      archived: templates.filter((t) => t.status === 'archived').length,
    };
  }, [templates]);

  // Filtered templates derived from active tab and search
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      // 1. Tab filter
      if (activeTab === 'all') {
        if (t.status === 'archived') return false;
      } else if (activeTab === 'gamifytl') {
        if (!t.isSystem || t.status === 'archived') return false;
      } else if (activeTab === 'my_templates') {
        if (t.isSystem || t.status !== 'published') return false;
      } else if (activeTab === 'drafts') {
        if (t.isSystem || t.status !== 'draft') return false;
      } else if (activeTab === 'archived') {
        if (t.status !== 'archived') return false;
      }

      // 2. Format filter
      if (selectedFormat !== 'all' && t.format !== selectedFormat) {
        return false;
      }

      // 3. Discipline filter
      if (selectedDiscipline !== 'all') {
        if (!t.suitableDisciplines.includes(selectedDiscipline)) return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesSubject = t.subject.toLowerCase().includes(q);
        const matchesPurpose = t.purpose.toLowerCase().includes(q);
        const matchesBody = t.bodyText.toLowerCase().includes(q);
        const matchesDiscipline = t.suitableDisciplines.some((d) => d.toLowerCase().includes(q));
        if (!matchesName && !matchesSubject && !matchesPurpose && !matchesBody && !matchesDiscipline) {
          return false;
        }
      }

      return true;
    });
  }, [templates, activeTab, selectedFormat, selectedDiscipline, searchQuery]);

  // Handlers
  const handleDuplicate = (template: ProfessionalTemplate) => {
    const copy = duplicateTemplateById(template.id);
    refreshTemplates();
    showToast(`Duplicated "${template.name}" into My Templates!`);
  };

  const handleEdit = (template: ProfessionalTemplate) => {
    setEditingTemplate(template);
    setEditorModalOpen(true);
  };

  const handleArchive = (template: ProfessionalTemplate) => {
    archiveCustomTemplate(template.id);
    refreshTemplates();
    showToast(`Archived "${template.name}".`);
  };

  const handleDelete = (template: ProfessionalTemplate) => {
    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
      deleteCustomTemplate(template.id);
      refreshTemplates();
      showToast(`Deleted custom template.`);
    }
  };

  const handleSaveEditor = (data: any) => {
    if (editingTemplate) {
      updateCustomTemplate(editingTemplate.id, data);
      showToast(`Updated "${data.name}" successfully!`);
    } else {
      createCustomTemplate(data);
      showToast(`Created new template "${data.name}"!`);
    }
    refreshTemplates();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-gray-900">
              Email Template System
            </h2>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800 uppercase">
              20 Scenarios Verified
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Research-backed academic outreach templates crafted exclusively for professors, lecturers, and educators.
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingTemplate(null);
            setEditorModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs shrink-0"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Create Your Own Template
        </Button>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {toastMessage}
          </span>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* 5 Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-px">
        <div className="flex flex-wrap gap-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            All Templates
            <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.2 text-[10px] font-bold text-gray-600">
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gamifytl')}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === 'gamifytl'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            GamifyTL Official (20)
            <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-800">
              {counts.gamifytl}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('my_templates')}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === 'my_templates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            My Templates
            <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
              {counts.my_templates}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('drafts')}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === 'drafts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Drafts
            <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
              {counts.drafts}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('archived')}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === 'archived'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Archived
            <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.2 text-[10px] font-bold text-gray-600">
              {counts.archived}
            </span>
          </button>
        </div>

        {/* Deliverability Badge */}
        <div className="text-[11px] text-gray-500 flex items-center gap-1.5 pb-2 sm:pb-0">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          <span>Section 508 & RFC 2822 Compliant</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates by scenario, discipline, subject, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-gray-50/50 pl-9 pr-4 py-1.5 text-xs focus:border-blue-500 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Discipline Selector */}
          <select
            value={selectedDiscipline}
            onChange={(e) => setSelectedDiscipline(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Disciplines</option>
            {allDisciplines.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Format Selector */}
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value as any)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Formats</option>
            <option value="plain">✉️ Plain-Text</option>
            <option value="html">🎨 Branded HTML</option>
          </select>

          {(searchQuery || selectedDiscipline !== 'all' || selectedFormat !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedDiscipline('all');
                setSelectedFormat('all');
              }}
              className="text-xs text-gray-500 h-8"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <FileText className="h-6 w-6" />
          </div>
          <h4 className="text-base font-bold text-gray-900">No Templates Found</h4>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {activeTab === 'my_templates'
              ? 'You have not created any custom templates yet. Click "Create Your Own Template" to start from scratch or duplicate any official template.'
              : activeTab === 'drafts'
              ? 'No templates currently saved as drafts.'
              : activeTab === 'archived'
              ? 'No templates in your archive.'
              : 'No templates match your active filters or search terms.'}
          </p>
          {activeTab === 'my_templates' && (
            <Button
              size="sm"
              onClick={() => {
                setEditingTemplate(null);
                setEditorModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs mt-2"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Create First Custom Template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={(t) => setPreviewTemplate(t)}
              onDuplicate={handleDuplicate}
              onEdit={handleEdit}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onSelectForCampaign={onSelectForCampaign}
            />
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <TemplateDetailModal
        open={Boolean(previewTemplate)}
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onSelectForCampaign={onSelectForCampaign}
        onDuplicate={handleDuplicate}
      />

      {/* Editor Modal */}
      <TemplateEditorModal
        open={editorModalOpen}
        template={editingTemplate}
        onClose={() => {
          setEditorModalOpen(false);
          setEditingTemplate(null);
        }}
        onSave={handleSaveEditor}
      />
    </div>
  );
}

export default TemplatesPage;
