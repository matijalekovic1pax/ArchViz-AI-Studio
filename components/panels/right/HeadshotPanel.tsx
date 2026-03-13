import React from 'react';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';
import { UserCircle, Image, Palette } from 'lucide-react';

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[10px] font-bold text-foreground-muted mb-2 uppercase tracking-widest">{children}</h3>
);

const OptionCard: React.FC<{
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
  icon?: React.ReactNode;
  preview?: string;
}> = ({ active, onClick, title, description, icon, preview }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full text-left rounded-lg border p-3 transition-all duration-200 flex gap-3',
      active
        ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
        : 'border-border bg-surface-elevated hover:border-foreground-muted hover:bg-surface-sunken'
    )}
  >
    {preview && (
      <div className="w-14 h-14 rounded-md overflow-hidden shrink-0 border border-border bg-surface-sunken flex items-center justify-center">
        <img src={preview} alt={title} className="w-full h-full object-cover" />
      </div>
    )}
    {!preview && icon && (
      <div className={cn('w-10 h-10 rounded-md shrink-0 flex items-center justify-center border', active ? 'border-accent/50 bg-accent/20 text-accent' : 'border-border bg-surface-sunken text-foreground-muted')}>
        {icon}
      </div>
    )}
    <div className="min-w-0">
      <div className={cn('text-xs font-semibold leading-tight', active ? 'text-accent' : 'text-foreground')}>{title}</div>
      <div className="text-[10px] text-foreground-muted leading-snug mt-0.5">{description}</div>
    </div>
  </button>
);

export const HeadshotPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;
  const hs = wf.headshot;

  const updateHs = (updates: Partial<typeof hs>) =>
    dispatch({ type: 'UPDATE_WORKFLOW', payload: { headshot: { ...hs, ...updates } } });

  return (
    <div className="space-y-5 p-1">

      {/* Style */}
      <div>
        <SectionTitle>Headshot Style</SectionTitle>
        <div className="space-y-2">
          <OptionCard
            active={hs.style === 'professional'}
            onClick={() => updateHs({ style: 'professional' })}
            icon={<UserCircle size={18} />}
            title="Professional"
            description="Standard front-facing career headshot. Perfect for LinkedIn, company bios, and ID cards."
          />
          <OptionCard
            active={hs.style === 'website-custom'}
            onClick={() => updateHs({ style: 'website-custom' })}
            icon={<Image size={18} />}
            title="Website Custom"
            description="Cinematic side-profile portrait. Person shown immersed in work — designed for team pages."
          />
        </div>
      </div>

      {/* Color Mode */}
      <div>
        <SectionTitle>Color Treatment</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'color', label: 'Color', sub: 'Natural tones' },
            { value: 'black-and-white', label: 'Black & White', sub: 'Timeless monochrome' },
          ] as const).map(({ value, label, sub }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateHs({ colorMode: value })}
              className={cn(
                'flex flex-col items-center justify-center gap-1 h-16 rounded-lg border text-center transition-all',
                hs.colorMode === value
                  ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
                  : 'border-border bg-surface-elevated hover:border-foreground-muted'
              )}
            >
              <div
                className={cn('w-5 h-5 rounded-full border-2', value === 'color' ? 'bg-gradient-to-br from-blue-400 to-pink-400 border-transparent' : 'bg-gradient-to-br from-gray-200 to-gray-700 border-transparent')}
              />
              <span className={cn('text-xs font-semibold leading-tight', hs.colorMode === value ? 'text-accent' : 'text-foreground')}>{label}</span>
              <span className="text-[9px] text-foreground-muted leading-tight">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Background (Professional only) */}
      {hs.style === 'professional' && (
        <div>
          <SectionTitle>Background</SectionTitle>
          <div className="space-y-1">
            {([
              { value: 'studio-white', label: 'Studio White', sub: 'Clean, minimal' },
              { value: 'studio-grey', label: 'Studio Grey', sub: 'Classic professional' },
              { value: 'studio-dark', label: 'Studio Dark', sub: 'Dramatic contrast' },
              { value: 'blurred-office', label: 'Blurred Office', sub: 'Corporate depth' },
              { value: 'gradient', label: 'Soft Gradient', sub: 'Modern editorial' },
            ] as const).map(({ value, label, sub }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateHs({ background: value })}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-md border text-left text-xs transition-all',
                  hs.background === value
                    ? 'border-accent bg-accent/10 text-foreground'
                    : 'border-border bg-surface-elevated hover:border-foreground-muted hover:bg-surface-sunken text-foreground-muted hover:text-foreground'
                )}
              >
                <span className="font-medium">{label}</span>
                <span className="text-[10px] text-foreground-muted">{sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Activity / Context (Website Custom only) */}
      {hs.style === 'website-custom' && (
        <div>
          <SectionTitle>Activity / Context</SectionTitle>
          <p className="text-[10px] text-foreground-muted mb-2 leading-relaxed">
            Describe what the person is doing or looking at. This creates an immersive, editorial feel.
          </p>
          <textarea
            value={hs.activityPrompt}
            onChange={(e) => updateHs({ activityPrompt: e.target.value })}
            placeholder="e.g. reviewing architectural drawings, studying a blueprint, looking at a model, writing..."
            rows={3}
            className="w-full bg-surface-elevated border border-border rounded-md text-xs text-foreground placeholder-foreground-muted/50 px-3 py-2 focus:outline-none focus:border-accent resize-none leading-relaxed"
          />
          <div className="mt-2 p-2.5 rounded-md bg-surface-sunken border border-border-subtle">
            <p className="text-[10px] text-foreground-muted leading-relaxed">
              <span className="font-semibold text-foreground">Style reference:</span> Wide rectangular frame, close-up side profile, cinematic depth of field, person appears absorbed and engaged.
            </p>
          </div>
        </div>
      )}

      {/* Quality */}
      <div>
        <SectionTitle>Output Quality</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'standard', label: 'Standard', sub: 'Faster' },
            { value: 'high', label: 'High', sub: 'More detail' },
          ] as const).map(({ value, label, sub }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateHs({ quality: value })}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2.5 rounded-lg border text-center transition-all',
                hs.quality === value
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-surface-elevated hover:border-foreground-muted'
              )}
            >
              <span className={cn('text-xs font-semibold', hs.quality === value ? 'text-accent' : 'text-foreground')}>{label}</span>
              <span className="text-[9px] text-foreground-muted">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="p-3 rounded-lg border border-border-subtle bg-surface-sunken text-[10px] text-foreground-muted space-y-1.5">
        <p className="font-semibold text-foreground text-[11px]">Tips for best results</p>
        <p>Upload a clear <strong className="text-foreground">front-facing photo</strong> as a minimum.</p>
        <p>Add left and right profiles so the AI can accurately reconstruct face structure from any angle.</p>
        <p>Good lighting in reference photos greatly improves output quality.</p>
      </div>
    </div>
  );
};
