import {
  IMAGE_GENERATION_MODELS,
  type Action,
  type AppState,
  type CameraState,
  type CanvasState,
  type ContextState,
  type DocumentTranslateState,
  type GenerationMode,
  type GeometryState,
  type ImageGenerationModel,
  type LightingState,
  type MaterialValidationState,
  type MaterialState,
  type OutputState,
  type StyleConfiguration,
  type WorkflowSettings,
} from '../types';
import { BUILT_IN_STYLES } from '../engine/promptEngine';

export type AppAssistantActionType =
  | 'set_mode'
  | 'set_language'
  | 'set_image_generation_model'
  | 'add_custom_style'
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
  | 'set_masterplan_zones'
  | 'set_exploded_components'
  | 'set_section_areas'
  | 'set_multi_angle_points'
  | 'set_active_right_tab'
  | 'set_active_bottom_tab'
  | 'open_right_panel'
  | 'close_right_panel'
  | 'open_left_sidebar'
  | 'close_left_sidebar'
  | 'open_bottom_panel'
  | 'collapse_bottom_panel'
  | 'open_feedback_report'
  | 'open_feedback_admin'
  | 'open_docs'
  | 'sign_out'
  | 'run_generation'
  | 'cancel_generation'
  | 'run_masterplan_zone_detection'
  | 'run_exploded_component_detection'
  | 'run_section_area_detection'
  | 'run_ai_selection'
  | 'reset_project'
  | 'download_project'
  | 'download_current_image'
  | 'download_latest_history_image'
  | 'download_all_history_images'
  | 'download_current_video'
  | 'download_translated_document'
  | 'download_pdf_outputs'
  | 'download_material_validation_report'
  | 'download_multi_angle_outputs'
  | 'download_angle_change_outputs'
  | 'download_headshots'
  | 'use_chat_image'
  | 'use_chat_file'
  | 'clear_image_target'
  | 'clear_file_target'
  | 'prepare_image_selection'
  | 'undo_selection_change'
  | 'redo_selection_change'
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
  fileTarget?: AppAssistantFileTarget;
  file?: AppAssistantChatFile;
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
  fileTarget?: AppAssistantFileTarget;
  file?: AppAssistantChatFile;
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
  | 'masterplan-input'
  | 'upscale-batch'
  | 'video-input'
  | 'video-start-frame'
  | 'video-end-frame'
  | 'video-keyframe'
  | 'headshot-left'
  | 'headshot-front'
  | 'headshot-right';

export interface AppAssistantChatImage {
  id: string;
  url: string;
  name?: string;
}

export type AppAssistantFileTarget =
  | 'document-translate-source'
  | 'material-validation-document'
  | 'pdf-compression-queue'
  | 'project-import';

export interface AppAssistantChatFile {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
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
type ValueType = 'string' | 'number' | 'boolean' | 'string[]' | 'number[]' | 'json';

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
  'angle-change',
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

const GENERATION_MODE_ALIASES: Record<string, GenerationMode> = {
  generate: 'generate-text',
  'generate text': 'generate-text',
  'generate from text': 'generate-text',
  'text generation': 'generate-text',
  'text to image': 'generate-text',
  '3d render': 'render-3d',
  '3d rendering': 'render-3d',
  '3d to render': 'render-3d',
  render3d: 'render-3d',
  'scene compose': 'scene-compose',
  'scene composition': 'scene-compose',
  'cad render': 'render-cad',
  'cad to render': 'render-cad',
  masterplans: 'masterplan',
  'visual edit': 'visual-edit',
  'visual editor': 'visual-edit',
  'image editor': 'visual-edit',
  'angle change': 'angle-change',
  'change angle': 'angle-change',
  'exploded view': 'exploded',
  'render sketch': 'render-sketch',
  'sketch render': 'render-sketch',
  'sketch to render': 'render-sketch',
  'multi angle': 'multi-angle',
  'multi-angle': 'multi-angle',
  upscaler: 'upscale',
  'image to cad': 'img-to-cad',
  'img to cad': 'img-to-cad',
  'video studio': 'video',
  'material validation': 'material-validation',
  'doc translator': 'document-translate',
  'document translator': 'document-translate',
  'document translate': 'document-translate',
  'pdf compressor': 'pdf-compression',
  'pdf compression': 'pdf-compression',
  headshots: 'headshot',
};

const normalizeGenerationModeValue = (value: unknown): GenerationMode | null => {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  if (GENERATION_MODES.includes(raw as GenerationMode)) return raw as GenerationMode;
  const normalized = raw
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const hyphenated = normalized.replace(/\s+/g, '-');
  if (GENERATION_MODES.includes(hyphenated as GenerationMode)) return hyphenated as GenerationMode;
  return GENERATION_MODE_ALIASES[normalized] || null;
};

const getImageGenerationModelLabel = (model: ImageGenerationModel) =>
  model === 'chatgpt-image-generation-2'
    ? 'ChatGPT Image Generation 2'
    : 'Nano Banana Pro';

const APP_LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'zh', label: 'Chinese' },
  { code: 'sr', label: 'Serbian' },
] as const;

const MAX_ASSISTANT_ACTIONS_PER_RESPONSE = 16;

const getAppLanguageLabel = (code: string) =>
  APP_LANGUAGE_OPTIONS.find((language) => language.code === code)?.label || code.toUpperCase();

