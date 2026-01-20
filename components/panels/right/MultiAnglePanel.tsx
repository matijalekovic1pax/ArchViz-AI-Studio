import React, { useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { useAppStore } from '../../../store';
import { RangeSlider } from '../../ui/RangeSlider';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Toggle } from '../../ui/Toggle';
import { cn } from '../../../lib/utils';

const buildEvenAngles = (
  count: number,
  azimuthRange: [number, number],
  elevationRange: [number, number]
) => {
  const safeCount = Math.max(1, count);
  const [azStart, azEnd] = azimuthRange;
  const [elStart, elEnd] = elevationRange;
  const span = azEnd - azStart;
  const fullCircle = Math.abs(span - 360) < 0.001;
  const step = safeCount > 1 ? (fullCircle ? span / safeCount : span / (safeCount - 1)) : 0;
  return Array.from({ length: safeCount }, (_, index) => {
    const t = safeCount > 1 ? index / (safeCount - 1) : 0.5;
    return {
      id: nanoid(),
      azimuth: Math.round((azStart + step * index) * 10) / 10,
      elevation: Math.round((elStart + (elEnd - elStart) * t) * 10) / 10,
    };
  });
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const AnglePreview: React.FC<{ points: { azimuth: number; elevation: number }[] }> = ({ points }) => {
  const radius = 58;
  const center = 70;
  return (
    <div className="w-full flex items-center justify-center">
      <svg width={140} height={140} viewBox="0 0 140 140" className="text-foreground-muted">
        <circle cx={center} cy={center} r={radius} stroke="currentColor" strokeOpacity={0.25} fill="none" strokeWidth={2} />
        <circle cx={center} cy={center} r={3} fill="currentColor" fillOpacity={0.6} />
        {points.map((point, index) => {
          const rad = ((point.azimuth - 90) * Math.PI) / 180;
          const x = center + radius * Math.cos(rad);
          const y = center + radius * Math.sin(rad);
          const size = clamp(4 + (point.elevation / 90) * 3, 4, 7);
          return (
            <circle
              key={`${point.azimuth}-${point.elevation}-${index}`}
              cx={x}
              cy={y}
              r={size}
              fill="currentColor"
              fillOpacity={0.6}
            />
          );
        })}
      </svg>
    </div>
  );
};

export const MultiAnglePanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  const updateWf = useCallback(
    (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
    [dispatch, wf]
  );

  const handleViewCount = (value: number) => {
    const nextValue = clamp(value, 1, 36);
    updateWf({ multiAngleViewCount: nextValue });
    if (wf.multiAngleDistribution === 'even') {
      updateWf({
        multiAngleAngles: buildEvenAngles(nextValue, wf.multiAngleAzimuthRange, wf.multiAngleElevationRange),
      });
    } else {
      const existing = [...wf.multiAngleAngles];
      if (existing.length > nextValue) {
        updateWf({ multiAngleAngles: existing.slice(0, nextValue) });
      } else if (existing.length < nextValue) {
        const fill = buildEvenAngles(nextValue, wf.multiAngleAzimuthRange, wf.multiAngleElevationRange).slice(
          existing.length
        );
        updateWf({ multiAngleAngles: [...existing, ...fill] });
      }
    }
  };

  const updateRange = useCallback(
    (key: 'multiAngleAzimuthRange' | 'multiAngleElevationRange', value: [number, number]) => {
      updateWf({ [key]: value } as Partial<typeof wf>);
      if (wf.multiAngleDistribution === 'even') {
        const nextAngles = buildEvenAngles(
          wf.multiAngleViewCount,
          key === 'multiAngleAzimuthRange' ? value : wf.multiAngleAzimuthRange,
          key === 'multiAngleElevationRange' ? value : wf.multiAngleElevationRange
        );
        updateWf({ multiAngleAngles: nextAngles });
      }
    },
    [updateWf, wf.multiAngleAzimuthRange, wf.multiAngleElevationRange, wf.multiAngleDistribution, wf.multiAngleViewCount]
  );

  const handleDistribution = (value: 'even' | 'manual') => {
    updateWf({ multiAngleDistribution: value });
    if (value === 'even') {
      updateWf({
        multiAngleAngles: buildEvenAngles(
          wf.multiAngleViewCount,
          wf.multiAngleAzimuthRange,
          wf.multiAngleElevationRange
        ),
      });
    } else {
      const nextAngles = wf.multiAngleAngles.length
        ? wf.multiAngleAngles
        : buildEvenAngles(wf.multiAngleViewCount, wf.multiAngleAzimuthRange, wf.multiAngleElevationRange);
      updateWf({ multiAngleAngles: nextAngles });
    }
  };

  const handlePointChange = (id: string, field: 'azimuth' | 'elevation', value: number) => {
    const next = wf.multiAngleAngles.map((point) =>
      point.id === id ? { ...point, [field]: value } : point
    );
    updateWf({ multiAngleAngles: next });
  };

  const handleAddPoint = () => {
    const next = [
      ...wf.multiAngleAngles,
      { id: nanoid(), azimuth: 0, elevation: wf.multiAngleElevationRange[0] },
    ];
    updateWf({ multiAngleAngles: next, multiAngleViewCount: next.length, multiAngleDistribution: 'manual' });
  };

  const handleRemovePoint = (id: string) => {
    const next = wf.multiAngleAngles.filter((point) => point.id !== id);
    updateWf({ multiAngleAngles: next, multiAngleViewCount: Math.max(1, next.length) });
  };

  const previewPoints = useMemo(() => {
    if (wf.multiAngleDistribution === 'even') {
      return buildEvenAngles(wf.multiAngleViewCount, wf.multiAngleAzimuthRange, wf.multiAngleElevationRange);
    }
    return wf.multiAngleAngles;
  }, [wf.multiAngleAngles, wf.multiAngleDistribution, wf.multiAngleViewCount, wf.multiAngleAzimuthRange, wf.multiAngleElevationRange]);

  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Views</label>
        <div className="space-y-3">
          <SegmentedControl
            value={String(wf.multiAngleViewCount)}
            options={[
              { label: '4', value: '4' },
              { label: '8', value: '8' },
              { label: '12', value: '12' },
            ]}
            onChange={(value) => handleViewCount(Number(value))}
          />
          <div>
            <label className="text-xs text-foreground-muted mb-2 block">Custom Count</label>
            <input
              type="number"
              min={1}
              max={36}
              value={wf.multiAngleViewCount}
              onChange={(event) => handleViewCount(Number(event.target.value))}
              className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2"
            />
          </div>
          <div className="text-[10px] text-foreground-muted">
            Generate {wf.multiAngleViewCount} consistent views while preserving lighting and style.
          </div>
          <div className="rounded-lg border border-border bg-surface-elevated p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground-muted">Preview</span>
              <span className="text-foreground-secondary">{wf.multiAngleViewCount} views</span>
            </div>
            <AnglePreview points={previewPoints} />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Angle Ranges</label>
        <div className="space-y-3">
          <RangeSlider
            label="Azimuth (deg)"
            min={0}
            max={360}
            value={wf.multiAngleAzimuthRange}
            onChange={(value) => updateRange('multiAngleAzimuthRange', value)}
          />
          <RangeSlider
            label="Elevation (deg)"
            min={-30}
            max={90}
            value={wf.multiAngleElevationRange}
            onChange={(value) => updateRange('multiAngleElevationRange', value)}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Distribution</label>
        <SegmentedControl
          value={wf.multiAngleDistribution}
          options={[
            { label: 'Even', value: 'even' },
            { label: 'Manual', value: 'manual' },
          ]}
          onChange={(value) => handleDistribution(value)}
        />
        <div className="mt-3">
          <Toggle
            label="Lock Style & Lighting"
            checked={wf.multiAngleLockConsistency}
            onChange={(value) => updateWf({ multiAngleLockConsistency: value })}
          />
        </div>
      </div>

      {wf.multiAngleDistribution === 'manual' && (
        <div className="space-y-3">
          <label className="text-xs text-foreground-muted block font-bold uppercase tracking-wider">Angle Points</label>
          <div className="space-y-2">
            {wf.multiAngleAngles.map((point, index) => (
              <div key={point.id} className="flex items-center gap-2">
                <div className="text-[10px] text-foreground-muted w-6">#{index + 1}</div>
                <input
                  type="number"
                  value={point.azimuth}
                  min={0}
                  max={360}
                  className="flex-1 h-8 bg-surface-elevated border border-border rounded text-xs px-2"
                  onChange={(event) => handlePointChange(point.id, 'azimuth', Number(event.target.value))}
                />
                <input
                  type="number"
                  value={point.elevation}
                  min={-30}
                  max={90}
                  className="flex-1 h-8 bg-surface-elevated border border-border rounded text-xs px-2"
                  onChange={(event) => handlePointChange(point.id, 'elevation', Number(event.target.value))}
                />
                <button
                  type="button"
                  className="text-foreground-muted hover:text-red-500 text-xs"
                  onClick={() => handleRemovePoint(point.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={cn(
              'w-full py-2 rounded border border-dashed border-border text-xs text-foreground-muted hover:text-foreground hover:border-foreground/40'
            )}
            onClick={handleAddPoint}
          >
            + Add Angle
          </button>
        </div>
      )}

    </div>
  );
};
