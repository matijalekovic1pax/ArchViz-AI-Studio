
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { cn } from '../../../lib/utils';
import { VideoLockBanner } from '../../video/VideoLockBanner';
import {
   Wand2, Camera, Layers, Film, Trash2, Plus,
   Linkedin, Instagram, Video as VideoIcon, Youtube, Globe,
   Zap, Wind, Sparkles, Star, Clapperboard,
   Lock, Unlock, Eye
} from 'lucide-react';
import { nanoid } from 'nanoid';
import type { SocialMediaPlatform, MotionStyle, SocialMediaPreset } from '../../../types';

// Social Media Presets
const SOCIAL_PRESETS: SocialMediaPreset[] = [
   {
      platform: 'linkedin',
      aspectRatio: '16:9',
      duration: 10,
      resolution: '1080p',
      fps: 30,
      description: 'Professional horizontal video for posts'
   },
   {
      platform: 'instagram-story',
      aspectRatio: '9:16',
      duration: 15,
      resolution: '1080p',
      fps: 30,
      description: 'Vertical story format'
   },
   {
      platform: 'instagram-post',
      aspectRatio: '1:1',
      duration: 15,
      resolution: '1080p',
      fps: 30,
      description: 'Square feed post'
   },
   {
      platform: 'tiktok',
      aspectRatio: '9:16',
      duration: 15,
      resolution: '1080p',
      fps: 30,
      description: 'Short-form vertical'
   },
   {
      platform: 'youtube-shorts',
      aspectRatio: '9:16',
      duration: 15,
      resolution: '1080p',
      fps: 30,
      description: 'YouTube vertical'
   },
   {
      platform: 'website-hero',
      aspectRatio: '21:9',
      duration: 10,
      resolution: '1080p',
      fps: 24,
      description: 'Cinematic banner'
   }
];

// Motion Style Configurations
const MOTION_STYLES: Record<MotionStyle, { motionAmount: number; speed: 'slow' | 'normal' | 'fast'; smoothness: number; icon: typeof Zap }> = {
   smooth: { motionAmount: 3, speed: 'slow', smoothness: 80, icon: Wind },
   dynamic: { motionAmount: 7, speed: 'fast', smoothness: 50, icon: Zap },
   energetic: { motionAmount: 8, speed: 'fast', smoothness: 40, icon: Sparkles },
   elegant: { motionAmount: 4, speed: 'slow', smoothness: 70, icon: Star },
   cinematic: { motionAmount: 5, speed: 'normal', smoothness: 60, icon: Clapperboard },
   subtle: { motionAmount: 2, speed: 'slow', smoothness: 90, icon: Wind },
   dramatic: { motionAmount: 9, speed: 'fast', smoothness: 30, icon: Zap },
   gentle: { motionAmount: 3, speed: 'slow', smoothness: 85, icon: Wind }
};

// Platform Icons
const getPlatformIcon = (platform: SocialMediaPlatform) => {
   switch (platform) {
      case 'linkedin': return Linkedin;
      case 'instagram-story': return Instagram;
      case 'instagram-post': return Instagram;
      case 'tiktok': return VideoIcon;
      case 'youtube-shorts': return Youtube;
      case 'website-hero': return Globe;
      default: return VideoIcon;
   }
};

