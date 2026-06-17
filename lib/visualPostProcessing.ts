import type { GeneratedImage } from '../services/geminiService';
import type { AppState } from '../types';

type VisualAdjustSettings = AppState['workflow']['visualAdjust'];

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

const parseDataUrl = (dataUrl: string): GeneratedImage => {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
  return {
    dataUrl,
    mimeType: (match?.[1] as GeneratedImage['mimeType']) || 'image/png',
    base64: match?.[2] || dataUrl.split(',')[1] || ''
  };
};

const parseAspectRatioValue = (aspectRatio: string): number | null => {
  const [widthRaw, heightRaw] = aspectRatio.split(':').map(Number);
  if (!Number.isFinite(widthRaw) || !Number.isFinite(heightRaw) || widthRaw <= 0 || heightRaw <= 0) {
    return null;
  }
  return widthRaw / heightRaw;
};

export async function normalizeGeneratedImageAspectRatio(
  image: GeneratedImage,
  aspectRatio?: string | null,
): Promise<GeneratedImage> {
  const targetRatio = aspectRatio ? parseAspectRatioValue(aspectRatio) : null;
  if (!targetRatio) return image;

  const source = await loadImage(image.dataUrl);
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  if (!sourceWidth || !sourceHeight) return image;

  const sourceRatio = sourceWidth / sourceHeight;
  if (Math.abs(sourceRatio - targetRatio) < 0.01) return image;

  let cropX = 0;
  let cropY = 0;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceRatio > targetRatio) {
    cropWidth = Math.round(sourceHeight * targetRatio);
    cropX = Math.round((sourceWidth - cropWidth) / 2);
  } else {
    cropHeight = Math.round(sourceWidth / targetRatio);
    cropY = Math.round((sourceHeight - cropHeight) / 2);
  }

  const canvas = document.createElement('canvas');
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return image;

  ctx.drawImage(
    source,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );
  return parseDataUrl(canvas.toDataURL('image/png'));
}

export async function normalizeGeneratedImagesAspectRatio(
  images: GeneratedImage[],
  aspectRatio?: string | null,
): Promise<GeneratedImage[]> {
  if (!aspectRatio || images.length === 0) return images;
  return Promise.all(images.map((image) => normalizeGeneratedImageAspectRatio(image, aspectRatio)));
}

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
