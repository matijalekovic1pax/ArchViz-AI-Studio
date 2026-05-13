import { convertDocxToPdfWithConvertApi, type ConvertApiProgress } from './convertApiService';
import { convertDocxToPdfWithILove, type ILoveConversionProgress } from './iLoveApiService';

export interface DocxPreviewProgress {
  provider: 'ilovepdf' | 'convertapi';
  progress: number;
  message: string;
}

const previewCache = new Map<string, Promise<string>>();
const MAX_CACHE_ENTRIES = 4;

export async function convertDocxToPdfPreview(
  docxDataUrl: string,
  onProgress?: (progress: DocxPreviewProgress) => void
): Promise<string> {
  const cacheKey = createCacheKey(docxDataUrl);
  const cached = previewCache.get(cacheKey);
  if (cached) return cached;

  const conversion = convertWithFallback(docxDataUrl, onProgress).catch((error) => {
    previewCache.delete(cacheKey);
    throw error;
  });

  previewCache.set(cacheKey, conversion);
  trimCache();

  return conversion;
}

async function convertWithFallback(
  docxDataUrl: string,
  onProgress?: (progress: DocxPreviewProgress) => void
) {
  try {
    return await convertDocxToPdfWithILove(docxDataUrl, (progress) => {
      onProgress?.(mapILoveProgress(progress));
    });
  } catch (iloveError) {
    console.warn('iLovePDF DOCX preview conversion failed; falling back to ConvertAPI.', iloveError);

    return convertDocxToPdfWithConvertApi(docxDataUrl, (progress) => {
      onProgress?.(mapConvertApiProgress(progress));
    });
  }
}

function mapILoveProgress(progress: ILoveConversionProgress): DocxPreviewProgress {
  return {
    provider: 'ilovepdf',
    progress: progress.progress,
    message: progress.message ?? 'Preparing Word page preview...',
  };
}

function mapConvertApiProgress(progress: ConvertApiProgress): DocxPreviewProgress {
  return {
    provider: 'convertapi',
    progress: progress.percent,
    message: progress.message,
  };
}

function createCacheKey(dataUrl: string): string {
  return `${dataUrl.length}:${dataUrl.slice(0, 160)}:${dataUrl.slice(-160)}`;
}

function trimCache() {
  while (previewCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = previewCache.keys().next().value;
    if (!oldestKey) return;
    previewCache.delete(oldestKey);
  }
}
