
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { 
  FileText, FileSpreadsheet, Plus, Play, Download, Search, ChevronDown, 
  Check, XCircle, AlertTriangle, CheckCircle2, Info, ArrowRight,
  Filter, LayoutList
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ParsedMaterial, ValidationIssue } from '../types';

// --- ENHANCED MOCK DATA ---

interface ExtendedMaterial extends ParsedMaterial {
  status: 'ok' | 'warning' | 'error';
  checks: {
    typology: boolean;
    dimensions: 'ok' | 'warning' | 'error';
    application: boolean;
  };
  application: string;
}

const MOCK_MATERIALS: ExtendedMaterial[] = [
  { 
    code: 'FF10', 
    name: 'POLYURETHANE FLOOR_GRAY_e:3mm', 
    category: 'FF', 
    description: 'Sika Sikafloor Hardtop polyurethane system', 
    referenceProduct: { type: 'SIKAFLOOR HARDTOP', brand: 'Sika' }, 
    drawingRef: '0130', 
    source: 'terminal', 
    dimensions: '3mm', 
    notes: ['Heavy duty'], 
    status: 'ok',
    checks: { typology: true, dimensions: 'ok', application: true },
    application: 'Heavy Traffic'
  },
  { 
    code: 'FF30', 
    name: 'CERAMIC FLOOR TILES_GRAFITE_600x600x12mm', 
    category: 'FF', 
    description: 'High traffic ceramic tiles', 
    referenceProduct: { type: 'OMNI IRON', brand: 'Revigres' }, 
    drawingRef: '0130', 
    source: 'terminal', 
    dimensions: '12mm', 
    notes: ['Public area'], 
    status: 'warning',
    checks: { typology: true, dimensions: 'warning', application: true },
    application: 'High Traffic'
  },
  { 
    code: 'WF72B', 
    name: 'ALUMINIUM CLADDING_GREEN_RAL 6019', 
    category: 'WF', 
    description: 'Aluminium cladding tiles', 
    referenceProduct: { type: 'PURE WHITE 10 100', brand: 'Alucolux' }, 
    drawingRef: '0141', 
    source: 'terminal', 
    dimensions: 'N/A', 
    notes: ['External facade'], 
    status: 'error',
    checks: { typology: true, dimensions: 'ok', application: true },
    application: 'Wall Cladding'
  },
  { 
    code: 'WP20', 
    name: 'CURTAIN WALL (FACADE) – TRANSPARENT GLASS', 
    category: 'WP', 
    description: 'Glass facade system', 
    referenceProduct: { type: 'PILKINGTON INSULIGHT', brand: 'Pilkington' }, 
    drawingRef: '0140', 
    source: 'terminal', 
    notes: [], 
    status: 'ok',
    checks: { typology: true, dimensions: 'ok', application: true },
    application: 'Facade'
  },
  { 
    code: 'WP21', 
    name: 'CURTAIN WALL – SANDBLASTED GLASS', 
    category: 'WP', 
    description: 'Profilit glass system', 
    referenceProduct: { type: 'PROFILIT', brand: 'Pilkington' }, 
    drawingRef: 'RAI-0140', // Intentional error for demo
    source: 'terminal', 
    notes: [], 
    status: 'warning',
    checks: { typology: true, dimensions: 'ok', application: true },
    application: 'Facade'
  },
  { 
    code: 'L60', 
    name: 'LED GROUND RECESSED', 
    category: 'L', 
    description: 'Linear LED', 
    referenceProduct: { type: 'GAMA HR', brand: 'KLUS' }, 
    drawingRef: '0500', 
    source: 'terminal', 
    notes: [], 
    status: 'error',
    checks: { typology: true, dimensions: 'ok', application: true },
    application: 'Lighting'
  }
];

