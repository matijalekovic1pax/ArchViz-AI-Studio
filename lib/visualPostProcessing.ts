import type { GeneratedImage } from '../services/geminiService';
import type { AppState } from '../types';
import type { MaterialSwatch } from './materialCatalog';

type VisualAdjustSettings = AppState['workflow']['visualAdjust'];
type VisualMaterialSettings = AppState['workflow']['visualMaterial'];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const clamp255 = (value: number) => Math.min(255, Math.max(0, Math.round(value)));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

const smoothstep = (edge0: number, edge1: number, value: number) => {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for post-production.'));
    img.src = src;
  });

const loadMaterialImage = async (material: MaterialSwatch): Promise<HTMLImageElement> => {
  const preferredUrl = material.referenceUrl || material.previewUrl;
  try {
    return await loadImage(preferredUrl);
  } catch {
    if (material.fallbackPreviewUrl && material.fallbackPreviewUrl !== preferredUrl) {
      return loadImage(material.fallbackPreviewUrl);
    }
    throw new Error('Failed to load material texture.');
  }
};

const parseDataUrl = (dataUrl: string): GeneratedImage => {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
  return {
    dataUrl,
    mimeType: (match?.[1] as GeneratedImage['mimeType']) || 'image/png',
    base64: match?.[2] || dataUrl.split(',')[1] || ''
  };
};

const rgbToHsl = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const delta = max - min;
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  return { h: h * 60, s, l };
};

const hueToRgb = (p: number, q: number, tValue: number) => {
  let t = tValue;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};

const hslToRgb = (h: number, s: number, l: number) => {
  const normalizedHue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return { r: l, g: l, b: l };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hueToRgb(p, q, normalizedHue + 1 / 3),
    g: hueToRgb(p, q, normalizedHue),
    b: hueToRgb(p, q, normalizedHue - 1 / 3)
  };
};

const circularHueDistance = (a: number, b: number) => {
  const delta = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return Math.min(180, delta);
};

const channelWeight = (hue: number, center: number, width = 42) =>
  1 - smoothstep(0, width, circularHueDistance(hue, center));

const channelAdjustments = (adjust: VisualAdjustSettings) => [
  { center: 0, hue: adjust.hslRedsHue, sat: adjust.hslRedsSaturation, lum: adjust.hslRedsLuminance },
  { center: 30, hue: adjust.hslOrangesHue, sat: adjust.hslOrangesSaturation, lum: adjust.hslOrangesLuminance },
  { center: 60, hue: adjust.hslYellowsHue, sat: adjust.hslYellowsSaturation, lum: adjust.hslYellowsLuminance },
  { center: 120, hue: adjust.hslGreensHue, sat: adjust.hslGreensSaturation, lum: adjust.hslGreensLuminance },
  { center: 180, hue: adjust.hslAquasHue, sat: adjust.hslAquasSaturation, lum: adjust.hslAquasLuminance },
  { center: 240, hue: adjust.hslBluesHue, sat: adjust.hslBluesSaturation, lum: adjust.hslBluesLuminance },
  { center: 275, hue: adjust.hslPurplesHue, sat: adjust.hslPurplesSaturation, lum: adjust.hslPurplesLuminance },
  { center: 315, hue: adjust.hslMagentasHue, sat: adjust.hslMagentasSaturation, lum: adjust.hslMagentasLuminance },
];

const colorFromHue = (hue: number) => hslToRgb(hue, 1, 0.5);

