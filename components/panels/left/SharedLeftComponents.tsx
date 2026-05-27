
import React, { ChangeEvent, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Grid, Image as ImageIcon, Palette, Upload, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { BUILT_IN_STYLES } from '../../../engine/promptEngine';
import { StyleConfiguration } from '../../../types';

export const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <h3 className="text-[10px] font-bold text-foreground-muted mb-2 uppercase tracking-widest">{title}</h3>
);

export const StyleGrid: React.FC<{ activeId: string; onSelect: (id: string) => void; onBrowse: () => void; styles?: StyleConfiguration[] }> = ({ activeId, onSelect, onBrowse, styles }) => {
  const { t } = useTranslation();
  const availableStyles = styles && styles.length > 0 ? styles : BUILT_IN_STYLES;
  const displayStyles = useMemo(() => {
    const defaultStyles = availableStyles.slice(0, 4);
    const activeStyle = availableStyles.find(s => s.id === activeId);
    if (activeStyle && !defaultStyles.find(s => s.id === activeId)) {
       return [...defaultStyles.slice(0, 3), activeStyle];
    }
    return defaultStyles;
  }, [activeId, availableStyles]);

  const fallbackPreview = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNTAwIiB2aWV3Qm94PSIwIDAgODAwIDUwMCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iI2U5ZWVmNSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNkNmUwZWUiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNTAwIiBmaWxsPSJ1cmwoI2cpIi8+CiAgPGcgZmlsbD0iIzk0YTNiOCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIj4KICAgIDx0ZXh0IHg9IjQwIiB5PSI3MCI+UHJldmlldyB1bmF2YWlsYWJsZTwvdGV4dD4KICA8L2c+CiAgPHJlY3QgeD0iNDAiIHk9IjEwMCIgd2lkdGg9IjcyMCIgaGVpZ2h0PSIzIiBmaWxsPSIjYzNjZmRkIi8+CiAgPHJlY3QgeD0iNDAiIHk9IjEzMCIgd2lkdGg9IjUyMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2MzY2ZkZCIvPgogIDxyZWN0IHg9IjQwIiB5PSIxNTUiIHdpZHRoPSI0NjAiIGhlaWdodD0iMTAiIGZpbGw9IiNjM2NmZGQiLz4KPC9zdmc+';
  const fallbackPhoto = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80';
  const resolvePreviewUrl = (previewUrl?: string) =>
    previewUrl && previewUrl.trim() ? previewUrl : fallbackPhoto;
  const handlePreviewError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const fallback = e.currentTarget.dataset.fallback || '';
    if (fallback && e.currentTarget.src !== fallback && e.currentTarget.src !== fallbackPreview) {
      e.currentTarget.src = fallback;
      return;
    }
    if (e.currentTarget.src !== fallbackPreview) {
      e.currentTarget.src = fallbackPreview;
    }
  };
  const getStyleName = (style: StyleConfiguration) =>
    t(`styles.names.${style.id}`, { defaultValue: style.name });

  return (
    <div
      className="space-y-2"
      data-assistant-inspect-target="true"
      data-assistant-inspect-label={t('render3d.styleReference.presets')}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {displayStyles.map((style) => (
          <button
            key={style.id}
            onClick={() => onSelect(style.id)}
            className={cn(
              "relative h-14 rounded-md overflow-hidden border transition-all duration-200 text-left flex items-center group",
              activeId === style.id 
                 ? "border-foreground ring-2 ring-foreground shadow-md opacity-100 z-10 scale-[1.02]" 
                 : "border-border opacity-90 hover:opacity-100 hover:border-foreground-muted hover:scale-[1.01]"
            )}
          >
            <img
              src={resolvePreviewUrl(style.previewUrl)}
              alt={getStyleName(style)}
              onError={handlePreviewError}
              data-fallback={fallbackPhoto}
              className="absolute inset-0 z-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-0" />
            
            <div className="relative z-10 px-2 py-1 w-full">
              <p className="text-white text-[10px] font-bold leading-tight truncate w-full shadow-sm group-hover:text-accent-muted transition-colors">{getStyleName(style)}</p>
              <p className="text-white/80 text-[8px] truncate shadow-sm font-medium">{style.category}</p>
            </div>
            
            {activeId === style.id && (
               <div className="absolute top-1 right-1 w-4 h-4 bg-foreground text-background rounded-full flex items-center justify-center z-20 shadow-sm animate-scale-in">
                  <Check size={8} strokeWidth={3} />
               </div>
            )}
          </button>
        ))}
      </div>
      <button 
        onClick={onBrowse}
        className="w-full h-8 flex items-center justify-center gap-2 rounded border border-dashed border-border text-xs text-foreground-muted hover:text-foreground hover:border-foreground-muted hover:bg-surface-elevated transition-all"
      >
        <Grid size={12} />
        <span>{t('styles.browseAll')}</span>
      </button>
    </div>
  );
};

