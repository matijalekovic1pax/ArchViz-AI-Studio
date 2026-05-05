import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Loader2, RefreshCw, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthGate';
import { useAppStore } from '../../store';
import { feedbackService } from '../../services/feedbackService';
import type {
  AppState,
  FeedbackReportCategory,
  FeedbackReportDetail,
  FeedbackReportPriority,
  FeedbackReportStatus,
  FeedbackReportSummary,
} from '../../types';

interface FeedbackAdminDashboardProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS: FeedbackReportStatus[] = ['new', 'triaged', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS: FeedbackReportPriority[] = ['low', 'normal', 'high', 'urgent'];
const CATEGORY_OPTIONS: Array<FeedbackReportCategory | ''> = ['', 'bug', 'quality', 'ux', 'performance', 'feature_request', 'other'];

const ADMIN_EMAIL = 'matija.lekovic@1pax.com';

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
  const [comment, setComment] = useState('');
  const [updateNote, setUpdateNote] = useState('');

  const [statusFilter, setStatusFilter] = useState<FeedbackReportStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<FeedbackReportPriority | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<FeedbackReportCategory | ''>('');
  const [search, setSearch] = useState('');

  const isAdmin = (user?.email || '').toLowerCase() === ADMIN_EMAIL;

  const selectedSummary = useMemo(
    () => reports.find((item) => item.id === selectedReportId) || null,
    [reports, selectedReportId]
  );

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
    try {
      const detail = await feedbackService.get(reportId);
      setSelectedDetail(detail.report);
      setActivity(detail.activity || []);
      setUpdateNote('');
      setComment('');
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
      const result = await feedbackService.getSnapshot(selectedDetail.id);
      const projectState = extractProjectStateFromSnapshot(result.snapshot);
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
                      <span>{t('feedback.admin.mode')}: {selectedDetail.mode || '-'}</span>
                      <span>{t('feedback.admin.project')}: {selectedDetail.project_name || '-'}</span>
                      <span>{t('feedback.admin.historyCount')}: {selectedDetail.history_count ?? 0}</span>
                    </div>
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
