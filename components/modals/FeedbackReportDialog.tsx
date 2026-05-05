import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bug, Loader2, MessageSquareWarning, Send, Wrench, XCircle } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store';
import { useAuth } from '../auth/AuthGate';
import { feedbackService } from '../../services/feedbackService';
import { prepareFeedbackSnapshot } from '../../lib/projectSnapshot';
import type { FeedbackReportCategory, FeedbackReportPriority } from '../../types';

interface FeedbackReportDialogProps {
  open: boolean;
  onClose: () => void;
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => title.trim().length > 0 && description.trim().length > 0 && !isSubmitting,
    [title, description, isSubmitting]
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
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!canSubmit || !user?.email) return;

    setIsSubmitting(true);

    try {
      const snapshotPayload = await prepareFeedbackSnapshot(state, user.email, projectName || null);

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
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-[700px] max-w-[94vw] max-h-[92vh] overflow-y-auto bg-background rounded-2xl shadow-2xl border border-border animate-scale-in">
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
  );
};