const makeCustomStyleId = (name: string) => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${slug || 'custom-style'}-${makeAssistantImageId().slice(-8)}`;
};

const DOWNLOAD_ACTION_TYPES = [
  'download_project',
  'download_current_image',
  'download_latest_history_image',
  'download_all_history_images',
  'download_current_video',
  'download_translated_document',
  'download_pdf_outputs',
  'download_material_validation_report',
  'download_multi_angle_outputs',
  'download_angle_change_outputs',
  'download_headshots',
] as const satisfies readonly AppAssistantActionType[];

const WORKFLOW_MODE_PATH_PREFIXES: Record<GenerationMode, readonly string[]> = {
  'generate-text': ['textPrompt'],
  'render-3d': [
    'sourceType',
    'viewType',
    'renderMode',
    'canvasSync',
    'compareMode',
    'render3d',
    'styleReference',
    'backgroundReference',
  ],
  'scene-compose': ['sceneInsertionReferences', 'sceneComposeActivePlacementId'],
  'render-cad': ['cad', 'renderMode', 'styleReference', 'backgroundReference'],
  masterplan: ['mp'],
  'visual-edit': ['activeTool', 'visual'],
  'angle-change': ['angleChange'],
  exploded: ['exploded'],
  section: ['section'],
  'render-sketch': ['sketch'],
  'multi-angle': ['multiAngle'],
  upscale: ['upscale'],
  'img-to-cad': ['imgToCad'],
  video: ['videoState'],
  'material-validation': [],
  'document-translate': ['documentTranslate'],
  'pdf-compression': ['pdfCompression'],
  headshot: ['headshot'],
};

const WORKFLOW_DYNAMIC_SKIP_PREFIXES = [
  'mpZones',
  'mpBoundary.points',
  'mpBoundaryUndoStack',
  'mpBoundaryRedoStack',
  'mpContext.loadedData',
  'mpInputImage',
  'styleReferenceImage',
  'backgroundReferenceImage',
  'sceneInsertionReferences',
  'sceneComposeActivePlacementId',
  'visualSelections',
  'visualSelectionUndoStack',
  'visualSelectionRedoStack',
  'visualSelectionMask',
  'visualSelectionMaskSize',
  'visualSelectionViewScale',
  'visualSelectionComposite',
  'visualSelectionCompositeSize',
  'visualAutoSelecting',
  'visualMaterial.referenceImage',
  'visualObject.selectionIds',
  'visualBackground.referenceImage',
  'explodedComponents',
  'sectionAreas',
  'sketchDetectedPerspective',
  'sketchVanishingPoints',
  'sketchRefs',
  'upscaleBatch',
  'multiAngleAngles',
  'multiAngleOutputs',
  'angleChangeOutputs',
  'videoState.videoInputImage',
  'videoState.startFrame',
  'videoState.endFrame',
  'videoState.keyframes',
  'videoState.generatedVideoUrl',
  'videoState.generationProgress',
  'videoState.generationHistory',
  'documentTranslate.sourceDocument',
  'documentTranslate.progress',
  'documentTranslate.translatedDocumentUrl',
  'documentTranslate.warnings',
  'documentTranslate.xlsxStats',
  'documentTranslate.error',
  'pdfCompression.queue',
  'pdfCompression.selectedId',
  'pdfCompression.outputs',
  'pdfCompression.remainingFiles',
  'pdfCompression.remainingCredits',
  'headshot.leftImage',
  'headshot.frontImage',
  'headshot.rightImage',
  'headshot.generatedItems',
] as const;

const MATERIAL_VALIDATION_DYNAMIC_SKIP_PREFIXES = [
  'documents',
  'materials',
  'boqItems',
  'issues',
  'stats',
  'selectedMaterialCode',
  'isRunning',
  'lastRunAt',
  'aiSummary',
  'error',
] as const;

const VISUAL_AI_SELECTION_TARGETS = [
  'Building',
  'Facade',
  'Windows',
  'Doors',
  'Roof',
  'Walls',
  'Floors',
  'Ceilings',
  'Columns',
  'Structure',
  'Glass',
  'Signage',
  'Lighting',
  'Seating',
  'Furniture',
  'Counters',
  'People',
  'Vehicles',
  'Aircraft',
  'Trains',
  'Buses',
  'Jet Bridges',
  'Luggage Carts',
  'Platforms',
  'Roads',
  'Parking',
  'Ground',
  'Water',
  'Vegetation',
  'Sky',
  'Background',
] as const;

const VISUAL_REMOVE_QUICK_OPTIONS = [
  'People',
  'Vehicles',
  'Wires',
  'Signs',
  'Shadows',
  'Streetlights',
  'Poles',
  'Fences',
  'Trash',
  'Graffiti',
  'Reflections',
  'Glare',
  'Scaffolding',
  'Cones',
  'Construction Barriers',
  'Temporary Fencing',
  'Luggage Carts',
  'Queue Barriers',
  'Stanchions',
  'Cables',
  'Pipes',
  'HVAC Units',
  'Security Cameras',
  'Fire Extinguishers',
  'Exit Signs',
  'Wayfinding Displays',
  'Ad Posters',
  'Benches',
  'Chairs',
  'Plants',
  'Bollards',
  'Road Markings',
  'Puddles',
  'Birds',
  'Tree Branches',
] as const;

const VISUAL_PEOPLE_REGION_OPTIONS = [
  'european',
  'east-asian',
  'south-asian',
  'southeast-asian',
  'middle-eastern',
  'african',
  'latin-american',
  'pacific-islander',
  'central-asian',
] as const;

const VISUAL_PEOPLE_ACTIVITY_OPTIONS = [
  'walking',
  'standing',
  'sitting',
  'rushing',
  'queuing',
  'browsing-shops',
  'eating',
  'phone-use',
  'reading',
  'conversation',
  'sleeping',
  'working-laptop',
  'taking-photos',
  'pushing-stroller',
  'wheelchair',
] as const;

const VISUAL_PEOPLE_LUGGAGE_OPTIONS = [
  'rolling-suitcase',
  'backpack',
  'carry-on',
  'duffel-bag',
  'oversized',
  'shopping-bags',
  'duty-free',
  'briefcase',
  'garment-bag',
] as const;

const VISUAL_ADJUSTMENT_CHANNELS = [
  'Reds',
  'Oranges',
  'Yellows',
  'Greens',
  'Aquas',
  'Blues',
  'Purples',
  'Magentas',
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
  workflow('renderMode', '3D generation mode', 'string', ['render-3d'], {
    values: ['strict-realism', 'enhance'],
  }),
  workflow('renderMode', 'Generation mode', 'string', ['render-cad', 'masterplan', 'render-sketch', 'exploded', 'section'], {
    values: ['strict-realism', 'enhance', 'concept-push'],
  }),
  workflow('styleReferenceEnabled', 'Style reference enabled', 'boolean', ['render-3d', 'render-cad']),
  workflow('backgroundReferenceEnabled', 'Background reference enabled', 'boolean', ['render-3d', 'render-cad']),
  workflow('render3d.lighting.sun.enabled', 'Light Source enabled', 'boolean', ['render-3d']),
  workflow('render3d.lighting.sun.azimuth', 'Light Source left/right position', 'number', ['render-3d'], { min: 0, max: 360 }),
  workflow('render3d.lighting.sun.elevation', 'Light Source front/back position', 'number', ['render-3d'], { min: 0, max: 90 }),
  workflow('render3d.lighting.sun.colorTemp', 'Light Source color temperature', 'number', ['render-3d'], { min: 2000, max: 12000 }),
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
  workflow('visualSelection.autoTargets', 'AI selection targets', 'string[]', ['visual-edit'], {
    values: VISUAL_AI_SELECTION_TARGETS,
  }),
  workflow('visualMaterial.category', 'Material category', 'string', ['visual-edit'], {
    values: ['Flooring', 'Wall', 'Facade', 'Roof', 'Metal', 'Glass', 'Stone', 'Fabric'],
  }),
  workflow('visualMaterial.materialId', 'Material swatch id', 'string', ['visual-edit']),
  workflow('visualMaterial.referenceEnabled', 'Material reference', 'boolean', ['visual-edit']),
  workflow('visualMaterial.roughness', 'Material roughness', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualMaterial.colorTint', 'Material color tint', 'string', ['visual-edit']),
  workflow('visualLighting.mode', 'Lighting mode', 'string', ['visual-edit'], { values: ['sun', 'hdri', 'artificial'] }),
  workflow('visualLighting.sun.azimuth', 'Visual Edit Light Source left/right position', 'number', ['visual-edit'], { min: 0, max: 360 }),
  workflow('visualLighting.sun.elevation', 'Visual Edit Light Source front/back position', 'number', ['visual-edit'], { min: 0, max: 90 }),
  workflow('visualLighting.sun.intensity', 'Visual Edit Light Source intensity', 'number', ['visual-edit'], { min: 0, max: 200 }),
  workflow('visualLighting.sun.colorTemp', 'Visual Edit Light Source color temperature', 'number', ['visual-edit'], { min: 2000, max: 10000 }),
  workflow('visualLighting.sun.shadowSoftness', 'Visual Edit shadow softness', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualLighting.hdri.preset', 'Visual Edit HDRI preset', 'string', ['visual-edit'], {
    values: ['Studio', 'Outdoor', 'Overcast', 'Interior', 'Night'],
  }),
  workflow('visualLighting.hdri.rotation', 'Visual Edit HDRI rotation', 'number', ['visual-edit'], { min: 0, max: 360 }),
  workflow('visualLighting.hdri.intensity', 'Visual Edit HDRI intensity', 'number', ['visual-edit'], { min: 0, max: 200 }),
  workflow('visualLighting.artificial.type', 'Visual Edit artificial light type', 'string', ['visual-edit'], {
    values: ['point', 'spot', 'area'],
  }),
  workflow('visualLighting.artificial.position.x', 'Visual Edit artificial light horizontal position', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualLighting.artificial.position.y', 'Visual Edit artificial light vertical position', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualLighting.artificial.intensity', 'Visual Edit artificial light intensity', 'number', ['visual-edit'], { min: 0, max: 200 }),
  workflow('visualLighting.artificial.color', 'Visual Edit artificial light color', 'string', ['visual-edit']),
  workflow('visualLighting.artificial.falloff', 'Visual Edit artificial light falloff', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualLighting.ambient', 'Visual Edit ambient light', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualLighting.preserveShadows', 'Preserve existing shadows', 'boolean', ['visual-edit']),
  workflow('visualSky.preset', 'Sky preset', 'string', ['visual-edit'], {
    values: ['Clear Blue', 'Cloudy', 'Overcast', 'Sunset', 'Golden Hour', 'Blue Hour', 'Dusk', 'Night', 'Stormy', 'Dramatic'],
  }),
  workflow('visualSky.horizonLine', 'Sky horizon line', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualSky.cloudDensity', 'Sky cloud density', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualSky.atmosphere', 'Sky atmosphere', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualSky.brightness', 'Sky brightness', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualSky.reflectInGlass', 'Reflect sky in glass', 'boolean', ['visual-edit']),
  workflow('visualSky.matchLighting', 'Sky match lighting', 'boolean', ['visual-edit']),
  workflow('visualSky.sunFlare', 'Sky sun flare', 'boolean', ['visual-edit']),
  workflow('visualObject.category', 'Object category', 'string', ['visual-edit'], {
    values: ['Furniture', 'People', 'Vehicles', 'Vegetation', 'Props'],
  }),
  workflow('visualObject.subcategory', 'Object subcategory', 'string', ['visual-edit']),
  workflow('visualObject.assetId', 'Object asset id', 'string', ['visual-edit']),
  workflow('visualObject.placementMode', 'Object placement mode', 'string', ['visual-edit'], { values: ['place', 'replace'] }),
  workflow('visualObject.scale', 'Object scale', 'number', ['visual-edit'], { min: 10, max: 300 }),
  workflow('visualObject.rotation', 'Object rotation', 'number', ['visual-edit'], { min: 0, max: 360 }),
  workflow('visualObject.autoPerspective', 'Object auto perspective match', 'boolean', ['visual-edit']),
  workflow('visualObject.shadow', 'Object cast shadows', 'boolean', ['visual-edit']),
  workflow('visualObject.groundContact', 'Object ground contact', 'boolean', ['visual-edit']),
  workflow('visualObject.depth', 'Object depth', 'string', ['visual-edit'], {
    values: ['foreground', 'midground', 'background'],
  }),
  workflow('visualRemove.brushSize', 'Remove brush size', 'number', ['visual-edit'], { min: 4, max: 180 }),
  workflow('visualRemove.hardness', 'Remove brush hardness', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualRemove.quickRemove', 'Quick remove targets', 'string[]', ['visual-edit'], {
    values: VISUAL_REMOVE_QUICK_OPTIONS,
  }),
  workflow('visualRemove.autoDetectEdges', 'Auto-detect removal edges', 'boolean', ['visual-edit']),
  workflow('visualRemove.preserveStructure', 'Preserve structure while removing', 'boolean', ['visual-edit']),
  workflow('visualReplace.mode', 'Replace mode', 'string', ['visual-edit'], { values: ['similar', 'different', 'custom'] }),
  workflow('visualReplace.variation', 'Replace variation', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualReplace.category', 'Replace category', 'string', ['visual-edit'], {
    values: ['Furniture', 'Vehicle', 'Plant', 'Person', 'Object'],
  }),
  workflow('visualReplace.style', 'Replace style', 'string', ['visual-edit']),
  workflow('visualReplace.prompt', 'Replace prompt', 'string', ['visual-edit']),
  workflow('visualReplace.matchScale', 'Replace match scale', 'boolean', ['visual-edit']),
  workflow('visualReplace.matchLighting', 'Replace match lighting', 'boolean', ['visual-edit']),
  workflow('visualReplace.preserveShadows', 'Replace preserve shadows', 'boolean', ['visual-edit']),
  workflow('visualAdjust.aspectRatio', 'Adjustment aspect ratio', 'string', ['visual-edit'], {
    values: ['same', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
  }),
  workflow('visualAdjust.exposure', 'Exposure adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.contrast', 'Contrast adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.highlights', 'Highlights adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.shadows', 'Shadows adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.whites', 'Whites adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.blacks', 'Blacks adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.gamma', 'Gamma adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.saturation', 'Saturation adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.vibrance', 'Vibrance adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.temperature', 'Temperature adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.tint', 'Tint adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hueShift', 'Hue shift adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.texture', 'Texture adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.dehaze', 'Dehaze adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.sharpness', 'Sharpness adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.sharpnessRadius', 'Sharpness radius', 'number', ['visual-edit'], { min: 0.5, max: 3 }),
  workflow('visualAdjust.sharpnessDetail', 'Sharpness detail', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.sharpnessMasking', 'Sharpness masking', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.noiseReduction', 'Noise reduction luma', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.noiseReductionColor', 'Noise reduction color', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.noiseReductionDetail', 'Noise reduction detail', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslChannel', 'HSL channel', 'string', ['visual-edit'], { values: VISUAL_ADJUSTMENT_CHANNELS }),
  workflow('visualAdjust.hslRedsHue', 'HSL reds hue', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslRedsSaturation', 'HSL reds saturation', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslRedsLuminance', 'HSL reds luminance', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslOrangesHue', 'HSL oranges hue', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslOrangesSaturation', 'HSL oranges saturation', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslOrangesLuminance', 'HSL oranges luminance', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslYellowsHue', 'HSL yellows hue', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslYellowsSaturation', 'HSL yellows saturation', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslYellowsLuminance', 'HSL yellows luminance', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslGreensHue', 'HSL greens hue', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslGreensSaturation', 'HSL greens saturation', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslGreensLuminance', 'HSL greens luminance', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslAquasHue', 'HSL aquas hue', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslAquasSaturation', 'HSL aquas saturation', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslAquasLuminance', 'HSL aquas luminance', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslBluesHue', 'HSL blues hue', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslBluesSaturation', 'HSL blues saturation', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslBluesLuminance', 'HSL blues luminance', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslPurplesHue', 'HSL purples hue', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslPurplesSaturation', 'HSL purples saturation', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslPurplesLuminance', 'HSL purples luminance', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslMagentasHue', 'HSL magentas hue', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslMagentasSaturation', 'HSL magentas saturation', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.hslMagentasLuminance', 'HSL magentas luminance', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.colorGradeShadowsHue', 'Color grade shadows hue', 'number', ['visual-edit'], { min: -180, max: 180 }),
  workflow('visualAdjust.colorGradeShadowsSaturation', 'Color grade shadows saturation', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.colorGradeMidtonesHue', 'Color grade midtones hue', 'number', ['visual-edit'], { min: -180, max: 180 }),
  workflow('visualAdjust.colorGradeMidtonesSaturation', 'Color grade midtones saturation', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.colorGradeHighlightsHue', 'Color grade highlights hue', 'number', ['visual-edit'], { min: -180, max: 180 }),
  workflow('visualAdjust.colorGradeHighlightsSaturation', 'Color grade highlights saturation', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.colorGradeBalance', 'Color grade balance', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.clarity', 'Clarity adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.vignette', 'Vignette adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.vignetteMidpoint', 'Vignette midpoint', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.vignetteRoundness', 'Vignette roundness', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.vignetteFeather', 'Vignette feather', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.grain', 'Grain amount', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.grainSize', 'Grain size', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.grainRoughness', 'Grain roughness', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.bloom', 'Bloom adjustment', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.chromaticAberration', 'Chromatic aberration', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.transformRotate', 'Transform rotate', 'number', ['visual-edit'], { min: -45, max: 45 }),
  workflow('visualAdjust.transformHorizontal', 'Transform horizontal', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.transformVertical', 'Transform vertical', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.transformDistortion', 'Transform distortion', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.transformPerspective', 'Transform perspective', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualAdjust.styleStrength', 'Adjustment style strength', 'number', ['visual-edit'], { min: -100, max: 100 }),
  workflow('visualPeople.mode', 'People edit mode', 'string', ['visual-edit'], { values: ['enhance', 'automatic', 'repopulate'] }),
  workflow('visualPeople.airportZone', 'People airport zone', 'string', ['visual-edit'], {
    values: ['terminal-general', 'check-in', 'security', 'departure-gate', 'arrival-hall', 'baggage-claim', 'retail-area', 'food-court', 'lounge', 'transit-corridor'],
  }),
  workflow('visualPeople.regionMix', 'People region mix', 'string[]', ['visual-edit'], {
    values: VISUAL_PEOPLE_REGION_OPTIONS,
  }),
  workflow('visualPeople.ageDistribution', 'People age distribution', 'string', ['visual-edit'], {
    values: ['young-adults', 'mixed-all-ages', 'adults', 'families', 'elderly-included'],
  }),
  workflow('visualPeople.genderBalance', 'People gender balance', 'string', ['visual-edit'], {
    values: ['balanced', 'male-leaning', 'female-leaning'],
  }),
  workflow('visualPeople.childrenPresence', 'People children presence', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.bodyTypeVariety', 'People body type variety', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.density', 'People density', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.grouping', 'People grouping', 'string', ['visual-edit'], {
    values: ['solo-dominant', 'couples', 'families', 'mixed-groups', 'business-groups'],
  }),
  workflow('visualPeople.flowPattern', 'People flow pattern', 'string', ['visual-edit'], {
    values: ['random', 'directional', 'converging', 'dispersing', 'queuing'],
  }),
  workflow('visualPeople.movementDirection', 'People movement direction', 'string', ['visual-edit'], {
    values: ['mixed', 'mostly-left', 'mostly-right', 'toward-camera', 'away-from-camera'],
  }),
  workflow('visualPeople.paceOfMovement', 'People movement pace', 'string', ['visual-edit'], {
    values: ['relaxed', 'moderate', 'hurried', 'mixed'],
  }),
  workflow('visualPeople.clusteringTendency', 'People clustering tendency', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.wardrobeStyle', 'People wardrobe style', 'string', ['visual-edit'], {
    values: ['business', 'casual', 'travel', 'luxury', 'sporty', 'mixed'],
  }),
  workflow('visualPeople.seasonalClothing', 'People seasonal clothing', 'string', ['visual-edit'], {
    values: ['summer', 'winter', 'spring-fall', 'tropical', 'mixed'],
  }),
  workflow('visualPeople.formalityLevel', 'People formality level', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.culturalAttire', 'People cultural attire', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.activities', 'People activities', 'string[]', ['visual-edit'], {
    values: VISUAL_PEOPLE_ACTIVITY_OPTIONS,
  }),
  workflow('visualPeople.interactionLevel', 'People interaction level', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.luggageTypes', 'People luggage types', 'string[]', ['visual-edit'], {
    values: VISUAL_PEOPLE_LUGGAGE_OPTIONS,
  }),
  workflow('visualPeople.luggageAmount', 'People luggage amount', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.trolleyUsage', 'People trolley usage', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.personalDevices', 'People personal devices', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.travelAccessories', 'People travel accessories', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.includeAirportStaff', 'Include airport staff', 'boolean', ['visual-edit']),
  workflow('visualPeople.includeSecurityPersonnel', 'Include security personnel', 'boolean', ['visual-edit']),
  workflow('visualPeople.includeAirlineCrew', 'Include airline crew', 'boolean', ['visual-edit']),
  workflow('visualPeople.includeGroundCrew', 'Include ground crew', 'boolean', ['visual-edit']),
  workflow('visualPeople.includeServiceStaff', 'Include service staff', 'boolean', ['visual-edit']),
  workflow('visualPeople.staffDensity', 'People staff ratio', 'number', ['visual-edit'], { min: 0, max: 50 }),
  workflow('visualPeople.realism', 'People realism', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.sharpness', 'People sharpness', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.scaleAccuracy', 'People scale accuracy', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.placementDiscipline', 'People placement discipline', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.motionBlur', 'People motion blur', 'number', ['visual-edit'], { min: 0, max: 100 }),
  workflow('visualPeople.preserveExisting', 'Preserve existing people', 'boolean', ['visual-edit']),
  workflow('visualPeople.matchLighting', 'People match lighting', 'boolean', ['visual-edit']),
  workflow('visualPeople.matchPerspective', 'People match perspective', 'boolean', ['visual-edit']),
  workflow('visualPeople.groundContact', 'People ground contact', 'boolean', ['visual-edit']),
  workflow('visualPeople.removeArtifacts', 'People remove artifacts', 'boolean', ['visual-edit']),
  workflow('visualBackground.mode', 'Background mode', 'string', ['visual-edit'], { values: ['prompt', 'image'] }),
  workflow('visualBackground.prompt', 'Background prompt', 'string', ['visual-edit']),
  workflow('visualBackground.referenceMode', 'Background reference behavior', 'string', ['visual-edit'], {
    values: ['absolute', 'reference'],
  }),
  workflow('visualBackground.matchPerspective', 'Background match perspective', 'boolean', ['visual-edit']),
  workflow('visualBackground.matchLighting', 'Background match lighting', 'boolean', ['visual-edit']),
  workflow('visualBackground.seamlessBlend', 'Background seamless blend', 'boolean', ['visual-edit']),
  workflow('visualBackground.preserveDepth', 'Background preserve depth', 'boolean', ['visual-edit']),
  workflow('visualBackground.quality', 'Background quality', 'string', ['visual-edit'], {
    values: ['draft', 'standard', 'high'],
  }),
  workflow('visualExtend.direction', 'Outpaint direction', 'string', ['visual-edit'], {
    values: ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'none'],
  }),
  workflow('visualExtend.amount', 'Outpaint amount', 'number', ['visual-edit'], { min: 10, max: 200 }),
  workflow('visualExtend.targetAspectRatio', 'Outpaint target aspect ratio', 'string', ['visual-edit'], {
    values: ['16:9', '21:9', '4:3', '1:1', '9:16', 'custom'],
  }),
  workflow('visualExtend.customRatio.width', 'Outpaint custom ratio width', 'number', ['visual-edit'], { min: 1, max: 64 }),
  workflow('visualExtend.customRatio.height', 'Outpaint custom ratio height', 'number', ['visual-edit'], { min: 1, max: 64 }),

  workflow('angleChangeDegrees', 'Frame angle', 'number', ['angle-change'], { min: -45, max: 45 }),
  workflow('angleChangePitch', 'Angle Change tilt', 'number', ['angle-change'], { min: -30, max: 30 }),

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

const isSkippedPath = (path: string, prefixes: readonly string[]) =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}.`));

