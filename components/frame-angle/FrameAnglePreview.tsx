import React from 'react';
import {
  ANGLE_MAX,
  TILT_MAX,
  type FrameAngleValue,
} from './frameAngleTypes';
import { clampFrameAngleValue, describeFrameAngle, formatSignedDegrees } from './frameAngleUtils';

type FrameAnglePreviewProps = {
  imageUrl: string;
  value: FrameAngleValue;
};

export const FrameAnglePreview: React.FC<FrameAnglePreviewProps> = ({ imageUrl, value }) => {
  const next = clampFrameAngleValue(value);
  const angleNorm = next.angleDeg / ANGLE_MAX;
  const tiltNorm = next.tiltDeg / TILT_MAX;
  const maxArrowLength = 42;
  const x = angleNorm * maxArrowLength;
  const y = -tiltNorm * maxArrowLength;
  const hasShift = Math.abs(next.angleDeg) >= 3 || Math.abs(next.tiltDeg) >= 3;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Image Preview</h3>
        <span className="font-mono text-[10px] text-foreground-muted">
          Angle {formatSignedDegrees(next.angleDeg)} · Tilt {formatSignedDegrees(next.tiltDeg)}
        </span>
      </div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-surface-sunken">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-foreground-muted">
            Upload an image to preview the full-frame angle guide.
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
        <svg className="absolute inset-0 h-full w-full text-white" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="22" y1="50" x2="78" y2="50" stroke="currentColor" strokeOpacity="0.28" strokeWidth="0.7" strokeLinecap="round" />
          <line x1="50" y1="24" x2="50" y2="76" stroke="currentColor" strokeOpacity="0.24" strokeWidth="0.7" strokeLinecap="round" />
          <circle cx="50" cy="50" r="2" fill="currentColor" fillOpacity="0.85" />
          {hasShift && (
            <>
              <line
                x1="50"
                y1="50"
                x2={50 + x}
                y2={50 + y}
                stroke="currentColor"
                strokeOpacity="0.82"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
              <circle cx={50 + x} cy={50 + y} r="1.9" fill="currentColor" fillOpacity="0.9" />
            </>
          )}
        </svg>
        <div className="absolute bottom-2 left-2 right-2 rounded-md bg-black/45 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
          {describeFrameAngle(next)}
        </div>
      </div>
    </section>
  );
};
