export interface FeedbackImageCompressionOptions {
  quality?: number;
  maxDimension?: number;
  convertRemoteToDataUrl?: boolean;
}

const DEFAULT_QUALITY = 0.06;
const DEFAULT_MAX_DIMENSION = 720;

const DATA_IMAGE_PREFIX = /^data:image\//i;
const HTTP_IMAGE_PREFIX = /^https?:\/\//i;

const isCompressibleInput = (value: string): boolean =>
  DATA_IMAGE_PREFIX.test(value) || HTTP_IMAGE_PREFIX.test(value);

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image.'));
    image.src = src;
  });

const renderAsJpeg = (image: HTMLImageElement, quality: number, maxDimension: number): string | null => {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return null;

  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

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
  const quality = Math.max(0.01, Math.min(0.4, options.quality ?? DEFAULT_QUALITY));
  const maxDimension = Math.max(160, Math.min(4096, Math.floor(options.maxDimension ?? DEFAULT_MAX_DIMENSION)));
  const convertRemoteToDataUrl = options.convertRemoteToDataUrl === true;

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
        const image = await loadImage(normalized);
        return renderAsJpeg(image, quality, maxDimension);
      } catch {
        return null;
      }
    })();

    cache.set(normalized, pending);
    return pending;
  };
};
