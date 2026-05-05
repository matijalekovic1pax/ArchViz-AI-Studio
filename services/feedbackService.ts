import type {
  FeedbackActivityCreatePayload,
  FeedbackActivityCreateResult,
  FeedbackReportDeleteResult,
  FeedbackReportDetailResult,
  FeedbackReportListParams,
  FeedbackReportListResult,
  FeedbackReportUpdatePayload,
  FeedbackReportUpdateResult,
  FeedbackSnapshotResult,
  SubmitFeedbackReportPayload,
  SubmitFeedbackReportResult,
} from './apiGateway';
import {
  addFeedbackActivity,
  deleteFeedbackReport,
  getFeedbackReport,
  getFeedbackSnapshot,
  listFeedbackReports,
  submitFeedbackReport,
  updateFeedbackReport,
} from './apiGateway';

export const feedbackService = {
  submit: (payload: SubmitFeedbackReportPayload): Promise<SubmitFeedbackReportResult> =>
    submitFeedbackReport(payload),

  list: (params: FeedbackReportListParams = {}): Promise<FeedbackReportListResult> =>
    listFeedbackReports(params),

  get: (reportId: string): Promise<FeedbackReportDetailResult> =>
    getFeedbackReport(reportId),

  getSnapshot: (reportId: string): Promise<FeedbackSnapshotResult> =>
    getFeedbackSnapshot(reportId),

  update: (reportId: string, payload: FeedbackReportUpdatePayload): Promise<FeedbackReportUpdateResult> =>
    updateFeedbackReport(reportId, payload),

  addActivity: (reportId: string, payload: FeedbackActivityCreatePayload): Promise<FeedbackActivityCreateResult> =>
    addFeedbackActivity(reportId, payload),

  remove: (reportId: string): Promise<FeedbackReportDeleteResult> =>
    deleteFeedbackReport(reportId),
};
