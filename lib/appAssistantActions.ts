import type {
  Action,
  AppState,
  CameraState,
  CanvasState,
  ContextState,
  DocumentTranslateState,
  GenerationMode,
  GeometryState,
  LightingState,
  MaterialValidationState,
  MaterialState,
  OutputState,
  WorkflowSettings,
} from '../types';
import { BUILT_IN_STYLES } from '../engine/promptEngine';

export type AppAssistantActionType =
  | 'set_mode'
  | 'set_style'
  | 'set_prompt'
  | 'set_workflow'
  | 'set_geometry'
  | 'set_camera'
  | 'set_lighting'
  | 'set_materials'
  | 'set_context'
  | 'set_output'
  | 'set_canvas'
  | 'set_material_validation'
  | 'set_document_translate'
  | 'set_active_right_tab'
  | 'set_active_bottom_tab'
  | 'open_right_panel'
  | 'close_right_panel'
  | 'open_left_sidebar'
  | 'close_left_sidebar'
  | 'open_bottom_panel'
  | 'collapse_bottom_panel'
  | 'run_generation'
  | 'run_preprocess'
  | 'use_chat_image'
  | 'prepare_image_selection'
  | 'clear_image_selections'
  | 'reset_canvas_view'
  | 'clear_canvas'
  | 'set_source_from_current'
  | 'use_latest_history_image'
  | 'clear_prompt';

export interface AppAssistantActionRequest {
  type?: AppAssistantActionType;
  label?: string;
  reason?: string;
  mode?: GenerationMode;
  path?: string;
  value?: unknown;
  imageTarget?: AppAssistantImageTarget;
  attachmentId?: string;
  caption?: string;
}

export interface AppAssistantAction {
  id: string;
  type: AppAssistantActionType;
  label: string;
  reason?: string;
  mode?: GenerationMode;
  path?: string;
  value?: unknown;
  imageTarget?: AppAssistantImageTarget;
  attachmentId?: string;
  caption?: string;
}

export type AppAssistantImageTarget =
  | 'canvas'
  | 'source'
  | 'style-reference'
  | 'background-reference'
  | 'visual-material-reference'
  | 'visual-background-reference'
  | 'scene-compose-reference'
  | 'sketch-reference'
  | 'video-input'
  | 'headshot-left'
  | 'headshot-front'
  | 'headshot-right';

export interface AppAssistantChatImage {
  id: string;
  url: string;
  name?: string;
}

type ActionTarget =
  | 'workflow'
  | 'geometry'
  | 'camera'
  | 'lighting'
  | 'materials'
  | 'context'
  | 'output'
  | 'canvas'
  | 'materialValidation'
  | 'documentTranslate';
type ValueType = 'string' | 'number' | 'boolean';

interface PathDescriptor {
  type: Extract<AppAssistantActionType, 'set_workflow' | 'set_geometry' | 'set_camera' | 'set_lighting' | 'set_materials' | 'set_context' | 'set_output' | 'set_canvas' | 'set_material_validation' | 'set_document_translate'>;
  path: string;
  label: string;
  valueType: ValueType;
  modes?: GenerationMode[];
  values?: readonly unknown[];
  min?: number;
  max?: number;
}

const GENERATION_MODES: readonly GenerationMode[] = [
  'generate-text',
  'render-3d',
  'scene-compose',
  'render-cad',
  'masterplan',
  'visual-edit',
  'exploded',
  'section',
  'render-sketch',
  'multi-angle',
  'upscale',
  'img-to-cad',
  'video',
  'material-validation',
  'document-translate',
  'pdf-compression',
  'headshot',
] as const;

const workflow = (
  path: string,
  label: string,
  valueType: ValueType,
  modes: GenerationMode[],
  options: Omit<PathDescriptor, 'type' | 'path' | 'label' | 'valueType' | 'modes'> = {}
): PathDescriptor => ({ type: 'set_workflow', path, label, valueType, modes, ...options });

const geometry = (
  path: string,
  label: string,
  valueType: ValueType,
  options: Omit<PathDescriptor, 'type' | 'path' | 'label' | 'valueType'> = {}
): PathDescriptor => ({ type: 'set_geometry', path, label, valueType, ...options });

const camera = (
  path: string,
  label: string,
  valueType: ValueType,
  options: Omit<PathDescriptor, 'type' | 'path' | 'label' | 'valueType'> = {}
): PathDescriptor => ({ type: 'set_camera', path, label, valueType, ...options });

const lighting = (
  path: string,
  label: string,
  valueType: ValueType,
  options: Omit<PathDescriptor, 'type' | 'path' | 'label' | 'valueType'> = {}
): PathDescriptor => ({ type: 'set_lighting', path, label, valueType, ...options });

const materials = (
  path: string,
  label: string,
  valueType: ValueType,
  options: Omit<PathDescriptor, 'type' | 'path' | 'label' | 'valueType'> = {}
): PathDescriptor => ({ type: 'set_materials', path, label, valueType, ...options });

const context = (
  path: string,
  label: string,
  valueType: ValueType,
  options: Omit<PathDescriptor, 'type' | 'path' | 'label' | 'valueType'> = {}
): PathDescriptor => ({ type: 'set_context', path, label, valueType, ...options });

const output = (
  path: string,
  label: string,
  valueType: ValueType,
  options: Omit<PathDescriptor, 'type' | 'path' | 'label' | 'valueType'> = {}
): PathDescriptor => ({ type: 'set_output', path, label, valueType, ...options });

const canvas = (
  path: string,
  label: string,
  valueType: ValueType,
  options: Omit<PathDescriptor, 'type' | 'path' | 'label' | 'valueType'> = {}
): PathDescriptor => ({ type: 'set_canvas', path, label, valueType, ...options });

const materialValidation = (
  path: string,
  label: string,
  valueType: ValueType,
  options: Omit<PathDescriptor, 'type' | 'path' | 'label' | 'valueType' | 'modes'> = {}
): PathDescriptor => ({ type: 'set_material_validation', path, label, valueType, modes: ['material-validation'], ...options });

const documentTranslate = (
  path: string,
  label: string,
  valueType: ValueType,
  options: Omit<PathDescriptor, 'type' | 'path' | 'label' | 'valueType' | 'modes'> = {}
): PathDescriptor => ({ type: 'set_document_translate', path, label, valueType, modes: ['document-translate'], ...options });

