import React, { useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { FeedbackImageMarkupLassoPoint, FeedbackImageMarkupShape } from '../../types';

interface FeedbackImageMarkupCanvasProps {
  imageUrl: string;
  markups: FeedbackImageMarkupShape[];
  onChange?: (next: FeedbackImageMarkupShape[]) => void;
  readOnly?: boolean;
  className?: string;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const distance = (a: FeedbackImageMarkupLassoPoint, b: FeedbackImageMarkupLassoPoint): number =>
  Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

const lassoToPath = (points: FeedbackImageMarkupLassoPoint[]): string => {
  if (points.length === 0) return '';
  const segments = points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x * 1000} ${pt.y * 1000}`);
  return `${segments.join(' ')} Z`;
};

export const FeedbackImageMarkupCanvas: React.FC<FeedbackImageMarkupCanvasProps> = ({
  imageUrl,
  markups,
  onChange,
  readOnly = false,
  className = '',
}) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [draftPoints, setDraftPoints] = useState<FeedbackImageMarkupLassoPoint[] | null>(null);

  const canEdit = !readOnly && typeof onChange === 'function';

  const getPoint = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const x = clamp01((event.clientX - rect.left) / rect.width);
    const y = clamp01((event.clientY - rect.top) / rect.height);
    return { x, y };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEdit || event.button !== 0) return;
    const point = getPoint(event);
    if (!point) return;
    setDraftPoints([point]);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEdit || !draftPoints || draftPoints.length === 0) return;
    const point = getPoint(event);
    if (!point) return;

    const last = draftPoints[draftPoints.length - 1];
    if (distance(last, point) < 0.003) return;
    setDraftPoints((prev) => (prev ? [...prev, point] : prev));
  };

  const finalizeDraft = () => {
    if (!canEdit || !draftPoints || !onChange) {
      setDraftPoints(null);
      return;
    }

    const normalized = draftPoints.filter((pt, index, arr) => index === 0 || distance(arr[index - 1], pt) >= 0.001);
    if (normalized.length < 3) {
      setDraftPoints(null);
      return;
    }

    onChange([
      ...markups,
      {
        id: nanoid(),
        points: normalized,
      },
    ]);

    setDraftPoints(null);
  };

  const handlePointerUp = () => finalizeDraft();

  const handlePointerCancel = () => {
    setDraftPoints(null);
  };

  return (
    <div className={`relative rounded-lg border border-border bg-black/5 ${className}`.trim()}>
      <img src={imageUrl} alt="Feedback reference" className="w-full h-auto block select-none pointer-events-none" />
      <div
        ref={surfaceRef}
        className={`absolute inset-0 ${canEdit ? 'cursor-crosshair' : 'pointer-events-none'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="w-full h-full">
          {markups.map((markup) => {
            if ('points' in markup && Array.isArray(markup.points) && markup.points.length >= 2) {
              return (
                <path
                  key={markup.id}
                  d={lassoToPath(markup.points)}
                  fill="rgba(239, 68, 68, 0.14)"
                  stroke="rgba(220, 38, 38, 0.95)"
                  strokeWidth={5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              );
            }

            if ('x' in markup && 'y' in markup && 'radius' in markup) {
              return (
                <circle
                  key={markup.id}
                  cx={markup.x * 1000}
                  cy={markup.y * 1000}
                  r={markup.radius * 1000}
                  fill="rgba(239, 68, 68, 0.14)"
                  stroke="rgba(220, 38, 38, 0.95)"
                  strokeWidth={6}
                />
              );
            }

            return null;
          })}

          {draftPoints && draftPoints.length > 1 && (
            <path
              d={lassoToPath(draftPoints)}
              fill="rgba(239, 68, 68, 0.12)"
              stroke="rgba(220, 38, 38, 0.85)"
              strokeWidth={4}
              strokeDasharray="10 8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </svg>
      </div>
    </div>
  );
};
