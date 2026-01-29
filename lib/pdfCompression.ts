import { getILovePDFService, isILovePDFConfigured } from '../services/ilovepdfService';

export type CompressionLevel = 'light' | 'balanced' | 'aggressive';

export interface CompressionOptions {
  compressionLevel?: CompressionLevel;
  imageQuality?: number; // 0-1, default 0.7
  maxImageDimension?: number; // Max width/height in pixels, auto-set based on level
  removeMetadata?: boolean; // default true
  compressImages?: boolean; // default true
  preserveText?: boolean; // default true (only applies to aggressive mode)
  preserveVectors?: boolean; // default true (only applies to aggressive mode)
}

export interface CompressionResult {
  success: boolean;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  dataUrl: string;
  remainingFiles?: number;
  remainingCredits?: number;
  error?: string;
}

/**
 * Compresses a PDF using iLovePDF's professional compression service
 *
 * Compression Levels:
 * - Light: Minimal optimization (iLovePDF "Low compression")
 * - Balanced: Recommended balance of quality and size (iLovePDF "Recommended")
 * - Aggressive: Maximum compression (iLovePDF "Extreme compression")
 *
 * Requires: VITE_ILOVEPDF_PUBLIC_KEY in .env
 * Free tier: 250 requests/month at https://developer.ilovepdf.com/
 */
export async function compressPdf(
  pdfDataUrl: string,
  options: CompressionOptions = {},
  filename: string = 'document.pdf'
): Promise<CompressionResult> {
  const {
    compressionLevel = 'balanced',
  } = options;

  console.log(`[Compression] Starting compression with level: ${compressionLevel}`);

  // Only use iLovePDF
  if (!isILovePDFConfigured()) {
    const errorMsg = 'iLovePDF API key not configured. Please add VITE_ILOVEPDF_PUBLIC_KEY to your .env file. Get a free key at https://developer.ilovepdf.com/';
    console.error('[Compression] ✗', errorMsg);
    return {
      success: false,
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 0,
      dataUrl: '',
      error: errorMsg,
    };
  }

  console.log('[Compression] Using iLovePDF service');
  const ilovepdf = getILovePDFService();

  if (!ilovepdf) {
    return {
      success: false,
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 0,
      dataUrl: '',
      error: 'Failed to initialize iLovePDF service',
    };
  }

  try {
    const result = await ilovepdf.compressPDF(pdfDataUrl, filename, compressionLevel);
    return result;
  } catch (error) {
    console.error('[Compression] ✗ iLovePDF error:', error);
    return {
      success: false,
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 0,
      dataUrl: '',
      error: error instanceof Error ? error.message : 'Compression failed',
    };
  }
}

/**
 * Batch compress multiple PDFs
 */
export async function compressPdfBatch(
  pdfs: Array<{ id: string; name: string; dataUrl: string }>,
  options: CompressionOptions = {},
  onProgress?: (current: number, total: number, currentId: string) => void
): Promise<Array<CompressionResult & { id: string; name: string }>> {
  const results: Array<CompressionResult & { id: string; name: string }> = [];

  console.log(`[Batch] Starting compression of ${pdfs.length} PDFs with level: ${options.compressionLevel}`);

  for (let i = 0; i < pdfs.length; i++) {
    const pdf = pdfs[i];

    if (onProgress) {
      onProgress(i + 1, pdfs.length, pdf.id);
    }

    console.log(`\n========== Compressing ${pdf.name} (${i + 1}/${pdfs.length}) ==========`);
    const startTime = performance.now();

    const result = await compressPdf(pdf.dataUrl, options, pdf.name);

    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    if (result.success) {
      console.log(`✓ ${pdf.name}: ${duration}s, ${(result.originalSize / 1024 / 1024).toFixed(2)}MB → ${(result.compressedSize / 1024 / 1024).toFixed(2)}MB (${result.compressionRatio.toFixed(1)}% reduction)`);
      console.log(`  DataURL length: ${result.dataUrl.length} chars`);
    } else {
      console.error(`✗ ${pdf.name}: FAILED - ${result.error}`);
    }

    results.push({
      ...result,
      id: pdf.id,
      name: pdf.name,
    });

    // Add a small delay to prevent UI blocking and allow progress updates
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n[Batch] Complete. Processed ${results.filter(r => r.success).length}/${pdfs.length} successfully`);

  return results;
}
