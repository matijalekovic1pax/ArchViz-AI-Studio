import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bug, Loader2, MessageSquareWarning, Send, Wrench, XCircle } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store';
import { useAuth } from '../auth/AuthGate';
import { feedbackService } from '../../services/feedbackService';
import { prepareFeedbackSnapshot } from '../../lib/projectSnapshot';
import { collectFeedbackImageCandidates } from '../../lib/feedbackImageAnnotations';
import { FeedbackImageMarkupCanvas } from '../feedback/FeedbackImageMarkupCanvas';
import type {
  FeedbackImageAnnotation,
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
  selected: boolean;
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
  'exploded': 'workflows.exploded',
  'section': 'workflows.section',
  'render-sketch': 'workflows.renderSketch',
  'multi-angle': 'workflows.multiAngle',
  'upscale': 'workflows.upscale',
  'img-to-cad': 'workflows.imgToCad',
  'img-to-3d': 'workflows.imgTo3d',
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const featureLabel = useMemo(() => {
    const key = WORKFLOW_LABEL_KEY_BY_MODE[state.mode];
    return key ? t(key) : state.mode;
  }, [state.mode, t]);

  const selectedImageCount = useMemo(
    () => imageAnnotations.filter((item) => item.selected).length,
    [imageAnnotations]
  );

  const canSubmit = useMemo(
    () => title.trim().length > 0 && description.trim().length > 0 && !isSubmitting,
    [title, description, isSubmitting]
  );

  const activeMarkupItem = useMemo(
    () => imageAnnotations.find((item) => item.id === activeMarkupId) || null,
    [imageAnnotations, activeMarkupId]
  );

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
        selected: false,
      }))
    );
  }, [open, state]);

  if (!open) return null;

  const updateImageDraft = (id: string, updater: (item: FeedbackImageAnnotationDraft) => FeedbackImageAnnotationDraft) => {
    setImageAnnotations((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  };

  const handleSubmit = async () => {
    if (!canSubmit || !user?.email) return;

    setIsSubmitting(true);

    try {
      const snapshotPayload = await prepareFeedbackSnapshot(state, user.email, projectName || null);

      const imageFeedback = imageAnnotations
        .filter((item) => item.selected)
        .map(({ selected, previewUrl, ...item }) => ({
          ...item,
          note: cleanNote(item.note || ''),
        }));

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
                <span className="text-xs font-semibold text-foreground-muted">
                  {t('feedback.imageSelectedCount', { count: selectedImageCount })}
                </span>
              </div>

              {imageAnnotations.length === 0 ? (
                <p className="text-sm text-foreground-muted">{t('feedback.imageMarkupEmpty')}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
                  {imageAnnotations.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => updateImageDraft(item.id, (prev) => ({ ...prev, selected: !prev.selected }))}
                          className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                            item.selected
                              ? 'bg-foreground text-background border-foreground'
                              : 'border-border text-foreground-muted hover:bg-surface-sunken'
                          }`}
                        >
                          {item.selected ? t('feedback.imageSelected') : t('feedback.imageSelect')}
                        </button>
                        <button
                          onClick={() => setActiveMarkupId(item.id)}
                          disabled={!item.selected}
                          className="text-xs px-2 py-1 rounded-md border border-border text-foreground hover:bg-surface-sunken disabled:opacity-50"
                        >
                          {t('feedback.imageOpenMarkup')}
                        </button>
                      </div>
                      <div className="aspect-[16/10] rounded-md overflow-hidden border border-border-subtle bg-black/5">
                        <img src={item.previewUrl} alt={item.label} className="w-full h-full object-cover" />
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
                onChange={(next) => updateImageDraft(activeMarkupItem.id, (prev) => ({ ...prev, markups: next }))}
                className="max-h-[62vh]"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateImageDraft(activeMarkupItem.id, (prev) => ({
                      ...prev,
                      markups: prev.markups.slice(0, -1),
                    }))
                  }
                  disabled={activeMarkupItem.markups.length === 0}
                  className="h-9 px-3 rounded-lg border border-border text-sm text-foreground hover:bg-surface-sunken disabled:opacity-50"
                >
                  {t('feedback.imageUndoMarkup')}
                </button>
                <button
                  onClick={() => updateImageDraft(activeMarkupItem.id, (prev) => ({ ...prev, markups: [] }))}
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
