import React, { useMemo, useState, useCallback } from 'react';
import { Download, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';

const formatFileSize = (bytes: number) => {
  if (!bytes && bytes !== 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${sizes[i]}`;
};

export const PdfCompressionPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const pdfState = state.workflow.pdfCompression;
  const outputs = pdfState.outputs;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Get settings from state or use defaults
  const compressionLevel = pdfState.compressionLevel || 'balanced';

  // Update settings in state
  const updateSetting = useCallback((updates: Partial<typeof pdfState>) => {
    dispatch({
      type: 'UPDATE_WORKFLOW',
      payload: {
        pdfCompression: {
          ...pdfState,
          ...updates,
        },
      },
    });
  }, [pdfState, dispatch]);

  const allSelected = outputs.length > 0 && selectedIds.length === outputs.length;
  const selectedOutputs = useMemo(
    () => outputs.filter((item) => selectedIds.includes(item.id)),
    [outputs, selectedIds]
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(outputs.map((item) => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePreview = useCallback((id: string) => {
    dispatch({
      type: 'UPDATE_WORKFLOW',
      payload: {
        pdfCompression: {
          ...pdfState,
          selectedId: id
        }
      }
    });
  }, [dispatch, pdfState]);

  const downloadItem = (name: string, dataUrl: string) => {
    // Verify the dataUrl before downloading
    const dataUrlSizeEstimate = dataUrl.length * 0.75; // base64 overhead
    console.log(`[Download] Downloading: ${name}`);
    console.log(`[Download] DataURL length: ${dataUrl.length} chars`);
    console.log(`[Download] Estimated file size: ${(dataUrlSizeEstimate / 1024 / 1024).toFixed(2)} MB`);
    console.log(`[Download] DataURL preview: ${dataUrl.substring(0, 100)}...`);

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`[Download] ✓ Download triggered for ${name}`);
  };

  const handleDownloadAll = () => {
    console.log(`[DownloadAll] Downloading ${outputs.length} files`);
    outputs.forEach((item, index) => {
      console.log(`[DownloadAll] Item ${index + 1}: ${item.name}, size=${(item.size / 1024 / 1024).toFixed(2)}MB, dataUrl length=${item.dataUrl.length}`);
      downloadItem(item.name, item.dataUrl);
    });
  };

  const handleDownloadSelected = () => {
    console.log(`[DownloadSelected] Downloading ${selectedOutputs.length} files`);
    selectedOutputs.forEach((item, index) => {
      console.log(`[DownloadSelected] Item ${index + 1}: ${item.name}, size=${(item.size / 1024 / 1024).toFixed(2)}MB, dataUrl length=${item.dataUrl.length}`);
      downloadItem(item.name, item.dataUrl);
    });
  };


  return (
    <div className="space-y-6">
      <div>
        <label className="text-[11px] text-foreground-secondary mb-2 block font-semibold uppercase tracking-wider">
          {t('pdfCompression.levelLabel')}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(['light', 'balanced', 'aggressive'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => updateSetting({ compressionLevel: level })}
              className={cn(
                "text-[11px] font-semibold uppercase border rounded py-2 transition-colors",
                compressionLevel === level
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "border-border text-foreground-secondary hover:text-foreground hover:bg-surface-elevated"
              )}
            >
              {t(`pdfCompression.levels.${level}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
          {t('pdfCompression.processingOutputs')}
        </h3>
        <div className="flex gap-2">
          {outputs.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  console.log('🗑️ Clearing all outputs');
                  dispatch({
                    type: 'UPDATE_WORKFLOW',
                    payload: {
                      pdfCompression: {
                        ...pdfState,
                        outputs: [],
                      },
                    },
                  });
                  setSelectedIds([]);
                }}
                className="text-[10px] font-semibold text-red-500 hover:text-red-600"
              >
                {t('pdfCompression.clearAll')}
              </button>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-[10px] font-semibold text-foreground-muted hover:text-foreground"
              >
                {allSelected ? t('common.reset') : t('pdfCompression.selectAll')}
              </button>
            </>
          )}
        </div>
      </div>

      {outputs.length === 0 ? (
        <div className="bg-surface-sunken border border-border rounded-lg p-4 text-center text-[11px] text-foreground-muted">
          {t('pdfCompression.noOutputs')}
        </div>
      ) : (
        <div className="space-y-2">
          {outputs.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => handlePreview(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handlePreview(item.id);
                  }
                }}
                className={cn(
                  "flex items-center gap-3 p-2 rounded border transition-colors",
                  isSelected ? "border-accent bg-accent/10" : "bg-surface-elevated border-border hover:border-foreground/40"
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => toggleSelect(item.id)}
                  className="accent-foreground"
                />
                <div className="w-8 h-8 rounded bg-surface-sunken flex items-center justify-center">
                  <FileText size={14} className="text-foreground-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{item.name}</div>
                  <div className="text-[10px] text-foreground-muted">{formatFileSize(item.size)}</div>
                </div>
                <button
                  type="button"
                  className="text-foreground-muted hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    downloadItem(item.name, item.dataUrl);
                  }}
                  title={t('pdfCompression.downloadSingle')}
                >
                  <Download size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={handleDownloadAll}
          disabled={outputs.length === 0}
          className={cn(
            "w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border transition-colors",
            outputs.length === 0
              ? "bg-surface-sunken text-foreground-muted border-border cursor-not-allowed"
              : "bg-foreground text-background border-foreground hover:bg-foreground/90"
          )}
        >
          <Download size={14} />
          {t('pdfCompression.downloadAll')}
        </button>
        <button
          type="button"
          onClick={handleDownloadSelected}
          disabled={selectedOutputs.length === 0}
          className={cn(
            "w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border transition-colors",
            selectedOutputs.length === 0
              ? "bg-surface-sunken text-foreground-muted border-border cursor-not-allowed"
              : "bg-surface-elevated text-foreground border-border hover:bg-surface-sunken"
          )}
        >
          <Download size={14} />
          {t('pdfCompression.downloadSelected')}
        </button>
      </div>
    </div>
  );
};
