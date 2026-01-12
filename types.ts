
export type GenerationMode = 
  | 'render-3d' 
  | 'render-cad' 
  | 'masterplan' 
  | 'visual-edit' 
  | 'exploded' 
  | 'section' 
  | 'render-sketch' 
  | 'upscale' 
  | 'img-to-cad' 
  | 'img-to-3d' 
  | 'video'
  | 'material-validation';

export interface StyleConfiguration {
  id: string;
  name: string;
  category: string;
  description: string;
  previewUrl?: string;
  promptBundle: any;
}

export interface DetectedElement {
  id: string;
  name: string;
  confidence: number;
  type: 'structural' | 'envelope' | 'interior' | 'site';
  selected: boolean;
}

export interface DetectedLayer {
  id: string;
  name: string;
  color: string;
  type: 'wall' | 'window' | 'door' | 'stairs' | 'dims' | 'text';
  visible: boolean;
}

export interface ZoneItem {
  id: string;
  name: string;
  color: string;
  type: 'residential' | 'commercial' | 'green' | 'mixed' | 'infra';
  selected: boolean;
}

export interface WorkflowSettings {
  // 1. 3D to Render
  sourceType: 'revit' | 'rhino' | 'sketchup' | 'blender' | '3dsmax' | 'clay' | 'other';
  viewType: 'exterior' | 'interior' | 'aerial' | 'detail';
  detectedElements: DetectedElement[];
  renderMode: 'enhance' | 'stylize' | 'hybrid' | 'strict-realism' | 'concept-push';
  canvasSync: boolean; // Used for Split View toggle
  compareMode: boolean;

  // 2. CAD to Render
  cadDrawingType: 'plan' | 'section' | 'elevation' | 'site';
  cadScale: string;
  cadOrientation: number;
  cadLayers: DetectedLayer[];
  cadCamera: { height: number; angle: 'horizontal' | 'down' | 'up' };
  cadSpatial: { ceilingHeight: number; floorThick: number; wallThick: number; style: number }; // style 0-100 conservative-creative
  cadMaterialAssignments: Record<string, string>; // elementId -> materialId
  cadFurnishing: { auto: boolean; styles: string[]; density: number };

  // 3. Masterplan
  mpPlanType: 'site' | 'urban' | 'zoning' | 'massing';
  mpScale: string;
  mpZones: ZoneItem[];
  mpContext: { location: string; loadBuildings: boolean; loadRoads: boolean; loadWater: boolean; loadTerrain: boolean };
  mpOutputType: 'photorealistic' | 'diagrammatic' | 'hybrid' | 'illustrative';
  mpBuildingStyle: { style: string; heightMode: 'uniform' | 'color' | 'random'; defaultHeight: number; roofType: 'flat' | 'gabled' };
  mpExport: { topDown: boolean; aerialNE: boolean; aerialSW: boolean; eyeLevel: boolean };

  // 4. Visual Edit
  activeTool: 'pan' | 'select' | 'material' | 'lighting' | 'object' | 'sky' | 'remove' | 'adjust' | 'extend';
  visualPrompt: string; // The specific prompt for the active operation
  visualSelection: { mode: 'rect' | 'brush' | 'polygon' | 'ai'; brushSize: number; hardness: number; flow: number };
  visualMaterial: { surfaceType: string; category: string; materialId: string; scale: number; rotation: number; roughness: number };
  visualLighting: { mode: 'global' | 'local'; time: number; weather: string; intensity: number; warmth: number };
  visualSky: { category: string; preset: string; horizonLine: number; atmosphere: number };
  visualObject: { category: string; scale: number; autoPerspective: boolean; shadow: boolean };
  visualRemove: { mode: 'fill' | 'clone'; autoDetect: string[] };
  visualAdjust: { exposure: number; contrast: number; saturation: number; temp: number; styleStrength: number };
  visualExtend: { top: number; right: number; bottom: number; left: number };
  editLayers: { id: string; name: string; type: string; visible: boolean; locked: boolean }[];

  // 5. Exploded
  explodedComponents: { id: string; name: string; order: number; active: boolean }[];
  explodedView: { type: 'axon' | 'perspective'; separation: number };
  explodedStyle: { render: 'photo' | 'diagram' | 'tech'; color: 'material' | 'system'; labels: boolean; leaders: boolean };
  explodedAnim: { generate: boolean; type: 'assembly' | 'explosion'; duration: number };

  // 6. Section
  sectionCut: { type: 'vertical' | 'horizontal' | 'diagonal'; plane: number; depth: number; direction: 'fwd' | 'bwd' };
  sectionStyle: { poche: 'black' | 'gray'; hatch: 'solid' | 'diag' | 'cross'; weight: 'heavy' | 'medium' | 'light'; showBeyond: number };

  // 7. Sketch
  sketchType: 'interior';
  sketchConfidence: number;
  sketchCleanup: { clean: boolean; lines: boolean };
  sketchInterpretation: number; // 0-100 faithful-creative
  sketchRefs: { id: string; url: string }[];
  sketchRefInfluence: number;

