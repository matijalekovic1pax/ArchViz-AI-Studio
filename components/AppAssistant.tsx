import React, { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChevronDown, FileText, Loader2, MessageCircle, Paperclip, RefreshCw, Send, SquareMousePointer, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import type { AppState, GenerationMode } from '../types';
import { useGeneration } from '../hooks/useGeneration';
import { cn } from '../lib/utils';
import {
  buildAppAssistantPrompt,
  buildAppAssistantWorkspaceSnapshot,
  getAppAssistantFeature,
} from '../lib/appAssistantKnowledge';
import {
  applyAppAssistantActions,
  buildAppAssistantActionContext,
  extractAppAssistantActions,
  normalizeAppAssistantActions,
  type AppAssistantAction,
  type AppAssistantActionRequest,
  type AppAssistantChatFile,
  type AppAssistantChatImage,
} from '../lib/appAssistantActions';
import { downloadFile, downloadImage, downloadImagesSequentially } from '../lib/download';
import { downloadMaterialValidationReport } from '../lib/materialValidationExport';
import { GeminiService, ImageUtils, type AttachmentData, type ImageData } from '../services/geminiService';
import { getGatewaySessionDiagnostics } from '../services/apiGateway';

type AssistantRole = 'user' | 'assistant';

interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  isLoading?: boolean;
  attachments?: AppAssistantChatImage[];
  files?: AppAssistantChatFile[];
  actions?: AppAssistantAction[];
  appliedActionIds?: string[];
}

interface PendingGenerationRequest {
  id: string;
  prompt?: string;
}

interface AppAssistantTestHooks {
  version: 1;
  getActionContext: () => string;
  routeFallbackRequests: (
    question: string,
    requests?: AppAssistantActionRequest[],
    options?: { chatImages?: AppAssistantChatImage[]; chatFiles?: AppAssistantChatFile[] }
  ) => AppAssistantAction[];
  normalizeRequests: (
    requests: AppAssistantActionRequest[],
    options?: { chatImages?: AppAssistantChatImage[]; chatFiles?: AppAssistantChatFile[] }
  ) => AppAssistantAction[];
  applyRequests: (
    requests: AppAssistantActionRequest[],
    options?: { chatImages?: AppAssistantChatImage[]; chatFiles?: AppAssistantChatFile[] }
  ) => AppAssistantAction[];
}

interface AppAssistantTestCommandDetail {
  id?: string;
  command?: 'context' | 'normalize' | 'apply' | 'route-fallback';
  question?: string;
  requests?: AppAssistantActionRequest[];
  options?: { chatImages?: AppAssistantChatImage[]; chatFiles?: AppAssistantChatFile[] };
}

type AppAssistantSmokePhase =
  | 'idle'
  | 'setup-wait'
  | 'batch-wait'
  | 'helpers-wait'
  | 'files-wait'
  | 'triggers-wait'
  | 'clear-wait'
  | 'done';

interface AppAssistantSmokeState {
  phase: AppAssistantSmokePhase;
  setupActionTypes: string[];
  batchActionTypes: string[];
  helperActionTypes: string[];
  fileActionTypes: string[];
  generationActionTypes: string[];
  downloadActionTypes: string[];
  clearActionTypes: string[];
}

type AppAssistantSubmitSmokePhase = 'idle' | 'wait' | 'done';

interface AppAssistantSubmitSmokeState {
  phase: AppAssistantSubmitSmokePhase;
}

declare global {
  interface Window {
    __ARCHWIZ_ASSISTANT_TEST_HOOKS__?: AppAssistantTestHooks;
  }
}

const ASSISTANT_MODEL = 'gemini-3.5-flash';
const maxAssistantComposerImages = 4;
const maxAssistantComposerFiles = 8;
const makeMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const isDownloadAction = (action: AppAssistantAction) => action.type.startsWith('download_');

const isAppAssistantTestBridgeEnabled = () => {
  if (typeof window === 'undefined') return false;
  const env = (import.meta as any).env;
  const bypassAllowed = Boolean(env?.DEV) || env?.VITE_ARCHWIZ_TEST_AUTH_BYPASS === '1';
  if (!bypassAllowed) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has('archwizTest')) return true;
  try {
    return window.localStorage.getItem('archwiz:test') === '1';
  } catch {
    return false;
  }
};

const isAppAssistantSmokeEnabled = () => {
  if (!isAppAssistantTestBridgeEnabled()) return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('archwizAssistantSmoke');
};

const isAppAssistantSubmitSmokeEnabled = () => {
  if (!isAppAssistantTestBridgeEnabled()) return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('archwizAssistantSubmitSmoke');
};

const writeAssistantSmokeTrigger = (name: string, payload: unknown) => {
  if (!isAppAssistantSmokeEnabled()) return false;
  document.documentElement.setAttribute(name, JSON.stringify(payload));
  return true;
};

const writeAssistantSubmitSmoke = (name: string, payload: unknown) => {
  if (!isAppAssistantSubmitSmokeEnabled()) return false;
  document.documentElement.setAttribute(name, JSON.stringify(payload));
  return true;
};

const writeAssistantLiveDiagnostics = () => {
  if (!isAppAssistantTestBridgeEnabled()) return;
  document.documentElement.setAttribute(
    'data-archwiz-assistant-live-diagnostics',
    JSON.stringify(getGatewaySessionDiagnostics())
  );
};

interface InspectRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const getCompactText = (value: string | null | undefined, maxLength = 220) => {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
};

const getAssistantImageSources = (state: AppState, chatImages: AppAssistantChatImage[] = []) => {
  const latestHistoryImage = state.history.length > 0 ? state.history[state.history.length - 1]?.thumbnail : null;
  const candidates = [
    ...chatImages.map((image, index) => ({
      url: image.url,
      label: `user attached image ${index + 1}${image.name ? ` (${image.name})` : ''}`,
    })),
    { url: state.workflow.visualSelectionComposite, label: 'selected image areas overlay' },
    { url: state.uploadedImage, label: 'current canvas image' },
    { url: state.sourceImage && state.sourceImage !== state.uploadedImage ? state.sourceImage : null, label: 'locked source image' },
    { url: latestHistoryImage, label: 'latest generated history image' },
  ].filter((item): item is { url: string; label: string } => Boolean(item.url && item.url.startsWith('data:image/')));

  const seen = new Set<string>();
  return candidates.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).slice(0, 8);
};

const getAssistantImages = (state: AppState, chatImages: AppAssistantChatImage[] = []): ImageData[] => {
  return getAssistantImageSources(state, chatImages).flatMap((source) => {
    try {
      return [ImageUtils.dataUrlToImageData(source.url)];
    } catch {
      return [];
    }
  });
};

const dataUrlToAttachmentData = (file: AppAssistantChatFile): AttachmentData | null => {
  const match = file.url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: file.mimeType || match[1],
    base64: match[2],
    name: file.name,
  };
};

const getAssistantFileAttachments = (chatFiles: AppAssistantChatFile[] = []): AttachmentData[] =>
  chatFiles.flatMap((file) => {
    const attachment = dataUrlToAttachmentData(file);
    return attachment ? [attachment] : [];
  });

const getAssistantServiceErrorMessage = (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  if (/not authenticated|session expired|please sign in/i.test(message)) {
    const diagnostics = getGatewaySessionDiagnostics();
    const gatewayText = diagnostics.hasConfiguredGatewayUrl
      ? `configured gateway ${diagnostics.gatewayUrl}`
      : `default gateway ${diagnostics.gatewayUrl}`;
    const sessionText = diagnostics.authenticated
      ? 'an active gateway session is present'
      : 'no active gateway session is present';
    return `The assistant needs a signed-in gateway session before it can call the model. Current status: ${gatewayText}; ${sessionText}. Please sign in again, then retry this message.`;
  }
  return 'I could not reach the assistant right now. Please try again.';
};

const summarizeAssistantTestValue = (value: unknown): unknown => {
  if (typeof value === 'string' && value.startsWith('data:')) {
    const match = value.match(/^data:([^;]+);base64,(.*)$/);
    return {
      present: true,
      mimeType: match?.[1] || null,
      chars: value.length,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => summarizeAssistantTestValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        key === 'url' || key === 'dataUrl' ? summarizeAssistantTestValue(item) : summarizeAssistantTestValue(item),
      ])
    );
  }
  return value;
};

const summarizeAssistantTestActions = (actions: AppAssistantAction[]) =>
  actions.map((action) => ({
    ...action,
    value: summarizeAssistantTestValue(action.value),
    file: action.file
      ? {
          ...action.file,
          url: summarizeAssistantTestValue(action.file.url),
        }
      : undefined,
  }));

const getActionStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
    }
  } catch {
    // Fall through to comma-separated parsing.
  }
  return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
};

const getAssistantSubmitSmokeAnswer = () => [
  'Submit smoke response applied through the normal assistant parser.',
  '<assistant_actions>{"actions":[',
  '{"type":"set_mode","mode":"visual-edit","label":"Switch to Visual Edit"},',
  '{"type":"set_prompt","value":"Submit smoke prompt","label":"Set submit smoke prompt"},',
  '{"type":"set_workflow","path":"visualPrompt","value":"Replace the selected floor with warm oak planks from the submit smoke.","label":"Set Visual Edit prompt"},',
  '{"type":"set_output","path":"format","value":"jpg","label":"Set output format"},',
  '{"type":"use_chat_image","imageTarget":"canvas","attachmentId":"submit-img","label":"Use submit smoke image"},',
  '{"type":"use_chat_file","fileTarget":"document-translate-source","attachmentId":"submit-doc","label":"Use submit smoke document"}',
  ']}</assistant_actions>',
].join('');

const ROUTE_TO_VISUAL_EDIT_MODES = new Set<GenerationMode>([
  'generate-text',
  'render-3d',
  'render-cad',
  'render-sketch',
  'scene-compose',
  'masterplan',
  'exploded',
  'section',
  'multi-angle',
  'angle-change',
  'upscale',
]);