const PATH_DESCRIPTORS: PathDescriptor[] = [
  workflow('textPrompt', 'Text prompt', 'string', ['generate-text']),

  workflow('sourceType', '3D source type', 'string', ['render-3d'], {
    values: ['revit', 'rhino', 'sketchup', 'blender', '3dsmax', 'archicad', 'cinema4d', 'clay', 'other'],
  }),
  workflow('viewType', '3D view type', 'string', ['render-3d'], {
    values: ['exterior', 'interior', 'aerial', 'detail'],
  }),
  workflow('renderMode', 'Generation mode', 'string', ['render-3d', 'render-cad', 'masterplan', 'render-sketch', 'exploded', 'section'], {
    values: ['strict-realism', 'enhance', 'concept-push'],
  }),
  workflow('styleReferenceEnabled', 'Style reference enabled', 'boolean', ['render-3d', 'render-cad']),
  workflow('backgroundReferenceEnabled', 'Background reference enabled', 'boolean', ['render-3d', 'render-cad']),
  workflow('render3d.lighting.sun.enabled', 'Light Source enabled', 'boolean', ['render-3d']),
  workflow('render3d.lighting.sun.azimuth', 'Light Source left/right position', 'number', ['render-3d'], { min: 0, max: 360 }),
  workflow('render3d.lighting.sun.elevation', 'Light Source front/back position', 'number', ['render-3d'], { min: 0, max: 90 }),
  workflow('render3d.lighting.sun.intensity', 'Light Source intensity', 'number', ['render-3d'], { min: 0, max: 200 }),
  workflow('render3d.lighting.sun.colorTemp', 'Light Source color temperature', 'number', ['render-3d'], { min: 2000, max: 12000 }),
  workflow('render3d.lighting.shadows.enabled', 'Shadows enabled', 'boolean', ['render-3d']),
  workflow('render3d.lighting.shadows.intensity', 'Shadow opacity', 'number', ['render-3d'], { min: 0, max: 100 }),
  workflow('render3d.lighting.preset', 'Lighting preset', 'string', ['render-3d']),
  workflow('render3d.atmosphere.mood', 'Atmosphere mood', 'string', ['render-3d']),
  workflow('render3d.atmosphere.fog.enabled', 'Fog enabled', 'boolean', ['render-3d']),
  workflow('render3d.atmosphere.fog.density', 'Fog density', 'number', ['render-3d'], { min: 0, max: 100 }),
  workflow('render3d.atmosphere.bloom.enabled', 'Bloom enabled', 'boolean', ['render-3d']),
  workflow('render3d.atmosphere.bloom.intensity', 'Bloom intensity', 'number', ['render-3d'], { min: 0, max: 100 }),
  workflow('render3d.scenery.people.enabled', 'People enabled', 'boolean', ['render-3d']),
  workflow('render3d.scenery.people.count', 'People count', 'number', ['render-3d'], { min: 0, max: 100 }),
  workflow('render3d.scenery.trees.enabled', 'Vegetation enabled', 'boolean', ['render-3d']),
  workflow('render3d.scenery.trees.count', 'Vegetation density', 'number', ['render-3d'], { min: 0, max: 100 }),
  workflow('render3d.scenery.cars.enabled', 'Vehicles enabled', 'boolean', ['render-3d']),
  workflow('render3d.scenery.cars.count', 'Vehicle count', 'number', ['render-3d'], { min: 0, max: 50 }),
  workflow('render3d.scenery.preset', 'Scenery preset', 'string', ['render-3d']),
  workflow('render3d.render.resolution', 'Render resolution', 'string', ['render-3d'], {
    values: ['720p', '1080p', '4k', 'print'],
  }),
  workflow('render3d.render.aspectRatio', 'Render aspect ratio', 'string', ['render-3d'], {
    values: ['16:9', '4:3', '3:2', '1:1', '21:9', '9:16'],
  }),

  workflow('cadDrawingType', 'CAD drawing type', 'string', ['render-cad'], {
    values: ['plan', 'section', 'elevation', 'site'],
  }),
  workflow('cadScale', 'CAD scale', 'string', ['render-cad']),
  workflow('cadLayerDetectionEnabled', 'CAD layer detection', 'boolean', ['render-cad']),
  workflow('cadCamera.height', 'CAD camera height', 'number', ['render-cad'], { min: 0.2, max: 20 }),
  workflow('cadCamera.focalLength', 'CAD focal length', 'number', ['render-cad'], { min: 12, max: 120 }),
  workflow('cadCamera.lookAt', 'CAD camera direction', 'string', ['render-cad'], {
    values: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
  }),
  workflow('cadSpace.roomType', 'CAD room/project type', 'string', ['render-cad']),
  workflow('cadFurnishing.auto', 'CAD auto furnishing', 'boolean', ['render-cad']),
  workflow('cadFurnishing.occupancy', 'CAD occupancy', 'string', ['render-cad'], {
    values: ['empty', 'staged', 'lived-in'],
  }),
  workflow('cadFurnishing.density', 'CAD furnishing density', 'number', ['render-cad'], { min: 0, max: 100 }),

  workflow('mpPlanType', 'Masterplan type', 'string', ['masterplan'], {
    values: ['site', 'urban', 'zoning', 'massing'],
  }),
  workflow('mpScale', 'Masterplan scale', 'string', ['masterplan'], {
    values: ['1:200', '1:500', '1:1000', '1:2500', '1:5000', '1:10000', 'custom'],
  }),
  workflow('mpZoneDetection', 'Zone detection', 'string', ['masterplan'], { values: ['auto', 'manual'] }),
  workflow('mpBoundary.mode', 'Boundary mode', 'string', ['masterplan'], { values: ['auto', 'custom', 'full'] }),
  workflow('mpOutputStyle', 'Masterplan output style', 'string', ['masterplan'], {
    values: ['photorealistic', 'diagrammatic', 'hybrid', 'illustrative'],
  }),
  workflow('mpViewAngle', 'Masterplan view angle', 'string', ['masterplan'], {
    values: ['top', 'iso-ne', 'iso-nw', 'iso-se', 'iso-sw', 'custom'],
  }),
  workflow('mpContext.location', 'Location context', 'string', ['masterplan']),
  workflow('mpLandscape.vegetationDensity', 'Vegetation density', 'number', ['masterplan'], { min: 0, max: 100 }),
  workflow('mpLegend.include', 'Legend', 'boolean', ['masterplan']),
  workflow('mpAnnotations.northArrow', 'North arrow', 'boolean', ['masterplan']),
  workflow('mpAnnotations.scaleBar', 'Scale bar', 'boolean', ['masterplan']),

  workflow('activeTool', 'Visual Edit tool', 'string', ['visual-edit'], {
    values: ['select', 'material', 'lighting', 'object', 'sky', 'remove', 'replace', 'adjust', 'extend', 'background', 'people'],
  }),
  workflow('visualPrompt', 'Visual edit prompt', 'string', ['visual-edit']),
  workflow('visualSelection.mode', 'Selection mode', 'string', ['visual-edit'], {
    values: ['rect', 'brush', 'lasso', 'ai', 'erase', 'adjust'],
  }),
  workflow('visualSelection.brushSize', 'Selection brush size', 'number', ['visual-edit'], { min: 4, max: 180 }),
  workflow('visualSelection.featherEnabled', 'Selection feather', 'boolean', ['visual-edit']),
  workflow('visualSelection.featherAmount', 'Selection feather amount', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualSelection.strength', 'Selection strength', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualMaterial.category', 'Material category', 'string', ['visual-edit'], {
    values: ['Flooring', 'Wall', 'Facade', 'Roof', 'Metal', 'Glass', 'Stone', 'Fabric'],
  }),
  workflow('visualMaterial.referenceEnabled', 'Material reference', 'boolean', ['visual-edit']),
  workflow('visualMaterial.scale', 'Material scale', 'number', ['visual-edit'], { min: 1, max: 200 }),
  workflow('visualLighting.mode', 'Lighting mode', 'string', ['visual-edit'], { values: ['sun', 'hdri', 'artificial'] }),
  workflow('visualLighting.sun.azimuth', 'Visual Edit Light Source left/right position', 'number', ['visual-edit'], { min: 0, max: 360 }),
  workflow('visualLighting.sun.elevation', 'Visual Edit Light Source front/back position', 'number', ['visual-edit'], { min: 0, max: 90 }),
  workflow('visualLighting.sun.intensity', 'Visual Edit Light Source intensity', 'number', ['visual-edit'], { min: 0, max: 200 }),
  workflow('visualLighting.sun.colorTemp', 'Visual Edit Light Source color temperature', 'number', ['visual-edit'], { min: 2000, max: 10000 }),
  workflow('visualLighting.sun.shadowSoftness', 'Visual Edit shadow softness', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualLighting.ambient', 'Visual Edit ambient light', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualLighting.preserveShadows', 'Preserve existing shadows', 'boolean', ['visual-edit']),
  workflow('visualSky.preset', 'Sky preset', 'string', ['visual-edit']),
  workflow('visualPeople.mode', 'People edit mode', 'string', ['visual-edit'], { values: ['enhance', 'repopulate', 'cleanup'] }),
  workflow('visualPeople.density', 'People density', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualBackground.mode', 'Background mode', 'string', ['visual-edit'], { values: ['prompt', 'image'] }),
  workflow('visualBackground.prompt', 'Background prompt', 'string', ['visual-edit']),
  workflow('visualExtend.direction', 'Outpaint direction', 'string', ['visual-edit'], {
    values: ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'none'],
  }),
  workflow('visualExtend.amount', 'Outpaint amount', 'number', ['visual-edit'], { min: 10, max: 200 }),

  workflow('explodedDetection', 'Exploded detection', 'string', ['exploded'], { values: ['auto', 'manual', 'category'] }),
  workflow('explodedDirection', 'Explosion direction', 'string', ['exploded'], { values: ['vertical', 'radial', 'custom'] }),
  workflow('explodedView.type', 'Exploded view type', 'string', ['exploded'], { values: ['axon', 'perspective'] }),
  workflow('explodedView.angle', 'Exploded angle', 'string', ['exploded'], { values: ['iso-ne', 'iso-nw', 'iso-se', 'iso-sw'] }),
  workflow('explodedView.separation', 'Explosion separation', 'number', ['exploded'], { min: 0, max: 100 }),
  workflow('explodedAnnotations.labels', 'Exploded labels', 'boolean', ['exploded']),
  workflow('explodedOutput.resolution', 'Exploded resolution', 'string', ['exploded'], {
    values: ['1080p', '2k', '4k', 'print-a3'],
  }),

  workflow('sectionCut.type', 'Section cut type', 'string', ['section'], { values: ['vertical', 'horizontal', 'diagonal'] }),
  workflow('sectionCut.depth', 'Section cut depth', 'number', ['section'], { min: 0, max: 100 }),
  workflow('sectionStyle.poche', 'Section poche', 'string', ['section']),
  workflow('sectionStyle.showBeyond', 'Show-beyond depth', 'number', ['section'], { min: 0, max: 100 }),
  workflow('sectionAreaDetection', 'Section area detection', 'string', ['section'], { values: ['auto', 'manual'] }),
  workflow('sectionProgram.labels', 'Section labels', 'boolean', ['section']),

  workflow('sketchType', 'Sketch type', 'string', ['render-sketch'], { values: ['exterior', 'interior', 'detail', 'aerial'] }),
  workflow('sketchAutoDetect', 'Sketch auto detect', 'boolean', ['render-sketch']),
  workflow('sketchCleanupIntensity', 'Sketch cleanup intensity', 'number', ['render-sketch'], { min: 0, max: 100 }),
  workflow('sketchInterpretation', 'Sketch interpretation', 'number', ['render-sketch'], { min: 0, max: 100 }),
  workflow('sketchPerspectiveCorrect', 'Perspective correction', 'boolean', ['render-sketch']),
  workflow('sketchRefInfluence', 'Reference influence', 'number', ['render-sketch'], { min: 0, max: 100 }),

  workflow('multiAnglePreset', 'Multi-Angle preset', 'string', ['multi-angle'], {
    values: ['turntable', 'architectural', 'birds-eye', 'custom'],
  }),
  workflow('multiAngleViewCount', 'View count', 'number', ['multi-angle'], { min: 2, max: 12 }),
  workflow('multiAngleDistribution', 'Angle distribution', 'string', ['multi-angle'], { values: ['even', 'manual'] }),
  workflow('multiAngleLockConsistency', 'Consistency lock', 'boolean', ['multi-angle']),

  workflow('upscaleFactor', 'Upscale factor', 'string', ['upscale'], { values: ['2x', '4x', '8x'] }),
  workflow('upscaleSharpness', 'Upscale sharpness', 'number', ['upscale'], { min: 0, max: 100 }),
  workflow('upscaleClarity', 'Upscale clarity', 'number', ['upscale'], { min: 0, max: 100 }),
  workflow('upscaleEdgeDefinition', 'Edge definition', 'number', ['upscale'], { min: 0, max: 100 }),
  workflow('upscaleFineDetail', 'Fine detail', 'number', ['upscale'], { min: 0, max: 100 }),
  workflow('upscaleFormat', 'Upscale format', 'string', ['upscale'], { values: ['png', 'jpg', 'tiff'] }),

  workflow('imgToCadType', 'Image to CAD input type', 'string', ['img-to-cad'], { values: ['photo', 'render'] }),
  workflow('imgToCadOutput', 'Image to CAD output intent', 'string', ['img-to-cad'], {
    values: ['elevation', 'plan', 'detail'],
  }),
  workflow('imgToCadLine.sensitivity', 'Line sensitivity', 'number', ['img-to-cad'], { min: 0, max: 100 }),
  workflow('imgToCadLine.simplify', 'Line simplification', 'number', ['img-to-cad'], { min: 0, max: 100 }),
  workflow('imgToCadLine.connect', 'Connect gaps', 'boolean', ['img-to-cad']),
  workflow('imgToCadFormat', 'CAD export format', 'string', ['img-to-cad'], { values: ['dxf', 'dwg', 'svg', 'pdf'] }),
  workflow('imgToCadPreprocess.guidance', 'CAD guidance text', 'string', ['img-to-cad']),

  workflow('videoState.inputMode', 'Video input mode', 'string', ['video'], {
    values: ['image-animate', 'camera-path', 'image-morph', 'multi-shot'],
  }),
  workflow('videoState.model', 'Video model', 'string', ['video'], { values: ['veo-3.1-generate-preview', 'kling-2.6'] }),
  workflow('videoState.scenario', 'Video motion prompt', 'string', ['video']),
  workflow('videoState.duration', 'Video duration', 'number', ['video'], { min: 4, max: 12 }),
  workflow('videoState.resolution', 'Video resolution', 'string', ['video'], { values: ['720p', '1080p', '4k'] }),
  workflow('videoState.aspectRatio', 'Video aspect ratio', 'string', ['video'], {
    values: ['16:9', '9:16', '1:1', '4:3', '21:9'],
  }),
  workflow('videoState.motionAmount', 'Motion amount', 'number', ['video'], { min: 1, max: 10 }),
  workflow('videoState.generateAudio', 'Generated audio', 'boolean', ['video']),
  workflow('videoState.seedLocked', 'Seed lock', 'boolean', ['video']),
  workflow('videoState.camera.type', 'Camera motion type', 'string', ['video'], {
    values: ['static', 'pan', 'orbit', 'dolly', 'crane', 'drone', 'rotate', 'push-in', 'pull-out', 'custom'],
  }),
  workflow('videoState.camera.direction', 'Camera direction', 'number', ['video'], { min: 0, max: 360 }),
  workflow('videoState.camera.smoothness', 'Camera smoothness', 'number', ['video'], { min: 0, max: 100 }),
  workflow('videoState.camera.speed', 'Camera speed', 'string', ['video'], { values: ['slow', 'normal', 'fast'] }),
  workflow('videoState.motionStyle', 'Motion style', 'string', ['video'], {
    values: ['smooth', 'dynamic', 'energetic', 'elegant', 'cinematic', 'subtle', 'dramatic', 'gentle'],
  }),
  workflow('videoState.quality', 'Video quality', 'string', ['video'], { values: ['draft', 'standard', 'high', 'ultra'] }),

  documentTranslate('sourceLanguage', 'Source language', 'string'),
  documentTranslate('targetLanguage', 'Target language', 'string'),
  documentTranslate('translateHeaders', 'Translate headers/footers', 'boolean'),
  documentTranslate('translateFootnotes', 'Translate footnotes', 'boolean'),

  materialValidation('activeTab', 'Material Validation tab', 'string', {
    values: ['dashboard', 'documents', 'materials', 'drawings', 'boq', 'issues', 'reports'],
  }),
  materialValidation('checks.crossReferenceBoq', 'BoQ cross-reference check', 'boolean'),
  materialValidation('checks.technicalSpec', 'Technical spec check', 'boolean'),
  materialValidation('checks.dimensions', 'Dimension check', 'boolean'),
  materialValidation('checks.productRefs', 'Product reference check', 'boolean'),
  materialValidation('checks.quantities', 'Quantity check', 'boolean'),

  workflow('headshot.style', 'Headshot style', 'string', ['headshot'], { values: ['professional', 'website-custom'] }),
  workflow('headshot.tone', 'Headshot tone', 'string', ['headshot'], {
    values: ['formal', 'smart-casual', 'casual', 'creative'],
  }),
  workflow('headshot.purpose', 'Headshot purpose', 'string', ['headshot'], {
    values: ['linkedin', 'student-card', 'team-page', 'social-media', 'id-document', 'portfolio'],
  }),
  workflow('headshot.colorMode', 'Headshot color mode', 'string', ['headshot'], { values: ['color', 'black-and-white'] }),
  workflow('headshot.role', 'Website role', 'string', ['headshot']),
  workflow('headshot.facing', 'Facing direction', 'string', ['headshot'], { values: ['left', 'right'] }),
  workflow('headshot.background', 'Headshot background', 'string', ['headshot'], {
    values: ['studio-white', 'studio-grey', 'studio-dark', 'blurred-office', 'gradient'],
  }),
  workflow('headshot.quality', 'Headshot quality', 'string', ['headshot'], { values: ['standard', 'high'] }),

  workflow('pdfCompression.compressionLevel', 'PDF compression level', 'string', ['pdf-compression'], {
    values: ['light', 'balanced', 'aggressive'],
  }),
  workflow('pdfCompression.imageQuality', 'PDF image quality', 'number', ['pdf-compression'], { min: 1, max: 100 }),
  workflow('pdfCompression.stripMetadata', 'Strip PDF metadata', 'boolean', ['pdf-compression']),
  workflow('pdfCompression.preserveText', 'Preserve searchable text', 'boolean', ['pdf-compression']),
  workflow('pdfCompression.preserveVectors', 'Preserve vector graphics', 'boolean', ['pdf-compression']),

  geometry('lockGeometry', 'Lock geometry', 'boolean'),
  geometry('lockPerspective', 'Lock perspective', 'boolean'),
  geometry('lockCameraPosition', 'Lock camera position', 'boolean'),
  geometry('lockFraming', 'Lock framing', 'boolean'),
  geometry('allowMinorRefinement', 'Allow minor refinement', 'boolean'),
  geometry('allowReinterpretation', 'Allow reinterpretation', 'boolean'),
  geometry('suppressHallucinations', 'Suppress hallucinations', 'boolean'),
  geometry('geometryPreservation', 'Geometry preservation', 'number', { min: 0, max: 100 }),
  geometry('perspectiveAdherence', 'Perspective adherence', 'number', { min: 0, max: 100 }),
  geometry('framingAdherence', 'Framing adherence', 'number', { min: 0, max: 100 }),
  geometry('edgeDefinition', 'Edge definition behavior', 'string', { values: ['sharp', 'soft', 'adaptive'] }),
  geometry('edgeStrength', 'Edge strength', 'number', { min: 0, max: 100 }),
  geometry('lod.level', 'Level of detail', 'string', { values: ['minimal', 'low', 'medium', 'high', 'ultra'] }),
  geometry('lod.preserveOrnaments', 'Preserve ornaments', 'boolean'),
  geometry('lod.preserveMoldings', 'Preserve moldings', 'boolean'),
  geometry('lod.preserveTrim', 'Preserve trim', 'boolean'),
  geometry('smoothing.enabled', 'Geometry smoothing', 'boolean'),
  geometry('smoothing.intensity', 'Smoothing intensity', 'number', { min: 0, max: 100 }),
  geometry('smoothing.preserveHardEdges', 'Preserve hard edges', 'boolean'),
  geometry('smoothing.threshold', 'Smoothing threshold', 'number', { min: 0, max: 100 }),
  geometry('depthLayers.enabled', 'Depth layers', 'boolean'),
  geometry('depthLayers.foreground', 'Foreground depth emphasis', 'number', { min: 0, max: 100 }),
  geometry('depthLayers.midground', 'Midground depth emphasis', 'number', { min: 0, max: 100 }),
  geometry('depthLayers.background', 'Background depth emphasis', 'number', { min: 0, max: 100 }),
  geometry('displacement.enabled', 'Displacement detail', 'boolean'),
  geometry('displacement.strength', 'Displacement strength', 'number', { min: 0, max: 100 }),
  geometry('displacement.scale', 'Displacement scale', 'string', { values: ['fine', 'medium', 'coarse'] }),
  geometry('displacement.adaptToMaterial', 'Adapt displacement to material', 'boolean'),

  camera('fov', 'Field of view', 'number', { min: 10, max: 120 }),
  camera('fovMode', 'Field of view preset', 'string', { values: ['narrow', 'normal', 'wide', 'ultra-wide', 'custom'] }),
  camera('viewType', 'Camera view type', 'string', { values: ['eye-level', 'aerial', 'drone', 'worm', 'custom'] }),
  camera('cameraHeight', 'Camera height', 'number', { min: 0.2, max: 200 }),
  camera('projection', 'Projection', 'string', { values: ['perspective', 'axonometric', 'isometric', 'two-point'] }),
  camera('verticalCorrection', 'Vertical correction', 'boolean'),
  camera('verticalCorrectionStrength', 'Vertical correction strength', 'number', { min: 0, max: 100 }),
  camera('horizonLock', 'Horizon lock', 'boolean'),
  camera('horizonPosition', 'Horizon position', 'number', { min: 0, max: 100 }),
  camera('depthOfField', 'Depth of field', 'boolean'),
  camera('dofStrength', 'Depth of field strength', 'number', { min: 0, max: 100 }),
  camera('focalPoint', 'Depth of field focal point', 'string', {
    values: ['center', 'subject', 'foreground', 'background'],
  }),

  lighting('timeOfDay', 'Time of day', 'string', {
    values: ['morning', 'midday', 'afternoon', 'golden-hour', 'blue-hour', 'night', 'overcast', 'custom'],
  }),
  lighting('customTime', 'Custom light time', 'number', { min: 0, max: 24 }),
  lighting('sunAzimuth', 'Light direction left/right position', 'number', { min: 0, max: 360 }),
  lighting('sunAltitude', 'Light direction front/back height', 'number', { min: -10, max: 90 }),
  lighting('cloudCover', 'Cloud cover', 'number', { min: 0, max: 100 }),
  lighting('cloudType', 'Cloud type', 'string', {
    values: ['clear', 'scattered', 'overcast', 'dramatic', 'stormy'],
  }),
  lighting('shadowSoftness', 'Shadow softness', 'number', { min: 0, max: 100 }),
  lighting('shadowIntensity', 'Shadow intensity', 'number', { min: 0, max: 100 }),
  lighting('ambientGIStrength', 'Ambient GI strength', 'number', { min: 0, max: 100 }),
  lighting('bounceLight', 'Bounce light', 'boolean'),
  lighting('bounceLightIntensity', 'Bounce light intensity', 'number', { min: 0, max: 100 }),
  lighting('fog', 'Fog', 'boolean'),
  lighting('fogDensity', 'Fog density', 'number', { min: 0, max: 100 }),
  lighting('fogDistance', 'Fog distance', 'number', { min: 0, max: 100 }),
  lighting('haze', 'Haze', 'boolean'),
  lighting('hazeIntensity', 'Haze intensity', 'number', { min: 0, max: 100 }),
  lighting('weather', 'Weather', 'string', { values: ['clear', 'cloudy', 'rain', 'snow'] }),
  lighting('rainIntensity', 'Rain intensity', 'string', { values: ['light', 'moderate', 'heavy'] }),
  lighting('snowIntensity', 'Snow intensity', 'string', { values: ['light', 'moderate', 'heavy'] }),
  lighting('enforcePhysicalPlausibility', 'Physical lighting plausibility', 'boolean'),
  lighting('allowDramaticLighting', 'Allow dramatic lighting', 'boolean'),

  materials('textureSharpness', 'Texture sharpness', 'number', { min: 0, max: 100 }),
  materials('agingLevel', 'Aging and wear level', 'number', { min: 0, max: 100 }),
  materials('concreteEmphasis', 'Concrete material emphasis', 'number', { min: 0, max: 100 }),
  materials('glassEmphasis', 'Glass material emphasis', 'number', { min: 0, max: 100 }),
  materials('woodEmphasis', 'Wood material emphasis', 'number', { min: 0, max: 100 }),
  materials('metalEmphasis', 'Metal material emphasis', 'number', { min: 0, max: 100 }),
  materials('stoneEmphasis', 'Stone material emphasis', 'number', { min: 0, max: 100 }),
  materials('compositeEmphasis', 'Composite material emphasis', 'number', { min: 0, max: 100 }),
  materials('reflectivityBias', 'Reflectivity bias', 'number', { min: -100, max: 100 }),
  materials('cleanVsRaw', 'Clean versus raw material finish', 'number', { min: 0, max: 100 }),

  context('people', 'Include people', 'boolean'),
  context('peopleDensity', 'People density', 'string', { values: ['sparse', 'moderate', 'busy', 'crowded'] }),
  context('peopleScale', 'People scale', 'string', { values: ['accurate', 'smaller', 'larger'] }),
  context('peopleStyle', 'People style', 'string', {
    values: ['photorealistic', 'silhouette', 'minimal', 'artistic'],
  }),
  context('peoplePlacement', 'People placement', 'string', {
    values: ['auto', 'foreground', 'midground', 'background'],
  }),
  context('vegetation', 'Include vegetation', 'boolean'),
  context('vegetationDensity', 'Vegetation density', 'number', { min: 0, max: 100 }),
  context('season', 'Season', 'string', { values: ['spring', 'summer', 'autumn', 'winter'] }),
  context('vegetationHealth', 'Vegetation health', 'string', { values: ['lush', 'natural', 'sparse'] }),
  context('vehicles', 'Include vehicles', 'boolean'),
  context('vehicleDensity', 'Vehicle density', 'string', { values: ['few', 'moderate', 'traffic'] }),
  context('urbanFurniture', 'Include urban furniture', 'boolean'),
  context('urbanFurnitureStyle', 'Urban furniture style', 'string', {
    values: ['minimal', 'contemporary', 'classic', 'industrial'],
  }),
  context('scaleCheck', 'Scale check', 'boolean'),
  context('noIrrelevantProps', 'Avoid irrelevant props', 'boolean'),
  context('architectureDominant', 'Keep architecture dominant', 'boolean'),
  context('contextSubtlety', 'Context subtlety', 'number', { min: 0, max: 100 }),

  output('resolution', 'Global output resolution', 'string', { values: ['2k', '4k', 'custom'] }),
  output('customResolution.width', 'Custom output width', 'number', { min: 256, max: 12000 }),
  output('customResolution.height', 'Custom output height', 'number', { min: 256, max: 12000 }),
  output('aspectRatio', 'Global output aspect ratio', 'string', { values: ['1:1', '16:9', '4:5', '9:16', 'custom'] }),
  output('customAspectRatio.width', 'Custom aspect width', 'number', { min: 1, max: 64 }),
  output('customAspectRatio.height', 'Custom aspect height', 'number', { min: 1, max: 64 }),
  output('format', 'Global output format', 'string', { values: ['png', 'jpg'] }),
  output('jpgQuality', 'JPG quality', 'number', { min: 1, max: 100 }),
  output('embedMetadata', 'Embed metadata', 'boolean'),
  output('seed', 'Generation seed', 'number', { min: 0, max: 2147483647 }),
  output('seedLocked', 'Global seed lock', 'boolean'),

  canvas('zoom', 'Canvas zoom', 'number', { min: 0.1, max: 6 }),
  canvas('pan.x', 'Canvas horizontal pan', 'number', { min: -10000, max: 10000 }),
  canvas('pan.y', 'Canvas vertical pan', 'number', { min: -10000, max: 10000 }),
];

