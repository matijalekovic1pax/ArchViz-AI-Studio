import {
  ANGLE_MAX,
  ANGLE_MIN,
  STEP,
  TILT_MAX,
  TILT_MIN,
  type FrameAngleValue,
} from './frameAngleTypes';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function clampFrameAngleValue(value: FrameAngleValue): FrameAngleValue {
  return {
    angleDeg: clamp(roundToStep(value.angleDeg, STEP), ANGLE_MIN, ANGLE_MAX),
    tiltDeg: clamp(roundToStep(value.tiltDeg, STEP), TILT_MIN, TILT_MAX),
  };
}

export function formatSignedDegrees(value: number): string {
  if (value > 0) return `+${value}°`;
  if (value < 0) return `${value}°`;
  return '0°';
}

export function describeFrameAngle(value: FrameAngleValue): string {
  const { angleDeg, tiltDeg } = clampFrameAngleValue(value);

  const angleText =
    Math.abs(angleDeg) < 3
      ? 'Original angle'
      : angleDeg > 0
        ? `${angleDeg}° right angle`
        : `${Math.abs(angleDeg)}° left angle`;

  const tiltText =
    Math.abs(tiltDeg) < 3
      ? 'level tilt'
      : tiltDeg > 0
        ? `${tiltDeg}° tilt up`
        : `${Math.abs(tiltDeg)}° tilt down`;

  return `${angleText} · ${tiltText}`;
}

export function buildFrameAngleInstruction(value: FrameAngleValue): string {
  const next = clampFrameAngleValue(value);
  const angle =
    Math.abs(next.angleDeg) < 3
      ? 'keep the original horizontal camera angle'
      : next.angleDeg > 0
        ? `change the full-scene camera angle ${next.angleDeg} degrees to the right`
        : `change the full-scene camera angle ${Math.abs(next.angleDeg)} degrees to the left`;

  const tilt =
    Math.abs(next.tiltDeg) < 3
      ? 'keep the original vertical tilt'
      : next.tiltDeg > 0
        ? `tilt the camera ${next.tiltDeg} degrees upward`
        : `tilt the camera ${Math.abs(next.tiltDeg)} degrees downward`;

  return [
    'Generate a new view of the same full scene from the source image.',
    `${angle}.`,
    `${tilt}.`,
    'Preserve the same architecture, objects, materials, lighting, proportions, and overall framing.',
    'Do not rotate individual objects.',
    'Do not change lens, zoom, field of view, roll, or camera target.',
  ].join(' ');
}