const labelFromPath = (path: string) =>
  path
    .split('.')
    .map((part) => part.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/-/g, ' '))
    .join(' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getWorkflowModesForPath = (path: string): GenerationMode[] | undefined => {
  const modes = GENERATION_MODES.filter((mode) =>
    WORKFLOW_MODE_PATH_PREFIXES[mode].some((prefix) => path === prefix || path.startsWith(prefix))
  );
  return modes.length ? modes : undefined;
};

const inferValueType = (value: unknown): ValueType | null => {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((item) => typeof item === 'string')) return 'string[]';
    if (value.length > 0 && value.every((item) => typeof item === 'number')) return 'number[]';
    return 'json';
  }
  if (value === null) return 'json';
  return null;
};

const collectDynamicDescriptors = (
  type: PathDescriptor['type'],
  source: unknown,
  options: {
    modesForPath?: (path: string) => GenerationMode[] | undefined;
    skipPrefixes?: readonly string[];
  } = {},
  prefix = ''
): PathDescriptor[] => {
  if (!source || typeof source !== 'object') return [];

  return Object.entries(source as Record<string, unknown>).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (options.skipPrefixes && isSkippedPath(path, options.skipPrefixes)) return [];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return collectDynamicDescriptors(type, value, options, path);
    }

    const valueType = inferValueType(value);
    if (!valueType) return [];
    return [{
      type,
      path,
      label: labelFromPath(path),
      valueType,
      modes: options.modesForPath?.(path),
    }];
  });
};

