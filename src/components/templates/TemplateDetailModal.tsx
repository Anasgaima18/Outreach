import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Monitor,
  Copy,
  Check,
  Sparkles,
  Info,
  Clock,
  BookOpen,
  Send,
  Lock,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { ProfessionalTemplate, SampleProfessorContext } from '../../types/templates.types';

interface TemplateDetailModalProps {
  open: boolean;
  template: ProfessionalTemplate | null;
  onClose: () => void;
  onSelectForCampaign?: (template: ProfessionalTemplate) => void;
  onDuplicate?: (template: ProfessionalTemplate) => void;
}

const DEFAULT_SAMPLE_PROFESSOR: SampleProfessorContext = {
  first_name: 'David',
  last_name: 'Malan',
  full_name: 'David Malan',
  institution: 'Harvard University',
  department: 'Computer Science',
  designation: 'Professor of the Practice',
  country: 'United States',
  email: 'david.malan@harvard.edu',
};

export function TemplateDetailModal({
  open,
  template,
  onClose,
  onSelectForCampaign,
  onDuplicate,
}: TemplateDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'plain' | 'html'>('plain');
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop');
  const [copiedSubjectIdx, setCopiedSubjectIdx] = useState<number | null>(null);
  const [sampleProfessor, setSampleProfessor] = useState<SampleProfessorContext>(DEFAULT_SAMPLE_PROFESSOR);

  if (!open || !template) return null;

  // Personalization replacement
  const interpolate = (text: string): string => {
    return text
      .replace(/\{\{\s*first_name\s*\}\}/gi, sampleProfessor.first_name)
      .replace(/\{\{\s*last_name\s*\}\}/gi, sampleProfessor.last_name)
      .replace(/\{\{\s*full_name\s*\}\}/gi, sampleProfessor.full_name)
      .replace(/\{\{\s*institution\s*\}\}/gi, sampleProfessor.institution)
      .replace(/\{\{\s*department\s*\}\}/gi, sampleProfessor.department)
      .replace(/\{\{\s*designation\s*\}\}/gi, sampleProfessor.designation)
      .replace(/\{\{\s*country\s*\}\}/gi, sampleProfessor.country)
      .replace(/\{\{\s*email\s*\}\}/gi, sampleProfessor.email);
  };

  const resolvedBodyText = interpolate(template.bodyText);
  const resolvedBodyHtml = template.bodyHtml ? interpolate(template.bodyHtml) : null;

  const handleCopySubject = (text: string, idx: number) => {
    navigator.clipboard.writeText(interpolate(text));
    setCopiedSubjectIdx(idx);
    setTimeout(() => setCopiedSubjectIdx(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                Scenario #{template.scenarioNumber}
              </span>
              <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
              {template.isSystem ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500">
                  <Lock className="h-3 w-3" /> Official System Template
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <Sparkles className="h-3 w-3" /> Custom Template
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-500">{template.purpose}</p>
          </div>

          <div className="flex items-center gap-2">
            {onSelectForCampaign && (
              <Button
                size="sm"
                onClick={() => onSelectForCampaign(template)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                <Send className="mr-1.5 h-3.5 w-3.5" /> Use in Campaign
              </Button>
            )}
            {onDuplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDuplicate(template)}
                className="text-xs"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicate
              </Button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split into Left Preview & Right Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-y-auto">
          {/* Left Column: Email Preview */}
          <div className="md:col-span-8 p-6 space-y-4 border-r border-gray-100 bg-gray-50/30">
            {/* View Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
              <div className="inline-flex rounded-lg bg-gray-200/80 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('plain')}
                  className={`rounded-md px-3 py-1 font-semibold transition-all ${
                    activeTab === 'plain'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  ✉️ Plain-Text (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('html')}
                  className={`rounded-md px-3 py-1 font-semibold transition-all ${
                    activeTab === 'html'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🎨 Branded HTML
                </button>
              </div>

              {activeTab === 'html' && (
                <div className="inline-flex rounded-lg bg-gray-200/80 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setDeviceView('desktop')}
                    className={`rounded-md p-1.5 ${
                      deviceView === 'desktop' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                    }`}
                    title="Desktop Preview"
                  >
                    <Monitor className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceView('mobile')}
                    className={`rounded-md p-1.5 ${
                      deviceView === 'mobile' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                    }`}
                    title="Mobile Simulation"
                  >
                    <Smartphone className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* 3 Subject Line Alternatives */}
            <div className="space-y-1.5 rounded-xl border border-gray-200 bg-white p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Subject Line Alternatives (3 Tested Angles)
              </span>
              <div className="space-y-2 mt-1">
                {template.subjectAlternatives.map((subj, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs border border-gray-100"
                  >
                    <span className="font-medium text-gray-800">
                      <span className="font-bold text-blue-600 mr-2">Option {idx + 1}:</span>
                      {interpolate(subj)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopySubject(subj, idx)}
                      className="ml-2 text-gray-400 hover:text-gray-600 shrink-0"
                      title="Copy Subject"
                    >
                      {copiedSubjectIdx === idx ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Body Rendering Canvas */}
            <div
              className={`rounded-xl border border-gray-200 bg-white shadow-xs transition-all ${
                deviceView === 'mobile' && activeTab === 'html'
                  ? 'max-w-[380px] mx-auto'
                  : 'w-full'
              }`}
            >
              {activeTab === 'plain' ? (
                <div className="p-6">
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-gray-800 select-text">
                    {resolvedBodyText}
                  </pre>
                </div>
              ) : (
                <div className="p-2 overflow-hidden rounded-xl">
                  {resolvedBodyHtml ? (
                    <iframe
                      title="HTML Email Preview"
                      srcDoc={resolvedBodyHtml}
                      className="w-full h-[450px] border-0 rounded-lg"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="p-8 text-center text-xs text-gray-500">
                      No HTML version defined for this template. It is sent as clean RFC 2822 plain-text.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Pedagogical Metadata & Sample Context */}
          <div className="md:col-span-4 p-6 space-y-5 bg-white overflow-y-auto">
            {/* Target Audience & Purpose */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
                Pedagogical Profile
              </h4>

              <div>
                <span className="text-[11px] font-semibold text-gray-500">Target Audience</span>
                <p className="text-xs text-gray-800 font-medium mt-0.5">
                  {template.targetAudience}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-gray-500">When To Use</span>
                <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">
                  {template.whenToUse}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-gray-500">Suitable Disciplines</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {template.suitableDisciplines.map((d) => (
                    <span
                      key={d}
                      className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommended Follow-up */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-blue-950">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                Follow-Up Protocol
              </div>
              <p className="text-blue-900/90 leading-relaxed text-[11px]">
                {template.followUpApproach}
              </p>
            </div>

            {/* Sample Contact Live Tester */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Live Variable Simulator
              </span>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] text-gray-500">Last Name</label>
                  <input
                    type="text"
                    value={sampleProfessor.last_name}
                    onChange={(e) =>
                      setSampleProfessor({ ...sampleProfessor, last_name: e.target.value })
                    }
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Institution</label>
                  <input
                    type="text"
                    value={sampleProfessor.institution}
                    onChange={(e) =>
                      setSampleProfessor({ ...sampleProfessor, institution: e.target.value })
                    }
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Department</label>
                  <input
                    type="text"
                    value={sampleProfessor.department}
                    onChange={(e) =>
                      setSampleProfessor({ ...sampleProfessor, department: e.target.value })
                    }
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