export const StyleReferenceUploader: React.FC<{
  enabled: boolean;
  image: string | null;
  presetContent: React.ReactNode;
  onSetEnabled: (enabled: boolean) => void;
  onSetImage: (image: string | null) => void;
}> = ({ enabled, image, presetContent, onSetEnabled, onSetImage }) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      onSetImage(reader.result as string);
      onSetEnabled(true);
    };
    reader.readAsDataURL(file);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onSetImage(null);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSetEnabled(false)}
          data-assistant-inspect-target="true"
          data-assistant-inspect-label={t('render3d.styleReference.presets')}
          className={cn(
            "h-8 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors",
            !enabled
              ? "bg-foreground text-background border-foreground"
              : "bg-surface-elevated border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted"
          )}
        >
          <Palette size={12} />
          <span>{t('render3d.styleReference.presets')}</span>
        </button>
        <button
          type="button"
          onClick={() => onSetEnabled(true)}
          data-assistant-inspect-target="true"
          data-assistant-inspect-label={t('render3d.styleReference.image')}
          className={cn(
            "h-8 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors",
            enabled
              ? "bg-foreground text-background border-foreground"
              : "bg-surface-elevated border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted"
          )}
        >
          <ImageIcon size={12} />
          <span>{t('render3d.styleReference.image')}</span>
        </button>
      </div>

      <div className="h-40">
        {enabled ? (
          <div className="relative h-full">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              data-assistant-inspect-target="true"
              data-assistant-inspect-label={t('render3d.styleReference.image')}
              className={cn(
                "relative h-full w-full overflow-hidden rounded-md border transition-all duration-200 group",
                "flex flex-col items-center justify-center gap-2 text-center",
                image
                  ? "border-border bg-surface-sunken hover:border-foreground-muted"
                  : "border-dashed border-border bg-surface-sunken hover:border-accent/60 hover:bg-surface-elevated"
              )}
              title={image ? t('render3d.styleReference.change') : t('render3d.styleReference.upload')}
            >
              {image ? (
                <>
                  <img
                    src={image}
                    alt={t('render3d.styleReference.alt')}
                    className="absolute inset-0 z-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10" />
                  <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center shadow-sm">
                    <Check size={10} strokeWidth={3} />
                  </div>
                </>
              ) : (
                <div className="w-12 h-12 rounded-full border border-border bg-surface-elevated flex items-center justify-center text-foreground-muted group-hover:text-accent transition-colors">
                  <Upload size={20} />
                </div>
              )}
              <div className={cn("relative z-10 px-4", image ? "text-white" : "text-foreground")}>
                <p className="text-xs font-bold leading-snug">
                  {image ? t('render3d.styleReference.change') : t('render3d.styleReference.upload')}
                </p>
                <p className={cn("mt-1 text-[10px] leading-snug", image ? "text-white/75" : "text-foreground-muted")}>
                  {t('render3d.styleReference.hint')}
                </p>
              </div>
            </button>
            {image && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 left-2 z-20 w-7 h-7 flex items-center justify-center rounded-full border border-white/20 bg-black/50 text-white hover:bg-rose-500 transition-colors"
                title={t('render3d.styleReference.remove')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        ) : (
          presetContent
        )}
      </div>
    </div>
  );
};
