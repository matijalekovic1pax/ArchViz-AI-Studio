export interface FeedbackImageCompressionOptions {
  quality?: number;
  maxDimension?: number;
  scale?: number;
  convertRemoteToDataUrl?: boolean;
  timeoutMs?: number;
}

const DEFAULT_QUALITY = 0.72;
const DEFAULT_MAX_DIMENSION = 1280;
const DEFAULT_SCALE = 1;
const DEFAULT_TIMEOUT_MS = 10_000;

const DATA_IMAGE_PREFIX = /^data:image\//i;
const HTTP_IMAGE_PREFIX = /^https?:\/\//i;

const isCompressibleInput = (value: string): boolean =>
  DATA_IMAGE_PREFIX.test(value) || HTTP_IMAGE_PREFIX.test(value);

const loadImage = (src: string, timeoutMs: number): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      image.src = '';
      reject(new Error('Image load timed out.'));
    }, timeoutMs);

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      image.onload = null;
      image.onerror = null;
      callback();
    };

    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => settle(() => resolve(image));
    image.onerror = () => settle(() => reject(new Error('Failed to load image.')));
    image.src = src;
  });

const renderAsJpeg = (
  image: HTMLImageElement,
  quality: number,
  maxDimension: number,
  scale: number
): string | null => {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return null;

  const fitScale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const finalScale = Math.min(1, Math.max(0.1, scale)) * fitScale;
  const width = Math.max(1, Math.round(sourceWidth * finalScale));
  const height = Math.max(1, Math.round(sourceHeight * finalScale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Preserve transparent sources by blending onto white before JPEG export.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  try {
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
};

export const createFeedbackJpegCompressor = (options: FeedbackImageCompressionOptions = {}) => {
  const quality = Math.max(0.1, Math.min(0.95, options.quality ?? DEFAULT_QUALITY));
  const maxDimension = Math.max(320, Math.min(8192, Math.floor(options.maxDimension ?? DEFAULT_MAX_DIMENSION)));
  const scale = Math.max(0.1, Math.min(1, options.scale ?? DEFAULT_SCALE));
  const convertRemoteToDataUrl = options.convertRemoteToDataUrl === true;
  const timeoutMs = Math.max(1000, Math.min(30_000, Math.floor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)));

  const cache = new Map<string, Promise<string | null>>();

  return async (input: string | null | undefined): Promise<string | null> => {
    if (!input || typeof input !== 'string') return null;
    const normalized = input.trim();
    if (!normalized || !isCompressibleInput(normalized)) return null;
    if (HTTP_IMAGE_PREFIX.test(normalized) && !convertRemoteToDataUrl) return null;

    const existing = cache.get(normalized);
    if (existing) return existing;

    const pending = (async (): Promise<string | null> => {
      try {
        const image = await loadImage(normalized, timeoutMs);
        return renderAsJpeg(image, quality, maxDimension, scale);
      } catch {
        return null;
      }
    })();

    cache.set(normalized, pending);
    return pending;
  };
};
