import React, { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { FileText, UploadCloud, Languages, ChevronDown, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { DocumentTranslateDocument } from '../../../types';
import { nanoid } from 'nanoid';

const SUPPORTED_LANGUAGES = [
  { code: 'auto', labelKey: 'documentTranslate.languages.auto' },
  { code: 'en', labelKey: 'documentTranslate.languages.en' },
  { code: 'es', labelKey: 'documentTranslate.languages.es' },
  { code: 'fr', labelKey: 'documentTranslate.languages.fr' },
  { code: 'de', labelKey: 'documentTranslate.languages.de' },
  { code: 'it', labelKey: 'documentTranslate.languages.it' },
  { code: 'pt', labelKey: 'documentTranslate.languages.pt' },
  { code: 'zh', labelKey: 'documentTranslate.languages.zh' },
  { code: 'ja', labelKey: 'documentTranslate.languages.ja' },
  { code: 'ko', labelKey: 'documentTranslate.languages.ko' },
  { code: 'ar', labelKey: 'documentTranslate.languages.ar' },
  { code: 'ru', labelKey: 'documentTranslate.languages.ru' },
];

export const LeftDocumentTranslatePanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docTranslate = state.workflow.documentTranslate;

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const isPdf = file.type === 'application/pdf';
        const doc: DocumentTranslateDocument = {
          id: nanoid(),
          name: file.name,
          type: isPdf ? 'pdf' : 'docx',
          mimeType: file.type as DocumentTranslateDocument['mimeType'],
          size: file.size,
          dataUrl: reader.result as string,
          uploadedAt: Date.now(),
        };
        dispatch({
          type: 'UPDATE_DOCUMENT_TRANSLATE',
          payload: { sourceDocument: doc, error: null, translatedDocumentUrl: null },
        });
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [dispatch]
  );

  const handleRemoveDocument = useCallback(() => {
    dispatch({
      type: 'UPDATE_DOCUMENT_TRANSLATE',
      payload: {
        sourceDocument: null,
        translatedDocumentUrl: null,
        error: null,
        progress: {
          phase: 'idle',
          currentSegment: 0,
          totalSegments: 0,
          currentBatch: 0,
          totalBatches: 0,
        },
      },
    });
  }, [dispatch]);

  const updateLanguage = useCallback(
    (field: 'sourceLanguage' | 'targetLanguage', value: string) => {
      dispatch({ type: 'UPDATE_DOCUMENT_TRANSLATE', payload: { [field]: value } });
    },
    [dispatch]
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Document Upload Section */}
      <div>
        <SectionHeader title={t('documentTranslate.uploadDocument')} />

        {docTranslate.sourceDocument ? (
          <div className="p-3 bg-surface-elevated border border-border rounded-lg group relative">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded flex items-center justify-center shrink-0',
                  docTranslate.sourceDocument.mimeType.includes('pdf')
                    ? 'bg-red-50 text-red-600'
                    : 'bg-blue-50 text-blue-600'
                )}
              >
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {docTranslate.sourceDocument.name}
                </div>
                <div className="text-xs text-foreground-muted">
                  {formatFileSize(docTranslate.sourceDocument.size)}
                </div>
              </div>
              <button
                onClick={handleRemoveDocument}
                className="p-1 text-foreground-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title={t('documentTranslate.removeDocument')}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-foreground-muted hover:text-foreground hover:bg-surface-elevated hover:border-foreground-muted transition-all"
            >
              <UploadCloud size={28} />
              <span className="text-sm font-medium">
                {t('documentTranslate.dropOrClick')}
              </span>
              <span className="text-xs text-foreground-muted">
                {t('documentTranslate.supportedFormats')}
              </span>
            </button>
          </>
        )}
      </div>

      {/* Language Selection */}
      <div>
        <SectionHeader title={t('documentTranslate.languagesTitle')} />
        <div className="space-y-3">
          {/* Source Language */}
          <div>
            <label className="text-xs text-foreground-muted mb-1.5 block">
              {t('documentTranslate.sourceLanguage')}
            </label>
            <div className="relative">
              <select
                value={docTranslate.sourceLanguage}
                onChange={(e) => updateLanguage('sourceLanguage', e.target.value)}
                className="w-full appearance-none bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {t(lang.labelKey)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none"
              />
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center py-1">
            <Languages size={16} className="text-foreground-muted" />
          </div>

          {/* Target Language */}
          <div>
            <label className="text-xs text-foreground-muted mb-1.5 block">
              {t('documentTranslate.targetLanguage')}
            </label>
            <div className="relative">
              <select
                value={docTranslate.targetLanguage}
                onChange={(e) => updateLanguage('targetLanguage', e.target.value)}
                className="w-full appearance-none bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {t(lang.labelKey)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-surface-sunken p-3 rounded-lg text-[10px] text-foreground-secondary leading-relaxed space-y-2">
        <p>
          <strong>{t('documentTranslate.preservesFormatting')}</strong>
        </p>
        <p>{t('documentTranslate.formattingNote')}</p>
      </div>
    </div>
  );
};
