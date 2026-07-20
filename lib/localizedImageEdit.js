/**
 * Pure geometry and pixel helpers for localized GPT Image edits.
 *
 * The editor's canonical mask convention is always:
 *   0   = protected source pixel
 *   255 = editable source pixel
 *
 * OpenAI's inverse alpha convention is applied only by the API gateway.
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
export function getOpenAIEditCanvasPlan(contentWidth, contentHeight) {
  if (!Number.isFinite(contentWidth) || !Number.isFinite(contentHeight) || contentWidth <= 0 || contentHeight <= 0) {
    return null;
  }

  const limits = OPENAI_IMAGE_EDIT_LIMITS;
  const contentRatio = contentWidth / contentHeight;
  const ratio = clamp(contentRatio, 1 / limits.maxAspectRatio, limits.maxAspectRatio);
  // Very wide/tall source crops are uniformly fitted into a legal 3:1/1:3
  // request canvas. Padding is protected and discarded during inverse mapping.
  const effectiveWidth = contentRatio > limits.maxAspectRatio
    ? contentWidth
    : contentRatio < 1 / limits.maxAspectRatio
      ? contentHeight / limits.maxAspectRatio
      : contentWidth;
  const effectiveHeight = contentRatio < 1 / limits.maxAspectRatio
    ? contentHeight
    : contentRatio > limits.maxAspectRatio
      ? contentWidth / limits.maxAspectRatio
      : contentHeight;
  const pixels = effectiveWidth * effectiveHeight;
  const longEdge = Math.max(effectiveWidth, effectiveHeight);
  let scale = Math.min(
    1,
    limits.maxEdge / longEdge,
    Math.sqrt(limits.maxPixels / pixels)
  );
  if (pixels * scale * scale < limits.minPixels) {
    scale = Math.sqrt(limits.minPixels / pixels);
  }

  const desiredWidth = effectiveWidth * scale;
  const desiredHeight = effectiveHeight * scale;
  const baseWidth = roundToMultiple(desiredWidth, limits.multiple);
  const baseHeight = roundToMultiple(desiredHeight, limits.multiple);
  let best = null;

  for (let widthStep = -8; widthStep <= 8; widthStep += 1) {
    for (let heightStep = -8; heightStep <= 8; heightStep += 1) {
      const width = baseWidth + widthStep * limits.multiple;
      const height = baseHeight + heightStep * limits.multiple;
      if (width < limits.multiple || height < limits.multiple) continue;
      const candidatePixels = width * height;
      if (Math.max(width, height) > limits.maxEdge) continue;
      if (candidatePixels < limits.minPixels || candidatePixels > limits.maxPixels) continue;
      if (Math.max(width, height) / Math.min(width, height) > limits.maxAspectRatio) continue;

      const uniformScale = Math.min(width / contentWidth, height / contentHeight);
      // Integer source/destination rectangles avoid half-pixel sampling during
      // the forward and inverse crop transforms, a common one-pixel seam cause.
      const fittedWidth = Math.max(1, Math.min(width, Math.round(contentWidth * uniformScale)));
      const fittedHeight = Math.max(1, Math.min(height, Math.round(contentHeight * uniformScale)));
      const paddingArea = width * height - fittedWidth * fittedHeight;
      const ratioError = Math.abs(width / height - ratio) / ratio;
      const scaleError = Math.abs(uniformScale / Math.max(scale, 1e-6) - 1);
      const score = ratioError * 1000 + paddingArea / (width * height) * 100 + scaleError;
      if (!best || score < best.score) {
        best = { width, height, uniformScale, fittedWidth, fittedHeight, score };
      }
    }
  }

  if (!best) return null;
  const contentRect = {
    x: Math.floor((best.width - best.fittedWidth) / 2),
    y: Math.floor((best.height - best.fittedHeight) / 2),
    width: best.fittedWidth,
    height: best.fittedHeight,
  };
  return {
    requestWidth: best.width,
    requestHeight: best.height,
    scale: best.uniformScale,
    contentRect,
  };
}

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

const getOperationProfile = (operation) => {
  if (operation === 'remove_object' || operation === 'remove_people' || operation === 'add_people') {
    return { contextRatio: 0.82, minContext: 72, coverageTarget: 0.42, expansionRatio: 0.022 };
  }
  if (operation === 'replace_material' || operation === 'recolor') {
    return { contextRatio: 0.72, minContext: 72, coverageTarget: 0.46, expansionRatio: 0.012 };
  }
  return { contextRatio: 0.64, minContext: 64, coverageTarget: 0.5, expansionRatio: 0.016 };
};

const expandRectToAspectLimit = (rect, sourceWidth, sourceHeight, maxRatio) => {
  let { x, y, width, height } = rect;
  if (width / height > maxRatio) {
    const targetHeight = Math.min(sourceHeight, Math.ceil(width / maxRatio));
    const extra = targetHeight - height;
    y = clamp(Math.floor(y - extra / 2), 0, sourceHeight - targetHeight);
    height = targetHeight;
  } else if (height / width > maxRatio) {
    const targetWidth = Math.min(sourceWidth, Math.ceil(height / maxRatio));
    const extra = targetWidth - width;
    x = clamp(Math.floor(x - extra / 2), 0, sourceWidth - targetWidth);
    width = targetWidth;
  }
  return { x, y, width, height };
};

const expandRectToArea = (rect, sourceWidth, sourceHeight, targetArea) => {
  if (rect.width * rect.height >= targetArea) return rect;
  const factor = Math.sqrt(targetArea / Math.max(rect.width * rect.height, 1));
  const targetWidth = Math.min(sourceWidth, Math.max(rect.width, Math.ceil(rect.width * factor)));
  const targetHeight = Math.min(sourceHeight, Math.max(rect.height, Math.ceil(rect.height * factor)));
  return {
    x: clamp(Math.floor(rect.x - (targetWidth - rect.width) / 2), 0, sourceWidth - targetWidth),
    y: clamp(Math.floor(rect.y - (targetHeight - rect.height) / 2), 0, sourceHeight - targetHeight),
    width: targetWidth,
    height: targetHeight,
  };
};

/**
 * Plans a context crop and a reversible source-to-request mapping.
 */
