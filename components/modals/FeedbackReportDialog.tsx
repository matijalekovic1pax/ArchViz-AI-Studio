import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bug, Download, ExternalLink, FileText, Loader2, MessageSquareWarning, Send, Wrench, XCircle } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store';
import { useAuth } from '../auth/AuthGate';
import { feedbackService } from '../../services/feedbackService';
import { prepareFeedbackSnapshot } from '../../lib/projectSnapshot';
import { collectFeedbackImageCandidates } from '../../lib/feedbackImageAnnotations';
import { createFeedbackJpegCompressor } from '../../lib/feedbackImageCompression';
import { FeedbackImageMarkupCanvas } from '../feedback/FeedbackImageMarkupCanvas';
import type {
  FeedbackDocumentAttachment,
  FeedbackImageAnnotation,
  FeedbackImageMarkupShape,
  FeedbackReportCategory,
  FeedbackReportPriority,
  GenerationMode,
} from '../../types';

interface FeedbackReportDialogProps {
  open: boolean;
  onClose: () => void;
}

interface FeedbackImageAnnotationDraft extends FeedbackImageAnnotation {
  previewUrl: string;
}

const CATEGORIES: Array<{ value: FeedbackReportCategory; icon: React.ReactNode }> = [
  { value: 'bug', icon: <Bug size={14} /> },
  { value: 'quality', icon: <Wrench size={14} /> },
  { value: 'ux', icon: <MessageSquareWarning size={14} /> },
  { value: 'performance', icon: <AlertTriangle size={14} /> },
  { value: 'feature_request', icon: <Send size={14} /> },
  { value: 'other', icon: <XCircle size={14} /> },
];

const PRIORITIES: FeedbackReportPriority[] = ['low', 'normal', 'high', 'urgent'];

const WORKFLOW_LABEL_KEY_BY_MODE: Record<GenerationMode, string> = {
  'generate-text': 'workflows.generateText',
  'render-3d': 'workflows.render3d',
  'scene-compose': 'workflows.sceneCompose',
  'render-cad': 'workflows.renderCad',
  'masterplan': 'workflows.masterplan',
  'visual-edit': 'workflows.visualEdit',
  'angle-change': 'workflows.angleChange',
  'exploded': 'workflows.exploded',
  'section': 'workflows.section',
  'render-sketch': 'workflows.renderSketch',
  'multi-angle': 'workflows.multiAngle',
  'upscale': 'workflows.upscale',
  'img-to-cad': 'workflows.imgToCad',
  'video': 'workflows.video',
  'material-validation': 'workflows.materialValidation',
  'document-translate': 'workflows.documentTranslate',
  'pdf-compression': 'workflows.pdfCompression',
  'headshot': 'workflows.headshot',
};

const cleanNote = (value: string): string | undefined => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const MAX_FEEDBACK_DOCUMENT_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_FEEDBACK_DOCUMENT_ATTACHMENT_TOTAL_BYTES = 16 * 1024 * 1024;

