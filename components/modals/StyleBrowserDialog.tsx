import React, { useState, useMemo } from 'react';
import { Search, X, Grid, Box } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BUILT_IN_STYLES } from '../../engine/promptEngine';

interface StyleBrowserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  activeStyleId: string;
  onSelect: (id: string) => void;
}

export const StyleBrowserDialog: React.FC<StyleBrowserDialogProps> = ({ 
  isOpen, 
  onClose, 
  activeStyleId, 
  onSelect 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const cats = new Set(BUILT_IN_STYLES.map(s => s.category));
    return ['All', ...Array.from(cats)];
  }, []);

  const filteredStyles = useMemo(() => {
    return BUILT_IN_STYLES.filter(style => {
      const matchesCategory = activeCategory === 'All' || style.category === activeCategory;
      const matchesSearch = style.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          style.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-[600px] h-[450px] bg-background flex flex-col rounded-lg shadow-2xl overflow-hidden border border-border animate-scale-in">
        
        {/* Header - Compact */}
        <div className="h-10 border-b border-border flex items-center justify-between px-3 bg-surface-elevated shrink-0">
          <div className="flex items-center gap-2">
             <div className="w-6 h-6 rounded bg-surface-sunken flex items-center justify-center text-foreground-secondary">
                <Grid size={14} />
             </div>
             <h2 className="text-xs font-semibold tracking-wide">Style Library</h2>
             <span className="text-[10px] text-foreground-muted bg-surface-sunken px-1.5 rounded-full">
                {BUILT_IN_STYLES.length}
             </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-foreground-muted" size={12} />
              <input 
                type="text" 
                placeholder="Search..." 
                className="h-6 pl-7 pr-2 text-[10px] bg-surface-sunken border-transparent rounded focus:bg-surface-elevated focus:border-accent focus:outline-none transition-all w-32"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-surface-sunken rounded text-foreground-muted hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Categories - Compact */}
          <div className="w-32 bg-surface-sunken border-r border-border p-2 flex flex-col gap-0.5 shrink-0 overflow-y-auto">
            <div className="text-[9px] font-bold text-foreground-muted uppercase tracking-wider mb-1 px-2 pt-1">Categories</div>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "flex items-center justify-between px-2 py-1.5 text-[10px] font-medium rounded transition-all text-left group",
                  activeCategory === cat 
                    ? "bg-surface-elevated text-foreground shadow-subtle" 
                    : "text-foreground-secondary hover:bg-background/50 hover:text-foreground"
                )}
              >
                <span>{cat}</span>
                {activeCategory === cat && <div className="w-1 h-1 rounded-full bg-accent" />}
              </button>
            ))}
          </div>

          {/* Grid Content - Compact */}
          <div className="flex-1 bg-surface-elevated p-3 overflow-y-auto custom-scrollbar">
            {filteredStyles.length > 0 ? (
               <div className="grid grid-cols-3 gap-2">
               {filteredStyles.map(style => (
                  <button
                     key={style.id}
                     onClick={() => { onSelect(style.id); onClose(); }}
                     className={cn(
                     "group relative aspect-[16/10] flex flex-col text-left border rounded overflow-hidden transition-all duration-200",
                     activeStyleId === style.id 
                        ? "border-foreground ring-1 ring-foreground" 
                        : "border-border hover:border-foreground-muted hover:shadow-subtle"
                     )}
                  >
                     {/* Preview Gradient */}
                     <div 
                     className="absolute inset-0 opacity-80 transition-transform duration-700 group-hover:scale-105" 
                     style={{ background: style.previewUrl }} 
                     />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                     
                     {/* Active Indicator */}
                     {activeStyleId === style.id && (
                     <div className="absolute top-1 right-1 w-3 h-3 bg-foreground text-background rounded-full flex items-center justify-center shadow-sm">
                        <div className="w-1 h-1 bg-white rounded-full" />
                     </div>
                     )}

                     <div className="absolute bottom-0 left-0 right-0 p-2">
                     <p className="text-white text-[11px] font-semibold mb-0 leading-tight">{style.name}</p>
                     <p className="text-white/70 text-[9px] line-clamp-1 mt-0.5">{style.category}</p>
                     </div>
                  </button>
               ))}
               </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-foreground-muted">
                  <Box size={32} className="mb-2 opacity-20" />
                  <p className="text-xs">No styles found</p>
               </div>
            )}
          </div>
        </div>
        
        {/* Footer - Compact */}
        <div className="h-7 bg-surface-sunken border-t border-border flex items-center justify-between px-3 text-[9px] text-foreground-muted shrink-0">
           <span>Select to apply</span>
           <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
};