export function planLocalizedImageEdit({
  sourceWidth,
  sourceHeight,
  selectionBounds,
  operation = 'custom',
  featherAmount = 0,
}) {
  if (!selectionBounds || sourceWidth <= 0 || sourceHeight <= 0) return null;
  const profile = getOperationProfile(operation);
  const selectionLongEdge = Math.max(selectionBounds.width, selectionBounds.height);
  const sourceShortEdge = Math.min(sourceWidth, sourceHeight);
  const featherScale = clamp(Number(featherAmount) || 0, 0, 100) / 100;
  const context = Math.round(clamp(
    Math.max(
      profile.minContext,
      selectionLongEdge * (profile.contextRatio + featherScale * 0.16),
      sourceShortEdge * 0.035
    ),
    24,
    Math.max(96, sourceShortEdge * 0.42)
  ));

  const left = Math.max(0, selectionBounds.left - context);
  const top = Math.max(0, selectionBounds.top - context);
  const right = Math.min(sourceWidth, selectionBounds.right + 1 + context);
  const bottom = Math.min(sourceHeight, selectionBounds.bottom + 1 + context);
  let sourceRect = {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };

  const selectedArea = Math.max(1, selectionBounds.weightedSelectedPixels || selectionBounds.selectedPixels || 1);
  sourceRect = expandRectToArea(
    sourceRect,
    sourceWidth,
    sourceHeight,
    selectedArea / profile.coverageTarget
  );
  sourceRect = expandRectToAspectLimit(
    sourceRect,
    sourceWidth,
    sourceHeight,
    OPENAI_IMAGE_EDIT_LIMITS.maxAspectRatio
  );

  const request = getOpenAIEditCanvasPlan(sourceRect.width, sourceRect.height);
  if (!request) return null;
  const preservesSourceStructure = operation === 'recolor' || operation === 'replace_material';
  // Give the model a narrow disposable overscan outside the user's canonical
  // selection. It can continue illumination/texture across the boundary; the
  // compositor later discards this overscan and restores every protected pixel.
  const providerExpansion = Math.round(clamp(
    selectionLongEdge * profile.expansionRatio + 2,
    preservesSourceStructure ? 4 : 3,
    operation === 'remove_object' || operation === 'remove_people' ? 36 : preservesSourceStructure ? 18 : 24
  ));
  const selectionShortEdge = Math.min(selectionBounds.width, selectionBounds.height);
  // Technical seam protection is independent of the user's creative feather
  // control. A one-pixel transition exposes provider tone/texture drift as a
  // stamp, especially on large flat architectural surfaces.
  const technicalFeather = Math.round(clamp(
    selectionShortEdge * (preservesSourceStructure ? 0.035 : 0.02),
    preservesSourceStructure ? 8 : 4,
    preservesSourceStructure ? 40 : 24
  ));
  const requestedFeather = Math.round(clamp(
    selectionShortEdge * featherScale * 0.08,
    0,
    48
  ));
  const desiredCompositeFeather = Math.max(technicalFeather, requestedFeather);
  const maxSelectionFeather = Math.max(0, Math.floor((selectionShortEdge - 1) / 3));
  const compositeFeather = Math.min(desiredCompositeFeather, maxSelectionFeather);

  return {
    sourceRect,
    requestWidth: request.requestWidth,
    requestHeight: request.requestHeight,
    contentRect: request.contentRect,
    scale: request.scale,
    context,
    providerExpansion,
    compositeFeather,
  };
}

/** Fast rectangular max filter used as a deterministic mask dilation. */
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

const luminanceAt = (pixels, offset) =>
  pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;

/**
 * Detects only a strongly-supported small global translation in protected context.
 * Returned dx/dy mean: sample generated(x + dx, y + dy) for output(x, y).
 */
