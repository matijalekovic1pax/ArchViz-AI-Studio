
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { 
  FileText, ClipboardList, CheckCircle2, AlertTriangle, XCircle, 
  Search, Filter, Download, ChevronDown, ChevronRight, FileSpreadsheet,
  ArrowRight, ExternalLink, RefreshCw, LayoutDashboard, FolderOpen, 
  AlertOctagon, Check, Info, MoreVertical, Plus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ParsedMaterial, ValidationIssue, BoQItem } from '../types';

// --- MOCK DATA ---

const MOCK_MATERIALS: ParsedMaterial[] = [
  { code: 'FF10', name: 'POLYURETHANE FLOOR_GRAY_e:3mm', category: 'FF', description: 'Sika polyurethane floor system', referenceProduct: { type: 'SIKAFLOOR HARDTOP', brand: 'Sika' }, drawingRef: '0130', source: 'terminal', dimensions: '3mm', notes: ['Heavy duty', 'Baggage area'] },
  { code: 'FF30', name: 'CERAMIC FLOOR TILES HIGH TRAFFIC_GRAFITE_600x600x12mm', category: 'FF', description: 'High traffic ceramic tiles', referenceProduct: { type: 'OMNI IRON', brand: 'Revigres' }, drawingRef: '0130', source: 'terminal', dimensions: '12mm', notes: ['Public area'] },
  { code: 'WF72B', name: 'ALUMINIUM CLADDING TILES_GREEN_RAL 6019', category: 'WF', description: 'Aluminium cladding tiles', referenceProduct: { type: 'PURE WHITE 10 100', brand: 'Alucolux' }, drawingRef: '0141', source: 'terminal', notes: ['External facade'] },
  { code: 'WP20', name: 'CURTAIN WALL (FACADE) – TRANSPARENT GLASS PANEL', category: 'WP', description: 'Glass facade system', referenceProduct: { type: 'PILKINGTON INSULIGHT', brand: 'Pilkington' }, drawingRef: '0140', source: 'terminal', notes: [] },
  { code: 'IC40', name: 'PLASTERBOARD PERFORATED CEILING TILES_WHITE_600x600x14mm', category: 'IC', description: 'Acoustic ceiling', referenceProduct: { type: 'GYPROK AQUACHEK', brand: 'Gyprok' }, drawingRef: '0150', source: 'terminal', dimensions: '14mm', notes: [] },
];

const MOCK_ISSUES: ValidationIssue[] = [
  { id: '1', code: 'FF30', type: 'technical', severity: 'error', message: 'Dimension Mismatch', details: 'Code specifies 12mm, BoQ specifies 8mm', recommendation: 'Verify thickness with manufacturer or update spec', sourceDocument: 'Terminal_Materials_Rev3.pdf', resolved: false, date: 'Jan 8, 2026' },
  { id: '2', code: 'WF72B', type: 'technical', severity: 'error', message: 'Product Reference Error', details: 'Brand ref "PURE WHITE" conflicts with description "GREEN RAL 6019"', recommendation: 'Update brand reference to match RAL 6019 green product', sourceDocument: 'Terminal_Materials_Rev3.pdf', resolved: false, date: 'Jan 8, 2026' },
  { id: '3', code: 'FF10', type: 'documentation', severity: 'warning', message: 'Undefined RAL', details: 'Color gray specified but no RAL code', recommendation: 'Define RAL color for procurement', sourceDocument: 'Terminal_Materials_Rev3.pdf', resolved: false, date: 'Jan 8, 2026' },
  { id: '4', code: 'L-05', type: 'boq', severity: 'warning', message: 'Material not found in BoQ', details: 'Ground Recessed LED exists in spec but no BoQ entry', recommendation: 'Add item to BoQ or confirm exclusion', sourceDocument: 'Terminal_Materials_Rev3.pdf', resolved: false, date: 'Jan 8, 2026' },
  { id: '5', code: 'WP21', type: 'drawing', severity: 'warning', message: 'Drawing Ref Mismatch', details: 'References RAI drawing instead of BVC', recommendation: 'Correct drawing reference to BVC prefix', sourceDocument: 'Terminal_Materials_Rev3.pdf', resolved: true, date: 'Jan 7, 2026' },
];

