import React, { useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Trash2, Upload, X } from 'lucide-react';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';
import { LeftRender3DPanel } from './LeftRender3DPanel';
import { SectionHeader } from './SharedLeftComponents';

const MAX_INSERTION_REFERENCES = 12;

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });

export const LeftSceneComposePanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const references = state.workflow.sceneInsertionReferences || [];

  const updateReferences = useCallback(
    (next: typeof references) => {
      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: { sceneInsertionReferences: next }
      });
    },
    [dispatch, references]
  );

  const handleUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) {
      event.target.value = '';
      return;
    }

    const remainingSlots = Math.max(0, MAX_INSERTION_REFERENCES - references.length);
    const filesToAdd = files.slice(0, remainingSlots);

    if (filesToAdd.length === 0) {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: nanoid(),
          tone: 'warning',
          message: t('sceneCompose.insertions.limitReached', { max: MAX_INSERTION_REFERENCES })
        }
      });
      event.target.value = '';
      return;
    }

    try {
      const dataUrls = await Promise.all(filesToAdd.map(readFileAsDataUrl));
      const nextItems = dataUrls.map((image) => ({
        id: nanoid(),
        image,
        caption: ''
      }));
      updateReferences([...references, ...nextItems]);

      if (files.length > remainingSlots) {
        dispatch({
          type: 'SET_APP_ALERT',
          payload: {
            id: nanoid(),
            tone: 'warning',
            message: t('sceneCompose.insertions.limitWarning', { max: MAX_INSERTION_REFERENCES })
          }
        });
      }
    } catch {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: nanoid(),
          tone: 'error',
          message: t('sceneCompose.insertions.uploadError')
        }
      });
    } finally {
      event.target.value = '';
    }
  }, [dispatch, references, t, updateReferences]);

  const handleCaptionChange = useCallback((id: string, caption: string) => {
    updateReferences(
      references.map((item) => (item.id === id ? { ...item, caption } : item))
    );
  }, [references, updateReferences]);

  const handleRemove = useCallback((id: string) => {
    updateReferences(references.filter((item) => item.id !== id));
  }, [references, updateReferences]);

  const handleClearAll = useCallback(() => {
    updateReferences([]);
  }, [updateReferences]);

  return (
    <div className="space-y-6">
      <LeftRender3DPanel />

      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader title={t('sceneCompose.insertions.title')} />
          <span className="text-[10px] text-foreground-muted font-mono">
            {references.length}/{MAX_INSERTION_REFERENCES}
          </span>
        </div>

        <p className="text-[10px] text-foreground-muted mb-3 leading-relaxed">
          {t('sceneCompose.insertions.description')}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'w-full h-9 rounded border border-dashed border-border bg-surface-elevated',
            'flex items-center justify-center gap-2 text-xs text-foreground-muted',
            'hover:border-foreground-muted hover:text-foreground transition-colors'
          )}
        >
          <Upload size={13} />
          {t('sceneCompose.insertions.addButton')}
        </button>

        {references.length === 0 ? (
          <div className="mt-3 rounded border border-border bg-surface-elevated p-3 text-[10px] text-foreground-muted">
            {t('sceneCompose.insertions.emptyHint')}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {references.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-border bg-surface-elevated p-2">
                <div className="flex items-start gap-2">
                  <div className="w-14 h-14 rounded overflow-hidden border border-border bg-surface-sunken shrink-0">
                    <img
                      src={item.image}
                      alt={`${t('sceneCompose.insertions.referenceAlt')} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-foreground-secondary flex items-center gap-1">
                        <ImagePlus size={11} />
                        {t('sceneCompose.insertions.referenceLabel', { index: index + 1 })}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        className="p-1 rounded text-foreground-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title={t('sceneCompose.insertions.remove')}
                      >
                        <X size={12} />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={item.caption}
                      onChange={(event) => handleCaptionChange(item.id, event.target.value)}
                      placeholder={t('sceneCompose.insertions.captionPlaceholder')}
                      maxLength={220}
                      className="w-full h-8 bg-background border border-border rounded text-xs px-2 text-foreground placeholder:text-foreground-muted/70 focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>
            ))}

            {references.length > 1 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="w-full h-8 mt-1 rounded border border-border bg-surface-elevated text-xs text-foreground-muted hover:text-rose-500 hover:border-rose-500/50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={12} />
                {t('sceneCompose.insertions.clearAll')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
