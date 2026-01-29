
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { Slider } from '../../ui/Slider';
import { cn } from '../../../lib/utils';
import { ChevronDown, ChevronUp, Download, X } from 'lucide-react';
import type { KlingProvider, CameraMotionType } from '../../../types';
import { VideoLockBanner } from '../../video/VideoLockBanner';

export const VideoPanel = () => {
   const { state, dispatch } = useAppStore();
   const { t } = useTranslation();
   const video = state.workflow.videoState;
   const isLocked = !video.accessUnlocked;
   const [advancedOpen, setAdvancedOpen] = useState(false);

   const updateVideo = (payload: Partial<typeof video>) => {
      dispatch({ type: 'UPDATE_VIDEO_STATE', payload });
   };

   const updateCamera = (payload: Partial<typeof video.camera>) => {
      dispatch({ type: 'UPDATE_VIDEO_CAMERA', payload });
   };

   const isGenerating = state.isGenerating;
   const progress = video.generationProgress;

   // Model capabilities
   const isVeo = video.model === 'veo-2';
   const isKling = video.model === 'kling-2.6';
   const maxDuration = isVeo ? 8 : 10;
   const supports4K = isVeo;
   const supportsCameraControls = isKling;

   // Duration options based on mode
   // Veo image-to-video only supports 4, 6, or 8 seconds
   const isImageAnimateMode = video.inputMode === 'image-animate';
   const durationOptions = (isVeo && isImageAnimateMode) ? [4, 6, 8] : [5, 8, 10];

   if (isLocked) {
      return <VideoLockBanner compact />;
   }

   return (
      <div className="space-y-6">
         {/* 1. Model Selection & Provider */}
         <div>
            <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
               {t('rightPanel.video.model.title')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
               <button
                  onClick={() => updateVideo({ model: 'veo-2' })}
                  className={cn(
                     "p-3 rounded-lg border text-left transition-all",
                     isVeo
                        ? "bg-surface-elevated border-foreground shadow-sm"
                        : "bg-background-tertiary border-border hover:bg-surface-elevated"
                  )}
               >
                  <div className="text-xs font-bold mb-0.5">{t('rightPanel.video.model.veo.name')}</div>
                  <div className="text-[10px] text-foreground-muted">{t('rightPanel.video.model.veo.description')}</div>
               </button>
               <button
                  onClick={() => updateVideo({ model: 'kling-2.6' })}
                  className={cn(
                     "p-3 rounded-lg border text-left transition-all",
                     isKling
                        ? "bg-surface-elevated border-foreground shadow-sm"
                        : "bg-background-tertiary border-border hover:bg-surface-elevated"
                  )}
               >
                  <div className="text-xs font-bold mb-0.5">{t('rightPanel.video.model.kling.name')}</div>
                  <div className="text-[10px] text-foreground-muted">{t('rightPanel.video.model.kling.description')}</div>
               </button>
            </div>

            {isKling && (
               <select
                  value={video.klingProvider}
                  onChange={(e) => updateVideo({ klingProvider: e.target.value as KlingProvider })}
                  className="w-full bg-surface-elevated border border-border rounded text-xs h-9 px-3"
               >
                  <option value="piapi">{t('rightPanel.video.model.providers.piapi')}</option>
                  <option value="ulazai">{t('rightPanel.video.model.providers.ulazai')}</option>
                  <option value="wavespeedai">{t('rightPanel.video.model.providers.wavespeedai')}</option>
               </select>
            )}
         </div>

         {/* 2. Duration & Timing */}
         <div>
            <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
               {t('rightPanel.video.duration.label')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
               {durationOptions.map(dur => (
                  <button
                     key={dur}
                     onClick={() => updateVideo({ duration: dur })}
                     disabled={dur > maxDuration}
                     className={cn(
                        "py-2.5 text-xs font-bold border rounded-lg transition-all",
                        video.duration === dur
                           ? "bg-foreground text-background border-foreground"
                           : dur > maxDuration
                              ? "bg-surface-sunken text-foreground-muted border-border cursor-not-allowed opacity-40"
                              : "bg-surface-elevated border-border hover:bg-surface-elevated hover:border-foreground-muted"
                     )}
                  >
                     {dur}s
                  </button>
               ))}
            </div>
         </div>

         {/* 3. Format & Quality */}
         <div>
            <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
               {t('rightPanel.video.aspectRatio.label')}
            </label>
            <div className="grid grid-cols-5 gap-1.5 mb-4">
               {(['16:9', '9:16', '1:1', '4:3', '21:9'] as const).map(ratio => (
                  <button
                     key={ratio}
                     onClick={() => updateVideo({ aspectRatio: ratio })}
                     className={cn(
                        "py-2 text-[10px] font-bold border rounded transition-all",
                        video.aspectRatio === ratio
                           ? "bg-foreground text-background border-foreground"
                           : "bg-surface-elevated border-border hover:border-foreground-muted"
                     )}
                  >
                     {ratio}
                  </button>
               ))}
            </div>

            <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
               {t('rightPanel.video.resolution.label')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
               {(['720p', '1080p', '4k'] as const).map(res => (
                  <button
                     key={res}
                     onClick={() => updateVideo({ resolution: res })}
                     disabled={res === '4k' && !supports4K}
                     className={cn(
                        "py-2.5 text-xs font-bold border rounded-lg transition-all",
                        video.resolution === res
                           ? "bg-foreground text-background border-foreground"
                           : res === '4k' && !supports4K
                              ? "bg-surface-sunken text-foreground-muted border-border cursor-not-allowed opacity-40"
                              : "bg-surface-elevated border-border hover:border-foreground-muted"
                     )}
                  >
                     {res === '4k' ? '4K' : res.toUpperCase()}
                  </button>
               ))}
            </div>

            <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
               {t('rightPanel.video.frameRate.label')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
               {[24, 30, 60].map(fps => (
                  <button
                     key={fps}
                     onClick={() => updateVideo({ fps: fps as 24 | 30 | 60 })}
                     className={cn(
                        "py-2.5 text-xs font-bold border rounded-lg transition-all",
                        video.fps === fps
                           ? "bg-foreground text-background border-foreground"
                           : "bg-surface-elevated border-border hover:border-foreground-muted"
                     )}
                  >
                     {fps} FPS
                  </button>
               ))}
            </div>
         </div>

         {/* 4. Camera Motion (Kling only) */}
         {supportsCameraControls && (
            <div>
               <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
                  {t('rightPanel.video.camera.type.label')}
               </label>
               <select
                  value={video.camera.type}
                  onChange={(e) => updateCamera({ type: e.target.value as CameraMotionType })}
                  className="w-full bg-surface-elevated border border-border rounded text-xs h-9 px-3 mb-3"
               >
                  <option value="static">{t('rightPanel.video.camera.type.static')}</option>
                  <option value="pan">{t('rightPanel.video.camera.type.pan')}</option>
                  <option value="orbit">{t('rightPanel.video.camera.type.orbit')}</option>
                  <option value="dolly">{t('rightPanel.video.camera.type.dolly')}</option>
                  <option value="crane">{t('rightPanel.video.camera.type.crane')}</option>
                  <option value="drone">{t('rightPanel.video.camera.type.drone')}</option>
                  <option value="rotate">{t('rightPanel.video.camera.type.rotate')}</option>
                  <option value="push-in">{t('rightPanel.video.camera.type.pushIn')}</option>
                  <option value="pull-out">{t('rightPanel.video.camera.type.pullOut')}</option>
                  <option value="custom">{t('rightPanel.video.camera.type.custom')}</option>
               </select>

               {video.camera.type !== 'static' && (
                  <>
                     <div className="mb-3">
                        <label className="text-[10px] text-foreground-muted mb-2 block font-medium">
                           {t('rightPanel.video.camera.directionValue', { value: video.camera.direction })}
                        </label>
                        <input
                           type="range"
                           min={0}
                           max={360}
                           value={video.camera.direction}
                           onChange={(e) => updateCamera({ direction: parseInt(e.target.value) })}
                           className="w-full h-2 bg-surface-sunken rounded-lg appearance-none cursor-pointer"
                        />
                     </div>

                     <label className="text-[10px] text-foreground-muted mb-2 block font-medium">
                        {t('rightPanel.video.camera.speed.label')}
                     </label>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                        {(['slow', 'normal', 'fast'] as const).map(speed => (
                           <button
                              key={speed}
                              onClick={() => updateCamera({ speed })}
                              className={cn(
                                 "py-2 text-[10px] font-bold border rounded transition-all capitalize",
                                 video.camera.speed === speed
                                    ? "bg-foreground text-background border-foreground"
                                    : "bg-surface-elevated border-border hover:border-foreground-muted"
                              )}
                           >
                              {t(`rightPanel.video.camera.speed.${speed}`)}
                           </button>
                        ))}
                     </div>

                     <Slider
                        label={t('rightPanel.video.camera.smoothness')}
                        value={video.camera.smoothness}
                        min={0}
                        max={100}
                        onChange={(val) => updateCamera({ smoothness: val })}
                     />
                  </>
               )}
            </div>
         )}

         {/* 5. Motion Controls */}
         <div>
            <Slider
               label={t('rightPanel.video.motionAmount.label')}
               value={video.motionAmount}
               min={1}
               max={10}
               onChange={(val) => updateVideo({ motionAmount: val })}
            />
         </div>

         {/* 6. Advanced Settings (Collapsible) */}
         <div>
            <button
               onClick={() => setAdvancedOpen(!advancedOpen)}
               className="w-full flex items-center justify-between text-xs text-foreground-muted mb-2 font-bold uppercase tracking-wider hover:text-foreground transition-colors"
            >
               <span>{t('rightPanel.video.advanced.title')}</span>
               {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {advancedOpen && (
               <div className="space-y-3 pt-2">
                  <div>
                     <label className="text-[10px] text-foreground-muted mb-2 block font-medium">
                        {t('rightPanel.video.seed.label')} {video.seedLocked && `(${video.seed})`}
                     </label>
                     <input
                        type="number"
                        value={video.seed}
                        onChange={(e) => updateVideo({ seed: parseInt(e.target.value) || 0 })}
                        className="w-full bg-surface-elevated border border-border rounded text-xs h-9 px-3"
                        disabled={!video.seedLocked}
                     />
                  </div>

                  <div>
                     <label className="text-[10px] text-foreground-muted mb-2 block font-medium">
                        {t('rightPanel.video.quality.label')}
                     </label>
                     <select
                        value={video.quality}
                        onChange={(e) => updateVideo({ quality: e.target.value as any })}
                        className="w-full bg-surface-elevated border border-border rounded text-xs h-9 px-3"
                     >
                        <option value="draft">{t('rightPanel.video.quality.draft')}</option>
                        <option value="standard">{t('rightPanel.video.quality.standard')}</option>
                        <option value="high">{t('rightPanel.video.quality.high')}</option>
                        <option value="ultra">{t('rightPanel.video.quality.ultra')}</option>
                     </select>
                  </div>

                  {video.inputMode !== 'image-animate' && (
                     <div>
                        <label className="text-[10px] text-foreground-muted mb-2 block font-medium">
                           {t('rightPanel.video.transition.label')}
                        </label>
                        <select
                           value={video.transitionEffect}
                           onChange={(e) => updateVideo({ transitionEffect: e.target.value as any })}
                           className="w-full bg-surface-elevated border border-border rounded text-xs h-9 px-3"
                        >
                           <option value="cut">{t('rightPanel.video.transition.cut')}</option>
                           <option value="fade">{t('rightPanel.video.transition.fade')}</option>
                           <option value="dissolve">{t('rightPanel.video.transition.dissolve')}</option>
                           <option value="wipe">{t('rightPanel.video.transition.wipe')}</option>
                           <option value="none">{t('rightPanel.video.transition.none')}</option>
                        </select>
                     </div>
                  )}
               </div>
            )}
         </div>

         {/* 7. Generation Progress */}
         {isGenerating && progress && (
            <div className="p-4 bg-surface-elevated rounded-lg border border-border">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold">{progress.message || t('rightPanel.video.progress.processing')}</span>
                  <span className="text-xs text-foreground-muted">{progress.progress}%</span>
               </div>
               <div className="w-full bg-surface-sunken rounded-full h-2 overflow-hidden">
                  <div
                     className="bg-foreground h-full transition-all duration-300"
                     style={{ width: `${progress.progress}%` }}
                  />
               </div>
               {progress.estimatedTimeRemaining && (
                  <div className="text-[10px] text-foreground-muted mt-2">
                     {t('rightPanel.video.progress.eta', { seconds: Math.ceil(progress.estimatedTimeRemaining) })}
                  </div>
               )}
            </div>
         )}

         {/* 8. Output Preview & History */}
         {video.generatedVideoUrl && !isGenerating && (
            <div>
               <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
                  {t('rightPanel.video.output.title')}
               </label>
               <div className="space-y-3">
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-border">
                     <video
                        src={video.generatedVideoUrl}
                        controls
                        className="w-full h-full"
                     />
                  </div>
                  <button
                     onClick={() => {
                        const a = document.createElement('a');
                        a.href = video.generatedVideoUrl!;
                        a.download = `video-${Date.now()}.mp4`;
                        a.click();
                     }}
                     className="w-full flex items-center justify-center gap-2 py-2.5 bg-foreground text-background rounded-lg font-bold text-xs hover:opacity-90 transition-opacity"
                  >
                     <Download size={14} />
                     {t('rightPanel.video.output.download')}
                  </button>
               </div>
            </div>
         )}

         {/* Generation History */}
         {video.generationHistory.length > 0 && (
            <div>
               <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
                  {t('rightPanel.video.output.recentGenerations')}
               </label>
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {video.generationHistory.slice(-6).reverse().map((item) => (
                     <div
                        key={item.id}
                        className="relative aspect-video bg-black rounded overflow-hidden border border-border cursor-pointer hover:border-foreground-muted transition-colors group"
                        onClick={() => updateVideo({ generatedVideoUrl: item.url })}
                     >
                        <video src={item.url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <div className="text-white text-[10px] font-bold">{t('rightPanel.video.output.load')}</div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         )}
      </div>
   );
};
