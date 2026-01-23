
import React, { useRef } from 'react';
import { nanoid } from 'nanoid';
import { SectionHeader } from './SharedLeftComponents';
import { cn } from '../../../lib/utils';
import { FileText, FileSpreadsheet, UploadCloud, MoreHorizontal } from 'lucide-react';
import { Toggle } from '../../ui/Toggle';
import { useAppStore } from '../../../store';
import type { MaterialValidationDocument } from '../../../types';

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const getDocType = (doc: MaterialValidationDocument) => {
  const name = doc.name.toLowerCase();
  if (name.endsWith('.pdf') || doc.mimeType.includes('pdf')) return 'pdf';
  if (name.endsWith('.csv') || doc.mimeType.includes('csv')) return 'csv';
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || doc.mimeType.includes('spreadsheet')) return 'xls';
  return 'doc';
};

export const LeftValidationPanel = () => {
    const { state, dispatch } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { documents, checks } = state.materialValidation;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
       if (!e.target.files?.length) return;
       const files = Array.from(e.target.files);
       Promise.all(
          files.map((file) =>
             new Promise<MaterialValidationDocument>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                   resolve({
                      id: nanoid(),
                      name: file.name,
                      mimeType: file.type || 'application/octet-stream',
                      size: file.size,
                      dataUrl: reader.result as string,
                      uploadedAt: Date.now()
                   });
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
             })
          )
       )
          .then((newDocs) => {
             dispatch({
                type: 'UPDATE_MATERIAL_VALIDATION',
                payload: { documents: [...documents, ...newDocs], error: null }
             });
          })
          .catch((error) => {
             dispatch({
                type: 'UPDATE_MATERIAL_VALIDATION',
                payload: { error: error?.message || 'Failed to load documents.' }
             });
          })
          .finally(() => {
             if (fileInputRef.current) {
                fileInputRef.current.value = '';
             }
          });
    };

    return (
      <div className="space-y-6">
        <div>
           <SectionHeader title="Project Documents" />
           {documents.length === 0 ? (
              <div className="mb-4 rounded-lg border border-dashed border-border-subtle p-4 text-center text-[10px] text-foreground-muted">
                 No documents uploaded yet.
              </div>
           ) : (
              <div className="space-y-2 mb-4">
                 {documents.map(doc => {
                    const docType = getDocType(doc);
                    return (
                       <div key={doc.id} className="p-2.5 bg-surface-elevated border border-border rounded-lg group hover:border-foreground-muted transition-colors relative">
                          <div className="flex items-start gap-3">
                             <div className={cn(
                                "w-8 h-8 rounded flex items-center justify-center text-xs font-bold uppercase",
                                docType === 'pdf' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                             )}>
                                {docType === 'pdf' ? <FileText size={14} /> : <FileSpreadsheet size={14} />}
                             </div>
                             <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium truncate text-foreground">{doc.name}</div>
                                <div className="text-[10px] text-foreground-muted flex items-center gap-1.5 mt-0.5">
                                   <span>{formatBytes(doc.size)}</span>
                                   <span className="w-0.5 h-0.5 rounded-full bg-border-strong" />
                                   <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                </div>
                             </div>
                             <button className="text-foreground-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal size={14} />
                             </button>
                          </div>
                          <div className="absolute top-2 right-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-green-500 ring-2 ring-white" title="Ready" />
                          </div>
                       </div>
                    );
                 })}
              </div>
           )}

           <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.xls,.xlsx,.csv"
              multiple
              onChange={handleFileSelect}
           />
           <button
              className="w-full py-3 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-1 text-foreground-muted hover:text-foreground hover:bg-surface-elevated hover:border-foreground-muted transition-all"
              onClick={() => fileInputRef.current?.click()}
           >
              <UploadCloud size={20} className="mb-1" />
              <span className="text-xs font-medium">Upload Document</span>
              <span className="text-[9px] text-foreground-muted/80">PDF, Excel, CSV</span>
           </button>
        </div>

        <div>
           <SectionHeader title="Validation Scope" />
           <div className="bg-surface-sunken p-3 rounded-lg space-y-3 border border-border-subtle">
              <label className="flex items-center gap-2 cursor-pointer group">
                 <Toggle
                    label=""
                    checked={checks.crossReferenceBoq}
                    onChange={(checked) =>
                       dispatch({
                          type: 'UPDATE_MATERIAL_VALIDATION',
                          payload: { checks: { ...checks, crossReferenceBoq: checked } }
                       })
                    }
                 />
                 <div className="flex-1">
                    <div className="text-xs font-medium group-hover:text-foreground">Cross-Reference BoQ</div>
                    <div className="text-[10px] text-foreground-muted">Compare against Bill of Quantities</div>
                 </div>
              </label>
              <div className="h-px bg-border-subtle" />
              <label className="flex items-center gap-2 cursor-pointer group">
                 <Toggle
                    label=""
                    checked={checks.technicalSpec}
                    onChange={(checked) =>
                       dispatch({
                          type: 'UPDATE_MATERIAL_VALIDATION',
                          payload: { checks: { ...checks, technicalSpec: checked } }
                       })
                    }
                 />
                 <div className="flex-1">
                    <div className="text-xs font-medium group-hover:text-foreground">Tech. Specification</div>
                    <div className="text-[10px] text-foreground-muted">Validate norms & standards</div>
                 </div>
              </label>
           </div>
        </div>
      </div>
    );
};