export const LeftVideoPanel = () => {
   const { state, dispatch } = useAppStore();
   const { t } = useTranslation();
   const video = state.workflow.videoState;
   const isLocked = !video.accessUnlocked;
   const updateVideo = (payload: Partial<typeof video>) => dispatch({ type: 'UPDATE_VIDEO_STATE', payload });
   const updateCamera = (payload: Partial<typeof video.camera>) => dispatch({ type: 'UPDATE_VIDEO_CAMERA', payload });
   const fileInputRef = useRef<HTMLInputElement>(null);

   if (isLocked) {
      return <VideoLockBanner compact />;
   }

   const handleAddKeyframe = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
         const reader = new FileReader();
         reader.onload = (ev) => {
            if (ev.target?.result) {
               const newKeyframe = {
                  id: nanoid(),
                  url: ev.target.result as string,
                  duration: 2
               };
               updateVideo({ keyframes: [...video.keyframes, newKeyframe] });
            }
         };
         reader.readAsDataURL(e.target.files[0]);
      }
   };

   const applyPreset = (preset: SocialMediaPreset) => {
      updateVideo({
         socialMediaPreset: preset.platform,
         aspectRatio: preset.aspectRatio,
         duration: preset.duration,
         resolution: preset.resolution,
         fps: preset.fps
      });
   };

   const applyMotionStyle = (style: MotionStyle) => {
      const config = MOTION_STYLES[style];
      updateVideo({
         motionStyle: style,
         motionAmount: config.motionAmount
      });
      updateCamera({
         speed: config.speed,
         smoothness: config.smoothness
      });
   };

   return (
      <div className="space-y-6">
         {/* Social Media Presets */}
         <div>
            <SectionHeader title={t('rightPanel.video.presets.title')} />
            <div className="grid grid-cols-2 gap-2">
               {SOCIAL_PRESETS.map(preset => {
                  const Icon = getPlatformIcon(preset.platform);
                  const isActive = video.socialMediaPreset === preset.platform;
                  return (
                     <button
                        key={preset.platform}
                        onClick={() => applyPreset(preset)}
                        className={cn(
                           "p-2.5 rounded-lg border text-left transition-all",
                           isActive
                              ? "bg-surface-elevated border-foreground shadow-sm"
                              : "bg-background-tertiary border-transparent hover:bg-surface-elevated hover:border-border"
                        )}
                     >
                        <div className="flex items-center gap-2 mb-1">
                           <div className={cn("p-1.5 rounded", isActive ? "bg-foreground text-background" : "bg-surface-sunken text-foreground-muted")}>
                              <Icon size={14} />
                           </div>
                           <div className="text-[10px] font-bold leading-tight">
                              {preset.platform === 'linkedin' && t('rightPanel.video.presets.linkedin.name')}
                              {preset.platform === 'instagram-story' && t('rightPanel.video.presets.instagramStory.name')}
                              {preset.platform === 'instagram-post' && t('rightPanel.video.presets.instagramPost.name')}
                              {preset.platform === 'tiktok' && t('rightPanel.video.presets.tiktok.name')}
                              {preset.platform === 'youtube-shorts' && t('rightPanel.video.presets.youtubeShorts.name')}
                              {preset.platform === 'website-hero' && t('rightPanel.video.presets.websiteHero.name')}
                           </div>
                        </div>
                        <div className="text-[9px] text-foreground-muted">
                           {preset.aspectRatio} • {preset.duration}s
                        </div>
                     </button>
                  );
               })}
            </div>
         </div>

         {/* Video Mode */}
         <div>
            <SectionHeader title={t('rightPanel.video.inputMode.title')} />
            <div className="space-y-2">
               {[
                  {id: 'image-animate', label: t('rightPanel.video.inputMode.imageAnimate'), description: t('rightPanel.video.inputMode.descriptions.imageAnimate'), icon: Wand2},
                  {id: 'camera-path', label: t('rightPanel.video.inputMode.cameraPath'), description: t('rightPanel.video.inputMode.descriptions.cameraPath'), icon: Camera},
                  {id: 'image-morph', label: t('rightPanel.video.inputMode.imageMorph'), description: t('rightPanel.video.inputMode.descriptions.imageMorph'), icon: Layers},
                  {id: 'multi-shot', label: t('rightPanel.video.inputMode.multiShot'), description: t('rightPanel.video.inputMode.descriptions.multiShot'), icon: Film},
               ].map(m => (
                  <button
                     key={m.id}
                     onClick={() => updateVideo({ inputMode: m.id as any })}
                     className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                        video.inputMode === m.id
                           ? "bg-surface-elevated border-foreground shadow-sm"
                           : "bg-background-tertiary border-transparent hover:bg-surface-elevated hover:border-border"
                     )}
                  >
                     <div className={cn("p-2 rounded-full", video.inputMode === m.id ? "bg-foreground text-background" : "bg-surface-sunken text-foreground-muted")}>
                        <m.icon size={16} />
                     </div>
                     <div>
                        <div className="text-xs font-bold">{m.label}</div>
                        <div className="text-[10px] text-foreground-muted">{m.description}</div>
                     </div>
                  </button>
               ))}
            </div>
         </div>

         {/* Motion Style Presets */}
         <div>
            <SectionHeader title={t('rightPanel.video.motionStyles.title')} />
            <div className="grid grid-cols-2 gap-2">
               {Object.entries(MOTION_STYLES).map(([style, config]) => {
                  const isActive = video.motionStyle === style;
                  const label = t(`rightPanel.video.motionStyles.${style as MotionStyle}.label`);
                  return (
                     <button
                        key={style}
                        onClick={() => applyMotionStyle(style as MotionStyle)}
                        className={cn(
                           "p-2.5 rounded-lg border text-left transition-all",
                           isActive
                              ? "bg-surface-elevated border-foreground shadow-sm"
                              : "bg-background-tertiary border-transparent hover:bg-surface-elevated hover:border-border"
                        )}
                     >
                        <div className="flex items-center gap-2">
                           <div className={cn("p-1.5 rounded", isActive ? "bg-foreground text-background" : "bg-surface-sunken text-foreground-muted")}>
                              <config.icon size={12} />
                           </div>
                           <div className="text-[11px] font-bold">{label}</div>
                        </div>
                     </button>
                  );
               })}
            </div>
         </div>

         {/* Input Sequence (for non-image-animate modes) */}
         {video.inputMode !== 'image-animate' && (
            <div>
               <SectionHeader title={t('rightPanel.video.inputSequence.title')} />
               <div className="grid grid-cols-2 gap-2">
                  {video.keyframes.map((frame, i) => (
                     <div key={frame.id} className="relative group aspect-video bg-black rounded overflow-hidden border border-border">
                        <img src={frame.url} className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                           <button
                              onClick={() => updateVideo({ keyframes: video.keyframes.filter(k => k.id !== frame.id) })}
                              className="p-1 bg-red-500/80 text-white rounded hover:bg-red-500"
                           >
                              <Trash2 size={12} />
                           </button>
                        </div>
                        <div className="absolute bottom-1 left-1 px-1 bg-black/50 text-[9px] text-white rounded">{i+1}</div>
                     </div>
                  ))}
                  <button
                     onClick={() => fileInputRef.current?.click()}
                     className="aspect-video border-2 border-dashed border-border rounded flex flex-col items-center justify-center gap-1 hover:bg-surface-elevated hover:border-foreground-muted transition-colors text-foreground-muted"
                  >
                     <Plus size={16} />
                     <span className="text-[10px]">{t('rightPanel.video.timeline.addKeyframe')}</span>
                  </button>
               </div>
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAddKeyframe} />
            </div>
         )}

         {/* Quick Toggles */}
         <div>
            <SectionHeader title={t('rightPanel.video.quickSettings.title')} />
            <div className="space-y-2">
               <button
                  onClick={() => updateVideo({ compareMode: !video.compareMode })}
                  className={cn(
                     "w-full flex items-center justify-between p-2.5 rounded-lg border transition-all",
                     video.compareMode
                        ? "bg-surface-elevated border-foreground"
                        : "bg-background-tertiary border-transparent hover:bg-surface-elevated hover:border-border"
                  )}
               >
                  <div className="flex items-center gap-2">
                     <Eye size={14} className={video.compareMode ? "text-foreground" : "text-foreground-muted"} />
                     <span className="text-xs font-medium">{t('rightPanel.video.quickSettings.compareMode')}</span>
                  </div>
                  <div className={cn(
                     "px-1.5 py-0.5 rounded text-[9px] font-bold",
                     video.compareMode ? "bg-foreground text-background" : "bg-surface-sunken text-foreground-muted"
                  )}>
                     {video.compareMode ? t('rightPanel.video.quickSettings.on') : t('rightPanel.video.quickSettings.off')}
                  </div>
               </button>

               <button
                  onClick={() => updateVideo({ seedLocked: !video.seedLocked })}
                  className={cn(
                     "w-full flex items-center justify-between p-2.5 rounded-lg border transition-all",
                     video.seedLocked
                        ? "bg-surface-elevated border-foreground"
                        : "bg-background-tertiary border-transparent hover:bg-surface-elevated hover:border-border"
                  )}
               >
                  <div className="flex items-center gap-2">
                     {video.seedLocked ? <Lock size={14} className="text-foreground" /> : <Unlock size={14} className="text-foreground-muted" />}
                     <span className="text-xs font-medium">{t('rightPanel.video.quickSettings.lockSeed')}</span>
                  </div>
                  <div className={cn(
                     "px-1.5 py-0.5 rounded text-[9px] font-bold",
                     video.seedLocked ? "bg-foreground text-background" : "bg-surface-sunken text-foreground-muted"
                  )}>
                     {video.seedLocked ? t('rightPanel.video.quickSettings.locked') : t('rightPanel.video.quickSettings.random')}
                  </div>
               </button>
            </div>
         </div>
      </div>
   );
};
