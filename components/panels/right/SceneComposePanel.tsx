import React, { useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { Crosshair, MapPin, Trash2, Upload, X } from 'lucide-react';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';
import { getSceneComposeMarkerColor } from '../../../lib/sceneComposePlacement';

const MAX_INSERTION_REFERENCES = 20;

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });

export const SceneComposePanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const references = state.workflow.sceneInsertionReferences || [];
  const activePlacementId = state.workflow.sceneComposeActivePlacementId;

  const updateReferences = useCallback((
    next: typeof references,
    options?: { activePlacementId?: string | null }
  ) => {
    const nextActivePlacementId = options?.activePlacementId !== undefined
      ? options.activePlacementId
      : (activePlacementId && next.some((item) => item.id === activePlacementId) ? activePlacementId : null);

    dispatch({
      type: 'UPDATE_WORKFLOW',
      payload: {
        sceneInsertionReferences: next,
        sceneComposeActivePlacementId: nextActivePlacementId
      }
    });
  }, [activePlacementId, dispatch, references]);

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
        caption: '',
        placement: null
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
    updateReferences([], { activePlacementId: null });
  }, [updateReferences]);

  const handleTogglePlacementMode = useCallback((id: string) => {
    const isArmed = activePlacementId === id;
    dispatch({
      type: 'UPDATE_WORKFLOW',
      payload: {
        sceneComposeActivePlacementId: isArmed ? null : id
      }
    });
  }, [activePlacementId, dispatch]);

  const handleClearPlacement = useCallback((id: string) => {
    updateReferences(
      references.map((item) => (
        item.id === id ? { ...item, placement: null } : item
      )),
      { activePlacementId: activePlacementId === id ? null : activePlacementId }
    );
  }, [activePlacementId, references, updateReferences]);

  const activePlacementIndex = activePlacementId
    ? references.findIndex((item) => item.id === activePlacementId)
    : -1;
  const activePlacementReference = activePlacementIndex >= 0 ? references[activePlacementIndex] : null;
  const activePlacementLabel = activePlacementReference?.caption.trim().length
    ? activePlacementReference.caption.trim()
    : (activePlacementIndex >= 0 ? t('sceneCompose.insertions.referenceLabel', { index: activePlacementIndex + 1 }) : '');
  const activePlacementColor = activePlacementIndex >= 0
    ? getSceneComposeMarkerColor(activePlacementIndex)
    : '#0EA5E9';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-foreground-muted">
          {t('sceneCompose.insertions.title')}
        </label>
        <span className="text-[10px] text-foreground-muted font-mono">
          {references.length}/{MAX_INSERTION_REFERENCES}
        </span>
      </div>

      <p className="text-[11px] text-foreground-muted leading-relaxed">
        {t('sceneCompose.insertions.description')}
      </p>

      {activePlacementIndex >= 0 && (
        <div className="rounded border border-accent/30 bg-accent/10 px-3 py-2 text-[11px] text-foreground-secondary flex items-center gap-2">
          <Crosshair size={13} className="text-accent" />
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: activePlacementColor }}
          />
          {activePlacementReference && (
            <img
              src={activePlacementReference.image}
              alt={activePlacementLabel}
              className="w-5 h-5 rounded object-cover border border-white/80 shadow-sm"
            />
          )}
          {t('sceneCompose.insertions.placementArmedNamed', { label: activePlacementLabel })}
        </div>
      )}

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
        <div className="rounded border border-border bg-surface-elevated p-3 text-[11px] text-foreground-muted">
          {t('sceneCompose.insertions.emptyHint')}
        </div>
      ) : (
        <div className="space-y-3">
          {references.map((item, index) => (
            <div key={item.id} className="rounded-lg border border-border bg-surface-elevated overflow-hidden">
              <div className="h-1" style={{ backgroundColor: getSceneComposeMarkerColor(index) }} />
              <div className="relative">
                <img
                  src={item.image}
                  alt={`${t('sceneCompose.insertions.referenceAlt')} ${index + 1}`}
                  className="w-full h-44 object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-rose-500/80 transition-colors"
                  title={t('sceneCompose.insertions.remove')}
                >
                  <X size={12} />
                </button>
              </div>

              <div className="p-2 border-t border-border-subtle">
                <div className="text-[10px] text-foreground-muted mb-1.5 flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: getSceneComposeMarkerColor(index) }}
                  />
                  {t('sceneCompose.insertions.referenceLabel', { index: index + 1 })}
                </div>
                <input
                  type="text"
                  value={item.caption}
                  onChange={(event) => handleCaptionChange(item.id, event.target.value)}
                  placeholder={t('sceneCompose.insertions.captionPlaceholder')}
                  maxLength={220}
                  className="w-full h-8 bg-background border border-border rounded text-xs px-2 text-foreground placeholder:text-foreground-muted/70 focus:outline-none focus:border-accent"
                />

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTogglePlacementMode(item.id)}
                    className={cn(
                      'h-7 px-2 rounded border text-[10px] font-semibold transition-colors flex items-center gap-1.5',
                      activePlacementId === item.id
                        ? 'border-accent bg-accent/15 text-foreground'
                        : 'border-border bg-background text-foreground-muted hover:text-foreground hover:border-foreground-muted'
                    )}
                  >
                    <Crosshair size={11} />
                    {activePlacementId === item.id
                      ? t('sceneCompose.insertions.cancelPlacement')
                      : item.placement
                        ? t('sceneCompose.insertions.repositionOnCanvas')
                        : t('sceneCompose.insertions.placeOnCanvas')}
                  </button>

                  {item.placement && (
                    <button
                      type="button"
                      onClick={() => handleClearPlacement(item.id)}
                      className="h-7 px-2 rounded border border-border bg-background text-[10px] font-semibold text-foreground-muted hover:text-rose-500 hover:border-rose-500/50 transition-colors"
                    >
                      {t('sceneCompose.insertions.clearPlacement')}
                    </button>
                  )}
                </div>

                {item.placement ? (
                  <div className="mt-1.5 text-[10px] text-foreground-secondary flex items-center gap-1.5">
                    <MapPin size={10} style={{ color: getSceneComposeMarkerColor(index) }} />
                    {t('sceneCompose.insertions.placementSet', {
                      x: (item.placement.x * 100).toFixed(1),
                      y: (item.placement.y * 100).toFixed(1)
                    })}
                  </div>
                ) : (
                  <div className="mt-1.5 text-[10px] text-foreground-muted">
                    {t('sceneCompose.insertions.placementNotSet')}
                  </div>
                )}
              </div>
            </div>
          ))}

          {references.length > 1 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="w-full h-8 rounded border border-border bg-surface-elevated text-xs text-foreground-muted hover:text-rose-500 hover:border-rose-500/50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 size={12} />
              {t('sceneCompose.insertions.clearAll')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
