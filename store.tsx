import React, { createContext, useContext, useReducer, useEffect, PropsWithChildren } from 'react';
import { AppState, Action, GeometryState, CameraState, LightingState, MaterialState, ContextState, OutputState, WorkflowSettings } from './types';
import { generatePrompt } from './engine/promptEngine';

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
  canvasSync: true,
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

  // 11. Video
  videoMode: 'path',
  videoMotion: { type: 'cinematic', preset: 'Orbit' },
  videoPath: { type: 'flyaround', smoothness: 60 },
  videoMorph: { transitionTime: 2.0 },
  videoAssembly: { type: 'assembly', timing: 'seq' },
  videoOutput: { res: '1080p', fps: 30, quality: 80 },
};

const initialGeometry: GeometryState = {
  lockGeometry: true,
  lockPerspective: true,
  lockCameraPosition: false,
  lockFraming: true,
  geometryPreservation: 80,
  perspectiveAdherence: 80,
  framingAdherence: 80,
  edgeDefinition: 'sharp',
  suppressHallucinations: true,
};

const initialCamera: CameraState = {
  fovMode: 'normal',
  viewType: 'eye-level',
  projection: 'perspective',
  depthOfField: false,
  dofStrength: 30,
  horizonLock: true,
  verticalCorrection: true,
};

const initialLighting: LightingState = {
  timeOfDay: 'morning',
  sunAzimuth: 135,
  sunAltitude: 45,
  shadowSoftness: 20,
  shadowIntensity: 60,
  fog: false,
  weather: 'clear',
};

const initialMaterials: MaterialState = {
  textureSharpness: 50,
  agingLevel: 10,
  concreteEmphasis: 50,
  glassEmphasis: 50,
  woodEmphasis: 50,
  metalEmphasis: 50,
  reflectivityBias: 0,
};

const initialContext: ContextState = {
  people: false,
  peopleDensity: 'sparse',
  vegetation: true,
  season: 'summer',
  vehicles: false,
  urbanFurniture: false,
  scaleCheck: true,
};

const initialOutput: OutputState = {
  resolution: '4k',
  aspectRatio: '16:9',
  format: 'png',
  seed: 123456,
  seedLocked: false,
};

const initialState: AppState = {
  mode: 'render-3d',
  activeStyleId: 'contemporary-minimalist',
  uploadedImage: null,
  isGenerating: false,
  progress: 0,
  prompt: '',
  workflow: initialWorkflow,
  geometry: initialGeometry,
  camera: initialCamera,
  lighting: initialLighting,
  materials: initialMaterials,
  context: initialContext,
  output: initialOutput,
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
    case 'UPDATE_GEOMETRY': return { ...state, geometry: { ...state.geometry, ...action.payload } };
    case 'UPDATE_CAMERA': return { ...state, camera: { ...state.camera, ...action.payload } };
    case 'UPDATE_LIGHTING': return { ...state, lighting: { ...state.lighting, ...action.payload } };
    case 'UPDATE_MATERIALS': return { ...state, materials: { ...state.materials, ...action.payload } };
    case 'UPDATE_CONTEXT': return { ...state, context: { ...state.context, ...action.payload } };
    case 'UPDATE_OUTPUT': return { ...state, output: { ...state.output, ...action.payload } };
    case 'SET_ACTIVE_TAB': return { ...state, activeRightTab: action.payload };
    case 'SET_ACTIVE_BOTTOM_TAB': return { ...state, activeBottomTab: action.payload };
    case 'TOGGLE_BOTTOM_PANEL': return { ...state, bottomPanelCollapsed: !state.bottomPanelCollapsed };
    case 'ADD_HISTORY': return { ...state, history: [action.payload, ...state.history].slice(0, 20) }; // Keep max 20 items
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