export function estimateProtectedTranslation(sourcePixels, generatedPixels, editableAlpha, width, height, maxShift = 6) {
  if (
    !sourcePixels || !generatedPixels || sourcePixels.length !== width * height * 4 ||
    generatedPixels.length !== sourcePixels.length || editableAlpha.length !== width * height
  ) {
    return { dx: 0, dy: 0, improvement: 0, samples: 0 };
  }
  const shiftLimit = clamp(Math.floor(maxShift), 0, 12);
  if (shiftLimit < 1) return { dx: 0, dy: 0, improvement: 0, samples: 0, reason: 'disabled' };

  // Every candidate must use exactly the same trusted source coordinates. The
  // dilation also prevents the editable-mask boundary from becoming a false
  // registration feature.
  const unsafe = dilateEditableAlpha(editableAlpha, width, height, shiftLimit + 2);
  const stride = Math.max(1, Math.ceil(Math.sqrt((width * height) / 14_000)));
  const margin = shiftLimit + 2;
  const samples = [];
  const tileCols = 4;
  const tileRows = 4;
  let tensorXX = 0;
  let tensorXY = 0;
  let tensorYY = 0;
  const tileSupport = new Uint32Array(tileCols * tileRows);

  for (let y = margin; y < height - margin; y += stride) {
    for (let x = margin; x < width - margin; x += stride) {
      const index = y * width + x;
      if (unsafe[index] > 4) continue;
      const offset = index * 4;
      const gx = luminanceAt(sourcePixels, offset + 4) - luminanceAt(sourcePixels, offset - 4);
      const gy = luminanceAt(sourcePixels, offset + width * 4) - luminanceAt(sourcePixels, offset - width * 4);
      const magnitude = Math.hypot(gx, gy);
      if (magnitude < 8) continue;
      const tileX = Math.min(tileCols - 1, Math.floor((x / width) * tileCols));
      const tileY = Math.min(tileRows - 1, Math.floor((y / height) * tileRows));
      const tile = tileY * tileCols + tileX;
      samples.push({ x, y, index, offset, gx, gy, tile });
      tileSupport[tile] += 1;
      tensorXX += gx * gx;
      tensorXY += gx * gy;
      tensorYY += gy * gy;
    }
  }

  const minimumSamples = Math.min(600, Math.max(120, Math.floor(width * height * 0.006)));
  if (samples.length < minimumSamples) {
    return { dx: 0, dy: 0, improvement: 0, samples: samples.length, reason: 'low_texture' };
  }
  const activeTiles = [...tileSupport.keys()].filter((tile) => tileSupport[tile] >= 8);
  const activeTileRows = new Set(activeTiles.map((tile) => Math.floor(tile / tileCols)));
  const activeTileCols = new Set(activeTiles.map((tile) => tile % tileCols));
  if (activeTiles.length < 4 || activeTileRows.size < 2 || activeTileCols.size < 2) {
    return { dx: 0, dy: 0, improvement: 0, samples: samples.length, reason: 'localized_texture' };
  }
  const tensorTrace = tensorXX + tensorYY;
  const tensorDiscriminant = Math.sqrt(Math.max(0, (tensorXX - tensorYY) ** 2 + 4 * tensorXY ** 2));
  const lambdaMax = (tensorTrace + tensorDiscriminant) / 2;
  const lambdaMin = (tensorTrace - tensorDiscriminant) / 2;
  if (lambdaMax <= 0 || lambdaMin / lambdaMax < 0.055) {
    return { dx: 0, dy: 0, improvement: 0, samples: samples.length, reason: 'one_dimensional' };
  }

  const censusDifference = (sourceOffset, generatedOffset) => {
    const sourceCenter = luminanceAt(sourcePixels, sourceOffset);
    const generatedCenter = luminanceAt(generatedPixels, generatedOffset);
    let different = 0;
    const neighborOffsets = [
      -width * 4 - 4, -width * 4, -width * 4 + 4,
      -4, 4,
      width * 4 - 4, width * 4, width * 4 + 4,
    ];
    for (const neighborOffset of neighborOffsets) {
      const sourceBit = luminanceAt(sourcePixels, sourceOffset + neighborOffset) >= sourceCenter;
      const generatedBit = luminanceAt(generatedPixels, generatedOffset + neighborOffset) >= generatedCenter;
      if (sourceBit !== generatedBit) different += 1;
    }
    return different / neighborOffsets.length;
  };

  const scoreShift = (dx, dy) => {
    let score = 0;
    const tileScores = new Float64Array(tileCols * tileRows);
    const tileCounts = new Uint32Array(tileCols * tileRows);
    for (const sample of samples) {
      const generatedIndex = (sample.y + dy) * width + sample.x + dx;
      const generatedOffset = generatedIndex * 4;
      const generatedGx = luminanceAt(generatedPixels, generatedOffset + 4) - luminanceAt(generatedPixels, generatedOffset - 4);
      const generatedGy = luminanceAt(generatedPixels, generatedOffset + width * 4) - luminanceAt(generatedPixels, generatedOffset - width * 4);
      const gradientDelta = Math.min(96, Math.abs(sample.gx - generatedGx) + Math.abs(sample.gy - generatedGy));
      const censusDelta = censusDifference(sample.offset, generatedOffset);
      const colorDelta = (
        Math.abs(sourcePixels[sample.offset] - generatedPixels[generatedOffset]) +
        Math.abs(sourcePixels[sample.offset + 1] - generatedPixels[generatedOffset + 1]) +
        Math.abs(sourcePixels[sample.offset + 2] - generatedPixels[generatedOffset + 2])
      ) / 3;
      const sampleScore = censusDelta * 70 + gradientDelta * 0.27 + Math.min(colorDelta, 80) * 0.08;
      score += sampleScore;
      tileScores[sample.tile] += sampleScore;
      tileCounts[sample.tile] += 1;
    }
    return {
      score: score / samples.length,
      samples: samples.length,
      tileScores,
      tileCounts,
    };
  };

  const candidates = [];
  for (let dy = -shiftLimit; dy <= shiftLimit; dy += 1) {
    for (let dx = -shiftLimit; dx <= shiftLimit; dx += 1) {
      candidates.push({ dx, dy, ...scoreShift(dx, dy) });
    }
  }
  const baseline = candidates.find((candidate) => candidate.dx === 0 && candidate.dy === 0);
  candidates.sort((a, b) => {
    const scoreDelta = a.score - b.score;
    if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
    const magnitudeDelta = Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy);
    if (Math.abs(magnitudeDelta) > 1e-9) return magnitudeDelta;
    return a.dy - b.dy || a.dx - b.dx;
  });
  const best = candidates[0];
  if (!baseline || !best || (best.dx === 0 && best.dy === 0)) {
    return { dx: 0, dy: 0, improvement: 0, samples: samples.length, reason: 'zero_best' };
  }

  const absoluteGain = baseline.score - best.score;
  const improvement = absoluteGain / Math.max(baseline.score, 1);
  if (Math.abs(best.dx) === shiftLimit || Math.abs(best.dy) === shiftLimit) {
    return { dx: 0, dy: 0, improvement, samples: samples.length, reason: 'search_boundary' };
  }
  if (absoluteGain < 2.5 || improvement < 0.18) {
    return { dx: 0, dy: 0, improvement, samples: samples.length, reason: 'weak_gain' };
  }

  const distinctPeak = candidates.find((candidate) =>
    Math.max(Math.abs(candidate.dx - best.dx), Math.abs(candidate.dy - best.dy)) > 1
  );
  const uniquenessGap = distinctPeak ? distinctPeak.score - best.score : Number.POSITIVE_INFINITY;
  if (uniquenessGap < Math.max(0.75, absoluteGain * 0.22)) {
    return { dx: 0, dy: 0, improvement, samples: samples.length, reason: 'ambiguous_peak' };
  }

  let improvingTiles = 0;
  let stronglyRegressingTiles = 0;
  for (const tile of activeTiles) {
    const baselineTile = baseline.tileScores[tile] / Math.max(1, baseline.tileCounts[tile]);
    const bestTile = best.tileScores[tile] / Math.max(1, best.tileCounts[tile]);
    if (baselineTile - bestTile > 0.5) improvingTiles += 1;
    if (bestTile - baselineTile > Math.max(1, absoluteGain * 0.35)) stronglyRegressingTiles += 1;
  }
  if (
    improvingTiles < Math.max(3, Math.ceil(activeTiles.length * 0.6)) ||
    stronglyRegressingTiles > Math.floor(activeTiles.length * 0.15)
  ) {
    return { dx: 0, dy: 0, improvement, samples: samples.length, reason: 'inconsistent_tiles' };
  }

  return {
    dx: best.dx,
    dy: best.dy,
    improvement,
    samples: best.samples,
    uniquenessGap,
    reason: 'accepted',
  };
}

