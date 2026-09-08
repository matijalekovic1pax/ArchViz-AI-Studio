import type { GenerateMessage } from '../types';

/** Provider-neutral context, rebuilt from memory for either image model. */
export function buildGenerateContext(messages: GenerateMessage[], reference: string | null = null) {
  const complete = messages.filter(message => message.status !== 'error' && message.status !== 'pending');
  const allImages = complete.flatMap(message => [...(message.images || []), ...(message.attachments || []).filter(url => url.startsWith('data:image/'))]);
  // Keep request sizes bounded; an explicitly selected older image always takes priority.
  const images = [...new Set([...(reference ? [reference] : []), ...allImages.reverse()])].slice(0, 12);
  const files = [...new Set(complete.flatMap(message => (message.attachments || []).filter(url => !url.startsWith('data:image/'))))];
  const describe = (url: string) => {
    const index = images.indexOf(url);
    return index < 0 ? '[Older image: not attached. Ask the user to select it if needed.]' : `[Attached image ${index + 1}]`;
  };
  return {
    images,
    files,
    prompt: [
      'You are in an image-generation conversation. Interpret the current request using the conversation below. For edits, preserve unchanged details of the relevant image. For a new unrelated request, create a new image without carrying over unrelated subjects or styles.',
      'Image numbers refer to the order of the attached images. Any additional images after these are uploads for the current request.',
      reference ? `The user explicitly selected attached image 1 as the reference for this request.` : '',
      ...complete.map(message => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}\n${[...(message.images || []), ...(message.attachments || []).filter(url => url.startsWith('data:image/'))].map(describe).join(' ')}`),
    ].filter(Boolean).join('\n\n'),
  };
}
