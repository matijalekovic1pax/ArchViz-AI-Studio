export interface FeedbackImageJpegExportOptions {
  convertRemoteToDataUrl?: boolean;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DATA_IMAGE_PREFIX = /^data:image\//i;
const DATA_JPEG_PREFIX = /^data:image\/jpe?g/i;
const HTTP_IMAGE_PREFIX = /^https?:\/\//i;

const isExportableInput = (value: string): boolean =>
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

const renderFullResolutionJpeg = (image: HTMLImageElement): string | null => {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  try {
    return canvas.toDataURL('image/jpeg', 1);
  } catch {
    return null;
  }
};

export const createFeedbackFullResolutionJpegExporter = (options: FeedbackImageJpegExportOptions = {}) => {
  const convertRemoteToDataUrl = options.convertRemoteToDataUrl === true;
  const timeoutMs = Math.max(1000, Math.min(30_000, Math.floor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)));
  const cache = new Map<string, Promise<string | null>>();

  return async (input: string | null | undefined): Promise<string | null> => {
    if (!input || typeof input !== 'string') return null;
    const normalized = input.trim();
    if (!normalized || !isExportableInput(normalized)) return null;
    if (DATA_JPEG_PREFIX.test(normalized)) return normalized;
    if (HTTP_IMAGE_PREFIX.test(normalized) && !convertRemoteToDataUrl) return null;

    const existing = cache.get(normalized);
    if (existing) return existing;

    const pending = (async (): Promise<string | null> => {
      try {
        const image = await loadImage(normalized, timeoutMs);
        return renderFullResolutionJpeg(image);
      } catch {
        return null;
      }
    })();

    cache.set(normalized, pending);
    return pending;
  };
};
