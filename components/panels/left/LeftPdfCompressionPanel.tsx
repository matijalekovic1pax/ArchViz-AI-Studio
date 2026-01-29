import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { nanoid } from 'nanoid';
import { FileText, Trash2 } from 'lucide-react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { cn } from '../../../lib/utils';

const formatFileSize = (bytes: number) => {
  if (!bytes && bytes !== 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${sizes[i]}`;
};

export const LeftPdfCompressionPanel: React.FC = () => {
   const { state, dispatch } = useAppStore();
   const { t } = useTranslation();
   const fileInputRef = useRef<HTMLInputElement>(null);
   const pdfState = state.workflow.pdfCompression;
   const maxBatchSize = 20;

  const updatePdfState = useCallback((payload: Partial<typeof pdfState>) => {
    dispatch({ type: 'UPDATE_WORKFLOW', payload: { pdfCompression: { ...pdfState, ...payload } } });
  }, [dispatch, pdfState]);

   const handleUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;
      const remainingSlots = Math.max(0, maxBatchSize - pdfState.queue.length);
      if (remainingSlots === 0) {
        if (event.target) {
          event.target.value = '';
        }
        return;
      }

      const newDocs = files.slice(0, remainingSlots).map((file) => ({
         id: nanoid(),
         name: file.name,
         size: file.size,
         dataUrl: '',
         uploadedAt: Date.now()
      }));

      const readers = files.slice(0, remainingSlots).map((file, index) => {
         return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.onerror = () => reject(new Error('Failed to read PDF'));
            reader.readAsDataURL(file);
      }).then((dataUrl) => ({ index, dataUrl }));
    });

    Promise.all(readers)
      .then((results) => {
        const updatedDocs = [...newDocs];
        results.forEach(({ index, dataUrl }) => {
          updatedDocs[index] = { ...updatedDocs[index], dataUrl };
        });

        const merged = [...pdfState.queue, ...updatedDocs];
        updatePdfState({
          queue: merged,
          selectedId: pdfState.selectedId ?? (updatedDocs[0]?.id || null)
        });
      })
      .catch((error) => {
        console.error('Failed to load PDFs', error);
      })
      .finally(() => {
        if (event.target) {
          event.target.value = '';
        }
      });
   }, [pdfState.queue.length, pdfState.selectedId, updatePdfState]);

  const handleRemove = useCallback((id: string) => {
    const nextQueue = pdfState.queue.filter((doc) => doc.id !== id);
    const nextSelected = pdfState.selectedId === id ? (nextQueue[0]?.id || null) : pdfState.selectedId;
    updatePdfState({ queue: nextQueue, selectedId: nextSelected });
  }, [pdfState.queue, pdfState.selectedId, updatePdfState]);

  const handleSelect = useCallback((id: string) => {
    updatePdfState({ selectedId: id });
  }, [updatePdfState]);

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader title={t('pdfCompression.queueTitle')} />
        <div className="space-y-2">
          {pdfState.queue.length === 0 && (
            <div className="text-[11px] text-foreground-muted bg-surface-sunken border border-border rounded-md p-3 text-center">
              {t('pdfCompression.emptyQueue')}
            </div>
          )}
          {pdfState.queue.map((doc) => {
            const isActive = pdfState.selectedId === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => handleSelect(doc.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSelect(doc.id);
                  }
                }}
                className={cn(
                  "flex w-full items-center gap-3 p-2 rounded border text-left transition-colors",
                  isActive
                    ? "border-accent bg-accent/10"
                    : "bg-surface-elevated border-border hover:border-foreground/40"
                )}
              >
                <div className="w-8 h-8 rounded bg-surface-sunken flex items-center justify-center">
                  <FileText size={14} className="text-foreground-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{doc.name}</div>
                  <div className="text-[10px] text-foreground-muted">{formatFileSize(doc.size)}</div>
                </div>
                <button
                  type="button"
                  className="text-foreground-muted hover:text-red-500"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemove(doc.id);
                  }}
                  title={t('pdfCompression.removeDocument')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            disabled={pdfState.queue.length >= maxBatchSize}
            className={cn(
              "w-full py-2 border border-dashed text-xs rounded transition-colors",
              pdfState.queue.length >= maxBatchSize
                ? "border-border text-foreground-muted/60 cursor-not-allowed"
                : "border-border text-foreground-muted hover:bg-surface-elevated"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            {pdfState.queue.length >= maxBatchSize
              ? t('pdfCompression.queueFull', { count: maxBatchSize })
              : t('pdfCompression.addPdfsCount', { count: maxBatchSize - pdfState.queue.length })}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>
    </div>
  );
};
