import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileStack, FileText, Languages, Sparkles, UploadCloud, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { cn } from '../../../lib/utils';
import { normalizeCvConversionModel, type CvConversionModel, type DocumentTranslateDocument } from '../../../types';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';
const ACCEPTED_DOCUMENTS = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const LANGUAGE_OPTIONS = [
  ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['hu', 'Hungarian'],
  ['hr', 'Croatian'], ['bs', 'Bosnian'], ['sl', 'Slovenian'], ['mk', 'Macedonian'], ['bg', 'Bulgarian'],
  ['ro', 'Romanian'], ['sq', 'Albanian'], ['it', 'Italian'], ['pt', 'Portuguese'], ['zh', 'Chinese'],
  ['ja', 'Japanese'], ['ko', 'Korean'], ['ar', 'Arabic'], ['ru', 'Russian'], ['sr', 'Serbian'],
] as const;

const MODEL_OPTIONS: Array<{ value: CvConversionModel; label: string; provider: string }> = [
  { value: 'gpt-5', label: 'GPT-5', provider: 'OpenAI' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', provider: 'Google' },
];

export const LeftCvConvertPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const cvInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const cvConversion = state.workflow.cvConversion;
  const selectedConversionModel = normalizeCvConversionModel(cvConversion.conversionModel);

  const resetOutputs = () => ({
    outputs: [],
    activeOutputId: null,
    error: null,
    progress: { phase: 'idle' as const, currentDocument: 0, totalDocuments: 0, percent: 0 },
  });

  const readFile = (file: File): Promise<DocumentTranslateDocument> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const isPdf = file.type === PDF_MIME || file.name.toLowerCase().endsWith('.pdf');
      resolve({
        id: nanoid(),
        name: file.name,
        type: isPdf ? 'pdf' : 'docx',
        mimeType: isPdf ? PDF_MIME : DOCX_MIME,
        size: file.size,
        dataUrl: reader.result as string,
        uploadedAt: Date.now(),
      });
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });

  const handleCvFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    const allowedFiles = Array.from(files).filter((file) => /\.(pdf|docx)$/i.test(file.name));
    if (allowedFiles.length === 0) return;
    const nextDocuments = await Promise.all(allowedFiles.map(readFile));
    const existing = cvConversion.sourceDocuments;
    const merged = [...existing, ...nextDocuments].filter((document, index, all) =>
      all.findIndex((candidate) => candidate.name === document.name && candidate.size === document.size) === index
    );
    dispatch({ type: 'UPDATE_CV_CONVERSION', payload: { sourceDocuments: merged, ...resetOutputs() } });
  }, [cvConversion.sourceDocuments, dispatch]);

  const handleTemplateFile = useCallback(async (file: File | undefined) => {
    if (!file || !/\.(pdf|docx)$/i.test(file.name)) return;
    const templateDocument = await readFile(file);
    dispatch({ type: 'UPDATE_CV_CONVERSION', payload: { templateDocument, ...resetOutputs() } });
  }, [dispatch]);

  const removeCv = (id: string) => {
    dispatch({
      type: 'UPDATE_CV_CONVERSION',
      payload: {
        sourceDocuments: cvConversion.sourceDocuments.filter((document) => document.id !== id),
        ...resetOutputs(),
      },
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title={t('cvConversion.companyCvs')} />
        <input
          ref={cvInputRef}
          className="hidden"
          type="file"
          multiple
          accept={ACCEPTED_DOCUMENTS}
          onChange={(event) => {
            void handleCvFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => cvInputRef.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-border px-4 py-5 text-center transition-colors hover:border-accent/60 hover:bg-surface-elevated"
        >
          <FileStack size={25} className="mx-auto text-foreground-muted" />
          <div className="mt-2 text-sm font-semibold text-foreground">{t('cvConversion.uploadCvs')}</div>
          <div className="mt-1 text-xs text-foreground-muted">{t('cvConversion.wordPdfMultiple')}</div>
        </button>

        {cvConversion.sourceDocuments.length > 0 && (
          <div className="mt-3 space-y-2">
            {cvConversion.sourceDocuments.map((document) => (
              <div key={document.id} className="group flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-surface-elevated p-2.5">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', document.type === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600')}>
                  <FileText size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-foreground">{document.name}</div>
                  <div className="mt-0.5 text-[10px] text-foreground-muted">{formatFileSize(document.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeCv(document.id)}
                  className="rounded p-1 text-foreground-muted opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                  aria-label={t('cvConversion.removeCv')}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title={t('cvConversion.tenderTemplate')} />
        <input
          ref={templateInputRef}
          className="hidden"
          type="file"
          accept={ACCEPTED_DOCUMENTS}
          onChange={(event) => {
            void handleTemplateFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        {cvConversion.templateDocument ? (
          <div className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface-elevated p-3">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', cvConversion.templateDocument.type === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600')}>
              <FileText size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{cvConversion.templateDocument.name}</div>
              <div className="mt-0.5 text-xs text-foreground-muted">{t('cvConversion.templateReady')}</div>
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: 'UPDATE_CV_CONVERSION', payload: { templateDocument: null, ...resetOutputs() } })}
              className="rounded p-1 text-foreground-muted opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
              aria-label={t('cvConversion.removeTemplate')}
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => templateInputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-border px-4 py-5 text-center transition-colors hover:border-accent/60 hover:bg-surface-elevated"
          >
            <UploadCloud size={25} className="mx-auto text-foreground-muted" />
            <div className="mt-2 text-sm font-semibold text-foreground">{t('cvConversion.uploadTemplate')}</div>
            <div className="mt-1 text-xs text-foreground-muted">{t('cvConversion.templateFormats')}</div>
          </button>
        )}
      </section>

      <section>
        <SectionHeader title={t('cvConversion.finalLanguage')} />
        <div className="relative">
          <Languages size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <select
            value={cvConversion.targetLanguage}
            onChange={(event) => dispatch({ type: 'UPDATE_CV_CONVERSION', payload: { targetLanguage: event.target.value, ...resetOutputs() } })}
            className="w-full appearance-none rounded-lg border border-border bg-surface-elevated py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/40"
          >
            {LANGUAGE_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </div>
      </section>

      <section>
        <SectionHeader title={t('cvConversion.modelTitle')} />
        <div className="space-y-2">
          {MODEL_OPTIONS.map((model) => {
            const selected = selectedConversionModel === model.value;
            return (
              <button
                key={model.value}
                type="button"
                onClick={() => dispatch({ type: 'UPDATE_CV_CONVERSION', payload: { conversionModel: model.value, ...resetOutputs() } })}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                  selected ? 'border-accent bg-accent/10' : 'border-border bg-surface-elevated hover:bg-surface-sunken'
                )}
              >
                <Sparkles size={15} className={selected ? 'text-accent' : 'text-foreground-muted'} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-foreground">{model.label}</span>
                  <span className="block text-[10px] text-foreground-muted">{model.provider} · {t('cvConversion.formattingFocused')}</span>
                </span>
                <span className={cn('h-2 w-2 rounded-full', selected ? 'bg-accent' : 'bg-border-strong')} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
