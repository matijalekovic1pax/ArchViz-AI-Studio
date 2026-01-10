

import React, { createContext, useContext, useReducer, useEffect, PropsWithChildren } from 'react';
import { AppState, Action, GeometryState, CameraState, LightingState, MaterialState, ContextState, OutputState, WorkflowSettings, CanvasState, VideoState, MaterialValidationState } from './types';
import { generatePrompt } from './engine/promptEngine';

const initialVideoState: VideoState = {
  inputMode: 'image-animate',
  model: 'veo-2',
  scenario: '',
  compareMode: false,
  
  duration: 10,
  resolution: '1080p',
  fps: 24,
  aspectRatio: '16:9',
  motionAmount: 5,
  seed: 123456,
  seedLocked: false,

  camera: {
    type: 'static',
    direction: 45,
    smoothness: 50,
    speed: 'normal',
  },

  timeline: {
    isPlaying: false,
    currentTime: 0,
    duration: 10,
    zoom: 100,
  },

  generatedVideoUrl: null,
};

const initialWorkflow: WorkflowSettings = {
  // 1. 3D to Render
  sourceType: 'rhino',
  viewType: 'exterior',
  detectedElements: [
    { id: '1', name: 'Walls', type: 'structural', confidence: 0.9, selected: true },
    { id: '2', name: 'Glass Curtain', type: 'envelope', confidence: 0.85, selected: true },
    { id: '3', name: 'Roof Slab', type: 'structural', confidence: 0.92, selected: true },
    { id: '4', name: 'Pavement', type: 'site', confidence: 0.7, selected: true },
  ],
  renderMode: 'enhance',
  canvasSync: false,
  compareMode: false,

  // 2. CAD to Render
  cadDrawingType: 'plan',
  cadScale: '1:100',
  cadOrientation: 0,
  cadLayers: [
    { id: '1', name: 'Walls', color: '#000000', type: 'wall', visible: true },
    { id: '2', name: 'Windows', color: '#0000FF', type: 'window', visible: true },
    { id: '3', name: 'Doors', color: '#FF0000', type: 'door', visible: true },
    { id: '4', name: 'Dims', color: '#888888', type: 'dims', visible: false },
  ],
  cadCamera: { height: 1.6, angle: 'horizontal' },
  cadSpatial: { ceilingHeight: 2.8, floorThick: 0.3, wallThick: 0.2, style: 50 },
  cadMaterialAssignments: { 'walls': 'White Plaster', 'floor': 'Oak Hardwood' },
  cadFurnishing: { auto: true, styles: ['Modern'], density: 60 },

  // 3. Masterplan
  mpPlanType: 'urban',
  mpScale: '1:500',
  mpZones: [
    { id: '1', name: 'Residential', color: '#FFE4B5', type: 'residential', selected: true },
    { id: '2', name: 'Commercial', color: '#87CEEB', type: 'commercial', selected: true },
    { id: '3', name: 'Green Space', color: '#90EE90', type: 'green', selected: true },
  ],
  mpContext: { location: '', loadBuildings: true, loadRoads: true, loadWater: true, loadTerrain: false },
  mpOutputType: 'diagrammatic',
  mpBuildingStyle: { style: 'Contemporary', heightMode: 'color', defaultHeight: 24, roofType: 'flat' },
  mpExport: { topDown: true, aerialNE: true, aerialSW: true, eyeLevel: false },

  // 4. Visual Edit
  activeTool: 'pan',
  visualSelection: { mode: 'rect', feather: 0 },
  visualMaterial: { current: 'Facade Wall', replacement: 'Brick', intensity: 80, preserveLight: true },
  visualLighting: { mode: 'local', time: 50, brightness: 0, shadows: 0 },
  visualSky: { auto: true, preset: 'Cloudy', blend: 50 },
  visualObject: { category: 'People', scale: 1, matchLight: true },
  visualAdjust: { exposure: 0, contrast: 0, saturation: 0, temp: 0 },
  editLayers: [
    { id: '1', name: 'Adjustments', visible: true, locked: false },
    { id: '2', name: 'Sky Replacement', visible: true, locked: false },
    { id: '3', name: 'Original Image', visible: true, locked: true },
  ],

  // 5. Exploded
  explodedComponents: [
    { id: '1', name: 'Roof System', order: 0, active: true },
    { id: '2', name: 'Structure', order: 1, active: true },
    { id: '3', name: 'Facade', order: 2, active: true },
    { id: '4', name: 'Floor Plates', order: 3, active: true },
  ],
  explodedView: { type: 'axon', separation: 50 },
  explodedStyle: { render: 'diagram', color: 'system', labels: true, leaders: true },
  explodedAnim: { generate: true, type: 'explosion', duration: 3.0 },

  // 6. Section
  sectionCut: { type: 'horizontal', plane: 50, depth: 50, direction: 'fwd' },
  sectionStyle: { poche: 'black', hatch: 'solid', weight: 'medium', showBeyond: 50 },

  // 7. Sketch
  sketchType: 'interior',
  sketchConfidence: 70,
  sketchCleanup: { clean: true, lines: true },
  sketchInterpretation: 40,
  sketchRefs: [],
  sketchRefInfluence: 50,

  // 8. Upscale
  upscaleFactor: '4x',
  upscaleMode: 'arch',
  upscaleCreativity: 20,
  upscaleBatch: [
    { id: '1', name: 'Render_001.png', status: 'done' },
    { id: '2', name: 'Render_002.png', status: 'processing' },
    { id: '3', name: 'Render_003.png', status: 'queued' },
  ],

  // 9. Image to CAD
  imgToCadType: 'render',
  imgToCadOutput: 'detail',
  imgToCadLine: { sensitivity: 50, simplify: 20, connect: true },
  imgToCadLayers: { walls: true, windows: true, details: true, hidden: false },
  imgToCadFormat: 'dxf',

  // 10. Image to 3D
  img3dInputs: [{ id: '1', view: 'Front', isPrimary: true }],
  img3dMesh: { type: 'arch', edges: 80, fill: true },
  img3dOutput: { format: 'obj', textureRes: 2048 },

  // 11. Video Studio
  videoState: initialVideoState,
};