const MOCK_BOQ_ITEMS: BoQItem[] = [
  { code: '1.2.1', section: 'Walls', description: 'Parede cortina vidro transparente', materialRef: 'WP20', product: { type: 'Pilkington', brand: 'Pilkington' }, quantity: { terminal: 91.50, unit: 'm2' } },
  { code: '1.6.2', section: 'Floors', description: 'Mosaico cerâmico alto tráfego 600x600x8mm', materialRef: 'FF30', product: { type: 'OMNI JET', brand: 'Revigres' }, quantity: { terminal: 60.00, unit: 'm2' } },
];

const MOCK_DOCUMENTS = [
  { id: '1', name: 'Terminal_Materials_Rev3.pdf', type: 'Material List', status: 'Parsed', date: 'Jan 8, 2026', items: 26 },
  { id: '2', name: 'Cargo_Materials_Rev2.pdf', type: 'Material List', status: 'Parsed', date: 'Jan 8, 2026', items: 12 },
  { id: '3', name: 'MQT_BillOfQuantities.xlsx', type: 'BoQ', status: 'Parsed', date: 'Jan 8, 2026', items: 89 },
];

// --- SUB-COMPONENTS ---

interface ValidationCardProps {
  material: ParsedMaterial;
  issues: ValidationIssue[];
}

