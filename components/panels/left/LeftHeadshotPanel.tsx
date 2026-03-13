import React, { useRef, useCallback } from 'react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { Upload, X, Download } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { downloadImage } from '../../../lib/download';

const ANGLE_SLOTS: { key: 'leftImage' | 'frontImage' | 'rightImage'; label: string; hint: string }[] = [
  { key: 'leftImage', label: 'Left Side', hint: '90° left profile' },
  { key: 'frontImage', label: 'Front', hint: 'Straight-on, primary' },
  { key: 'rightImage', label: 'Right Side', hint: '90° right profile' },
];

export const LeftHeadshotPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;
  const hs = wf.headshot;
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileSelect = useCallback(
    (key: 'leftImage' | 'frontImage' | 'rightImage', file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        dispatch({ type: 'UPDATE_WORKFLOW', payload: { headshot: { ...hs, [key]: dataUrl } } });
        // Mirror the front image to the main canvas so it's visible
        if (key === 'frontImage') {
          dispatch({ type: 'SET_IMAGE', payload: dataUrl });
        }
      };
      reader.readAsDataURL(file);
    },
    [dispatch, hs]
  );

  const handleRemove = useCallback(
    (key: 'leftImage' | 'frontImage' | 'rightImage') => {
      dispatch({ type: 'UPDATE_WORKFLOW', payload: { headshot: { ...hs, [key]: null } } });
    },
    [dispatch, hs]
  );

  const handleDrop = useCallback(
    (key: 'leftImage' | 'frontImage' | 'rightImage', e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        handleFileSelect(key, file);
      }
    },
    [handleFileSelect]
  );

  const uploadedCount = [hs.leftImage, hs.frontImage, hs.rightImage].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Reference Images */}
      <div>
        <SectionHeader title="Reference Photos" />
        <p className="text-[10px] text-foreground-muted mb-3 leading-relaxed">
          Upload up to 3 photos of the person from different angles for best results.
        </p>

        <div className="space-y-2">
          {ANGLE_SLOTS.map(({ key, label, hint }) => {
            const imageUrl = hs[key];
            return (
              <div key={key}>
                {imageUrl ? (
                  <div
                    className="relative rounded-lg overflow-hidden border border-border group"
                    style={{
                      height: '96px',
                      backgroundImage: `url(${imageUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemove(key)}
                        className="p-1.5 bg-red-500/90 rounded-full text-white hover:bg-red-600 transition-colors"
                        title="Remove"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 flex items-center justify-between">
                      <span className="text-[10px] text-white font-semibold">{label}</span>
                      <span className="text-[9px] text-white/70">{hint}</span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[key]?.click()}
                    onDrop={(e) => handleDrop(key, e)}
                    onDragOver={(e) => e.preventDefault()}
                    className="w-full h-16 border-2 border-dashed border-border rounded-lg flex items-center justify-between px-3 hover:border-foreground-muted hover:bg-surface-elevated transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <Upload size={14} className="text-foreground-muted group-hover:text-foreground transition-colors" />
                      <div className="text-left">
                        <div className="text-xs font-medium text-foreground-muted group-hover:text-foreground transition-colors">{label}</div>
                        <div className="text-[10px] text-foreground-muted/60">{hint}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-foreground-muted/60">Click or drop</span>
                  </button>
                )}
                <input
                  ref={(el) => { fileInputRefs.current[key] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(key, file);
                    e.target.value = '';
                  }}
                />
              </div>
            );
          })}
        </div>

        {uploadedCount > 0 && (
          <p className="text-[10px] text-foreground-muted mt-2 text-center">
            {uploadedCount}/3 reference{uploadedCount > 1 ? 's' : ''} uploaded
          </p>
        )}
        {uploadedCount === 0 && (
          <p className="text-[10px] text-foreground-muted/60 mt-2 text-center">
            Front photo is recommended. More angles = better results.
          </p>
        )}
      </div>

      {/* Generated Headshots */}
      {hs.generatedItems.length > 0 && (
        <div>
          <SectionHeader title="Generated Headshots" />
          <div className="space-y-2">
            {hs.generatedItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  dispatch({ type: 'SET_IMAGE', payload: item.url });
                  dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
                  dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
                }}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded border text-left transition-colors relative',
                  item.url === state.uploadedImage
                    ? 'border-accent bg-accent/10'
                    : 'bg-surface-elevated border-border hover:border-foreground/40'
                )}
              >
                <div
                  className="w-10 h-10 rounded bg-surface-sunken overflow-hidden shrink-0"
                  style={{ backgroundImage: `url(${item.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate capitalize">
                    {item.style === 'website-custom' ? 'Website Custom' : 'Professional'} #{index + 1}
                  </div>
                  <div className="text-[10px] text-foreground-muted capitalize">{item.colorMode.replace('-', ' ')}</div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadImage(item.url, `headshot-${item.style}-${index + 1}.png`);
                  }}
                  className="p-1 text-foreground-muted hover:text-foreground transition-colors"
                  title="Download"
                >
                  <Download size={12} />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
