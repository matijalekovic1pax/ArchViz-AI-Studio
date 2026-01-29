/**
 * iLovePDF API Service
 * Professional PDF compression using iLovePDF's cloud service
 *
 * Setup:
 * 1. Sign up at https://developer.ilovepdf.com/
 * 2. Get your public key from the dashboard
 * 3. Add to .env: VITE_ILOVEPDF_PUBLIC_KEY=your-key
 *
 * Free tier: 250 requests/month
 */

const API_BASE = 'https://api.ilovepdf.com/v1';

interface ILovePDFAuth {
  token: string;
}

interface ILovePDFTask {
  server: string;
  task: string;
  remaining_files?: number;
  remaining_credits?: number;
}

interface ILovePDFUpload {
  server_filename: string;
  filename: string;
  filesize: number;
}

interface ILovePDFProcess {
  download_filename: string;
  filesize: number;
  output_filesize: number;
  output_filenumber: number;
  output_extensions: string[];
  timer: string;
  status: string;
}

export class ILovePDFService {
  private publicKey: string;
  private token: string | null = null;

  constructor(publicKey: string) {
    this.publicKey = publicKey;
  }

  /**
   * Authenticate and get access token
   */
  private async authenticate(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    console.log('[iLovePDF] Authenticating...');

    const response = await fetch(`${API_BASE}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public_key: this.publicKey,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`iLovePDF authentication failed: ${error}`);
    }

    const data: ILovePDFAuth = await response.json();
    this.token = data.token;
    console.log('[iLovePDF] ✓ Authenticated');
    return this.token;
  }

  /**
   * Start a new compression task
   */
  private async startTask(token: string): Promise<ILovePDFTask> {
    console.log('[iLovePDF] Starting compression task...');

    const response = await fetch(`${API_BASE}/start/compress`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start iLovePDF task: ${error}`);
    }

    const data: ILovePDFTask = await response.json();
    console.log('[iLovePDF] ✓ Task started:', data.task);
    return data;
  }

  /**
   * Upload PDF file to task
   */
  private async uploadFile(
    task: ILovePDFTask,
    token: string,
    filename: string,
    fileData: Blob
  ): Promise<ILovePDFUpload & { originalFilename: string }> {
    console.log('[iLovePDF] Uploading file...');

    const formData = new FormData();
    formData.append('task', task.task);
    formData.append('file', fileData, filename);

    const response = await fetch(`https://${task.server}/v1/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload file to iLovePDF: ${error}`);
    }

    const data: ILovePDFUpload = await response.json();
    console.log('[iLovePDF] ✓ File uploaded:', JSON.stringify(data, null, 2));

    // Return with original filename for later use
    return { ...data, originalFilename: filename };
  }

  /**
   * Process compression
   */
  private async processCompression(
    task: ILovePDFTask,
    token: string,
    uploadedFile: ILovePDFUpload & { originalFilename: string },
    compressionLevel: 'low' | 'recommended' | 'extreme'
  ): Promise<ILovePDFProcess> {
    console.log('[iLovePDF] Processing compression...');

    const requestBody = {
      task: task.task,
      tool: 'compress',
      files: [
        {
          server_filename: uploadedFile.server_filename,
          filename: uploadedFile.originalFilename,
        }
      ],
      compression_level: compressionLevel,
    };

    console.log('[iLovePDF] Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`https://${task.server}/v1/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to process compression: ${error}`);
    }

    const data: ILovePDFProcess = await response.json();
    console.log('[iLovePDF] ✓ Compression complete');
    return data;
  }

  /**
   * Download compressed PDF
   */
  private async downloadFile(
    task: ILovePDFTask,
    token: string
  ): Promise<Blob> {
    console.log('[iLovePDF] Downloading compressed file...');

    const response = await fetch(`https://${task.server}/v1/download/${task.task}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to download from iLovePDF: ${error}`);
    }

    const blob = await response.blob();
    console.log('[iLovePDF] ✓ File downloaded');
    return blob;
  }

  /**
   * Compress a PDF using iLovePDF
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
      // Convert dataUrl to Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const originalSize = blob.size;

      console.log(`[iLovePDF] Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

      // Map our levels to iLovePDF levels
      const levelMap: Record<string, 'low' | 'recommended' | 'extreme'> = {
        light: 'low',
        balanced: 'recommended',
        aggressive: 'extreme',
      };
      const ilovepdfLevel = levelMap[compressionLevel];

      // Step 1: Authenticate
      const token = await this.authenticate();

      // Step 2: Start task
      const task = await this.startTask(token);
      const remainingFiles = task.remaining_files;
      const remainingCredits = task.remaining_credits;

      // Step 3: Upload file
      const uploadedFile = await this.uploadFile(task, token, filename, blob);

      // Step 4: Process compression
      const processResult = await this.processCompression(task, token, uploadedFile, ilovepdfLevel);

      // Step 5: Download result
      const compressedBlob = await this.downloadFile(task, token);
      const compressedSize = compressedBlob.size;

      console.log(`[iLovePDF] Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);

      // Convert blob back to dataUrl
      const compressedDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedBlob);
      });

      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

      console.log(`[iLovePDF] ✓ Complete: ${compressionRatio.toFixed(1)}% reduction`);

      return {
        success: true,
        dataUrl: compressedDataUrl,
        originalSize,
        compressedSize,
        compressionRatio,
        remainingFiles,
        remainingCredits,
      };
    } catch (error) {
      console.error('[iLovePDF] ✗ Error:', error);
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
  const publicKey = import.meta.env.VITE_ILOVEPDF_PUBLIC_KEY;

  if (!publicKey) {
    console.warn('[iLovePDF] No public key configured. Add VITE_ILOVEPDF_PUBLIC_KEY to .env');
    return null;
  }

  if (!ilovepdfService) {
    ilovepdfService = new ILovePDFService(publicKey);
  }

  return ilovepdfService;
}

/**
 * Check if iLovePDF is configured
 */
export function isILovePDFConfigured(): boolean {
  return !!import.meta.env.VITE_ILOVEPDF_PUBLIC_KEY;
}
