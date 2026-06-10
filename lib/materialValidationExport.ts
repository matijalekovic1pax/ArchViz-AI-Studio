import type { MaterialValidationState } from '../types';
import { downloadFile } from './download';

const countBySeverity = (issues: MaterialValidationState['issues']) =>
  issues.reduce<Record<string, number>>((counts, issue) => {
    counts[issue.severity] = (counts[issue.severity] || 0) + 1;
    return counts;
  }, {});

const safeReportTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export const buildMaterialValidationReport = (materialValidation: MaterialValidationState) => ({
  exportedAt: new Date().toISOString(),
  summary: {
    documents: materialValidation.documents.length,
    materials: materialValidation.materials.length,
    boqItems: materialValidation.boqItems.length,
    issues: materialValidation.issues.length,
    issueSeverityCounts: countBySeverity(materialValidation.issues),
    stats: materialValidation.stats,
    lastRunAt: materialValidation.lastRunAt ? new Date(materialValidation.lastRunAt).toISOString() : null,
    aiSummary: materialValidation.aiSummary,
    error: materialValidation.error || null,
  },
  enabledChecks: materialValidation.checks,
  documents: materialValidation.documents.map((document) => ({
    id: document.id,
    name: document.name,
    mimeType: document.mimeType,
    size: document.size,
    uploadedAt: new Date(document.uploadedAt).toISOString(),
  })),
  materials: materialValidation.materials,
  boqItems: materialValidation.boqItems,
  issues: materialValidation.issues,
});

export const downloadMaterialValidationReport = async (
  materialValidation: MaterialValidationState,
  filename = `material-validation-report-${safeReportTimestamp()}.json`
) => {
  const report = buildMaterialValidationReport(materialValidation);
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  try {
    await downloadFile(url, filename);
  } finally {
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1500);
  }
};