const pseudoNoise = (x: number, y: number) => {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const makeMask = async (maskDataUrl: string | null, width: number, height: number) => {
  if (!maskDataUrl) return null;
  const mask = await loadImage(maskDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(mask, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const maskValues = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    maskValues[p] = ((data[i] + data[i + 1] + data[i + 2]) / 3 / 255) * (data[i + 3] / 255);
  }
  return maskValues;
};

const parseHexColor = (color: string) => {
  const normalized = color.trim().replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  return {
    r: parseInt(expanded.slice(0, 2), 16) / 255,
    g: parseInt(expanded.slice(2, 4), 16) / 255,
    b: parseInt(expanded.slice(4, 6), 16) / 255,
  };
};

type PromptColorTarget =
  | { name: string; type: 'hue'; hue: number; width: number; minSaturation?: number; minLightness?: number; maxLightness?: number }
  | { name: string; type: 'neutral'; mode: 'white' | 'black' | 'gray'; minLightness?: number; maxLightness?: number };

const PROMPT_COLOR_TARGETS: PromptColorTarget[] = [
  { name: 'green', type: 'hue', hue: 118, width: 62, minSaturation: 0.055, minLightness: 0.12, maxLightness: 0.86 },
  { name: 'blue', type: 'hue', hue: 220, width: 52, minSaturation: 0.065, minLightness: 0.08, maxLightness: 0.9 },
  { name: 'cyan', type: 'hue', hue: 185, width: 45, minSaturation: 0.065, minLightness: 0.12, maxLightness: 0.92 },
  { name: 'aqua', type: 'hue', hue: 178, width: 46, minSaturation: 0.065, minLightness: 0.12, maxLightness: 0.92 },
  { name: 'red', type: 'hue', hue: 0, width: 42, minSaturation: 0.08, minLightness: 0.08, maxLightness: 0.88 },
  { name: 'orange', type: 'hue', hue: 30, width: 38, minSaturation: 0.07, minLightness: 0.12, maxLightness: 0.9 },
  { name: 'yellow', type: 'hue', hue: 58, width: 40, minSaturation: 0.07, minLightness: 0.18, maxLightness: 0.96 },
  { name: 'purple', type: 'hue', hue: 275, width: 46, minSaturation: 0.07, minLightness: 0.08, maxLightness: 0.88 },
  { name: 'magenta', type: 'hue', hue: 315, width: 44, minSaturation: 0.07, minLightness: 0.08, maxLightness: 0.88 },
  { name: 'brown', type: 'hue', hue: 28, width: 34, minSaturation: 0.08, minLightness: 0.06, maxLightness: 0.58 },
  { name: 'beige', type: 'hue', hue: 42, width: 34, minSaturation: 0.035, minLightness: 0.34, maxLightness: 0.92 },
  { name: 'white', type: 'neutral', mode: 'white', minLightness: 0.72 },
  { name: 'black', type: 'neutral', mode: 'black', maxLightness: 0.28 },
  { name: 'gray', type: 'neutral', mode: 'gray', minLightness: 0.22, maxLightness: 0.78 },
  { name: 'grey', type: 'neutral', mode: 'gray', minLightness: 0.22, maxLightness: 0.78 },
];

const findPromptColorTarget = (prompt: string) => {
  const normalized = prompt.toLowerCase();
  return PROMPT_COLOR_TARGETS.find((target) => new RegExp(`\\b${target.name}(?:ish)?\\b`, 'i').test(normalized)) || null;
};

const getPromptSurfaceWeight = (prompt: string, x: number, y: number, width: number, height: number) => {
  const normalized = prompt.toLowerCase();
  const nx = width <= 1 ? 0 : x / (width - 1);
  const ny = height <= 1 ? 0 : y / (height - 1);

  if (/\b(floor|ground|carpet|rug|pavement|walkway|tiles?)\b/.test(normalized)) {
    return smoothstep(0.42, 0.72, ny);
  }
  if (/\b(ceiling|soffit|roof)\b/.test(normalized)) {
    return 1 - smoothstep(0.24, 0.56, ny);
  }
  if (/\b(left|left-hand)\b/.test(normalized)) {
    return 1 - smoothstep(0.42, 0.78, nx);
  }
  if (/\b(right|right-hand)\b/.test(normalized)) {
    return smoothstep(0.22, 0.58, nx);
  }

  return 1;
};

const getPromptColorWeight = (target: PromptColorTarget, r: number, g: number, b: number) => {
  const hsl = rgbToHsl(r, g, b);

  if (target.type === 'neutral') {
    const neutralWeight = 1 - smoothstep(0.04, 0.22, hsl.s);
    if (target.mode === 'white') {
      return neutralWeight * smoothstep(target.minLightness || 0.68, 0.94, hsl.l);
    }
    if (target.mode === 'black') {
      return neutralWeight * (1 - smoothstep(0.04, target.maxLightness || 0.32, hsl.l));
    }
    return neutralWeight *
      smoothstep(target.minLightness || 0.18, 0.38, hsl.l) *
      (1 - smoothstep(target.maxLightness || 0.82, 0.96, hsl.l));
  }

  const saturationWeight = smoothstep(target.minSaturation || 0.05, 0.24, hsl.s);
  const lowLightnessWeight = smoothstep(target.minLightness || 0.06, (target.minLightness || 0.06) + 0.14, hsl.l);
  const highLightnessWeight = 1 - smoothstep((target.maxLightness || 0.92) - 0.14, target.maxLightness || 0.92, hsl.l);
  return channelWeight(hsl.h, target.hue, target.width) * saturationWeight * lowLightnessWeight * highLightnessWeight;
};

const createPromptTargetMaskDataUrl = async (sourceDataUrl: string, prompt: string) => {
  const colorTarget = findPromptColorTarget(prompt);
  if (!colorTarget) return null;

  const image = await loadImage(sourceDataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0, width, height);
  const source = ctx.getImageData(0, 0, width, height);
  const mask = ctx.createImageData(width, height);
  let weightedCoverage = 0;
  let strongCoverage = 0;
  let maxMask = 0;

  for (let i = 0, pixel = 0; i < source.data.length; i += 4, pixel += 1) {
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const alpha = source.data[i + 3] / 255;
    const colorWeight = getPromptColorWeight(
      colorTarget,
      source.data[i] / 255,
      source.data[i + 1] / 255,
      source.data[i + 2] / 255
    );
    const surfaceWeight = getPromptSurfaceWeight(prompt, x, y, width, height);
    const value = smoothstep(0.16, 0.58, colorWeight * surfaceWeight * alpha);
    const maskValue = clamp255(value * 255);

    mask.data[i] = maskValue;
    mask.data[i + 1] = maskValue;
    mask.data[i + 2] = maskValue;
    mask.data[i + 3] = 255;

    weightedCoverage += value;
    if (value > 0.28) strongCoverage += 1;
    if (value > maxMask) maxMask = value;
  }

  const pixelCount = Math.max(1, width * height);
  const averageCoverage = weightedCoverage / pixelCount;
  const strongCoverageRatio = strongCoverage / pixelCount;
  if (maxMask < 0.35 || averageCoverage < 0.0015 || strongCoverageRatio < 0.001) {
    return null;
  }
  if (averageCoverage > 0.42 || strongCoverageRatio > 0.55) {
    return null;
  }

  ctx.putImageData(mask, 0, 0);
  return canvas.toDataURL('image/png');
};

const createMaterialTexture = async (
  width: number,
  height: number,
  material: MaterialSwatch,
) => {
  const textureImage = await loadMaterialImage(material);
  const tileSize = 180;
  const tile = document.createElement('canvas');
  tile.width = tileSize;
  tile.height = tileSize;
  const tileCtx = tile.getContext('2d');
  if (!tileCtx) return null;

  tileCtx.imageSmoothingEnabled = true;
  tileCtx.imageSmoothingQuality = 'high';
  tileCtx.drawImage(textureImage, 0, 0, tileSize, tileSize);

  const texture = document.createElement('canvas');
  texture.width = width;
  texture.height = height;
  const textureCtx = texture.getContext('2d');
  if (!textureCtx) return null;

  const pattern = textureCtx.createPattern(tile, 'repeat');
  if (!pattern) return null;

  textureCtx.save();
  textureCtx.translate(width / 2, height / 2);
  textureCtx.fillStyle = pattern;
  const extent = Math.hypot(width, height);
  textureCtx.fillRect(-extent, -extent, extent * 2, extent * 2);
  textureCtx.restore();

  return textureCtx.getImageData(0, 0, width, height).data;
};

const boxBlur = (data: Uint8ClampedArray, width: number, height: number) => {
  const blurred = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let yy = -1; yy <= 1; yy += 1) {
        for (let xx = -1; xx <= 1; xx += 1) {
          const nx = Math.min(width - 1, Math.max(0, x + xx));
          const ny = Math.min(height - 1, Math.max(0, y + yy));
          const idx = (ny * width + nx) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          count += 1;
        }
      }
      const out = (y * width + x) * 4;
      blurred[out] = r / count;
      blurred[out + 1] = g / count;
      blurred[out + 2] = b / count;
      blurred[out + 3] = data[out + 3];
    }
  }
  return blurred;
};

