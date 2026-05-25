import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, FolderOpen, Loader2, RefreshCw, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthGate';
import { useAppStore } from '../../store';
import { feedbackService } from '../../services/feedbackService';
import { FeedbackImageMarkupCanvas } from '../feedback/FeedbackImageMarkupCanvas';
import { resolveFeedbackAnnotationImageUrl } from '../../lib/feedbackImageAnnotations';
import type {
  AppState,
  FeedbackDocumentAttachment,
  FeedbackImageAnnotation,
  FeedbackReportCategory,
  FeedbackReportDetail,
  FeedbackReportPriority,
  FeedbackReportStatus,
  FeedbackReportSummary,
  FeedbackProjectSnapshot,
  GenerationMode,
} from '../../types';

interface FeedbackAdminDashboardProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS: FeedbackReportStatus[] = ['new', 'triaged', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS: FeedbackReportPriority[] = ['low', 'normal', 'high', 'urgent'];
const CATEGORY_OPTIONS: Array<FeedbackReportCategory | ''> = ['', 'bug', 'quality', 'ux', 'performance', 'feature_request', 'other'];

const ADMIN_EMAIL = 'matija.lekovic@1pax.com';

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
  'video': 'workflows.video',
  'material-validation': 'workflows.materialValidation',
  'document-translate': 'workflows.documentTranslate',
  'pdf-compression': 'workflows.pdfCompression',
  'headshot': 'workflows.headshot',
};

const downloadJson = (data: unknown, fileName: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
};

const extractProjectStateFromSnapshot = (snapshot: any): AppState | null => {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const candidate = snapshot?.appState ?? snapshot;
  if (!candidate || typeof candidate !== 'object') return null;
  if (!('workflow' in candidate) || !('mode' in candidate)) return null;
  return candidate as AppState;
};

const estimateDataUrlSize = (dataUrl: string): number => {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return 0;
  const payload = dataUrl.slice(commaIndex + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
};

const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const sanitizeImageAnnotations = (value: any): FeedbackImageAnnotation[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const sourceType = item?.sourceType;
      if (sourceType !== 'source' && sourceType !== 'current' && sourceType !== 'history') return null;
      const previewDataUrl =
        typeof item?.previewDataUrl === 'string' &&
        item.previewDataUrl.startsWith('data:image/') &&
        item.previewDataUrl.length <= 3_000_000
          ? item.previewDataUrl
          : undefined;

      const markups = Array.isArray(item?.markups)
        ? item.markups
            .map((markup: any, markupIndex: number) => {
              if (Array.isArray(markup?.points)) {
                const points = markup.points
                  .map((point: any) => {
                    const x = Number(point?.x);
                    const y = Number(point?.y);
                    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
                    return { x, y };
                  })
                  .filter(Boolean);

                if (points.length >= 3) {
                  return {
                    id: String(markup?.id || `markup-${index + 1}-${markupIndex + 1}`),
                    points,
                  };
                }
              }

              // Legacy circle fallback
              const x = Number(markup?.x);
              const y = Number(markup?.y);
              const radius = Number(markup?.radius);
              if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius)) return null;
              if (x < 0 || x > 1 || y < 0 || y > 1 || radius <= 0 || radius > 1) return null;
              return {
                id: String(markup?.id || `markup-${index + 1}-${markupIndex + 1}`),
                x,
                y,
                radius,
              };
            })
            .filter(Boolean)
        : [];

      return {
        id: String(item?.id || `annotation-${index + 1}`),
        sourceType,
        label: String(item?.label || `Image ${index + 1}`),
        previewDataUrl,
        historyId: item?.historyId ? String(item.historyId) : null,
        historyIndex: Number.isFinite(Number(item?.historyIndex)) ? Math.floor(Number(item.historyIndex)) : null,
        mode: item?.mode ? String(item.mode) as GenerationMode : null,
        timestamp: Number.isFinite(Number(item?.timestamp)) ? Math.floor(Number(item.timestamp)) : null,
        note: item?.note ? String(item.note) : undefined,
        markups,
      } as FeedbackImageAnnotation;
    })
    .filter(Boolean) as FeedbackImageAnnotation[];
};

