import type { AppState } from '../types';

/**
 * Whether Video Studio has everything it needs to generate, and why not if it
 * doesn't.
 *
 * The top bar, the mobile panels and the app assistant all gate on this. They
 * each carried their own copy once and drifted apart, so the rule lives here.
 */
export function getVideoReadiness(state: AppState): { ready: boolean; message?: string } {
  const video = state.workflow.videoState;
  const hasBrief = Boolean(state.prompt?.trim() || video.scenario?.trim());

  // A chained Omni edit/extend operates on the stored video, so it wants an
  // instruction rather than an input image.
  const isOmniFollowUp =
    video.model === 'gemini-omni-1.1-flash' &&
    Boolean(video.omniInteractionId) &&
    (video.omniFollowUp ?? 'none') !== 'none';

  if (isOmniFollowUp) {
    if (hasBrief) return { ready: true };
    return {
      ready: false,
      message: video.omniFollowUp === 'extend'
        ? 'Describe how the clip should continue before extending it.'
        : 'Describe the change to apply before editing the clip.',
    };
  }

  if (video.inputMode === 'text-to-video') {
    return hasBrief
      ? { ready: true }
      : { ready: false, message: 'Write a prompt before generating video from text.' };
  }

  if (video.inputMode === 'image-animate') {
    return video.videoInputImage || state.uploadedImage
      ? { ready: true }
      : { ready: false, message: 'Add a video input image before generating video.' };
  }

  if (video.inputMode === 'image-morph') {
    return video.startFrame && video.endFrame
      ? { ready: true }
      : { ready: false, message: 'Add start and end frames before interpolating video.' };
  }

  return video.keyframes.length > 0
    ? { ready: true }
    : { ready: false, message: 'Add video keyframes before generating.' };
}
