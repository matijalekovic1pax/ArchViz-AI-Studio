import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, FileText, RefreshCw, UploadCloud, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { cn } from '../../../lib/utils';
import {
  DOCUMENT_TRANSLATION_MODELS,
  type BilingualContractLayout,
  type BilingualContractState,
  type DocumentTranslateDocument,
  type DocumentTranslationModel,
} from '../../../types';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';
const ACCEPTED_DOCUMENTS = `.pdf,.docx,${PDF_MIME},${DOCX_MIME}`;

const LANGUAGE_CODES = [
  'en', 'de', 'fr', 'es', 'it', 'pt', 'hu', 'hr', 'bs', 'sr', 'sl', 'mk',
  'bg', 'ro', 'sq', 'ru', 'zh', 'ja', 'ko', 'ar',
] as const;

const TRANSLATION_MODEL_OPTIONS: Array<{ model: DocumentTranslationModel; label: string; provider: string }> = [
  { model: 'gpt-6-luna', label: 'GPT-6 Luna', provider: 'OpenAI' },
  { model: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', provider: 'Google' },
];

/** Miniature page showing how each layout arranges the two languages. */
const LayoutPreview: React.FC<{ layout: BilingualContractLayout; active: boolean }> = ({ layout, active }) => {
  const original = active ? 'bg-foreground/70' : 'bg-foreground-muted/50';
  const translation = active ? 'bg-accent' : 'bg-foreground-muted/30';
  const line = (tone: string, width: string, key: number) => <div key={key} className={cn('h-[3px] rounded-full', tone, width)} />;
  return (
    <div className="mx-auto flex h-[68px] w-[52px] flex-col gap-1 rounded-[3px] border border-border bg-surface-elevated p-1.5 shadow-subtle">
      {layout === 'side-by-side' ? (
        <div className="flex flex-1 gap-1">
          <div className="flex flex-1 flex-col gap-[3px]">{[0, 1, 2, 3, 4, 5, 6].map((i) => line(original, i % 3 === 2 ? 'w-3/4' : 'w-full', i))}</div>
          <div className="w-px bg-border" />
          <div className="flex flex-1 flex-col gap-[3px]">{[0, 1, 2, 3, 4, 5, 6].map((i) => line(translation, i % 3 === 2 ? 'w-2/3' : 'w-full', i))}</div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-[3px]">
          {[0, 1, 2].map((block) => (
            <div key={block} className="flex flex-col gap-[3px] pb-[2px]">
              {line(original, 'w-full', 0)}
              {line(original, 'w-3/4', 1)}
              {line(translation, 'w-full', 2)}
              {line(translation, 'w-2/3', 3)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const LeftBilingualContractPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const contract = state.workflow.bilingualContract;
  const isSideBySide = contract.layout === 'side-by-side';

  const update = useCallback((payload: Partial<BilingualContractState>) => {
    dispatch({ type: 'UPDATE_BILINGUAL_CONTRACT', payload: { error: null, ...payload } });
  }, [dispatch]);

  const handleFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      update({ error: t('bilingualContract.unsupportedFile') });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const isPdf = file.type === PDF_MIME || file.name.toLowerCase().endsWith('.pdf');
      const sourceDocument: DocumentTranslateDocument = {
        id: nanoid(),
        name: file.name,
        type: isPdf ? 'pdf' : 'docx',
        mimeType: isPdf ? PDF_MIME : DOCX_MIME,
        size: file.size,
        dataUrl: reader.result as string,
        uploadedAt: Date.now(),
      };
      update({ sourceDocument, activeOutputId: null, progress: { phase: 'idle', percent: 0 } });
    };
    reader.onerror = () => update({ error: t('bilingualContract.readError', { name: file.name }) });
    reader.readAsDataURL(file);
  }, [t, update]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const selectClass = 'w-full appearance-none rounded-lg border border-border bg-surface-elevated py-2 pl-3 pr-8 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/40';

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title={t('bilingualContract.contract')} />
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept={ACCEPTED_DOCUMENTS}
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        {contract.sourceDocument ? (
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-surface-elevated p-3">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', contract.sourceDocument.type === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600')}>
              <FileText size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{contract.sourceDocument.name}</div>
              <div className="mt-0.5 text-xs text-foreground-muted">{formatFileSize(contract.sourceDocument.size)} · {contract.sourceDocument.type.toUpperCase()}</div>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded p-1 text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
              title={t('bilingualContract.replace')}
              aria-label={t('bilingualContract.replace')}
            >
              <RefreshCw size={14} />
            </button>
            <button
              type="button"
              onClick={() => update({ sourceDocument: null, activeOutputId: null })}
              className="rounded p-1 text-foreground-muted transition-colors hover:bg-red-50 hover:text-red-600"
              aria-label={t('bilingualContract.removeContract')}
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFile(event.dataTransfer.files?.[0]);
            }}
            className="w-full rounded-xl border-2 border-dashed border-border px-4 py-6 text-center transition-colors hover:border-accent/60 hover:bg-surface-elevated"
          >
            <UploadCloud size={25} className="mx-auto text-foreground-muted" />
            <div className="mt-2 text-sm font-semibold text-foreground">{t('bilingualContract.uploadContract')}</div>
            <div className="mt-1 text-xs text-foreground-muted">{t('bilingualContract.uploadHint')}</div>
          </button>
        )}
      </section>

      <section>
        <SectionHeader title={t('bilingualContract.languages')} />
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs text-foreground-muted">{t('bilingualContract.originalLanguage')}</span>
            <span className="relative block">
              <select value={contract.sourceLanguage} onChange={(event) => update({ sourceLanguage: event.target.value })} className={selectClass}>
                <option value="auto">{t('documentTranslate.languages.auto')}</option>
                {LANGUAGE_CODES.map((code) => <option key={code} value={code}>{t(`documentTranslate.languages.${code}`)}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted" />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-foreground-muted">{t('bilingualContract.targetLanguage')}</span>
            <span className="relative block">
              <select value={contract.targetLanguage} onChange={(event) => update({ targetLanguage: event.target.value })} className={selectClass}>
                {LANGUAGE_CODES.map((code) => <option key={code} value={code}>{t(`documentTranslate.languages.${code}`)}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted" />
            </span>
          </label>
        </div>
        {contract.sourceLanguage === contract.targetLanguage && (
          <p className="mt-2 text-[11px] text-amber-700">{t('bilingualContract.sameLanguage')}</p>
        )}
      </section>

      <section>
        <SectionHeader title={t('bilingualContract.layout')} />
        <div className="grid grid-cols-2 gap-2">
          {(['side-by-side', 'alternating'] as const).map((layout) => {
            const active = contract.layout === layout;
            return (
              <button
                key={layout}
                type="button"
                onClick={() => update({ layout })}
                aria-pressed={active}
                className={cn(
                  'rounded-xl border p-3 text-center transition-colors',
                  active ? 'border-accent bg-accent/10' : 'border-border bg-surface-elevated hover:bg-surface-sunken'
                )}
              >
                <LayoutPreview layout={layout} active={active} />
                <div className="mt-2 text-xs font-semibold text-foreground">{t(`bilingualContract.layouts.${layout}.label`)}</div>
                <div className="mt-0.5 text-[10px] leading-snug text-foreground-muted">{t(`bilingualContract.layouts.${layout}.description`)}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader title={t(isSideBySide ? 'bilingualContract.leftColumn' : 'bilingualContract.firstParagraph')} />
        <SegmentedControl
          value={contract.order}
          onChange={(order) => update({ order })}
          options={[
            { value: 'original-first', label: t('bilingualContract.orderOriginal') },
            { value: 'translation-first', label: t('bilingualContract.orderTranslation') },
          ]}
        />
      </section>

      <section>
        <SectionHeader title={t('bilingualContract.formatting')} />
        <div className="space-y-1">
          {isSideBySide && (
            <>
              <Toggle label={t('bilingualContract.columnHeaders')} checked={contract.columnHeaders} onChange={(columnHeaders) => update({ columnHeaders })} />
              <Toggle label={t('bilingualContract.columnDivider')} checked={contract.columnDivider} onChange={(columnDivider) => update({ columnDivider })} />
            </>
          )}
          <Toggle label={t('bilingualContract.italicTranslation')} checked={contract.italicTranslation} onChange={(italicTranslation) => update({ italicTranslation })} />
        </div>
      </section>

      <section>
        <SectionHeader title={t('documentTranslate.modelTitle')} />
        <div className="relative">
          <select
            value={contract.translationModel}
            onChange={(event) => {
              const model = event.target.value as DocumentTranslationModel;
              if (DOCUMENT_TRANSLATION_MODELS.includes(model)) update({ translationModel: model });
            }}
            className={selectClass}
          >
            {TRANSLATION_MODEL_OPTIONS.map((option) => (
              <option key={option.model} value={option.model}>{option.label} ({option.provider})</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted" />
        </div>
      </section>

      <div className="rounded-lg bg-surface-sunken p-3 text-[10px] leading-relaxed text-foreground-secondary">
        {t('bilingualContract.note')}
      </div>
    </div>
  );
};