/**
 * A protected-context translation is only safe to apply to the generated edit
 * when the edit itself appears to share that translation. GPT's fixed mask can
 * keep newly generated content correctly anchored even while protected context
 * drifts. In that mixed case, moving the whole patch clips/repositions the edit.
 */
export function evaluateEditableTranslationGate({
  sourcePixels,
  generatedPixels,
  editableAlpha,
  width,
  height,
  dx,
  dy,
  threshold = 8,
}) {
  if (
    !sourcePixels || !generatedPixels || !editableAlpha ||
    sourcePixels.length !== width * height * 4 ||
    generatedPixels.length !== sourcePixels.length ||
    editableAlpha.length !== width * height
  ) {
    return { accepted: false, reason: 'invalid_dimensions', samples: 0 };
  }
  if (dx === 0 && dy === 0) {
    return { accepted: true, reason: 'zero_shift', samples: 0 };
  }

  let anchoredWeight = 0;
  let shiftedWeight = 0;
  let anchoredNovelty = 0;
  let shiftedNovelty = 0;

  // Under the proposed translation, generated(gx, gy) should correspond to
  // source(gx - dx, gy - dy). Residual novelty therefore reveals where the
  // intentional edit actually lives. Compare only the non-overlapping lobes of
  // the original and translated masks; their large shared interior cannot tell
  // a fixed-mask edit from a globally shifted one.
  for (let generatedY = 0; generatedY < height; generatedY += 1) {
    const sourceY = generatedY - dy;
    if (sourceY < 0 || sourceY >= height) continue;
    for (let generatedX = 0; generatedX < width; generatedX += 1) {
      const sourceX = generatedX - dx;
      if (sourceX < 0 || sourceX >= width) continue;
      const generatedIndex = generatedY * width + generatedX;
      const sourceIndex = sourceY * width + sourceX;
      const originalCoverage = editableAlpha[generatedIndex] >= threshold
        ? editableAlpha[generatedIndex] / 255
        : 0;
      const translatedCoverage = editableAlpha[sourceIndex] >= threshold
        ? editableAlpha[sourceIndex] / 255
        : 0;
      const anchoredOnly = Math.max(0, originalCoverage - translatedCoverage);
      const shiftedOnly = Math.max(0, translatedCoverage - originalCoverage);
      if (anchoredOnly <= 0 && shiftedOnly <= 0) continue;
      const sourceOffset = sourceIndex * 4;
      const generatedOffset = generatedIndex * 4;
      const novelty = Math.min(96, (
        Math.abs(sourcePixels[sourceOffset] - generatedPixels[generatedOffset]) +
        Math.abs(sourcePixels[sourceOffset + 1] - generatedPixels[generatedOffset + 1]) +
        Math.abs(sourcePixels[sourceOffset + 2] - generatedPixels[generatedOffset + 2])
      ) / 3);
      anchoredWeight += anchoredOnly;
      shiftedWeight += shiftedOnly;
      anchoredNovelty += novelty * anchoredOnly;
      shiftedNovelty += novelty * shiftedOnly;
    }
  }

  if (anchoredWeight < 8 || shiftedWeight < 8) {
    return {
      accepted: false,
      reason: 'insufficient_edit_support',
      samples: Math.min(anchoredWeight, shiftedWeight),
    };
  }
  const anchoredMean = anchoredNovelty / anchoredWeight;
  const shiftedMean = shiftedNovelty / shiftedWeight;
  const supportRatio = (shiftedMean + 1) / (anchoredMean + 1);
  const accepted = shiftedMean - anchoredMean >= 2 && supportRatio >= 1.15;
  return {
    accepted,
    reason: accepted ? 'edit_translation_supported' : 'edit_already_anchored',
    samples: Math.min(anchoredWeight, shiftedWeight),
    anchoredNovelty: anchoredMean,
    shiftedNovelty: shiftedMean,
    supportRatio,
  };
}

