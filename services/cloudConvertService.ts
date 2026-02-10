/**
 * CloudConvert Service
 * Handles PDF to DOCX and DOCX to PDF conversions using CloudConvert API
 * Uses PDFTron technology for high-fidelity conversions
 */

import CloudConvert from 'cloudconvert';

// Singleton instance
let cloudConvertInstance: CloudConvert | null = null;

/**
 * Initialize CloudConvert service with API key
 */
export function initCloudConvertService(apiKey: string): void {
  if (!apiKey) {
    throw new Error('CloudConvert API key is required');
  }
  cloudConvertInstance = new CloudConvert(apiKey);
}

/**
 * Get CloudConvert instance
 */
function getCloudConvert(): CloudConvert {
  if (!cloudConvertInstance) {
    throw new Error('CloudConvert service not initialized. Call initCloudConvertService() first.');
  }
  return cloudConvertInstance;
}

/**
 * Check if CloudConvert service is initialized
 */
export function isCloudConvertInitialized(): boolean {
  return cloudConvertInstance !== null;
}

export interface ConversionProgress {
  phase: 'uploading' | 'converting' | 'downloading' | 'complete' | 'error';
  progress: number; // 0-100
  message?: string;
}

export interface ConversionOptions {
  onProgress?: (progress: ConversionProgress) => void;
  abortSignal?: AbortSignal;
}

/**
 * Convert PDF to DOCX
 */
export async function convertPdfToDocx(
  pdfDataUrl: string,
  options?: ConversionOptions
): Promise<string> {
  const cloudConvert = getCloudConvert();
  const { onProgress, abortSignal } = options || {};

  try {
    // Report progress: uploading
    onProgress?.({ phase: 'uploading', progress: 10, message: 'Uploading PDF...' });

    // Extract base64 data from data URL
    const base64Match = pdfDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid PDF data URL format');
    }
    const base64Data = base64Match[2];

    // Create conversion job
    const job = await cloudConvert.jobs.create({
      tasks: {
        'import-pdf': {
          operation: 'import/base64',
          file: base64Data,
          filename: 'document.pdf'
        },
        'convert-to-docx': {
          operation: 'convert',
          input: 'import-pdf',
          output_format: 'docx',
          // Enable OCR for scanned PDFs
          engine: 'office',
          // Preserve formatting
          pdf_a: false
        },
        'export-docx': {
          operation: 'export/url',
          input: 'convert-to-docx'
        }
      }
    });

    // Report progress: converting
    onProgress?.({ phase: 'converting', progress: 40, message: 'Converting PDF to DOCX...' });

    // Wait for job completion with polling
    let completedJob = await cloudConvert.jobs.wait(job.id);

    // Check for cancellation
    if (abortSignal?.aborted) {
      throw new Error('Conversion cancelled');
    }

    // Report progress: downloading
    onProgress?.({ phase: 'downloading', progress: 80, message: 'Downloading DOCX...' });

    // Get the export task
    const exportTask = completedJob.tasks.find(task => task.name === 'export-docx');
    if (!exportTask || !exportTask.result?.files?.[0]) {
      throw new Error('Conversion failed: No output file found');
    }

    // Download the converted file
    const fileUrl = exportTask.result.files[0].url;
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download DOCX: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Convert to data URL
    const base64 = btoa(String.fromCharCode(...bytes));
    const docxDataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`;

    // Report progress: complete
    onProgress?.({ phase: 'complete', progress: 100, message: 'Conversion complete!' });

    return docxDataUrl;

  } catch (error) {
    onProgress?.({
      phase: 'error',
      progress: 0,
      message: error instanceof Error ? error.message : 'Conversion failed'
    });
    throw new Error(
      'Failed to convert PDF to DOCX: ' +
      (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

/**
 * Convert DOCX to PDF
 */
export async function convertDocxToPdf(
  docxDataUrl: string,
  options?: ConversionOptions
): Promise<string> {
  const cloudConvert = getCloudConvert();
  const { onProgress, abortSignal } = options || {};

  try {
    // Report progress: uploading
    onProgress?.({ phase: 'uploading', progress: 10, message: 'Uploading DOCX...' });

    // Extract base64 data from data URL
    const base64Match = docxDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid DOCX data URL format');
    }
    const base64Data = base64Match[2];

    // Create conversion job
    const job = await cloudConvert.jobs.create({
      tasks: {
        'import-docx': {
          operation: 'import/base64',
          file: base64Data,
          filename: 'document.docx'
        },
        'convert-to-pdf': {
          operation: 'convert',
          input: 'import-docx',
          output_format: 'pdf',
          // High quality settings
          engine: 'office',
          // Preserve formatting
          pdf_a: false
        },
        'export-pdf': {
          operation: 'export/url',
          input: 'convert-to-pdf'
        }
      }
    });

    // Report progress: converting
    onProgress?.({ phase: 'converting', progress: 40, message: 'Converting DOCX to PDF...' });

    // Wait for job completion
    let completedJob = await cloudConvert.jobs.wait(job.id);

    // Check for cancellation
    if (abortSignal?.aborted) {
      throw new Error('Conversion cancelled');
    }

    // Report progress: downloading
    onProgress?.({ phase: 'downloading', progress: 80, message: 'Downloading PDF...' });

    // Get the export task
    const exportTask = completedJob.tasks.find(task => task.name === 'export-pdf');
    if (!exportTask || !exportTask.result?.files?.[0]) {
      throw new Error('Conversion failed: No output file found');
    }

    // Download the converted file
    const fileUrl = exportTask.result.files[0].url;
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Convert to data URL
    const base64 = btoa(String.fromCharCode(...bytes));
    const pdfDataUrl = `data:application/pdf;base64,${base64}`;

    // Report progress: complete
    onProgress?.({ phase: 'complete', progress: 100, message: 'Conversion complete!' });

    return pdfDataUrl;

  } catch (error) {
    onProgress?.({
      phase: 'error',
      progress: 0,
      message: error instanceof Error ? error.message : 'Conversion failed'
    });
    throw new Error(
      'Failed to convert DOCX to PDF: ' +
      (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

