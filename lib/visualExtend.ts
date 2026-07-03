import type { WorkflowSettings } from '../types';

export type VisualExtendSettings = WorkflowSettings['visualExtend'];

export interface VisualExtendCanvasLayout {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  offsetX: number;
  offsetY: number;
  ratioValue: number;
  extensionPx: number;
  extensionPct: number;
  extended: boolean;
}

export const VISUAL_EXTEND_RATIO_MAP: Record<string, number> = {
  '16:9': 16 / 9,
  '21:9': 21 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '9:16': 9 / 16,
};

const clampAmount = (amount: number) => Math.max(0, Math.min(300, Number.isFinite(amount) ? amount : 0));

export const getVisualExtendRatioValue = (extend: VisualExtendSettings, baseRatio: number): number => {
  if (extend.targetAspectRatio !== 'custom') {
    return VISUAL_EXTEND_RATIO_MAP[extend.targetAspectRatio] || baseRatio;
  }

  return extend.customRatio.width > 0 && extend.customRatio.height > 0
    ? extend.customRatio.width / extend.customRatio.height
    : baseRatio;
};

export const getVisualExtendCanvasLayout = (
  extend: VisualExtendSettings,
  sourceSize: { width: number; height: number }
): VisualExtendCanvasLayout => {
  const sourceWidth = Math.max(1, Math.round(sourceSize.width));
  const sourceHeight = Math.max(1, Math.round(sourceSize.height));
  const baseRatio = sourceWidth / sourceHeight;
  const ratioValue = getVisualExtendRatioValue(extend, baseRatio);

  if (extend.direction === 'none') {
    return {
      sourceWidth,
      sourceHeight,
      targetWidth: sourceWidth,
      targetHeight: sourceHeight,
      offsetX: 0,
      offsetY: 0,
      ratioValue,
      extensionPx: 0,
      extensionPct: 0,
      extended: false,
    };
  }

  const amountScale = 1 + clampAmount(extend.amount) / 100;
  const extendsLeft = extend.direction.includes('left');
  const extendsRight = extend.direction.includes('right');
  const extendsTop = extend.direction.includes('top');
  const extendsBottom = extend.direction.includes('bottom');
  const extendsHorizontal = extendsLeft || extendsRight;
  const extendsVertical = extendsTop || extendsBottom;

  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;

  if (extend.targetAspectRatio === 'custom') {
    if (extendsHorizontal) targetWidth = Math.round(sourceWidth * amountScale);
    if (extendsVertical) targetHeight = Math.round(sourceHeight * amountScale);

    if (ratioValue > 0) {
      if (targetWidth / targetHeight < ratioValue) {
        targetWidth = Math.round(targetHeight * ratioValue);
      } else {
        targetHeight = Math.round(targetWidth / ratioValue);
      }
    }
  } else if (ratioValue > 0) {
    if (ratioValue > baseRatio) {
      targetWidth = Math.round(sourceHeight * ratioValue);
    } else if (ratioValue < baseRatio) {
      targetHeight = Math.round(sourceWidth / ratioValue);
    }
  }

  if (extendsHorizontal && targetWidth <= sourceWidth) {
    targetWidth = Math.round(sourceWidth * amountScale);
  }
  if (extendsVertical && targetHeight <= sourceHeight) {
    targetHeight = Math.round(sourceHeight * amountScale);
  }

  targetWidth = Math.max(sourceWidth, targetWidth);
  targetHeight = Math.max(sourceHeight, targetHeight);

  const extraWidth = targetWidth - sourceWidth;
  const extraHeight = targetHeight - sourceHeight;
  const offsetX = extendsLeft
    ? extraWidth
    : extendsRight
      ? 0
      : Math.round(extraWidth / 2);
  const offsetY = extendsTop
    ? extraHeight
    : extendsBottom
      ? 0
      : Math.round(extraHeight / 2);
  const extensionPx = Math.max(extraWidth, extraHeight, 0);
  const extensionDenom = extraWidth >= extraHeight ? sourceWidth : sourceHeight;

  return {
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    offsetX,
    offsetY,
    ratioValue,
    extensionPx,
    extensionPct: extensionDenom ? Math.round((extensionPx / extensionDenom) * 100) : 0,
    extended: targetWidth > sourceWidth || targetHeight > sourceHeight,
  };
};

export const scaleVisualExtendCanvasLayout = (
  layout: VisualExtendCanvasLayout,
  targetWidth: number,
  targetHeight: number
): VisualExtendCanvasLayout => {
  const scaleX = targetWidth / Math.max(layout.targetWidth, 1);
  const scaleY = targetHeight / Math.max(layout.targetHeight, 1);
  const sourceWidth = Math.max(1, Math.round(layout.sourceWidth * scaleX));
  const sourceHeight = Math.max(1, Math.round(layout.sourceHeight * scaleY));
  const offsetX = Math.max(0, Math.min(targetWidth - sourceWidth, Math.round(layout.offsetX * scaleX)));
  const offsetY = Math.max(0, Math.min(targetHeight - sourceHeight, Math.round(layout.offsetY * scaleY)));
  const extensionPx = Math.max(targetWidth - sourceWidth, targetHeight - sourceHeight, 0);
  const extensionDenom = targetWidth - sourceWidth >= targetHeight - sourceHeight ? sourceWidth : sourceHeight;

  return {
    ...layout,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    offsetX,
    offsetY,
    extensionPx,
    extensionPct: extensionDenom ? Math.round((extensionPx / extensionDenom) * 100) : 0,
    extended: targetWidth > sourceWidth || targetHeight > sourceHeight,
  };
};