const visualEditTargetPatterns: Array<{ pattern: RegExp; target: string; label: string }> = [
  { pattern: /\b(chairs?|seats?|seating|benches?)\b/i, target: 'Seating', label: 'seating' },
  { pattern: /\b(carpet|carpets|rug|rugs|floor|floors|flooring|ground)\b/i, target: 'Floors', label: 'flooring' },
  { pattern: /\b(plants?|trees?|vegetation|landscap(?:e|ing)|greenery)\b/i, target: 'Vegetation', label: 'vegetation' },
  { pattern: /\b(furniture|sofas?|tables?|desks?|counters?)\b/i, target: 'Furniture', label: 'furniture' },
  { pattern: /\b(walls?|paint|facade|fa[cç]ade|ceilings?)\b/i, target: 'Walls', label: 'walls' },
  { pattern: /\b(glass|windows?|glazing)\b/i, target: 'Glass', label: 'glass' },
  { pattern: /\b(signs?|signage|wayfinding|labels?|text)\b/i, target: 'Signage', label: 'signage' },
  { pattern: /\b(sky|clouds?|background)\b/i, target: 'Sky', label: 'sky' },
  { pattern: /\b(lights?|lighting|lamps?|fixtures?)\b/i, target: 'Lighting', label: 'lighting' },
  { pattern: /\b(people|persons?|passengers?|crowd)\b/i, target: 'People', label: 'people' },
];

const isTargetedExistingImageEditRequest = (question: string) => {
  const text = question.toLowerCase();
  const hasEditIntent = /\b(change|alter|edit|modify|adjust|recolor|recolour|color|colour|paint|replace|swap|retouch|fix|make|turn)\b/.test(text);
  const hasTarget = visualEditTargetPatterns.some((item) => item.pattern.test(question));
  const hasLocalEditLanguage = /\b(color|colour|material|texture|finish|selected|only|area|region|object|chairs?|carpet|plants?)\b/.test(text);
  return hasEditIntent && hasTarget && hasLocalEditLanguage;
};

const getVisualEditFallbackTargets = (question: string) => {
  const targets = visualEditTargetPatterns
    .filter((item) => item.pattern.test(question))
    .map((item) => item.target);
  return Array.from(new Set(targets)).slice(0, 6);
};

const getVisualEditFallbackTool = (question: string) => {
  const text = question.toLowerCase();
  if (/\b(remove|erase|delete|clean up|cleanup)\b/.test(text)) return 'remove';
  if (/\b(sky|clouds?)\b/.test(text)) return 'sky';
  if (/\b(light|lighting|relight|shadow|shadows)\b/.test(text)) return 'lighting';
  if (/\b(replace|swap)\b/.test(text) && !/\b(color|colour|material|texture|finish|paint)\b/.test(text)) return 'replace';
  return 'material';
};

const buildVisualEditFallbackPrompt = (question: string, targets: string[]) => {
  const cleanQuestion = question.replace(/\s+/g, ' ').trim();
  const targetText = targets.length
    ? targets.map((target) => target.toLowerCase()).join(', ')
    : 'selected target areas';
  return [
    cleanQuestion || `Apply the requested edit to the selected ${targetText}.`,
    `Edit only the selected ${targetText}. Preserve all unselected architecture, people, camera angle, lighting direction, signage, object positions, floor plan, and scene layout.`,
  ].join(' ');
};

const appendVisualEditRoutingFallbackRequests = (
  requests: AppAssistantActionRequest[],
  state: AppState,
  question: string
): AppAssistantActionRequest[] => {
  if (state.mode === 'visual-edit' || !ROUTE_TO_VISUAL_EDIT_MODES.has(state.mode)) return requests;
  if (!isTargetedExistingImageEditRequest(question)) return requests;

  const hasVisualEditRoute = requests.some((request) =>
    (request.type === 'set_mode' && request.mode === 'visual-edit') ||
    request.type === 'run_ai_selection' ||
    request.type === 'prepare_image_selection'
  );
  if (hasVisualEditRoute) return requests;

  const targets = getVisualEditFallbackTargets(question);
  if (!targets.length) return requests;

  const fallbackRequests: AppAssistantActionRequest[] = [
    {
      type: 'set_mode',
      mode: 'visual-edit',
      label: 'Switch to Visual Edit',
      reason: 'Targeted color/material changes belong in Visual Edit, not the current full-generation workflow.',
    },
    {
      type: 'set_image_generation_model',
      value: 'chatgpt-image-generation-2',
      label: 'Use ChatGPT Image Generation 2',
      reason: 'Precise local edits to an existing render need stronger preservation.',
    },
    {
      type: 'set_workflow',
      path: 'activeTool',
      value: getVisualEditFallbackTool(question),
      label: 'Choose the Visual Edit tool',
      reason: 'This prepares the edit as a targeted local change.',
    },
    {
      type: 'set_workflow',
      path: 'visualSelection.mode',
      value: 'ai',
      label: 'Use AI selection',
      reason: `The assistant can detect ${targets.join(', ')} before editing.`,
    },
    {
      type: 'set_workflow',
      path: 'visualSelection.autoTargets',
      value: targets,
      label: `Target ${targets.join(', ')}`,
      reason: 'These are the visible regions requested in the edit.',
    },
    {
      type: 'set_workflow',
      path: 'visualPrompt',
      value: buildVisualEditFallbackPrompt(question, targets),
      label: 'Set Visual Edit prompt',
      reason: 'The prompt locks the edit to the requested objects while preserving the rest of the render.',
    },
    {
      type: 'open_right_panel',
      label: 'Open Visual Edit controls',
      reason: 'The selection and edit controls live in the Visual Edit panel.',
    },
  ];

  if (state.uploadedImage && !state.workflow.visualAutoSelecting) {
    fallbackRequests.push({
      type: 'run_ai_selection',
      value: targets,
      label: `AI-select ${targets.join(', ')}`,
      reason: 'This moves the workspace into Visual Edit and starts detecting the requested areas.',
    });
  }

  return [...requests, ...fallbackRequests];
};

type CurrentImageDownloadFormat = 'png' | 'jpg';
type CurrentImageDownloadResolution = 'full' | 'medium';

const parseCurrentImageDownloadOptions = (
  value: unknown
): { format: CurrentImageDownloadFormat; resolution: CurrentImageDownloadResolution } => {
  const fallback = { format: 'png' as const, resolution: 'full' as const };
  const normalize = (raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
    const options = raw as Record<string, unknown>;
    const format = options.format === 'jpg' || options.format === 'jpeg'
      ? 'jpg'
      : options.format === 'png'
        ? 'png'
        : fallback.format;
    const resolution = options.resolution === 'medium' || options.resolution === '1080p'
      ? 'medium'
      : options.resolution === 'full' || options.resolution === 'original' || options.resolution === '2160p' || options.resolution === '4k'
        ? 'full'
        : fallback.resolution;
    return { format, resolution };
  };

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      return normalize(JSON.parse(trimmed));
    } catch {
      const lower = trimmed.toLowerCase();
      return {
        format: lower.includes('jpg') || lower.includes('jpeg') ? 'jpg' : lower.includes('png') ? 'png' : fallback.format,
        resolution: lower.includes('medium') || lower.includes('1080') || lower.includes('half') ? 'medium' : fallback.resolution,
      };
    }
  }

  return normalize(value);
};

const downloadCurrentImageVariant = async (source: string, value: unknown) => {
  const options = parseCurrentImageDownloadOptions(value);
  const suffix = options.resolution === 'medium' ? 'medium' : 'full';
  const filename = `archviz-current-${Date.now()}-${suffix}.${options.format}`;

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const width = Math.max(1, Math.round((img.naturalWidth || img.width) * (options.resolution === 'medium' ? 0.5 : 1)));
          const height = Math.max(1, Math.round((img.naturalHeight || img.height) * (options.resolution === 'medium' ? 0.5 : 1)));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas export unavailable');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL(options.format === 'jpg' ? 'image/jpeg' : 'image/png', options.format === 'jpg' ? 0.9 : undefined));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = source;
    });
    await downloadFile(dataUrl, filename);
  } catch {
    await downloadFile(source, filename);
  }
};

const downloadProjectSnapshot = async (state: AppState) => {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  try {
    await downloadFile(url, `archviz-project-${Date.now()}.json`);
  } finally {
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1500);
  }
};

const handoffDocsAuth = () => {
  try {
    const gatewayToken = sessionStorage.getItem('archviz_jwt');
    if (gatewayToken) {
      localStorage.setItem('archviz_docs_auth_handoff', gatewayToken);
    }
  } catch {
    // Best effort only; docs can still open without a handoff token.
  }
};

const getAssistantGenerationReadiness = (
  state: AppState,
  promptOverride?: string
): { ready: boolean; message?: string; prompt?: string } => {
  if (state.isGenerating) {
    return { ready: false, message: 'A generation is already running.' };
  }

  const prompt = (promptOverride || state.prompt || state.workflow.textPrompt || '').trim();

  switch (state.mode) {
    case 'generate-text':
      return prompt
        ? { ready: true, prompt }
        : { ready: false, message: 'Add a prompt before generating from text.' };
    case 'material-validation':
      return state.materialValidation.documents.length > 0
        ? { ready: true }
        : { ready: false, message: 'Upload material documents before running validation.' };
    case 'document-translate':
      return state.workflow.documentTranslate.sourceDocument
        ? { ready: true }
        : { ready: false, message: 'Upload a document before running translation.' };
    case 'pdf-compression':
      return state.workflow.pdfCompression.queue.length > 0
        ? { ready: true }
        : { ready: false, message: 'Add PDFs to the queue before compressing.' };
    case 'upscale':
      return state.workflow.upscaleBatch.length > 0
        ? { ready: true }
        : { ready: false, message: 'Add an image to the upscale batch before running upscale.' };
    case 'video': {
      if (!state.workflow.videoState.accessUnlocked) {
        return { ready: false, message: 'Video Studio access is currently locked.' };
      }
      const video = state.workflow.videoState;
      if (video.inputMode === 'image-animate') {
        return video.videoInputImage || state.uploadedImage
          ? { ready: true, prompt: video.scenario || promptOverride }
          : { ready: false, message: 'Add a video input image before generating video.' };
      }
      if (video.inputMode === 'image-morph') {
        return video.startFrame && video.endFrame
          ? { ready: true, prompt: video.scenario || promptOverride }
          : { ready: false, message: 'Add start and end frames before interpolating video.' };
      }
      return video.keyframes.length > 0
        ? { ready: true, prompt: video.scenario || promptOverride }
        : { ready: false, message: 'Add video keyframes before generating.' };
    }
    case 'headshot':
      return state.workflow.headshot.leftImage || state.workflow.headshot.frontImage || state.workflow.headshot.rightImage
        ? { ready: true }
        : { ready: false, message: 'Upload at least one portrait reference before generating headshots.' };
    default:
      return state.uploadedImage
        ? { ready: true, prompt: promptOverride || state.prompt || undefined }
        : { ready: false, message: 'Upload or select an image before generating this workflow.' };
  }
};