const MOCK_ISSUES: ValidationIssue[] = [
  { id: '1', code: 'FF30', type: 'technical', severity: 'warning', message: 'Dimension Warning', details: 'Material specifies 12mm thickness. BoQ item 1.6.2 specifies 8mm thickness.', recommendation: 'Clarify correct thickness with design team', sourceDocument: 'Terminal_Materials.pdf', resolved: false, date: 'Jan 8' },
  { id: '2', code: 'WF72B', type: 'technical', severity: 'error', message: 'Product Reference Error', details: 'Brand ref "PURE WHITE" conflicts with description "GREEN RAL 6019"', recommendation: 'Update brand reference to match RAL 6019', sourceDocument: 'Terminal_Materials.pdf', resolved: false, date: 'Jan 8' },
  { id: '3', code: 'L60', type: 'boq', severity: 'error', message: 'Material not found in BoQ', details: 'Material exists in spec but not found in BoQ', recommendation: 'Add item to BoQ or confirm exclusion', sourceDocument: 'MQT_BoQ.xlsx', resolved: false, date: 'Jan 8' },
  { id: '4', code: 'WP21', type: 'drawing', severity: 'warning', message: 'Drawing Ref Mismatch', details: 'References RAI drawing instead of BVC prefix', recommendation: 'Correct drawing reference to BVC prefix', sourceDocument: 'Terminal_Materials.pdf', resolved: false, date: 'Jan 8' },
];

const MOCK_BOQ_ITEMS = [
  { code: '1.2.1', section: 'Walls', description: 'Parede cortina vidro transparente', materialRef: 'WP20', product: 'Pilkington', quantity: '91.50 m²' },
  { code: '1.2.2', section: 'Walls', description: 'Parede vidro profilit', materialRef: 'WP21', product: 'Pilkington', quantity: '83.20 m²' },
  { code: '1.6.2', section: 'Floors', description: 'Mosaico cerâmico alto tráfego 600x600x8mm', materialRef: 'FF30', product: 'Revigres', quantity: '60.00 m²' },
];

// --- COMPONENTS ---

const StatusBadge = ({ status }: { status: 'ok' | 'warning' | 'error' | 'miss' }) => {
  if (status === 'error') return <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100 uppercase tracking-wide"><XCircle size={12} /> Error</span>;
  if (status === 'warning') return <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-full border border-yellow-100 uppercase tracking-wide"><AlertTriangle size={12} /> Warn</span>;
  if (status === 'miss') return <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100 uppercase tracking-wide"><AlertTriangle size={12} /> Miss</span>;
  return <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100 uppercase tracking-wide"><CheckCircle2 size={12} /> OK</span>;
};

// --- ROWS ---

interface TechnicalRowProps {
  material: ExtendedMaterial;
  issues: ValidationIssue[];
  expanded: boolean;
  onExpand: () => void;
}