const estimateDataUrlSize = (dataUrl: string): number => {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return 0;
  const payload = dataUrl.slice(commaIndex + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
};

const buildTranslatedFileName = (sourceName: string, sourceType: 'pdf' | 'docx' | 'xlsx' | 'pptx'): string => {
  const extension = sourceType === 'xlsx' ? '.xlsx' : sourceType === 'pptx' ? '.pptx' : '.docx';
  const dotIndex = sourceName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? sourceName.slice(0, dotIndex) : sourceName;
  return `${baseName}-translated${extension}`;
};

const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getAttachmentByteSize = (attachment: FeedbackDocumentAttachment): number => {
  if (Number.isFinite(attachment.size) && attachment.size > 0) return attachment.size;
  return estimateDataUrlSize(attachment.dataUrl);
};

const buildDocumentFeedbackPayload = (
  attachments: FeedbackDocumentAttachment[]
): FeedbackDocumentAttachment[] | undefined => {
  let totalBytes = 0;
  const included: FeedbackDocumentAttachment[] = [];

  for (const attachment of attachments) {
    const attachmentBytes = getAttachmentByteSize(attachment);
    if (
      attachmentBytes > MAX_FEEDBACK_DOCUMENT_ATTACHMENT_BYTES ||
      totalBytes + attachmentBytes > MAX_FEEDBACK_DOCUMENT_ATTACHMENT_TOTAL_BYTES
    ) {
      continue;
    }

    totalBytes += attachmentBytes;
    included.push(attachment);
  }

  return included.length > 0 ? included : undefined;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  if (target.closest('[contenteditable="true"]')) return true;
  if (target.getAttribute('role') === 'textbox') return true;
  return false;
};

export const FeedbackReportDialog: React.FC<FeedbackReportDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { state, dispatch } = useAppStore();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [projectName, setProjectName] = useState('');
  const [category, setCategory] = useState<FeedbackReportCategory>('bug');
  const [priority, setPriority] = useState<FeedbackReportPriority>('normal');
  const [imageAnnotations, setImageAnnotations] = useState<FeedbackImageAnnotationDraft[]>([]);
  const [activeMarkupId, setActiveMarkupId] = useState<string | null>(null);
  const [markupRedoStacks, setMarkupRedoStacks] = useState<Record<string, FeedbackImageMarkupShape[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const featureLabel = useMemo(() => {
    const key = WORKFLOW_LABEL_KEY_BY_MODE[state.mode];
    return key ? t(key) : state.mode;
  }, [state.mode, t]);

  const canSubmit = useMemo(
    () => title.trim().length > 0 && description.trim().length > 0 && !isSubmitting,
    [title, description, isSubmitting]
  );

  const activeMarkupItem = useMemo(
    () => imageAnnotations.find((item) => item.id === activeMarkupId) || null,
    [imageAnnotations, activeMarkupId]
  );

  const documentAttachments = useMemo<FeedbackDocumentAttachment[]>(() => {
    if (state.mode !== 'document-translate') return [];

    const docTranslate = state.workflow.documentTranslate;
    const sourceDocument = docTranslate.sourceDocument;
    const next: FeedbackDocumentAttachment[] = [];

    if (sourceDocument?.dataUrl?.startsWith('data:')) {
      next.push({
        id: `${sourceDocument.id}-original`,
        kind: 'original',
        name: sourceDocument.name,
        mimeType: sourceDocument.mimeType,
        size: Number.isFinite(sourceDocument.size) ? sourceDocument.size : estimateDataUrlSize(sourceDocument.dataUrl),
        dataUrl: sourceDocument.dataUrl,
        sourceDocumentId: sourceDocument.id,
      });
    }

    if (sourceDocument && docTranslate.translatedDocumentUrl?.startsWith('data:')) {
      const translatedMimeType =
        sourceDocument.type === 'xlsx'
          ? XLSX_MIME
          : sourceDocument.type === 'pptx'
          ? PPTX_MIME
          : DOCX_MIME;
      next.push({
        id: `${sourceDocument.id}-translated`,
        kind: 'translated',
        name: buildTranslatedFileName(sourceDocument.name, sourceDocument.type),
        mimeType: translatedMimeType,
        size: estimateDataUrlSize(docTranslate.translatedDocumentUrl),
        dataUrl: docTranslate.translatedDocumentUrl,
        sourceDocumentId: sourceDocument.id,
      });
    }

    return next;
  }, [state.mode, state.workflow.documentTranslate]);

  useEffect(() => {
    if (!open) return;

    setTitle('');
    setDescription('');
    setReproductionSteps('');
    setExpectedBehavior('');
    setProjectName('');
    setCategory('bug');
    setPriority('normal');
    setIsSubmitting(false);
    setActiveMarkupId(null);
    setMarkupRedoStacks({});

    const candidates = collectFeedbackImageCandidates(state);
    setImageAnnotations(
      candidates.map((candidate) => ({
        id: candidate.id,
        sourceType: candidate.sourceType,
        label: candidate.label,
        historyId: candidate.historyId ?? null,
        historyIndex: candidate.historyIndex ?? null,
        mode: candidate.mode ?? null,
        timestamp: candidate.timestamp ?? null,
        note: '',
        markups: [],
        previewUrl: candidate.previewUrl,
      }))
    );
  }, [open, state]);

  const updateImageDraft = (id: string, updater: (item: FeedbackImageAnnotationDraft) => FeedbackImageAnnotationDraft) => {
    setImageAnnotations((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  };

  const setImageMarkups = (id: string, markups: FeedbackImageMarkupShape[]) => {
    updateImageDraft(id, (prev) => ({ ...prev, markups }));
  };

  const handleMarkupChange = (id: string, markups: FeedbackImageMarkupShape[]) => {
    setImageMarkups(id, markups);
    setMarkupRedoStacks((prev) => ({ ...prev, [id]: [] }));
  };

  const handleMarkupUndo = (id: string) => {
    const current = imageAnnotations.find((item) => item.id === id);
    if (!current || current.markups.length === 0) return;
    const removed = current.markups[current.markups.length - 1];
    setImageMarkups(id, current.markups.slice(0, -1));
    setMarkupRedoStacks((prev) => ({ ...prev, [id]: [...(prev[id] || []), removed] }));
  };

  const handleMarkupRedo = (id: string) => {
    const current = imageAnnotations.find((item) => item.id === id);
    if (!current) return;
    const stack = markupRedoStacks[id] || [];
    if (stack.length === 0) return;
    const restored = stack[stack.length - 1];
    setMarkupRedoStacks((prev) => ({ ...prev, [id]: stack.slice(0, -1) }));
    setImageMarkups(id, [...current.markups, restored]);
  };

  const handleMarkupClear = (id: string) => {
    setImageMarkups(id, []);
    setMarkupRedoStacks((prev) => ({ ...prev, [id]: [] }));
  };

  useEffect(() => {
    if (!activeMarkupItem) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setActiveMarkupId(null);
        return;
      }

      if (isEditableTarget(event.target)) return;

      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        if (activeMarkupItem.markups.length === 0) return;
        event.preventDefault();
        handleMarkupUndo(activeMarkupItem.id);
        return;
      }

      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        const stack = markupRedoStacks[activeMarkupItem.id] || [];
        if (stack.length === 0) return;
        event.preventDefault();
        handleMarkupRedo(activeMarkupItem.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMarkupItem, markupRedoStacks]);

  const handleSubmit = async () => {
    if (!canSubmit || !user?.email) return;

    setIsSubmitting(true);

    try {
      const snapshotPayload = await prepareFeedbackSnapshot(state, user.email, projectName || null);

      const compactPreview = createFeedbackJpegCompressor({
        quality: 0.72,
        scale: 1,
        maxDimension: 1280,
        convertRemoteToDataUrl: true,
        timeoutMs: 8000,
      });

      const imageFeedback = await Promise.all(
        imageAnnotations
          .map(({ previewUrl, ...item }) => ({
            ...item,
            note: cleanNote(item.note || ''),
            _previewUrl: previewUrl,
          }))
          .filter((item) => item.markups.length > 0 || !!item.note)
          .map(async (item) => {
            const previewDataUrl = await compactPreview(item._previewUrl);
            const { _previewUrl, ...rest } = item;
            return {
              ...rest,
              previewDataUrl: previewDataUrl || undefined,
            };
          })
      );

      await feedbackService.submit({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        reproductionSteps: reproductionSteps.trim() || undefined,
        expectedBehavior: expectedBehavior.trim() || undefined,
        projectName: projectName.trim() || undefined,
        mode: state.mode,
        appVersion: 'web-app',
        userAgent: navigator.userAgent,
        historyCount: state.history.length,
        snapshotVersion: snapshotPayload.snapshotVersion,
        snapshot: snapshotPayload.snapshot,
        reportedFeatureKey: state.mode,
        reportedFeatureLabel: featureLabel,
        imageFeedback,
        documentFeedback: buildDocumentFeedbackPayload(documentAttachments),
      });

      onClose();

      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: nanoid(),
          tone: 'info',
          message: t('feedback.submitSuccess'),
        },
      });
    } catch (error: any) {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: nanoid(),
          tone: 'error',
          message: error?.message || t('feedback.submitError'),
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="w-[760px] max-w-[94vw] max-h-[92vh] overflow-y-auto bg-background rounded-2xl shadow-2xl border border-border animate-scale-in">
          <div className="p-6 border-b border-border-subtle flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-foreground">{t('feedback.title')}</h3>
              <p className="text-sm text-foreground-muted mt-1">{t('feedback.subtitle')}</p>
            </div>
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-full border border-border text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors"
              title={t('common.close')}
            >
              <XCircle size={16} className="mx-auto" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="rounded-xl border border-border bg-surface-sunken px-4 py-3 text-sm text-foreground-secondary flex items-center justify-between gap-3">
              <span>{t('feedback.featureLabel')}</span>
              <span className="font-semibold text-foreground">{featureLabel}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2 text-sm">
                <span className="font-semibold text-foreground">{t('feedback.projectName')}</span>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder={t('feedback.projectNamePlaceholder')}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-accent/35"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-semibold text-foreground">{t('feedback.titleLabel')}*</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('feedback.titlePlaceholder')}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-accent/35"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2 text-sm">
                <span className="font-semibold text-foreground">{t('feedback.categoryLabel')}</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FeedbackReportCategory)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-accent/35"
                >
                  {CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {t(`feedback.category.${item.value}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-semibold text-foreground">{t('feedback.priorityLabel')}</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as FeedbackReportPriority)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-accent/35"
                >
                  {PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {t(`feedback.priority.${value}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-2 text-sm block">
              <span className="font-semibold text-foreground">{t('feedback.descriptionLabel')}*</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('feedback.descriptionPlaceholder')}
                className="w-full min-h-[110px] px-3 py-2 rounded-lg border border-border bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-accent/35"
              />
            </label>

            <label className="space-y-2 text-sm block">
              <span className="font-semibold text-foreground">{t('feedback.stepsLabel')}</span>
              <textarea
                value={reproductionSteps}
                onChange={(e) => setReproductionSteps(e.target.value)}
                placeholder={t('feedback.stepsPlaceholder')}
                className="w-full min-h-[90px] px-3 py-2 rounded-lg border border-border bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-accent/35"
              />
            </label>

            <label className="space-y-2 text-sm block">
              <span className="font-semibold text-foreground">{t('feedback.expectedLabel')}</span>
              <textarea
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                placeholder={t('feedback.expectedPlaceholder')}
                className="w-full min-h-[90px] px-3 py-2 rounded-lg border border-border bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-accent/35"
              />
            </label>

            <div className="rounded-xl border border-border p-4 bg-surface space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('feedback.imageMarkupTitle')}</p>
                  <p className="text-xs text-foreground-muted mt-1">{t('feedback.imageMarkupSubtitle')}</p>
                </div>
              </div>

              {imageAnnotations.length === 0 && documentAttachments.length === 0 ? (
                <p className="text-sm text-foreground-muted">{t('feedback.mediaMarkupEmpty')}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
                  {documentAttachments.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs px-2 py-1 rounded-md border border-border text-foreground">
                          {item.kind === 'original' ? t('feedback.documentOriginal') : t('feedback.documentTranslated')}
                        </span>
                        <span className="text-[11px] text-foreground-muted">{formatFileSize(item.size)}</span>
                      </div>
                      <div className="rounded-md border border-border-subtle bg-surface h-[140px] flex flex-col items-center justify-center gap-2">
                        <FileText size={22} className="text-foreground-muted" />
                        <span className="text-[11px] text-foreground-muted uppercase tracking-wide">
                          {(item.mimeType.split('/')[1] || 'file').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-foreground truncate" title={item.name}>{item.name}</p>
                      <p className="text-[11px] text-foreground-muted truncate" title={item.mimeType}>{item.mimeType}</p>
                      <div className="flex items-center gap-2">
                        <a
                          href={item.dataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs px-2 py-1 rounded-md border border-border text-foreground hover:bg-surface-sunken inline-flex items-center gap-1"
                        >
                          <ExternalLink size={12} />
                          <span>{t('feedback.documentOpen')}</span>
                        </a>
                        <a
                          href={item.dataUrl}
                          download={item.name}
                          className="text-xs px-2 py-1 rounded-md border border-border text-foreground hover:bg-surface-sunken inline-flex items-center gap-1"
                        >
                          <Download size={12} />
                          <span>{t('feedback.documentDownload')}</span>
                        </a>
                      </div>
                    </div>
                  ))}
                  {imageAnnotations.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => setActiveMarkupId(item.id)}
                          className="text-xs px-2 py-1 rounded-md border border-border text-foreground hover:bg-surface-sunken"
                        >
                          {t('feedback.imageOpenMarkup')}
                        </button>
                      </div>
                      <div className="rounded-md overflow-hidden border border-border-subtle bg-black/5">
                        <FeedbackImageMarkupCanvas
                          imageUrl={item.previewUrl}
                          markups={item.markups}
                          readOnly
                          className="border-0 rounded-none"
                        />
                      </div>
                      <p className="text-xs font-medium text-foreground truncate" title={item.label}>{item.label}</p>
                      <p className="text-[11px] text-foreground-muted">
                        {t('feedback.imageMarkupCount', { count: item.markups.length })}
                      </p>
                      {!!cleanNote(item.note || '') && (
                        <p className="text-[11px] text-foreground-muted line-clamp-2">{cleanNote(item.note || '')}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface-sunken p-4 text-xs text-foreground-secondary">
              <p className="font-semibold text-foreground mb-1">{t('feedback.snapshotNoticeTitle')}</p>
              <p>{t('feedback.snapshotNoticeBody')}</p>
            </div>
          </div>

          <div className="px-6 pb-6 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 px-4 rounded-lg border border-border text-foreground hover:bg-surface-sunken transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="h-10 min-w-[150px] px-4 rounded-lg bg-foreground text-background font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
              <span>{isSubmitting ? t('feedback.submitting') : t('feedback.submit')}</span>
            </button>
          </div>
        </div>
      </div>

      {activeMarkupItem && (
        <div className="fixed inset-0 z-[98] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-[980px] max-w-[96vw] max-h-[94vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl">
            <div className="p-4 border-b border-border flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{t('feedback.imageMarkupEditorTitle')}</p>
                <p className="text-xs text-foreground-muted mt-1">{activeMarkupItem.label}</p>
              </div>
              <button
                onClick={() => setActiveMarkupId(null)}
                className="h-9 w-9 rounded-full border border-border text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors"
                title={t('common.close')}
              >
                <XCircle size={16} className="mx-auto" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-xs text-foreground-muted">{t('feedback.imageMarkupHelp')}</p>

              <FeedbackImageMarkupCanvas
                imageUrl={activeMarkupItem.previewUrl}
                markups={activeMarkupItem.markups}
                onChange={(next) => handleMarkupChange(activeMarkupItem.id, next)}
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMarkupUndo(activeMarkupItem.id)}
                  disabled={activeMarkupItem.markups.length === 0}
                  className="h-9 px-3 rounded-lg border border-border text-sm text-foreground hover:bg-surface-sunken disabled:opacity-50"
                >
                  {t('feedback.imageUndoMarkup')}
                </button>
                <button
                  onClick={() => handleMarkupRedo(activeMarkupItem.id)}
                  disabled={(markupRedoStacks[activeMarkupItem.id]?.length || 0) === 0}
                  className="h-9 px-3 rounded-lg border border-border text-sm text-foreground hover:bg-surface-sunken disabled:opacity-50"
                >
                  {t('topBar.redo')}
                </button>
                <button
                  onClick={() => handleMarkupClear(activeMarkupItem.id)}
                  disabled={activeMarkupItem.markups.length === 0}
                  className="h-9 px-3 rounded-lg border border-border text-sm text-foreground hover:bg-surface-sunken disabled:opacity-50"
                >
                  {t('feedback.imageClearMarkup')}
                </button>
              </div>

              <label className="space-y-2 text-sm block">
                <span className="font-semibold text-foreground">{t('feedback.imageSpecificFeedback')}</span>
                <textarea
                  value={activeMarkupItem.note || ''}
                  onChange={(e) => updateImageDraft(activeMarkupItem.id, (prev) => ({ ...prev, note: e.target.value }))}
                  placeholder={t('feedback.imageSpecificFeedbackPlaceholder')}
                  className="w-full min-h-[90px] px-3 py-2 rounded-lg border border-border bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-accent/35"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
