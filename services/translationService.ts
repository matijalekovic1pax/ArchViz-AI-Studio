/**
 * Translation Service
 * Translates user prompts to English before sending to AI model
 */

import { getGeminiService } from './geminiService';

/**
 * Translates text to English if it's not already in English
 * Uses a simple heuristic to detect language and leverages Gemini API for translation
 */
export async function translateToEnglish(text: string, sourceLanguage?: string): Promise<string> {
  // If text is empty or very short, return as is
  if (!text || text.trim().length < 3) {
    return text;
  }

  // If source language is English or not specified, return as is
  if (!sourceLanguage || sourceLanguage === 'en') {
    return text;
  }

  try {
    const geminiService = getGeminiService();

    // Simple translation prompt
    const translationPrompt = `Translate the following text to English. Only return the English translation, nothing else:

${text}`;

    const translatedText = await geminiService.generateText({
      prompt: translationPrompt,
      generationConfig: {
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '2K'
        }
      }
    });

    return translatedText.trim() || text;
  } catch (error) {
    console.error('Translation failed, using original text:', error);
    return text;
  }
}

/**
 * Detects if text needs translation based on current language
 */
export function needsTranslation(currentLanguage: string): boolean {
  return currentLanguage !== 'en';
}