const targetByActionType: Record<PathDescriptor['type'], ActionTarget> = {
  set_workflow: 'workflow',
  set_geometry: 'geometry',
  set_camera: 'camera',
  set_lighting: 'lighting',
  set_materials: 'materials',
  set_context: 'context',
  set_output: 'output',
  set_canvas: 'canvas',
  set_material_validation: 'materialValidation',
  set_document_translate: 'documentTranslate',
};

const readPath = (source: unknown, path: string): unknown => {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
};

const cloneValue = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cloneValue(item)])
    ) as T;
  }
  return value;
};

const setPath = (source: Record<string, unknown>, path: string, value: unknown) => {
  const parts = path.split('.');
  let current: Record<string, unknown> = source;

  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      current[part] = value;
      return;
    }

    const existing = current[part];
    current[part] = cloneValue(
      existing && typeof existing === 'object' ? existing : {}
    ) as Record<string, unknown>;
    current = current[part] as Record<string, unknown>;
  });
};

const coerceValue = (descriptor: PathDescriptor, value: unknown): unknown | undefined => {
  if (descriptor.valueType === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return undefined;
  }

  if (descriptor.valueType === 'number') {
    const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isFinite(numeric)) return undefined;
    const min = descriptor.min ?? -Infinity;
    const max = descriptor.max ?? Infinity;
    return Math.min(Math.max(numeric, min), max);
  }

  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (descriptor.values?.length && !descriptor.values.includes(trimmed)) return undefined;
  return trimmed;
};

