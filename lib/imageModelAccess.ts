export const CHATGPT_IMAGE_MODEL_ACCESS_CODE = '1234';
export const CHATGPT_IMAGE_MODEL_ACCESS_HEADER = 'X-Archviz-OpenAI-Image-Code';

const CHATGPT_IMAGE_MODEL_ACCESS_STORAGE_KEY = 'archviz_chatgpt_image_model_access_code';

const normalizeAccessCode = (code: string | null | undefined) => (code || '').trim();

const getSessionStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export function getChatGPTImageModelAccessCode(): string | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  const code = normalizeAccessCode(storage.getItem(CHATGPT_IMAGE_MODEL_ACCESS_STORAGE_KEY));
  return code || null;
}

export function hasChatGPTImageModelAccess(): boolean {
  return getChatGPTImageModelAccessCode() === CHATGPT_IMAGE_MODEL_ACCESS_CODE;
}

export function unlockChatGPTImageModel(code: string): boolean {
  const normalizedCode = normalizeAccessCode(code);
  if (normalizedCode !== CHATGPT_IMAGE_MODEL_ACCESS_CODE) return false;

  const storage = getSessionStorage();
  if (storage) {
    storage.setItem(CHATGPT_IMAGE_MODEL_ACCESS_STORAGE_KEY, normalizedCode);
  }
  return true;
}
