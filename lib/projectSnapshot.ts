import type { AppState, FeedbackProjectSnapshot } from '../types';
import { createFeedbackJpegCompressor } from './feedbackImageCompression';

export const FEEDBACK_SNAPSHOT_VERSION = 1;

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');

const sha256Hex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
};

export interface PreparedFeedbackSnapshot {
  snapshot: FeedbackProjectSnapshot;
  snapshotJson: string;
  snapshotHash: string;
  snapshotSizeBytes: number;
  snapshotVersion: number;
}

const compressStateForFeedbackSnapshot = async (state: AppState): Promise<AppState> => {
  const compressToMediumJpeg = createFeedbackJpegCompressor({
    quality: 0.68,
    scale: 1,
    maxDimension: 1280,
    convertRemoteToDataUrl: false,
    timeoutMs: 8000,
  });

  const compressDataImage = async (value: string | null): Promise<string | null> => {
    if (!value || !value.startsWith('data:image/')) return value;
    const compressed = await compressToMediumJpeg(value);
    if (!compressed) return value;
    return compressed.length < value.length ? compressed : value;
  };

  const [uploadedImage, sourceImage] = await Promise.all([
    compressDataImage(state.uploadedImage),
    compressDataImage(state.sourceImage),
  ]);

  const history = await Promise.all(
    state.history.map(async (item) => {
      const [thumbnail, attachments] = await Promise.all([
        compressDataImage(item.thumbnail),
        item.attachments
          ? Promise.all(item.attachments.map((attachment) => compressDataImage(attachment)))
          : Promise.resolve(undefined),
      ]);
      return {
        ...item,
        thumbnail: thumbnail || item.thumbnail,
        attachments: attachments ? attachments.map((attachment, index) => attachment || item.attachments?.[index] || '') : item.attachments,
      };
    })
  );

  const videoState = state.workflow.videoState;
  const [videoInputImage, startFrame, endFrame, generationHistory] = await Promise.all([
    compressDataImage(videoState.videoInputImage),
    compressDataImage(videoState.startFrame),
    compressDataImage(videoState.endFrame),
    Promise.all(
      videoState.generationHistory.map(async (item) => {
        const thumbnail = await compressDataImage(item.thumbnail);
        return { ...item, thumbnail: thumbnail || item.thumbnail };
      })
    ),
  ]);

  const headshot = state.workflow.headshot;
  const [leftImage, frontImage, rightImage, generatedItems] = await Promise.all([
    compressDataImage(headshot.leftImage),
    compressDataImage(headshot.frontImage),
    compressDataImage(headshot.rightImage),
    Promise.all(
      headshot.generatedItems.map(async (item) => {
        const url = await compressDataImage(item.url);
        return { ...item, url: url || item.url };
      })
    ),
  ]);

  const documentTranslate = state.workflow.documentTranslate;
  const pdfCompression = state.workflow.pdfCompression;

  return {
    ...state,
    uploadedImage,
    sourceImage,
    workflow: {
      ...state.workflow,
      videoState: {
        ...videoState,
        videoInputImage,
        startFrame,
        endFrame,
        generationHistory,
      },
      documentTranslate: {
        ...documentTranslate,
        sourceDocument: documentTranslate.sourceDocument
          ? { ...documentTranslate.sourceDocument, dataUrl: '' }
          : null,
        translatedDocumentUrl: documentTranslate.translatedDocumentUrl ? null : null,
      },
      pdfCompression: {
        ...pdfCompression,
        queue: pdfCompression.queue.map((item) => ({ ...item, dataUrl: '' })),
        outputs: pdfCompression.outputs.map((item) => ({ ...item, dataUrl: '' })),
      },
      headshot: {
        ...headshot,
        leftImage,
        frontImage,
        rightImage,
        generatedItems,
      },
    },
    materialValidation: {
      ...state.materialValidation,
      documents: state.materialValidation.documents.map((item) => ({ ...item, dataUrl: '' })),
    },
    history,
  };
};

export const createFeedbackProjectSnapshot = (
  state: AppState,
  reporterEmail: string,
  projectName?: string | null
): FeedbackProjectSnapshot => {
  return {
    snapshotVersion: FEEDBACK_SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    reporterEmail,
    projectName: projectName?.trim() || null,
    mode: state.mode,
    historyCount: state.history.length,
    appState: state,
    metadata: {
      app: 'archviz-ai-studio',
      schema: 'feedback-project-snapshot-v1',
    },
  };
};

export const prepareFeedbackSnapshot = async (
  state: AppState,
  reporterEmail: string,
  projectName?: string | null
): Promise<PreparedFeedbackSnapshot> => {
  const compactState = await compressStateForFeedbackSnapshot(state);
  const snapshot = createFeedbackProjectSnapshot(compactState, reporterEmail, projectName);
  const snapshotJson = JSON.stringify(snapshot);
  const snapshotHash = await sha256Hex(snapshotJson);
  const snapshotSizeBytes = new TextEncoder().encode(snapshotJson).length;

  return {
    snapshot,
    snapshotJson,
    snapshotHash,
    snapshotSizeBytes,
    snapshotVersion: FEEDBACK_SNAPSHOT_VERSION,
  };
};

export const downloadSnapshotJson = (snapshotJson: string, reportTitle?: string) => {
  const safeName = (reportTitle || 'feedback-report')
    .trim()
    .replace(/[^a-z0-9-_ ]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'feedback-report';

  const fileName = `${safeName}-${Date.now()}.json`;
  const blob = new Blob([snapshotJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};