const getDescriptor = (type: AppAssistantActionType | undefined, path: string | undefined): PathDescriptor | undefined => {
  if (!type || !path) return undefined;
  return PATH_DESCRIPTORS.find((descriptor) => descriptor.type === type && descriptor.path === path);
};

const IMAGE_TARGETS: readonly AppAssistantImageTarget[] = [
  'canvas',
  'source',
  'style-reference',
  'background-reference',
  'visual-material-reference',
  'visual-background-reference',
  'scene-compose-reference',
  'sketch-reference',
  'video-input',
  'headshot-left',
  'headshot-front',
  'headshot-right',
] as const;

const getImageTargetLabel = (target: AppAssistantImageTarget): string => {
  const labels: Record<AppAssistantImageTarget, string> = {
    canvas: 'Use attached image on canvas',
    source: 'Use attached image as source',
    'style-reference': 'Use attached image as style reference',
    'background-reference': 'Use attached image as background reference',
    'visual-material-reference': 'Use attached image as material reference',
    'visual-background-reference': 'Use attached image as background edit reference',
    'scene-compose-reference': 'Add attached image as scene object reference',
    'sketch-reference': 'Add attached image as sketch reference',
    'video-input': 'Use attached image as video input',
    'headshot-left': 'Use attached image as left headshot reference',
    'headshot-front': 'Use attached image as front headshot reference',
    'headshot-right': 'Use attached image as right headshot reference',
  };
  return labels[target];
};