const uniqueDescriptors = (descriptors: PathDescriptor[]) => {
  const seen = new Set<string>();
  return descriptors.filter((descriptor) => {
    const key = `${descriptor.type}:${descriptor.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getPathDescriptors = (state: AppState): PathDescriptor[] => {
  const dynamicDescriptors = [
    ...collectDynamicDescriptors('set_workflow', state.workflow, {
      modesForPath: getWorkflowModesForPath,
      skipPrefixes: WORKFLOW_DYNAMIC_SKIP_PREFIXES,
    }),
    ...collectDynamicDescriptors('set_geometry', state.geometry),
    ...collectDynamicDescriptors('set_camera', state.camera),
    ...collectDynamicDescriptors('set_lighting', state.lighting),
    ...collectDynamicDescriptors('set_materials', state.materials),
    ...collectDynamicDescriptors('set_context', state.context),
    ...collectDynamicDescriptors('set_output', state.output),
    ...collectDynamicDescriptors('set_canvas', state.canvas),
    ...collectDynamicDescriptors('set_material_validation', state.materialValidation, {
      modesForPath: () => ['material-validation'],
      skipPrefixes: MATERIAL_VALIDATION_DYNAMIC_SKIP_PREFIXES,
    }),
    ...collectDynamicDescriptors('set_document_translate', state.workflow.documentTranslate, {
      modesForPath: () => ['document-translate'],
      skipPrefixes: WORKFLOW_DYNAMIC_SKIP_PREFIXES
        .filter((prefix) => prefix.startsWith('documentTranslate.'))
        .map((prefix) => prefix.replace(/^documentTranslate\./, '')),
    }),
  ];

  return uniqueDescriptors([...PATH_DESCRIPTORS, ...dynamicDescriptors]);
};

const coerceStringList = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  } catch {
    // Fall through to comma-separated parsing.
  }

  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const coerceNumberList = (value: unknown): number[] | undefined => {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? (() => {
          const trimmed = value.trim();
          if (!trimmed) return [];
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
          } catch {
            // Fall through to comma-separated parsing.
          }
          return trimmed.split(',').map((item) => item.trim());
        })()
      : undefined;

  if (!items) return undefined;
  const numbers = items.map((item) => typeof item === 'number' ? item : typeof item === 'string' ? Number(item) : NaN);
  return numbers.every(Number.isFinite) ? numbers : undefined;
};

const coerceJsonValue = (value: unknown): unknown | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
      return JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    Array.isArray(value) ||
    (value && typeof value === 'object')
  ) {
    return cloneValue(value);
  }

  return undefined;
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

  if (descriptor.valueType === 'string[]') {
    const list = coerceStringList(value);
    if (!list) return undefined;
    const unique = Array.from(new Set(list));
    if (descriptor.values?.length) {
      const allowed = new Set(descriptor.values.map(String));
      if (unique.some((item) => !allowed.has(item))) return undefined;
    }
    return unique;
  }

  if (descriptor.valueType === 'number[]') {
    return coerceNumberList(value);
  }

  if (descriptor.valueType === 'json') {
    return coerceJsonValue(value);
  }

  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (descriptor.values?.length && !descriptor.values.includes(trimmed)) return undefined;
  return trimmed;
};

const getDescriptor = (state: AppState, type: AppAssistantActionType | undefined, path: string | undefined): PathDescriptor | undefined => {
  if (!type || !path) return undefined;
  return getPathDescriptors(state).find((descriptor) => descriptor.type === type && descriptor.path === path);
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
  'masterplan-input',
  'upscale-batch',
  'video-input',
  'video-start-frame',
  'video-end-frame',
  'video-keyframe',
  'headshot-left',
  'headshot-front',
  'headshot-right',
] as const;

const FILE_TARGETS: readonly AppAssistantFileTarget[] = [
  'document-translate-source',
  'material-validation-document',
  'pdf-compression-queue',
  'project-import',
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
    'masterplan-input': 'Use attached image as masterplan input',
    'upscale-batch': 'Add attached image to upscale queue',
    'video-input': 'Use attached image as video input',
    'video-start-frame': 'Use attached image as video start frame',
    'video-end-frame': 'Use attached image as video end frame',
    'video-keyframe': 'Add attached image as video keyframe',
    'headshot-left': 'Use attached image as left headshot reference',
    'headshot-front': 'Use attached image as front headshot reference',
    'headshot-right': 'Use attached image as right headshot reference',
  };
  return labels[target];
};

const getFileTargetLabel = (target: AppAssistantFileTarget): string => {
  const labels: Record<AppAssistantFileTarget, string> = {
    'document-translate-source': 'Use attached file as translation document',
    'material-validation-document': 'Add attached file to material validation',
    'pdf-compression-queue': 'Add attached PDF to compression queue',
    'project-import': 'Load attached project JSON',
  };
  return labels[target];
};

const getClearImageTargetLabel = (target: AppAssistantImageTarget): string => {
  const labels: Record<AppAssistantImageTarget, string> = {
    canvas: 'Clear canvas image',
    source: 'Clear source image',
    'style-reference': 'Clear style reference image',
    'background-reference': 'Clear background reference image',
    'visual-material-reference': 'Clear Visual Edit material reference',
    'visual-background-reference': 'Clear Visual Edit background reference',
    'scene-compose-reference': 'Clear scene object references',
    'sketch-reference': 'Clear sketch references',
    'masterplan-input': 'Clear masterplan input image',
    'upscale-batch': 'Clear upscale queue',
    'video-input': 'Clear video input image',
    'video-start-frame': 'Clear video start frame',
    'video-end-frame': 'Clear video end frame',
    'video-keyframe': 'Clear video keyframes',
    'headshot-left': 'Clear left headshot reference',
    'headshot-front': 'Clear front headshot reference',
    'headshot-right': 'Clear right headshot reference',
  };
  return labels[target];
};

const getClearFileTargetLabel = (target: AppAssistantFileTarget): string => {
  const labels: Record<AppAssistantFileTarget, string> = {
    'document-translate-source': 'Clear translation source document',
    'material-validation-document': 'Clear Material Validation documents',
    'pdf-compression-queue': 'Clear PDF compression queue',
    'project-import': 'Clear project import request',
  };
  return labels[target];
};

const getDocumentTranslateType = (file: AppAssistantChatFile) => {
  const lowerName = file.name.toLowerCase();
  if (file.mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';
  if (
    file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    lowerName.endsWith('.xlsx')
  ) return 'xlsx';
  if (
    file.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    lowerName.endsWith('.pptx')
  ) return 'pptx';
  return 'docx';
};

const isPdfFile = (file: AppAssistantChatFile) =>
  file.mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

const isProjectJsonFile = (file: AppAssistantChatFile) => {
  const lowerName = file.name.toLowerCase();
  return file.mimeType === 'application/json' || file.mimeType === 'text/json' || lowerName.endsWith('.json');
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const decodeDataUrlText = (dataUrl: string): string | null => {
  const match = dataUrl.match(/^data:([^;,]*)(;base64)?,([\s\S]*)$/);
  if (!match) return null;

  try {
    const payload = match[3] || '';
    if (match[2]) {
      const binary = globalThis.atob(payload);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
};

const parseProjectStateFile = (file: AppAssistantChatFile): AppState | null => {
  if (!isProjectJsonFile(file)) return null;
  const text = decodeDataUrlText(file.url);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (!isRecord(parsed)) return null;
    if (typeof parsed.mode !== 'string' || !GENERATION_MODES.includes(parsed.mode as GenerationMode)) return null;
    if (!isRecord(parsed.workflow)) return null;
    if (!isRecord(parsed.output)) return null;
    if (!isRecord(parsed.canvas)) return null;
    if (!isRecord(parsed.geometry)) return null;
    if (!isRecord(parsed.camera)) return null;
    if (!isRecord(parsed.lighting)) return null;
    if (!isRecord(parsed.materials)) return null;
    if (!isRecord(parsed.context)) return null;
    return parsed as AppState;
  } catch {
    return null;
  }
};

const getRecordString = (source: Record<string, unknown>, key: string) => {
  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
};

const getOptionalIdentifier = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed && trimmed !== 'all' ? trimmed : null;
  }
  if (isRecord(value)) {
    return (
      getRecordString(value, 'id') ||
      getRecordString(value, 'name') ||
      getRecordString(value, 'caption') ||
      getRecordString(value, 'title') ||
      null
    );
  }
  return null;
};

const itemMatchesIdentifier = (item: unknown, identifier: string) => {
  if (!isRecord(item)) return false;
  const normalized = identifier.toLowerCase();
  return ['id', 'name', 'caption', 'title'].some((key) => {
    const value = item[key];
    return typeof value === 'string' && value.trim().toLowerCase() === normalized;
  });
};

const filterOptionalIdentifier = <T,>(items: T[], identifier: string | null): T[] =>
  identifier ? items.filter((item) => !itemMatchesIdentifier(item, identifier)) : [];

const readObjectPath = <T,>(source: Record<string, unknown>, path: string, fallback: T): T => {
  const value = readPath(source, path);
  if (!isRecord(value)) return cloneValue(fallback);
  const base = isRecord(fallback) ? cloneValue(fallback) : {};
  return { ...base, ...value } as T;
};

const readArrayPath = <T,>(source: Record<string, unknown>, path: string, fallback: T[] = []): T[] => {
  const value = readPath(source, path);
  return Array.isArray(value) ? [...value as T[]] : [...fallback];
};

const listFromRecord = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const list = coerceStringList(source[key]);
    if (list?.length) return list;
  }
  return [];
};

const makeCustomStyleFromRequest = (request: AppAssistantActionRequest): StyleConfiguration | null => {
  const raw = request.value;
  const source = isRecord(raw) ? raw : {};
  const name = getRecordString(source, 'name') || (typeof raw === 'string' ? raw.trim() : '');
  const description =
    getRecordString(source, 'description') ||
    getRecordString(source, 'direction') ||
    request.reason ||
    '';
  if (!name || !description) return null;

  const architectureVocabulary = listFromRecord(source, ['architectureVocabulary', 'vocabulary', 'forms']);
  const primaryMaterials = listFromRecord(source, ['materials', 'primaryMaterials', 'materialBias']);
  const secondaryMaterials = listFromRecord(source, ['secondaryMaterials', 'secondaryMaterialBias']);
  const avoidMaterials = listFromRecord(source, ['avoidMaterials', 'avoid']);
  const lighting = listFromRecord(source, ['lighting', 'lightingBias']);
  const avoidLighting = listFromRecord(source, ['avoidLighting']);
  const camera = listFromRecord(source, ['camera', 'angles', 'preferredAngles']);
  const framing = listFromRecord(source, ['framing', 'preferredFraming']);
  const quality = listFromRecord(source, ['quality', 'renderQuality']);
  const atmosphere = listFromRecord(source, ['atmosphere', 'mood']);
  const detail = listFromRecord(source, ['detail', 'details']);
  const previewUrl = getRecordString(source, 'previewUrl') || getRecordString(source, 'coverUrl') || undefined;

  return {
    id: makeCustomStyleId(name),
    name,
    category: getRecordString(source, 'category') || 'Custom',
    description,
    previewUrl,
    promptBundle: {
      architectureVocabulary,
      materialBias: {
        primary: primaryMaterials,
        secondary: secondaryMaterials,
        avoid: avoidMaterials,
      },
      lightingBias: {
        preferred: lighting,
        avoid: avoidLighting,
      },
      cameraBias: {
        preferredAngles: camera,
        preferredFraming: framing,
      },
      renderingLanguage: {
        quality,
        atmosphere,
        detail,
      },
    },
  };
};

const coerceJsonArray = (value: unknown): unknown[] | null => {
  const parsed = coerceJsonValue(value);
  return Array.isArray(parsed) ? parsed : null;
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, min), max);
};

const normalizeHexColor = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : fallback;
};

const MASTERPLAN_ZONE_TYPES = [
  'residential-low',
  'residential-medium',
  'residential-high',
  'commercial',
  'retail',
  'office',
  'industrial',
  'mixed',
  'green',
  'water',
  'infra',
  'institutional',
  'civic',
  'parking',
  'future',
] as const;

const MASTERPLAN_ZONE_COLORS: Record<string, string> = {
  'residential-low': '#8BC34A',
  'residential-medium': '#4CAF50',
  'residential-high': '#2E7D32',
  commercial: '#2196F3',
  retail: '#03A9F4',
  office: '#3F51B5',
  industrial: '#795548',
  mixed: '#9C27B0',
  green: '#66BB6A',
  water: '#00BCD4',
  infra: '#607D8B',
  institutional: '#FF9800',
  civic: '#F44336',
  parking: '#424242',
  future: '#FFEB3B',
};

const normalizeMasterplanZones = (value: unknown): AppState['workflow']['mpZones'] | null => {
  const items = coerceJsonArray(value);
  if (!items) return null;
  const allowedTypes = new Set<string>(MASTERPLAN_ZONE_TYPES);
  return items.slice(0, 64).map((item, index) => {
    const source = isRecord(item) ? item : {};
    const type = typeof source.type === 'string' && allowedTypes.has(source.type)
      ? source.type
      : 'mixed';
    const name = getRecordString(source, 'name') || `Zone ${index + 1}`;
    const area = source.areaHa;
    return {
      id: getRecordString(source, 'id') || makeAssistantImageId(),
      name,
      type,
      color: normalizeHexColor(source.color, MASTERPLAN_ZONE_COLORS[type] || '#9C27B0'),
      selected: typeof source.selected === 'boolean' ? source.selected : true,
      areaHa: typeof area === 'number' && Number.isFinite(area) ? Math.max(0, area) : undefined,
    };
  });
};

const EXPLODED_COMPONENT_CATEGORIES = ['structure', 'envelope', 'interior', 'mep', 'site'] as const;

const normalizeExplodedComponents = (value: unknown): AppState['workflow']['explodedComponents'] | null => {
  const items = coerceJsonArray(value);
  if (!items) return null;
  const allowedCategories = new Set<string>(EXPLODED_COMPONENT_CATEGORIES);
  return items.slice(0, 64).map((item, index) => {
    const source = isRecord(item) ? item : {};
    const name = getRecordString(source, 'name') || getRecordString(source, 'title') || `Component ${index + 1}`;
    const category = typeof source.category === 'string' && allowedCategories.has(source.category)
      ? source.category
      : 'structure';
    return {
      id: getRecordString(source, 'id') || makeAssistantImageId(),
      name,
      title: getRecordString(source, 'title') || name,
      description: getRecordString(source, 'description'),
      attributes: coerceStringList(source.attributes) || [],
      order: index,
      active: typeof source.active === 'boolean' ? source.active : true,
      category,
      color: typeof source.color === 'string' ? source.color.trim() : undefined,
    };
  });
};

const normalizeSectionAreas = (value: unknown): AppState['workflow']['sectionAreas'] | null => {
  const items = coerceJsonArray(value);
  if (!items) return null;
  return items.slice(0, 64).map((item, index) => {
    const source = isRecord(item) ? item : {};
    return {
      id: getRecordString(source, 'id') || makeAssistantImageId(),
      title: getRecordString(source, 'title') || getRecordString(source, 'name') || `Area ${index + 1}`,
      description: getRecordString(source, 'description'),
      order: index,
      active: typeof source.active === 'boolean' ? source.active : true,
    };
  });
};

const normalizeMultiAnglePoints = (value: unknown): AppState['workflow']['multiAngleAngles'] | null => {
  const items = coerceJsonArray(value);
  if (!items) return null;
  return items.slice(0, 12).map((item, index) => {
    const source = isRecord(item) ? item : {};
    return {
      id: getRecordString(source, 'id') || makeAssistantImageId(),
      azimuth: clampNumber(source.azimuth, 0, 360, index * 45),
      elevation: clampNumber(source.elevation, -30, 90, 10),
    };
  });
};

const getDownloadActionLabel = (type: AppAssistantActionType): string => {
  const labels: Partial<Record<AppAssistantActionType, string>> = {
    download_project: 'Export current project JSON',
    download_current_image: 'Download current canvas image',
    download_latest_history_image: 'Download latest history image',
    download_all_history_images: 'Download all history images',
    download_current_video: 'Download current generated video',
    download_translated_document: 'Download translated document',
    download_pdf_outputs: 'Download compressed PDF outputs',
    download_material_validation_report: 'Export Material Validation report',
    download_multi_angle_outputs: 'Download Multi-Angle outputs',
    download_angle_change_outputs: 'Download Angle Change outputs',
    download_headshots: 'Download generated headshots',
  };
  return labels[type] || 'Download output';
};

const canRunDownloadAction = (state: AppState, type: AppAssistantActionType) => {
  switch (type) {
    case 'download_project':
      return true;
    case 'download_current_image':
      return Boolean(state.uploadedImage);
    case 'download_latest_history_image':
      return state.history.some((item) => Boolean(item.thumbnail));
    case 'download_all_history_images':
      return state.history.some((item) => Boolean(item.thumbnail));
    case 'download_current_video':
      return Boolean(state.workflow.videoState.generatedVideoUrl);
    case 'download_translated_document':
      return Boolean(state.workflow.documentTranslate.translatedDocumentUrl);
    case 'download_pdf_outputs':
      return state.workflow.pdfCompression.outputs.length > 0;
    case 'download_material_validation_report':
      return true;
    case 'download_multi_angle_outputs':
      return state.workflow.multiAngleOutputs.length > 0;
    case 'download_angle_change_outputs':
      return state.workflow.angleChangeOutputs.length > 0;
    case 'download_headshots':
      return state.workflow.headshot.generatedItems.length > 0;
    default:
      return false;
  }
};

const isMasterplanBoundaryUndoMode = (state: AppState) =>
  state.mode === 'masterplan' && state.workflow.mpBoundary.mode === 'custom';

const canUndoSelectionChange = (state: AppState) =>
  (state.mode === 'visual-edit' && state.workflow.visualSelectionUndoStack.length > 0) ||
  (isMasterplanBoundaryUndoMode(state) && state.workflow.mpBoundaryUndoStack.length > 0);

const canRedoSelectionChange = (state: AppState) =>
  (state.mode === 'visual-edit' && state.workflow.visualSelectionRedoStack.length > 0) ||
  (isMasterplanBoundaryUndoMode(state) && state.workflow.mpBoundaryRedoStack.length > 0);

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
  if (Array.isArray(value)) {
    const preview = value.slice(0, 4).map(String).join(', ');
    if (!preview) return 'none';
    return value.length > 4 ? `${preview}, +${value.length - 4} more` : preview;
  }
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
  options: { chatImages?: AppAssistantChatImage[]; chatFiles?: AppAssistantChatFile[] } = {}
): AppAssistantAction[] => {
  const chatImages = options.chatImages || [];
  const chatFiles = options.chatFiles || [];

  return requests.flatMap((request, index): AppAssistantAction[] => {
    if (!request.type) return [];

    if (request.type === 'set_mode') {
      const mode = normalizeGenerationModeValue(request.mode || request.value);
      if (!mode) return [];
      return [{
        id: `${index}-set-mode-${mode}`,
        type: 'set_mode',
        mode,
        label: request.label || `Switch to ${mode.replace(/-/g, ' ')}`,
        reason: request.reason,
      }];
    }

    if (request.type === 'set_language') {
      const value = typeof request.value === 'string' ? request.value.trim().toLowerCase() : '';
      const language = APP_LANGUAGE_OPTIONS.find((item) => item.code === value);
      if (!language) return [];
      return [{
        id: `${index}-set-language-${language.code}`,
        type: 'set_language',
        value: language.code,
        label: request.label || `Switch app language to ${language.label}`,
        reason: request.reason,
      }];
    }

    if (request.type === 'set_image_generation_model') {
      const value = typeof request.value === 'string' ? request.value.trim() : '';
      if (!IMAGE_GENERATION_MODELS.includes(value as ImageGenerationModel)) return [];
      const model = value as ImageGenerationModel;
      return [{
        id: `${index}-set-image-generation-model-${model}`,
        type: 'set_image_generation_model',
        value: model,
        label: request.label || `Use ${getImageGenerationModelLabel(model)}`,
        reason: request.reason,
      }];
    }

    if (request.type === 'add_custom_style') {
      const style = makeCustomStyleFromRequest(request);
      if (!style) return [];
      return [{
        id: `${index}-add-custom-style-${style.id}`,
        type: 'add_custom_style',
        value: style,
        label: request.label || `Create style ${style.name}`,
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
      request.type === 'collapse_bottom_panel' ||
      request.type === 'open_feedback_report' ||
      request.type === 'open_feedback_admin' ||
      request.type === 'open_docs' ||
      request.type === 'sign_out'
    ) {
      const defaultLabels: Record<typeof request.type, string> = {
        open_right_panel: 'Open the settings panel',
        close_right_panel: 'Close the settings panel',
        open_left_sidebar: 'Open the workflow sidebar',
        close_left_sidebar: 'Close the workflow sidebar',
        open_bottom_panel: 'Open the bottom panel',
        collapse_bottom_panel: 'Collapse the bottom panel',
        open_feedback_report: 'Open feedback report',
        open_feedback_admin: 'Open feedback admin',
        open_docs: 'Open user manual',
        sign_out: 'Sign out',
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

    if (request.type === 'cancel_generation') {
      if (!state.isGenerating) return [];
      return [{
        id: `${index}-cancel-generation`,
        type: 'cancel_generation',
        label: request.label || 'Cancel generation',
        reason: request.reason,
      }];
    }

    if (
      request.type === 'run_masterplan_zone_detection' ||
      request.type === 'run_exploded_component_detection' ||
      request.type === 'run_section_area_detection'
    ) {
      const sourceImage = state.sourceImage || state.uploadedImage || state.workflow.mpInputImage;
      if (!sourceImage) return [];
      const labels: Record<typeof request.type, string> = {
        run_masterplan_zone_detection: 'Run Masterplan zone detection',
        run_exploded_component_detection: 'Run Exploded View component detection',
        run_section_area_detection: 'Run Section area detection',
      };
      return [{
        id: `${index}-${request.type}`,
        type: request.type,
        label: request.label || labels[request.type],
        reason: request.reason,
      }];
    }

    if (request.type === 'run_ai_selection') {
      return [];
    }

    if (request.type === 'reset_project') {
      return [{
        id: `${index}-reset-project`,
        type: 'reset_project',
        label: request.label || 'Reset project',
        reason: request.reason,
      }];
    }

    if (request.type === 'set_masterplan_zones') {
      const zones = normalizeMasterplanZones(request.value);
      if (!zones) return [];
      return [{
        id: `${index}-set-masterplan-zones`,
        type: 'set_masterplan_zones',
        value: zones,
        label: request.label || `Set ${zones.length} masterplan zones`,
        reason: request.reason,
      }];
    }

    if (request.type === 'set_exploded_components') {
      const components = normalizeExplodedComponents(request.value);
      if (!components) return [];
      return [{
        id: `${index}-set-exploded-components`,
        type: 'set_exploded_components',
        value: components,
        label: request.label || `Set ${components.length} exploded components`,
        reason: request.reason,
      }];
    }

    if (request.type === 'set_section_areas') {
      const areas = normalizeSectionAreas(request.value);
      if (!areas) return [];
      return [{
        id: `${index}-set-section-areas`,
        type: 'set_section_areas',
        value: areas,
        label: request.label || `Set ${areas.length} section areas`,
        reason: request.reason,
      }];
    }

    if (request.type === 'set_multi_angle_points') {
      const points = normalizeMultiAnglePoints(request.value);
      if (!points) return [];
      return [{
        id: `${index}-set-multi-angle-points`,
        type: 'set_multi_angle_points',
        value: points,
        label: request.label || `Set ${points.length} manual angle points`,
        reason: request.reason,
      }];
    }

    if (DOWNLOAD_ACTION_TYPES.includes(request.type as (typeof DOWNLOAD_ACTION_TYPES)[number])) {
      if (!canRunDownloadAction(state, request.type)) return [];
      return [{
        id: `${index}-${request.type}`,
        type: request.type,
        value: request.type === 'download_current_image'
          ? request.value
          : typeof request.value === 'string'
            ? request.value.trim()
            : undefined,
        label: request.label || getDownloadActionLabel(request.type),
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

    if (request.type === 'use_chat_file') {
      const target = request.fileTarget || (typeof request.path === 'string' ? request.path : undefined);
      if (!target || !FILE_TARGETS.includes(target as AppAssistantFileTarget)) return [];
      if (!chatFiles.length) return [];
      const requestedId = request.attachmentId || (typeof request.value === 'string' ? request.value : 'latest');
      const file = requestedId === 'latest'
        ? chatFiles[chatFiles.length - 1]
        : chatFiles.find((item) => item.id === requestedId) || chatFiles[chatFiles.length - 1];
      if (!file?.url) return [];
      const fileTarget = target as AppAssistantFileTarget;
      if (fileTarget === 'project-import' && !parseProjectStateFile(file)) return [];
      if (fileTarget === 'pdf-compression-queue' && !isPdfFile(file)) return [];
      if (fileTarget === 'pdf-compression-queue' && state.workflow.pdfCompression.queue.length >= 20) return [];
      return [{
        id: `${index}-use-chat-file-${fileTarget}-${file.id}`,
        type: 'use_chat_file',
        value: file.url,
        fileTarget,
        file,
        attachmentId: file.id,
        caption: file.name,
        label: request.label || getFileTargetLabel(fileTarget),
        reason: request.reason,
      }];
    }

    if (request.type === 'clear_image_target') {
      const target = request.imageTarget || (typeof request.path === 'string' ? request.path : undefined);
      if (!target || !IMAGE_TARGETS.includes(target as AppAssistantImageTarget)) return [];
      const imageTarget = target as AppAssistantImageTarget;
      return [{
        id: `${index}-clear-image-target-${imageTarget}-${getOptionalIdentifier(request.value) || 'all'}`,
        type: 'clear_image_target',
        value: getOptionalIdentifier(request.value) || undefined,
        imageTarget,
        label: request.label || getClearImageTargetLabel(imageTarget),
        reason: request.reason,
      }];
    }

    if (request.type === 'clear_file_target') {
      const target = request.fileTarget || (typeof request.path === 'string' ? request.path : undefined);
      if (!target || !FILE_TARGETS.includes(target as AppAssistantFileTarget)) return [];
      const fileTarget = target as AppAssistantFileTarget;
      if (fileTarget === 'project-import') return [];
      return [{
        id: `${index}-clear-file-target-${fileTarget}-${getOptionalIdentifier(request.value) || 'all'}`,
        type: 'clear_file_target',
        value: getOptionalIdentifier(request.value) || undefined,
        fileTarget,
        label: request.label || getClearFileTargetLabel(fileTarget),
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

    if (request.type === 'undo_selection_change') {
      if (!canUndoSelectionChange(state)) return [];
      return [{
        id: `${index}-undo-selection-change`,
        type: 'undo_selection_change',
        label: request.label || 'Undo selection change',
        reason: request.reason,
      }];
    }

    if (request.type === 'redo_selection_change') {
      if (!canRedoSelectionChange(state)) return [];
      return [{
        id: `${index}-redo-selection-change`,
        type: 'redo_selection_change',
        label: request.label || 'Redo selection change',
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

    const descriptor = getDescriptor(state, request.type, request.path);
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
  }).slice(0, MAX_ASSISTANT_ACTIONS_PER_RESPONSE);
};

export const applyAppAssistantActions = (
  dispatch: (action: Action) => void,
  state: AppState,
  actions: AppAssistantAction[]
) => {
  const projectImportAction = actions.find((action) => action.type === 'use_chat_file' && action.fileTarget === 'project-import');
  if (projectImportAction?.file) {
    const projectState = parseProjectStateFile(projectImportAction.file);
    if (projectState) {
      dispatch({ type: 'LOAD_PROJECT', payload: projectState });
    } else {
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: makeAssistantImageId(),
          tone: 'warning',
          message: 'Assistant could not load that project JSON.',
        },
      });
    }
    return;
  }

  if (actions.some((action) => action.type === 'reset_project')) {
    dispatch({ type: 'RESET_PROJECT' });
    return;
  }

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
  let nextImageGenerationModel: ImageGenerationModel | null = null;
  const customStylesToAdd: StyleConfiguration[] = [];
  let nextStyle: string | null = null;
  let nextPrompt: string | null = null;
  let nextRightTab: string | null = null;
  let nextBottomTab: string | null = null;
  let shouldOpenRightPanel: boolean | null = null;
  let shouldOpenLeftSidebar: boolean | null = null;
  let shouldOpenBottomPanel: boolean | null = null;
  let clearPrompt = false;
  let clearSelections = false;
  let undoSelectionChange = false;
  let redoSelectionChange = false;
  let resetCanvasView = false;
  let clearCanvas = false;
  let setSourceFromCurrent = false;
  let useLatestHistoryImage = false;
  let nextUploadedImage: string | null | undefined;
  let nextSourceImage: string | null | undefined;

  actions.forEach((action) => {
    if (action.type === 'set_mode' && action.mode) {
      nextMode = action.mode;
      return;
    }

    if (action.type === 'set_style' && typeof action.value === 'string') {
      nextStyle = action.value;
      return;
    }

    if (action.type === 'set_image_generation_model' && typeof action.value === 'string') {
      if (IMAGE_GENERATION_MODELS.includes(action.value as ImageGenerationModel)) {
        nextImageGenerationModel = action.value as ImageGenerationModel;
      }
      return;
    }

    if (action.type === 'add_custom_style' && action.value && typeof action.value === 'object') {
      const style = action.value as StyleConfiguration;
      if (typeof style.id === 'string' && typeof style.name === 'string') {
        customStylesToAdd.push(style);
        nextStyle = style.id;
      }
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

    if (action.type === 'undo_selection_change') {
      undoSelectionChange = true;
      return;
    }

    if (action.type === 'redo_selection_change') {
      redoSelectionChange = true;
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

    if (action.type === 'set_masterplan_zones' && Array.isArray(action.value)) {
      setPath(nextWorkflow, 'mpZones', action.value);
      setPath(nextWorkflow, 'mpZoneDetection', 'manual');
      workflowChanged = true;
      return;
    }

    if (action.type === 'set_exploded_components' && Array.isArray(action.value)) {
      const explodedSource = readObjectPath(nextWorkflow, 'explodedSource', state.workflow.explodedSource);
      setPath(nextWorkflow, 'explodedComponents', action.value);
      setPath(nextWorkflow, 'explodedSource', {
        ...explodedSource,
        componentCount: action.value.length,
      });
      workflowChanged = true;
      return;
    }

    if (action.type === 'set_section_areas' && Array.isArray(action.value)) {
      setPath(nextWorkflow, 'sectionAreas', action.value);
      setPath(nextWorkflow, 'sectionAreaDetection', 'manual');
      workflowChanged = true;
      return;
    }

    if (action.type === 'set_multi_angle_points' && Array.isArray(action.value)) {
      setPath(nextWorkflow, 'multiAngleAngles', action.value);
      setPath(nextWorkflow, 'multiAngleDistribution', 'manual');
      setPath(nextWorkflow, 'multiAngleViewCount', action.value.length);
      workflowChanged = true;
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
          const visualMaterial = readObjectPath(nextWorkflow, 'visualMaterial', state.workflow.visualMaterial);
          setPath(nextWorkflow, 'visualMaterial', {
            ...visualMaterial,
            referenceImage: image,
            referenceEnabled: true,
          });
          workflowChanged = true;
          break;
        case 'visual-background-reference':
          const visualBackground = readObjectPath(nextWorkflow, 'visualBackground', state.workflow.visualBackground);
          setPath(nextWorkflow, 'visualBackground', {
            ...visualBackground,
            mode: 'image',
            referenceImage: image,
          });
          workflowChanged = true;
          break;
        case 'scene-compose-reference':
          const sceneInsertionReferences = readArrayPath(
            nextWorkflow,
            'sceneInsertionReferences',
            state.workflow.sceneInsertionReferences
          );
          setPath(nextWorkflow, 'sceneInsertionReferences', [
            ...sceneInsertionReferences,
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
          const sketchRefs = readArrayPath(nextWorkflow, 'sketchRefs', state.workflow.sketchRefs);
          setPath(nextWorkflow, 'sketchRefs', [
            ...sketchRefs,
            {
              id: makeAssistantImageId(),
              url: image,
              type: state.workflow.sketchRefType || 'style',
            },
          ]);
          workflowChanged = true;
          break;
        case 'masterplan-input':
          setPath(nextWorkflow, 'mpInputSource', 'upload');
          setPath(nextWorkflow, 'mpInputImage', image);
          nextUploadedImage = image;
          nextSourceImage = image;
          workflowChanged = true;
          break;
        case 'upscale-batch': {
          const existing = readArrayPath(nextWorkflow, 'upscaleBatch', state.workflow.upscaleBatch || []);
          if (existing.length >= 20) break;
          setPath(nextWorkflow, 'upscaleBatch', [
            ...existing,
            {
              id: makeAssistantImageId(),
              name: action.caption || 'Assistant image',
              status: 'queued',
              url: image,
            },
          ]);
          workflowChanged = true;
          break;
        }
        case 'video-input':
          const videoInputState = readObjectPath(nextWorkflow, 'videoState', state.workflow.videoState);
          setPath(nextWorkflow, 'videoState', {
            ...videoInputState,
            inputMode: 'image-animate',
            videoInputImage: image,
          });
          workflowChanged = true;
          break;
        case 'video-start-frame':
          const videoStartState = readObjectPath(nextWorkflow, 'videoState', state.workflow.videoState);
          setPath(nextWorkflow, 'videoState', {
            ...videoStartState,
            inputMode: 'image-morph',
            startFrame: image,
          });
          workflowChanged = true;
          break;
        case 'video-end-frame':
          const videoEndState = readObjectPath(nextWorkflow, 'videoState', state.workflow.videoState);
          setPath(nextWorkflow, 'videoState', {
            ...videoEndState,
            inputMode: 'image-morph',
            endFrame: image,
          });
          workflowChanged = true;
          break;
        case 'video-keyframe':
          const videoKeyframeState = readObjectPath(nextWorkflow, 'videoState', state.workflow.videoState);
          const videoKeyframes = Array.isArray(videoKeyframeState.keyframes)
            ? videoKeyframeState.keyframes
            : [];
          setPath(nextWorkflow, 'videoState', {
            ...videoKeyframeState,
            inputMode: 'multi-shot',
            keyframes: [
              ...videoKeyframes,
              {
                id: makeAssistantImageId(),
                url: image,
                duration: 3,
              },
            ],
          });
          workflowChanged = true;
          break;
        case 'headshot-left':
          setPath(nextWorkflow, 'headshot', {
            ...readObjectPath(nextWorkflow, 'headshot', state.workflow.headshot),
            leftImage: image,
          });
          workflowChanged = true;
          break;
        case 'headshot-front':
          setPath(nextWorkflow, 'headshot', {
            ...readObjectPath(nextWorkflow, 'headshot', state.workflow.headshot),
            frontImage: image,
          });
          workflowChanged = true;
          break;
        case 'headshot-right':
          setPath(nextWorkflow, 'headshot', {
            ...readObjectPath(nextWorkflow, 'headshot', state.workflow.headshot),
            rightImage: image,
          });
          workflowChanged = true;
          break;
      }
      return;
    }

    if (action.type === 'use_chat_file' && action.fileTarget && action.file) {
      const file = action.file;
      switch (action.fileTarget) {
        case 'project-import':
          break;
        case 'document-translate-source': {
          const type = getDocumentTranslateType(file);
          setPath(nextDocumentTranslate, 'sourceDocument', {
            id: makeAssistantImageId(),
            name: file.name,
            type,
            mimeType: file.mimeType || 'application/octet-stream',
            size: file.size,
            dataUrl: file.url,
            uploadedAt: Date.now(),
          });
          setPath(nextDocumentTranslate, 'error', null);
          setPath(nextDocumentTranslate, 'translatedDocumentUrl', null);
          setPath(nextDocumentTranslate, 'warnings', null);
          setPath(nextDocumentTranslate, 'xlsxStats', null);
          documentTranslateChanged = true;
          break;
        }
        case 'material-validation-document':
          const documents = readArrayPath(nextMaterialValidation, 'documents', state.materialValidation.documents);
          setPath(nextMaterialValidation, 'documents', [
            ...documents,
            {
              id: makeAssistantImageId(),
              name: file.name,
              mimeType: file.mimeType || 'application/octet-stream',
              size: file.size,
              dataUrl: file.url,
              uploadedAt: Date.now(),
            },
          ]);
          setPath(nextMaterialValidation, 'error', null);
          materialValidationChanged = true;
          break;
        case 'pdf-compression-queue': {
          if (!isPdfFile(file)) break;
          const pdfCompression = readObjectPath(nextWorkflow, 'pdfCompression', state.workflow.pdfCompression);
          const existing = Array.isArray(pdfCompression.queue) ? pdfCompression.queue : [];
          if (existing.length >= 20) break;
          const id = makeAssistantImageId();
          setPath(nextWorkflow, 'pdfCompression', {
            ...pdfCompression,
            queue: [
              ...existing,
              {
                id,
                name: file.name,
                size: file.size,
                dataUrl: file.url,
                uploadedAt: Date.now(),
              },
            ],
            selectedId: pdfCompression.selectedId ?? id,
          });
          workflowChanged = true;
          break;
        }
      }
      return;
    }

    if (action.type === 'clear_image_target' && action.imageTarget) {
      const identifier = typeof action.value === 'string' ? action.value : null;
      switch (action.imageTarget) {
        case 'canvas':
          clearCanvas = true;
          break;
        case 'source':
          nextSourceImage = null;
          break;
        case 'style-reference':
          setPath(nextWorkflow, 'styleReferenceImage', null);
          setPath(nextWorkflow, 'styleReferenceEnabled', false);
          workflowChanged = true;
          break;
        case 'background-reference':
          setPath(nextWorkflow, 'backgroundReferenceImage', null);
          setPath(nextWorkflow, 'backgroundReferenceEnabled', false);
          workflowChanged = true;
          break;
        case 'visual-material-reference':
          const visualMaterial = readObjectPath(nextWorkflow, 'visualMaterial', state.workflow.visualMaterial);
          setPath(nextWorkflow, 'visualMaterial', {
            ...visualMaterial,
            referenceImage: null,
            referenceEnabled: false,
          });
          workflowChanged = true;
          break;
        case 'visual-background-reference':
          const visualBackground = readObjectPath(nextWorkflow, 'visualBackground', state.workflow.visualBackground);
          setPath(nextWorkflow, 'visualBackground', {
            ...visualBackground,
            referenceImage: null,
            mode: 'prompt',
          });
          workflowChanged = true;
          break;
        case 'scene-compose-reference':
          setPath(
            nextWorkflow,
            'sceneInsertionReferences',
            filterOptionalIdentifier(
              readArrayPath(nextWorkflow, 'sceneInsertionReferences', state.workflow.sceneInsertionReferences),
              identifier
            )
          );
          workflowChanged = true;
          break;
        case 'sketch-reference':
          setPath(
            nextWorkflow,
            'sketchRefs',
            filterOptionalIdentifier(readArrayPath(nextWorkflow, 'sketchRefs', state.workflow.sketchRefs), identifier)
          );
          workflowChanged = true;
          break;
        case 'masterplan-input':
          setPath(nextWorkflow, 'mpInputImage', null);
          workflowChanged = true;
          break;
        case 'upscale-batch':
          setPath(
            nextWorkflow,
            'upscaleBatch',
            filterOptionalIdentifier(readArrayPath(nextWorkflow, 'upscaleBatch', state.workflow.upscaleBatch), identifier)
          );
          workflowChanged = true;
          break;
        case 'video-input':
          const videoInputState = readObjectPath(nextWorkflow, 'videoState', state.workflow.videoState);
          setPath(nextWorkflow, 'videoState', {
            ...videoInputState,
            videoInputImage: null,
          });
          workflowChanged = true;
          break;
        case 'video-start-frame':
          const videoStartState = readObjectPath(nextWorkflow, 'videoState', state.workflow.videoState);
          setPath(nextWorkflow, 'videoState', {
            ...videoStartState,
            startFrame: null,
          });
          workflowChanged = true;
          break;
        case 'video-end-frame':
          const videoEndState = readObjectPath(nextWorkflow, 'videoState', state.workflow.videoState);
          setPath(nextWorkflow, 'videoState', {
            ...videoEndState,
            endFrame: null,
          });
          workflowChanged = true;
          break;
        case 'video-keyframe':
          const videoKeyframeState = readObjectPath(nextWorkflow, 'videoState', state.workflow.videoState);
          const videoKeyframes = Array.isArray(videoKeyframeState.keyframes)
            ? videoKeyframeState.keyframes
            : [];
          setPath(nextWorkflow, 'videoState', {
            ...videoKeyframeState,
            keyframes: filterOptionalIdentifier(videoKeyframes, identifier),
          });
          workflowChanged = true;
          break;
        case 'headshot-left':
          setPath(nextWorkflow, 'headshot', {
            ...readObjectPath(nextWorkflow, 'headshot', state.workflow.headshot),
            leftImage: null,
          });
          workflowChanged = true;
          break;
        case 'headshot-front':
          setPath(nextWorkflow, 'headshot', {
            ...readObjectPath(nextWorkflow, 'headshot', state.workflow.headshot),
            frontImage: null,
          });
          workflowChanged = true;
          break;
        case 'headshot-right':
          setPath(nextWorkflow, 'headshot', {
            ...readObjectPath(nextWorkflow, 'headshot', state.workflow.headshot),
            rightImage: null,
          });
          workflowChanged = true;
          break;
      }
      return;
    }

    if (action.type === 'clear_file_target' && action.fileTarget) {
      const identifier = typeof action.value === 'string' ? action.value : null;
      switch (action.fileTarget) {
        case 'document-translate-source':
          setPath(nextDocumentTranslate, 'sourceDocument', null);
          setPath(nextDocumentTranslate, 'progress', {
            phase: 'idle',
            currentSegment: 0,
            totalSegments: 0,
            currentBatch: 0,
            totalBatches: 0,
          });
          setPath(nextDocumentTranslate, 'translatedDocumentUrl', null);
          setPath(nextDocumentTranslate, 'warnings', null);
          setPath(nextDocumentTranslate, 'xlsxStats', null);
          setPath(nextDocumentTranslate, 'error', null);
          documentTranslateChanged = true;
          break;
        case 'material-validation-document':
          setPath(
            nextMaterialValidation,
            'documents',
            filterOptionalIdentifier(
              readArrayPath(nextMaterialValidation, 'documents', state.materialValidation.documents),
              identifier
            )
          );
          setPath(nextMaterialValidation, 'error', null);
          materialValidationChanged = true;
          break;
        case 'pdf-compression-queue': {
          const pdfCompression = readObjectPath(nextWorkflow, 'pdfCompression', state.workflow.pdfCompression);
          const queue = Array.isArray(pdfCompression.queue) ? pdfCompression.queue : [];
          const nextQueue = filterOptionalIdentifier(queue, identifier);
          const selectedId = nextQueue.some((item) => item.id === pdfCompression.selectedId)
            ? pdfCompression.selectedId
            : nextQueue[0]?.id ?? null;
          setPath(nextWorkflow, 'pdfCompression', {
            ...pdfCompression,
            queue: nextQueue,
            selectedId,
          });
          workflowChanged = true;
          break;
        }
        case 'project-import':
          break;
      }
      return;
    }

    const descriptor = getDescriptor(state, action.type, action.path);
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
  if (nextImageGenerationModel) dispatch({ type: 'SET_IMAGE_GENERATION_MODEL', payload: nextImageGenerationModel });
  if (nextUploadedImage !== undefined) dispatch({ type: 'SET_IMAGE', payload: nextUploadedImage });
  if (nextSourceImage !== undefined) dispatch({ type: 'SET_SOURCE_IMAGE', payload: nextSourceImage });
  customStylesToAdd.forEach((style) => dispatch({ type: 'ADD_CUSTOM_STYLE', payload: style }));
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
  if (undoSelectionChange && canUndoSelectionChange(state)) {
    if (isMasterplanBoundaryUndoMode(state)) {
      const previous = state.workflow.mpBoundaryUndoStack[state.workflow.mpBoundaryUndoStack.length - 1] || [];
      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          mpBoundary: { ...state.workflow.mpBoundary, points: previous },
          mpBoundaryUndoStack: state.workflow.mpBoundaryUndoStack.slice(0, -1),
          mpBoundaryRedoStack: [...state.workflow.mpBoundaryRedoStack, state.workflow.mpBoundary.points],
        },
      });
    } else {
      const previous = state.workflow.visualSelectionUndoStack[state.workflow.visualSelectionUndoStack.length - 1] || [];
      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          visualSelections: previous,
          visualSelectionUndoStack: state.workflow.visualSelectionUndoStack.slice(0, -1),
          visualSelectionRedoStack: [...state.workflow.visualSelectionRedoStack, state.workflow.visualSelections],
        },
      });
    }
  }
  if (redoSelectionChange && canRedoSelectionChange(state)) {
    if (isMasterplanBoundaryUndoMode(state)) {
      const next = state.workflow.mpBoundaryRedoStack[state.workflow.mpBoundaryRedoStack.length - 1] || [];
      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          mpBoundary: { ...state.workflow.mpBoundary, points: next },
          mpBoundaryUndoStack: [...state.workflow.mpBoundaryUndoStack, state.workflow.mpBoundary.points],
          mpBoundaryRedoStack: state.workflow.mpBoundaryRedoStack.slice(0, -1),
        },
      });
    } else {
      const next = state.workflow.visualSelectionRedoStack[state.workflow.visualSelectionRedoStack.length - 1] || [];
      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          visualSelections: next,
          visualSelectionUndoStack: [...state.workflow.visualSelectionUndoStack, state.workflow.visualSelections],
          visualSelectionRedoStack: state.workflow.visualSelectionRedoStack.slice(0, -1),
        },
      });
    }
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
  options: { chatImages?: AppAssistantChatImage[]; chatFiles?: AppAssistantChatFile[] } = {}
): string => {
  const descriptors = getPathDescriptors(state).filter((descriptor) => !descriptor.modes || descriptor.modes.includes(state.mode));
  const chatImages = options.chatImages || [];
  const chatFiles = options.chatFiles || [];
  const availableDownloads = DOWNLOAD_ACTION_TYPES.filter((type) => canRunDownloadAction(state, type));
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
    const arrayHint = descriptor.valueType === 'string[]' || descriptor.valueType === 'number[]'
      ? ' Provide as a JSON array or comma-separated list.'
      : descriptor.valueType === 'json'
        ? ' Provide as valid JSON.'
        : '';
    return `- ${descriptor.type} path "${descriptor.path}" (${descriptor.label}, ${descriptor.valueType}). Current: ${summarizeValue(current)}.${allowed}${range}${arrayHint}`;
  });

  return [
    'ASSISTANT CONTROL CAPABILITY:',
    'When the user asks you to set up, optimize, change, apply, prepare, switch, or fill settings, you may request app changes.',
    'Do not claim changes are already applied in your prose. The app validates action requests, then applies them automatically in Act mode or shows them as one-click actions in Suggest mode.',
    'Only use the exact action types and paths listed below.',
    `set_mode can switch to: ${GENERATION_MODES.join(', ')}`,
    `set_language can switch the app language. Allowed values: ${APP_LANGUAGE_OPTIONS.map((language) => `${language.code} (${getAppLanguageLabel(language.code)})`).join(', ')}.`,
    `set_image_generation_model can switch the top-bar Image Model. Current: ${state.imageGenerationModel}. Allowed values: ${IMAGE_GENERATION_MODELS.join(', ')}. Nano Banana Pro is the primary choice for new photorealistic architectural renderings, 3D/CAD/sketch-to-render transformations, color, HDR feel, tone, lighting, atmosphere, and render polish. ChatGPT Image Generation 2 is best for specific edits to existing or already rendered images, precision, preservation, masks/selections, object or material changes, and text-heavy images when the gateway has an OPENAI_API_KEY configured.`,
    'add_custom_style creates and selects a custom style preset. Use value as an object with name, description, and optional arrays: architectureVocabulary, materials, secondaryMaterials, avoidMaterials, lighting, avoidLighting, camera, framing, quality, atmosphere, detail, plus optional previewUrl.',
    `set_style can choose an existing style id. Current: ${state.activeStyleId}. Available styles: ${styleOptions}`,
    'set_masterplan_zones replaces the Masterplan zone list. Use value as an array of objects with name, type, color, selected, and optional areaHa.',
    'set_exploded_components replaces the Exploded View component list. Use value as an array of objects with name/title, description, category, attributes, and active.',
    'set_section_areas replaces the Section area list. Use value as an array of objects with title, description, and active.',
    'set_multi_angle_points replaces manual Multi-Angle points. Use value as an array of objects with azimuth and elevation.',
    'set_prompt can write a complete optimized prompt into the global prompt override.',
    'set_active_right_tab and set_active_bottom_tab can open a tab by string value when useful.',
    'open_right_panel, close_right_panel, open_left_sidebar, close_left_sidebar, open_bottom_panel, and collapse_bottom_panel can change workspace panel visibility.',
    'open_feedback_report opens the in-app feedback report dialog. open_feedback_admin opens the admin dashboard when the signed-in user is an admin. open_docs opens the user manual. sign_out signs the current user out; use sign_out only when the user explicitly asks to sign out or log out.',
    `cancel_generation is available only while generation is running. Current generation status: ${state.isGenerating ? 'running' : 'idle'}.`,
    'reset_project resets the entire workspace. Use it only when the user explicitly asks to reset/start over/new project, and do not combine it with other setup actions.',
    'Some action paths use legacy implementation names. Do not say those path names to the user; translate them into visible UI language.',
    'For the visible Light Source grid: Left uses a low left/right value around 90, Center around 180, Right around 270. Front uses front/back around 75, Center around 45, Back around 15.',
    `Attached user images this turn: ${chatImages.length ? chatImages.map((image) => `${image.id}${image.name ? ` (${image.name})` : ''}`).join(', ') : 'none'}.`,
    `Attached user files this turn: ${chatFiles.length ? chatFiles.map((file) => `${file.id} (${file.name}, ${file.mimeType || 'unknown'}, ${file.size} bytes)`).join(', ') : 'none'}.`,
    'use_chat_image can place an attached user image into the app. It requires imageTarget and attachmentId. Use attachmentId "latest" for the newest image.',
    `Valid imageTarget values: ${IMAGE_TARGETS.join(', ')}.`,
    'Use style-reference for visual language, background-reference for environment/context, visual-material-reference for a material sample, scene-compose-reference for an object/product/furniture reference, masterplan-input for site maps, upscale-batch for images to upscale, video-start-frame/video-end-frame/video-keyframe for video workflows, and canvas/source for the main image to work from.',
    'clear_image_target removes an image/reference from an imageTarget. Use value "all" or omit value to clear the whole target; use a visible id/name/title/caption to remove one item from scene-compose-reference, sketch-reference, upscale-batch, or video-keyframe.',
    'use_chat_file can place an attached non-image file into the app. It requires fileTarget and attachmentId. Use attachmentId "latest" for the newest file.',
    `Valid fileTarget values: ${FILE_TARGETS.join(', ')}.`,
    'Use document-translate-source for DOCX/XLSX/PPTX/PDF translation, material-validation-document for material schedules/BoQs/spec documents, pdf-compression-queue only for PDFs, and project-import only when the user explicitly asks to load/import an attached ArchViz project JSON.',
    'clear_file_target removes files from document-translate-source, material-validation-document, or pdf-compression-queue. Use value "all" or omit value to clear the whole target; use a visible id/name/title/caption to remove one validation document or queued PDF.',
    'If a reference image, document, or PDF would help but no matching user attachment is available, ask them to attach it with the paperclip button in the assistant composer.',
    'run_generation runs the current workflow. Treat it as final execution for every feature: generate, render, translate, validate, compress, upscale, animate, or create headshots.',
    'run_masterplan_zone_detection runs Masterplan zone auto-detection when a masterplan/source image is available.',
    'run_exploded_component_detection runs Exploded View component auto-detection when a source image is available.',
    'run_section_area_detection runs Section area auto-detection when a source image is available.',
    'Do not request run_ai_selection. The assistant must not trigger Visual Edit auto-selection. When selection is needed, route to Visual Edit, set manual selection mode, and tell the user to mark the area themselves with Rect, Brush, or Lasso.',
    'Wrong-feature routing: if the user is in 3D Rendering, Generate from Text, Upscale, or Scene Compose but asks to change one existing object/material/color/region in a finished render or photo, explain that this is a Visual Edit task and request set_mode visual-edit. For chair color or seating material edits, also request set_image_generation_model chatgpt-image-generation-2, set_workflow activeTool select if no selection exists, set_workflow visualSelection.mode lasso, set_workflow visualPrompt with the exact edit, and open_right_panel. Do not add run_generation until the user manually selects the target area and confirms the final edit.',
    'When you say "I will switch", "I will set", "I will trigger", or similar, you must include the matching hidden assistant_actions block in the same response. For the common request "change the color of the chairs, carpet, and plants" from a non-Visual-Edit mode, include actions for set_mode visual-edit, set_image_generation_model chatgpt-image-generation-2, set_workflow activeTool select, set_workflow visualSelection.mode lasso, set_workflow visualPrompt, and open_right_panel. Then tell the user to select the chairs, carpet, and plants manually.',
    `Download actions currently available: ${availableDownloads.length ? availableDownloads.map((type) => `${type} (${getDownloadActionLabel(type)})`).join(', ') : 'none'}. Use a download action when the user asks to download/export the current project JSON or an existing generated output.`,
    'For download_current_image, optional value may be {"format":"png"|"jpg","resolution":"full"|"medium"} to match the top-bar image download format and resolution controls.',
    'For broad creative requests in any feature, treat the request as setup intent, not final permission. Apply safe setup actions, use available detection helpers when useful, ask for missing style/reference/output details, and wait for confirmation before run_generation.',
    'For complete operational requests where all required inputs and settings are present, run_generation is allowed. Examples: "compress these PDFs with balanced", "translate this document to French preserving formatting", or "validate these uploaded specs against the BoQ".',
    'If the user is deciding on a direction, apply only useful setup actions and ask whether they are ready for the final run. Add run_generation only after they confirm.',
    'Do not write action labels or reasons using azimuth, elevation, altitude, or sun angle. Use visible UI language such as Light Source, Front, Back, Left, Right, high-noon lighting, intensity, color temperature, and shadows.',
    'For overhead skylight requests, use high-noon/direct overhead lighting language and prompt details about light pouring through skylights. Do not describe it as a vertical-angle slider change.',
    'prepare_image_selection switches to Visual Edit lasso selection so the user can circle an image area. Use it when the user wants to select/circle/mark something in the image.',
    `undo_selection_change can undo the last Visual Edit selection or custom Masterplan boundary change when available. Current availability: ${canUndoSelectionChange(state) ? 'yes' : 'no'}.`,
    `redo_selection_change can redo the last undone Visual Edit selection or custom Masterplan boundary change when available. Current availability: ${canRedoSelectionChange(state) ? 'yes' : 'no'}.`,
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
