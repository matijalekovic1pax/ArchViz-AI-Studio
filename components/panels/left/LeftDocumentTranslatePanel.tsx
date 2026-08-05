import React, { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import {
  FileText,
  UploadCloud,
  Languages,
  ChevronDown,
  Check,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  DOCUMENT_TRANSLATION_MODELS,
  type DocumentTranslateDocument,
  type DocumentTranslateQueueItem,
  type DocumentTranslateState,
  type DocumentTranslationModel,
} from '../../../types';
import { nanoid } from 'nanoid';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

const MAX_BATCH_SIZE = 20;

const SUPPORTED_LANGUAGES = [
  { code: 'auto', labelKey: 'documentTranslate.languages.auto' },
  { code: 'en', labelKey: 'documentTranslate.languages.en' },
  { code: 'es', labelKey: 'documentTranslate.languages.es' },
  { code: 'fr', labelKey: 'documentTranslate.languages.fr' },
  { code: 'de', labelKey: 'documentTranslate.languages.de' },
  { code: 'hu', labelKey: 'documentTranslate.languages.hu' },
  { code: 'hr', labelKey: 'documentTranslate.languages.hr' },
  { code: 'bs', labelKey: 'documentTranslate.languages.bs' },
  { code: 'sl', labelKey: 'documentTranslate.languages.sl' },
  { code: 'mk', labelKey: 'documentTranslate.languages.mk' },
  { code: 'bg', labelKey: 'documentTranslate.languages.bg' },
  { code: 'ro', labelKey: 'documentTranslate.languages.ro' },
  { code: 'sq', labelKey: 'documentTranslate.languages.sq' },
  { code: 'it', labelKey: 'documentTranslate.languages.it' },
  { code: 'pt', labelKey: 'documentTranslate.languages.pt' },
  { code: 'zh', labelKey: 'documentTranslate.languages.zh' },
  { code: 'ja', labelKey: 'documentTranslate.languages.ja' },
  { code: 'ko', labelKey: 'documentTranslate.languages.ko' },
  { code: 'ar', labelKey: 'documentTranslate.languages.ar' },
  { code: 'ru', labelKey: 'documentTranslate.languages.ru' },
  { code: 'sr', labelKey: 'documentTranslate.languages.sr' },
];

const TRANSLATION_MODEL_OPTIONS: Array<{
  model: DocumentTranslationModel;
  label: string;
  provider: string;
}> = [
  { model: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', provider: 'OpenAI' },
  { model: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', provider: 'Google' },
];

const getDocumentType = (file: File): DocumentTranslateDocument['type'] => {
  const lowerName = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf';
  const isXlsx = file.type === XLSX_MIME || lowerName.endsWith('.xlsx');
  const isPptx = file.type === PPTX_MIME || lowerName.endsWith('.pptx');
  return isPdf ? 'pdf' : isXlsx ? 'xlsx' : isPptx ? 'pptx' : 'docx';
};

const getDocumentMimeType = (file: File, type: DocumentTranslateDocument['type']): DocumentTranslateDocument['mimeType'] =>
  (file.type ||
    (type === 'pdf'
      ? 'application/pdf'
      : type === 'xlsx'
      ? XLSX_MIME
      : type === 'pptx'
      ? PPTX_MIME
      : DOCX_MIME)) as DocumentTranslateDocument['mimeType'];

const toSourceDocument = (item: DocumentTranslateQueueItem): DocumentTranslateDocument => ({
  id: item.id,
  name: item.name,
  type: item.type,
  mimeType: item.mimeType,
  size: item.size,
  dataUrl: item.dataUrl,
  uploadedAt: item.uploadedAt,
});

const IDLE_PROGRESS = {
  phase: 'idle' as const,
  currentSegment: 0,
  totalSegments: 0,
  currentBatch: 0,
  totalBatches: 0,
};

export const LeftDocumentTranslatePanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docTranslate = state.workflow.documentTranslate;
  const queue = docTranslate.queue || [];

  const readFileAsDataUrl = useCallback(
    (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      }),
    []
  );

  const updateTranslate = useCallback(
    (payload: Partial<DocumentTranslateState>) => {
      dispatch({ type: 'UPDATE_DOCUMENT_TRANSLATE', payload });
    },
    [dispatch]
  );

  const handleAddDocuments = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files: File[] = Array.from(event.target.files || []) as File[];
      if (files.length === 0) return;
      const remainingSlots = Math.max(0, MAX_BATCH_SIZE - queue.length);
      if (remainingSlots === 0) {
        event.target.value = '';
        return;
      }
      try {
        const results = await Promise.all(
          files.slice(0, remainingSlots).map(async (file) => {
            const dataUrl = await readFileAsDataUrl(file);
            const type = getDocumentType(file);
            return {
              id: nanoid(),
              name: file.name,
              type,
              mimeType: getDocumentMimeType(file, type),
              size: file.size,
              dataUrl,
              uploadedAt: Date.now(),
              status: 'queued' as const,
            };
          })
        );
        const nextQueue = [...queue, ...results];
        const payload: Partial<DocumentTranslateState> = { queue: nextQueue };
        // Auto-select the first newly added document when nothing is active yet.
        if (!docTranslate.activeDocumentId && results.length > 0) {
          const first = results[0];
          payload.activeDocumentId = first.id;
          payload.sourceDocument = toSourceDocument(first);
          payload.translatedDocumentUrl = null;
          payload.warnings = null;
          payload.xlsxStats = null;
          payload.error = null;
          payload.progress = IDLE_PROGRESS;
        }
        updateTranslate(payload);
      } catch {
        // Ignore individual read failures; the queue keeps valid documents.
      } finally {
        event.target.value = '';
      }
    },
    [queue, docTranslate.activeDocumentId, readFileAsDataUrl, updateTranslate]
  );

  const handleSelect = useCallback(
    (item: DocumentTranslateQueueItem) => {
      const isDone = item.status === 'done';
      updateTranslate({
        activeDocumentId: item.id,
        sourceDocument: toSourceDocument(item),
        translatedDocumentUrl: isDone ? (item.translatedDocumentUrl ?? null) : null,
        warnings: isDone ? (item.warnings ?? null) : null,
        xlsxStats: isDone ? (item.xlsxStats ?? null) : null,
        error: item.status === 'failed' ? (item.error ?? null) : null,
        progress: isDone
          ? { ...IDLE_PROGRESS, phase: 'complete' as const }
          : IDLE_PROGRESS,
      });
    },
    [updateTranslate]
  );

  const handleRemove = useCallback(
    (id: string) => {
      const nextQueue = queue.filter((item) => item.id !== id);
      const removedActive = docTranslate.activeDocumentId === id;
      const activeStillExists = nextQueue.some((item) => item.id === docTranslate.activeDocumentId);
      if (!removedActive && activeStillExists && nextQueue.length > 0) {
        updateTranslate({ queue: nextQueue });
        return;
      }
      // The active document was removed (or no active selection exists):
      // fall back to the first remaining queued document.
      const nextActive = nextQueue[0] || null;
      updateTranslate({
        queue: nextQueue,
        activeDocumentId: nextActive ? nextActive.id : null,
        sourceDocument: nextActive ? toSourceDocument(nextActive) : null,
        translatedDocumentUrl: null,
        warnings: null,
        xlsxStats: null,
        error: null,
        progress: IDLE_PROGRESS,
      });
    },
    [queue, docTranslate.activeDocumentId, updateTranslate]
  );

  const handleRetryFailed = useCallback(
    (id: string) => {
      updateTranslate({
        queue: queue.map((item) =>
          item.id === id
            ? {
                ...item,
                status: 'queued' as const,
                error: null,
                translatedDocumentUrl: null,
                warnings: null,
                xlsxStats: null,
              }
            : item
        ),
      });
    },
    [queue, updateTranslate]
  );

  const updateLanguage = useCallback(
    (field: 'sourceLanguage' | 'targetLanguage', value: string) => {
      dispatch({ type: 'UPDATE_DOCUMENT_TRANSLATE', payload: { [field]: value } });
    },
    [dispatch]
  );

  const updateTranslationModel = useCallback(
    (model: DocumentTranslationModel) => {
      dispatch({
        type: 'UPDATE_DOCUMENT_TRANSLATE',
        payload: {
          translationModel: model,
          translatedDocumentUrl: null,
          warnings: null,
          xlsxStats: null,
          error: null,
        },
      });
    },
    [dispatch]
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeIconClass = (item: DocumentTranslateQueueItem) => {
    if (item.mimeType.includes('pdf')) return 'bg-red-50 text-red-600';
    if (item.type === 'xlsx') return 'bg-green-50 text-green-600';
    if (item.type === 'pptx') return 'bg-orange-50 text-orange-600';
    return 'bg-blue-50 text-blue-600';
  };

  const total = queue.length;
  const remainingSlots = Math.max(0, MAX_BATCH_SIZE - total);
  const completed = queue.filter((item) => item.status === 'done').length;
  const failed = queue.filter((item) => item.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Batch Queue Section */}
      <div>
        <SectionHeader title={t('documentTranslate.batchQueue')} />
        <div className="space-y-2">
          {queue.map((item) => {
            const isActive = item.id === docTranslate.activeDocumentId;
            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className={cn(
                  'flex w-full items-center gap-3 p-2 rounded border text-left transition-colors',
                  isActive
                    ? 'border-accent bg-accent/10'
                    : 'bg-surface-elevated border-border hover:border-foreground/40'
                )}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSelect(item);
                  }
                }}
              >
                <div className={cn('w-8 h-8 rounded flex items-center justify-center shrink-0', getTypeIconClass(item))}>
                  <FileText size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{item.name}</div>
                  <div className="text-[10px] text-foreground-muted capitalize flex items-center gap-1">
                    {item.status === 'done' && <Check size={10} className="text-green-500" />}
                    {item.status === 'processing' && <RefreshCw size={10} className="animate-spin text-blue-500" />}
                    {item.status === 'failed' && <AlertTriangle size={10} className="text-red-500" />}
                    {item.status === 'done' && 'translated'}
                    {item.status === 'processing' && 'translating…'}
                    {item.status === 'queued' && 'queued'}
                    {item.status === 'failed' && 'failed'}
                    <span className="text-foreground-muted/70">· {formatFileSize(item.size)}</span>
                  </div>
                  {item.status === 'failed' && item.error && (
                    <div className="text-[9px] text-red-400 truncate" title={item.error}>
                      {item.error.length > 40 ? item.error.slice(0, 40) + '...' : item.error}
                    </div>
                  )}
                </div>
                {item.status === 'failed' && (
                  <button
                    type="button"
                    className="text-foreground-muted hover:text-blue-500"
                    title={t('documentTranslate.retryDocument')}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRetryFailed(item.id);
                    }}
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
                {(item.status === 'queued' || item.status === 'failed') && (
                  <button
                    type="button"
                    className="text-foreground-muted hover:text-red-500"
                    title={t('documentTranslate.removeDocument')}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRemove(item.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            disabled={remainingSlots === 0}
            className={cn(
              'w-full py-2 border border-dashed text-xs rounded transition-colors flex items-center justify-center gap-1.5',
              remainingSlots === 0
                ? 'border-border text-foreground-muted/60 cursor-not-allowed'
                : 'border-border text-foreground-muted hover:bg-surface-elevated'
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={13} />
            {remainingSlots === 0
              ? t('documentTranslate.queueFull', { count: MAX_BATCH_SIZE })
              : t('documentTranslate.addDocumentsCount', { count: remainingSlots })}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.docx,.xlsx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            onChange={handleAddDocuments}
          />
        </div>
      </div>

      {/* Batch Progress */}
      {total > 0 && (
        <div className="bg-surface-elevated border border-border p-3 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">
              {completed}/{total} {t('documentTranslate.completedLabel')}
              {failed > 0 && <span className="text-red-400 ml-1">({failed} {t('documentTranslate.failedLabel')})</span>}
            </span>
            {completed === total && total > 0 && failed === 0 && (
              <Check size={14} className="text-green-500" />
            )}
            {completed + failed === total && total > 0 && failed > 0 && (
              <AlertTriangle size={14} className="text-yellow-500" />
            )}
          </div>
          <div className="w-full bg-surface-sunken rounded-full h-1.5 relative overflow-hidden">
            <div
              className="bg-accent h-1.5 rounded-full transition-all duration-300 absolute left-0"
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
            {failed > 0 && (
              <div
                className="bg-red-500 h-1.5 rounded-full transition-all duration-300 absolute"
                style={{
                  left: `${total > 0 ? (completed / total) * 100 : 0}%`,
                  width: `${total > 0 ? (failed / total) * 100 : 0}%`,
                }}
              />
            )}
          </div>
        </div>
      )}

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

      {/* Model Selection */}
      <div>
        <SectionHeader title={t('documentTranslate.modelTitle')} />
        <div>
          <label className="text-xs text-foreground-muted mb-1.5 block">
            {t('documentTranslate.translationModel')}
          </label>
          <div className="relative">
            <select
              value={docTranslate.translationModel}
              onChange={(e) => {
                const nextModel = e.target.value as DocumentTranslationModel;
                if (DOCUMENT_TRANSLATION_MODELS.includes(nextModel)) {
                  updateTranslationModel(nextModel);
                }
              }}
              className="w-full appearance-none bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {TRANSLATION_MODEL_OPTIONS.map((option) => (
                <option key={option.model} value={option.model}>
                  {option.label} ({option.provider})
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

      {/* Info Boxes */}
      <div className="bg-surface-sunken p-3 rounded-lg text-[10px] text-foreground-secondary leading-relaxed">
        {t('documentTranslate.batchHint')}
      </div>

      <div className="bg-surface-sunken p-3 rounded-lg text-[10px] text-foreground-secondary leading-relaxed space-y-2">
        <p>
          <strong>{t('documentTranslate.preservesFormatting')}</strong>
        </p>
        <p>{t('documentTranslate.formattingNote')}</p>
      </div>
    </div>
  );
};