const ValidationCard: React.FC<ValidationCardProps> = ({ material, issues }) => {
  const [expanded, setExpanded] = useState(false);
  const relevantIssues = issues.filter(i => i.code === material.code);
  const status = relevantIssues.some(i => i.severity === 'error') ? 'error' : relevantIssues.length > 0 ? 'warning' : 'pass';

  return (
    <div className={cn("border rounded-lg mb-3 bg-surface-elevated overflow-hidden transition-all", expanded ? "shadow-md" : "hover:border-foreground-muted")}>
      <div 
        className="flex items-center p-3 cursor-pointer hover:bg-surface-sunken/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-6 shrink-0 flex justify-center">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <div className="w-16 font-mono text-xs font-bold text-foreground">{material.code}</div>
        <div className="flex-1 text-sm font-medium truncate px-2">{material.name}</div>
        <div className="flex items-center gap-3">
            <span className="text-[10px] bg-surface-sunken px-2 py-0.5 rounded border border-border">{material.referenceProduct.brand}</span>
            <div className={cn("flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full w-24 justify-center", 
                status === 'error' ? "bg-red-100 text-red-700" : status === 'warning' ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700")}>
                {status === 'error' ? <XCircle size={12}/> : status === 'warning' ? <AlertTriangle size={12}/> : <CheckCircle2 size={12}/>}
                <span className="uppercase">{status}</span>
            </div>
        </div>
      </div>
      
      {expanded && (
         <div className="border-t border-border-subtle p-4 bg-surface-sunken/30">
            <div className="grid grid-cols-2 gap-6 mb-4">
               <div>
                  <h5 className="text-[10px] font-bold text-foreground-muted uppercase mb-2">Specifications</h5>
                  <div className="space-y-1 text-xs">
                     <div className="flex justify-between border-b border-border-subtle pb-1">
                        <span className="text-foreground-secondary">Category</span>
                        <span>{material.category}</span>
                     </div>
                     <div className="flex justify-between border-b border-border-subtle pb-1">
                        <span className="text-foreground-secondary">Dimensions</span>
                        <span>{material.dimensions || 'N/A'}</span>
                     </div>
                     <div className="flex justify-between border-b border-border-subtle pb-1">
                        <span className="text-foreground-secondary">Product Type</span>
                        <span>{material.referenceProduct.type}</span>
                     </div>
                     <div className="flex justify-between border-b border-border-subtle pb-1">
                        <span className="text-foreground-secondary">Source Doc</span>
                        <span className="capitalize">{material.source}</span>
                     </div>
                  </div>
               </div>
               <div>
                  <h5 className="text-[10px] font-bold text-foreground-muted uppercase mb-2">Validation Analysis</h5>
                  {relevantIssues.length > 0 ? (
                     <div className="space-y-2">
                        {relevantIssues.map(issue => (
                           <div key={issue.id} className={cn("p-2 rounded text-xs border flex gap-2", issue.severity === 'error' ? "bg-red-50 border-red-200 text-red-800" : "bg-yellow-50 border-yellow-200 text-yellow-800")}>
                              <div className="shrink-0 mt-0.5">
                                 {issue.severity === 'error' ? <XCircle size={12}/> : <AlertTriangle size={12}/>}
                              </div>
                              <div>
                                 <div className="font-bold">{issue.message}</div>
                                 <div className="opacity-80 mt-0.5">{issue.details}</div>
                                 {issue.recommendation && <div className="mt-1 text-[10px] font-medium bg-white/50 p-1 rounded">Rec: {issue.recommendation}</div>}
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <div className="flex items-center gap-2 text-green-600 text-xs p-2 bg-green-50 rounded border border-green-100">
                        <CheckCircle2 size={14} />
                        All validation checks passed.
                     </div>
                  )}
               </div>
            </div>
            
            <div className="flex justify-end gap-2">
               <button className="text-xs px-3 py-1.5 border border-border rounded hover:bg-surface-elevated bg-white transition-colors">View Drawing {material.drawingRef}</button>
               <button className="text-xs px-3 py-1.5 bg-foreground text-background rounded hover:bg-foreground/90 transition-colors">Edit Specification</button>
            </div>
         </div>
      )}
    </div>
  );
};

interface BoQRowProps {
  item: BoQItem;
  material?: ParsedMaterial;
}

const BoQRow: React.FC<BoQRowProps> = ({ item, material }) => {
   const matchStatus = !material ? 'none' : item.materialRef === material.code ? 'full' : 'partial';
   const hasError = material && (material.dimensions && !item.description.includes(material.dimensions));
   
   return (
      <tr className="border-b border-border-subtle hover:bg-surface-sunken transition-colors text-xs">
         <td className="p-3 font-mono text-foreground-secondary">{item.code}</td>
         <td className="p-3">
            <div className="font-medium text-foreground">{item.description}</div>
            <div className="text-[10px] text-foreground-muted mt-0.5">{item.product.type} | {item.product.brand}</div>
         </td>
         <td className="p-3">
            {material ? (
               <div className="flex flex-col">
                  <span className="font-bold">{material.code}</span>
                  {hasError && <span className="text-[9px] text-red-600 bg-red-100 px-1 rounded w-fit">Dim Mismatch</span>}
               </div>
            ) : (
               <span className="text-red-500 italic">Not Found</span>
            )}
         </td>
         <td className="p-3 font-mono text-right">
            {item.quantity.terminal && <div>T: {item.quantity.terminal} {item.quantity.unit}</div>}
            {item.quantity.cargo && <div>C: {item.quantity.cargo} {item.quantity.unit}</div>}
         </td>
         <td className="p-3 text-center">
             {matchStatus === 'full' && !hasError ? <CheckCircle2 size={14} className="text-green-500 mx-auto" /> 
             : matchStatus === 'none' ? <XCircle size={14} className="text-red-500 mx-auto" />
             : <AlertTriangle size={14} className="text-yellow-500 mx-auto" />}
         </td>
      </tr>
   );
};

// --- VIEW SECTIONS ---

const DashboardSection = ({ setTab }: { setTab: (t: any) => void }) => {
  const criticalIssues = MOCK_ISSUES.filter(i => i.severity === 'error');
  
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Project Header */}
      <div className="flex items-center justify-between">
         <div className="bg-surface-elevated border border-border px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:border-foreground-muted">
            <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">Project</span>
            <span className="text-sm font-bold">Aeroporto Internacional da Boa Vista</span>
            <ChevronDown size={14} className="text-foreground-muted" />
         </div>
         <button className="flex items-center gap-2 text-xs font-medium text-accent hover:text-accent-hover">
            <Plus size={14} /> New Project
         </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
         <div className="bg-surface-elevated border border-border rounded-xl p-5 flex items-center gap-6 shadow-sm">
            <div className="relative w-20 h-20 flex items-center justify-center">
               <svg className="w-full h-full transform -rotate-90">
                  <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-surface-sunken" />
                  <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-green-500" strokeDasharray="226" strokeDashoffset="50" />
               </svg>
               <span className="absolute text-xl font-bold">78%</span>
            </div>
            <div>
               <h3 className="text-sm font-bold uppercase tracking-wider text-foreground-muted mb-1">Validation Score</h3>
               <div className="flex gap-4 text-xs">
                  <div><span className="font-bold text-foreground">85%</span> Technical</div>
                  <div><span className="font-bold text-foreground">71%</span> BoQ Match</div>
               </div>
            </div>
         </div>

         <div className="bg-surface-elevated border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted mb-3">Documents Loaded</h3>
            <div className="space-y-2">
               <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-2"><FileText size={14} className="text-blue-500"/> Material Lists</span>
                  <span className="font-bold bg-surface-sunken px-2 rounded-full">3</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-2"><FileSpreadsheet size={14} className="text-green-500"/> Bill of Quantities</span>
                  <span className="font-bold bg-surface-sunken px-2 rounded-full">1</span>
               </div>
               <div className="flex justify-between items-center text-xs opacity-50">
                  <span className="flex items-center gap-2"><ExternalLink size={14} /> Drawings</span>
                  <span className="font-bold bg-surface-sunken px-2 rounded-full">0</span>
               </div>
            </div>
            <button onClick={() => setTab('documents')} className="mt-3 text-[10px] font-bold text-accent hover:underline w-full text-left">+ Import Documents</button>
         </div>
      </div>

      {/* Issue Summary */}
      <div>
         <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted mb-3">Issue Summary</h3>
         <div className="grid grid-cols-4 gap-3">
            <button onClick={() => setTab('issues')} className="bg-red-50 border border-red-100 p-3 rounded-lg text-left hover:border-red-300 transition-colors group">
               <div className="text-xs font-bold text-red-800 mb-1 flex items-center gap-2"><XCircle size={14}/> Errors</div>
               <div className="text-2xl font-bold text-red-600">3</div>
               <div className="text-[10px] text-red-800/60 group-hover:underline">View Details →</div>
            </button>
            <button onClick={() => setTab('issues')} className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg text-left hover:border-yellow-300 transition-colors group">
               <div className="text-xs font-bold text-yellow-800 mb-1 flex items-center gap-2"><AlertTriangle size={14}/> Warnings</div>
               <div className="text-2xl font-bold text-yellow-600">8</div>
               <div className="text-[10px] text-yellow-800/60 group-hover:underline">View Details →</div>
            </button>
            <button onClick={() => setTab('issues')} className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-left hover:border-blue-300 transition-colors group">
               <div className="text-xs font-bold text-blue-800 mb-1 flex items-center gap-2"><Info size={14}/> Info</div>
               <div className="text-2xl font-bold text-blue-600">5</div>
               <div className="text-[10px] text-blue-800/60 group-hover:underline">View Details →</div>
            </button>
            <div className="bg-green-50 border border-green-100 p-3 rounded-lg text-left">
               <div className="text-xs font-bold text-green-800 mb-1 flex items-center gap-2"><CheckCircle2 size={14}/> Passed</div>
               <div className="text-2xl font-bold text-green-600">42</div>
               <div className="text-[10px] text-green-800/60">Ready</div>
            </div>
         </div>
      </div>

      {/* Critical Issues */}
      <div className="bg-surface-elevated border border-border rounded-xl overflow-hidden shadow-sm">
         <div className="px-4 py-3 border-b border-border bg-surface-sunken/30 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-2">
               <AlertOctagon size={14} /> Critical Issues
            </h3>
            <button onClick={() => setTab('issues')} className="text-[10px] font-bold text-foreground-muted hover:text-foreground">View All</button>
         </div>
         <div className="divide-y divide-border-subtle">
            {criticalIssues.map(issue => (
               <div key={issue.id} className="p-4 flex gap-4 hover:bg-surface-sunken/20 transition-colors">
                  <div className="mt-1"><XCircle size={16} className="text-red-500" /></div>
                  <div className="flex-1">
                     <div className="text-sm font-bold text-foreground mb-1">{issue.message}</div>
                     <div className="text-xs text-foreground-secondary mb-2">{issue.details}</div>
                     <div className="flex gap-4 text-[10px] text-foreground-muted">
                        <span className="font-mono bg-surface-sunken px-1.5 rounded">{issue.code}</span>
                        <span>Source: {issue.sourceDocument}</span>
                     </div>
                  </div>
                  <button className="self-center px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-surface-elevated bg-white whitespace-nowrap">Resolve →</button>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
};

const DocumentsSection = () => {
  return (
    <div className="max-w-5xl mx-auto">
       <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Project Documents</h2>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-foreground text-background text-xs font-medium rounded hover:bg-foreground/90 transition-colors">
             <Plus size={14} /> Import Document
          </button>
       </div>
       
       <div className="grid gap-3">
          <div className="text-xs font-bold text-foreground-muted uppercase tracking-wider mt-2 mb-1">Material Lists</div>
          {MOCK_DOCUMENTS.filter(d => d.type === 'Material List').map(doc => (
             <div key={doc.id} className="bg-surface-elevated border border-border rounded-lg p-4 flex items-center justify-between hover:border-foreground-muted transition-colors group">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-blue-50 rounded flex items-center justify-center text-blue-600"><FileText size={20} /></div>
                   <div>
                      <div className="font-bold text-sm">{doc.name}</div>
                      <div className="text-xs text-foreground-muted">{doc.items} items • Imported {doc.date}</div>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium flex items-center gap-1"><Check size={10} /> Parsed</div>
                   <button className="p-2 hover:bg-surface-sunken rounded text-foreground-muted hover:text-foreground"><MoreVertical size={16} /></button>
                </div>
             </div>
          ))}

          <div className="text-xs font-bold text-foreground-muted uppercase tracking-wider mt-4 mb-1">Bill of Quantities</div>
          {MOCK_DOCUMENTS.filter(d => d.type === 'BoQ').map(doc => (
             <div key={doc.id} className="bg-surface-elevated border border-border rounded-lg p-4 flex items-center justify-between hover:border-foreground-muted transition-colors group">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-green-50 rounded flex items-center justify-center text-green-600"><FileSpreadsheet size={20} /></div>
                   <div>
                      <div className="font-bold text-sm">{doc.name}</div>
                      <div className="text-xs text-foreground-muted">{doc.items} line items • Imported {doc.date}</div>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium flex items-center gap-1"><Check size={10} /> Parsed</div>
                   <button className="p-2 hover:bg-surface-sunken rounded text-foreground-muted hover:text-foreground"><MoreVertical size={16} /></button>
                </div>
             </div>
          ))}
          
          <div className="text-xs font-bold text-foreground-muted uppercase tracking-wider mt-4 mb-1">Drawings</div>
          <div className="bg-surface-sunken/50 border border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center text-center">
             <ExternalLink size={24} className="text-foreground-muted opacity-50 mb-2" />
             <div className="text-sm font-medium text-foreground-secondary">No drawings imported</div>
             <p className="text-xs text-foreground-muted mb-4">Upload PDF or DWG files to enable cross-referencing</p>
             <button className="text-xs font-bold text-accent hover:underline">Browse Files</button>
          </div>
       </div>
    </div>
  );
};

const IssuesSection = () => {
   const [filter, setFilter] = useState<'all'|'active'|'resolved'>('active');
   const filteredIssues = MOCK_ISSUES.filter(i => {
      if (filter === 'all') return true;
      if (filter === 'active') return !i.resolved;
      return i.resolved;
   });

   return (
      <div className="max-w-5xl mx-auto h-full flex flex-col">
         <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-lg font-bold">Issue Tracker</h2>
            <div className="flex bg-surface-elevated rounded p-1 border border-border">
               <button onClick={() => setFilter('active')} className={cn("px-3 py-1 text-xs font-medium rounded transition-colors", filter === 'active' ? "bg-foreground text-background" : "text-foreground-muted hover:text-foreground")}>Active ({MOCK_ISSUES.filter(i=>!i.resolved).length})</button>
               <button onClick={() => setFilter('resolved')} className={cn("px-3 py-1 text-xs font-medium rounded transition-colors", filter === 'resolved' ? "bg-foreground text-background" : "text-foreground-muted hover:text-foreground")}>Resolved ({MOCK_ISSUES.filter(i=>i.resolved).length})</button>
               <button onClick={() => setFilter('all')} className={cn("px-3 py-1 text-xs font-medium rounded transition-colors", filter === 'all' ? "bg-foreground text-background" : "text-foreground-muted hover:text-foreground")}>All</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
            {filteredIssues.map(issue => (
               <div key={issue.id} className="bg-surface-elevated border border-border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                     <div className="flex items-center gap-2">
                        {issue.severity === 'error' ? <XCircle size={16} className="text-red-500" /> 
                        : issue.severity === 'warning' ? <AlertTriangle size={16} className="text-yellow-500" />
                        : <Info size={16} className="text-blue-500" />}
                        <span className="font-bold text-sm">#{issue.id.padStart(3,'0')}</span>
                        <span className="text-[10px] uppercase font-bold text-foreground-muted bg-surface-sunken px-1.5 py-0.5 rounded border border-border-subtle">{issue.type}</span>
                     </div>
                     <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", issue.resolved ? "bg-green-100 text-green-700" : "bg-surface-sunken text-foreground-secondary")}>
                        {issue.resolved ? "Resolved" : "Active"}
                     </span>
                  </div>
                  
                  <h3 className="font-bold text-sm mb-1">{issue.message}</h3>
                  <p className="text-xs text-foreground-secondary mb-3">{issue.details}</p>
                  
                  {issue.recommendation && (
                     <div className="bg-blue-50/50 border border-blue-100 rounded p-2 mb-3">
                        <div className="text-[10px] font-bold text-blue-700 uppercase mb-0.5">Recommendation</div>
                        <div className="text-xs text-blue-900">{issue.recommendation}</div>
                     </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
                     <div className="text-[10px] text-foreground-muted">
                        Material: <span className="font-mono text-foreground">{issue.code}</span> • {issue.date}
                     </div>
                     <div className="flex gap-2">
                        <button className="px-3 py-1 text-xs border border-border rounded hover:bg-surface-sunken">View Material</button>
                        {!issue.resolved && <button className="px-3 py-1 text-xs bg-foreground text-background rounded hover:bg-foreground/90">Resolve</button>}
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>
   );
};

// --- MAIN VIEW COMPONENT ---

export const MaterialValidationView: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const mv = state.materialValidation;
  
  const setTab = (tab: any) => dispatch({ type: 'UPDATE_MATERIAL_VALIDATION', payload: { activeTab: tab } });

  return (
    <div className="flex-1 bg-background flex flex-col h-full overflow-hidden">
      
      {/* Header / Document Status */}
      <div className="h-16 bg-surface-elevated border-b border-border shrink-0 flex items-center px-6 justify-between z-10">
         <div className="flex items-center gap-4">
            <h2 className="font-bold text-sm tracking-wide">Material Validation</h2>
            <div className="h-6 w-px bg-border" />
            <div className="flex gap-2">
               <div className={cn("px-2 py-1 rounded text-[10px] font-medium border flex items-center gap-1.5", mv.documents.terminal ? "bg-green-50 border-green-200 text-green-800" : "bg-surface-sunken border-border text-foreground-muted")}>
                  <FileText size={10} /> Terminal
               </div>
               <div className={cn("px-2 py-1 rounded text-[10px] font-medium border flex items-center gap-1.5", mv.documents.cargo ? "bg-green-50 border-green-200 text-green-800" : "bg-surface-sunken border-border text-foreground-muted")}>
                  <FileText size={10} /> Cargo
               </div>
               <div className={cn("px-2 py-1 rounded text-[10px] font-medium border flex items-center gap-1.5", mv.documents.boq ? "bg-green-50 border-green-200 text-green-800" : "bg-surface-sunken border-border text-foreground-muted")}>
                  <FileSpreadsheet size={10} /> BoQ
               </div>
            </div>
         </div>
         <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-surface-sunken transition-colors">
            <RefreshCw size={12} /> Re-run Validation
         </button>
      </div>

      {/* Main Tabs */}
      <div className="bg-surface-sunken border-b border-border px-6 flex items-end gap-1 shrink-0">
         {[
            {id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard},
            {id: 'documents', label: 'Documents', icon: FolderOpen},
            {id: 'materials', label: 'Materials', icon: ClipboardList}, // Was 'technical'
            {id: 'drawings', label: 'Drawings', icon: ExternalLink}, // Was 'drawing'
            {id: 'boq', label: 'BoQ Compatibility', icon: FileSpreadsheet},
            {id: 'issues', label: 'Issues', icon: AlertOctagon},
            {id: 'reports', label: 'Reports', icon: FileText} // Was 'report'
         ].map(tab => (
            <button
               key={tab.id}
               onClick={() => setTab(tab.id)}
               className={cn(
                  "px-4 py-2.5 text-xs font-medium rounded-t-lg border-t border-x transition-colors flex items-center gap-2 relative top-px",
                  mv.activeTab === tab.id 
                     ? "bg-background border-border text-foreground shadow-sm z-10" 
                     : "bg-transparent border-transparent text-foreground-muted hover:text-foreground hover:bg-surface-elevated/50"
               )}
            >
               <tab.icon size={14} />
               {tab.label}
            </button>
         ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-background custom-scrollbar">
         
         {mv.activeTab === 'dashboard' && <DashboardSection setTab={setTab} />}
         {mv.activeTab === 'documents' && <DocumentsSection />}
         {mv.activeTab === 'issues' && <IssuesSection />}

         {/* Renamed Technical -> Materials View */}
         {mv.activeTab === 'materials' && (
            <div className="max-w-5xl mx-auto">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                     <Filter size={14} className="text-foreground-muted" />
                     <span className="text-xs font-medium">Filter:</span>
                     <select className="h-7 text-xs border border-border rounded bg-surface-elevated px-2">
                        <option>All Categories</option>
                        <option>Floor Finishes</option>
                        <option>Wall Finishes</option>
                     </select>
                     <select className="h-7 text-xs border border-border rounded bg-surface-elevated px-2">
                        <option>All Issues</option>
                        <option>Errors Only</option>
                        <option>Warnings Only</option>
                     </select>
                  </div>
                  <div className="relative">
                     <Search size={14} className="absolute left-2 top-1.5 text-foreground-muted" />
                     <input type="text" placeholder="Search materials..." className="h-7 w-48 pl-8 border border-border rounded text-xs bg-surface-elevated" />
                  </div>
               </div>

               {/* Material Cards */}
               <div className="space-y-1">
                  {MOCK_MATERIALS.map(mat => (
                     <ValidationCard key={mat.code} material={mat} issues={MOCK_ISSUES} />
                  ))}
               </div>
            </div>
         )}

         {mv.activeTab === 'boq' && (
            <div className="max-w-6xl mx-auto">
               <div className="bg-surface-elevated border border-border rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-border bg-surface-sunken/30 flex justify-between items-center">
                     <div>
                        <h3 className="font-bold text-sm">BoQ to Material Match Analysis</h3>
                        <p className="text-xs text-foreground-muted mt-1">Comparing MQT line items against specified materials list</p>
                     </div>
                     <div className="flex gap-4 text-xs">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"/> 92% Matched</div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"/> 5% Partial</div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"/> 3% Missing</div>
                     </div>
                  </div>
                  <table className="w-full">
                     <thead className="bg-surface-sunken text-[10px] uppercase text-foreground-muted font-bold tracking-wider text-left">
                        <tr>
                           <th className="p-3 w-20">BoQ Code</th>
                           <th className="p-3">Description</th>
                           <th className="p-3 w-32">Mat. Ref</th>
                           <th className="p-3 text-right">Quantity</th>
                           <th className="p-3 text-center w-16">Status</th>
                        </tr>
                     </thead>
                     <tbody>
                        {MOCK_BOQ_ITEMS.map(item => (
                           <BoQRow 
                              key={item.code} 
                              item={item} 
                              material={MOCK_MATERIALS.find(m => m.code === item.materialRef)} 
                           />
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         )}
         
         {/* Placeholders for other tabs */}
         {mv.activeTab === 'drawings' && (
            <div className="flex flex-col items-center justify-center h-64 text-foreground-muted">
               <ExternalLink size={48} className="mb-4 opacity-20" />
               <p className="text-sm">Drawing Cross-Reference Matrix requires loading drawings.</p>
               <button className="mt-4 px-4 py-2 bg-surface-elevated border border-border rounded text-xs font-medium hover:border-foreground">Load Drawings</button>
            </div>
         )}

         {mv.activeTab === 'reports' && (
             <div className="max-w-4xl mx-auto bg-white border border-border shadow-sm p-8 min-h-[600px]">
                <div className="border-b-2 border-black pb-4 mb-8 flex justify-between items-end">
                   <div>
                      <h1 className="text-2xl font-bold tracking-tight text-black">Validation Report</h1>
                      <p className="text-sm text-gray-500 mt-1">Aeroporto Internacional da Boa Vista - Phase 1B</p>
                   </div>
                   <div className="text-right text-xs text-gray-400">
                      Generated: {new Date().toLocaleDateString()}
                   </div>
                </div>

                <div className="space-y-8">
                   <section>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Executive Summary</h3>
                      <div className="p-4 bg-gray-50 rounded border border-gray-100 flex gap-8">
                         <div className="text-center">
                            <div className="text-3xl font-bold text-gray-800">78%</div>
                            <div className="text-[10px] uppercase text-gray-500 font-bold mt-1">Overall Score</div>
                         </div>
                         <div className="w-px bg-gray-200" />
                         <div className="flex-1 grid grid-cols-3 gap-4">
                            <div>
                               <div className="text-xl font-bold text-green-600">42</div>
                               <div className="text-[10px] uppercase text-gray-500">Validated</div>
                            </div>
                            <div>
                               <div className="text-xl font-bold text-yellow-600">8</div>
                               <div className="text-[10px] uppercase text-gray-500">Warnings</div>
                            </div>
                            <div>
                               <div className="text-xl font-bold text-red-600">3</div>
                               <div className="text-[10px] uppercase text-gray-500">Critical Errors</div>
                            </div>
                         </div>
                      </div>
                   </section>

                   <section>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-3">Critical Issues</h3>
                      <ul className="space-y-2">
                         {MOCK_ISSUES.filter(i => i.severity === 'error').map(i => (
                            <li key={i.id} className="flex gap-3 text-sm border-l-2 border-red-500 pl-3 py-1">
                               <span className="font-mono font-bold w-12">{i.code}</span>
                               <span className="font-medium text-gray-900">{i.message}:</span>
                               <span className="text-gray-600">{i.details}</span>
                            </li>
                         ))}
                      </ul>
                   </section>
                </div>
                
                <div className="mt-12 pt-8 border-t border-gray-100 flex justify-end">
                   <button className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded text-xs font-bold hover:bg-gray-800">
                      <Download size={14} /> Download PDF Report
                   </button>
                </div>
             </div>
         )}

      </div>
    </div>
  );
};
