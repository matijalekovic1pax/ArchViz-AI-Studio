import type { FrameAngleValue } from './frameAngleTypes';

export const FRAME_ANGLE_PRESETS: Array<{
  label: string;
  value: FrameAngleValue;
}> = [
  {
    label: 'Original',
    value: { angleDeg: 0, tiltDeg: 0 },
  },
  {
    label: 'Left Angle',
    value: { angleDeg: -25, tiltDeg: 0 },
  },
  {
    label: 'Right Angle',
    value: { angleDeg: 25, tiltDeg: 0 },
  },
  {
    label: 'Tilt Up',
    value: { angleDeg: 0, tiltDeg: 15 },
  },
  {
    label: 'Tilt Down',
    value: { angleDeg: 0, tiltDeg: -15 },
  },
  {
    label: 'Left + Up',
    value: { angleDeg: -25, tiltDeg: 15 },
  },
  {
    label: 'Right + Up',
    value: { angleDeg: 25, tiltDeg: 15 },
  },
  {
    label: 'Left + Down',
    value: { angleDeg: -25, tiltDeg: -15 },
  },
  {
    label: 'Right + Down',
    value: { angleDeg: 25, tiltDeg: -15 },
  },
];
