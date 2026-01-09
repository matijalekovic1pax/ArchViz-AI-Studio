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
  | 'video';

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
  canvasSync: boolean;
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
  activeTool: 'pan' | 'select' | 'material' | 'lighting' | 'object' | 'sky' | 'remove' | 'adjust';
  visualSelection: { mode: 'rect' | 'lasso' | 'ai'; feather: number };
  visualMaterial: { current: string; replacement: string; intensity: number; preserveLight: boolean };
  visualLighting: { mode: 'global' | 'local'; time: number; brightness: number; shadows: number };
  visualSky: { auto: boolean; preset: string; blend: number };
  visualObject: { category: string; scale: number; matchLight: boolean };
  visualAdjust: { exposure: number; contrast: number; saturation: number; temp: number };
  editLayers: { id: string; name: string; visible: boolean; locked: boolean }[];

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

  // 11. Video
  videoMode: 'animate' | 'path' | 'morph' | 'assembly';
  videoMotion: { type: 'cinematic' | 'ken-burns' | 'parallax'; preset: string };
  videoPath: { type: 'flyaround' | 'walkthrough'; smoothness: number };
  videoMorph: { transitionTime: number };
  videoAssembly: { type: 'assembly' | 'construction'; timing: 'seq' | 'group' };
  videoOutput: { res: '1080p' | '4k'; fps: 24 | 30 | 60; quality: number };
}

export interface GeometryState {
  lockGeometry: boolean;
  lockPerspective: boolean;
  lockCameraPosition: boolean;
  lockFraming: boolean;
  geometryPreservation: number;
  perspectiveAdherence: number;
  framingAdherence: number;
  edgeDefinition: 'sharp' | 'soft' | 'adaptive';
  suppressHallucinations: boolean;
}

export interface CameraState {
  fovMode: 'narrow' | 'normal' | 'wide' | 'ultra-wide' | 'custom';
  viewType: 'eye-level' | 'aerial' | 'drone' | 'worm';
  projection: 'perspective' | 'axonometric' | 'isometric' | 'two-point';
  depthOfField: boolean;
  dofStrength: number;
  horizonLock: boolean;
  verticalCorrection: boolean;
}

export interface LightingState {
  timeOfDay: 'morning' | 'midday' | 'afternoon' | 'golden-hour' | 'blue-hour' | 'night' | 'overcast';
  sunAzimuth: number;
  sunAltitude: number;
  shadowSoftness: number;
  shadowIntensity: number;
  fog: boolean;
  weather: 'clear' | 'cloudy' | 'rain' | 'snow';
}

export interface MaterialState {
  textureSharpness: number;
  agingLevel: number;
  concreteEmphasis: number;
  glassEmphasis: number;
  woodEmphasis: number;
  metalEmphasis: number;
  reflectivityBias: number;
}

export interface ContextState {
  people: boolean;
  peopleDensity: 'sparse' | 'moderate' | 'busy';
  vegetation: boolean;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  vehicles: boolean;
  urbanFurniture: boolean;
  scaleCheck: boolean;
}

export interface OutputState {
  resolution: '2k' | '4k' | '8k';
  aspectRatio: '1:1' | '16:9' | '4:5' | '9:16';
  format: 'png' | 'jpg';
  seed: number;
  seedLocked: boolean;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  thumbnail: string; // Base64
  prompt: string;
  mode: GenerationMode;
}

export interface AppState {
  mode: GenerationMode;
  activeStyleId: string;
  uploadedImage: string | null;
  isGenerating: boolean;
  progress: number;
  prompt: string;
  
  workflow: WorkflowSettings;
  
  geometry: GeometryState;
  camera: CameraState;
  lighting: LightingState;
  materials: MaterialState;
  context: ContextState;
  output: OutputState;
  
  history: HistoryItem[];

  leftSidebarWidth: number;
  rightPanelWidth: number;
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
  | { type: 'UPDATE_GEOMETRY'; payload: Partial<GeometryState> }
  | { type: 'UPDATE_CAMERA'; payload: Partial<CameraState> }
  | { type: 'UPDATE_LIGHTING'; payload: Partial<LightingState> }
  | { type: 'UPDATE_MATERIALS'; payload: Partial<MaterialState> }
  | { type: 'UPDATE_CONTEXT'; payload: Partial<ContextState> }
  | { type: 'UPDATE_OUTPUT'; payload: Partial<OutputState> }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_ACTIVE_BOTTOM_TAB'; payload: string }
  | { type: 'TOGGLE_BOTTOM_PANEL' }
  | { type: 'ADD_HISTORY'; payload: HistoryItem }
  | { type: 'LOAD_PROJECT'; payload: AppState }
  | { type: 'RESET_PROJECT' };