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
      ? 'same height'
      : tiltDeg > 0
        ? `${tiltDeg}° higher`
        : `${Math.abs(tiltDeg)}° lower`;

  return `${angleText} · ${tiltText}`;
}
