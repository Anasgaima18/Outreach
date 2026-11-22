import React from 'react';
import {
  FileText,
  Copy,
  Edit3,
  Archive,
  Trash2,
  Eye,
  CheckCircle,
  Sparkles,
  Lock,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { ProfessionalTemplate } from '../../types/templates.types';

interface TemplateCardProps {
  template: ProfessionalTemplate;
  onPreview: (template: ProfessionalTemplate) => void;
  onDuplicate: (template: ProfessionalTemplate) => void;
  onEdit?: (template: ProfessionalTemplate) => void;
  onArchive?: (template: ProfessionalTemplate) => void;
  onDelete?: (template: ProfessionalTemplate) => void;
  onSelectForCampaign?: (template: ProfessionalTemplate) => void;
}

export function TemplateCard({
  template,
  onPreview,
  onDuplicate,
  onEdit,
  onArchive,
  onDelete,
  onSelectForCampaign,
}: TemplateCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-xs transition-all hover:border-gray-300 hover:shadow-sm">
      <div className="space-y-3">
        {/* Top Badges & Scenario */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
              #{template.scenarioNumber <= 20 ? `Scenario ${template.scenarioNumber}` : 'Custom'}
            </span>
            {template.isSystem ? (
              <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                <Lock className="h-3 w-3 text-gray-400" />
                GamifyTL Official
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <Sparkles className="h-3 w-3 text-emerald-600" />
                My Template
              </span>
            )}
            {template.status === 'draft' && (
              <Badge variant="warning" className="text-[10px]">Draft</Badge>
            )}
            {template.status === 'archived' && (
              <Badge variant="secondary" className="text-[10px]">Archived</Badge>
            )}
          </div>
          <Badge variant={template.format === 'plain' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
            {template.format === 'plain' ? '✉️ Plain-Text' : '🎨 Branded HTML'}
          </Badge>
        </div>

        {/* Title & Purpose */}
        <div>
          <h4 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
            {template.name}
          </h4>
          <p className="mt-1 text-xs text-gray-500 line-clamp-2 leading-relaxed">
            {template.purpose}
          </p>
        </div>

        {/* Subject Preview */}
        <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-2.5 text-xs">
          <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] block">
            Primary Subject
          </span>
          <p className="mt-0.5 font-medium text-gray-800 line-clamp-1">
            {template.subject}
          </p>
        </div>

        {/* Suitable Disciplines Tag Cloud */}
        {template.suitableDisciplines && template.suitableDisciplines.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {template.suitableDisciplines.slice(0, 3).map((disc) => (
              <span
                key={disc}
                className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
              >
                {disc}
              </span>
            ))}
            {template.suitableDisciplines.length > 3 && (
              <span className="text-[10px] text-gray-400 font-medium">
                +{template.suitableDisciplines.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div className="mt-5 border-t border-gray-100 pt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPreview(template)}
            className="text-xs h-8 px-2.5"
            title="Preview Template Details"
          >
            <Eye className="mr-1.5 h-3.5 w-3.5 text-gray-500" />
            Preview
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDuplicate(template)}
            className="text-xs h-8 px-2 text-gray-600 hover:text-gray-900"
            title="Duplicate to My Templates"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>

          {!template.isSystem && onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(template)}
              className="text-xs h-8 px-2 text-gray-600 hover:text-blue-600"
              title="Edit Custom Template"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
          )}

          {!template.isSystem && onArchive && template.status !== 'archived' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onArchive(template)}
              className="text-xs h-8 px-2 text-gray-600 hover:text-amber-600"
              title="Archive Template"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}

          {!template.isSystem && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(template)}
              className="text-xs h-8 px-2 text-gray-400 hover:text-red-600"
              title="Delete Custom Template"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {onSelectForCampaign && (
          <Button
            size="sm"
            onClick={() => onSelectForCampaign(template)}
            className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Use Template
          </Button>
        )}
      </div>
    </div>
  );
}
