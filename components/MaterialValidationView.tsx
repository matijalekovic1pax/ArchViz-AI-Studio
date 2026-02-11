
import React, { useState } from 'react';
import { useAppStore } from '../store';
import {
  Download, Search, ChevronDown,
  Check, XCircle, AlertTriangle, CheckCircle2, Loader2,
  Filter
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ParsedMaterial, ValidationIssue, BoQItem } from '../types';

// --- TYPES ---

interface ExtendedMaterial extends ParsedMaterial {
  status: 'ok' | 'warning' | 'error';
  checks: {
    typology: boolean;
    dimensions: 'ok' | 'warning' | 'error';
    application: boolean;
  };
  application: string;
}

// --- COMPONENTS ---

const StatusBadge = ({ status }: { status: 'ok' | 'warning' | 'error' | 'miss' }) => {
  if (status === 'error') return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 uppercase tracking-wide"><XCircle size={11} /> Error</span>;
  if (status === 'warning') return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-100 uppercase tracking-wide"><AlertTriangle size={11} /> Warn</span>;
  if (status === 'miss') return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 uppercase tracking-wide"><AlertTriangle size={11} /> Miss</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 uppercase tracking-wide"><CheckCircle2 size={11} /> OK</span>;
};

// --- TECHNICAL ROW ---

