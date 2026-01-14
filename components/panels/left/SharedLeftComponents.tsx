
import React, { useMemo } from 'react';
import { Check, Grid } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { BUILT_IN_STYLES } from '../../../engine/promptEngine';
import { StyleConfiguration } from '../../../types';

export const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <h3 className="text-[10px] font-bold text-foreground-muted mb-2 uppercase tracking-widest">{title}</h3>
);

export const StyleGrid: React.FC<{ activeId: string; onSelect: (id: string) => void; onBrowse: () => void; styles?: StyleConfiguration[] }> = ({ activeId, onSelect, onBrowse, styles }) => {
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

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
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
              alt={style.name}
              onError={handlePreviewError}
              data-fallback={fallbackPhoto}
              className="absolute inset-0 z-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-0" />
            
            <div className="relative z-10 px-2 py-1 w-full">
              <p className="text-white text-[10px] font-bold leading-tight truncate w-full shadow-sm group-hover:text-accent-muted transition-colors">{style.name}</p>
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
        <span>Browse All Styles</span>
      </button>
    </div>
  );
};
