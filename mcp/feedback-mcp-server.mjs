#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';

const FEEDBACK_STATUSES = ['new', 'triaged', 'in_progress', 'resolved', 'closed'];
const FEEDBACK_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const FEEDBACK_CATEGORIES = ['bug', 'quality', 'ux', 'performance', 'feature_request', 'other'];

const REPORT_SUMMARY_SELECT =
  'id,created_at,updated_at,last_activity_at,reporter_email,reporter_name,status,priority,category,title,mode,project_name,history_count,snapshot_size_bytes,snapshot_storage_path,metadata';

const REPORT_DETAIL_SELECT =
  'id,created_at,updated_at,last_activity_at,reporter_email,reporter_name,reporter_picture,status,priority,category,title,description,reproduction_steps,expected_behavior,mode,app_version,user_agent,project_name,history_count,snapshot_version,snapshot_hash,snapshot_size_bytes,snapshot_storage_path,resolved_at,resolved_by,metadata';

const ACTIVITY_SELECT =
  'id,created_at,actor_email,actor_name,kind,message,from_status,to_status,from_priority,to_priority,metadata';

const DEFAULT_ACTOR_EMAIL = process.env.FEEDBACK_MCP_ACTOR_EMAIL || 'matija.lekovic@1pax.com';
const DEFAULT_ACTOR_NAME = process.env.FEEDBACK_MCP_ACTOR_NAME || 'Feedback MCP';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] != null) continue;
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value.replace(/\\n/g, '\n');
  }
}

function normalizeBaseUrl(value) {
  if (!value || typeof value !== 'string') return null;
  return value.replace(/\/+$/, '');
}

function jsonText(value) {
  return JSON.stringify(value, null, 2);
}

function toolResult(payload) {
  return {
    content: [{ type: 'text', text: jsonText(payload) }],
  };
}

function toolError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: 'text', text: `Error: ${message}` }],
  };
}

function stripPreviewData(imageFeedback, includePreviewData = false) {
  if (!Array.isArray(imageFeedback)) return [];

  return imageFeedback.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const previewDataUrl = typeof item.previewDataUrl === 'string' ? item.previewDataUrl : null;
    if (includePreviewData || !previewDataUrl) return item;

    return {
      ...item,
      previewDataUrl: undefined,
      previewDataUrlBytes: previewDataUrl.length,
    };
  });
}

function withParsedImageFeedback(report, includePreviewData = false) {
  if (!report || typeof report !== 'object') return report;
  const metadata = report.metadata && typeof report.metadata === 'object' ? report.metadata : {};
  const imageFeedback = stripPreviewData(metadata.imageFeedback, includePreviewData);

  return {
    ...report,
    metadata: {
      ...metadata,
      imageFeedback,
    },
  };
}

function clampInt(value, min, max, fallback) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(raw)));
}

async function readJsonResponse(response, contextLabel) {
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!response.ok) {
    const errText =
      data && typeof data === 'object'
        ? data.error || data.message || jsonText(data)
        : String(data || response.statusText || 'Unknown error');
    throw new Error(`${contextLabel} failed (${response.status}): ${String(errText).slice(0, 800)}`);
  }

  return data;
}

class GatewayFeedbackBackend {
  constructor(baseUrl, token, actorEmail, actorName) {
    this.mode = 'gateway';
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = token;
    this.actorEmail = actorEmail;
    this.actorName = actorName;
  }

  async request(pathName, { method = 'GET', body, headers = {} } = {}) {
    const endpoint = `${this.baseUrl}${pathName}`;
    const nextHeaders = new Headers(headers);
    nextHeaders.set('Authorization', `Bearer ${this.token}`);
    if (body != null && !nextHeaders.has('Content-Type')) {
      nextHeaders.set('Content-Type', 'application/json');
    }

    const response = await fetch(endpoint, {
      method,
      headers: nextHeaders,
      body: body != null ? JSON.stringify(body) : undefined,
    });

    return readJsonResponse(response, `Gateway request ${pathName}`);
  }