const initialMaterialValidation: MaterialValidationState = {
  activeTab: 'materials',
  documents: {
    terminal: true, // Mock pre-loaded
    cargo: true,    // Mock pre-loaded
    boq: true       // Mock pre-loaded
  },
  stats: {
    total: 38,
    validated: 42,
    warnings: 8,
    errors: 3
  },
  selectedMaterialCode: null
};

const initialGeometry: GeometryState = {
  lockGeometry: true,
  lockPerspective: true,
  lockCameraPosition: false,
  lockFraming: true,
  allowMinorRefinement: false,
  allowReinterpretation: false,
  suppressHallucinations: true,
  geometryPreservation: 80,
  perspectiveAdherence: 80,
  framingAdherence: 80,
  edgeDefinition: 'sharp',
  edgeStrength: 50,
};

const initialCamera: CameraState = {
  fov: 50,
  fovMode: 'normal',
  viewType: 'eye-level',
  cameraHeight: 1.6,
  projection: 'perspective',
  verticalCorrection: true,
  verticalCorrectionStrength: 100,
  horizonLock: true,
  horizonPosition: 50,
  depthOfField: false,
  dofStrength: 30,
  focalPoint: 'center',
};

const initialLighting: LightingState = {
  timeOfDay: 'morning',
  customTime: 10,
  sunAzimuth: 135,
  sunAltitude: 45,
  cloudCover: 20,
  cloudType: 'scattered',
  shadowSoftness: 20,
  shadowIntensity: 60,
  ambientGIStrength: 50,
  bounceLight: true,
  bounceLightIntensity: 50,
  fog: false,
  fogDensity: 30,
  fogDistance: 50,
  haze: false,
  hazeIntensity: 20,
  weather: 'clear',
  rainIntensity: 'moderate',
  snowIntensity: 'moderate',
  enforcePhysicalPlausibility: true,
  allowDramaticLighting: false,
};

const initialMaterials: MaterialState = {
  textureSharpness: 50,
  agingLevel: 10,
  concreteEmphasis: 50,
  glassEmphasis: 50,
  woodEmphasis: 50,
  metalEmphasis: 50,
  stoneEmphasis: 50,
  compositeEmphasis: 50,
  reflectivityBias: 0,
  cleanVsRaw: 50,
};

const initialContext: ContextState = {
  people: false,
  peopleDensity: 'sparse',
  peopleScale: 'accurate',
  peopleStyle: 'photorealistic',
  peoplePlacement: 'auto',
  
  vegetation: true,
  vegetationDensity: 50,
  season: 'summer',
  vegetationHealth: 'lush',
  
  vehicles: false,
  vehicleDensity: 'few',
  
  urbanFurniture: false,
  urbanFurnitureStyle: 'contemporary',
  
  scaleCheck: true,
  noIrrelevantProps: true,
  architectureDominant: true,
  contextSubtlety: 80,
};