  // 8. Upscale
  upscaleFactor: '2x' | '4x' | '8x';
  upscaleMode: 'general' | 'arch' | 'photo';
  upscaleCreativity: number;
  upscaleBatch: { id: string; name: string; status: 'queued' | 'done' | 'processing' }[];

  // 9. Image to CAD
  imgToCadType: 'photo' | 'render';
  imgToCadOutput: 'elevation' | 'plan' | 'detail';
  imgToCadLine: { sensitivity: number; simplify: number; connect: boolean };
  imgToCadLayers: { walls: boolean; windows: boolean; details: boolean; hidden: boolean };
  imgToCadFormat: 'dxf' | 'dwg' | 'svg' | 'pdf';

  // 10. Image to 3D
  img3dInputs: { id: string; view: string; isPrimary: boolean }[];
  img3dMesh: { type: 'organic' | 'arch'; edges: number; fill: boolean };
  img3dOutput: { format: 'obj' | 'fbx' | 'gltf'; textureRes: number };

  // 11. Video Studio
  videoState: VideoState;
}

export type VideoModel = 'veo-2' | 'kling-1.6';
export type VideoInputMode = 'image-animate' | 'camera-path' | 'image-morph' | 'multi-shot';
export type CameraMotionType = 'static' | 'pan' | 'orbit' | 'dolly' | 'crane' | 'drone' | 'rotate' | 'push-in' | 'pull-out' | 'custom';

export interface VideoState {
  inputMode: VideoInputMode;
  model: VideoModel;
  scenario: string;
  compareMode: boolean;
  
  // Generation Params
  duration: number; // seconds
  resolution: '720p' | '1080p' | '4k';
  fps: 24 | 30 | 60;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
  motionAmount: number; // 1-10
  seed: number;
  seedLocked: boolean;

  // Camera Control
  camera: {
    type: CameraMotionType;
    direction: number; // 0-360 degrees
    smoothness: number; // 0-100
    speed: 'slow' | 'normal' | 'fast';
  };

  // Timeline & Playback
  timeline: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    zoom: number;
  };

  generatedVideoUrl: string | null;
}

// --- Material Validation Types ---

export type ValidationStatus = 'pass' | 'warning' | 'error' | 'pending' | 'info';
export type MaterialCategory = 'FF' | 'WF' | 'IC' | 'WP' | 'RF' | 'L';

export interface ValidationIssue {
  id: string;
  code: string;
  type: 'technical' | 'boq' | 'drawing' | 'documentation';
  severity: ValidationStatus;
  message: string;
  details?: string;
  recommendation?: string;
  sourceDocument?: string;
  resolved: boolean;
  date?: string;
}

export interface ParsedMaterial {
  code: string;
  name: string;
  category: MaterialCategory;
  description: string;
  referenceProduct: {
    type: string;
    brand: string;
  };
  drawingRef: string;
  source: 'terminal' | 'cargo';
  dimensions?: string;
  notes: string[];
}

export interface BoQItem {
  code: string;
  section: string;
  description: string;
  materialRef: string;
  product: {
    type: string;
    brand: string;
  };
  quantity: {
    terminal?: number;
    cargo?: number;
    unit: string;
  };
}

export interface MaterialValidationState {
  activeTab: 'dashboard' | 'documents' | 'materials' | 'drawings' | 'boq' | 'issues' | 'reports';
  documents: {
    terminal: boolean;
    cargo: boolean;
    boq: boolean;
  };
  stats: {
    total: number;
    validated: number;
    warnings: number;
    errors: number;
  };
  selectedMaterialCode: string | null;
}

export interface GeometryState {
  lockGeometry: boolean;
  lockPerspective: boolean;
  lockCameraPosition: boolean;
  lockFraming: boolean;
  allowMinorRefinement: boolean;
  allowReinterpretation: boolean;
  suppressHallucinations: boolean;
  geometryPreservation: number;
  perspectiveAdherence: number;
  framingAdherence: number;
  edgeDefinition: 'sharp' | 'soft' | 'adaptive';
  edgeStrength: number;
}

export interface CameraState {
  fov: number;
  fovMode: 'narrow' | 'normal' | 'wide' | 'ultra-wide' | 'custom';
  viewType: 'eye-level' | 'aerial' | 'drone' | 'worm' | 'custom';
  cameraHeight: number;
  projection: 'perspective' | 'axonometric' | 'isometric' | 'two-point';
  verticalCorrection: boolean;
  verticalCorrectionStrength: number;
  horizonLock: boolean;
  horizonPosition: number;
  depthOfField: boolean;
  dofStrength: number;
  focalPoint: 'center' | 'subject' | 'foreground' | 'background';
}

export interface LightingState {
  timeOfDay: 'morning' | 'midday' | 'afternoon' | 'golden-hour' | 'blue-hour' | 'night' | 'overcast' | 'custom';
  customTime: number;
  sunAzimuth: number;
  sunAltitude: number;
  cloudCover: number;
  cloudType: 'clear' | 'scattered' | 'overcast' | 'dramatic' | 'stormy';
  shadowSoftness: number;
  shadowIntensity: number;
  ambientGIStrength: number;
  bounceLight: boolean;
  bounceLightIntensity: number;
  fog: boolean;
  fogDensity: number;
  fogDistance: number;
  haze: boolean;
  hazeIntensity: number;
  weather: 'clear' | 'cloudy' | 'rain' | 'snow';
  rainIntensity: 'light' | 'moderate' | 'heavy';
  snowIntensity: 'light' | 'moderate' | 'heavy';
  enforcePhysicalPlausibility: boolean;
  allowDramaticLighting: boolean;
}