const TechnicalRow: React.FC<TechnicalRowProps> = ({ material, issues, expanded, onExpand }) => {
   const hasIssues = issues.length > 0;
   const primaryIssue = hasIssues ? issues[0] : null;

   return (
      <>
         <tr 
            onClick={onExpand}
            className={cn(
               "border-b border-border-subtle transition-colors cursor-pointer group hover:bg-surface-sunken/50",
               expanded && "bg-surface-sunken/30"
            )}
         >
            <td className="py-5 px-6 align-top w-32">
               <span className="font-mono text-xs font-bold text-foreground-secondary bg-surface-sunken px-2 py-1 rounded border border-border-subtle">{material.code}</span>
            </td>
            <td className="py-5 px-6 align-top">
               <div className="font-medium text-sm text-foreground">{material.name}</div>
               <div className="text-xs text-foreground-muted mt-1 flex gap-2">
                  <span className="font-semibold text-foreground-secondary">{material.referenceProduct.brand}</span>
                  <span className="text-border-strong">•</span>
                  <span>{material.referenceProduct.type}</span>
               </div>
            </td>
            <td className="py-5 px-6 align-top w-40">
               <StatusBadge status={material.status} />
            </td>
            <td className="py-5 px-6 align-top">
               {primaryIssue ? (
                  <div className="text-xs">
                     <div className={cn("font-bold mb-0.5", primaryIssue.severity === 'error' ? "text-red-700" : "text-yellow-700")}>
                        {primaryIssue.message}
                     </div>
                     <div className="text-foreground-muted truncate max-w-md">{primaryIssue.details}</div>
                  </div>
               ) : (
                  <span className="text-xs text-foreground-muted/50 flex items-center gap-1">—</span>
               )}
            </td>
            <td className="py-5 px-6 align-middle text-right w-16">
               <ChevronDown size={16} className={cn("text-foreground-muted transition-transform duration-200", expanded && "rotate-180")} />
            </td>
         </tr>
         {expanded && (
            <tr className="bg-surface-sunken/30 border-b border-border-subtle animate-fade-in">
               <td colSpan={5} className="p-6 pl-[152px]">
                  <div className="bg-background border border-border rounded-lg p-5 shadow-sm">
                     {/* Checks Grid */}
                     <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="p-3 bg-surface-sunken/50 rounded border border-border-subtle">
                           <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] uppercase font-bold text-foreground-muted">Typology</span>
                              {material.checks.typology ? <Check size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />}
                           </div>
                           <div className="text-xs font-medium">{material.category} ({material.application})</div>
                        </div>
                        <div className="p-3 bg-surface-sunken/50 rounded border border-border-subtle">
                           <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] uppercase font-bold text-foreground-muted">Dimensions</span>
                              {material.checks.dimensions === 'ok' ? <Check size={14} className="text-green-500" /> : <AlertTriangle size={14} className="text-yellow-500" />}
                           </div>
                           <div className="text-xs font-medium">{material.dimensions || 'N/A'}</div>
                        </div>
                        <div className="p-3 bg-surface-sunken/50 rounded border border-border-subtle">
                           <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] uppercase font-bold text-foreground-muted">Application</span>
                              {material.checks.application ? <Check size={14} className="text-green-500" /> : <AlertTriangle size={14} className="text-yellow-500" />}
                           </div>
                           <div className="text-xs font-medium">{material.application}</div>
                        </div>
                     </div>

                     {/* Issues List */}
                     {hasIssues ? (
                        <div className="space-y-3">
                           {issues.map((issue) => (
                              <div key={issue.id} className={cn("rounded-md border p-4", issue.severity === 'error' ? "bg-red-50/50 border-red-100" : "bg-yellow-50/50 border-yellow-100")}>
                                 <div className="flex items-start gap-3">
                                    <div className={cn("mt-0.5", issue.severity === 'error' ? "text-red-600" : "text-yellow-600")}>
                                       {issue.severity === 'error' ? <XCircle size={16} /> : <AlertTriangle size={16} />}
                                    </div>
                                    <div className="flex-1">
                                       <h4 className={cn("text-xs font-bold mb-1", issue.severity === 'error' ? "text-red-900" : "text-yellow-900")}>
                                          {issue.message}
                                       </h4>
                                       <p className="text-xs text-foreground-secondary leading-relaxed mb-2">{issue.details}</p>
                                       {issue.recommendation && (
                                          <div className="text-xs bg-white/50 p-2 rounded border border-black/5 text-foreground-muted italic">
                                             <span className="font-semibold not-italic">AI Recommendation:</span> {issue.recommendation}
                                          </div>
                                       )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                       <button className="px-3 py-1.5 bg-foreground text-background rounded text-[10px] font-medium hover:bg-foreground/90 transition-colors shadow-sm whitespace-nowrap">
                                          Resolve Issue
                                       </button>
                                       <button className="px-3 py-1.5 bg-white border border-border rounded text-[10px] font-medium hover:bg-surface-sunken transition-colors whitespace-nowrap">
                                          Dismiss
                                       </button>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <div className="text-center py-4 text-xs text-foreground-muted bg-surface-sunken/30 rounded border border-dashed border-border-subtle">
                           No technical issues detected.
                        </div>
                     )}
                  </div>
               </td>
            </tr>
         )}
      </>
   );
}

interface BoQRowProps {
  material?: ExtendedMaterial;
  item?: any;
  issues: ValidationIssue[];
  expanded: boolean;
  onExpand: () => void;
}

const BoQRow: React.FC<BoQRowProps> = ({ material, item, issues, expanded, onExpand }) => {
   const hasIssues = issues.length > 0;
   
   // Determine row status
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
            <td className="py-5 px-6 align-top w-32">
               {material ? (
                  <span className="font-mono text-xs font-bold text-foreground-secondary bg-surface-sunken px-2 py-1 rounded border border-border-subtle">{material.code}</span>
               ) : (
                  <span className="text-xs text-foreground-muted italic">No Mat.</span>
               )}
            </td>
            <td className="py-5 px-6 align-top">
               {material ? (
                  <div>
                     <div className="font-medium text-sm text-foreground">{material.name}</div>
                     <div className="text-xs text-foreground-muted mt-1">{material.referenceProduct.brand}</div>
                  </div>
               ) : (
                  <div>
                     <div className="font-medium text-sm text-foreground">{item?.description || "Unknown Item"}</div>
                     <div className="text-xs text-foreground-muted mt-1">{item?.product?.brand || "-"}</div>
                  </div>
               )}
            </td>
            <td className="py-5 px-6 align-top w-32 font-mono text-xs text-foreground-secondary">
               {item?.code || "-"}
            </td>
            <td className="py-5 px-6 align-top w-40">
               <StatusBadge status={status} />
            </td>
            <td className="py-5 px-6 align-top">
               {status === 'miss' ? (
                  <div className="text-xs text-red-600 font-medium">Not found in Bill of Quantities</div>
               ) : hasIssues ? (
                  <div className="text-xs text-yellow-700">{issues[0].message}</div>
               ) : (
                  <span className="text-xs text-foreground-muted/50">—</span>
               )}
            </td>
            <td className="py-5 px-6 align-middle text-right w-16">
               <ChevronDown size={16} className={cn("text-foreground-muted transition-transform duration-200", expanded && "rotate-180")} />
            </td>
         </tr>
         
         {expanded && (
            <tr className="bg-surface-sunken/30 border-b border-border-subtle animate-fade-in">
               <td colSpan={6} className="p-6 pl-[152px]">
                  <div className="bg-background border border-border rounded-lg p-5 shadow-sm">
                     <h4 className="text-xs font-bold uppercase tracking-wider text-foreground-muted mb-3">Cross-Reference Detail</h4>
                     
                     <div className="grid grid-cols-2 gap-px bg-border rounded border border-border overflow-hidden mb-4">
                        <div className="bg-surface-sunken p-2 text-[10px] font-bold text-foreground-secondary text-center">Material Spec</div>
                        <div className="bg-surface-sunken p-2 text-[10px] font-bold text-foreground-secondary text-center">BoQ Item {item?.code}</div>
                        
                        <div className="bg-white p-3 text-xs border-r border-border-subtle">
                           {material ? (
                              <div className="space-y-1">
                                 <div className="font-bold">{material.name}</div>
                                 <div className="text-foreground-muted">{material.dimensions}</div>
                              </div>
                           ) : <span className="text-foreground-muted italic">Missing</span>}
                        </div>
                        
                        <div className="bg-white p-3 text-xs">
                           {item ? (
                              <div className="space-y-1">
                                 <div className="font-bold">{item.description}</div>
                                 <div className="text-foreground-muted">Qty: {item.quantity}</div>
                              </div>
                           ) : <span className="text-foreground-muted italic">Missing</span>}
                        </div>
                     </div>

                     {hasIssues && (
                        <div className="flex justify-end gap-2">
                           <button className="px-3 py-1.5 bg-white border border-border rounded text-[10px] font-medium hover:bg-surface-sunken transition-colors">Ignore Mismatch</button>
                           <button className="px-3 py-1.5 bg-foreground text-background rounded text-[10px] font-medium hover:bg-foreground/90 transition-colors">Fix in BoQ</button>
                        </div>
                     )}
                  </div>
               </td>
            </tr>
         )}
      </>
   );
}

