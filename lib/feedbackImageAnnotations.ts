import type {
  AppState,
  FeedbackImageAnnotation,
  FeedbackImageSourceType,
  FeedbackProjectSnapshot,
  GenerationMode,
  HistoryItem,
} from '../types';

export interface FeedbackImageCandidate {
  id: string;
  sourceType: FeedbackImageSourceType;
  label: string;
  previewUrl: string;
  historyId?: string | null;
  historyIndex?: number | null;
  mode?: GenerationMode | null;
  timestamp?: number | null;
}

const formatModeFallback = (mode: GenerationMode | null | undefined): string =>
  String(mode || 'unknown')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const collectFeedbackImageCandidates = (state: AppState): FeedbackImageCandidate[] => {
  const candidates: FeedbackImageCandidate[] = [];

  const pushCandidate = (candidate: FeedbackImageCandidate) => {
    if (!candidate.previewUrl) return;
    candidates.push(candidate);
  };

  state.history.forEach((item: HistoryItem, index) => {
    if (!item.thumbnail) return;
    const baseLabel = `Step ${index + 1}`;
    const modeLabel = formatModeFallback(item.mode);
    pushCandidate({
      id: `history-${item.id || index}`,
      sourceType: 'history',
      label: `${baseLabel} • ${modeLabel}`,
      previewUrl: item.thumbnail,
      historyId: item.id,
      historyIndex: index,
      mode: item.mode,
      timestamp: item.timestamp ?? null,
    });
  });

  // Fallback for sessions with no history entries yet.
  if (candidates.length === 0) {
    const fallbackUrl = state.uploadedImage || state.sourceImage;
    if (fallbackUrl) {
      pushCandidate({
        id: 'current-image',
        sourceType: 'current',
        label: `Step 1 • ${formatModeFallback(state.mode)}`,
        previewUrl: fallbackUrl,
        mode: state.mode,
        timestamp: Date.now(),
      });
    }
  }

  return candidates;
};

export const resolveFeedbackAnnotationImageUrl = (
  annotation: FeedbackImageAnnotation,
  snapshot: FeedbackProjectSnapshot | null | undefined
): string | null => {
  if (annotation.previewDataUrl) {
    return annotation.previewDataUrl;
  }

  const appState = snapshot?.appState;
  if (!appState) return null;

  if (annotation.sourceType === 'source') {
    return appState.sourceImage || appState.uploadedImage || null;
  }

  if (annotation.sourceType === 'current') {
    return appState.uploadedImage || appState.sourceImage || null;
  }

  const history = Array.isArray(appState.history) ? appState.history : [];
  if (annotation.historyId) {
    const byId = history.find((item) => item.id === annotation.historyId);
    if (byId?.thumbnail) return byId.thumbnail;
  }

  if (annotation.historyIndex != null) {
    const byIndex = history[annotation.historyIndex];
    if (byIndex?.thumbnail) return byIndex.thumbnail;
  }

  return null;
};
