import {
  compositeLocalizedPixels,
  evaluateEditableTranslationGate,
  estimateProtectedColorOffset,
  estimateProtectedTranslation,
} from './localizedImageEdit.js';

export const LOCALIZED_IMAGE_COMPOSITE_MESSAGE = 'localized-image-composite';
export const LOCALIZED_IMAGE_COMPOSITE_RESULT = 'localized-image-composite-result';

const assertPipelineDimensions = ({
  sourcePixels,
  comparisonPixels,
  generatedPixels,
  editableAlpha,
  registrationExclusionAlpha,
  width,
  height,
}) => {
  const pixelCount = width * height;
  if (
    !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 ||
    sourcePixels.length !== pixelCount * 4 ||
    (comparisonPixels && comparisonPixels.length !== pixelCount * 4) ||
    generatedPixels.length !== pixelCount * 4 ||
    editableAlpha.length !== pixelCount ||
    registrationExclusionAlpha.length !== pixelCount
  ) {
    throw new Error('Localized composite worker pixel dimensions do not match.');
  }
};

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

/**
 * Reproduces the previous canvas registration behavior without touching the DOM:
 * the shifted, supported interior replaces the generated crop while exposed edge
 * pixels retain their original generated values.
 */
export function applyGeneratedTranslation(generatedPixels, width, height, dx, dy) {
  if (!dx && !dy) return generatedPixels;
  const output = new Uint8ClampedArray(generatedPixels);

  for (let y = 0; y < height; y += 1) {
    const sourceY = y + dy;
    if (sourceY < 0 || sourceY >= height) continue;
    for (let x = 0; x < width; x += 1) {
      const sourceX = x + dx;
      if (sourceX < 0 || sourceX >= width) continue;
      const sourceOffset = (sourceY * width + sourceX) * 4;
      const outputOffset = (y * width + x) * 4;
      const sourceAlphaByte = generatedPixels[sourceOffset + 3];

      // GPT Image 2 returns opaque PNGs. Preserve the canvas source-over
      // behavior as well so the fallback remains deterministic for any future
      // provider output with alpha.
      if (sourceAlphaByte === 255) {
        output[outputOffset] = generatedPixels[sourceOffset];
        output[outputOffset + 1] = generatedPixels[sourceOffset + 1];
        output[outputOffset + 2] = generatedPixels[sourceOffset + 2];
        output[outputOffset + 3] = 255;
        continue;
      }
      if (sourceAlphaByte === 0) continue;

      const sourceAlpha = sourceAlphaByte / 255;
      const destinationAlpha = output[outputOffset + 3] / 255;
      const inverseSourceAlpha = 1 - sourceAlpha;
      const outputAlpha = sourceAlpha + destinationAlpha * inverseSourceAlpha;
      if (outputAlpha <= 0) {
        output[outputOffset] = 0;
        output[outputOffset + 1] = 0;
        output[outputOffset + 2] = 0;
        output[outputOffset + 3] = 0;
        continue;
      }
      for (let channel = 0; channel < 3; channel += 1) {
        output[outputOffset + channel] = clampByte(
          (
            generatedPixels[sourceOffset + channel] * sourceAlpha +
            output[outputOffset + channel] * destinationAlpha * inverseSourceAlpha
          ) / outputAlpha
        );
      }
      output[outputOffset + 3] = clampByte(outputAlpha * 255);
    }
  }

  return output;
}

/**
 * Pure localized-composite pipeline shared by the module worker and the
 * deterministic synchronous fallback.
 */
export function runLocalizedImageCompositePipeline({
  sourcePixels,
  comparisonPixels,
  generatedPixels,
  editableAlpha,
  registrationExclusionAlpha,
  width,
  height,
  featherRadius,
  maxShift,
  operation = 'custom',
}) {
  assertPipelineDimensions({
    sourcePixels,
    comparisonPixels,
    generatedPixels,
    editableAlpha,
    registrationExclusionAlpha,
    width,
    height,
  });

  const semanticSourcePixels = comparisonPixels || sourcePixels;
  const registration = estimateProtectedTranslation(
    semanticSourcePixels,
    generatedPixels,
    registrationExclusionAlpha,
    width,
    height,
    maxShift
  );
  const editableTranslationGate = evaluateEditableTranslationGate({
    sourcePixels: semanticSourcePixels,
    generatedPixels,
    editableAlpha,
    width,
    height,
    dx: registration.dx,
    dy: registration.dy,
  });
  const shouldTranslate = (
    (registration.dx !== 0 || registration.dy !== 0) &&
    editableTranslationGate.accepted
  );
  const alignedGeneratedPixels = shouldTranslate
    ? applyGeneratedTranslation(
      generatedPixels,
      width,
      height,
      registration.dx,
      registration.dy
    )
    : generatedPixels;
  const colorOffset = estimateProtectedColorOffset(
    semanticSourcePixels,
    alignedGeneratedPixels,
    registrationExclusionAlpha,
    width,
    height
  );
  const composited = compositeLocalizedPixels({
    sourcePixels,
    comparisonPixels: semanticSourcePixels,
    generatedPixels: alignedGeneratedPixels,
    editableAlpha,
    width,
    height,
    featherRadius,
    colorOffset,
    operation,
  });

  return {
    pixels: composited.pixels,
    matte: composited.matte,
    registration,
    editableTranslationGate,
    colorOffset: composited.colorOffset,
    quality: {
      ...composited.quality,
      operation,
    },
    appliedTranslation: shouldTranslate
      ? { dx: registration.dx, dy: registration.dy }
      : { dx: 0, dy: 0 },
  };
}

const workerScope = (
  typeof globalThis !== 'undefined' &&
  typeof globalThis.postMessage === 'function' &&
  typeof globalThis.document === 'undefined'
) ? globalThis : null;

if (workerScope) {
  workerScope.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || message.type !== LOCALIZED_IMAGE_COMPOSITE_MESSAGE) return;

    try {
      const result = runLocalizedImageCompositePipeline({
        sourcePixels: new Uint8ClampedArray(message.sourcePixelsBuffer),
        comparisonPixels: message.comparisonPixelsBuffer
          ? new Uint8ClampedArray(message.comparisonPixelsBuffer)
          : undefined,
        generatedPixels: new Uint8ClampedArray(message.generatedPixelsBuffer),
        editableAlpha: new Uint8ClampedArray(message.editableAlphaBuffer),
        registrationExclusionAlpha: new Uint8ClampedArray(message.registrationExclusionAlphaBuffer),
        width: message.width,
        height: message.height,
        featherRadius: message.featherRadius,
        maxShift: message.maxShift,
        operation: message.operation,
      });
      workerScope.postMessage({
        type: LOCALIZED_IMAGE_COMPOSITE_RESULT,
        requestId: message.requestId,
        pixelsBuffer: result.pixels.buffer,
        matteBuffer: result.matte.buffer,
        registration: result.registration,
        editableTranslationGate: result.editableTranslationGate,
        colorOffset: result.colorOffset,
        quality: result.quality,
        appliedTranslation: result.appliedTranslation,
      }, [result.pixels.buffer, result.matte.buffer]);
    } catch (error) {
      workerScope.postMessage({
        type: LOCALIZED_IMAGE_COMPOSITE_RESULT,
        requestId: message.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