const getElementText = (element: Element) => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return getCompactText(element.value || element.placeholder);
  }
  if (element instanceof HTMLSelectElement) {
    return getCompactText(element.selectedOptions[0]?.text || element.value);
  }
  if (element instanceof HTMLElement) {
    return getCompactText(element.innerText || element.textContent);
  }
  return getCompactText(element.textContent);
};

const inspectTargetSelector = '[data-assistant-inspect-target="true"]';
const inspectLabelAttribute = 'data-assistant-inspect-label';
const controlSelector = [
  'button',
  '[role="button"]',
  'input',
  'textarea',
  'select',
  'a',
  '[aria-label]',
  '[title]',
].join(',');
const formControlSelector = ['button', '[role="button"]', 'input', 'textarea', 'select', 'a'].join(',');
const labelSelector = 'label,h1,h2,h3,h4,h5,h6';

const getInspectLabel = (element: Element) => {
  const explicitLabel = element.getAttribute(inspectLabelAttribute);
  if (explicitLabel) return getCompactText(explicitLabel, 120);

  const headingOrLabel = element.querySelector(labelSelector);
  if (headingOrLabel) return getCompactText(getElementText(headingOrLabel), 120);

  return getCompactText(
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    getElementText(element),
    120
  );
};

const isReasonableInspectGroup = (element: Element) => {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  return (
    rect.width >= 48 &&
    rect.height >= 30 &&
    rect.width <= viewportWidth * 0.65 &&
    rect.height <= Math.min(240, viewportHeight * 0.32)
  );
};

const getLabeledControlGroup = (target: Element) => {
  let current: Element | null = target;
  let depth = 0;

  while (current && current !== document.body && depth < 8) {
    if (
      current.querySelector(labelSelector) &&
      (current.matches(formControlSelector) || current.querySelector(formControlSelector)) &&
      isReasonableInspectGroup(current)
    ) {
      return current;
    }
    current = current.parentElement;
    depth += 1;
  }

  return null;
};

const getInspectableElement = (target: Element) => {
  const explicitTarget = target.closest(inspectTargetSelector);
  if (explicitTarget && isReasonableInspectGroup(explicitTarget)) return explicitTarget;

  const groupedControl = getLabeledControlGroup(target);
  if (groupedControl) return groupedControl;

  return target.closest(controlSelector) || target;
};

const describeInspectedElement = (element: Element) => {
  const inspected = getInspectableElement(element);
  const parent = inspected.parentElement;
  const tagName = inspected.tagName.toLowerCase();
  const inspectLabel = getInspectLabel(inspected);
  const role = inspected.getAttribute('role');
  const ariaLabel = inspected.getAttribute('aria-label');
  const title = inspected.getAttribute('title');
  const placeholder = inspected instanceof HTMLInputElement || inspected instanceof HTMLTextAreaElement
    ? inspected.placeholder
    : '';
  const type = inspected instanceof HTMLInputElement || inspected instanceof HTMLButtonElement
    ? inspected.type
    : '';
  const text = getElementText(inspected);
  const nearbyText = parent ? getCompactText(parent.innerText || parent.textContent, 260) : '';

  return [
    inspectLabel ? `Selection scope: ${inspectLabel}` : '',
    `Element tag: ${tagName}`,
    role ? `Role: ${role}` : '',
    type ? `Control type: ${type}` : '',
    ariaLabel ? `ARIA label: ${ariaLabel}` : '',
    title ? `Title: ${title}` : '',
    placeholder ? `Placeholder: ${placeholder}` : '',
    text ? `Visible text: ${text}` : '',
    nearbyText && nearbyText !== text ? `Nearby panel text: ${nearbyText}` : '',
  ].filter(Boolean).join('\n');
};

const renderInlineMarkdown = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${match.index}-${token}`;
    if (token.startsWith('**')) {
      nodes.push(<strong key={key} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key} className="rounded bg-surface-sunken px-1 py-0.5 text-[0.92em] text-foreground">{token.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={key} className="italic">{token.slice(1, -1)}</em>);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

const BubbleText: React.FC<{ text: string }> = ({ text }) => (
  <div className="space-y-2 break-words">
    {(() => {
      const blocks: ReactNode[] = [];
      const lines = text.replace(/\r\n/g, '\n').split('\n');
      let index = 0;

      while (index < lines.length) {
        const line = lines[index].trim();
        if (!line) {
          index += 1;
          continue;
        }

        const listMatch = line.match(/^(\d+[.)]|[-*•])\s+(.+)$/);
        if (listMatch) {
          const ordered = /^\d/.test(listMatch[1]);
          const items: string[] = [];
          while (index < lines.length) {
            const itemMatch = lines[index].trim().match(/^(\d+[.)]|[-*•])\s+(.+)$/);
            if (!itemMatch || /^\d/.test(itemMatch[1]) !== ordered) break;
            items.push(itemMatch[2]);
            index += 1;
          }
          const ListTag = ordered ? 'ol' : 'ul';
          blocks.push(
            <ListTag
              key={`list-${index}-${blocks.length}`}
              className={cn('space-y-1 pl-4', ordered ? 'list-decimal' : 'list-disc')}
            >
              {items.map((item, itemIndex) => (
                <li key={`${itemIndex}-${item}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ListTag>
          );
          continue;
        }

        const paragraphLines: string[] = [];
        while (index < lines.length) {
          const paragraphLine = lines[index].trim();
          if (!paragraphLine || /^(\d+[.)]|[-*•])\s+(.+)$/.test(paragraphLine)) break;
          paragraphLines.push(paragraphLine);
          index += 1;
        }

        blocks.push(
          <p key={`p-${index}-${blocks.length}`}>{renderInlineMarkdown(paragraphLines.join(' '))}</p>
        );
      }

      return blocks;
    })()}
  </div>
);