export function estimateProtectedColorOffset(sourcePixels, generatedPixels, editableAlpha, width, height) {
  const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 80_000)));
  const histogramSize = 105;
  const histogramOffset = 52;
  const redHistogram = new Uint32Array(histogramSize);
  const greenHistogram = new Uint32Array(histogramSize);
  const blueHistogram = new Uint32Array(histogramSize);
  let samples = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = y * width + x;
      if (editableAlpha[index] > 4) continue;
      const pixel = index * 4;
      const dr = sourcePixels[pixel] - generatedPixels[pixel];
      const dg = sourcePixels[pixel + 1] - generatedPixels[pixel + 1];
      const db = sourcePixels[pixel + 2] - generatedPixels[pixel + 2];
      if (Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db)) > 52) continue;
      redHistogram[dr + histogramOffset] += 1;
      greenHistogram[dg + histogramOffset] += 1;
      blueHistogram[db + histogramOffset] += 1;
      samples += 1;
    }
  }
  if (samples < 80) return { red: 0, green: 0, blue: 0, samples };

  const histogramMedian = (histogram, count) => {
    const target = Math.floor((count - 1) / 2);
    let cumulative = 0;
    for (let index = 0; index < histogram.length; index += 1) {
      cumulative += histogram[index];
      if (cumulative > target) return index - histogramOffset;
    }
    return 0;
  };
  const medianRed = histogramMedian(redHistogram, samples);
  const medianGreen = histogramMedian(greenHistogram, samples);
  const medianBlue = histogramMedian(blueHistogram, samples);

  const deviationHistogram = new Uint32Array(histogramSize * 2);
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = y * width + x;
      if (editableAlpha[index] > 4) continue;
      const pixel = index * 4;
      const dr = sourcePixels[pixel] - generatedPixels[pixel];
      const dg = sourcePixels[pixel + 1] - generatedPixels[pixel + 1];
      const db = sourcePixels[pixel + 2] - generatedPixels[pixel + 2];
      if (Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db)) > 52) continue;
      const deviation = Math.max(
        Math.abs(dr - medianRed),
        Math.abs(dg - medianGreen),
        Math.abs(db - medianBlue)
      );
      deviationHistogram[Math.min(deviationHistogram.length - 1, deviation)] += 1;
    }
  }
  const medianDeviation = (() => {
    const target = Math.floor((samples - 1) / 2);
    let cumulative = 0;
    for (let index = 0; index < deviationHistogram.length; index += 1) {
      cumulative += deviationHistogram[index];
      if (cumulative > target) return index;
    }
    return 0;
  })();
  const inlierLimit = clamp(Math.round(medianDeviation * 4.45 + 2), 4, 24);
  let red = 0;
  let green = 0;
  let blue = 0;
  let inliers = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = y * width + x;
      if (editableAlpha[index] > 4) continue;
      const pixel = index * 4;
      const dr = sourcePixels[pixel] - generatedPixels[pixel];
      const dg = sourcePixels[pixel + 1] - generatedPixels[pixel + 1];
      const db = sourcePixels[pixel + 2] - generatedPixels[pixel + 2];
      if (Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db)) > 52) continue;
      if (
        Math.max(
          Math.abs(dr - medianRed),
          Math.abs(dg - medianGreen),
          Math.abs(db - medianBlue)
        ) > inlierLimit
      ) continue;
      red += dr;
      green += dg;
      blue += db;
      inliers += 1;
    }
  }
  if (inliers < 80) return { red: 0, green: 0, blue: 0, samples: inliers };
  return {
    red: clamp(red / inliers, -24, 24),
    green: clamp(green / inliers, -24, 24),
    blue: clamp(blue / inliers, -24, 24),
    samples: inliers,
  };
}

