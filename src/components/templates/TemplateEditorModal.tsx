import React, { useState, useEffect } from 'react';
import { X, Sparkles, Plus, Save, Info, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import type { ProfessionalTemplate, TemplateCategory, TemplateFormat } from '../../types/templates.types';

interface TemplateEditorModalProps {
  open: boolean;
  template?: ProfessionalTemplate | null;
  onClose: () => void;
  onSave: (templateData: {
    name: string;
    purpose: string;
    category: TemplateCategory;
    subject: string;
    subjectAlternatives?: [string, string, string];
    bodyText: string;
    bodyHtml?: string;
    format: TemplateFormat;
    status: 'published' | 'draft';
    suitableDisciplines?: string[];
  }) => void;
}

const VARIABLE_TAGS = [
  { tag: '{{first_name}}', desc: 'First Name' },
  { tag: '{{last_name}}', desc: 'Last Name' },
  { tag: '{{institution}}', desc: 'University' },
  { tag: '{{department}}', desc: 'Department' },
  { tag: '{{designation}}', desc: 'Title' },
];

export function TemplateEditorModal({
  open,
  template,
  onClose,
  onSave,
}: TemplateEditorModalProps) {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('custom');
  const [subject, setSubject] = useState('');
  const [subjectAlt2, setSubjectAlt2] = useState('');
  const [subjectAlt3, setSubjectAlt3] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [format, setFormat] = useState<TemplateFormat>('plain');
  const [disciplines, setDisciplines] = useState('Multidisciplinary');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setPurpose(template.purpose);
      setCategory(template.category);
      setSubject(template.subject);
      setSubjectAlt2(template.subjectAlternatives[1] || '');
      setSubjectAlt3(template.subjectAlternatives[2] || '');
      setBodyText(template.bodyText);
      setBodyHtml(template.bodyHtml || '');
      setFormat(template.format);
      setDisciplines(template.suitableDisciplines.join(', '));
    } else {
      setName('');
      setPurpose('');
      setCategory('custom');
      setSubject('');
      setSubjectAlt2('');
      setSubjectAlt3('');
      setBodyText(`Dear Professor {{last_name}},\n\nI am writing to share how faculty at {{institution}} are using GamifyTL for quick interactive classroom response activities.\n\nStudents scan a QR code on any phone browser to join quiz battles in under three seconds with zero app installs.\n\nWould you be open to a brief walkthrough at https://gamifytl.com/?\n\nSincerely,\nGamifyTL\nNorthNode Technologies`);
      setBodyHtml('');
      setFormat('plain');
      setDisciplines('Multidisciplinary');
    }
    setError(null);
  }, [template, open]);

  if (!open) return null;

  const insertVariable = (tag: string) => {
    setBodyText((prev) => prev + ` ${tag}`);
  };

  const handleFormSubmit = (status: 'published' | 'draft') => {
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }
    if (!subject.trim()) {
      setError('Primary subject line is required.');
      return;
    }
    if (!bodyText.trim()) {
      setError('Email body text is required.');
      return;
    }

    const subjectAlternatives: [string, string, string] = [
      subject.trim(),
      subjectAlt2.trim() || `Follow-up regarding ${subject.trim()}`,
      subjectAlt3.trim() || `Quick note on ${subject.trim()}`,
    ];

    const suitableDisciplines = disciplines
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

    onSave({
      name: name.trim(),
      purpose: purpose.trim() || 'Custom academic outreach template',
      category,
      subject: subject.trim(),
      subjectAlternatives,
      bodyText: bodyText.trim(),
      bodyHtml: format === 'html' ? bodyHtml.trim() || undefined : undefined,
      format,
      status,
      suitableDisciplines: suitableDisciplines.length > 0 ? suitableDisciplines : ['Multidisciplinary'],
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50/60">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              {template ? 'Edit Custom Template' : 'Create Your Own Template'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Build a custom academic outreach email with clean plain-text or accessible HTML formatting.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Template Name *"
              placeholder="e.g. Physics Department Engagement Note"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Select
              label="Scenario Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
            >
              <option value="custom">Custom Scenario</option>
              <option value="general">General Introduction</option>
              <option value="engagement">Classroom Engagement</option>
              <option value="participation">Student Participation</option>
              <option value="quizzes">Live Quizzes & Formative Checks</option>
              <option value="stem">STEM & Technical Learning</option>
              <option value="business">Business & Case Studies</option>
              <option value="language">Language & Vocabulary</option>
              <option value="large_lectures">Large Auditoriums</option>
              <option value="follow_up">Follow-Up Note</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Purpose / Context"
              placeholder="e.g. For instructors teaching 100+ student introductory mechanics"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
            <Input
              label="Disciplines (comma separated)"
              placeholder="e.g. Physics, Engineering, Applied Mathematics"
              value={disciplines}
              onChange={(e) => setDisciplines(e.target.value)}
            />
          </div>

          {/* Subject Lines (3 Alternatives) */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
              Subject Lines (Primary + 2 Tested Alternatives)
            </span>
            <Input
              label="Primary Subject Line *"
              placeholder="e.g. Interactive problem checks for {{department}} at {{institution}}"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Subject Alternative 2"
                placeholder="e.g. Brief note regarding lecture response at {{institution}}"
                value={subjectAlt2}
                onChange={(e) => setSubjectAlt2(e.target.value)}
              />
              <Input
                label="Subject Alternative 3"
                placeholder="e.g. Quick question regarding your {{department}} classes"
                value={subjectAlt3}
                onChange={(e) => setSubjectAlt3(e.target.value)}
              />
            </div>
          </div>

          {/* Format Selection */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-xs font-semibold text-gray-700">Email Format</span>
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFormat('plain')}
                className={`rounded-md px-3 py-1 font-semibold transition-all ${
                  format === 'plain'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ✉️ Plain-Text (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setFormat('html')}
                className={`rounded-md px-3 py-1 font-semibold transition-all ${
                  format === 'html'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🎨 Branded HTML
              </button>
            </div>
          </div>

          {/* Personalization Variable Insertion Chips */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="font-semibold text-gray-700">Insert Variable Placeholder:</span>
              <span>Click any tag to append to message</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {VARIABLE_TAGS.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => insertVariable(v.tag)}
                  className="rounded-md border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-xs font-mono font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                  title={v.desc}
                >
                  + {v.tag}
                </button>
              ))}
            </div>
          </div>

          {/* Body Textarea */}
          <Textarea
            label="Email Body (Plain Text) *"
            placeholder="Type your authentic, respectful academic outreach email..."
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={8}
            required
          />

          {format === 'html' && (
            <Textarea
              label="Custom HTML Markup (Optional)"
              placeholder="<p>Custom accessible HTML markup...</p>"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={6}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 bg-gray-50/50">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFormSubmit('draft')}
              className="text-xs"
            >
              Save as Draft
            </Button>
            <Button
              size="sm"
              onClick={() => handleFormSubmit('published')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {template ? 'Update Template' : 'Publish Template'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