  async listReports(params = {}) {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    if (params.status) qs.set('status', params.status);
    if (params.priority) qs.set('priority', params.priority);
    if (params.category) qs.set('category', params.category);
    if (params.mode) qs.set('mode', params.mode);
    if (params.search) qs.set('search', params.search);
    if (params.reporterEmail) qs.set('reporterEmail', params.reporterEmail);
    const pathName = qs.toString() ? `/api/feedback/reports?${qs.toString()}` : '/api/feedback/reports';
    return this.request(pathName);
  }

  async getReport(reportId) {
    return this.request(`/api/feedback/reports/${encodeURIComponent(reportId)}`);
  }

  async getSnapshot(reportId) {
    return this.request(`/api/feedback/reports/${encodeURIComponent(reportId)}/snapshot`);
  }

  async updateReport(reportId, payload) {
    return this.request(`/api/feedback/reports/${encodeURIComponent(reportId)}`, {
      method: 'PATCH',
      body: payload,
    });
  }

  async addActivity(reportId, payload) {
    return this.request(`/api/feedback/reports/${encodeURIComponent(reportId)}/activity`, {
      method: 'POST',
      body: payload,
    });
  }

  async deleteReport(reportId) {
    return this.request(`/api/feedback/reports/${encodeURIComponent(reportId)}`, {
      method: 'DELETE',
    });
  }
}

class SupabaseFeedbackBackend {
  constructor(baseUrl, serviceRoleKey, actorEmail, actorName) {
    this.mode = 'supabase';
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.serviceRoleKey = serviceRoleKey;
    this.actorEmail = actorEmail;
    this.actorName = actorName;
  }

  async fetch(pathName, { method = 'GET', body, headers = {} } = {}) {
    const endpoint = `${this.baseUrl}${pathName}`;
    const nextHeaders = new Headers(headers);
    nextHeaders.set('apikey', this.serviceRoleKey);
    nextHeaders.set('Authorization', `Bearer ${this.serviceRoleKey}`);
    if (body != null && !nextHeaders.has('Content-Type')) {
      nextHeaders.set('Content-Type', 'application/json');
    }

    const response = await fetch(endpoint, {
      method,
      headers: nextHeaders,
      body: body != null ? JSON.stringify(body) : undefined,
    });

    return readJsonResponse(response, `Supabase request ${pathName}`);
  }

