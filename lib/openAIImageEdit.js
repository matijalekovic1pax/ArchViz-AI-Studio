/**
 * Pure geometry and pixel helpers for GPT Image 2 masked image edits.
 *
 * The editor's canonical mask convention is always:
 *   0   = protected source pixel
 *   255 = editable source pixel
 *
 * OpenAI's inverse alpha convention (fully transparent means editable) is
 * applied only by the API gateway.
 */

export const OPENAI_IMAGE_EDIT_LIMITS = Object.freeze({
  multiple: 16,
  minPixels: 655_360,
  maxPixels: 8_294_400,
  maxEdge: 3_840,
  maxAspectRatio: 3,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clampByte = (value) => clamp(Math.round(value), 0, 255);

export const smoothStep01 = (value) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

const roundToMultiple = (value, multiple) =>
  Math.max(multiple, Math.round(value / multiple) * multiple);

/**
 * Returns a legal GPT Image 2 edit canvas close to the supplied aspect ratio.
 * The caller uses the returned contentRect to preserve uniform scaling.
 */

export function getEditableAlphaBounds(alpha, width, height, threshold = 16) {
  if (!alpha || alpha.length !== width * height || width <= 0 || height <= 0) return null;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let selectedPixels = 0;
  let alphaSum = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = alpha[y * width + x];
      alphaSum += value;
      if (value < threshold) continue;
      selectedPixels += 1;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right < left || bottom < top) return null;
  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
    selectedPixels,
    weightedSelectedPixels: alphaSum / 255,
    selectedRatio: selectedPixels / Math.max(width * height, 1),
  };
}

export function dilateEditableAlpha(alpha, width, height, radius) {
  const safeRadius = Math.max(0, Math.floor(radius));
  if (safeRadius === 0) return new Uint8ClampedArray(alpha);
  if (!alpha || alpha.length !== width * height) throw new Error('Editable alpha dimensions do not match.');

  const horizontal = new Uint8ClampedArray(alpha.length);
  const output = new Uint8ClampedArray(alpha.length);
  const deque = new Int32Array(Math.max(width, height));

  for (let y = 0; y < height; y += 1) {
    let head = 0;
    let tail = 0;
    let right = -1;
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const wantedRight = Math.min(width - 1, x + safeRadius);
      while (right < wantedRight) {
        right += 1;
        const value = alpha[row + right];
        while (tail > head && alpha[row + deque[tail - 1]] <= value) tail -= 1;
        deque[tail++] = right;
      }
      const wantedLeft = Math.max(0, x - safeRadius);
      while (tail > head && deque[head] < wantedLeft) head += 1;
      horizontal[row + x] = alpha[row + deque[head]];
    }
  }

  for (let x = 0; x < width; x += 1) {
    let head = 0;
    let tail = 0;
    let bottom = -1;
    for (let y = 0; y < height; y += 1) {
      const wantedBottom = Math.min(height - 1, y + safeRadius);
      while (bottom < wantedBottom) {
        bottom += 1;
        const value = horizontal[bottom * width + x];
        while (tail > head && horizontal[deque[tail - 1] * width + x] <= value) tail -= 1;
        deque[tail++] = bottom;
      }
      const wantedTop = Math.max(0, y - safeRadius);
      while (tail > head && deque[head] < wantedTop) head += 1;
      output[y * width + x] = horizontal[deque[head] * width + x];
    }
  }
  return output;
}

/**
 * Builds a feather that lives entirely inside the canonical editable mask.
 * Therefore every protected pixel is guaranteed to remain exactly unchanged.
 */