const getTargetSource = (state: AppState, target: ActionTarget): unknown => {
  switch (target) {
    case 'workflow':
      return state.workflow;
    case 'geometry':
      return state.geometry;
    case 'camera':
      return state.camera;
    case 'lighting':
      return state.lighting;
    case 'materials':
      return state.materials;
    case 'context':
      return state.context;
    case 'output':
      return state.output;
    case 'canvas':
      return state.canvas;
    case 'materialValidation':
      return state.materialValidation;
    case 'documentTranslate':
      return state.workflow.documentTranslate;
  }
};

const summarizeValue = (value: unknown): string => {
  if (typeof value === 'string') return value.length > 70 ? `${value.slice(0, 67)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return 'empty';
  return 'custom value';
};

const makeAssistantImageId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const extractAppAssistantActions = (rawAnswer: string): { content: string; requests: AppAssistantActionRequest[] } => {
  const tagMatch = rawAnswer.match(/<assistant_actions>\s*([\s\S]*?)\s*<\/assistant_actions>/i);
  if (!tagMatch) {
    return { content: rawAnswer.trim(), requests: [] };
  }

  const content = rawAnswer.replace(tagMatch[0], '').trim();
  try {
    const parsed = JSON.parse(tagMatch[1]);
    const actions = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.actions) ? parsed.actions : [];
    return {
      content,
      requests: actions.filter((item: unknown): item is AppAssistantActionRequest => Boolean(item && typeof item === 'object')),
    };
  } catch {
    return { content, requests: [] };
  }
};

export const normalizeAppAssistantActions = (
  requests: AppAssistantActionRequest[],
  state: AppState,
  options: { chatImages?: AppAssistantChatImage[] } = {}
): AppAssistantAction[] => {
  const chatImages = options.chatImages || [];

  return requests.flatMap((request, index): AppAssistantAction[] => {
    if (!request.type) return [];

    if (request.type === 'set_mode') {
      if (!request.mode || !GENERATION_MODES.includes(request.mode)) return [];
      return [{
        id: `${index}-set-mode-${request.mode}`,
        type: 'set_mode',
        mode: request.mode,
        label: request.label || `Switch to ${request.mode.replace(/-/g, ' ')}`,
        reason: request.reason,
      }];
    }

    if (request.type === 'set_style') {
      const value = typeof request.value === 'string' ? request.value.trim() : '';
      const styles = [...BUILT_IN_STYLES, ...state.customStyles];
      const style = styles.find((item) => item.id === value);
      if (!style) return [];
      return [{
        id: `${index}-set-style-${value}`,
        type: 'set_style',
        value,
        label: request.label || `Use ${style.name}`,
        reason: request.reason,
      }];
    }

    if (request.type === 'set_prompt') {
      const value = typeof request.value === 'string' ? request.value.trim() : '';
      if (!value) return [];
      return [{
        id: `${index}-set-prompt`,
        type: 'set_prompt',
        value,
        label: request.label || 'Update the prompt',
        reason: request.reason,
      }];
    }

    if (request.type === 'set_active_right_tab' || request.type === 'set_active_bottom_tab') {
      const value = typeof request.value === 'string' ? request.value.trim() : '';
      if (!value) return [];
      return [{
        id: `${index}-${request.type}-${value}`,
        type: request.type,
        value,
        label: request.label || `Open ${value}`,
        reason: request.reason,
      }];
    }

    if (
      request.type === 'open_right_panel' ||
      request.type === 'close_right_panel' ||
      request.type === 'open_left_sidebar' ||
      request.type === 'close_left_sidebar' ||
      request.type === 'open_bottom_panel' ||
      request.type === 'collapse_bottom_panel'
    ) {
      const defaultLabels: Record<typeof request.type, string> = {
        open_right_panel: 'Open the settings panel',
        close_right_panel: 'Close the settings panel',
        open_left_sidebar: 'Open the workflow sidebar',
        close_left_sidebar: 'Close the workflow sidebar',
        open_bottom_panel: 'Open the bottom panel',
        collapse_bottom_panel: 'Collapse the bottom panel',
      };
      return [{
        id: `${index}-${request.type}`,
        type: request.type,
        label: request.label || defaultLabels[request.type],
        reason: request.reason,
      }];
    }

    if (request.type === 'run_generation') {
      const value = typeof request.value === 'string' ? request.value.trim() : undefined;
      return [{
        id: `${index}-run-generation`,
        type: 'run_generation',
        value,
        label: request.label || 'Run generation',
        reason: request.reason,
      }];
    }

    if (request.type === 'run_preprocess') {
      return [{
        id: `${index}-run-preprocess`,
        type: 'run_preprocess',
        label: request.label || 'Run AI pre-processing',
        reason: request.reason,
      }];
    }

    if (request.type === 'use_chat_image') {
      const target = request.imageTarget || (typeof request.path === 'string' ? request.path : undefined);
      if (!target || !IMAGE_TARGETS.includes(target as AppAssistantImageTarget)) return [];
      if (!chatImages.length) return [];
      const requestedId = request.attachmentId || (typeof request.value === 'string' ? request.value : 'latest');
      const image = requestedId === 'latest'
        ? chatImages[chatImages.length - 1]
        : chatImages.find((item) => item.id === requestedId) || chatImages[chatImages.length - 1];
      if (!image?.url) return [];
      const imageTarget = target as AppAssistantImageTarget;
      return [{
        id: `${index}-use-chat-image-${imageTarget}-${image.id}`,
        type: 'use_chat_image',
        value: image.url,
        imageTarget,
        attachmentId: image.id,
        caption: typeof request.caption === 'string' ? request.caption.trim() : undefined,
        label: request.label || getImageTargetLabel(imageTarget),
        reason: request.reason,
      }];
    }

    if (request.type === 'prepare_image_selection') {
      return [{
        id: `${index}-prepare-image-selection`,
        type: 'prepare_image_selection',
        label: request.label || 'Start image area selection',
        reason: request.reason,
      }];
    }

    if (request.type === 'clear_image_selections') {
      return [{
        id: `${index}-clear-image-selections`,
        type: 'clear_image_selections',
        label: request.label || 'Clear selected image areas',
        reason: request.reason,
      }];
    }

    if (request.type === 'reset_canvas_view') {
      return [{
        id: `${index}-reset-canvas-view`,
        type: 'reset_canvas_view',
        label: request.label || 'Fit canvas to screen',
        reason: request.reason,
      }];
    }

    if (request.type === 'clear_canvas') {
      return [{
        id: `${index}-clear-canvas`,
        type: 'clear_canvas',
        label: request.label || 'Clear canvas image',
        reason: request.reason,
      }];
    }

    if (request.type === 'set_source_from_current') {
      return [{
        id: `${index}-set-source-from-current`,
        type: 'set_source_from_current',
        label: request.label || 'Lock current image as source',
        reason: request.reason,
      }];
    }

    if (request.type === 'use_latest_history_image') {
      return [{
        id: `${index}-use-latest-history-image`,
        type: 'use_latest_history_image',
        label: request.label || 'Use latest history image',
        reason: request.reason,
      }];
    }

    if (request.type === 'clear_prompt') {
      return [{
        id: `${index}-clear-prompt`,
        type: 'clear_prompt',
        label: request.label || 'Clear prompt override',
        reason: request.reason,
      }];
    }

    const descriptor = getDescriptor(request.type, request.path);
    if (!descriptor) return [];
    const value = coerceValue(descriptor, request.value);
    if (value === undefined) return [];

    return [{
      id: `${index}-${request.type}-${descriptor.path}`,
      type: request.type,
      path: descriptor.path,
      value,
      label: request.label || `Set ${descriptor.label} to ${summarizeValue(value)}`,
      reason: request.reason,
    }];
  }).slice(0, 8);
};

export const applyAppAssistantActions = (
  dispatch: (action: Action) => void,
  state: AppState,
  actions: AppAssistantAction[]
) => {
  const nextWorkflow = cloneValue(state.workflow) as unknown as Record<string, unknown>;
  const nextGeometry = cloneValue(state.geometry) as unknown as Record<string, unknown>;
  const nextCamera = cloneValue(state.camera) as unknown as Record<string, unknown>;
  const nextLighting = cloneValue(state.lighting) as unknown as Record<string, unknown>;
  const nextMaterials = cloneValue(state.materials) as unknown as Record<string, unknown>;
  const nextContext = cloneValue(state.context) as unknown as Record<string, unknown>;
  const nextOutput = cloneValue(state.output) as unknown as Record<string, unknown>;
  const nextCanvas = cloneValue(state.canvas) as unknown as Record<string, unknown>;
  const nextMaterialValidation = cloneValue(state.materialValidation) as unknown as Record<string, unknown>;
  const nextDocumentTranslate = cloneValue(state.workflow.documentTranslate) as unknown as Record<string, unknown>;

  let workflowChanged = false;
  let geometryChanged = false;
  let cameraChanged = false;
  let lightingChanged = false;
  let materialsChanged = false;
  let contextChanged = false;
  let outputChanged = false;
  let canvasChanged = false;
  let materialValidationChanged = false;
  let documentTranslateChanged = false;
  let nextMode: GenerationMode | null = null;
  let nextStyle: string | null = null;
  let nextPrompt: string | null = null;
  let nextRightTab: string | null = null;
  let nextBottomTab: string | null = null;
  let shouldOpenRightPanel: boolean | null = null;
  let shouldOpenLeftSidebar: boolean | null = null;
  let shouldOpenBottomPanel: boolean | null = null;
  let clearPrompt = false;
  let clearSelections = false;
  let resetCanvasView = false;
  let clearCanvas = false;
  let setSourceFromCurrent = false;
  let useLatestHistoryImage = false;
  let nextUploadedImage: string | null = null;
  let nextSourceImage: string | null = null;

  actions.forEach((action) => {
    if (action.type === 'set_mode' && action.mode) {
      nextMode = action.mode;
      return;
    }

    if (action.type === 'set_style' && typeof action.value === 'string') {
      nextStyle = action.value;
      return;
    }

    if (action.type === 'set_prompt' && typeof action.value === 'string') {
      nextPrompt = action.value;
      return;
    }

    if (action.type === 'set_active_right_tab' && typeof action.value === 'string') {
      nextRightTab = action.value;
      return;
    }

    if (action.type === 'set_active_bottom_tab' && typeof action.value === 'string') {
      nextBottomTab = action.value;
      return;
    }

    if (action.type === 'open_right_panel') {
      shouldOpenRightPanel = true;
      return;
    }

    if (action.type === 'close_right_panel') {
      shouldOpenRightPanel = false;
      return;
    }

    if (action.type === 'open_left_sidebar') {
      shouldOpenLeftSidebar = true;
      return;
    }

    if (action.type === 'close_left_sidebar') {
      shouldOpenLeftSidebar = false;
      return;
    }

    if (action.type === 'open_bottom_panel') {
      shouldOpenBottomPanel = true;
      return;
    }

    if (action.type === 'collapse_bottom_panel') {
      shouldOpenBottomPanel = false;
      return;
    }

    if (action.type === 'clear_prompt') {
      clearPrompt = true;
      return;
    }

    if (action.type === 'clear_image_selections') {
      clearSelections = true;
      return;
    }

    if (action.type === 'reset_canvas_view') {
      resetCanvasView = true;
      return;
    }

    if (action.type === 'clear_canvas') {
      clearCanvas = true;
      return;
    }

    if (action.type === 'set_source_from_current') {
      setSourceFromCurrent = true;
      return;
    }

    if (action.type === 'use_latest_history_image') {
      useLatestHistoryImage = true;
      return;
    }

    if (action.type === 'use_chat_image' && typeof action.value === 'string' && action.imageTarget) {
      const image = action.value;
      switch (action.imageTarget) {
        case 'canvas':
          nextUploadedImage = image;
          break;
        case 'source':
          nextUploadedImage = image;
          nextSourceImage = image;
          break;
        case 'style-reference':
          setPath(nextWorkflow, 'styleReferenceImage', image);
          setPath(nextWorkflow, 'styleReferenceEnabled', true);
          workflowChanged = true;
          break;
        case 'background-reference':
          setPath(nextWorkflow, 'backgroundReferenceImage', image);
          setPath(nextWorkflow, 'backgroundReferenceEnabled', true);
          workflowChanged = true;
          break;
        case 'visual-material-reference':
          setPath(nextWorkflow, 'visualMaterial', {
            ...state.workflow.visualMaterial,
            referenceImage: image,
            referenceEnabled: true,
          });
          workflowChanged = true;
          break;
        case 'visual-background-reference':
          setPath(nextWorkflow, 'visualBackground', {
            ...state.workflow.visualBackground,
            mode: 'image',
            referenceImage: image,
          });
          workflowChanged = true;
          break;
        case 'scene-compose-reference':
          setPath(nextWorkflow, 'sceneInsertionReferences', [
            ...state.workflow.sceneInsertionReferences,
            {
              id: makeAssistantImageId(),
              image,
              caption: action.caption || 'Assistant reference image',
              placement: null,
            },
          ]);
          workflowChanged = true;
          break;
        case 'sketch-reference':
          setPath(nextWorkflow, 'sketchRefs', [
            ...state.workflow.sketchRefs,
            {
              id: makeAssistantImageId(),
              url: image,
              type: state.workflow.sketchRefType || 'style',
            },
          ]);
          workflowChanged = true;
          break;
        case 'video-input':
          setPath(nextWorkflow, 'videoState', {
            ...state.workflow.videoState,
            inputMode: 'image-animate',
            videoInputImage: image,
          });
          workflowChanged = true;
          break;
        case 'headshot-left':
          setPath(nextWorkflow, 'headshot', { ...state.workflow.headshot, leftImage: image });
          workflowChanged = true;
          break;
        case 'headshot-front':
          setPath(nextWorkflow, 'headshot', { ...state.workflow.headshot, frontImage: image });
          workflowChanged = true;
          break;
        case 'headshot-right':
          setPath(nextWorkflow, 'headshot', { ...state.workflow.headshot, rightImage: image });
          workflowChanged = true;
          break;
      }
      return;
    }

    const descriptor = getDescriptor(action.type, action.path);
    if (!descriptor || !action.path) return;
    const target = targetByActionType[descriptor.type];
    switch (target) {
      case 'workflow':
        setPath(nextWorkflow, action.path, action.value);
        workflowChanged = true;
        break;
      case 'geometry':
        setPath(nextGeometry, action.path, action.value);
        geometryChanged = true;
        break;
      case 'camera':
        setPath(nextCamera, action.path, action.value);
        cameraChanged = true;
        break;
      case 'lighting':
        setPath(nextLighting, action.path, action.value);
        lightingChanged = true;
        break;
      case 'materials':
        setPath(nextMaterials, action.path, action.value);
        materialsChanged = true;
        break;
      case 'context':
        setPath(nextContext, action.path, action.value);
        contextChanged = true;
        break;
      case 'output':
        setPath(nextOutput, action.path, action.value);
        outputChanged = true;
        break;
      case 'canvas':
        setPath(nextCanvas, action.path, action.value);
        canvasChanged = true;
        break;
      case 'materialValidation':
        setPath(nextMaterialValidation, action.path, action.value);
        materialValidationChanged = true;
        break;
      case 'documentTranslate':
        setPath(nextDocumentTranslate, action.path, action.value);
        documentTranslateChanged = true;
        break;
    }
  });

  if (nextMode) dispatch({ type: 'SET_MODE', payload: nextMode });
  if (nextUploadedImage !== null) dispatch({ type: 'SET_IMAGE', payload: nextUploadedImage });
  if (nextSourceImage !== null) dispatch({ type: 'SET_SOURCE_IMAGE', payload: nextSourceImage });
  if (nextStyle) dispatch({ type: 'SET_STYLE', payload: nextStyle });
  if (workflowChanged) dispatch({ type: 'UPDATE_WORKFLOW', payload: nextWorkflow as Partial<WorkflowSettings> });
  if (geometryChanged) dispatch({ type: 'UPDATE_GEOMETRY', payload: nextGeometry as Partial<GeometryState> });
  if (cameraChanged) dispatch({ type: 'UPDATE_CAMERA', payload: nextCamera as Partial<CameraState> });
  if (lightingChanged) dispatch({ type: 'UPDATE_LIGHTING', payload: nextLighting as Partial<LightingState> });
  if (materialsChanged) dispatch({ type: 'UPDATE_MATERIALS', payload: nextMaterials as Partial<MaterialState> });
  if (contextChanged) dispatch({ type: 'UPDATE_CONTEXT', payload: nextContext as Partial<ContextState> });
  if (outputChanged) dispatch({ type: 'UPDATE_OUTPUT', payload: nextOutput as Partial<OutputState> });
  if (canvasChanged) {
    const nextCanvasState = nextCanvas as Partial<CanvasState>;
    if (typeof nextCanvasState.zoom === 'number') {
      dispatch({ type: 'SET_CANVAS_ZOOM', payload: nextCanvasState.zoom });
    }
    if (nextCanvasState.pan?.x !== undefined || nextCanvasState.pan?.y !== undefined) {
      dispatch({
        type: 'SET_CANVAS_PAN',
        payload: {
          x: typeof nextCanvasState.pan?.x === 'number' ? nextCanvasState.pan.x : state.canvas.pan.x,
          y: typeof nextCanvasState.pan?.y === 'number' ? nextCanvasState.pan.y : state.canvas.pan.y,
        },
      });
    }
  }
  if (materialValidationChanged) dispatch({ type: 'UPDATE_MATERIAL_VALIDATION', payload: nextMaterialValidation as Partial<MaterialValidationState> });
  if (documentTranslateChanged) dispatch({ type: 'UPDATE_DOCUMENT_TRANSLATE', payload: nextDocumentTranslate as Partial<DocumentTranslateState> });
  if (nextRightTab) dispatch({ type: 'SET_ACTIVE_TAB', payload: nextRightTab });
  if (nextBottomTab) dispatch({ type: 'SET_ACTIVE_BOTTOM_TAB', payload: nextBottomTab });
  if (shouldOpenRightPanel !== null && state.rightPanelOpen !== shouldOpenRightPanel) dispatch({ type: 'TOGGLE_RIGHT_PANEL' });
  if (shouldOpenLeftSidebar !== null && state.leftSidebarOpen !== shouldOpenLeftSidebar) dispatch({ type: 'TOGGLE_LEFT_SIDEBAR' });
  if (shouldOpenBottomPanel !== null && state.bottomPanelCollapsed === shouldOpenBottomPanel) dispatch({ type: 'TOGGLE_BOTTOM_PANEL' });
  if (nextPrompt !== null) dispatch({ type: 'SET_PROMPT', payload: nextPrompt });
  if (clearPrompt) {
    dispatch({ type: 'SET_PROMPT', payload: '' });
    dispatch({ type: 'UPDATE_WORKFLOW', payload: { textPrompt: '', visualPrompt: '' } });
  }
  if (clearSelections) {
    dispatch({
      type: 'UPDATE_WORKFLOW',
      payload: {
        visualSelections: [],
        visualSelectionMask: null,
        visualSelectionMaskSize: null,
        visualSelectionComposite: null,
        visualSelectionCompositeSize: null,
        visualSelectionUndoStack: [],
        visualSelectionRedoStack: [],
      },
    });
  }
  if (resetCanvasView) {
    dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
    dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
  }
  if (clearCanvas) {
    dispatch({ type: 'CLEAR_CANVAS' });
  }
  if (setSourceFromCurrent && state.uploadedImage) {
    dispatch({ type: 'SET_SOURCE_IMAGE', payload: state.uploadedImage });
  }
  if (useLatestHistoryImage) {
    const latest = [...state.history].reverse().find((item) => item.thumbnail);
    if (latest?.thumbnail) {
      dispatch({ type: 'SET_IMAGE', payload: latest.thumbnail });
      dispatch({ type: 'SET_SOURCE_IMAGE', payload: latest.thumbnail });
      dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
      dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
    }
  }
};

export const buildAppAssistantActionContext = (
  state: AppState,
  options: { chatImages?: AppAssistantChatImage[] } = {}
): string => {
  const descriptors = PATH_DESCRIPTORS.filter((descriptor) => !descriptor.modes || descriptor.modes.includes(state.mode));
  const chatImages = options.chatImages || [];
  const styleOptions = [...BUILT_IN_STYLES, ...state.customStyles]
    .slice(0, 80)
    .map((style) => `${style.id} (${style.name})`)
    .join(', ');
  const lines = descriptors.map((descriptor) => {
    const target = targetByActionType[descriptor.type];
    const current = readPath(getTargetSource(state, target), descriptor.path);
    const allowed = descriptor.values?.length ? ` Allowed values: ${descriptor.values.join(', ')}.` : '';
    const range = descriptor.valueType === 'number' && (descriptor.min !== undefined || descriptor.max !== undefined)
      ? ` Range: ${descriptor.min ?? '-inf'}-${descriptor.max ?? 'inf'}.`
      : '';
    return `- ${descriptor.type} path "${descriptor.path}" (${descriptor.label}, ${descriptor.valueType}). Current: ${summarizeValue(current)}.${allowed}${range}`;
  });

  return [
    'ASSISTANT CONTROL CAPABILITY:',
    'When the user asks you to set up, optimize, change, apply, prepare, switch, or fill settings, you may request app changes.',
    'Do not claim changes are already applied in your prose. The app validates action requests, then applies them automatically in Act mode or shows them as one-click actions in Suggest mode.',
    'Only use the exact action types and paths listed below.',
    `set_mode can switch to: ${GENERATION_MODES.join(', ')}`,
    `set_style can choose an existing style id. Current: ${state.activeStyleId}. Available styles: ${styleOptions}`,
    'set_prompt can write a complete optimized prompt into the global prompt override.',
    'set_active_right_tab and set_active_bottom_tab can open a tab by string value when useful.',
    'open_right_panel, close_right_panel, open_left_sidebar, close_left_sidebar, open_bottom_panel, and collapse_bottom_panel can change workspace panel visibility.',
    'Some action paths use legacy implementation names. Do not say those path names to the user; translate them into visible UI language.',
    'For the visible Light Source grid: Left uses a low left/right value around 90, Center around 180, Right around 270. Front uses front/back around 75, Center around 45, Back around 15.',
    `Attached user images this turn: ${chatImages.length ? chatImages.map((image) => `${image.id}${image.name ? ` (${image.name})` : ''}`).join(', ') : 'none'}.`,
    'use_chat_image can place an attached user image into the app. It requires imageTarget and attachmentId. Use attachmentId "latest" for the newest image.',
    'Valid imageTarget values: canvas, source, style-reference, background-reference, visual-material-reference, visual-background-reference, scene-compose-reference, sketch-reference, video-input, headshot-left, headshot-front, headshot-right.',
    'Use style-reference for visual language, background-reference for environment/context, visual-material-reference for a material sample, scene-compose-reference for an object/product/furniture reference, and canvas/source for the main image to work from.',
    'If a reference image would help but no user image is attached, ask them to attach one with the image button in the assistant composer.',
    'run_generation runs the current workflow. Treat it as final execution for every feature: generate, render, translate, validate, compress, upscale, animate, or create headshots.',
    'run_preprocess runs the 3D Rendering AI problem-area analysis. Use it in 3D Rendering setup when a source image is available, especially for skylights, ceiling trusses, columns, glass, signage, stairs, fine frames, or noisy viewport geometry.',
    'For broad creative requests in any feature, treat the request as setup intent, not final permission. Apply safe setup actions, use available analysis/preprocessing when useful, ask for missing style/reference/output details, and wait for confirmation before run_generation.',
    'For complete operational requests where all required inputs and settings are present, run_generation is allowed. Examples: "compress these PDFs with balanced", "translate this document to French preserving formatting", or "validate these uploaded specs against the BoQ".',
    'If the user is deciding on a direction, apply only useful setup actions and ask whether they are ready for the final run. Add run_generation only after they confirm.',
    'Do not write action labels or reasons using azimuth, elevation, altitude, or sun angle. Use visible UI language such as Light Source, Front, Back, Left, Right, high-noon lighting, intensity, color temperature, and shadows.',
    'For overhead skylight requests, use high-noon/direct overhead lighting language and prompt details about light pouring through skylights. Do not describe it as a vertical-angle slider change.',
    'prepare_image_selection switches to Visual Edit lasso selection so the user can circle an image area. Use it when the user wants to select/circle/mark something in the image.',
    'clear_image_selections clears current Visual Edit selection shapes and masks.',
    'reset_canvas_view fits the canvas to screen.',
    'clear_canvas removes the current canvas image.',
    'set_source_from_current locks the current image as the source image.',
    'use_latest_history_image places the latest generated history image back on the canvas.',
    'clear_prompt clears global and common feature prompt overrides.',
    'Append action requests only in this exact hidden JSON block at the end of the answer:',
    '<assistant_actions>{"actions":[{"type":"use_chat_image","imageTarget":"style-reference","attachmentId":"latest","label":"Use attached image as style reference","reason":"The uploaded image defines the desired visual language"},{"type":"set_workflow","path":"visualPrompt","value":"replace the selected floor with warm oak planks","label":"Use this edit prompt","reason":"Makes the edit instruction concrete"}]}</assistant_actions>',
    'Allowed setting actions for the current workspace:',
    ...lines,
  ].join('\n');
};