const sanitizeDocumentAttachments = (value: any): FeedbackDocumentAttachment[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const kind = item?.kind === 'translated' ? 'translated' : item?.kind === 'original' ? 'original' : null;
      const name = typeof item?.name === 'string' ? item.name.trim() : '';
      const mimeType = typeof item?.mimeType === 'string' ? item.mimeType.trim() : '';
      const dataUrl =
        typeof item?.dataUrl === 'string' &&
        item.dataUrl.startsWith('data:') &&
        item.dataUrl.length <= 50_000_000
          ? item.dataUrl
          : '';

      if (!kind || !name || !mimeType || !dataUrl) return null;

      const parsedSize = Number(item?.size);
      const size = Number.isFinite(parsedSize) && parsedSize > 0
        ? Math.floor(parsedSize)
        : estimateDataUrlSize(dataUrl);

      return {
        id: String(item?.id || `document-${index + 1}`),
        kind,
        name,
        mimeType,
        size,
        dataUrl,
        sourceDocumentId: item?.sourceDocumentId ? String(item.sourceDocumentId) : null,
      } as FeedbackDocumentAttachment;
    })
    .filter(Boolean) as FeedbackDocumentAttachment[];
};

export const FeedbackAdminDashboard: React.FC<FeedbackAdminDashboardProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { dispatch } = useAppStore();

  const [isLoading, setIsLoading] = useState(false);
  const [reports, setReports] = useState<FeedbackReportSummary[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<FeedbackReportDetail | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isOpeningSnapshot, setIsOpeningSnapshot] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<FeedbackProjectSnapshot | null>(null);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [updateNote, setUpdateNote] = useState('');

  const [statusFilter, setStatusFilter] = useState<FeedbackReportStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<FeedbackReportPriority | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<FeedbackReportCategory | ''>('');
  const [search, setSearch] = useState('');

  const isAdmin = (user?.email || '').toLowerCase() === ADMIN_EMAIL;

  const imageAnnotations = useMemo(
    () => sanitizeImageAnnotations(selectedDetail?.metadata?.imageFeedback),
    [selectedDetail]
  );

  const annotationViews = useMemo(
    () =>
      imageAnnotations.map((annotation) => ({
        ...annotation,
        imageUrl: resolveFeedbackAnnotationImageUrl(annotation, selectedSnapshot),
      })),
    [imageAnnotations, selectedSnapshot]
  );

  const documentAttachments = useMemo(
    () => sanitizeDocumentAttachments(selectedDetail?.metadata?.documentFeedback),
    [selectedDetail]
  );

  const getModeLabel = (mode: string | null | undefined): string => {
    if (!mode) return '-';
    const key = WORKFLOW_LABEL_KEY_BY_MODE[mode as GenerationMode];
    return key ? t(key) : mode;
  };

  const getFeatureLabel = (report: FeedbackReportDetail | null): string => {
    if (!report) return '-';
    const metadataLabel = typeof report.metadata?.reportedFeatureLabel === 'string' ? report.metadata.reportedFeatureLabel.trim() : '';
    if (metadataLabel) return metadataLabel;
    return getModeLabel(report.mode);
  };

  const loadSnapshotForReport = async (reportId: string) => {
    if (!isAdmin) return;
    setIsSnapshotLoading(true);
    try {
      const snapshotResult = await feedbackService.getSnapshot(reportId);
      setSelectedSnapshot(snapshotResult.snapshot || null);
    } catch {
      setSelectedSnapshot(null);
    } finally {
      setIsSnapshotLoading(false);
    }
  };

  const loadReports = async (opts?: { forceSelectFirst?: boolean }) => {
    if (!open || !isAdmin) return;
    setIsLoading(true);
    try {
      const result = await feedbackService.list({
        limit: 100,
        status: statusFilter,
        priority: priorityFilter,
        category: categoryFilter,
        search: search.trim() || undefined,
      });
      const nextReports = result.reports || [];
      setReports(nextReports);
      if (nextReports.length === 0) {
        setSelectedReportId(null);
        setSelectedDetail(null);
        setSelectedSnapshot(null);
        setActivity([]);
      } else if (
        opts?.forceSelectFirst ||
        !selectedReportId ||
        !nextReports.some((item) => item.id === selectedReportId)
      ) {
        setSelectedReportId(nextReports[0].id);
      }
    } catch (error: any) {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: nanoid(),
          tone: 'error',
          message: error?.message || t('feedback.admin.loadError'),
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadDetail = async (reportId: string) => {
    setIsDetailLoading(true);
    setSelectedSnapshot(null);
    try {
      const detail = await feedbackService.get(reportId);
      setSelectedDetail(detail.report);
      setActivity(detail.activity || []);
      setUpdateNote('');
      setComment('');

      const needsSnapshotImageFallback = sanitizeImageAnnotations(detail.report?.metadata?.imageFeedback).some(
        (item) => !item.previewDataUrl
      );
      if (needsSnapshotImageFallback) {
        void loadSnapshotForReport(reportId);
      }
    } catch (error: any) {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: nanoid(),
          tone: 'error',
          message: error?.message || t('feedback.admin.detailError'),
        },
      });
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadReports();
  }, [open, statusFilter, priorityFilter, categoryFilter]);

  useEffect(() => {
    if (!open || !selectedReportId || !isAdmin) return;
    loadDetail(selectedReportId);
  }, [open, selectedReportId, isAdmin]);

  if (!open) return null;

  const handleSave = async () => {
    if (!selectedDetail) return;
    setIsSaving(true);
    try {
      await feedbackService.update(selectedDetail.id, {
        status: selectedDetail.status,
        priority: selectedDetail.priority,
        note: updateNote.trim() || undefined,
      });
      await loadDetail(selectedDetail.id);
      await loadReports();
      dispatch({
        type: 'SET_APP_ALERT',
        payload: { id: nanoid(), tone: 'info', message: t('feedback.admin.saveSuccess') },
      });
    } catch (error: any) {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: { id: nanoid(), tone: 'error', message: error?.message || t('feedback.admin.saveError') },
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedDetail || !comment.trim()) return;
    setIsCommenting(true);
    try {
      await feedbackService.addActivity(selectedDetail.id, { message: comment.trim() });
      setComment('');
      await loadDetail(selectedDetail.id);
    } catch (error: any) {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: { id: nanoid(), tone: 'error', message: error?.message || t('feedback.admin.commentError') },
      });
    } finally {
      setIsCommenting(false);
    }
  };

  const handleDownloadSnapshot = async () => {
    if (!selectedDetail) return;
    try {
      const result = await feedbackService.getSnapshot(selectedDetail.id);
      downloadJson(result.snapshot, `feedback-snapshot-${selectedDetail.id}.json`);
    } catch (error: any) {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: { id: nanoid(), tone: 'error', message: error?.message || t('feedback.admin.snapshotError') },
      });
    }
  };

  const handleOpenSnapshotInApp = async () => {
    if (!selectedDetail) return;
    setIsOpeningSnapshot(true);
    try {
      const snapshot = selectedSnapshot || (await feedbackService.getSnapshot(selectedDetail.id)).snapshot;
      const projectState = extractProjectStateFromSnapshot(snapshot);
      if (!projectState) {
        throw new Error(t('feedback.admin.openSnapshotInvalid'));
      }

      dispatch({ type: 'LOAD_PROJECT', payload: projectState });
      onClose();
      dispatch({
        type: 'SET_APP_ALERT',
        payload: { id: nanoid(), tone: 'info', message: t('feedback.admin.openSnapshotSuccess') },
      });
    } catch (error: any) {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: { id: nanoid(), tone: 'error', message: error?.message || t('feedback.admin.openSnapshotError') },
      });
    } finally {
      setIsOpeningSnapshot(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!selectedDetail) return;
    const confirmed = window.confirm(t('feedback.admin.deleteConfirmBody'));
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await feedbackService.remove(selectedDetail.id);
      dispatch({
        type: 'SET_APP_ALERT',
        payload: { id: nanoid(), tone: 'info', message: t('feedback.admin.deleteSuccess') },
      });
      await loadReports({ forceSelectFirst: true });
    } catch (error: any) {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: { id: nanoid(), tone: 'error', message: error?.message || t('feedback.admin.deleteError') },
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/65 backdrop-blur-sm animate-fade-in">
      <div className="h-full w-full bg-background/95">
        <div className="h-16 border-b border-border px-4 lg:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-accent" />
            <h2 className="text-base lg:text-lg font-bold text-foreground">{t('feedback.admin.title')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadReports()}
              className="h-9 px-3 rounded-lg border border-border text-foreground hover:bg-surface-sunken transition-colors flex items-center gap-2"
            >
              <RefreshCw size={14} />
              <span className="text-sm">{t('feedback.admin.refresh')}</span>
            </button>
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-full border border-border text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors"
            >
              <XCircle size={16} className="mx-auto" />
            </button>
          </div>
        </div>

        {!isAdmin ? (
          <div className="h-[calc(100%-4rem)] flex items-center justify-center text-center px-4">
            <div>
              <p className="text-lg font-bold text-foreground">{t('feedback.admin.noAccessTitle')}</p>
              <p className="text-sm text-foreground-muted mt-2">{t('feedback.admin.noAccessBody')}</p>
            </div>
          </div>
        ) : (
          <div className="h-[calc(100%-4rem)] grid grid-cols-1 lg:grid-cols-[380px_1fr]">
            <div className="border-r border-border p-4 flex flex-col gap-3 overflow-hidden">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as FeedbackReportStatus | '')}
                  className="h-9 px-2 rounded-lg border border-border bg-surface-elevated text-sm"
                >
                  <option value="">{t('feedback.admin.allStatuses')}</option>
                  {STATUS_OPTIONS.map((value) => (
                    <option key={value} value={value}>{t(`feedback.status.${value}`)}</option>
                  ))}
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as FeedbackReportPriority | '')}
                  className="h-9 px-2 rounded-lg border border-border bg-surface-elevated text-sm"
                >
                  <option value="">{t('feedback.admin.allPriorities')}</option>
                  {PRIORITY_OPTIONS.map((value) => (
                    <option key={value} value={value}>{t(`feedback.priority.${value}`)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-[1fr_120px] gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('feedback.admin.searchPlaceholder')}
                  className="h-9 px-3 rounded-lg border border-border bg-surface-elevated text-sm"
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as FeedbackReportCategory | '')}
                  className="h-9 px-2 rounded-lg border border-border bg-surface-elevated text-sm"
                >
                  <option value="">{t('feedback.admin.allCategories')}</option>
                  {CATEGORY_OPTIONS.filter(Boolean).map((value) => (
                    <option key={value} value={value}>{t(`feedback.category.${value}`)}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => loadReports()}
                className="h-9 px-3 rounded-lg bg-foreground text-background text-sm font-semibold"
              >
                {t('feedback.admin.applyFilters')}
              </button>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {isLoading ? (
                  <div className="py-8 flex items-center justify-center"><Loader2 className="animate-spin" size={18} /></div>
                ) : reports.length === 0 ? (
                  <div className="text-sm text-foreground-muted py-8 text-center">{t('feedback.admin.noReports')}</div>
                ) : (
                  <div className="space-y-2">
                    {reports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => setSelectedReportId(report.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          report.id === selectedReportId
                            ? 'border-foreground bg-surface-elevated'
                            : 'border-border bg-surface hover:bg-surface-elevated'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs uppercase tracking-wider text-foreground-muted">{t(`feedback.status.${report.status}`)}</span>
                          <span className="text-[11px] text-foreground-muted">{new Date(report.created_at).toLocaleString()}</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-foreground line-clamp-2">{report.title}</p>
                        <div className="mt-2 text-[11px] text-foreground-muted flex items-center justify-between gap-2">
                          <span>{report.reporter_email}</span>
                          <span>{getModeLabel(report.mode)}</span>
                          <span>{t(`feedback.priority.${report.priority}`)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 lg:p-6 overflow-y-auto custom-scrollbar">
              {!selectedReportId ? (
                <div className="h-full flex items-center justify-center text-foreground-muted">{t('feedback.admin.selectReport')}</div>
              ) : isDetailLoading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" size={22} /></div>
              ) : !selectedDetail ? (
                <div className="h-full flex items-center justify-center text-foreground-muted">{t('feedback.admin.detailUnavailable')}</div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <label className="text-sm space-y-1">
                      <span className="text-foreground-muted">{t('feedback.admin.status')}</span>
                      <select
                        value={selectedDetail.status}
                        onChange={(e) => setSelectedDetail((prev) => prev ? { ...prev, status: e.target.value as FeedbackReportStatus } : prev)}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-surface-elevated"
                      >
                        {STATUS_OPTIONS.map((value) => (
                          <option key={value} value={value}>{t(`feedback.status.${value}`)}</option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm space-y-1">
                      <span className="text-foreground-muted">{t('feedback.admin.priority')}</span>
                      <select
                        value={selectedDetail.priority}
                        onChange={(e) => setSelectedDetail((prev) => prev ? { ...prev, priority: e.target.value as FeedbackReportPriority } : prev)}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-surface-elevated"
                      >
                        {PRIORITY_OPTIONS.map((value) => (
                          <option key={value} value={value}>{t(`feedback.priority.${value}`)}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="rounded-xl border border-border p-4 space-y-2 bg-surface">
                    <h3 className="text-lg font-semibold text-foreground">{selectedDetail.title}</h3>
                    <p className="text-sm text-foreground-secondary whitespace-pre-wrap">{selectedDetail.description}</p>
                    {!!selectedDetail.reproduction_steps && (
                      <div>
                        <p className="text-xs uppercase text-foreground-muted mb-1">{t('feedback.stepsLabel')}</p>
                        <p className="text-sm text-foreground-secondary whitespace-pre-wrap">{selectedDetail.reproduction_steps}</p>
                      </div>
                    )}
                    {!!selectedDetail.expected_behavior && (
                      <div>
                        <p className="text-xs uppercase text-foreground-muted mb-1">{t('feedback.expectedLabel')}</p>
                        <p className="text-sm text-foreground-secondary whitespace-pre-wrap">{selectedDetail.expected_behavior}</p>
                      </div>
                    )}
                    <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-foreground-muted">
                      <span>{t('feedback.admin.reporter')}: {selectedDetail.reporter_email}</span>
                      <span>{t('feedback.admin.feature')}: {getFeatureLabel(selectedDetail)}</span>
                      <span>{t('feedback.admin.mode')}: {selectedDetail.mode || '-'}</span>
                      <span>{t('feedback.admin.project')}: {selectedDetail.project_name || '-'}</span>
                      <span>{t('feedback.admin.historyCount')}: {selectedDetail.history_count ?? 0}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border p-4 bg-surface space-y-3">
                    <p className="text-sm font-semibold text-foreground">{t('feedback.admin.imageMarkupTitle')}</p>
                    {isSnapshotLoading ? (
                      <div className="h-20 flex items-center justify-center"><Loader2 size={18} className="animate-spin" /></div>
                    ) : annotationViews.length === 0 && documentAttachments.length === 0 ? (
                      <p className="text-sm text-foreground-muted">{t('feedback.admin.mediaMarkupEmpty')}</p>
                    ) : (
                      <div className="space-y-4 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
                        {documentAttachments.map((item) => (
                          <div key={item.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-foreground truncate" title={item.name}>{item.name}</span>
                              <span className="text-[11px] text-foreground-muted">
                                {item.kind === 'original' ? t('feedback.documentOriginal') : t('feedback.documentTranslated')}
                              </span>
                            </div>
                            <div className="rounded-md border border-border-subtle bg-surface h-[140px] flex flex-col items-center justify-center gap-2">
                              <FileText size={22} className="text-foreground-muted" />
                              <span className="text-[11px] text-foreground-muted uppercase tracking-wide">
                                {(item.mimeType.split('/')[1] || 'file').toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-foreground-muted gap-2">
                              <span>{formatFileSize(item.size)}</span>
                              <span className="truncate" title={item.mimeType}>{item.mimeType}</span>
                            </div>
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
                        {annotationViews.map((item) => (
                          <div key={item.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-foreground truncate" title={item.label}>{item.label}</span>
                              {!!item.mode && (
                                <span className="text-[11px] text-foreground-muted">{getModeLabel(item.mode)}</span>
                              )}
                            </div>
                            {item.imageUrl ? (
                              <FeedbackImageMarkupCanvas
                                imageUrl={item.imageUrl}
                                markups={item.markups}
                                readOnly
                              />
                            ) : (
                              <p className="text-xs text-foreground-muted">{t('feedback.admin.imageMarkupImageMissing')}</p>
                            )}
                            <div className="flex items-center justify-between text-[11px] text-foreground-muted gap-2">
                              <span>{t('feedback.imageMarkupCount', { count: item.markups.length })}</span>
                              {!!item.timestamp && <span>{new Date(item.timestamp).toLocaleString()}</span>}
                            </div>
                            {!!item.note && (
                              <div className="rounded-md border border-border bg-surface px-2.5 py-2">
                                <p className="text-xs text-foreground-muted mb-1">{t('feedback.imageSpecificFeedback')}</p>
                                <p className="text-sm text-foreground-secondary whitespace-pre-wrap">{item.note}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border p-4 bg-surface space-y-3">
                    <p className="text-sm font-semibold text-foreground">{t('feedback.admin.internalNote')}</p>
                    <textarea
                      value={updateNote}
                      onChange={(e) => setUpdateNote(e.target.value)}
                      placeholder={t('feedback.admin.internalNotePlaceholder')}
                      className="w-full min-h-[90px] px-3 py-2 rounded-lg border border-border bg-surface-elevated"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-10 px-4 rounded-lg bg-foreground text-background text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSaving && <Loader2 size={14} className="animate-spin" />}
                        {t('common.save')}
                      </button>
                      <button
                        onClick={handleDownloadSnapshot}
                        className="h-10 px-4 rounded-lg border border-border text-sm hover:bg-surface-elevated"
                      >
                        {t('feedback.admin.downloadSnapshot')}
                      </button>
                      <button
                        onClick={handleOpenSnapshotInApp}
                        disabled={isOpeningSnapshot}
                        className="h-10 px-4 rounded-lg border border-border text-sm hover:bg-surface-elevated disabled:opacity-50 flex items-center gap-2"
                      >
                        {isOpeningSnapshot ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
                        {t('feedback.admin.openSnapshotInApp')}
                      </button>
                      <button
                        onClick={handleDeleteReport}
                        disabled={isDeleting}
                        className="h-10 px-4 rounded-lg border border-red-200 text-red-700 text-sm hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        {t('feedback.admin.deleteReport')}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border p-4 bg-surface space-y-3">
                    <p className="text-sm font-semibold text-foreground">{t('feedback.admin.timeline')}</p>
                    <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                      {activity.length === 0 ? (
                        <p className="text-sm text-foreground-muted">{t('feedback.admin.noActivity')}</p>
                      ) : (
                        activity.map((item) => (
                          <div key={item.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-2.5">
                            <div className="text-[11px] text-foreground-muted flex justify-between gap-2">
                              <span>{item.actor_email}</span>
                              <span>{new Date(item.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{item.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t('feedback.admin.commentPlaceholder')}
                        className="flex-1 min-h-[70px] px-3 py-2 rounded-lg border border-border bg-surface-elevated"
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={!comment.trim() || isCommenting}
                        className="h-10 self-end px-4 rounded-lg bg-foreground text-background text-sm font-semibold disabled:opacity-50"
                      >
                        {isCommenting ? <Loader2 size={14} className="animate-spin" /> : t('feedback.admin.addComment')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