export function buildInwardFeatherMatte(editableAlpha, width, height, radius, threshold = 8) {
  if (!editableAlpha || editableAlpha.length !== width * height) {
    throw new Error('Editable alpha dimensions do not match.');
  }
  const safeRadius = Math.max(0, Math.round(radius));
  if (safeRadius === 0) {
    return Uint8ClampedArray.from(editableAlpha, (value) => value >= threshold ? value : 0);
  }

  const maxDistance = safeRadius * 3 + 6;
  const distance = new Uint16Array(editableAlpha.length);
  for (let index = 0; index < distance.length; index += 1) {
    distance[index] = editableAlpha[index] >= threshold ? maxDistance : 0;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (distance[index] === 0) continue;
      let value = distance[index];
      if (x > 0) value = Math.min(value, distance[index - 1] + 3);
      if (y > 0) value = Math.min(value, distance[index - width] + 3);
      if (x > 0 && y > 0) value = Math.min(value, distance[index - width - 1] + 4);
      if (x + 1 < width && y > 0) value = Math.min(value, distance[index - width + 1] + 4);
      distance[index] = value;
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      if (distance[index] === 0) continue;
      let value = distance[index];
      if (x + 1 < width) value = Math.min(value, distance[index + 1] + 3);
      if (y + 1 < height) value = Math.min(value, distance[index + width] + 3);
      if (x + 1 < width && y + 1 < height) value = Math.min(value, distance[index + width + 1] + 4);
      if (x > 0 && y + 1 < height) value = Math.min(value, distance[index + width - 1] + 4);
      distance[index] = value;
    }
  }

  const matte = new Uint8ClampedArray(editableAlpha.length);
  for (let index = 0; index < matte.length; index += 1) {
    if (editableAlpha[index] < threshold) continue;
    const pixelDistance = distance[index] / 3;
    const feather = smoothStep01((pixelDistance - 0.35) / Math.max(safeRadius, 1));
    matte[index] = clampByte(editableAlpha[index] * feather);
  }

  // Preserve a full-strength generated core in every connected feature without
  // allocating another full-size component-label plane. Every finite component
  // has at least one local maximum in its inward distance field; promoting those
  // ridge pixels prevents a long thin/diagonal brush stroke from being reduced
  // to a translucent edit merely because its bounding box is large.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (editableAlpha[index] < threshold) continue;
      const value = distance[index];
      let hasHigherNeighbor = false;
      for (let oy = -1; oy <= 1 && !hasHigherNeighbor; oy += 1) {
        const neighborY = y + oy;
        if (neighborY < 0 || neighborY >= height) continue;
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          const neighborX = x + ox;
          if (neighborX < 0 || neighborX >= width) continue;
          const neighbor = neighborY * width + neighborX;
          if (editableAlpha[neighbor] >= threshold && distance[neighbor] > value) {
            hasHigherNeighbor = true;
            break;
          }
        }
      }
      if (!hasHigherNeighbor) matte[index] = editableAlpha[index];
    }
  }
  return matte;
}

export function getOpenAIEditFrameSize(sourceWidth, sourceHeight) {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight)) return null;
  if (sourceWidth <= 0 || sourceHeight <= 0) return null;

  const limits = OPENAI_IMAGE_EDIT_LIMITS;
  const ratio = sourceWidth / sourceHeight;
  if (ratio > limits.maxAspectRatio || ratio < 1 / limits.maxAspectRatio) return null;

  const pixels = sourceWidth * sourceHeight;
  const longEdge = Math.max(sourceWidth, sourceHeight);
  let scale = Math.min(
    1,
    limits.maxEdge / longEdge,
    Math.sqrt(limits.maxPixels / pixels)
  );
  if (pixels * scale * scale < limits.minPixels) {
    scale = Math.sqrt(limits.minPixels / pixels);
  }

  const targetWidth = sourceWidth * scale;
  const targetHeight = sourceHeight * scale;
  const baseWidth = roundToMultiple(targetWidth, limits.multiple);
  const baseHeight = roundToMultiple(targetHeight, limits.multiple);

  let best = null;
  for (let widthStep = -6; widthStep <= 6; widthStep += 1) {
    for (let heightStep = -6; heightStep <= 6; heightStep += 1) {
      const width = baseWidth + widthStep * limits.multiple;
      const height = baseHeight + heightStep * limits.multiple;
      if (width < limits.multiple || height < limits.multiple) continue;
      if (Math.max(width, height) > limits.maxEdge) continue;
      if (Math.max(width, height) / Math.min(width, height) > limits.maxAspectRatio) continue;
      const candidatePixels = width * height;
      if (candidatePixels < limits.minPixels || candidatePixels > limits.maxPixels) continue;

      const ratioError = Math.abs(width / height - ratio) / ratio;
      const areaError = Math.abs(candidatePixels / Math.max(targetWidth * targetHeight, 1) - 1);
      const score = ratioError * 1000 + areaError;
      if (!best || score < best.score) best = { width, height, score };
    }
  }

  return best ? { width: best.width, height: best.height } : null;
}

