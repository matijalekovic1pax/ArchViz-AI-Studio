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

  if (video.inputMode === 'video-upload') {
    const source = video.omniSourceVideo;
    if (video.model !== 'gemini-omni-1.1-flash') return { ready: false, message: 'Select Omni Flash to use uploaded videos.' };
    if (!source) return { ready: false, message: 'Prepare and upload a source clip of 10 seconds or less.' };
    if (!Number.isFinite(Date.parse(source.expiresAt)) || Date.parse(source.expiresAt) <= Date.now()) return { ready: false, message: 'The source upload expired. Upload the clip again.' };
    if (!hasBrief) return { ready: false, message: 'Describe the edit or continuation for your uploaded clip.' };
    if (!['edit', 'extend'].includes(video.omniFollowUp || '')) return { ready: false, message: 'Choose Edit or Extend for the uploaded clip.' };
    return { ready: true };
  }

  // A chained Omni edit/extend operates on the stored video, so it wants an
  // instruction rather than an input image.
  const isOmniFollowUp =
    video.model === 'gemini-omni-1.1-flash' &&
    Boolean(video.omniInteractionId) &&
    (video.omniFollowUp ?? 'none') !== 'none';

  if (isOmniFollowUp) {
    if (video.omniInteractionExpiresAt && Date.parse(video.omniInteractionExpiresAt) <= Date.now())
      return { ready: false, message: 'This generated-video interaction expired. Generate a new clip or upload a source clip.' };
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
