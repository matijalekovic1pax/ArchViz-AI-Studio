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
  const angleAbs = Math.abs(next.angleDeg);
  const tiltAbs = Math.abs(next.tiltDeg);
  const angle =
    Math.abs(next.angleDeg) < 3
      ? 'from the original camera direction'
      : next.angleDeg > 0
        ? `as if the photographer turned ${angleAbs}° to the right`
        : `as if the photographer turned ${angleAbs}° to the left`;

  const tilt =
    Math.abs(next.tiltDeg) < 3
      ? 'with a level camera'
      : next.tiltDeg > 0
        ? `with the camera tilted ${tiltAbs}° up, showing more ceiling`
        : `with the camera tilted ${tiltAbs}° down, showing more floor`;

  return [
    `Show the same space ${angle}, ${tilt}.`,
    'Keep the design, layout, materials, lighting, and any people consistent with the reference image.',
    'Do not rotate, flip, or crop the existing picture; create a new upright camera view.',
  ].join(' ');
}