// --- MAIN VIEW ---

export const MaterialValidationView: React.FC = () => {
  const { state } = useAppStore();
  const [activeTab, setActiveTab] = useState<'technical' | 'boq'>('technical');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Filtering state
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Stats calculation
  const totalItems = MOCK_MATERIALS.length;
  const errors = MOCK_MATERIALS.filter(m => m.status === 'error').length;
  const warnings = MOCK_MATERIALS.filter(m => m.status === 'warning').length;
  const passed = totalItems - errors - warnings;
  const score = Math.round((passed / totalItems) * 100);

  // Filter Logic
  const getFilteredMaterials = () => {
     return MOCK_MATERIALS.filter(m => {
        if (filterCategory !== 'All' && m.category !== filterCategory) return false;
        if (issuesOnly && m.status === 'ok') return false;
        if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase()) && !m.code.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
     });
  };

  const filteredData = getFilteredMaterials();

  // Combined list for BoQ view (materials + orphan boq items)
  const getBoQData = () => {
     // Start with materials, find their BoQ matches
     const data = filteredData.map(mat => ({
        type: 'material',
        key: mat.code,
        material: mat,
        boqItem: MOCK_BOQ_ITEMS.find(b => b.materialRef === mat.code)
     }));

     // Add orphan BoQ items (simulated)
     // In a real app, we'd check all BoQ items against materials
     return data;
  };

  const boqData = getBoQData();

  return (
    <div className="flex-1 bg-background flex flex-col h-full overflow-hidden">
      
      {/* 1. COMPACT HEADER (Cleaned Up) */}
      <div className="bg-surface-elevated border-b border-border shadow-sm z-20">
         <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-6">
               <h2 className="text-lg font-bold tracking-tight text-foreground">Material Validation</h2>
               <div className="h-8 w-px bg-border-subtle" />

               {/* Stats Widget */}
               <div className="flex flex-col justify-center gap-1.5 min-w-[280px]">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                     <span className="font-bold text-foreground">{score}% <span className="font-normal text-foreground-muted">Score</span></span>
                     <div className="flex gap-3 text-[10px] font-medium text-foreground-secondary">
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /> {errors} Errors</span>
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> {warnings} Warn</span>
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> {passed} OK</span>
                     </div>
                  </div>
                  <div className="w-full h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                     <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full" style={{ width: `${score}%` }} />
                  </div>
               </div>
            </div>

            <div className="flex gap-2">
               <button className="flex items-center gap-2 px-4 py-2 text-xs font-bold border border-border rounded-lg hover:bg-surface-sunken transition-colors">
                  <Download size={14} /> Export Report
               </button>
               <button className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors shadow-md">
                  <Play size={14} fill="currentColor" /> Run Validation
               </button>
            </div>
         </div>

         {/* 2. TOOLBAR & FILTERS */}
         <div className="flex items-center justify-between px-6 h-12 bg-background/50 backdrop-blur-sm border-t border-border-subtle">
            <div className="flex gap-1 h-full pt-1">
               <button 
                  onClick={() => setActiveTab('technical')}
                  className={cn(
                     "px-4 h-full border-b-2 text-xs font-bold uppercase tracking-wide transition-colors",
                     activeTab === 'technical' ? "border-foreground text-foreground" : "border-transparent text-foreground-muted hover:text-foreground"
                  )}
               >
                  Technical Validation
               </button>
               <button 
                  onClick={() => setActiveTab('boq')}
                  className={cn(
                     "px-4 h-full border-b-2 text-xs font-bold uppercase tracking-wide transition-colors",
                     activeTab === 'boq' ? "border-foreground text-foreground" : "border-transparent text-foreground-muted hover:text-foreground"
                  )}
               >
                  BoQ Compatibility
               </button>
            </div>

            <div className="flex items-center gap-4 py-2">
               <div className="flex items-center gap-3 pl-4 border-l border-border-subtle h-6">
                  <div className="relative group">
                     <select 
                        className="appearance-none bg-transparent text-xs font-medium text-foreground pr-6 outline-none cursor-pointer"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                     >
                        <option value="All">All Categories</option>
                        <option value="FF">Floor Finishes</option>
                        <option value="WF">Wall Finishes</option>
                        <option value="WP">Partitions</option>
                        <option value="IC">Ceilings</option>
                     </select>
                     <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none group-hover:text-foreground transition-colors" />
                  </div>

                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none text-foreground-secondary hover:text-foreground transition-colors">
                     <input 
                        type="checkbox" 
                        checked={issuesOnly} 
                        onChange={(e) => setIssuesOnly(e.target.checked)}
                        className="rounded border-border text-accent focus:ring-accent" 
                     />
                     Issues Only
                  </label>
               </div>

               <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted" />
                  <input 
                     type="text" 
                     placeholder="Search materials..." 
                     className="w-48 h-8 pl-8 pr-3 bg-surface-elevated border border-border rounded-lg text-xs focus:border-accent outline-none transition-all shadow-sm"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                  />
               </div>
            </div>
         </div>
      </div>

      {/* 3. MAIN CONTENT (FULL WIDTH TABLE) */}
      <div className="flex-1 overflow-y-auto bg-background/50 custom-scrollbar">
         <div className="min-w-full inline-block align-middle">
            <div className="border-b border-border">
               <table className="min-w-full">
                  <thead className="bg-surface-sunken/50 sticky top-0 z-10 backdrop-blur-md">
                     <tr>
                        <th scope="col" className="py-3 px-6 text-left text-[10px] font-bold text-foreground-muted uppercase tracking-wider border-b border-border w-32">Code</th>
                        <th scope="col" className="py-3 px-6 text-left text-[10px] font-bold text-foreground-muted uppercase tracking-wider border-b border-border">Material Spec</th>
                        <th scope="col" className="py-3 px-6 text-left text-[10px] font-bold text-foreground-muted uppercase tracking-wider border-b border-border w-40">
                           {activeTab === 'technical' ? 'Status' : 'BoQ Ref'}
                        </th>
                        <th scope="col" className="py-3 px-6 text-left text-[10px] font-bold text-foreground-muted uppercase tracking-wider border-b border-border w-40">
                           {activeTab === 'technical' ? 'Validation' : 'Status'}
                        </th>
                        <th scope="col" className="py-3 px-6 text-left text-[10px] font-bold text-foreground-muted uppercase tracking-wider border-b border-border">
                           {activeTab === 'technical' ? '' : 'Discrepancy'}
                        </th>
                        <th scope="col" className="py-3 px-6 border-b border-border w-16"></th>
                     </tr>
                  </thead>
                  <tbody className="bg-background">
                     {activeTab === 'technical' ? (
                        filteredData.length > 0 ? (
                           filteredData.map(mat => {
                              const matIssues = MOCK_ISSUES.filter(i => i.code === mat.code && i.type === 'technical');
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
                              <td colSpan={6} className="h-64 text-center">
                                 <div className="flex flex-col items-center justify-center text-foreground-muted">
                                    <Filter size={32} className="mb-2 opacity-20" />
                                    <p className="text-sm font-medium">No materials found</p>
                                    <p className="text-xs mt-1">Try adjusting your filters</p>
                                 </div>
                              </td>
                           </tr>
                        )
                     ) : (
                        boqData.length > 0 ? (
                           boqData.map((item) => {
                              const itemIssues = MOCK_ISSUES.filter(i => i.code === item.key && i.type === 'boq');
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
                              <td colSpan={6} className="h-64 text-center text-foreground-muted">
                                 <p className="text-sm">No BoQ items found</p>
                              </td>
                           </tr>
                        )
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
};
