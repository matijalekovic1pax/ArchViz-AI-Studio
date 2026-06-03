export type FrameAngleValue = {
  angleDeg: number;
  tiltDeg: number;
};

export type FrameAngleControllerProps = {
  imageUrl: string;
  value: FrameAngleValue;
  onChange: (value: FrameAngleValue) => void;
  disabled?: boolean;
  className?: string;
};

export const ANGLE_MIN = -90;
export const ANGLE_MAX = 90;
export const TILT_MIN = -30;
export const TILT_MAX = 30;
export const STEP = 1;

export const DEFAULT_FRAME_ANGLE_VALUE: FrameAngleValue = {
  angleDeg: 0,
  tiltDeg: 0,
};