const TechnicalRow: React.FC<{
  material: ExtendedMaterial;
  issues: ValidationIssue[];
  expanded: boolean;
  onExpand: () => void;
}> = ({ material, issues, expanded, onExpand }) => {
  const primaryIssue = issues.length > 0 ? issues[0] : null;

  return (
    <>
      <tr
        onClick={onExpand}
        className={cn(
          "border-b border-border-subtle transition-colors cursor-pointer group hover:bg-surface-sunken/50",
          expanded && "bg-surface-sunken/30"
        )}
      >
        <td className="py-3 px-4 align-top w-[100px]">
          <span className="font-mono text-[11px] font-bold text-foreground-secondary bg-surface-sunken px-1.5 py-0.5 rounded border border-border-subtle">{material.code}</span>
        </td>
        <td className="py-3 px-4 align-top">
          <div className="font-medium text-xs text-foreground leading-tight">{material.name}</div>
          <div className="text-[11px] text-foreground-muted mt-0.5">
            <span className="font-semibold text-foreground-secondary">{material.referenceProduct.brand}</span>
            {material.referenceProduct.type && <> <span className="text-border-strong">·</span> {material.referenceProduct.type}</>}
          </div>
        </td>
        <td className="py-3 px-4 align-top w-[90px]">
          <StatusBadge status={material.status} />
        </td>
        <td className="py-3 px-4 align-top">
          {primaryIssue ? (
            <div className="text-[11px]">
              <div className={cn("font-bold", primaryIssue.severity === 'error' ? "text-red-700" : "text-yellow-700")}>
                {primaryIssue.message}
              </div>
              <div className="text-foreground-muted truncate max-w-[300px]">{primaryIssue.details}</div>
            </div>
          ) : (
            <span className="text-[11px] text-foreground-muted/40">—</span>
          )}
        </td>
        <td className="py-3 px-3 align-middle text-right w-10">
          <ChevronDown size={14} className={cn("text-foreground-muted transition-transform duration-200", expanded && "rotate-180")} />
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface-sunken/30 border-b border-border-subtle">
          <td colSpan={5} className="px-4 py-4 pl-[116px]">
            <div className="bg-background border border-border rounded-lg p-4 shadow-sm">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-2.5 bg-surface-sunken/50 rounded border border-border-subtle">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] uppercase font-bold text-foreground-muted">Typology</span>
                    {material.checks.typology ? <Check size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-500" />}
                  </div>
                  <div className="text-[11px] font-medium">{material.category} ({material.application})</div>
                </div>
                <div className="p-2.5 bg-surface-sunken/50 rounded border border-border-subtle">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] uppercase font-bold text-foreground-muted">Dimensions</span>
                    {material.checks.dimensions === 'ok' ? <Check size={12} className="text-green-500" /> : <AlertTriangle size={12} className="text-yellow-500" />}
                  </div>
                  <div className="text-[11px] font-medium">{material.dimensions || 'N/A'}</div>
                </div>
                <div className="p-2.5 bg-surface-sunken/50 rounded border border-border-subtle">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] uppercase font-bold text-foreground-muted">Application</span>
                    {material.checks.application ? <Check size={12} className="text-green-500" /> : <AlertTriangle size={12} className="text-yellow-500" />}
                  </div>
                  <div className="text-[11px] font-medium">{material.application}</div>
                </div>
              </div>

              {issues.length > 0 ? (
                <div className="space-y-2">
                  {issues.map((issue) => (
                    <div key={issue.id} className={cn("rounded border p-3", issue.severity === 'error' ? "bg-red-50/50 border-red-100" : "bg-yellow-50/50 border-yellow-100")}>
                      <div className="flex items-start gap-2">
                        <div className={cn("mt-0.5 shrink-0", issue.severity === 'error' ? "text-red-600" : "text-yellow-600")}>
                          {issue.severity === 'error' ? <XCircle size={14} /> : <AlertTriangle size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={cn("text-[11px] font-bold mb-0.5", issue.severity === 'error' ? "text-red-900" : "text-yellow-900")}>
                            {issue.message}
                          </h4>
                          <p className="text-[11px] text-foreground-secondary leading-relaxed">{issue.details}</p>
                          {issue.recommendation && (
                            <div className="text-[11px] bg-white/50 p-1.5 rounded border border-black/5 text-foreground-muted italic mt-1.5">
                              <span className="font-semibold not-italic">Recommendation:</span> {issue.recommendation}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3 text-[11px] text-foreground-muted bg-surface-sunken/30 rounded border border-dashed border-border-subtle">
                  No technical issues detected.
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// --- BOQ ROW ---

const BoQRow: React.FC<{
  material?: ExtendedMaterial;
  item?: any;
  issues: ValidationIssue[];
  expanded: boolean;
  onExpand: () => void;
}> = ({ material, item, issues, expanded, onExpand }) => {
  const hasIssues = issues.length > 0;
  let status: 'ok' | 'warning' | 'error' | 'miss' = 'ok';
  if (!item) status = 'miss';
  else if (issues.some(i => i.severity === 'error')) status = 'error';
  else if (issues.some(i => i.severity === 'warning')) status = 'warning';

  return (
    <>
      <tr
        onClick={onExpand}
        className={cn(
          "border-b border-border-subtle transition-colors cursor-pointer group hover:bg-surface-sunken/50",
          expanded && "bg-surface-sunken/30"
        )}
      >
        <td className="py-3 px-4 align-top w-[100px]">
          {material ? (
            <span className="font-mono text-[11px] font-bold text-foreground-secondary bg-surface-sunken px-1.5 py-0.5 rounded border border-border-subtle">{material.code}</span>
          ) : (
            <span className="text-[11px] text-foreground-muted italic">—</span>
          )}
        </td>
        <td className="py-3 px-4 align-top">
          {material ? (
            <div>
              <div className="font-medium text-xs text-foreground leading-tight">{material.name}</div>
              <div className="text-[11px] text-foreground-muted mt-0.5">{material.referenceProduct.brand}</div>
            </div>
          ) : (
            <div>
              <div className="font-medium text-xs text-foreground leading-tight">{item?.description || "Unknown Item"}</div>
              <div className="text-[11px] text-foreground-muted mt-0.5">{item?.product?.brand || "-"}</div>
            </div>
          )}
        </td>
        <td className="py-3 px-4 align-top w-[90px] font-mono text-[11px] text-foreground-secondary">
          {item?.code || "-"}
        </td>
        <td className="py-3 px-4 align-top w-[90px]">
          <StatusBadge status={status} />
        </td>
        <td className="py-3 px-4 align-top">
          {status === 'miss' ? (
            <div className="text-[11px] text-red-600 font-medium">Not found in BoQ</div>
          ) : hasIssues ? (
            <div className="text-[11px] text-yellow-700">{issues[0].message}</div>
          ) : (
            <span className="text-[11px] text-foreground-muted/40">—</span>
          )}
        </td>
        <td className="py-3 px-3 align-middle text-right w-10">
          <ChevronDown size={14} className={cn("text-foreground-muted transition-transform duration-200", expanded && "rotate-180")} />
        </td>
      </tr>

      {expanded && (
        <tr className="bg-surface-sunken/30 border-b border-border-subtle">
          <td colSpan={6} className="px-4 py-4 pl-[116px]">
            <div className="bg-background border border-border rounded-lg p-4 shadow-sm">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted mb-2">Cross-Reference Detail</h4>

              <div className="grid grid-cols-2 gap-px bg-border rounded border border-border overflow-hidden mb-3">
                <div className="bg-surface-sunken p-1.5 text-[10px] font-bold text-foreground-secondary text-center">Material Spec</div>
                <div className="bg-surface-sunken p-1.5 text-[10px] font-bold text-foreground-secondary text-center">BoQ Item {item?.code}</div>

                <div className="bg-white p-2.5 text-[11px] border-r border-border-subtle">
                  {material ? (
                    <div className="space-y-0.5">
                      <div className="font-bold">{material.name}</div>
                      <div className="text-foreground-muted">{material.dimensions}</div>
                    </div>
                  ) : <span className="text-foreground-muted italic">Missing</span>}
                </div>

                <div className="bg-white p-2.5 text-[11px]">
                  {item ? (
                    <div className="space-y-0.5">
                      <div className="font-bold">{item.description}</div>
                      <div className="text-foreground-muted">Qty: {typeof item.quantity === 'object' ? `${item.quantity.terminal || item.quantity.cargo || '—'} ${item.quantity.unit}` : item.quantity}</div>
                    </div>
                  ) : <span className="text-foreground-muted italic">Missing</span>}
                </div>
              </div>

              {hasIssues && (
                <div className="flex justify-end gap-2">
                  <button className="px-2.5 py-1 bg-white border border-border rounded text-[10px] font-medium hover:bg-surface-sunken transition-colors">Ignore</button>
                  <button className="px-2.5 py-1 bg-foreground text-background rounded text-[10px] font-medium hover:bg-foreground/90 transition-colors">Fix in BoQ</button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// --- MAIN VIEW ---

export const MaterialValidationView: React.FC = () => {
  const { state } = useAppStore();
  const [activeTab, setActiveTab] = useState<'technical' | 'boq'>('technical');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { materials, issues, boqItems, error } = state.materialValidation;
  const technicalIssueTypes = new Set<ValidationIssue['type']>(['technical', 'drawing', 'documentation']);
  const issuesByCode = new Map<string, ValidationIssue[]>();

  issues.forEach((issue) => {
    const code = issue.code?.trim();
    if (!code) return;
    const bucket = issuesByCode.get(code) || [];
    bucket.push(issue);
    issuesByCode.set(code, bucket);
  });

  const extendedMaterials: ExtendedMaterial[] = materials.map((material, index) => {
    const code = material.code?.trim() || `MAT-${index + 1}`;
    const materialIssues = (issuesByCode.get(code) || []).filter((issue) => technicalIssueTypes.has(issue.type));
    const status = materialIssues.some((issue) => issue.severity === 'error')
      ? 'error'
      : materialIssues.some((issue) => issue.severity === 'warning')
        ? 'warning'
        : 'ok';
    const application = material.application || material.description || material.name;
    return {
      ...material,
      code,
      status,
      application,
      checks: {
        typology: Boolean(material.category),
        dimensions: material.dimensions ? 'ok' as const : 'warning' as const,
        application: Boolean(application)
      }
    };
  });

  const totalItems = extendedMaterials.length;
  const errors = extendedMaterials.filter(m => m.status === 'error').length;
  const warnings = extendedMaterials.filter(m => m.status === 'warning').length;
  const passed = Math.max(totalItems - errors - warnings, 0);
  const score = totalItems > 0 ? Math.round((passed / totalItems) * 100) : 0;

  const filteredData = extendedMaterials.filter(m => {
    if (filterCategory !== 'All' && m.category !== filterCategory) return false;
    if (issuesOnly && m.status === 'ok') return false;
    if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase()) && !m.code.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getBoQData = () => {
    const materialMap = new Map(extendedMaterials.map((m) => [m.code, m]));
    const data: Array<{ type: 'material' | 'boq'; key: string; material: ExtendedMaterial | undefined; boqItem: BoQItem | undefined }> = filteredData.map(mat => ({
      type: 'material' as const,
      key: mat.code,
      material: mat as ExtendedMaterial | undefined,
      boqItem: boqItems.find(b => b.materialRef === mat.code)
    }));
    const searchLower = searchQuery.toLowerCase();
    const orphans = filterCategory === 'All'
      ? boqItems.filter((item) => {
          if (materialMap.has(item.materialRef)) return false;
          if (!searchLower) return true;
          return item.description.toLowerCase().includes(searchLower) || item.code.toLowerCase().includes(searchLower) || item.materialRef.toLowerCase().includes(searchLower);
        })
      : [];
    orphans.forEach((item) => {
      data.push({ type: 'boq' as const, key: `boq-${item.code}`, material: undefined, boqItem: item });
    });
    return data;
  };

  const boqData = getBoQData();

  // Column headers differ between tabs
  const technicalHeaders = [
    { label: 'Code', className: 'w-[100px]' },
    { label: 'Material Spec', className: '' },
    { label: 'Status', className: 'w-[90px]' },
    { label: 'Issues', className: '' },
    { label: '', className: 'w-10' },
  ];
  const boqHeaders = [
    { label: 'Code', className: 'w-[100px]' },
    { label: 'Material Spec', className: '' },
    { label: 'BoQ Ref', className: 'w-[90px]' },
    { label: 'Status', className: 'w-[90px]' },
    { label: 'Discrepancy', className: '' },
    { label: '', className: 'w-10' },
  ];
  const headers = activeTab === 'technical' ? technicalHeaders : boqHeaders;

  return (
    <div className="flex-1 bg-background flex flex-col h-full overflow-hidden">

      {/* HEADER */}
      <div className="bg-surface-elevated border-b border-border shadow-sm z-20 shrink-0">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-foreground whitespace-nowrap">Material Validation</h2>
            <div className="h-5 w-px bg-border-subtle hidden sm:block" />

            {/* Stats */}
            <div className="hidden sm:flex items-center gap-3 text-[10px] font-medium text-foreground-secondary">
              <span className="font-bold text-foreground text-xs">{score}%</span>
              <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /> {errors}</span>
              <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> {warnings}</span>
              <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> {passed}</span>
            </div>
          </div>

          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold border border-border rounded-lg hover:bg-surface-sunken transition-colors shrink-0">
            <Download size={12} /> Export
          </button>
        </div>

        {/* AI Summary (conditional) */}
        {(state.materialValidation.isRunning || state.materialValidation.aiSummary || error) && (
          <div className="px-4 py-2 border-t border-border-subtle bg-background/60">
            {state.materialValidation.isRunning && (
              <div className="text-[11px] text-foreground-muted flex items-center gap-2">
                <Loader2 size={11} className="animate-spin" />
                Analyzing materials...
              </div>
            )}
            {!state.materialValidation.isRunning && error && (
              <div className="text-[11px] text-red-600">{error}</div>
            )}
            {!state.materialValidation.isRunning && state.materialValidation.aiSummary && (
              <div className="text-[11px] text-foreground leading-relaxed">{state.materialValidation.aiSummary}</div>
            )}
          </div>
        )}

        {/* Tabs + Filters */}
        <div className="flex items-center justify-between gap-2 px-4 border-t border-border-subtle">
          <div className="flex">
            <button
              onClick={() => setActiveTab('technical')}
              className={cn(
                "px-3 py-2 border-b-2 text-[11px] font-bold uppercase tracking-wide transition-colors",
                activeTab === 'technical' ? "border-foreground text-foreground" : "border-transparent text-foreground-muted hover:text-foreground"
              )}
            >
              Technical
            </button>
            <button
              onClick={() => setActiveTab('boq')}
              className={cn(
                "px-3 py-2 border-b-2 text-[11px] font-bold uppercase tracking-wide transition-colors",
                activeTab === 'boq' ? "border-foreground text-foreground" : "border-transparent text-foreground-muted hover:text-foreground"
              )}
            >
              BoQ
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="appearance-none bg-transparent text-[11px] font-medium text-foreground-secondary pr-4 outline-none cursor-pointer"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="All">All</option>
              <option value="FF">Floors</option>
              <option value="WF">Walls</option>
              <option value="WP">Partitions</option>
              <option value="IC">Ceilings</option>
              <option value="L">Lighting</option>
              <option value="RF">Roof</option>
            </select>

            <label className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer text-foreground-secondary hover:text-foreground transition-colors">
              <input
                type="checkbox"
                checked={issuesOnly}
                onChange={(e) => setIssuesOnly(e.target.checked)}
                className="rounded border-border text-accent focus:ring-accent w-3.5 h-3.5"
              />
              Issues
            </label>

            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-foreground-muted" />
              <input
                type="text"
                placeholder="Search..."
                className="w-32 h-7 pl-6 pr-2 bg-surface-elevated border border-border rounded text-[11px] focus:border-accent outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full">
          <thead className="bg-surface-sunken/50 sticky top-0 z-10">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className={cn("py-2 px-4 text-left text-[10px] font-bold text-foreground-muted uppercase tracking-wider border-b border-border", h.className)}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-background">
            {activeTab === 'technical' ? (
              filteredData.length > 0 ? (
                filteredData.map(mat => {
                  const matIssues = issues.filter(
                    i => i.code === mat.code && (i.type === 'technical' || i.type === 'drawing' || i.type === 'documentation')
                  );
                  return (
                    <TechnicalRow
                      key={mat.code}
                      material={mat}
                      issues={matIssues}
                      expanded={expandedId === mat.code}
                      onExpand={() => setExpandedId(expandedId === mat.code ? null : mat.code)}
                    />
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="h-64 text-center align-middle">
                    <div className="flex flex-col items-center justify-center text-foreground-muted">
                      <Filter size={28} className="mb-2 opacity-20" />
                      <p className="text-xs font-medium">No materials found</p>
                      <p className="text-[11px] mt-0.5 text-foreground-muted/60">Upload documents and run validation</p>
                    </div>
                  </td>
                </tr>
              )
            ) : (
              boqData.length > 0 ? (
                boqData.map((item) => {
                  const issueKey = item.material?.code || item.boqItem?.code || item.key;
                  const itemIssues = issues.filter(i => i.code === issueKey && i.type === 'boq');
                  return (
                    <BoQRow
                      key={item.key}
                      material={item.material}
                      item={item.boqItem}
                      issues={itemIssues}
                      expanded={expandedId === item.key}
                      onExpand={() => setExpandedId(expandedId === item.key ? null : item.key)}
                    />
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="h-64 text-center align-middle text-foreground-muted">
                    <p className="text-xs">No BoQ items found</p>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