const applyToneAndColor = (
  source: Uint8ClampedArray,
  output: Uint8ClampedArray,
  width: number,
  height: number,
  adjust: VisualAdjustSettings,
) => {
  const exposureFactor = Math.pow(2, adjust.exposure / 50);
  const contrastFactor = 1 + (adjust.contrast / 100) * 1.35;
  const gammaPower = adjust.gamma >= 0
    ? 1 / (1 + (adjust.gamma / 100) * 1.6)
    : 1 + (-adjust.gamma / 100) * 1.6;
  const saturationDelta = (adjust.saturation / 100) * 0.65;
  const vibranceAmount = (adjust.vibrance / 100) * 0.8;
  const hueShiftDegrees = adjust.hueShift * 1.8;
  const channels = channelAdjustments(adjust);

  for (let i = 0, pixel = 0; i < source.length; i += 4, pixel += 1) {
    let r = source[i] / 255;
    let g = source[i + 1] / 255;
    let b = source[i + 2] / 255;
    const x = pixel % width;
    const y = Math.floor(pixel / width);

    let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    r *= exposureFactor;
    g *= exposureFactor;
    b *= exposureFactor;

    const shadowMask = 1 - smoothstep(0.08, 0.72, lum);
    const highlightMask = smoothstep(0.38, 0.96, lum);
    const blackMask = 1 - smoothstep(0.02, 0.34, lum);
    const whiteMask = smoothstep(0.62, 1, lum);
    const toneOffset =
      (adjust.shadows / 100) * 0.34 * shadowMask +
      (adjust.highlights / 100) * 0.34 * highlightMask +
      (adjust.blacks / 100) * 0.24 * blackMask +
      (adjust.whites / 100) * 0.24 * whiteMask;
    r += toneOffset;
    g += toneOffset;
    b += toneOffset;

    r = (r - 0.5) * contrastFactor + 0.5;
    g = (g - 0.5) * contrastFactor + 0.5;
    b = (b - 0.5) * contrastFactor + 0.5;

    r = Math.pow(clamp01(r), gammaPower);
    g = Math.pow(clamp01(g), gammaPower);
    b = Math.pow(clamp01(b), gammaPower);

    const temperature = adjust.temperature / 100;
    const tint = adjust.tint / 100;
    r += temperature * 0.12 + tint * 0.06;
    g -= tint * 0.10;
    b -= temperature * 0.12 + tint * 0.06;

    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const clarityContrast = 1 + ((adjust.clarity + adjust.dehaze * 0.6) / 100) * 0.45;
    r = lum + (r - lum) * clarityContrast;
    g = lum + (g - lum) * clarityContrast;
    b = lum + (b - lum) * clarityContrast;

    let hsl = rgbToHsl(clamp01(r), clamp01(g), clamp01(b));
    hsl.h += hueShiftDegrees;
    hsl.s = clamp01(hsl.s + saturationDelta + vibranceAmount * (1 - hsl.s));
    hsl.l = clamp01(hsl.l + (adjust.dehaze / 100) * 0.04);

    for (const channel of channels) {
      if (channel.hue === 0 && channel.sat === 0 && channel.lum === 0) continue;
      const weight = channelWeight(hsl.h, channel.center);
      if (weight <= 0) continue;
      hsl.h += channel.hue * 0.45 * weight;
      hsl.s = clamp01(hsl.s + (channel.sat / 100) * 0.5 * weight);
      hsl.l = clamp01(hsl.l + (channel.lum / 100) * 0.28 * weight);
    }

    ({ r, g, b } = hslToRgb(hsl.h, hsl.s, hsl.l));
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    const gradeBalance = adjust.colorGradeBalance / 100;
    const shadowGradeMask = (1 - smoothstep(0.12, 0.55 + gradeBalance * 0.2, lum)) * Math.abs(adjust.colorGradeShadowsSaturation / 100);
    const midGradeMask = (1 - Math.abs(lum - 0.5) * 2) * Math.abs(adjust.colorGradeMidtonesSaturation / 100);
    const highGradeMask = smoothstep(0.48 - gradeBalance * 0.2, 0.9, lum) * Math.abs(adjust.colorGradeHighlightsSaturation / 100);
    const shadowColor = colorFromHue(adjust.colorGradeShadowsHue);
    const midColor = colorFromHue(adjust.colorGradeMidtonesHue);
    const highColor = colorFromHue(adjust.colorGradeHighlightsHue);
    r = lerp(r, shadowColor.r, shadowGradeMask * 0.16);
    g = lerp(g, shadowColor.g, shadowGradeMask * 0.16);
    b = lerp(b, shadowColor.b, shadowGradeMask * 0.16);
    r = lerp(r, midColor.r, midGradeMask * 0.10);
    g = lerp(g, midColor.g, midGradeMask * 0.10);
    b = lerp(b, midColor.b, midGradeMask * 0.10);
    r = lerp(r, highColor.r, highGradeMask * 0.12);
    g = lerp(g, highColor.g, highGradeMask * 0.12);
    b = lerp(b, highColor.b, highGradeMask * 0.12);

    const bloom = Math.max(0, adjust.bloom / 100) * smoothstep(0.68, 1, lum) * 0.18;
    r += bloom;
    g += bloom;
    b += bloom;

    if (adjust.vignette !== 0) {
      const nx = (x / Math.max(1, width - 1)) * 2 - 1;
      const ny = (y / Math.max(1, height - 1)) * 2 - 1;
      const distance = Math.sqrt(nx * nx + ny * ny) / Math.SQRT2;
      const midpoint = 0.58 + (adjust.vignetteMidpoint / 100) * 0.22;
      const feather = 0.34 + ((adjust.vignetteFeather + 100) / 200) * 0.42;
      const vignetteMask = smoothstep(midpoint - feather / 2, midpoint + feather / 2, distance);
      const amount = adjust.vignette / 100;
      const delta = amount > 0 ? -amount * 0.48 * vignetteMask : -amount * 0.35 * vignetteMask;
      r += delta;
      g += delta;
      b += delta;
    }

    if (adjust.grain !== 0) {
      const noise = (pseudoNoise(x, y) - 0.5) * (adjust.grain / 100) * 0.08;
      r += noise;
      g += noise;
      b += noise;
    }

    output[i] = clamp255(clamp01(r) * 255);
    output[i + 1] = clamp255(clamp01(g) * 255);
    output[i + 2] = clamp255(clamp01(b) * 255);
    output[i + 3] = source[i + 3];
  }
};

