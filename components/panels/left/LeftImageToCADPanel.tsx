
import React, { useCallback, useState } from 'react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { cn } from '../../../lib/utils';
import {
  getGeminiService,
  initGeminiService,
  isGeminiServiceInitialized,
  ImageUtils
} from '../../../services/geminiService';
import { isGatewayAuthenticated } from '../../../services/apiGateway';

export const LeftImageToCADPanel = () => {
   const { state, dispatch } = useAppStore();
   const wf = state.workflow;
   const [isPreprocessing, setIsPreprocessing] = useState(false);
   const [preprocessError, setPreprocessError] = useState<string | null>(null);
   const sourceImage = state.sourceImage || state.uploadedImage;

   const updateWf = useCallback(
      (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
      [dispatch]
   );

   const ensureServiceInitialized = useCallback((): boolean => {
      if (isGeminiServiceInitialized()) {
         return true;
      }
      if (!isGatewayAuthenticated()) {
         return false;
      }
      initGeminiService();
      return true;
   }, []);

   const extractJson = (raw: string) => {
      if (!raw) return null;
      try {
         return JSON.parse(raw);
      } catch {
         const start = raw.indexOf('{');
         const end = raw.lastIndexOf('}');
         if (start === -1 || end === -1 || end <= start) return null;
         try {
            return JSON.parse(raw.slice(start, end + 1));
         } catch {
            return null;
         }
      }
   };

   const handlePreprocess = useCallback(async () => {
      if (isPreprocessing) return;
      if (!sourceImage) {
         setPreprocessError('Upload an image to run CAD pre-processing.');
         return;
      }
      if (!ensureServiceInitialized()) {
         setPreprocessError('Please sign in to use AI pre-processing.');
         return;
      }

      setPreprocessError(null);
      setIsPreprocessing(true);

      try {
         const service = getGeminiService();
         const imageData = ImageUtils.dataUrlToImageData(sourceImage);
         const prompt = [
            'Analyze the image and produce CAD-focused guidance for tracing and drawing.',
            'Return ONLY JSON with this shape:',
            '{ "guidance": "...", "focus": ["...","..."] }.',
            'Guidance should mention key geometry, primary edges, symmetry, openings, and scale cues.',
            'Focus should be 3-8 short items describing what to prioritize in CAD drafting.'
         ].join(' ');

         const responseText = await service.generateText({
            prompt,
            images: [imageData],
            generationConfig: {
               temperature: 0.2,
               maxOutputTokens: 900,
               responseMimeType: 'application/json'
            }
         });

         const parsed = extractJson(responseText || '');
         const guidance = typeof parsed?.guidance === 'string' ? parsed.guidance.trim() : '';
         const focus = Array.isArray(parsed?.focus)
            ? parsed.focus.filter((item: any) => typeof item === 'string').slice(0, 8)
            : [];

         if (!guidance) {
            setPreprocessError('No guidance detected. Try again.');
            return;
         }

         updateWf({ imgToCadPreprocess: { guidance, focus } });
      } catch (error) {
        setPreprocessError('Pre-processing failed. Please try again.');
      } finally {
        setIsPreprocessing(false);
      }
   }, [ensureServiceInitialized, isPreprocessing, sourceImage, updateWf]);

   return (
      <div className="space-y-6">
         <div>
            <SectionHeader title="Image Setup" />
            <div className="space-y-4">
               <div>
                  <label className="text-xs text-foreground-muted mb-2 block">Image Type</label>
                  <SegmentedControl 
                     value={wf.imgToCadType}
                     options={[{label: 'Photo', value: 'photo'}, {label: 'Render', value: 'render'}]}
                     onChange={(v) => updateWf({ imgToCadType: v })}
                  />
               </div>
            </div>
         </div>

         <div>
            <SectionHeader title="AI Pre-processing" />
            <div className="space-y-3">
               <button
                  type="button"
                  onClick={handlePreprocess}
                  disabled={isPreprocessing || !sourceImage}
                  className={cn(
                     "w-full py-2 text-xs font-semibold rounded border transition-colors",
                     isPreprocessing || !sourceImage
                        ? "bg-surface-sunken text-foreground-muted border-border"
                        : "bg-foreground text-background border-foreground hover:opacity-90"
                  )}
               >
                  {isPreprocessing ? 'Analyzing Image...' : 'Generate CAD Guidance'}
               </button>
               {!sourceImage && (
                  <div className="text-[10px] text-foreground-muted">
                     Upload an image to run CAD pre-processing.
                  </div>
               )}
               {preprocessError && (
                  <div className="text-[10px] text-red-600 font-medium">
                     {preprocessError}
                  </div>
               )}
               <div className="space-y-2">
                  <label className="text-xs text-foreground-muted mb-1 block">Guidance</label>
                  <textarea
                     value={wf.imgToCadPreprocess.guidance}
                     onChange={(e) => updateWf({ imgToCadPreprocess: { ...wf.imgToCadPreprocess, guidance: e.target.value } })}
                     className="w-full min-h-[80px] bg-surface-elevated border border-border rounded text-xs px-2 py-2"
                     placeholder="AI guidance will appear here. You can edit it before generating."
                  />
               </div>
               {wf.imgToCadPreprocess.focus.length > 0 && (
                  <div className="space-y-2">
                     <div className="text-[10px] uppercase tracking-wider text-foreground-muted">Focus Areas</div>
                     <div className="flex flex-wrap gap-2">
                        {wf.imgToCadPreprocess.focus.map((item, index) => (
                           <span key={`${item}-${index}`} className="px-2 py-1 rounded bg-surface-sunken border border-border text-[10px]">
                              {item}
                           </span>
                        ))}
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
};