const boxBlurBytePlane = (plane, width, height, radius) => {
  const safeRadius = Math.max(0, Math.floor(radius));
  if (safeRadius === 0) return new Uint8ClampedArray(plane);
  const stride = width + 1;
  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += plane[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + rowSum;
    }
  }
  const output = new Uint8ClampedArray(plane.length);
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - safeRadius);
    const bottom = Math.min(height - 1, y + safeRadius);
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - safeRadius);
      const right = Math.min(width - 1, x + safeRadius);
      const sum =
        integral[(bottom + 1) * stride + right + 1] -
        integral[top * stride + right + 1] -
        integral[(bottom + 1) * stride + left] +
        integral[top * stride + left];
      output[y * width + x] = clampByte(sum / ((right - left + 1) * (bottom - top + 1)));
    }
  }
  return output;
};

const SRGB_TO_LINEAR = Float32Array.from({ length: 256 }, (_, value) => {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
});

const LINEAR_TO_SRGB = Uint8ClampedArray.from({ length: 4097 }, (_, index) => {
  const linear = index / 4096;
  const encoded = linear <= 0.0031308
    ? linear * 12.92
    : 1.055 * (linear ** (1 / 2.4)) - 0.055;
  return clampByte(encoded * 255);
});

const linearToSrgbByte = (linear) =>
  LINEAR_TO_SRGB[Math.round(clamp(linear, 0, 1) * 4096)];

const histogramQuantile = (histogram, samples, quantile) => {
  if (samples <= 0) return 0;
  const target = Math.max(0, Math.ceil(samples * quantile) - 1);
  let cumulative = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index];
    if (cumulative > target) return index;
  }
  return histogram.length - 1;
};

const estimateProtectedNoiseRange = (
  sourcePixels,
  generatedPixels,
  editableAlpha,
  width,
  height,
  colorOffset
) => {
  const histogram = new Uint32Array(97);
  const stride = Math.max(1, Math.ceil(Math.sqrt((width * height) / 100_000)));
  let samples = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = y * width + x;
      if (editableAlpha[index] > 4) continue;
      const pixel = index * 4;
      const delta = Math.max(
        Math.abs(clampByte(generatedPixels[pixel] + colorOffset.red) - sourcePixels[pixel]),
        Math.abs(clampByte(generatedPixels[pixel + 1] + colorOffset.green) - sourcePixels[pixel + 1]),
        Math.abs(clampByte(generatedPixels[pixel + 2] + colorOffset.blue) - sourcePixels[pixel + 2])
      );
      histogram[Math.min(histogram.length - 1, delta)] += 1;
      samples += 1;
    }
  }
  if (samples < 32) return { low: 2.5, high: 16 };
  const median = histogramQuantile(histogram, samples, 0.5);
  const upper = histogramQuantile(histogram, samples, 0.9);
  const low = clamp(median + 1.5, 2.5, 18);
  return {
    low,
    high: clamp(Math.max(low + 5, upper + 3), 8, 36),
  };
};

/**
 * Builds a low-resolution local color residual from protected context. The
 * field is sampled only in the transition band; it never color-grades the AI
 * generated core. This corrects spatial exposure/white-balance drift without
 * turning the edit into a source-derived reconstruction.
 */
