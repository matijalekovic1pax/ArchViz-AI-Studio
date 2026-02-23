/**
 * iLovePDF Compression Service
 * All API calls go through the API gateway — no API keys in the client.
 *
 * Professional PDF compression using iLovePDF's cloud service via gateway
 */

import {
  ilovepdfAuth,
  ilovepdfStart,
  ilovepdfUpload,
  ilovepdfProcess,
  ilovepdfDownload,
} from './apiGateway';

export class ILovePDFService {
  constructor() {
    // No public key needed — gateway handles auth
  }

  /**
   * Compress a PDF using iLovePDF via the API gateway
   */
  async compressPDF(
    dataUrl: string,
    filename: string,
    compressionLevel: 'light' | 'balanced' | 'aggressive' = 'balanced'
  ): Promise<{
    success: boolean;
    dataUrl: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    remainingFiles?: number;
    remainingCredits?: number;
    error?: string;
  }> {
    try {
      // Convert dataUrl to Blob using native fetch (more memory-efficient than JS atob for large files)
      const blobResponse = await fetch(dataUrl);
      const blob = await blobResponse.blob();
      const originalSize = blob.size;

      // Map our levels to iLovePDF levels
      const levelMap: Record<string, 'low' | 'recommended' | 'extreme'> = {
        light: 'low',
        balanced: 'recommended',
        aggressive: 'extreme',
      };
      const ilovepdfLevel = levelMap[compressionLevel];

      // Step 1: Authenticate
      const { token: ilovepdfToken } = await ilovepdfAuth();

      // Step 2: Start task
      const { server, task } = await ilovepdfStart('compress', ilovepdfToken);

      // Step 3: Upload file directly to iLovePDF (bypasses Worker — no size limit)
      const { server_filename } = await ilovepdfUpload(server, task, ilovepdfToken, blob, filename);

      // Step 4: Process compression
      await ilovepdfProcess(server, ilovepdfToken, {
        task,
        tool: 'compress',
        files: [{ server_filename, filename }],
        compression_level: ilovepdfLevel,
      });

      // Step 5: Download result
      const compressedBlob = await ilovepdfDownload(server, task, ilovepdfToken);
      const compressedSize = compressedBlob.size;

      // Convert blob back to dataUrl
      const compressedDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedBlob);
      });

      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

      return {
        success: true,
        dataUrl: compressedDataUrl,
        originalSize,
        compressedSize,
        compressionRatio,
      };
    } catch (error) {
      return {
        success: false,
        dataUrl: '',
        originalSize: 0,
        compressedSize: 0,
        compressionRatio: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
let ilovepdfService: ILovePDFService | null = null;

/**
 * Get iLovePDF service instance
 */
export function getILovePDFService(): ILovePDFService | null {
  if (!ilovepdfService) {
    ilovepdfService = new ILovePDFService();
  }
  return ilovepdfService;
}

/**
 * Check if iLovePDF is configured (gateway manages secrets server-side)
 */
export function isILovePDFConfigured(): boolean {
  return true;
}
