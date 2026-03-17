import React from 'react';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';
import { UserCircle, Image } from 'lucide-react';

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[10px] font-bold text-foreground-muted mb-2 uppercase tracking-widest">{children}</h3>
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
          <button
            type="button"
            onClick={() => updateHs({ style: 'professional' })}
            className={cn(
              'w-full text-left rounded-lg border p-3 transition-all duration-200 flex gap-3',
              hs.style === 'professional'
                ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
                : 'border-border bg-surface-elevated hover:border-foreground-muted hover:bg-surface-sunken'
            )}
          >
            <div className={cn('w-10 h-10 rounded-md shrink-0 flex items-center justify-center border',
              hs.style === 'professional' ? 'border-accent/50 bg-accent/20 text-accent' : 'border-border bg-surface-sunken text-foreground-muted')}>
              <UserCircle size={18} />
            </div>
            <div className="min-w-0">
              <div className={cn('text-xs font-semibold', hs.style === 'professional' ? 'text-accent' : 'text-foreground')}>Professional</div>
              <div className="text-[10px] text-foreground-muted leading-snug mt-0.5">Standard front-facing career headshot. LinkedIn, bios, ID cards.</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => updateHs({ style: 'website-custom' })}
            className={cn(
              'w-full text-left rounded-lg border p-3 transition-all duration-200 flex gap-3',
              hs.style === 'website-custom'
                ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
                : 'border-border bg-surface-elevated hover:border-foreground-muted hover:bg-surface-sunken'
            )}
          >
            <div className={cn('w-10 h-10 rounded-md shrink-0 flex items-center justify-center border',
              hs.style === 'website-custom' ? 'border-accent/50 bg-accent/20 text-accent' : 'border-border bg-surface-sunken text-foreground-muted')}>
              <Image size={18} />
            </div>
            <div className="min-w-0">
              <div className={cn('text-xs font-semibold', hs.style === 'website-custom' ? 'text-accent' : 'text-foreground')}>Website Custom</div>
              <div className="text-[10px] text-foreground-muted leading-snug mt-0.5">Cinematic side-profile. Person absorbed in role-specific work — for team pages.</div>
            </div>
          </button>
        </div>
      </div>

      {/* Tone */}
      <div>
        <SectionTitle>Tone</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'formal',       label: 'Formal',       sub: 'Suit, serious' },
            { value: 'smart-casual', label: 'Smart Casual', sub: 'Polished, warm' },
            { value: 'casual',       label: 'Casual',       sub: 'Relaxed, friendly' },
            { value: 'creative',     label: 'Creative',     sub: 'Expressive, bold' },
          ] as const).map(({ value, label, sub }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateHs({ tone: value })}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2.5 rounded-lg border text-center transition-all',
                hs.tone === value
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-surface-elevated hover:border-foreground-muted'
              )}
            >
              <span className={cn('text-xs font-semibold', hs.tone === value ? 'text-accent' : 'text-foreground')}>{label}</span>
              <span className="text-[9px] text-foreground-muted">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Purpose */}
      <div>
        <SectionTitle>Purpose</SectionTitle>
        <div className="space-y-1">
          {([
            { value: 'linkedin',     label: 'LinkedIn / Bio',    sub: 'Career profile' },
            { value: 'student-card', label: 'Student Card',      sub: 'ID, relaxed vibe' },
            { value: 'team-page',    label: 'Team Page',         sub: 'Company website' },
            { value: 'social-media', label: 'Social Media',      sub: 'Instagram / X' },
            { value: 'id-document',  label: 'ID Document',       sub: 'Passport / official' },
            { value: 'portfolio',    label: 'Portfolio',         sub: 'Personal website' },
          ] as const).map(({ value, label, sub }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateHs({ purpose: value })}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-md border text-left text-xs transition-all',
                hs.purpose === value
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

      {/* Role (Website Custom only) */}
      {hs.style === 'website-custom' && (
        <div>
          <SectionTitle>Role Description</SectionTitle>
          <p className="text-[10px] text-foreground-muted mb-2 leading-relaxed">
            Describe the person's role. The scene will show them immersed in role-specific work.
          </p>
          <input
            type="text"
            value={hs.role}
            onChange={(e) => updateHs({ role: e.target.value })}
            placeholder="e.g. Senior Architect, Urban Planner, BIM Manager..."
            className="w-full h-9 bg-surface-elevated border border-border rounded-md text-xs text-foreground placeholder-foreground-muted/50 px-3 focus:outline-none focus:border-accent"
          />

          <div className="mt-3">
            <SectionTitle>Facing Direction</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'left',  label: '← Face Left',  sub: 'Profile looks left' },
                { value: 'right', label: 'Face Right →', sub: 'Profile looks right' },
              ] as const).map(({ value, label, sub }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateHs({ facing: value })}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-2.5 rounded-lg border text-center transition-all',
                    hs.facing === value
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-surface-elevated hover:border-foreground-muted'
                  )}
                >
                  <span className={cn('text-xs font-semibold', hs.facing === value ? 'text-accent' : 'text-foreground')}>{label}</span>
                  <span className="text-[9px] text-foreground-muted">{sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
              <div className={cn('w-5 h-5 rounded-full',
                value === 'color'
                  ? 'bg-gradient-to-br from-blue-400 to-pink-400'
                  : 'bg-gradient-to-br from-gray-200 to-gray-700'
              )} />
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
              { value: 'studio-grey',  label: 'Studio Grey',  sub: 'Classic professional' },
              { value: 'studio-dark',  label: 'Studio Dark',  sub: 'Dramatic contrast' },
              { value: 'blurred-office', label: 'Blurred Office', sub: 'Corporate depth' },
              { value: 'gradient',     label: 'Soft Gradient', sub: 'Modern editorial' },
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

      {/* Quality */}
      <div>
        <SectionTitle>Output Quality</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'standard', label: 'Standard', sub: 'Faster' },
            { value: 'high',     label: 'High',     sub: 'More detail' },
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
        <p>Add left and right profiles so the AI can reconstruct face structure from any angle.</p>
        <p>Good lighting in reference photos greatly improves output quality.</p>
      </div>
    </div>
  );
};