  async touchReport(reportId) {
    await this.fetch(`/rest/v1/feedback_reports?id=eq.${encodeURIComponent(reportId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: { last_activity_at: new Date().toISOString() },
    });
  }

  async listReports(params = {}) {
    const qs = new URLSearchParams();
    qs.set('select', REPORT_SUMMARY_SELECT);
    qs.set('order', `created_at.${params.order === 'oldest' ? 'asc' : 'desc'}`);
    qs.set('limit', String(clampInt(params.limit, 1, 100, 25)));
    qs.set('offset', String(clampInt(params.offset, 0, 10000, 0)));

    if (params.status) qs.set('status', `eq.${params.status}`);
    if (params.priority) qs.set('priority', `eq.${params.priority}`);
    if (params.category) qs.set('category', `eq.${params.category}`);
    if (params.mode) qs.set('mode', `eq.${params.mode}`);
    if (params.reporterEmail) qs.set('reporter_email', `eq.${params.reporterEmail}`);
    if (params.search) {
      const safeSearch = String(params.search).replace(/[*,]/g, '').trim();
      if (safeSearch) {
        qs.set('or', `(title.ilike.*${safeSearch}*,description.ilike.*${safeSearch}*,reporter_email.ilike.*${safeSearch}*)`);
      }
    }

    const reports = await this.fetch(`/rest/v1/feedback_reports?${qs.toString()}`, {
      headers: { Prefer: 'count=exact' },
    });

    return {
      success: true,
      reports: Array.isArray(reports) ? reports : [],
    };
  }

  async getReport(reportId) {
    const reportRows = await this.fetch(
      `/rest/v1/feedback_reports?select=${encodeURIComponent(REPORT_DETAIL_SELECT)}&id=eq.${encodeURIComponent(reportId)}&limit=1`
    );
    if (!Array.isArray(reportRows) || reportRows.length === 0) {
      throw new Error('Report not found.');
    }

    const activityRows = await this.fetch(
      `/rest/v1/feedback_activity?select=${encodeURIComponent(ACTIVITY_SELECT)}&report_id=eq.${encodeURIComponent(reportId)}&order=created_at.asc`
    );

    return {
      success: true,
      report: reportRows[0],
      activity: Array.isArray(activityRows) ? activityRows : [],
    };
  }

  async getSnapshot(reportId) {
    const rows = await this.fetch(
      `/rest/v1/feedback_reports?select=id,snapshot_json,snapshot_storage_path,snapshot_hash,snapshot_size_bytes,snapshot_version&id=eq.${encodeURIComponent(reportId)}&limit=1`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Report not found.');
    }

    const report = rows[0];
    if (report.snapshot_json) {
      return {
        success: true,
        source: 'inline',
        snapshot: report.snapshot_json,
        snapshotHash: report.snapshot_hash,
        snapshotSizeBytes: report.snapshot_size_bytes,
        snapshotVersion: report.snapshot_version,
      };
    }

    if (!report.snapshot_storage_path) {
      throw new Error('No snapshot found for this report.');
    }

    const [bucket, ...rest] = String(report.snapshot_storage_path).split('/');
    const objectPath = rest.join('/');
    if (!bucket || !objectPath) {
      throw new Error('Invalid snapshot storage path.');
    }

    const encodedPath = objectPath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    const snapshot = await this.fetch(
      `/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`,
      { headers: { Accept: 'application/json' } }
    );

    return {
      success: true,
      source: 'storage',
      snapshot,
      snapshotHash: report.snapshot_hash,
      snapshotSizeBytes: report.snapshot_size_bytes,
      snapshotVersion: report.snapshot_version,
    };
  }

  async updateReport(reportId, payload) {
    const rows = await this.fetch(
      `/rest/v1/feedback_reports?select=id,status,priority&id=eq.${encodeURIComponent(reportId)}&limit=1`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Report not found.');
    }

    const current = rows[0];
    const nextStatus = payload.status || null;
    const nextPriority = payload.priority || null;
    const note = payload.note ? String(payload.note).trim() : '';

    if (!nextStatus && !nextPriority && !note) {
      throw new Error('No update fields provided.');
    }

    const updatePayload = { last_activity_at: new Date().toISOString() };
    if (nextStatus) updatePayload.status = nextStatus;
    if (nextPriority) updatePayload.priority = nextPriority;

    const statusAfter = nextStatus || current.status;
    if (statusAfter === 'resolved' || statusAfter === 'closed') {
      updatePayload.resolved_at = new Date().toISOString();
      updatePayload.resolved_by = this.actorEmail;
    } else if (current.status === 'resolved' || current.status === 'closed') {
      updatePayload.resolved_at = null;
      updatePayload.resolved_by = null;
    }

    const updatedRows = await this.fetch(
      `/rest/v1/feedback_reports?id=eq.${encodeURIComponent(reportId)}&select=${encodeURIComponent(REPORT_SUMMARY_SELECT)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: updatePayload,
      }
    );

    if (nextStatus && nextStatus !== current.status) {
      await this.addActivity(reportId, {
        message: `Status changed from ${current.status} to ${nextStatus}.`,
        kind: 'status_changed',
        fromStatus: current.status,
        toStatus: nextStatus,
      });
    }

    if (nextPriority && nextPriority !== current.priority) {
      await this.addActivity(reportId, {
        message: `Priority changed from ${current.priority} to ${nextPriority}.`,
        kind: 'priority_changed',
        fromPriority: current.priority,
        toPriority: nextPriority,
      });
    }

    if (note) {
      await this.addActivity(reportId, {
        message: note,
        kind: 'comment',
        metadata: { source: 'feedback_mcp', kind: 'admin_note' },
      });
    }

    return {
      success: true,
      report: Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] : null,
    };
  }

  async addActivity(reportId, payload) {
    const kind = payload.kind || 'comment';
    const rows = await this.fetch(
      `/rest/v1/feedback_activity?select=${encodeURIComponent(ACTIVITY_SELECT)}`,
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: {
          report_id: reportId,
          actor_email: this.actorEmail,
          actor_name: this.actorName,
          kind,
          message: String(payload.message || '').slice(0, 12000),
          from_status: payload.fromStatus || null,
          to_status: payload.toStatus || null,
          from_priority: payload.fromPriority || null,
          to_priority: payload.toPriority || null,
          metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
        },
      }
    );

    await this.touchReport(reportId);

    return {
      success: true,
      activity: Array.isArray(rows) && rows.length > 0 ? rows[0] : null,
    };
  }

  async deleteReport(reportId) {
    const rows = await this.fetch(
      `/rest/v1/feedback_reports?select=id,snapshot_storage_path&id=eq.${encodeURIComponent(reportId)}&limit=1`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Report not found.');
    }

    const report = rows[0];
    let deletedSnapshotStorage = false;

    await this.fetch(`/rest/v1/feedback_reports?id=eq.${encodeURIComponent(reportId)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });

    if (report.snapshot_storage_path) {
      const [bucket, ...rest] = String(report.snapshot_storage_path).split('/');
      const objectPath = rest.join('/');
      if (bucket && objectPath) {
        const encodedPath = objectPath
          .split('/')
          .map((segment) => encodeURIComponent(segment))
          .join('/');
        try {
          await this.fetch(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
            method: 'DELETE',
          });
          deletedSnapshotStorage = true;
        } catch {
          deletedSnapshotStorage = false;
        }
      }
    }

    return {
      success: true,
      reportId,
      deletedSnapshotStorage,
    };
  }
}

function createBackend() {
  loadEnvFile(path.join(process.cwd(), '.env.feedback-mcp'));
  loadEnvFile(path.join(process.cwd(), '.env.local'));

  const mode = String(process.env.FEEDBACK_MCP_BACKEND || 'auto').trim().toLowerCase();
  const actorEmail = process.env.FEEDBACK_MCP_ACTOR_EMAIL || DEFAULT_ACTOR_EMAIL;
  const actorName = process.env.FEEDBACK_MCP_ACTOR_NAME || DEFAULT_ACTOR_NAME;

  const supabaseUrl = normalizeBaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || null;

  const gatewayBaseUrl = normalizeBaseUrl(process.env.FEEDBACK_API_BASE_URL || process.env.VITE_API_GATEWAY_URL);
  const gatewayToken = process.env.FEEDBACK_API_TOKEN || null;

  if ((mode === 'auto' || mode === 'supabase') && supabaseUrl && supabaseServiceRoleKey) {
    return new SupabaseFeedbackBackend(supabaseUrl, supabaseServiceRoleKey, actorEmail, actorName);
  }

  if ((mode === 'auto' || mode === 'gateway') && gatewayBaseUrl && gatewayToken) {
    return new GatewayFeedbackBackend(gatewayBaseUrl, gatewayToken, actorEmail, actorName);
  }

  throw new Error(
    [
      'Feedback MCP is not configured.',
      'Provide either:',
      '- SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (recommended), or',
      '- FEEDBACK_API_BASE_URL + FEEDBACK_API_TOKEN.',
      'You can place these in .env.feedback-mcp.',
    ].join(' ')
  );
}

const backend = createBackend();

const mcp = new McpServer({
  name: 'archviz-feedback-dashboard',
  version: '1.0.0',
});

mcp.registerTool(
  'feedback_healthcheck',
  {
    description: 'Validate MCP connectivity to the feedback backend and return active backend mode.',
  },
  async () => {
    try {
      const list = await backend.listReports({ limit: 1, offset: 0 });
      return toolResult({
        ok: true,
        backendMode: backend.mode,
        actorEmail: backend.actorEmail,
        actorName: backend.actorName,
        reportCountPreview: Array.isArray(list?.reports) ? list.reports.length : 0,
      });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'feedback_list_reports',
  {
    description:
      'List feedback reports with optional filters. Use this first to discover report IDs and statuses.',
    inputSchema: {
      status: z.enum(FEEDBACK_STATUSES).optional(),
      priority: z.enum(FEEDBACK_PRIORITIES).optional(),
      category: z.enum(FEEDBACK_CATEGORIES).optional(),
      mode: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).max(10000).optional(),
      order: z.enum(['newest', 'oldest']).optional(),
    },
  },
  async (args) => {
    try {
      const result = await backend.listReports({
        status: args.status,
        priority: args.priority,
        category: args.category,
        mode: args.mode,
        search: args.search,
        limit: clampInt(args.limit, 1, 100, 25),
        offset: clampInt(args.offset, 0, 10000, 0),
        order: args.order === 'oldest' ? 'oldest' : 'newest',
      });

      const reports = (result.reports || []).map((report) => {
        const metadata = report?.metadata && typeof report.metadata === 'object' ? report.metadata : {};
        return {
          ...report,
          metadata: undefined,
          reportedFeatureKey: metadata.reportedFeatureKey || null,
          reportedFeatureLabel: metadata.reportedFeatureLabel || null,
          imageFeedbackCount: Array.isArray(metadata.imageFeedback) ? metadata.imageFeedback.length : 0,
        };
      });

      return toolResult({
        success: true,
        backendMode: backend.mode,
        count: reports.length,
        reports,
      });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'feedback_claim_next_report',
  {
    description:
      'Claim the next report one-by-one. Picks the oldest report in a source status and moves it to a target status.',
    inputSchema: {
      fromStatus: z.enum(FEEDBACK_STATUSES).optional(),
      toStatus: z.enum(FEEDBACK_STATUSES).optional(),
      addClaimComment: z.boolean().optional(),
    },
  },
  async (args) => {
    try {
      const fromStatus = args.fromStatus || 'new';
      const toStatus = args.toStatus || 'in_progress';
      const addClaimComment = args.addClaimComment !== false;

      const listed = await backend.listReports({
        status: fromStatus,
        limit: 100,
        offset: 0,
        order: 'oldest',
      });

      const candidates = Array.isArray(listed.reports) ? listed.reports : [];
      if (candidates.length === 0) {
        return toolResult({
          success: true,
          claimed: false,
          message: `No reports found with status "${fromStatus}".`,
        });
      }

      const nextReport = [...candidates].sort((a, b) => {
        const aa = new Date(a.created_at || 0).getTime();
        const bb = new Date(b.created_at || 0).getTime();
        return aa - bb;
      })[0];

      await backend.updateReport(nextReport.id, { status: toStatus });

      if (addClaimComment) {
        await backend.addActivity(nextReport.id, {
          message: `Claimed via Feedback MCP by ${backend.actorEmail}.`,
          metadata: {
            source: 'feedback_mcp',
            action: 'claim_next_report',
            fromStatus,
            toStatus,
          },
        });
      }

      const detail = await backend.getReport(nextReport.id);
      return toolResult({
        success: true,
        claimed: true,
        report: withParsedImageFeedback(detail.report, false),
        activity: detail.activity || [],
      });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'feedback_get_report_detail',
  {
    description:
      'Get full report details and activity timeline for a single feedback report. Optionally include preview image data.',
    inputSchema: {
      reportId: z.string().describe('Feedback report UUID'),
      includeActivity: z.boolean().optional(),
      includePreviewData: z.boolean().optional(),
    },
  },
  async (args) => {
    try {
      const includePreviewData = args.includePreviewData === true;
      const includeActivity = args.includeActivity !== false;
      const detail = await backend.getReport(args.reportId);
      return toolResult({
        success: true,
        report: withParsedImageFeedback(detail.report, includePreviewData),
        activity: includeActivity ? detail.activity || [] : undefined,
      });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'feedback_get_report_snapshot',
  {
    description:
      'Get project snapshot JSON for a report. By default appState is omitted to keep payloads small.',
    inputSchema: {
      reportId: z.string().describe('Feedback report UUID'),
      includeAppState: z.boolean().optional(),
    },
  },
  async (args) => {
    try {
      const includeAppState = args.includeAppState === true;
      const snapshotResult = await backend.getSnapshot(args.reportId);
      const snapshot = snapshotResult.snapshot || null;

      if (!snapshot || typeof snapshot !== 'object') {
        return toolResult({
          success: true,
          source: snapshotResult.source,
          snapshotHash: snapshotResult.snapshotHash,
          snapshotSizeBytes: snapshotResult.snapshotSizeBytes,
          snapshotVersion: snapshotResult.snapshotVersion,
          snapshot: null,
        });
      }

      if (!includeAppState) {
        const trimmed = {
          ...snapshot,
          appState: undefined,
          appStateOmitted: true,
        };

        return toolResult({
          success: true,
          source: snapshotResult.source,
          snapshotHash: snapshotResult.snapshotHash,
          snapshotSizeBytes: snapshotResult.snapshotSizeBytes,
          snapshotVersion: snapshotResult.snapshotVersion,
          snapshot: trimmed,
        });
      }

      return toolResult({
        success: true,
        source: snapshotResult.source,
        snapshotHash: snapshotResult.snapshotHash,
        snapshotSizeBytes: snapshotResult.snapshotSizeBytes,
        snapshotVersion: snapshotResult.snapshotVersion,
        snapshot,
      });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'feedback_add_comment',
  {
    description: 'Append a comment/activity item to a feedback report.',
    inputSchema: {
      reportId: z.string().describe('Feedback report UUID'),
      message: z.string().min(1).describe('Comment text'),
    },
  },
  async (args) => {
    try {
      await backend.addActivity(args.reportId, {
        message: args.message,
        metadata: {
          source: 'feedback_mcp',
          action: 'comment',
        },
      });

      const detail = await backend.getReport(args.reportId);
      return toolResult({
        success: true,
        report: withParsedImageFeedback(detail.report, false),
        activity: detail.activity || [],
      });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'feedback_update_report',
  {
    description: 'Update report status and/or priority. Optionally attach an internal note.',
    inputSchema: {
      reportId: z.string().describe('Feedback report UUID'),
      status: z.enum(FEEDBACK_STATUSES).optional(),
      priority: z.enum(FEEDBACK_PRIORITIES).optional(),
      note: z.string().optional(),
    },
  },
  async (args) => {
    try {
      if (!args.status && !args.priority && !args.note) {
        throw new Error('Provide at least one of status, priority, or note.');
      }

      await backend.updateReport(args.reportId, {
        status: args.status,
        priority: args.priority,
        note: args.note,
      });

      const detail = await backend.getReport(args.reportId);
      return toolResult({
        success: true,
        report: withParsedImageFeedback(detail.report, false),
        activity: detail.activity || [],
      });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'feedback_resolve_report',
  {
    description:
      'Convenience action to resolve (or close) a report and optionally add a resolution comment.',
    inputSchema: {
      reportId: z.string().describe('Feedback report UUID'),
      closeInsteadOfResolve: z.boolean().optional(),
      resolutionNote: z.string().optional(),
    },
  },
  async (args) => {
    try {
      const status = args.closeInsteadOfResolve ? 'closed' : 'resolved';
      await backend.updateReport(args.reportId, { status });

      if (args.resolutionNote && args.resolutionNote.trim()) {
        await backend.addActivity(args.reportId, {
          message: args.resolutionNote.trim(),
          metadata: {
            source: 'feedback_mcp',
            action: 'resolution_note',
          },
        });
      }

      const detail = await backend.getReport(args.reportId);
      return toolResult({
        success: true,
        statusSet: status,
        report: withParsedImageFeedback(detail.report, false),
        activity: detail.activity || [],
      });
    } catch (error) {
      return toolError(error);
    }
  }
);

mcp.registerTool(
  'feedback_delete_report',
  {
    description: 'Delete a feedback report and its storage snapshot (if present).',
    inputSchema: {
      reportId: z.string().describe('Feedback report UUID'),
      reason: z.string().optional(),
    },
  },
  async (args) => {
    try {
      if (args.reason && args.reason.trim()) {
        try {
          await backend.addActivity(args.reportId, {
            message: `Pre-delete note: ${args.reason.trim()}`,
            metadata: {
              source: 'feedback_mcp',
              action: 'pre_delete_note',
            },
          });
        } catch {
          // Best effort note before delete.
        }
      }

      const result = await backend.deleteReport(args.reportId);
      return toolResult(result);
    } catch (error) {
      return toolError(error);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
  console.error(
    `Feedback MCP server running on stdio (backend=${backend.mode}, actor=${backend.actorEmail}).`
  );
}

main().catch((error) => {
  console.error('Feedback MCP server failed to start:', error);
  process.exit(1);
});