/** Silhouette-edge concession for inverted (Background) selections, in pixels. */
const INVERTED_SELECTION_EXPANSION = 3;

const getFullFrameOperationProfile = (operation) => {
  // Overscan is sized by what has to change *outside* the drawn selection.
  // Deleting a subject also means deleting its cast shadow and reflection,
  // which reach well past its own outline; recolouring a surface only needs
  // enough room for the boundary blend.
  if (operation === 'remove_object' || operation === 'remove_people') {
    return { expansionRatio: 0.22, minExpansion: 12, maxExpansion: 96 };
  }
  if (operation === 'add_people') {
    return { expansionRatio: 0.18, minExpansion: 10, maxExpansion: 80 };
  }
  if (operation === 'recolor' || operation === 'replace_material') {
    return { expansionRatio: 0.04, minExpansion: 5, maxExpansion: 24 };
  }
  return { expansionRatio: 0.10, minExpansion: 8, maxExpansion: 64 };
};

/**
 * Plans a whole-frame GPT Image 2 edit.
 *
 * `providerExpansion` dilates the user's selection before it is sent, because
 * OpenAI documents the mask as guidance rather than a hard boundary and advises
 * erring generous so the model can blend. `compositeFeather` stays smaller than
 * that ring, so the ramp between generated and protected pixels lives entirely
 * in the overscan and the user's own selection is carried at full strength.
 */
export function planOpenAIFullFrameEdit({
  sourceWidth,
  sourceHeight,
  selectionBounds,
  operation = 'custom',
  featherAmount = 0,
  editOutsideSelection = false,
}) {
  if (!selectionBounds || sourceWidth <= 0 || sourceHeight <= 0) return null;
  const frame = getOpenAIEditFrameSize(sourceWidth, sourceHeight);
  if (!frame) return null;

  const profile = getFullFrameOperationProfile(operation);
  // sqrt(area) is a stable size estimate for lassos and brush strokes, whose
  // bounding box says very little about how thick the selection actually is.
  const characteristic = Math.max(
    8,
    Math.sqrt(Math.max(selectionBounds.selectedPixels || 0, 1))
  );
  // Inverted selections (Background) protect the subject the user drew, so the
  // editable plane must not grow into it. Only the few pixels of an antialiased
  // silhouette edge are conceded, which is what keeps the new background from
  // leaving a rim of the old one.
  const providerExpansion = editOutsideSelection
    ? INVERTED_SELECTION_EXPANSION
    : Math.round(clamp(
        characteristic * profile.expansionRatio,
        profile.minExpansion,
        profile.maxExpansion
      ));
  // The ramp covers only the outer half of the overscan ring. The inner half
  // stays at full generated strength, which is what lets a removal actually
  // delete a cast shadow that lies outside the drawn selection instead of
  // fading the original one back in.
  const technicalFeather = Math.round(clamp(providerExpansion * 0.5, 2, 24));
  const featherScale = clamp(Number(featherAmount) || 0, 0, 100) / 100;
  const compositeFeather = technicalFeather + Math.round(clamp(
    (editOutsideSelection ? INVERTED_SELECTION_EXPANSION : characteristic) * featherScale * 0.15,
    0,
    64
  ));

  return {
    requestWidth: frame.width,
    requestHeight: frame.height,
    providerExpansion,
    compositeFeather,
  };
}


/**
 * Whether a provider mask should be sent for this operation.
 *
 * `/v1/images/edits` erases the masked region from the model's view. That is
 * correct when the target is meant to disappear or be replaced, and actively
 * wrong when the target must be restyled: masking a surface you want recoloured
 * blinds the model to the shape, shading and texture it is supposed to keep.
 * Containment does not depend on this — the result is always composited back
 * through the user's own selection locally.
 */
export function operationNeedsProviderMask(operation) {
  return operation === 'remove_object' ||
    operation === 'remove_people' ||
    operation === 'add_people';
}