const applyDetailPass = (
  original: Uint8ClampedArray,
  output: Uint8ClampedArray,
  width: number,
  height: number,
  adjust: VisualAdjustSettings,
  maskValues: Float32Array | null,
) => {
  const sharpenAmount = Math.max(0, adjust.sharpness / 100) * 0.9 +
    Math.max(0, adjust.texture / 100) * 0.35 +
    Math.max(0, adjust.clarity / 100) * 0.25;
  const softenAmount = Math.max(0, -adjust.sharpness / 100) * 0.65 +
    Math.max(0, adjust.noiseReduction / 100) * 0.55 +
    Math.max(0, -adjust.texture / 100) * 0.25;

  if (sharpenAmount === 0 && softenAmount === 0) return;

  const blurred = boxBlur(output, width, height);
  for (let i = 0, pixel = 0; i < output.length; i += 4, pixel += 1) {
    const mask = maskValues ? maskValues[pixel] : 1;
    if (mask <= 0) continue;

    for (let c = 0; c < 3; c += 1) {
      const value = output[i + c];
      const blur = blurred[i + c];
      const sharpened = value + (value - blur) * sharpenAmount;
      const softened = lerp(sharpened, blur, softenAmount);
      output[i + c] = clamp255(lerp(original[i + c], softened, mask));
    }
  }
};

