
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Grid, Box, Check, Plus, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { nanoid } from 'nanoid';
import { StyleConfiguration } from '../../types';

interface StyleBrowserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  activeStyleId: string;
  onSelect: (id: string) => void;
  styles: StyleConfiguration[];
  onAddStyle: (style: StyleConfiguration) => void;
}

export const StyleBrowserDialog: React.FC<StyleBrowserDialogProps> = ({ 
  isOpen, 
  onClose, 
  activeStyleId, 
  onSelect,
  styles,
  onAddStyle
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [detailStyle, setDetailStyle] = useState<StyleConfiguration | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const clickTimeoutRef = useRef<number | null>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(styles.map(s => s.category));
    return ['All', ...Array.from(cats)];
  }, [styles]);

  const filteredStyles = useMemo(() => {
    return styles.filter(style => {
      const matchesCategory = activeCategory === 'All' || style.category === activeCategory;
      const matchesSearch = style.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          style.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery, styles]);

  const handleStyleClick = (style: StyleConfiguration) => {
    if (clickTimeoutRef.current) {
      window.clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = window.setTimeout(() => {
      onSelect(style.id);
      onClose();
    }, 220);
  };

  const handleStyleDoubleClick = (style: StyleConfiguration) => {
    if (clickTimeoutRef.current) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    setDetailStyle(style);
  };

  const resetCreateForm = () => {
    setCreateName('');
    setCreateDescription('');
    setCoverUrlInput('');
    setCoverPreview('');
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    resetCreateForm();
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') {
        setCoverPreview(result);
        setCoverUrlInput('');
      }
    };
    reader.readAsDataURL(file);
  };

  const applyCoverUrl = () => {
    const trimmed = coverUrlInput.trim();
    if (!trimmed) return;
    setCoverPreview(trimmed);
  };

  const handleCreateStyle = () => {
    const name = createName.trim();
    const description = createDescription.trim();
    if (!name || !description || !coverPreview) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newStyle: StyleConfiguration = {
      id: `${slug || 'custom-style'}-${nanoid(6)}`,
      name,
      category: 'Custom',
      description,
      previewUrl: coverPreview,
      promptBundle: {
        architectureVocabulary: [],
        materialBias: { primary: [], secondary: [], avoid: [] },
        lightingBias: { preferred: [], avoid: [] },
        cameraBias: { preferredAngles: [], preferredFraming: [] },
        renderingLanguage: { quality: [], atmosphere: [], detail: [] }
      }
    };
    onAddStyle(newStyle);
    onSelect(newStyle.id);
    closeCreateModal();
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-[640px] h-[480px] bg-background flex flex-col rounded-xl shadow-2xl overflow-hidden border border-border animate-scale-in">
        
        {/* Header */}
        <div className="h-10 border-b border-border flex items-center justify-between px-3 bg-surface-elevated shrink-0">
          <div className="flex items-center gap-2">
             <div className="w-6 h-6 rounded-md bg-surface-sunken flex items-center justify-center text-foreground-secondary">
                <Grid size={14} />
             </div>
             <div>
                <h2 className="text-xs font-bold tracking-tight">Style Library</h2>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="h-6 px-2.5 text-[10px] rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-1"
              title="Create New Style"
            >
              <Plus size={12} />
              New
            </button>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-foreground-muted" size={12} />
              <input 
                type="text" 
                placeholder="Search..." 
                className="h-6 pl-7 pr-2 text-[10px] bg-surface-sunken border-transparent rounded-md focus:bg-surface-elevated focus:border-accent focus:outline-none transition-all w-32"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-surface-sunken rounded-md text-foreground-muted hover:text-foreground transition-colors border border-transparent hover:border-border"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Categories */}
          <div className="w-32 bg-surface-sunken border-r border-border p-2 flex flex-col gap-0.5 shrink-0 overflow-y-auto">
            <div className="text-[9px] font-bold text-foreground-muted uppercase tracking-wider mb-1 px-2">Categories</div>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "flex items-center justify-between px-2 py-1.5 text-[10px] font-medium rounded-md transition-all text-left group",
                  activeCategory === cat 
                    ? "bg-surface-elevated text-foreground shadow-subtle border border-border-subtle" 
                    : "text-foreground-secondary hover:bg-surface-elevated/50 hover:text-foreground"
                )}
              >
                <span>{cat}</span>
                {activeCategory === cat && <div className="w-1 h-1 rounded-full bg-accent" />}
              </button>
            ))}
          </div>

          {/* Grid Content */}
          <div className="flex-1 bg-surface-elevated p-3 overflow-y-auto custom-scrollbar">
            {filteredStyles.length > 0 ? (
               <div className="grid grid-cols-3 gap-2">
               {filteredStyles.map(style => {
                  const isNoStyle = style.id === 'no-style';
                  return (
                  <button
                     key={style.id}
                     onClick={() => handleStyleClick(style)}
                     onDoubleClick={() => handleStyleDoubleClick(style)}
                     className={cn(
                     "group relative aspect-[16/10] flex flex-col text-left border rounded-md overflow-hidden transition-all duration-200",
                     activeStyleId === style.id 
                        ? "border-foreground ring-1 ring-foreground shadow-md scale-[0.98] z-10" 
                        : "border-border hover:border-foreground-muted hover:shadow-sm hover:scale-[1.01]"
                     )}
                  >
                     {/* Preview Image */}
                     {isNoStyle ? (
                       <div className="absolute inset-0 bg-surface-sunken" />
                     ) : (
                       <>
                         <img
                           src={resolvePreviewUrl(style.previewUrl)}
                           alt={style.name}
                           onError={handlePreviewError}
                           data-fallback={fallbackPhoto}
                           className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                         />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                       </>
                     )}
                     
                     {/* Active Indicator */}
                     {activeStyleId === style.id && (
                     <div className="absolute top-1 right-1 w-4 h-4 bg-foreground text-background rounded-full flex items-center justify-center shadow-md z-20 animate-scale-in">
                        <Check size={10} strokeWidth={3} />
                     </div>
                     )}

                     <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p
                          className={cn(
                            "text-xs font-bold mb-0.5 leading-tight shadow-sm truncate",
                            isNoStyle ? "text-foreground" : "text-white"
                          )}
                        >
                          {style.name}
                        </p>
                     </div>
                  </button>
                  );
               })}
               </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-foreground-muted">
                  <Box size={32} className="mb-2 opacity-20" />
                  <p className="text-xs">No styles found</p>
                  <button 
                     onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
                     className="mt-2 text-[10px] text-accent hover:underline"
                  >
                     Clear filters
                  </button>
               </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="h-7 bg-surface-sunken border-t border-border flex items-center justify-between px-3 text-[9px] text-foreground-muted shrink-0">
           <span>Select a style to apply. Double-click for details.</span>
           <div className="flex gap-3">
              <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 border border-border rounded flex items-center justify-center bg-surface-elevated text-[8px]">↵</span> Select</span>
              <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 border border-border rounded flex items-center justify-center bg-surface-elevated text-[8px]">Esc</span> Cancel</span>
           </div>
        </div>
      </div>
    </div>

    {detailStyle && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="w-[520px] max-w-[95vw] bg-background rounded-2xl border border-border shadow-2xl overflow-hidden animate-scale-in">
          <div className="h-11 px-4 flex items-center justify-between border-b border-border bg-surface-elevated">
            <div className="text-xs font-bold tracking-tight">{detailStyle.name}</div>
            <button
              onClick={() => setDetailStyle(null)}
              className="p-1.5 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="relative w-full h-48 rounded-xl overflow-hidden border border-border bg-surface-sunken">
              {detailStyle.id === 'no-style' ? (
                <div className="absolute inset-0 bg-surface-sunken flex items-center justify-center text-sm font-semibold text-foreground">
                  No Style
                </div>
              ) : (
                <>
                  <img
                    src={resolvePreviewUrl(detailStyle.previewUrl)}
                    alt={detailStyle.name}
                    onError={handlePreviewError}
                    data-fallback={fallbackPhoto}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 text-white text-sm font-semibold">{detailStyle.name}</div>
                </>
              )}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Style Description</div>
            <div className="text-sm leading-relaxed text-foreground bg-surface-sunken/60 border border-border rounded-xl p-3">
              {detailStyle.description}
            </div>
          </div>
          <div className="h-12 px-4 flex items-center justify-between border-t border-border bg-surface-sunken">
            <span className="text-[10px] text-foreground-muted">Double-click opens details. Use to apply.</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDetailStyle(null)}
                className="h-8 px-3 text-[11px] rounded-md border border-border text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onSelect(detailStyle.id);
                  onClose();
                  setDetailStyle(null);
                }}
                className="h-8 px-3 text-[11px] rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
              >
                Use Style
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {isCreateOpen && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="w-[560px] max-w-[95vw] bg-background rounded-2xl border border-border shadow-2xl overflow-hidden animate-scale-in">
          <div className="h-11 px-4 flex items-center justify-between border-b border-border bg-surface-elevated">
            <div className="text-xs font-bold tracking-tight">Create New Style</div>
            <button
              onClick={closeCreateModal}
              className="p-1.5 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Style Name</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="mt-2 w-full h-9 px-3 text-sm bg-surface-sunken border border-border rounded-lg focus:outline-none focus:border-accent"
                placeholder="e.g. Coastal Minimal"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Cover Picture</label>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <div className="relative h-32 rounded-xl border border-border bg-surface-sunken overflow-hidden">
                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      onError={handlePreviewError}
                      data-fallback={fallbackPhoto}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-foreground-muted">
                      <div className="flex items-center gap-2 text-[11px]">
                        <ImageIcon size={16} />
                        No cover selected
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => coverFileRef.current?.click()}
                    className="h-9 px-3 text-[11px] rounded-lg border border-border bg-surface-elevated hover:bg-surface-sunken transition-colors"
                  >
                    Upload
                  </button>
                  <input
                    type="file"
                    ref={coverFileRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleCoverFileChange}
                  />
                  <div className="text-[10px] text-foreground-muted">or paste a URL</div>
                  <input
                    type="text"
                    value={coverUrlInput}
                    onChange={(e) => setCoverUrlInput(e.target.value)}
                    className="h-8 px-2 text-[11px] bg-surface-sunken border border-border rounded-lg focus:outline-none focus:border-accent"
                    placeholder="https://..."
                  />
                  <button
                    onClick={applyCoverUrl}
                    className="h-8 px-2 text-[11px] rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors"
                  >
                    Use URL
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Description</label>
              <textarea
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                className="mt-2 w-full min-h-[110px] px-3 py-2 text-sm bg-surface-sunken border border-border rounded-lg focus:outline-none focus:border-accent resize-none"
                placeholder="Describe the mood, materials, and architectural cues..."
              />
            </div>
          </div>
          <div className="h-12 px-4 flex items-center justify-between border-t border-border bg-surface-sunken">
            <span className="text-[10px] text-foreground-muted">Required: name, cover picture, description.</span>
            <div className="flex items-center gap-2">
              <button
                onClick={closeCreateModal}
                className="h-8 px-3 text-[11px] rounded-md border border-border text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateStyle}
                disabled={!createName.trim() || !createDescription.trim() || !coverPreview}
                className={cn(
                  "h-8 px-3 text-[11px] rounded-md transition-colors",
                  !createName.trim() || !createDescription.trim() || !coverPreview
                    ? "bg-foreground/30 text-background/70 cursor-not-allowed"
                    : "bg-foreground text-background hover:bg-foreground/90"
                )}
              >
                Save Style
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
