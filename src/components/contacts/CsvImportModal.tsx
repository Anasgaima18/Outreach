import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, AlertCircle, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { parseCsvText, autoMapHeader, type CsvValidationSummary } from '../../hooks/useContacts';
import type { Contact } from '../../types/database.types';

interface CsvImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidate: (rawRows: Record<string, string>[], mapping: Record<string, string>) => CsvValidationSummary;
  onImport: (validRows: Array<Omit<Contact, 'id' | 'created_at' | 'updated_at'>>) => Promise<{ success: boolean; insertedCount: number; error?: string }>;
}

type Step = 'upload' | 'mapping' | 'preview' | 'complete';

export function CsvImportModal({
  open,
  onOpenChange,
  onValidate,
  onImport,
}: CsvImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<CsvValidationSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ insertedCount: number; error?: string } | null>(null);

  const resetState = () => {
    setStep('upload');
    setCsvContent('');
    setFileName('');
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setSummary(null);
    setImporting(false);
    setImportResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        processCsvString(text);
      }
    };
    reader.readAsText(file);
  };

  const processCsvString = (text: string) => {
    setCsvContent(text);
    const parsed = parseCsvText(text);
    setHeaders(parsed.headers);
    setRawRows(parsed.rawRows);

    // Initial automapping
    const initialMapping: Record<string, string> = {};
    parsed.headers.forEach((h) => {
      initialMapping[h] = autoMapHeader(h);
    });
    setMapping(initialMapping);
    setStep('mapping');
  };

  const handleProceedToPreview = () => {
    const valSummary = onValidate(rawRows, mapping);
    setSummary(valSummary);
    setStep('preview');
  };

  const handleExecuteImport = async () => {
    if (!summary || summary.validRows.length === 0) return;
    setImporting(true);
    const res = await onImport(summary.validRows);
    setImporting(false);
    if (res.success) {
      setImportResult({ insertedCount: res.insertedCount });
      setStep('complete');
    } else {
      setImportResult({ insertedCount: 0, error: res.error });
    }
  };

  const targetFields = [
    { value: '', label: '-- Skip Column --' },
    { value: 'email', label: 'Email Address (Required)' },
    { value: 'first_name', label: 'First Name' },
    { value: 'last_name', label: 'Last Name' },
    { value: 'full_name', label: 'Full Name' },
    { value: 'institution', label: 'University / Institution' },
    { value: 'department', label: 'Department' },
    { value: 'academic_role', label: 'Academic Role / Title' },
    { value: 'country', label: 'Country' },
    { value: 'website', label: 'Academic Website / Profile' },
    { value: 'contact_source', label: 'Source / Directory' },
    { value: 'notes', label: 'Notes / Relevance' },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetState(); }}>
      <DialogContent maxWidth="2xl" onClose={() => { onOpenChange(false); resetState(); }}>
        <DialogHeader>
          <DialogTitle>Import Educator Contacts via CSV</DialogTitle>
          <DialogDescription>
            Seamlessly import professor rosters with automatic field mapping, email validation, and duplicate detection.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 text-xs font-medium text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${step === 'upload' ? 'bg-blue-600 text-white font-bold' : 'bg-gray-100 text-gray-700'}`}>1</span>
            <span className={step === 'upload' ? 'font-semibold text-gray-900' : ''}>Upload CSV</span>
          </div>
          <ArrowRight className="h-3 w-3 text-gray-300" />
          <div className="flex items-center gap-1.5">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${step === 'mapping' ? 'bg-blue-600 text-white font-bold' : 'bg-gray-100 text-gray-700'}`}>2</span>
            <span className={step === 'mapping' ? 'font-semibold text-gray-900' : ''}>Map Columns</span>
          </div>
          <ArrowRight className="h-3 w-3 text-gray-300" />
          <div className="flex items-center gap-1.5">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${step === 'preview' ? 'bg-blue-600 text-white font-bold' : 'bg-gray-100 text-gray-700'}`}>3</span>
            <span className={step === 'preview' ? 'font-semibold text-gray-900' : ''}>Validate & Preview</span>
          </div>
        </div>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4 py-3">
            <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/20 transition-all">
              <Upload className="h-10 w-10 text-gray-400 mb-3" />
              <p className="text-sm font-semibold text-gray-800">
                Click to upload or drag and drop your CSV file
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supports standard CSV exports with headers (e.g., email, first_name, institution, country)
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400 font-medium">Or paste CSV content directly</span>
              </div>
            </div>

            <textarea
              className="w-full rounded-lg border border-gray-300 p-3 font-mono text-xs focus:border-blue-500 focus:outline-none"
              rows={4}
              placeholder="email,first_name,last_name,institution,department,role,country&#10;david.malan@harvard.edu,David,Malan,Harvard University,Computer Science,Professor,United States"
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
            />
            {csvContent && (
              <Button
                type="button"
                onClick={() => processCsvString(csvContent)}
                className="w-full"
              >
                Parse Pasted CSV
              </Button>
            )}
          </div>
        )}

        {/* STEP 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-600 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
              <span>Detected <strong>{headers.length}</strong> columns and <strong>{rawRows.length}</strong> rows from {fileName || 'CSV'}.</span>
              {Object.values(mapping).includes('email') ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-100/70 px-2.5 py-0.5 rounded-full text-xs self-start sm:self-auto">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Email column ready ({Object.keys(mapping).find((k) => mapping[k] === 'email')})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold bg-amber-100/70 px-2.5 py-0.5 rounded-full text-xs self-start sm:self-auto">
                  <AlertTriangle className="h-3.5 w-3.5" /> Select email column to proceed
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {headers.map((header) => (
                <div
                  key={header}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-gray-200 bg-gray-50/30"
                >
                  <div className="text-xs font-semibold text-gray-800">
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">{header}</span>
                    <span className="ml-2 text-gray-400 font-normal">
                      e.g. "{rawRows[0]?.[header] || ''}"
                    </span>
                  </div>
                  <div className="w-full sm:w-60">
                    <Select
                      value={mapping[header] || ''}
                      onChange={(e) =>
                        setMapping({ ...mapping, [header]: e.target.value })
                      }
                      className="text-xs h-8"
                    >
                      {targetFields.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep('upload')}>
                Back to Upload
              </Button>
              <Button
                size="sm"
                onClick={handleProceedToPreview}
                disabled={!Object.values(mapping).includes('email')}
              >
                Preview & Validate <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Preview & Validation */}
        {step === 'preview' && summary && (
          <div className="space-y-4 py-2">
            {/* Summary KPI Badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-emerald-800 font-semibold text-xs">
                  <CheckCircle2 className="h-4 w-4" /> Ready to Import
                </div>
                <div className="text-xl font-bold text-emerald-900 mt-1">{summary.validRows.length}</div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-amber-800 font-semibold text-xs">
                  <AlertTriangle className="h-4 w-4" /> Duplicates Skipped
                </div>
                <div className="text-xl font-bold text-amber-900 mt-1">{summary.duplicateRows.length}</div>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-red-800 font-semibold text-xs">
                  <AlertCircle className="h-4 w-4" /> Invalid Formats
                </div>
                <div className="text-xl font-bold text-red-900 mt-1">{summary.invalidRows.length}</div>
              </div>
            </div>

            {/* Validation Breakdown Lists */}
            {summary.invalidRows.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/40 p-3 text-xs space-y-1">
                <p className="font-semibold text-red-900">Invalid Rows Detected (Will be excluded):</p>
                <div className="max-h-24 overflow-y-auto space-y-1 text-red-700">
                  {summary.invalidRows.map((inv, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>Row {inv.rowNumber}: {inv.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.duplicateRows.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-xs space-y-1">
                <p className="font-semibold text-amber-900">Duplicate Emails Detected (Will be skipped):</p>
                <div className="max-h-24 overflow-y-auto space-y-1 text-amber-800">
                  {summary.duplicateRows.map((dup, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>Row {dup.rowNumber}: <span className="font-mono">{dup.email}</span></span>
                      <span className="text-amber-600">{dup.existingContact ? 'Already in database' : 'Duplicate in CSV'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample Table */}
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 border-b border-gray-200">
                Sample Valid Contacts (Showing first {Math.min(3, summary.validRows.length)} of {summary.validRows.length})
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 text-xs">
                {summary.validRows.slice(0, 3).map((r, i) => (
                  <div key={i} className="p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-900">{r.full_name}</span>
                      <span className="ml-2 font-mono text-gray-500">{r.email}</span>
                    </div>
                    <div className="text-gray-500 text-right">
                      {r.institution || '—'} {r.country ? `(${r.country})` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>
                Back to Mapping
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteImport}
                disabled={summary.validRows.length === 0 || importing}
              >
                {importing ? 'Importing...' : `Import ${summary.validRows.length} Valid Contacts`}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Complete */}
        {step === 'complete' && importResult && (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-900">Import Successful!</h4>
              <p className="text-sm text-gray-600 mt-1">
                Successfully inserted <strong>{importResult.insertedCount}</strong> educator contacts into your outreach directory.
              </p>
            </div>
            <Button
              onClick={() => {
                onOpenChange(false);
                resetState();
              }}
              className="mt-2"
            >
              Done & Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
