/**
 * Shared download utility for reliable cross-browser multi-file downloads.
 * Works across Safari, Chrome, Firefox, and Edge on any OS.
 */

function triggerDownload(href: string, filename: string): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Give the browser time to initiate the download before proceeding
    setTimeout(resolve, 150);
  });
}

export function getExtensionFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);/);
  const mimeType = match?.[1] || '';
  switch (mimeType) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/webp': return 'webp';
    case 'image/tiff': return 'tiff';
    default: return 'png';
  }
}

/**
 * Download a single image with three-tier fallback:
 * 1. Canvas re-encode to PNG
 * 2. Fetch as blob + object URL
 * 3. Direct href
 */
export async function downloadImage(
  source: string,
  filename: string,
): Promise<void> {
  // Tier 1: Canvas export
  const canvasExport = (): Promise<void> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('No canvas context');
          ctx.drawImage(img, 0, 0, img.width, img.height);
          const dataUrl = canvas.toDataURL('image/png');
          await triggerDownload(dataUrl, filename);
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = source;
    });

  try {
    await canvasExport();
    return;
  } catch {
    // Fall through to tier 2
  }

  // Tier 2: Blob URL
  const ext = getExtensionFromDataUrl(source);
  const fallbackName = filename.replace(/\.\w+$/, `.${ext}`);
  try {
    const response = await fetch(source);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    await triggerDownload(blobUrl, fallbackName);
    // Delay revocation so the browser has time to read the blob
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1500);
    return;
  } catch {
    // Fall through to tier 3
  }

  // Tier 3: Direct link
  await triggerDownload(source, fallbackName);
}

/**
 * Download multiple images sequentially with a delay between each.
 * Safari requires ~400-500ms between programmatic download triggers.
 */
export async function downloadImagesSequentially(
  items: Array<{ source: string; filename: string }>,
  delayBetweenMs = 600,
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    await downloadImage(items[i].source, items[i].filename);
    if (i < items.length - 1 && delayBetweenMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenMs));
    }
  }
}
