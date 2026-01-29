import React from 'react';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';

export const PdfCompressionView: React.FC = () => {
  const { state } = useAppStore();
  const { t } = useTranslation();
  const { queue, selectedId, outputs } = state.workflow.pdfCompression;

  const selectedQueue = queue.find((item) => item.id === selectedId) || queue[0] || null;
  const selectedOutput = outputs.find((item) => item.id === selectedId) || outputs[outputs.length - 1] || null;
  const previewDoc = selectedQueue || selectedOutput;

  if (!previewDoc) {
    return (
      <div className="flex-1 bg-background h-full relative">
        <div className="absolute inset-0 flex items-center justify-center text-foreground-muted">
          <div className="text-center max-w-md px-6">
            <FileText size={64} className="mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">
              {t('pdfCompression.noDocumentUploaded')}
            </h3>
            <p className="text-sm text-foreground-muted">
              {t('pdfCompression.dropOrClick')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background h-full relative">
      <div className="absolute inset-0 overflow-hidden">
        <iframe
          src={previewDoc.dataUrl}
          className="w-full h-full border-0"
          title={t('pdfCompression.previewTitle')}
        />
      </div>
    </div>
  );
};