export const AppAssistant: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { generate, cancelGeneration } = useGeneration();
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [inspectMode, setInspectMode] = useState(false);
  const [inspectRect, setInspectRect] = useState<InspectRect | null>(null);
  const [pendingGeneration, setPendingGeneration] = useState<PendingGenerationRequest | null>(null);
  const [input, setInput] = useState('');
  const [composerImages, setComposerImages] = useState<AppAssistantChatImage[]>([]);
  const [composerFiles, setComposerFiles] = useState<AppAssistantChatFile[]>([]);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const inspectToolbarRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const assistantSmokeRef = useRef<AppAssistantSmokeState>({
    phase: 'idle',
    setupActionTypes: [],
    batchActionTypes: [],
    helperActionTypes: [],
    fileActionTypes: [],
    generationActionTypes: [],
    downloadActionTypes: [],
    clearActionTypes: [],
  });
  const assistantSubmitSmokeRef = useRef<AppAssistantSubmitSmokeState>({
    phase: 'idle',
  });
  const service = useMemo(() => new GeminiService({ model: ASSISTANT_MODEL }), []);
  const feature = getAppAssistantFeature(state.mode);
  const isThinking = messages.some((message) => message.isLoading);
  const controlMode = true;
  const assistantHintKey = 'archviz_assistant_hint_seen';

  useEffect(() => {
    writeAssistantLiveDiagnostics();
  });

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!pendingGeneration) return;

    const readiness = getAssistantGenerationReadiness(state, pendingGeneration.prompt);
    if (!readiness.ready) {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: makeMessageId(),
          tone: 'warning',
          message: readiness.message || 'The assistant cannot run this workflow yet.',
        },
      });
      setPendingGeneration(null);
      return;
    }

    const timer = window.setTimeout(() => {
      const request = pendingGeneration;
      setPendingGeneration(null);
      void generate({
        prompt: request.prompt || readiness.prompt,
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [dispatch, generate, pendingGeneration, state]);

  useEffect(() => {
    if (!inspectMode) {
      setInspectRect(null);
      return;
    }

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';

    const isAssistantSurface = (target: Element) =>
      Boolean(panelRef.current?.contains(target) || inspectToolbarRef.current?.contains(target));

    const updateRect = (target: Element) => {
      if (isAssistantSurface(target)) {
        setInspectRect(null);
        return;
      }
      const inspected = getInspectableElement(target);
      const rect = inspected.getBoundingClientRect();
      setInspectRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    const handlePointerMove = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element) updateRect(target);
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || isAssistantSurface(target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const inspected = getInspectableElement(target);
      const visibleName = getCompactText(
        getInspectLabel(inspected) || getElementText(inspected) || inspected.getAttribute('aria-label') || inspected.getAttribute('title') || inspected.tagName.toLowerCase(),
        80
      );
      const elementContext = describeInspectedElement(inspected);
      setInspectMode(false);
      setInspectRect(null);
      void submitQuestion(
        [
          `Explain the selected UI element in ${feature.title}.`,
          'Identify what this element is, where it sits in the interface, what it controls, when to use it, and any cautions.',
          'Keep the answer specific to ArchViz AI Studio and the active feature.',
          '',
          'SELECTED ELEMENT DETAILS:',
          elementContext,
        ].join('\n'),
        String(t('assistant.inspectSelectedQuestion', {
          element: visibleName,
          defaultValue: `Explain this selected element: ${visibleName}`,
        }))
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInspectMode(false);
        setInspectRect(null);
      }
    };

    document.addEventListener('mousemove', handlePointerMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.body.style.cursor = previousCursor;
      document.removeEventListener('mousemove', handlePointerMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [inspectMode, feature.title, t]);

  useEffect(() => {
    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(assistantHintKey) === 'true';
    } catch {
      alreadySeen = false;
    }
    if (alreadySeen) return;

    const showTimer = window.setTimeout(() => setHintVisible(true), 900);
    const hideTimer = window.setTimeout(() => {
      setHintVisible(false);
      try {
        sessionStorage.setItem(assistantHintKey, 'true');
      } catch {}
    }, 8500);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  const dismissHint = () => {
    setHintVisible(false);
    try {
      sessionStorage.setItem(assistantHintKey, 'true');
    } catch {}
  };

  const quickPrompts = feature.suggestions.slice(0, 3);

  useEffect(() => {
    if (!open || !inputRef.current) return;
    const textarea = inputRef.current;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [input, open]);

  const handleAssistantAttachmentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.currentTarget.files;
    const imageFiles: File[] = [];
    const otherFiles: File[] = [];
    if (fileList) {
      for (let index = 0; index < fileList.length; index += 1) {
        const file = fileList.item(index);
        if (file?.type.startsWith('image/')) {
          imageFiles.push(file);
        } else if (file) {
          otherFiles.push(file);
        }
      }
    }
    const limitedImageFiles = imageFiles.slice(0, Math.max(0, maxAssistantComposerImages - composerImages.length));
    const limitedOtherFiles = otherFiles.slice(0, Math.max(0, maxAssistantComposerFiles - composerFiles.length));

    limitedImageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === 'string' ? reader.result : '';
        if (!url) return;
        setComposerImages((items) => [
          ...items,
          {
            id: `chat-image-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            url,
            name: file.name,
          },
        ].slice(0, maxAssistantComposerImages));
      };
      reader.readAsDataURL(file);
    });

    limitedOtherFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === 'string' ? reader.result : '';
        if (!url) return;
        setComposerFiles((items) => [
          ...items,
          {
            id: `chat-file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            url,
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
          },
        ].slice(0, maxAssistantComposerFiles));
      };
      reader.readAsDataURL(file);
    });

    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  };

  const removeComposerImage = (id: string) => {
    setComposerImages((items) => items.filter((item) => item.id !== id));
  };

  const removeComposerFile = (id: string) => {
    setComposerFiles((items) => items.filter((item) => item.id !== id));
  };

  const submitQuestion = async (
    rawQuestion: string,
    visibleQuestion = rawQuestion,
    attachedImages: AppAssistantChatImage[] = [],
    attachedFiles: AppAssistantChatFile[] = []
  ) => {
    const imageQuestion = attachedImages.length
      ? `I attached ${attachedImages.length} image reference${attachedImages.length === 1 ? '' : 's'}. Review them and suggest how they should be used in this workflow.`
      : '';
    const fileQuestion = attachedFiles.length
      ? `I attached ${attachedFiles.length} file${attachedFiles.length === 1 ? '' : 's'}. Review them and suggest how they should be used in this workflow.`
      : '';
    const question = rawQuestion.trim() || imageQuestion || fileQuestion;
    if (!question || isThinking) return;

    const requestMode = state.mode;
    const requestMessages = messages;
    const assistantImageSources = getAssistantImageSources(state, attachedImages);
    const assistantImages = getAssistantImages(state, attachedImages);
    const assistantAttachments = getAssistantFileAttachments(attachedFiles);
    const workspaceSnapshot = [
      buildAppAssistantWorkspaceSnapshot(state),
      `Assistant action mode: ${controlMode ? 'Act mode; validated actions will apply automatically' : 'Suggest mode; actions wait for user confirmation'}`,
      `User-attached images in this message: ${attachedImages.length ? attachedImages.map((image) => `${image.id}${image.name ? ` (${image.name})` : ''}`).join(', ') : 'none'}`,
      `User-attached files in this message: ${attachedFiles.length ? attachedFiles.map((file) => `${file.id} (${file.name}, ${file.mimeType}, ${file.size} bytes)`).join(', ') : 'none'}`,
      `Visual attachments sent to assistant: ${assistantImageSources.length ? assistantImageSources.map((source, index) => `image ${index + 1}: ${source.label}`).join(', ') : 'none'}`,
      `File attachments sent to assistant: ${assistantAttachments.length ? assistantAttachments.map((file, index) => `file ${index + 1}: ${file.name || file.mimeType}`).join(', ') : 'none'}`,
    ].join('\n');
    const userMessage: AssistantMessage = {
      id: makeMessageId(),
      role: 'user',
      content: visibleQuestion.trim() || question,
      attachments: attachedImages,
      files: attachedFiles,
    };
    const loadingMessage: AssistantMessage = {
      id: makeMessageId(),
      role: 'assistant',
      content: String(t('assistant.thinking', { defaultValue: 'Reading this feature...' })),
      isLoading: true,
    };

    setError(null);
    setInput('');
    if (attachedImages.length > 0) {
      setComposerImages([]);
    }
    if (attachedFiles.length > 0) {
      setComposerFiles([]);
    }
    setMessages((items) => [...items, userMessage, loadingMessage]);

    try {
      const assistantPrompt = buildAppAssistantPrompt({
        mode: requestMode,
        question,
        language: i18n.language || 'en',
        messages: [...requestMessages, userMessage],
        workspaceSnapshot,
        actionContext: buildAppAssistantActionContext(state, { chatImages: attachedImages, chatFiles: attachedFiles }),
      });
      const answer = isAppAssistantSubmitSmokeEnabled()
        ? (() => {
            writeAssistantSubmitSmoke('data-archwiz-assistant-submit-service', {
              model: ASSISTANT_MODEL,
              promptChars: assistantPrompt.length,
              imageCount: assistantImages.length,
              fileCount: assistantAttachments.length,
            });
            return getAssistantSubmitSmokeAnswer();
          })()
        : await service.generateText({
          model: ASSISTANT_MODEL,
          prompt: assistantPrompt,
          images: assistantImages,
          attachments: assistantAttachments,
          generationConfig: {
            temperature: 0.15,
            topP: 0.9,
            maxOutputTokens: 4096,
            responseModalities: ['TEXT'],
            thinkingConfig: { thinkingLevel: 'low' },
          },
        });

      const { content, requests } = extractAppAssistantActions(answer);
      const actionableRequests = appendVisualEditRoutingFallbackRequests(requests, state, question);
      const actions = normalizeAppAssistantActions(actionableRequests, state, { chatImages: attachedImages, chatFiles: attachedFiles });

      setMessages((items) =>
        items.map((message) =>
          message.id === loadingMessage.id
            ? {
                ...message,
                content: content.trim() || String(t('assistant.empty', { defaultValue: 'I could not produce an answer. Try asking again with a little more detail.' })),
                isLoading: false,
                actions,
                appliedActionIds: [],
              }
            : message
        )
      );

      if (controlMode && actions.length > 0) {
        window.setTimeout(() => {
          applyActions(loadingMessage.id, actions, true);
        }, 0);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const friendlyMessage = getAssistantServiceErrorMessage(err);
      setError(message);
      setMessages((items) =>
        items.map((item) =>
          item.id === loadingMessage.id
            ? {
                ...item,
                content: friendlyMessage,
                isLoading: false,
              }
            : item
        )
      );
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitQuestion(input, input, composerImages, composerFiles);
  };

  const clearThread = () => {
    setError(null);
    setInspectMode(false);
    setComposerImages([]);
    setComposerFiles([]);
    setMessages([]);
  };

  const markActionsApplied = (messageId: string, actionIds: string[]) => {
    setMessages((items) =>
      items.map((message) => {
        if (message.id !== messageId) return message;
        const applied = new Set(message.appliedActionIds || []);
        actionIds.forEach((id) => applied.add(id));
        return { ...message, appliedActionIds: Array.from(applied) };
      })
    );
  };

  const runAssistantDownloads = async (actions: AppAssistantAction[]) => {
    if (!actions.length) return;

    try {
      if (writeAssistantSmokeTrigger('data-archwiz-assistant-download-trigger', {
        actionTypes: actions.map((action) => action.type),
      })) {
        dispatch({
          type: 'SET_APP_ALERT',
          payload: {
            id: makeMessageId(),
            tone: 'info',
            message: actions.length === 1 ? 'Assistant started the download.' : `Assistant started ${actions.length} downloads.`,
          },
        });
        return;
      }

      for (const action of actions) {
        switch (action.type) {
          case 'download_project':
            await downloadProjectSnapshot(state);
            break;
          case 'download_current_image':
            if (state.uploadedImage) {
              await downloadCurrentImageVariant(state.uploadedImage, action.value);
            }
            break;
          case 'download_latest_history_image': {
            const latest = [...state.history].reverse().find((item) => item.thumbnail);
            if (latest?.thumbnail) {
              await downloadImage(latest.thumbnail, `archviz-history-${latest.id || Date.now()}.png`);
            }
            break;
          }
          case 'download_all_history_images': {
            const items = state.history
              .filter((item) => item.thumbnail)
              .map((item, index) => ({
                source: item.thumbnail,
                filename: `archviz-history-${index + 1}-${item.id || item.timestamp}.png`,
              }));
            if (items.length) await downloadImagesSequentially(items);
            break;
          }
          case 'download_current_video':
            if (state.workflow.videoState.generatedVideoUrl) {
              await downloadFile(state.workflow.videoState.generatedVideoUrl, `archviz-video-${Date.now()}.mp4`);
            }
            break;
          case 'download_translated_document':
            if (state.workflow.documentTranslate.translatedDocumentUrl) {
              const sourceName = state.workflow.documentTranslate.sourceDocument?.name || 'translated-document';
              const dotIndex = sourceName.lastIndexOf('.');
              const baseName = dotIndex > 0 ? sourceName.slice(0, dotIndex) : sourceName;
              const extension = dotIndex > 0 ? sourceName.slice(dotIndex + 1) : 'docx';
              await downloadFile(
                state.workflow.documentTranslate.translatedDocumentUrl,
                `${baseName}-translated.${extension}`
              );
            }
            break;
          case 'download_pdf_outputs':
            for (const output of state.workflow.pdfCompression.outputs) {
              await downloadFile(output.dataUrl, output.name);
            }
            break;
          case 'download_material_validation_report':
            await downloadMaterialValidationReport(state.materialValidation);
            break;
          case 'download_multi_angle_outputs':
            await downloadImagesSequentially(
              state.workflow.multiAngleOutputs.map((output, index) => ({
                source: output.url,
                filename: output.name || `multi-angle-${index + 1}.png`,
              }))
            );
            break;
          case 'download_angle_change_outputs':
            await downloadImagesSequentially(
              state.workflow.angleChangeOutputs.map((output, index) => ({
                source: output.url,
                filename: output.name || `angle-change-${index + 1}.png`,
              }))
            );
            break;
          case 'download_headshots':
            await downloadImagesSequentially(
              state.workflow.headshot.generatedItems.map((item, index) => ({
                source: item.url,
                filename: `headshot-${item.style}-${index + 1}.png`,
              }))
            );
            break;
          default:
            break;
        }
      }

      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: makeMessageId(),
          tone: 'info',
          message: actions.length === 1 ? 'Assistant started the download.' : `Assistant started ${actions.length} downloads.`,
        },
      });
    } catch (err) {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: makeMessageId(),
          tone: 'error',
          message: err instanceof Error ? err.message : 'Assistant could not start the download.',
        },
      });
    }
  };

  const applyActions = (
    messageId: string,
    actions: AppAssistantAction[],
    automatic = false
  ) => {
    if (!actions.length) return;
    const setLanguageAction = actions.find((action) => action.type === 'set_language');
    const openFeedbackReportAction = actions.find((action) => action.type === 'open_feedback_report');
    const openFeedbackAdminAction = actions.find((action) => action.type === 'open_feedback_admin');
    const openDocsAction = actions.find((action) => action.type === 'open_docs');
    const signOutAction = actions.find((action) => action.type === 'sign_out');
    const runGenerationAction = actions.find((action) => action.type === 'run_generation');
    const cancelGenerationAction = actions.find((action) => action.type === 'cancel_generation');
    const runPreprocessAction = actions.find((action) => action.type === 'run_preprocess');
    const runImageToCadPreprocessAction = actions.find((action) => action.type === 'run_image_to_cad_preprocess');
    const runMasterplanZoneDetectionAction = actions.find((action) => action.type === 'run_masterplan_zone_detection');
    const runExplodedComponentDetectionAction = actions.find((action) => action.type === 'run_exploded_component_detection');
    const runSectionAreaDetectionAction = actions.find((action) => action.type === 'run_section_area_detection');
    const runAiSelectionAction = actions.find((action) => action.type === 'run_ai_selection');
    const prepareSelectionAction = actions.find((action) => action.type === 'prepare_image_selection');
    const downloadActions = actions.filter(isDownloadAction);
    const helperActions = [
      runPreprocessAction,
      runImageToCadPreprocessAction,
      runMasterplanZoneDetectionAction,
      runExplodedComponentDetectionAction,
      runSectionAreaDetectionAction,
      runAiSelectionAction,
    ].filter((action): action is AppAssistantAction => Boolean(action));
    const helperSmokeHandled = helperActions.length > 0 && writeAssistantSmokeTrigger(
      'data-archwiz-assistant-helper-trigger',
      {
        actionTypes: helperActions.map((action) => action.type),
        targets: runAiSelectionAction ? getActionStringList(runAiSelectionAction.value) : [],
      }
    );
    const stateActions = actions.filter(
      (action) =>
        action.type !== 'set_language' &&
        action.type !== 'open_feedback_report' &&
        action.type !== 'open_feedback_admin' &&
        action.type !== 'open_docs' &&
        action.type !== 'sign_out' &&
        action.type !== 'run_generation' &&
        action.type !== 'cancel_generation' &&
        action.type !== 'run_preprocess' &&
        action.type !== 'run_image_to_cad_preprocess' &&
        action.type !== 'run_masterplan_zone_detection' &&
        action.type !== 'run_exploded_component_detection' &&
        action.type !== 'run_section_area_detection' &&
        action.type !== 'run_ai_selection' &&
        action.type !== 'prepare_image_selection' &&
        !isDownloadAction(action)
    );

    if (stateActions.length > 0) {
      applyAppAssistantActions(dispatch, state, stateActions);
    }

    if (setLanguageAction && typeof setLanguageAction.value === 'string') {
      void i18n.changeLanguage(setLanguageAction.value);
    }

    if (openFeedbackReportAction) {
      window.dispatchEvent(new CustomEvent('archviz:assistant-open-feedback-report'));
    }

    if (openFeedbackAdminAction) {
      window.dispatchEvent(new CustomEvent('archviz:assistant-open-feedback-admin'));
    }

    if (signOutAction) {
      window.dispatchEvent(new CustomEvent('archviz:assistant-sign-out'));
    }

    if (openDocsAction) {
      handoffDocsAuth();
      window.setTimeout(() => {
        window.location.assign('/docs/');
      }, 80);
    }

    if (cancelGenerationAction) {
      cancelGeneration();
    }

    if (!helperSmokeHandled && runPreprocessAction) {
      dispatch({ type: 'SET_MODE', payload: 'render-3d' });
      dispatch({ type: 'UPDATE_WORKFLOW', payload: { prioritizationEnabled: true, detectedElements: [] } });
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('archviz:assistant-run-render3d-preprocess'));
      }, 80);
    }

    if (!helperSmokeHandled && runImageToCadPreprocessAction) {
      dispatch({ type: 'SET_MODE', payload: 'img-to-cad' });
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('archviz:assistant-run-image-to-cad-preprocess'));
      }, 120);
    }

    if (!helperSmokeHandled && runMasterplanZoneDetectionAction) {
      dispatch({ type: 'SET_MODE', payload: 'masterplan' });
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('archviz:assistant-run-masterplan-zone-detection'));
      }, 120);
    }

    if (!helperSmokeHandled && runExplodedComponentDetectionAction) {
      dispatch({ type: 'SET_MODE', payload: 'exploded' });
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('archviz:assistant-run-exploded-component-detection'));
      }, 120);
    }

    if (!helperSmokeHandled && runSectionAreaDetectionAction) {
      dispatch({ type: 'SET_MODE', payload: 'section' });
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('archviz:assistant-run-section-area-detection'));
      }, 120);
    }

    if (!helperSmokeHandled && runAiSelectionAction) {
      const targets = getActionStringList(runAiSelectionAction.value);
      dispatch({ type: 'SET_MODE', payload: 'visual-edit' });
      if (!state.rightPanelOpen) {
        dispatch({ type: 'TOGGLE_RIGHT_PANEL' });
      }
      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          visualSelection: {
            ...state.workflow.visualSelection,
            mode: 'ai',
            autoTargets: targets,
          },
        },
      });
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('archviz:assistant-run-visual-ai-selection', { detail: { targets } }));
      }, 220);
    }

    if (prepareSelectionAction) {
      startImageSelectionHandoff();
    }

    if (runGenerationAction) {
      const prompt = typeof runGenerationAction.value === 'string' ? runGenerationAction.value : undefined;
      if (!writeAssistantSmokeTrigger('data-archwiz-assistant-generation-trigger', {
        actionTypes: [runGenerationAction.type],
        prompt: prompt || null,
      })) {
        setPendingGeneration({ id: runGenerationAction.id, prompt });
      }
    }

    if (downloadActions.length > 0) {
      void runAssistantDownloads(downloadActions);
    }

    markActionsApplied(messageId, actions.map((action) => action.id));
    if (!prepareSelectionAction) {
      const message = runGenerationAction
        ? stateActions.length > 0
          ? 'Assistant applied changes and queued generation.'
          : 'Assistant queued generation.'
        : openDocsAction
          ? 'Assistant is opening the user manual.'
        : signOutAction
          ? 'Assistant is signing you out.'
        : openFeedbackAdminAction
          ? 'Assistant opened feedback admin.'
        : openFeedbackReportAction
          ? 'Assistant opened feedback reporting.'
        : setLanguageAction
          ? 'Assistant switched the app language.'
        : cancelGenerationAction
          ? 'Assistant asked the current generation to stop.'
        : runPreprocessAction
          ? stateActions.length > 0
            ? 'Assistant applied setup and started AI pre-processing.'
            : 'Assistant started AI pre-processing.'
        : runImageToCadPreprocessAction
          ? 'Assistant started Image to CAD pre-processing.'
        : runMasterplanZoneDetectionAction
          ? 'Assistant started Masterplan zone detection.'
        : runExplodedComponentDetectionAction
          ? 'Assistant started Exploded View component detection.'
        : runSectionAreaDetectionAction
          ? 'Assistant started Section area detection.'
        : runAiSelectionAction
          ? 'Assistant started Visual Edit AI selection.'
        : downloadActions.length > 0
          ? downloadActions.length === 1 ? 'Assistant started a download.' : `Assistant started ${downloadActions.length} downloads.`
        : automatic
          ? actions.length === 1 ? 'Assistant applied a change.' : `Assistant applied ${actions.length} changes.`
          : actions.length === 1 ? 'Assistant change applied.' : `${actions.length} assistant changes applied.`;
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: makeMessageId(),
          tone: 'info',
          message,
        },
      });
    }
  };

  const startImageSelectionHandoff = () => {
    if (!state.uploadedImage) {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: makeMessageId(),
          tone: 'warning',
          message: 'Upload or select an image before circling an area for the assistant.',
        },
      });
      return;
    }

    if (state.mode !== 'visual-edit') {
      dispatch({ type: 'SET_MODE', payload: 'visual-edit' });
    }
    dispatch({
      type: 'UPDATE_WORKFLOW',
      payload: {
        activeTool: 'select',
        visualSelection: {
          ...state.workflow.visualSelection,
          mode: 'lasso',
        },
      },
    });
    setInspectMode(false);
    setOpen(false);
    dispatch({
      type: 'SET_APP_ALERT',
      payload: {
        id: makeMessageId(),
        tone: 'info',
        message: 'Lasso the image area you want help with, then reopen the assistant and ask about that selection.',
      },
    });
  };

  useEffect(() => {
    if (!isAppAssistantTestBridgeEnabled()) return;

    const writeBridgeResult = (id: string, payload: unknown) => {
      document.documentElement.setAttribute(
        'data-archwiz-assistant-test-result',
        JSON.stringify({ id, payload })
      );
    };

    const handleBridgeCommand = (event: Event) => {
      const detail = (event as CustomEvent<AppAssistantTestCommandDetail>).detail || {};
      const id = detail.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const requests = Array.isArray(detail.requests) ? detail.requests : [];
      const options = detail.options || {};

      if (detail.command === 'context') {
        writeBridgeResult(id, {
          actionContext: buildAppAssistantActionContext(state),
          liveDiagnostics: getGatewaySessionDiagnostics(),
        });
        return;
      }

      const routeRequests = detail.command === 'route-fallback'
        ? appendVisualEditRoutingFallbackRequests(requests, state, detail.question || '')
        : requests;
      const actions = normalizeAppAssistantActions(routeRequests, state, options);
      if (detail.command === 'apply' && actions.length > 0) {
        applyActions(`assistant-test-${id}`, actions, true);
      }

      writeBridgeResult(id, {
        actionCount: actions.length,
        actions: summarizeAssistantTestActions(actions),
      });
    };

    const hooks: AppAssistantTestHooks = {
      version: 1,
      getActionContext: () => buildAppAssistantActionContext(state),
      routeFallbackRequests: (question, requests = [], options = {}) =>
        normalizeAppAssistantActions(
          appendVisualEditRoutingFallbackRequests(requests, state, question),
          state,
          options
        ),
      normalizeRequests: (requests, options = {}) =>
        normalizeAppAssistantActions(requests, state, options),
      applyRequests: (requests, options = {}) => {
        const actions = normalizeAppAssistantActions(requests, state, options);
        if (actions.length > 0) {
          applyActions(`assistant-test-${makeMessageId()}`, actions, true);
        }
        return actions;
      },
    };

    window.__ARCHWIZ_ASSISTANT_TEST_HOOKS__ = hooks;
    window.addEventListener('archwiz:test-assistant-command', handleBridgeCommand);
    return () => {
      window.removeEventListener('archwiz:test-assistant-command', handleBridgeCommand);
      if (window.__ARCHWIZ_ASSISTANT_TEST_HOOKS__ === hooks) {
        delete window.__ARCHWIZ_ASSISTANT_TEST_HOOKS__;
      }
    };
  });

  useEffect(() => {
    if (!isAppAssistantSmokeEnabled()) return;

    const smoke = assistantSmokeRef.current;
    const writeSmokeResult = (payload: Record<string, unknown>) => {
      document.documentElement.setAttribute(
        'data-archwiz-assistant-smoke',
        JSON.stringify({
          phase: smoke.phase,
          setupActionTypes: smoke.setupActionTypes,
          batchActionTypes: smoke.batchActionTypes,
          helperActionTypes: smoke.helperActionTypes,
          fileActionTypes: smoke.fileActionTypes,
          generationActionTypes: smoke.generationActionTypes,
          downloadActionTypes: smoke.downloadActionTypes,
          clearActionTypes: smoke.clearActionTypes,
          ...payload,
        })
      );
    };

    const imageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
    const docUrl = 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBAoAAAAAAAEAAQAAAAAAAAAAAAAABwAAAGRvYy50eHQ=';
    const pdfUrl = 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCg==';
    const chatImages: AppAssistantChatImage[] = [
      { id: 'img1', url: imageUrl, name: 'material.png' },
      { id: 'img2', url: imageUrl, name: 'chair.png' },
      { id: 'img3', url: imageUrl, name: 'end-frame.png' },
      { id: 'img4', url: imageUrl, name: 'portrait.png' },
    ];
    const chatFiles: AppAssistantChatFile[] = [
      {
        id: 'doc1',
        url: docUrl,
        name: 'brief.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 64,
      },
      {
        id: 'pdf1',
        url: pdfUrl,
        name: 'drawings.pdf',
        mimeType: 'application/pdf',
        size: 32,
      },
      {
        id: 'pdf2',
        url: pdfUrl,
        name: 'details.pdf',
        mimeType: 'application/pdf',
        size: 32,
      },
      {
        id: 'mat1',
        url: docUrl,
        name: 'materials.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 64,
      },
      {
        id: 'mat2',
        url: docUrl,
        name: 'boq.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 64,
      },
    ];

    const setupReady =
      state.mode === 'visual-edit' &&
      state.imageGenerationModel === 'chatgpt-image-generation-2' &&
      state.prompt === 'Replace the selected flooring with warm oak planks.' &&
      Boolean(state.uploadedImage) &&
      Boolean(state.workflow.visualMaterial.referenceImage) &&
      state.output.resolution === '4k';
    const batchReady =
      state.workflow.sceneInsertionReferences.length === 2 &&
      Boolean(state.workflow.videoState.startFrame) &&
      Boolean(state.workflow.videoState.endFrame) &&
      state.workflow.videoState.keyframes.length === 1 &&
      Boolean(state.workflow.headshot.leftImage) &&
      Boolean(state.workflow.headshot.frontImage) &&
      Boolean(state.workflow.headshot.rightImage);
    const filesReady =
      state.workflow.documentTranslate.sourceDocument?.name === 'brief.docx' &&
      state.materialValidation.documents.length === 2 &&
      state.workflow.pdfCompression.queue.length === 2;
    const cleared =
      !state.uploadedImage &&
      !state.workflow.visualMaterial.referenceImage &&
      state.workflow.sceneInsertionReferences.length === 0 &&
      !state.workflow.videoState.startFrame &&
      !state.workflow.videoState.endFrame &&
      state.workflow.videoState.keyframes.length === 0 &&
      !state.workflow.headshot.leftImage &&
      !state.workflow.headshot.frontImage &&
      !state.workflow.headshot.rightImage &&
      !state.workflow.documentTranslate.sourceDocument &&
      state.materialValidation.documents.length === 0 &&
      state.workflow.pdfCompression.queue.length === 0;
    const generationTriggered = (() => {
      const raw = document.documentElement.getAttribute('data-archwiz-assistant-generation-trigger');
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.actionTypes) && parsed.actionTypes.includes('run_generation');
      } catch {
        return false;
      }
    })();
    const downloadTriggered = (() => {
      const raw = document.documentElement.getAttribute('data-archwiz-assistant-download-trigger');
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.actionTypes) && parsed.actionTypes.includes('download_current_image');
      } catch {
        return false;
      }
    })();
    const helperTriggered = (() => {
      const raw = document.documentElement.getAttribute('data-archwiz-assistant-helper-trigger');
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        const actionTypes = Array.isArray(parsed?.actionTypes) ? parsed.actionTypes : [];
        return [
          'run_preprocess',
          'run_image_to_cad_preprocess',
          'run_masterplan_zone_detection',
          'run_exploded_component_detection',
          'run_section_area_detection',
          'run_ai_selection',
        ].every((type) => actionTypes.includes(type));
      } catch {
        return false;
      }
    })();

    if (smoke.phase === 'done') {
      const actionContext = buildAppAssistantActionContext(state);
      writeSmokeResult({
        ok: true,
        setupReady: true,
        batchReady: true,
        helperTriggered: true,
        filesReady: true,
        generationTriggered: true,
        downloadTriggered: true,
        cleared: true,
        contextHasClear: actionContext.includes('clear_image_target') &&
          actionContext.includes('clear_file_target'),
        contextHasRunGeneration: actionContext.includes('run_generation runs the current workflow'),
      });
      return;
    }

    if (smoke.phase === 'idle') {
      const setupActions = normalizeAppAssistantActions([
        { type: 'set_mode', mode: 'visual-edit' },
        { type: 'set_image_generation_model', value: 'chatgpt-image-generation-2' },
        { type: 'set_prompt', value: 'Replace the selected flooring with warm oak planks.' },
        { type: 'set_workflow', path: 'activeTool', value: 'material' },
        { type: 'set_workflow', path: 'visualMaterial.category', value: 'Flooring' },
        { type: 'set_output', path: 'resolution', value: '4k' },
        { type: 'use_chat_image', imageTarget: 'canvas', attachmentId: 'img1' },
        { type: 'use_chat_image', imageTarget: 'visual-material-reference', attachmentId: 'img1' },
      ], state, { chatImages });
      smoke.phase = 'setup-wait';
      smoke.setupActionTypes = setupActions.map((action) => action.type);
      writeSmokeResult({ ok: false, step: 'setup-started' });
      applyActions('assistant-smoke-setup', setupActions, true);
      return;
    }

    if (smoke.phase === 'setup-wait' && setupReady) {
      const batchActions = normalizeAppAssistantActions([
        { type: 'use_chat_image', imageTarget: 'scene-compose-reference', attachmentId: 'img1', caption: 'lounge chair' },
        { type: 'use_chat_image', imageTarget: 'scene-compose-reference', attachmentId: 'img2', caption: 'floor lamp' },
        { type: 'use_chat_image', imageTarget: 'video-start-frame', attachmentId: 'img2' },
        { type: 'use_chat_image', imageTarget: 'video-end-frame', attachmentId: 'img3' },
        { type: 'use_chat_image', imageTarget: 'video-keyframe', attachmentId: 'img4' },
        { type: 'use_chat_image', imageTarget: 'headshot-left', attachmentId: 'img2' },
        { type: 'use_chat_image', imageTarget: 'headshot-front', attachmentId: 'img3' },
        { type: 'use_chat_image', imageTarget: 'headshot-right', attachmentId: 'img4' },
      ], state, { chatImages });
      smoke.phase = 'batch-wait';
      smoke.batchActionTypes = batchActions.map((action) => action.type);
      writeSmokeResult({ ok: false, step: 'batch-started', setupReady: true });
      applyActions('assistant-smoke-batch', batchActions, true);
      return;
    }

    if (smoke.phase === 'batch-wait' && batchReady) {
      const helperActions = normalizeAppAssistantActions([
        { type: 'run_preprocess' },
        { type: 'run_ai_selection', value: ['Building'] },
        { type: 'run_image_to_cad_preprocess' },
        { type: 'run_masterplan_zone_detection' },
        { type: 'run_exploded_component_detection' },
        { type: 'run_section_area_detection' },
      ], state);
      smoke.phase = 'helpers-wait';
      smoke.helperActionTypes = helperActions.map((action) => action.type);
      writeSmokeResult({ ok: false, step: 'helpers-started', setupReady: true, batchReady: true });
      applyActions('assistant-smoke-helpers', helperActions, true);
      return;
    }

    if (smoke.phase === 'helpers-wait' && helperTriggered) {
      const fileActions = normalizeAppAssistantActions([
        { type: 'use_chat_file', fileTarget: 'document-translate-source', attachmentId: 'doc1' },
        { type: 'use_chat_file', fileTarget: 'material-validation-document', attachmentId: 'mat1' },
        { type: 'use_chat_file', fileTarget: 'material-validation-document', attachmentId: 'mat2' },
        { type: 'use_chat_file', fileTarget: 'pdf-compression-queue', attachmentId: 'pdf1' },
        { type: 'use_chat_file', fileTarget: 'pdf-compression-queue', attachmentId: 'pdf2' },
      ], state, { chatFiles });
      smoke.phase = 'files-wait';
      smoke.fileActionTypes = fileActions.map((action) => action.type);
      writeSmokeResult({ ok: false, step: 'files-started', setupReady: true, batchReady: true, helperTriggered: true });
      applyActions('assistant-smoke-files', fileActions, true);
      return;
    }

    if (smoke.phase === 'files-wait' && filesReady) {
      const generationActions = normalizeAppAssistantActions([
        { type: 'run_generation', value: 'Replace the selected flooring with warm oak planks.' },
      ], state);
      const downloadActions = normalizeAppAssistantActions([
        { type: 'download_current_image', value: { format: 'png', resolution: 'medium' } },
      ], state);
      smoke.phase = 'triggers-wait';
      smoke.generationActionTypes = generationActions.map((action) => action.type);
      smoke.downloadActionTypes = downloadActions.map((action) => action.type);
      writeSmokeResult({
        ok: false,
        step: 'triggers-started',
        setupReady: true,
        batchReady: true,
        helperTriggered: true,
        filesReady: true,
      });
      applyActions('assistant-smoke-generation', generationActions, true);
      applyActions('assistant-smoke-download', downloadActions, true);
      return;
    }

    if (smoke.phase === 'triggers-wait' && generationTriggered && downloadTriggered) {
      const clearActions = normalizeAppAssistantActions([
        { type: 'clear_image_target', imageTarget: 'visual-material-reference' },
        { type: 'clear_image_target', imageTarget: 'canvas' },
        { type: 'clear_image_target', imageTarget: 'scene-compose-reference' },
        { type: 'clear_image_target', imageTarget: 'video-start-frame' },
        { type: 'clear_image_target', imageTarget: 'video-end-frame' },
        { type: 'clear_image_target', imageTarget: 'video-keyframe' },
        { type: 'clear_image_target', imageTarget: 'headshot-left' },
        { type: 'clear_image_target', imageTarget: 'headshot-front' },
        { type: 'clear_image_target', imageTarget: 'headshot-right' },
        { type: 'clear_file_target', fileTarget: 'document-translate-source' },
        { type: 'clear_file_target', fileTarget: 'material-validation-document' },
        { type: 'clear_file_target', fileTarget: 'pdf-compression-queue' },
      ], state);
      smoke.phase = 'clear-wait';
      smoke.clearActionTypes = clearActions.map((action) => action.type);
      writeSmokeResult({
        ok: false,
        step: 'clear-started',
        setupReady: true,
        batchReady: true,
        helperTriggered: true,
        filesReady: true,
        generationTriggered: true,
        downloadTriggered: true,
      });
      applyActions('assistant-smoke-clear', clearActions, true);
      return;
    }

    if (smoke.phase === 'clear-wait' && cleared) {
      smoke.phase = 'done';
      const actionContext = buildAppAssistantActionContext(state);
      writeSmokeResult({
        ok: true,
        setupReady: true,
        batchReady: true,
        helperTriggered: true,
        filesReady: true,
        generationTriggered: true,
        downloadTriggered: true,
        cleared: true,
        contextHasClear: actionContext.includes('clear_image_target') &&
          actionContext.includes('clear_file_target'),
        contextHasRunGeneration: actionContext.includes('run_generation runs the current workflow'),
      });
      return;
    }

    writeSmokeResult({
      ok: false,
      setupReady,
      batchReady,
      helperTriggered,
      filesReady,
      generationTriggered,
      downloadTriggered,
      cleared,
    });
  });

  useEffect(() => {
    if (!isAppAssistantSubmitSmokeEnabled()) return;

    const smoke = assistantSubmitSmokeRef.current;
    const writeSubmitSmokeResult = (payload: Record<string, unknown>) => {
      document.documentElement.setAttribute(
        'data-archwiz-assistant-submit-smoke',
        JSON.stringify({ phase: smoke.phase, ...payload })
      );
    };
    const imageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
    const docUrl = 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBAoAAAAAAAEAAQAAAAAAAAAAAAAABwAAAGRvYy50eHQ=';
    const submitImage: AppAssistantChatImage = {
      id: 'submit-img',
      url: imageUrl,
      name: 'submit-smoke.png',
    };
    const submitFile: AppAssistantChatFile = {
      id: 'submit-doc',
      url: docUrl,
      name: 'submit-smoke.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 64,
    };
    const serviceRaw = document.documentElement.getAttribute('data-archwiz-assistant-submit-service');
    const serviceCalled = Boolean(serviceRaw);
    const assistantMessage = messages.find((message) =>
      message.role === 'assistant' &&
      !message.isLoading &&
      message.content.includes('Submit smoke response applied through the normal assistant parser.')
    );
    const appliedActions = assistantMessage?.appliedActionIds || [];
    const actions = assistantMessage?.actions || [];
    const stateReady =
      state.mode === 'visual-edit' &&
      state.prompt === 'Submit smoke prompt' &&
      state.workflow.visualPrompt === 'Replace the selected floor with warm oak planks from the submit smoke.' &&
      state.output.format === 'jpg' &&
      Boolean(state.uploadedImage) &&
      state.workflow.documentTranslate.sourceDocument?.name === 'submit-smoke.docx';
    const threadReady = Boolean(assistantMessage && actions.length === 6 && appliedActions.length === 6);

    if (smoke.phase === 'done') {
      writeSubmitSmokeResult({
        ok: true,
        serviceCalled: true,
        threadReady: true,
        stateReady: true,
        liveDiagnostics: getGatewaySessionDiagnostics(),
        actionTypes: actions.map((action) => action.type),
      });
      return;
    }

    if (smoke.phase === 'idle') {
      smoke.phase = 'wait';
      writeSubmitSmokeResult({ ok: false, step: 'submit-started' });
      void submitQuestion(
        'Set up Visual Edit from this image and document using the submit smoke.',
        'Set up Visual Edit from this image and document using the submit smoke.',
        [submitImage],
        [submitFile]
      );
      return;
    }

    if (smoke.phase === 'wait' && serviceCalled && threadReady && stateReady) {
      smoke.phase = 'done';
      writeSubmitSmokeResult({
        ok: true,
        serviceCalled,
        threadReady,
        stateReady,
        liveDiagnostics: getGatewaySessionDiagnostics(),
        actionTypes: actions.map((action) => action.type),
      });
      return;
    }

    writeSubmitSmokeResult({
      ok: false,
      serviceCalled,
      threadReady,
      stateReady,
      liveDiagnostics: getGatewaySessionDiagnostics(),
      actionTypes: actions.map((action) => action.type),
    });
  });

  return (
    <>
      {open && !inspectMode && (
        <section
          ref={panelRef}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+8.25rem)] right-3 z-[95] flex h-[min(600px,calc(100svh-9.5rem))] w-[calc(100vw-1.5rem)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-xl lg:bottom-[calc(env(safe-area-inset-bottom)+4rem)] lg:right-3"
          aria-label={String(t('assistant.title', { defaultValue: 'Assistant' }))}
        >
          <header className="border-b border-border-subtle bg-background/95 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background"
                title={String(t('assistant.title', { defaultValue: 'Studio Assistant' }))}
              >
                <Bot size={19} />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={startImageSelectionHandoff}
                  disabled={isThinking}
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-all',
                    'border-border bg-surface-elevated text-foreground-secondary hover:border-foreground/25 hover:bg-surface-sunken hover:text-foreground',
                    isThinking && 'cursor-not-allowed opacity-50 hover:border-border hover:bg-surface-elevated hover:text-foreground-secondary'
                  )}
                  title={String(t('assistant.selectImageArea', { defaultValue: 'Circle image area' }))}
                  aria-label={String(t('assistant.selectImageArea', { defaultValue: 'Circle image area' }))}
                >
                  <SquareMousePointer size={15} />
                  <span>{t('assistant.areaShort', { defaultValue: 'Area' })}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dismissHint();
                    setInspectMode(true);
                  }}
                  disabled={isThinking}
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-all',
                    'border-accent/50 bg-accent/20 text-foreground shadow-sm hover:border-foreground/25 hover:bg-foreground hover:text-background',
                    isThinking && 'cursor-not-allowed opacity-50 hover:border-accent/50 hover:bg-accent/20 hover:text-foreground'
                  )}
                  title={String(t('assistant.inspect', { defaultValue: 'Inspect interface element' }))}
                  aria-label={String(t('assistant.inspect', { defaultValue: 'Inspect interface element' }))}
                >
                  <SquareMousePointer size={15} />
                  <span>{t('assistant.inspectShort', { defaultValue: 'Inspect' })}</span>
                </button>
                <button
                  type="button"
                  onClick={clearThread}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
                  title={String(t('assistant.clear', { defaultValue: 'Clear chat' }))}
                  aria-label={String(t('assistant.clear', { defaultValue: 'Clear chat' }))}
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInspectMode(false);
                    setOpen(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
                  title={String(t('common.close'))}
                  aria-label={String(t('common.close'))}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {state.workflow.visualSelections.length > 0 && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs">
                <span className="min-w-0 truncate font-medium text-foreground-secondary">
                  {state.workflow.visualSelections.length} selected image area{state.workflow.visualSelections.length === 1 ? '' : 's'} in context
                </span>
                <button
                  type="button"
                  onClick={() => void submitQuestion('Analyze the selected image area and recommend the best next edit, prompt, and settings.')}
                  disabled={isThinking}
                  className="shrink-0 rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-bold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Ask
                </button>
              </div>
            )}
          </header>

          <div className="flex-1 overflow-y-auto bg-background-secondary/70 px-3 py-3 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm leading-relaxed text-foreground-secondary">
                  <div className="font-semibold text-foreground">
                    {t('assistant.emptyTitle', { defaultValue: 'Tell me what you want to make.' })}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                    {t('assistant.emptyBody', {
                      defaultValue: 'I can review the current image, suggest a direction, set up the controls, improve the prompt, and render when you confirm.',
                    })}
                  </p>
                </div>
                <div className="space-y-2">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void submitQuestion(prompt)}
                      className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-left text-xs font-medium text-foreground-secondary transition-colors hover:border-border-strong hover:bg-surface-sunken hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                        message.role === 'user'
                          ? 'bg-foreground text-background'
                          : 'border border-border bg-surface-elevated text-foreground-secondary'
                      )}
                    >
                      {message.isLoading ? (
                        <div className="flex items-center gap-2 text-foreground-muted">
                          <Loader2 size={14} className="animate-spin" />
                          <span>{message.content}</span>
                        </div>
                      ) : (
                        <>
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mb-2 grid grid-cols-2 gap-2">
                              {message.attachments.map((image) => (
                                <img
                                  key={image.id}
                                  src={image.url}
                                  alt={image.name || 'Assistant attachment'}
                                  className="h-20 w-full rounded-xl border border-white/20 object-cover"
                                />
                              ))}
                            </div>
                          )}
                          {message.files && message.files.length > 0 && (
                            <div className="mb-2 space-y-1.5">
                              {message.files.map((file) => (
                                <div key={file.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-sunken px-2 py-1.5 text-[11px] text-foreground-secondary">
                                  <FileText size={13} className="shrink-0" />
                                  <span className="truncate">{file.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <BubbleText text={message.content} />
                          {message.actions && message.actions.length > 0 && (
                            <div className="mt-3 space-y-2 border-t border-border-subtle pt-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wide text-foreground-muted">
                                  Assistant actions
                                </span>
                                {message.actions.some((action) => !(message.appliedActionIds || []).includes(action.id)) && (
                                  <button
                                    type="button"
                                    onClick={() => applyActions(
                                      message.id,
                                      message.actions!.filter((action) => !(message.appliedActionIds || []).includes(action.id))
                                    )}
                                    className="rounded-lg bg-foreground px-2.5 py-1 text-[11px] font-bold text-background transition hover:opacity-90"
                                  >
                                    Apply all
                                  </button>
                                )}
                              </div>
                              {message.actions.map((action) => {
                                const applied = (message.appliedActionIds || []).includes(action.id);
                                return (
                                  <div
                                    key={action.id}
                                    className="rounded-xl border border-border bg-background px-3 py-2"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold text-foreground">{action.label}</div>
                                        {action.reason && (
                                          <div className="mt-0.5 text-[11px] leading-relaxed text-foreground-muted">{action.reason}</div>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => applyActions(message.id, [action])}
                                        disabled={applied}
                                        className={cn(
                                          'shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition',
                                          applied
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-surface-sunken text-foreground hover:bg-foreground hover:text-background'
                                        )}
                                      >
                                        {applied ? 'Applied' : 'Apply'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {error && (
            <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t border-border bg-background px-3 py-3">
            <input
              ref={attachmentInputRef}
              type="file"
              accept="image/*,.pdf,.docx,.xlsx,.xls,.csv,.pptx,.json,application/pdf,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              multiple
              className="hidden"
              onChange={handleAssistantAttachmentUpload}
            />
            {composerImages.length > 0 && (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {composerImages.map((image) => (
                  <div key={image.id} className="group relative h-14 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-sunken">
                    <img src={image.url} alt={image.name || 'Reference image'} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeComposerImage(image.id)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                      aria-label={String(t('assistant.removeImage', { defaultValue: 'Remove image' }))}
                      title={String(t('assistant.removeImage', { defaultValue: 'Remove image' }))}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {composerFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {composerFiles.map((file) => (
                  <div key={file.id} className="flex max-w-full items-center gap-2 rounded-lg border border-border bg-surface-sunken px-2 py-1.5 text-xs text-foreground-secondary">
                    <FileText size={14} className="shrink-0" />
                    <span className="max-w-[220px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeComposerFile(file.id)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-elevated hover:text-foreground"
                      aria-label={String(t('assistant.removeFile', { defaultValue: 'Remove file' }))}
                      title={String(t('assistant.removeFile', { defaultValue: 'Remove file' }))}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => attachmentInputRef.current?.click()}
                disabled={isThinking || (composerImages.length >= maxAssistantComposerImages && composerFiles.length >= maxAssistantComposerFiles)}
                className={cn(
                  'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-border transition-all',
                  isThinking || (composerImages.length >= maxAssistantComposerImages && composerFiles.length >= maxAssistantComposerFiles)
                    ? 'cursor-not-allowed bg-surface-sunken text-foreground-muted'
                    : 'bg-surface-elevated text-foreground-secondary hover:border-border-strong hover:bg-surface-sunken hover:text-foreground'
                )}
                aria-label={String(t('assistant.attachFile', { defaultValue: 'Attach image or file' }))}
                title={String(t('assistant.attachFile', { defaultValue: 'Attach image or file' }))}
              >
                <Paperclip size={17} />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submitQuestion(input, input, composerImages, composerFiles);
                  }
                }}
                rows={1}
                className="max-h-36 min-h-[42px] flex-1 resize-none overflow-y-auto rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition focus:border-border-strong focus:bg-background custom-scrollbar"
                placeholder={String(t('assistant.placeholder', { defaultValue: `Ask about ${feature.title}...` }))}
                disabled={isThinking}
              />
              <button
                type="submit"
                disabled={(!input.trim() && composerImages.length === 0 && composerFiles.length === 0) || isThinking}
                className={cn(
                  'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl transition-all',
                  (!input.trim() && composerImages.length === 0 && composerFiles.length === 0) || isThinking
                    ? 'bg-surface-sunken text-foreground-muted'
                    : 'bg-foreground text-background hover:scale-105 active:scale-95'
                )}
                aria-label={String(t('assistant.send', { defaultValue: 'Send' }))}
              >
                {isThinking ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => {
          dismissHint();
          if (inspectMode) {
            setInspectMode(false);
            setInspectRect(null);
            setOpen(true);
            return;
          }
          setOpen((value) => !value);
        }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-3 z-[90] flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-foreground text-background shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-elevated active:scale-95 lg:bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:right-3"
        aria-label={String(t('assistant.open', { defaultValue: 'Open assistant' }))}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={18} /> : <MessageCircle size={18} />}
        {!open && (
          <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
        )}
      </button>

      {inspectMode && open && (
        <div
          ref={inspectToolbarRef}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] left-1/2 z-[96] flex w-[min(430px,calc(100vw-1.5rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-border bg-foreground px-3 py-2.5 text-background shadow-2xl lg:bottom-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background/15">
              <SquareMousePointer size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold">
                {t('assistant.inspectActiveTitle', { defaultValue: 'Inspect mode' })}
              </div>
              <div className="truncate text-[11px] leading-relaxed text-background/70">
                {t('assistant.inspectActiveBody', {
                  defaultValue: 'Click a control in the workspace. Press Esc to cancel.',
                })}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setInspectMode(false);
              setInspectRect(null);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/10 text-background transition-colors hover:bg-background/20"
            aria-label={String(t('assistant.inspectCancel', { defaultValue: 'Cancel inspect mode' }))}
            title={String(t('assistant.inspectCancel', { defaultValue: 'Cancel inspect mode' }))}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {hintVisible && !open && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+8rem)] right-3 z-[89] max-w-[220px] animate-fade-in rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs leading-relaxed text-foreground-secondary shadow-lg lg:bottom-[calc(env(safe-area-inset-bottom)+4rem)]">
          <button
            type="button"
            onClick={dismissHint}
            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
            aria-label={String(t('common.close'))}
          >
            <X size={12} />
          </button>
          <div className="pr-5 font-semibold text-foreground">
            {t('assistant.hintTitle', { defaultValue: 'Need help?' })}
          </div>
          <div className="mt-0.5 pr-3 text-[11px] text-foreground-muted">
            {t('assistant.hintBody', {
              feature: feature.title,
              defaultValue: `Ask the assistant about ${feature.title}.`,
            })}
          </div>
        </div>
      )}

      {inspectMode && open && (
        <>
          {inspectRect && (
            <div
              className="pointer-events-none fixed z-[94] rounded-lg border-2 border-accent bg-accent/5 shadow-[0_0_0_1px_rgba(255,255,255,0.45)]"
              style={{
                top: inspectRect.top,
                left: inspectRect.left,
                width: inspectRect.width,
                height: inspectRect.height,
              }}
            />
          )}
          <div className="pointer-events-none fixed left-1/2 top-20 z-[94] -translate-x-1/2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground shadow-lg">
            {t('assistant.inspectOverlay', { defaultValue: 'Select a UI element to explain' })}
          </div>
        </>
      )}
    </>
  );
};