export interface MaterialState {
  textureSharpness: number;
  agingLevel: number;
  concreteEmphasis: number;
  glassEmphasis: number;
  woodEmphasis: number;
  metalEmphasis: number;
  stoneEmphasis: number;
  compositeEmphasis: number;
  reflectivityBias: number;
  cleanVsRaw: number;
}

export interface ContextState {
  people: boolean;
  peopleDensity: 'sparse' | 'moderate' | 'busy' | 'crowded';
  peopleScale: 'accurate' | 'smaller' | 'larger';
  peopleStyle: 'photorealistic' | 'silhouette' | 'minimal' | 'artistic';
  peoplePlacement: 'auto' | 'foreground' | 'midground' | 'background';
  
  vegetation: boolean;
  vegetationDensity: number;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  vegetationHealth: 'lush' | 'natural' | 'sparse';
  
  vehicles: boolean;
  vehicleDensity: 'few' | 'moderate' | 'traffic';
  
  urbanFurniture: boolean;
  urbanFurnitureStyle: 'minimal' | 'contemporary' | 'classic' | 'industrial';
  
  scaleCheck: boolean;
  noIrrelevantProps: boolean;
  architectureDominant: boolean;
  contextSubtlety: number;
}

export interface OutputState {
  resolution: '2k' | '4k' | '8k' | 'custom';
  customResolution: { width: number; height: number };
  aspectRatio: '1:1' | '16:9' | '4:5' | '9:16' | 'custom';
  customAspectRatio: { width: number; height: number };
  format: 'png' | 'jpg';
  jpgQuality: number;
  embedMetadata: boolean;
  seed: number;
  seedLocked: boolean;
}

export interface CanvasState {
  zoom: number;
  pan: { x: number; y: number };
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  thumbnail: string; // Base64
  prompt: string;
  mode: GenerationMode;
  settings?: any;
}

export interface AppState {
  mode: GenerationMode;
  activeStyleId: string;
  uploadedImage: string | null;
  isGenerating: boolean;
  progress: number;
  prompt: string;
  
  workflow: WorkflowSettings;
  materialValidation: MaterialValidationState;
  
  geometry: GeometryState;
  camera: CameraState;
  lighting: LightingState;
  materials: MaterialState;
  context: ContextState;
  output: OutputState;
  canvas: CanvasState;
  
  history: HistoryItem[];

  leftSidebarWidth: number;
  rightPanelWidth: number;
  
  // NEW STATE
  leftSidebarOpen: boolean;
  rightPanelOpen: boolean;

  bottomPanelHeight: number;
  bottomPanelCollapsed: boolean;
  activeRightTab: string;
  activeBottomTab: string;
}

export type Action = 
  | { type: 'SET_MODE'; payload: GenerationMode }
  | { type: 'SET_STYLE'; payload: string }
  | { type: 'SET_IMAGE'; payload: string | null }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'SET_PROGRESS'; payload: number }
  | { type: 'UPDATE_WORKFLOW'; payload: Partial<WorkflowSettings> }
  | { type: 'UPDATE_VIDEO_STATE'; payload: Partial<VideoState> }
  | { type: 'UPDATE_VIDEO_CAMERA'; payload: Partial<VideoState['camera']> }
  | { type: 'UPDATE_VIDEO_TIMELINE'; payload: Partial<VideoState['timeline']> }
  | { type: 'UPDATE_MATERIAL_VALIDATION'; payload: Partial<MaterialValidationState> }
  | { type: 'UPDATE_GEOMETRY'; payload: Partial<GeometryState> }
  | { type: 'UPDATE_CAMERA'; payload: Partial<CameraState> }
  | { type: 'UPDATE_LIGHTING'; payload: Partial<LightingState> }
  | { type: 'UPDATE_MATERIALS'; payload: Partial<MaterialState> }
  | { type: 'UPDATE_CONTEXT'; payload: Partial<ContextState> }
  | { type: 'UPDATE_OUTPUT'; payload: Partial<OutputState> }
  | { type: 'SET_CANVAS_ZOOM'; payload: number }
  | { type: 'SET_CANVAS_PAN'; payload: { x: number; y: number } }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_ACTIVE_BOTTOM_TAB'; payload: string }
  | { type: 'TOGGLE_BOTTOM_PANEL' }
  // NEW ACTIONS
  | { type: 'TOGGLE_LEFT_SIDEBAR' }
  | { type: 'TOGGLE_RIGHT_PANEL' }
  | { type: 'ADD_HISTORY'; payload: HistoryItem }
  | { type: 'LOAD_PROJECT'; payload: AppState }
  | { type: 'RESET_PROJECT' };
