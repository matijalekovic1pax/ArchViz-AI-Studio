import React, { useState, useMemo } from 'react';
import { Search, X, Grid, Box, Check } from 'lucide-react';
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
      <div className="w-[800px] h-[600px] bg-background flex flex-col rounded-xl shadow-2xl overflow-hidden border border-border animate-scale-in">
        
        {/* Header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-surface-elevated shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-surface-sunken flex items-center justify-center text-foreground-secondary">
                <Grid size={18} />
             </div>
             <div>
                <h2 className="text-sm font-bold tracking-tight">Style Library</h2>
                <span className="text-[10px] text-foreground-muted">{BUILT_IN_STYLES.length} styles available</span>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={14} />
              <input 
                type="text" 
                placeholder="Search styles..." 
                className="h-8 pl-9 pr-3 text-xs bg-surface-sunken border-transparent rounded-lg focus:bg-surface-elevated focus:border-accent focus:outline-none transition-all w-48"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-surface-sunken rounded-lg text-foreground-muted hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Categories */}
          <div className="w-40 bg-surface-sunken border-r border-border p-3 flex flex-col gap-1 shrink-0 overflow-y-auto">
            <div className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mb-2 px-2">Categories</div>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-all text-left group",
                  activeCategory === cat 
                    ? "bg-surface-elevated text-foreground shadow-subtle border border-border-subtle" 
                    : "text-foreground-secondary hover:bg-surface-elevated/50 hover:text-foreground"
                )}
              >
                <span>{cat}</span>
                {activeCategory === cat && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
              </button>
            ))}
          </div>

          {/* Grid Content */}
          <div className="flex-1 bg-surface-elevated p-4 overflow-y-auto custom-scrollbar">
            {filteredStyles.length > 0 ? (
               <div className="grid grid-cols-3 gap-3">
               {filteredStyles.map(style => (
                  <button
                     key={style.id}
                     onClick={() => { onSelect(style.id); onClose(); }}
                     className={cn(
                     "group relative aspect-[16/10] flex flex-col text-left border rounded-lg overflow-hidden transition-all duration-200",
                     activeStyleId === style.id 
                        ? "border-foreground ring-2 ring-foreground shadow-lg scale-[0.98] z-10" 
                        : "border-border hover:border-foreground-muted hover:shadow-md hover:scale-[1.01]"
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
                     <div className="absolute top-2 right-2 w-6 h-6 bg-foreground text-background rounded-full flex items-center justify-center shadow-md z-20 animate-scale-in">
                        <Check size={14} strokeWidth={3} />
                     </div>
                     )}

                     <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white text-sm font-bold mb-0.5 leading-tight shadow-sm">{style.name}</p>
                        <p className="text-white/80 text-[10px] line-clamp-2 leading-relaxed">{style.description}</p>
                     </div>
                  </button>
               ))}
               </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-foreground-muted">
                  <Box size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">No styles found matching "{searchQuery}"</p>
                  <button 
                     onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
                     className="mt-2 text-xs text-accent hover:underline"
                  >
                     Clear filters
                  </button>
               </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="h-9 bg-surface-sunken border-t border-border flex items-center justify-between px-4 text-[10px] text-foreground-muted shrink-0">
           <span>Select a style to immediately apply its parameters.</span>
           <div className="flex gap-4">
              <span className="flex items-center gap-1"><span className="w-4 h-4 border border-border rounded flex items-center justify-center bg-surface-elevated">↵</span> Select</span>
              <span className="flex items-center gap-1"><span className="w-4 h-4 border border-border rounded flex items-center justify-center bg-surface-elevated">Esc</span> Cancel</span>
           </div>
        </div>
      </div>
    </div>
  );
};