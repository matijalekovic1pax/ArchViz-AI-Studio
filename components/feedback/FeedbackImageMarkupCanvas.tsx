import React, { useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { FeedbackImageMarkupCircle } from '../../types';

interface DraftCircle {
  x: number;
  y: number;
  radius: number;
}

interface FeedbackImageMarkupCanvasProps {
  imageUrl: string;
  markups: FeedbackImageMarkupCircle[];
  onChange?: (next: FeedbackImageMarkupCircle[]) => void;
  readOnly?: boolean;
  className?: string;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const FeedbackImageMarkupCanvas: React.FC<FeedbackImageMarkupCanvasProps> = ({
  imageUrl,
  markups,
  onChange,
  readOnly = false,
  className = '',
}) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<DraftCircle | null>(null);

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
    pointerStartRef.current = point;
    setDraft({ x: point.x, y: point.y, radius: 0 });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEdit || !pointerStartRef.current) return;
    const point = getPoint(event);
    if (!point) return;
    const start = pointerStartRef.current;
    const radius = Math.sqrt(Math.pow(point.x - start.x, 2) + Math.pow(point.y - start.y, 2));
    setDraft({ x: start.x, y: start.y, radius: clamp01(radius) });
  };

  const finalizeDraft = () => {
    if (!canEdit || !draft || !onChange) {
      pointerStartRef.current = null;
      setDraft(null);
      return;
    }

    pointerStartRef.current = null;
    if (draft.radius < 0.01) {
      setDraft(null);
      return;
    }

    onChange([
      ...markups,
      {
        id: nanoid(),
        x: clamp01(draft.x),
        y: clamp01(draft.y),
        radius: clamp01(draft.radius),
      },
    ]);
    setDraft(null);
  };

  const handlePointerUp = () => finalizeDraft();
  const handlePointerCancel = () => {
    pointerStartRef.current = null;
    setDraft(null);
  };

  return (
    <div className={`relative rounded-lg overflow-hidden border border-border bg-black/5 ${className}`.trim()}>
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
          {markups.map((markup) => (
            <circle
              key={markup.id}
              cx={markup.x * 1000}
              cy={markup.y * 1000}
              r={markup.radius * 1000}
              fill="rgba(239, 68, 68, 0.14)"
              stroke="rgba(220, 38, 38, 0.95)"
              strokeWidth={6}
            />
          ))}
          {draft && (
            <circle
              cx={draft.x * 1000}
              cy={draft.y * 1000}
              r={draft.radius * 1000}
              fill="rgba(239, 68, 68, 0.12)"
              stroke="rgba(220, 38, 38, 0.85)"
              strokeWidth={5}
              strokeDasharray="12 8"
            />
          )}
        </svg>
      </div>
    </div>
  );
};