export async function applyVisualPostProduction(
  sourceDataUrl: string,
  adjust: VisualAdjustSettings,
  maskDataUrl?: string | null,
): Promise<GeneratedImage> {
  const image = await loadImage(sourceDataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return parseDataUrl(sourceDataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return parseDataUrl(sourceDataUrl);

  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const original = new Uint8ClampedArray(imageData.data);
  const processed = new Uint8ClampedArray(imageData.data);
  const maskValues = await makeMask(maskDataUrl || null, width, height);

  applyToneAndColor(original, processed, width, height, adjust);
  applyDetailPass(original, processed, width, height, adjust, maskValues);

  for (let i = 0, pixel = 0; i < processed.length; i += 4, pixel += 1) {
    const mask = maskValues ? maskValues[pixel] : 1;
    if (mask >= 1) continue;
    processed[i] = clamp255(lerp(original[i], processed[i], mask));
    processed[i + 1] = clamp255(lerp(original[i + 1], processed[i + 1], mask));
    processed[i + 2] = clamp255(lerp(original[i + 2], processed[i + 2], mask));
    processed[i + 3] = original[i + 3];
  }

  imageData.data.set(processed);
  ctx.putImageData(imageData, 0, 0);
  return parseDataUrl(canvas.toDataURL('image/png'));
}

export async function applyMaskedMaterialReplacement(
  sourceDataUrl: string,
  maskDataUrl: string,
  material: MaterialSwatch,
  settings: VisualMaterialSettings,
): Promise<GeneratedImage> {
  const image = await loadImage(sourceDataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return parseDataUrl(sourceDataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return parseDataUrl(sourceDataUrl);

  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const original = new Uint8ClampedArray(imageData.data);
  const output = new Uint8ClampedArray(imageData.data);
  const [maskValues, texture] = await Promise.all([
    makeMask(maskDataUrl, width, height),
    createMaterialTexture(width, height, material),
  ]);

  if (!maskValues || !texture) return parseDataUrl(sourceDataUrl);

  const tint = settings.colorTint && settings.colorTint.toLowerCase() !== '#ffffff'
    ? parseHexColor(settings.colorTint)
    : null;
  const roughness = settings.roughness / 100;
  const reflectionStrength = 0.2 + (1 - roughness) * 0.5;
  const textureContrast = 0.58 + roughness * 0.36;
  const lightingStrength = 1;

  for (let i = 0, pixel = 0; i < output.length; i += 4, pixel += 1) {
    const mask = maskValues[pixel];
    if (mask <= 0) continue;

    const sourceR = original[i] / 255;
    const sourceG = original[i + 1] / 255;
    const sourceB = original[i + 2] / 255;
    const sourceLum = 0.2126 * sourceR + 0.7152 * sourceG + 0.0722 * sourceB;

    let materialR = texture[i] / 255;
    let materialG = texture[i + 1] / 255;
    let materialB = texture[i + 2] / 255;
    if (tint) {
      materialR = lerp(materialR, materialR * tint.r, 0.36);
      materialG = lerp(materialG, materialG * tint.g, 0.36);
      materialB = lerp(materialB, materialB * tint.b, 0.36);
    }

    const materialLum = 0.2126 * materialR + 0.7152 * materialG + 0.0722 * materialB;
    materialR = lerp(materialLum, materialR, textureContrast);
    materialG = lerp(materialLum, materialG, textureContrast);
    materialB = lerp(materialLum, materialB, textureContrast);

    const lightingFactor = lerp(0.84 + materialLum * 0.32, 0.38 + sourceLum * 1.36, lightingStrength);
    let r = materialR * lightingFactor;
    let g = materialG * lightingFactor;
    let b = materialB * lightingFactor;

    const reflectionMask = smoothstep(0.58, 1, sourceLum);
    r = lerp(r, sourceR, reflectionMask * reflectionStrength);
    g = lerp(g, sourceG, reflectionMask * reflectionStrength);
    b = lerp(b, sourceB, reflectionMask * reflectionStrength);

    const shadowMask = 1 - smoothstep(0.06, 0.42, sourceLum);
    r = lerp(r, sourceR * 0.9, shadowMask * 0.26);
    g = lerp(g, sourceG * 0.9, shadowMask * 0.26);
    b = lerp(b, sourceB * 0.9, shadowMask * 0.26);

    output[i] = clamp255(lerp(sourceR * 255, clamp01(r) * 255, mask));
    output[i + 1] = clamp255(lerp(sourceG * 255, clamp01(g) * 255, mask));
    output[i + 2] = clamp255(lerp(sourceB * 255, clamp01(b) * 255, mask));
    output[i + 3] = original[i + 3];
  }

  imageData.data.set(output);
  ctx.putImageData(imageData, 0, 0);
  return parseDataUrl(canvas.toDataURL('image/png'));
}

export async function applyPromptTargetedMaterialReplacement(
  sourceDataUrl: string,
  material: MaterialSwatch,
  settings: VisualMaterialSettings,
  targetPrompt: string,
): Promise<GeneratedImage | null> {
  const maskDataUrl = await createPromptTargetMaskDataUrl(sourceDataUrl, targetPrompt);
  if (!maskDataUrl) return null;
  return applyMaskedMaterialReplacement(sourceDataUrl, maskDataUrl, material, settings);
}