const buildBoundaryColorField = ({
  sourcePixels,
  generatedPixels,
  editableAlpha,
  width,
  height,
  featherRadius,
  colorOffset,
}) => {
  const cellSize = Math.round(clamp(Math.max(8, featherRadius * 1.75), 8, 32));
  const columns = Math.max(1, Math.ceil(width / cellSize));
  const rows = Math.max(1, Math.ceil(height / cellSize));
  const cellCount = columns * rows;
  const redSum = new Float64Array(cellCount);
  const greenSum = new Float64Array(cellCount);
  const blueSum = new Float64Array(cellCount);
  const counts = new Uint32Array(cellCount);

  for (let y = 0; y < height; y += 1) {
    const cellY = Math.min(rows - 1, Math.floor(y / cellSize));
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (editableAlpha[index] > 4) continue;
      const pixel = index * 4;
      const generatedRed = clampByte(generatedPixels[pixel] + colorOffset.red);
      const generatedGreen = clampByte(generatedPixels[pixel + 1] + colorOffset.green);
      const generatedBlue = clampByte(generatedPixels[pixel + 2] + colorOffset.blue);
      if (Math.max(
        Math.abs(generatedRed - sourcePixels[pixel]),
        Math.abs(generatedGreen - sourcePixels[pixel + 1]),
        Math.abs(generatedBlue - sourcePixels[pixel + 2])
      ) > 48) continue;
      const cellX = Math.min(columns - 1, Math.floor(x / cellSize));
      const cell = cellY * columns + cellX;
      redSum[cell] += SRGB_TO_LINEAR[sourcePixels[pixel]] - SRGB_TO_LINEAR[generatedRed];
      greenSum[cell] += SRGB_TO_LINEAR[sourcePixels[pixel + 1]] - SRGB_TO_LINEAR[generatedGreen];
      blueSum[cell] += SRGB_TO_LINEAR[sourcePixels[pixel + 2]] - SRGB_TO_LINEAR[generatedBlue];
      counts[cell] += 1;
    }
  }

  const red = new Float32Array(cellCount);
  const green = new Float32Array(cellCount);
  const blue = new Float32Array(cellCount);
  for (let cellY = 0; cellY < rows; cellY += 1) {
    for (let cellX = 0; cellX < columns; cellX += 1) {
      let weightSum = 0;
      let redValue = 0;
      let greenValue = 0;
      let blueValue = 0;
      for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
        const neighborY = cellY + offsetY;
        if (neighborY < 0 || neighborY >= rows) continue;
        for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
          const neighborX = cellX + offsetX;
          if (neighborX < 0 || neighborX >= columns) continue;
          const neighbor = neighborY * columns + neighborX;
          if (counts[neighbor] === 0) continue;
          const distanceWeight = 1 / (1 + offsetX * offsetX + offsetY * offsetY);
          weightSum += distanceWeight;
          redValue += redSum[neighbor] / counts[neighbor] * distanceWeight;
          greenValue += greenSum[neighbor] / counts[neighbor] * distanceWeight;
          blueValue += blueSum[neighbor] / counts[neighbor] * distanceWeight;
        }
      }
      const cell = cellY * columns + cellX;
      if (weightSum > 0) {
        red[cell] = clamp(redValue / weightSum, -0.09, 0.09);
        green[cell] = clamp(greenValue / weightSum, -0.09, 0.09);
        blue[cell] = clamp(blueValue / weightSum, -0.09, 0.09);
      }
    }
  }

  return { cellSize, columns, rows, red, green, blue };
};

const sampleBoundaryColorField = (field, x, y) => {
  const gridX = clamp(x / field.cellSize - 0.5, 0, field.columns - 1);
  const gridY = clamp(y / field.cellSize - 0.5, 0, field.rows - 1);
  const left = Math.floor(gridX);
  const top = Math.floor(gridY);
  const right = Math.min(field.columns - 1, left + 1);
  const bottom = Math.min(field.rows - 1, top + 1);
  const tx = gridX - left;
  const ty = gridY - top;
  const sample = (plane) => {
    const topValue = plane[top * field.columns + left] * (1 - tx) +
      plane[top * field.columns + right] * tx;
    const bottomValue = plane[bottom * field.columns + left] * (1 - tx) +
      plane[bottom * field.columns + right] * tx;
    return topValue * (1 - ty) + bottomValue * ty;
  };
  return { red: sample(field.red), green: sample(field.green), blue: sample(field.blue) };
};

const buildOperationSemanticMatte = ({
  sourcePixels,
  generatedPixels,
  baseMatte,
  protectedAlpha,
  width,
  height,
  colorOffset,
}) => {
  const raw = new Uint8ClampedArray(baseMatte.length);
  const protectedNoise = estimateProtectedNoiseRange(
    sourcePixels,
    generatedPixels,
    protectedAlpha,
    width,
    height,
    colorOffset
  );
  let selectedWeight = 0;
  let semanticWeight = 0;
  let intentStrengthSum = 0;
  for (let index = 0, pixel = 0; index < baseMatte.length; index += 1, pixel += 4) {
    const selection = baseMatte[index] / 255;
    if (selection <= 0) continue;
    selectedWeight += selection;
    const generatedRed = clampByte(generatedPixels[pixel] + colorOffset.red);
    const generatedGreen = clampByte(generatedPixels[pixel + 1] + colorOffset.green);
    const generatedBlue = clampByte(generatedPixels[pixel + 2] + colorOffset.blue);
    const maxChannelDelta = Math.max(
      Math.abs(generatedRed - sourcePixels[pixel]),
      Math.abs(generatedGreen - sourcePixels[pixel + 1]),
      Math.abs(generatedBlue - sourcePixels[pixel + 2])
    );
    const luminanceDelta = Math.abs(
      generatedRed * 0.2126 + generatedGreen * 0.7152 + generatedBlue * 0.0722 -
      luminanceAt(sourcePixels, pixel)
    );
    const signal = Math.max(maxChannelDelta, luminanceDelta * 0.85);
    let confidence = smoothStep01(
      (signal - protectedNoise.low) /
      Math.max(1, protectedNoise.high - protectedNoise.low)
    );
    confidence = clamp(confidence, 0, 1);
    intentStrengthSum += confidence * selection;
    raw[index] = clampByte(baseMatte[index] * confidence);
    semanticWeight += raw[index] / 255;
  }

  // Denoise the model-derived semantic target and close small holes, but clip
  // it to the inward user matte so protected pixels remain byte-identical.
  const blurRadius = Math.max(1, Math.min(4, Math.round(Math.min(width, height) * 0.0025)));
  const blurred = boxBlurBytePlane(raw, width, height, blurRadius);
  const semanticMatte = new Uint8ClampedArray(raw.length);
  semanticWeight = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const closed = Math.max(raw[index], clampByte(blurred[index] * 0.82));
    semanticMatte[index] = Math.min(baseMatte[index], closed);
    semanticWeight += semanticMatte[index] / 255;
  }

  return {
    matte: semanticMatte,
    semanticCoverage: semanticWeight / Math.max(selectedWeight, 1),
    meanIntentStrength: intentStrengthSum / Math.max(selectedWeight, 1),
  };
};

