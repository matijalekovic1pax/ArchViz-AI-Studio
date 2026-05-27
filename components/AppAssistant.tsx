import React, { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChevronDown, Image as ImageIcon, Loader2, MessageCircle, RefreshCw, Send, SquareMousePointer, X } from 'lucide-react';
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
  type AppAssistantChatImage,
} from '../lib/appAssistantActions';
import { GeminiService, ImageUtils, type ImageData } from '../services/geminiService';

type AssistantRole = 'user' | 'assistant';

interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  isLoading?: boolean;
  attachments?: AppAssistantChatImage[];
  actions?: AppAssistantAction[];
  appliedActionIds?: string[];
}

type AssistantThreads = Partial<Record<GenerationMode, AssistantMessage[]>>;
interface PendingGenerationRequest {
  id: string;
  prompt?: string;
}

const ASSISTANT_MODEL = 'gemini-3.5-flash';
const controlModeStorageKey = 'archviz_assistant_control_mode';
const maxAssistantComposerImages = 4;
const makeMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
  const { generate } = useGeneration();
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [inspectMode, setInspectMode] = useState(false);
  const [inspectRect, setInspectRect] = useState<InspectRect | null>(null);
  const [controlMode, setControlMode] = useState(() => {
    try {
      return sessionStorage.getItem(controlModeStorageKey) !== 'false';
    } catch {
      return true;
    }
  });
  const [pendingGeneration, setPendingGeneration] = useState<PendingGenerationRequest | null>(null);
  const [input, setInput] = useState('');
  const [composerImages, setComposerImages] = useState<AppAssistantChatImage[]>([]);
  const [threads, setThreads] = useState<AssistantThreads>({});
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const inspectToolbarRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const service = useMemo(() => new GeminiService({ model: ASSISTANT_MODEL }), []);
  const feature = getAppAssistantFeature(state.mode);
  const messages = threads[state.mode] || [];
  const isThinking = messages.some((message) => message.isLoading);
  const assistantHintKey = 'archviz_assistant_hint_seen';

  const setThreadForMode = (
    mode: GenerationMode,
    updater: (messages: AssistantMessage[]) => AssistantMessage[]
  ) => {
    setThreads((previous) => ({
      ...previous,
      [mode]: updater(previous[mode] || []),
    }));
  };

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, open, state.mode]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open, state.mode]);

  useEffect(() => {
    try {
      sessionStorage.setItem(controlModeStorageKey, controlMode ? 'true' : 'false');
    } catch {}
  }, [controlMode]);

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

  const handleAssistantImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.currentTarget.files;
    const files: File[] = [];
    if (fileList) {
      for (let index = 0; index < fileList.length; index += 1) {
        const file = fileList.item(index);
        if (file?.type.startsWith('image/')) {
          files.push(file);
        }
      }
    }
    const limitedFiles = files.slice(0, Math.max(0, maxAssistantComposerImages - composerImages.length));

    limitedFiles.forEach((file) => {
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

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const removeComposerImage = (id: string) => {
    setComposerImages((items) => items.filter((item) => item.id !== id));
  };

  const submitQuestion = async (
    rawQuestion: string,
    visibleQuestion = rawQuestion,
    attachedImages: AppAssistantChatImage[] = []
  ) => {
    const imageQuestion = attachedImages.length
      ? `I attached ${attachedImages.length} image reference${attachedImages.length === 1 ? '' : 's'}. Review them and suggest how they should be used in this workflow.`
      : '';
    const question = rawQuestion.trim() || imageQuestion;
    if (!question || isThinking) return;

    const requestMode = state.mode;
    const requestMessages = threads[requestMode] || [];
    const assistantImageSources = getAssistantImageSources(state, attachedImages);
    const assistantImages = getAssistantImages(state, attachedImages);
    const workspaceSnapshot = [
      buildAppAssistantWorkspaceSnapshot(state),
      `Assistant action mode: ${controlMode ? 'Act mode; validated actions will apply automatically' : 'Suggest mode; actions wait for user confirmation'}`,
      `User-attached images in this message: ${attachedImages.length ? attachedImages.map((image) => `${image.id}${image.name ? ` (${image.name})` : ''}`).join(', ') : 'none'}`,
      `Visual attachments sent to assistant: ${assistantImageSources.length ? assistantImageSources.map((source, index) => `image ${index + 1}: ${source.label}`).join(', ') : 'none'}`,
    ].join('\n');
    const userMessage: AssistantMessage = {
      id: makeMessageId(),
      role: 'user',
      content: visibleQuestion.trim() || question,
      attachments: attachedImages,
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
    setThreadForMode(requestMode, (items) => [...items, userMessage, loadingMessage]);

    try {
      const answer = await service.generateText({
        model: ASSISTANT_MODEL,
        prompt: buildAppAssistantPrompt({
          mode: requestMode,
          question,
          language: i18n.language || 'en',
          messages: [...requestMessages, userMessage],
          workspaceSnapshot,
          actionContext: buildAppAssistantActionContext(state, { chatImages: attachedImages }),
        }),
        images: assistantImages,
        generationConfig: {
          temperature: 0.15,
          topP: 0.9,
          maxOutputTokens: 4096,
          responseModalities: ['TEXT'],
          thinkingConfig: { thinkingLevel: 'low' },
        },
      });

      const { content, requests } = extractAppAssistantActions(answer);
      const actions = normalizeAppAssistantActions(requests, state, { chatImages: attachedImages });

      setThreadForMode(requestMode, (items) =>
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
          applyActions(requestMode, loadingMessage.id, actions, true);
        }, 0);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setThreadForMode(requestMode, (items) =>
        items.map((item) =>
          item.id === loadingMessage.id
            ? {
                ...item,
                content: String(t('assistant.error', { defaultValue: 'I could not reach the assistant right now. Please try again.' })),
                isLoading: false,
              }
            : item
        )
      );
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitQuestion(input, input, composerImages);
  };

  const clearThread = () => {
    setError(null);
    setInspectMode(false);
    setComposerImages([]);
    setThreadForMode(state.mode, () => []);
  };

  const markActionsApplied = (mode: GenerationMode, messageId: string, actionIds: string[]) => {
    setThreadForMode(mode, (items) =>
      items.map((message) => {
        if (message.id !== messageId) return message;
        const applied = new Set(message.appliedActionIds || []);
        actionIds.forEach((id) => applied.add(id));
        return { ...message, appliedActionIds: Array.from(applied) };
      })
    );
  };

  const applyActions = (
    mode: GenerationMode,
    messageId: string,
    actions: AppAssistantAction[],
    automatic = false
  ) => {
    if (!actions.length) return;
    const runGenerationAction = actions.find((action) => action.type === 'run_generation');
    const runPreprocessAction = actions.find((action) => action.type === 'run_preprocess');
    const prepareSelectionAction = actions.find((action) => action.type === 'prepare_image_selection');
    const stateActions = actions.filter(
      (action) => action.type !== 'run_generation' && action.type !== 'run_preprocess' && action.type !== 'prepare_image_selection'
    );

    if (stateActions.length > 0) {
      applyAppAssistantActions(dispatch, state, stateActions);
    }

    if (runPreprocessAction) {
      dispatch({ type: 'SET_MODE', payload: 'render-3d' });
      dispatch({ type: 'UPDATE_WORKFLOW', payload: { prioritizationEnabled: true, detectedElements: [] } });
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('archviz:assistant-run-render3d-preprocess'));
      }, 80);
    }

    if (prepareSelectionAction) {
      startImageSelectionHandoff();
    }

    if (runGenerationAction) {
      const prompt = typeof runGenerationAction.value === 'string' ? runGenerationAction.value : undefined;
      setPendingGeneration({ id: runGenerationAction.id, prompt });
    }

    markActionsApplied(mode, messageId, actions.map((action) => action.id));
    if (!prepareSelectionAction) {
      const message = runGenerationAction
        ? stateActions.length > 0
          ? 'Assistant applied changes and queued generation.'
          : 'Assistant queued generation.'
        : runPreprocessAction
          ? stateActions.length > 0
            ? 'Assistant applied setup and started AI pre-processing.'
            : 'Assistant started AI pre-processing.'
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
                  onClick={() => setControlMode((value) => !value)}
                  className={cn(
                    'flex h-8 items-center rounded-lg border px-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
                    controlMode
                      ? 'border-green-200 bg-green-100 text-green-700 hover:bg-green-200'
                      : 'border-border bg-surface-elevated text-foreground-muted hover:border-foreground/25 hover:bg-surface-sunken hover:text-foreground'
                  )}
                  title={controlMode ? 'Assistant applies validated actions automatically' : 'Assistant only suggests actions'}
                  aria-pressed={controlMode}
                >
                  {controlMode ? t('assistant.actMode', { defaultValue: 'Act' }) : t('assistant.suggestMode', { defaultValue: 'Suggest' })}
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
                                      state.mode,
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
                                        onClick={() => applyActions(state.mode, message.id, [action])}
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
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAssistantImageUpload}
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
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isThinking || composerImages.length >= maxAssistantComposerImages}
                className={cn(
                  'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-border transition-all',
                  isThinking || composerImages.length >= maxAssistantComposerImages
                    ? 'cursor-not-allowed bg-surface-sunken text-foreground-muted'
                    : 'bg-surface-elevated text-foreground-secondary hover:border-border-strong hover:bg-surface-sunken hover:text-foreground'
                )}
                aria-label={String(t('assistant.attachImage', { defaultValue: 'Attach image' }))}
                title={String(t('assistant.attachImage', { defaultValue: 'Attach image' }))}
              >
                <ImageIcon size={17} />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submitQuestion(input, input, composerImages);
                  }
                }}
                rows={1}
                className="max-h-36 min-h-[42px] flex-1 resize-none overflow-y-auto rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition focus:border-border-strong focus:bg-background custom-scrollbar"
                placeholder={String(t('assistant.placeholder', { defaultValue: `Ask about ${feature.title}...` }))}
                disabled={isThinking}
              />
              <button
                type="submit"
                disabled={(!input.trim() && composerImages.length === 0) || isThinking}
                className={cn(
                  'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl transition-all',
                  (!input.trim() && composerImages.length === 0) || isThinking
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