const initialOutput: OutputState = {
  resolution: '4k',
  customResolution: { width: 1920, height: 1080 },
  aspectRatio: '16:9',
  customAspectRatio: { width: 16, height: 9 },
  format: 'png',
  jpgQuality: 95,
  embedMetadata: true,
  seed: 123456,
  seedLocked: false,
};

const initialCanvas: CanvasState = {
  zoom: 1,
  pan: { x: 0, y: 0 }
};

const initialState: AppState = {
  mode: 'render-3d',
  activeStyleId: 'contemporary-minimalist',
  uploadedImage: null,
  isGenerating: false,
  progress: 0,
  prompt: '',
  workflow: initialWorkflow,
  materialValidation: initialMaterialValidation,
  geometry: initialGeometry,
  camera: initialCamera,
  lighting: initialLighting,
  materials: initialMaterials,
  context: initialContext,
  output: initialOutput,
  canvas: initialCanvas,
  history: [],
  leftSidebarWidth: 280,
  rightPanelWidth: 320,
  bottomPanelHeight: 200,
  bottomPanelCollapsed: false,
  activeRightTab: 'geometry',
  activeBottomTab: 'prompt',
};

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_MODE': return { ...state, mode: action.payload, activeRightTab: 'default' };
    case 'SET_STYLE': return { ...state, activeStyleId: action.payload };
    case 'SET_IMAGE': return { ...state, uploadedImage: action.payload };
    case 'SET_GENERATING': return { ...state, isGenerating: action.payload };
    case 'SET_PROGRESS': return { ...state, progress: action.payload };
    case 'UPDATE_WORKFLOW': return { ...state, workflow: { ...state.workflow, ...action.payload } };
    
    // Video State Reducers
    case 'UPDATE_VIDEO_STATE': return { ...state, workflow: { ...state.workflow, videoState: { ...state.workflow.videoState, ...action.payload } } };
    case 'UPDATE_VIDEO_CAMERA': return { ...state, workflow: { ...state.workflow, videoState: { ...state.workflow.videoState, camera: { ...state.workflow.videoState.camera, ...action.payload } } } };
    case 'UPDATE_VIDEO_TIMELINE': return { ...state, workflow: { ...state.workflow, videoState: { ...state.workflow.videoState, timeline: { ...state.workflow.videoState.timeline, ...action.payload } } } };

    // Material Validation Reducer
    case 'UPDATE_MATERIAL_VALIDATION': return { ...state, materialValidation: { ...state.materialValidation, ...action.payload } };

    case 'UPDATE_GEOMETRY': return { ...state, geometry: { ...state.geometry, ...action.payload } };
    case 'UPDATE_CAMERA': return { ...state, camera: { ...state.camera, ...action.payload } };
    case 'UPDATE_LIGHTING': return { ...state, lighting: { ...state.lighting, ...action.payload } };
    case 'UPDATE_MATERIALS': return { ...state, materials: { ...state.materials, ...action.payload } };
    case 'UPDATE_CONTEXT': return { ...state, context: { ...state.context, ...action.payload } };
    case 'UPDATE_OUTPUT': return { ...state, output: { ...state.output, ...action.payload } };
    case 'SET_CANVAS_ZOOM': return { ...state, canvas: { ...state.canvas, zoom: action.payload } };
    case 'SET_CANVAS_PAN': return { ...state, canvas: { ...state.canvas, pan: action.payload } };
    case 'SET_ACTIVE_TAB': return { ...state, activeRightTab: action.payload };
    case 'SET_ACTIVE_BOTTOM_TAB': return { ...state, activeBottomTab: action.payload };
    case 'TOGGLE_BOTTOM_PANEL': return { ...state, bottomPanelCollapsed: !state.bottomPanelCollapsed };
    case 'ADD_HISTORY': return { ...state, history: [action.payload, ...state.history].slice(0, 20) };
    case 'LOAD_PROJECT': return { ...action.payload };
    case 'RESET_PROJECT': return { ...initialState };
    default: return state;
  }
}

const StoreContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | undefined>(undefined);

export function AppProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    const timer = setTimeout(() => {
      generatePrompt(state);
    }, 200);
    return () => clearTimeout(timer);
  }, [
    state.activeStyleId, 
    state.geometry, 
    state.camera, 
    state.lighting, 
    state.materials, 
    state.context, 
    state.mode,
    state.workflow
  ]);

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
}