/**
 * Localized AI-pixel composite with a hard protected-pixel invariant. The
 * generated pixels remain authoritative; deterministic work is restricted to
 * alignment, change support, boundary color matching and feathering.
 */
export function compositeLocalizedPixels({
  sourcePixels,
  comparisonPixels,
  generatedPixels,
  editableAlpha,
  width,
  height,
  featherRadius,
  colorOffset,
  operation = 'custom',
}) {
  if (sourcePixels.length !== width * height * 4 || generatedPixels.length !== sourcePixels.length) {
    throw new Error('Localized composite pixel dimensions do not match.');
  }
  const matte = buildInwardFeatherMatte(editableAlpha, width, height, featherRadius);
  const semanticSourcePixels = comparisonPixels && comparisonPixels.length === sourcePixels.length
    ? comparisonPixels
    : sourcePixels;
  const offset = colorOffset || estimateProtectedColorOffset(
    semanticSourcePixels,
    generatedPixels,
    editableAlpha,
    width,
    height
  );
  const semantic = buildOperationSemanticMatte({
    sourcePixels: semanticSourcePixels,
    generatedPixels,
    baseMatte: matte,
    protectedAlpha: editableAlpha,
    width,
    height,
    colorOffset: offset,
  });
  const output = new Uint8ClampedArray(sourcePixels);
  const boundaryColorField = buildBoundaryColorField({
    sourcePixels,
    generatedPixels,
    editableAlpha,
    width,
    height,
    featherRadius,
    colorOffset: offset,
  });
  let selectedWeight = 0;
  let changedWeight = 0;
  for (let index = 0, pixel = 0; index < semantic.matte.length; index += 1, pixel += 4) {
    const alpha = semantic.matte[index] / 255;
    if (alpha <= 0) continue;
    selectedWeight += alpha;
    const x = index % width;
    const y = Math.floor(index / width);
    const baseAlpha = matte[index] / 255;
    const boundaryWeight = 1 - smoothStep01((baseAlpha - 0.38) / 0.5);
    const inverse = 1 - alpha;
    const generatedRed = clampByte(generatedPixels[pixel] + offset.red * boundaryWeight);
    const generatedGreen = clampByte(generatedPixels[pixel + 1] + offset.green * boundaryWeight);
    const generatedBlue = clampByte(generatedPixels[pixel + 2] + offset.blue * boundaryWeight);
    const localCorrection = sampleBoundaryColorField(boundaryColorField, x, y);
    output[pixel] = linearToSrgbByte(
      SRGB_TO_LINEAR[sourcePixels[pixel]] * inverse +
      clamp(SRGB_TO_LINEAR[generatedRed] + localCorrection.red * boundaryWeight, 0, 1) * alpha
    );
    output[pixel + 1] = linearToSrgbByte(
      SRGB_TO_LINEAR[sourcePixels[pixel + 1]] * inverse +
      clamp(SRGB_TO_LINEAR[generatedGreen] + localCorrection.green * boundaryWeight, 0, 1) * alpha
    );
    output[pixel + 2] = linearToSrgbByte(
      SRGB_TO_LINEAR[sourcePixels[pixel + 2]] * inverse +
      clamp(SRGB_TO_LINEAR[generatedBlue] + localCorrection.blue * boundaryWeight, 0, 1) * alpha
    );
    output[pixel + 3] = sourcePixels[pixel + 3];
    const maxDelta = Math.max(
      Math.abs(output[pixel] - sourcePixels[pixel]),
      Math.abs(output[pixel + 1] - sourcePixels[pixel + 1]),
      Math.abs(output[pixel + 2] - sourcePixels[pixel + 2])
    );
    if (maxDelta >= 3) changedWeight += alpha;
  }
  const changedRatio = changedWeight / Math.max(selectedWeight, 1);
  let accepted = true;
  let reason = 'accepted';
  const explicitStructuralOperation = operation === 'add_people' || operation === 'remove_people' || operation === 'remove_object';
  const minimumCoverage = explicitStructuralOperation ? 0.012 : 0.004;
  if (semantic.semanticCoverage < minimumCoverage || changedRatio < minimumCoverage) {
    accepted = false;
    reason = explicitStructuralOperation ? 'requested_structural_change_missing' : 'no_semantic_edit_change';
  }
  const safePixels = accepted ? output : new Uint8ClampedArray(sourcePixels);
  const safeMatte = accepted ? semantic.matte : new Uint8ClampedArray(semantic.matte.length);
  return {
    pixels: safePixels,
    matte: safeMatte,
    colorOffset: offset,
    quality: {
      accepted,
      reason,
      compositeMode: 'generated-pixels',
      semanticCoverage: semantic.semanticCoverage,
      meanIntentStrength: semantic.meanIntentStrength,
      changedRatio,
    },
  };
}
