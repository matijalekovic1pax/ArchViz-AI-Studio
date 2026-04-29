import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ClearCanvasConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ClearCanvasConfirmDialog: React.FC<ClearCanvasConfirmDialogProps> = ({
  open,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-[400px] max-w-[92vw] bg-background rounded-2xl shadow-2xl border border-border overflow-hidden animate-scale-in">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-lg font-bold text-foreground">{t('topBar.clearCanvas')}</h3>
          </div>
          <p className="text-sm text-foreground-secondary leading-relaxed mb-6">
            {t('topBar.clearCanvasMessage')}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 text-xs font-bold text-foreground border border-border rounded-lg hover:bg-surface-sunken transition-colors"
            >
              {t('topBar.cancel')}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm"
            >
              {t('topBar.confirmClear')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
