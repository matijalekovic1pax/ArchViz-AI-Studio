
import React, { createContext, useContext, useReducer, useEffect, useRef, PropsWithChildren } from 'react';
import { AppState, Action, GeometryState, CameraState, LightingState, MaterialState, ContextState, OutputState, WorkflowSettings, CanvasState, VideoState, MaterialValidationState, Render3DSettings, DocumentTranslateState, PdfCompressionState, HeadshotSettings, RenderGenerationMode, RENDER_GENERATION_MODES, DEFAULT_RENDER_GENERATION_MODE, Render3DSourceMode, RENDER3D_SOURCE_MODES, DEFAULT_RENDER3D_SOURCE_MODE, ImageGenerationModel, IMAGE_GENERATION_MODELS, DEFAULT_IMAGE_GENERATION_MODEL, AI_SLOP_UPSCALE_IMAGE_MODEL, VISUAL_EDIT_IMAGE_MODEL } from './types';
import { generatePrompt } from './engine/promptEngine';

type ArchwizTestAssetSummary = {
  present: boolean;
  mimeType: string | null;
  bytesApprox: number | null;
  chars: number;
  preview: string;
};

type ArchwizTestHooks = {
  version: 1;
  getState: () => AppState;
  getSnapshot: () => unknown;
  getPrompt: () => string;
  dispatchAction: (action: Action) => void;
  setMode: (mode: AppState['mode']) => void;
  setPrompt: (prompt: string) => void;
  setImageDataUrl: (dataUrl: string | null, options?: { setAsSource?: boolean }) => void;
  applyWorkflowPatch: (patch: Partial<WorkflowSettings>) => void;
  applyStatePatch: (patch: {
    workflow?: Partial<WorkflowSettings>;
    output?: Partial<OutputState>;
    geometry?: Partial<GeometryState>;
    camera?: Partial<CameraState>;
    lighting?: Partial<LightingState>;
    materials?: Partial<MaterialState>;
    context?: Partial<ContextState>;
    prompt?: string;
  }) => void;
  resetProject: () => void;
};

type ArchwizTestCommandDetail = {
  id?: string;
  command?: 'snapshot' | 'reset';
};

declare global {
  interface Window {
    __ARCHWIZ_TEST_HOOKS__?: ArchwizTestHooks;
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const deepMerge = <T,>(base: T, patch: unknown): T => {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch as T;
  }

  const next: Record<string, unknown> = { ...base };
  Object.entries(patch).forEach(([key, value]) => {
    const previous = next[key];
    next[key] = isPlainObject(previous) && isPlainObject(value)
      ? deepMerge(previous, value)
      : value;
  });
  return next as T;
};

const summarizeDataUrl = (value: string | null): ArchwizTestAssetSummary | null => {
  if (!value) return null;
  const match = value.match(/^data:([^;]+);base64,(.*)$/);
  const base64 = match?.[2] || '';
  const bytesApprox = base64 ? Math.round((base64.length * 3) / 4) : null;
  return {
    present: true,
    mimeType: match?.[1] || null,
    bytesApprox,
    chars: value.length,
    preview: value.slice(0, 96),
  };
};

const sanitizeForTestSnapshot = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string') {
    if (value.startsWith('data:')) {
      return summarizeDataUrl(value);
    }
    return value;
  }

  if (value == null || typeof value !== 'object') {
    return value;
  }

  if (depth > 6) {
    return '[MaxDepth]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForTestSnapshot(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sanitizeForTestSnapshot(item, depth + 1),
    ])
  );
};

const createTestSnapshot = (state: AppState) => ({
  mode: state.mode,
  imageGenerationModel: state.imageGenerationModel,
  activeStyleId: state.activeStyleId,
  prompt: state.prompt,
  isGenerating: state.isGenerating,
  progress: state.progress,
  generationStage: state.generationStage,
  generationRetryNotice: state.generationRetryNotice,
  uploadedImage: summarizeDataUrl(state.uploadedImage),
  sourceImage: summarizeDataUrl(state.sourceImage),
  canvas: state.canvas,
  output: state.output,
  appAlert: state.appAlert,
  activeRightTab: state.activeRightTab,
  activeBottomTab: state.activeBottomTab,
  workflow: sanitizeForTestSnapshot(state.workflow),
  materialValidation: sanitizeForTestSnapshot(state.materialValidation),
  history: state.history.map((item) => ({
    ...item,
    thumbnail: summarizeDataUrl(item.thumbnail),
    attachments: item.attachments?.map((attachment) => summarizeDataUrl(attachment)),
  })),
});

const isArchwizTestBridgeEnabled = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has('archwizTest')) return true;
  try {
    return window.localStorage.getItem('archwiz:test') === '1';
  } catch {
    return false;
  }
};

const normalizeRenderMode = (mode: unknown): RenderGenerationMode => {
  return RENDER_GENERATION_MODES.includes(mode as RenderGenerationMode)
    ? mode as RenderGenerationMode
    : DEFAULT_RENDER_GENERATION_MODE;
};

const normalizeRender3DSourceMode = (mode: unknown): Render3DSourceMode => {
  return RENDER3D_SOURCE_MODES.includes(mode as Render3DSourceMode)
    ? mode as Render3DSourceMode
    : DEFAULT_RENDER3D_SOURCE_MODE;
};

const normalizeImageGenerationModel = (model: unknown): ImageGenerationModel => {
  return IMAGE_GENERATION_MODELS.includes(model as ImageGenerationModel)
    ? model as ImageGenerationModel
    : DEFAULT_IMAGE_GENERATION_MODEL;
};

const normalizeWorkflow = (workflow: WorkflowSettings): WorkflowSettings => ({
  ...workflow,
  render3dSourceMode: normalizeRender3DSourceMode(workflow.render3dSourceMode),
  renderMode: normalizeRenderMode(workflow.renderMode),
  upscaleMode: workflow.upscaleMode === 'ai-slop' ? 'ai-slop' : 'resolution',
});

const updateWorkflow = (
  workflow: WorkflowSettings,
  payload: Partial<WorkflowSettings>
): WorkflowSettings => normalizeWorkflow({ ...workflow, ...payload });

const shouldLockAiSlopModel = (mode: AppState['mode'], workflow: WorkflowSettings) =>
  mode === 'upscale' && workflow.upscaleMode === 'ai-slop';

const getLockedImageGenerationModel = (mode: AppState['mode'], workflow: WorkflowSettings): ImageGenerationModel | null => {
  if (mode === 'visual-edit') return VISUAL_EDIT_IMAGE_MODEL;
  if (shouldLockAiSlopModel(mode, workflow)) return AI_SLOP_UPSCALE_IMAGE_MODEL;
  return null;
};

const initialVideoState: VideoState = {
  inputMode: 'image-animate',
  model: 'veo-3.1-generate-preview',
  scenario: '',
  compareMode: false,
  accessUnlocked: true,

  duration: 8,
  resolution: '1080p',
  fps: 30,
  aspectRatio: '16:9',
  motionAmount: 5,
  seed: Math.floor(Math.random() * 2147483647),
  seedLocked: false,
  generateAudio: false,
  personGeneration: 'allow_adult',
  negativePrompt: '',
  videoInputImage: null,
  startFrame: null,
  endFrame: null,

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

  keyframes: [],
  generatedVideoUrl: null,

  // NEW: Social Media & Motion Presets
  socialMediaPreset: null,
  motionStyle: 'smooth',

  // NEW: API & Quality Settings
  klingProvider: 'piapi',
  quality: 'standard',
  transitionEffect: 'fade',

  // NEW: Generation Progress & History
  generationProgress: null,
  generationHistory: [],
};

const initialRender3D: Render3DSettings = {
  lighting: {
    sun: { enabled: true, azimuth: 135, elevation: 45, intensity: 80, colorTemp: 5500 },
    shadows: { enabled: true, intensity: 75, color: '#1a237e' },
    ambient: { intensity: 40, occlusion: 50 },
    preset: 'golden-hour',
  },
  atmosphere: {
    mood: 'natural',
    fog: { enabled: false, density: 20 },
    bloom: { enabled: false, intensity: 30 },
  },
  scenery: {
    people: { enabled: false, count: 20 },
    trees: { enabled: false, count: 50 },
    cars: { enabled: false, count: 10 },
    preset: 'departure-hall',
  },
  render: {
    resolution: '1080p',
    aspectRatio: '16:9',
    viewType: 'passenger-pov',
  },
};

const initialDocumentTranslate: DocumentTranslateState = {
  sourceDocument: null,
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  translateHeaders: true,
  translateFootnotes: true,
  progress: {
    phase: 'idle',
    currentSegment: 0,
    totalSegments: 0,
    currentBatch: 0,
    totalBatches: 0,
  },
  translatedDocumentUrl: null,
  warnings: null,
  xlsxStats: null,
  error: null,
};

const initialPdfCompression: PdfCompressionState = {
  queue: [],
  selectedId: null,
  outputs: [],
  remainingFiles: undefined,
  remainingCredits: undefined
};

const initialHeadshot: HeadshotSettings = {
  leftImage: null,
  frontImage: null,
  rightImage: null,
  style: 'professional',
  tone: 'smart-casual',
  purpose: 'linkedin',
  colorMode: 'color',
  role: '',
  facing: 'right',
  background: 'studio-grey',
  quality: 'standard',
  generatedItems: [],
};

const initialWorkflow: WorkflowSettings = {
  // 0. Text to Image
  textPrompt: '',

  // 1. 3D to Render
  sourceType: 'rhino',
  viewType: 'exterior',
  render3dSourceMode: DEFAULT_RENDER3D_SOURCE_MODE,
  renderMode: DEFAULT_RENDER_GENERATION_MODE,
  canvasSync: false,
  compareMode: false,
  render3d: initialRender3D,
  sceneInsertionReferences: [],
  sceneComposeActivePlacementId: null,

  // Background/Environment Reference
  styleReferenceImage: null,
  styleReferenceEnabled: false,
  backgroundReferenceImage: null,
  backgroundReferenceEnabled: false,

  // 2. CAD to Render
  cadDrawingType: 'plan',
  cadScale: '1:100',
  cadOrientation: 0,
  cadCamera: {
    height: 1.6,
    angle: 'horizontal',
    focalLength: 35,
    position: { x: 50, y: 50 },
    lookAt: 'n',
    verticalCorrection: true,
  },
  cadSpace: {
    roomType: 'Airport Departure Hall',
    ceilingStyle: 'flat',
    windowStyle: 'slim',
    doorStyle: 'panel',
  },
  cadContext: {
    landscape: 'garden',
    environment: 'urban',
    season: 'summer',
  },
  cadSpatial: { ceilingHeight: 2.8, floorThick: 0.3, wallThick: 0.2, style: 50 },
  cadMaterialAssignments: { 'walls': 'White Plaster', 'floor': 'Oak Hardwood' },
  cadFurnishing: {
    auto: true,
    styles: ['Modern'],
    density: 60,
    occupancy: 'staged',
    clutter: 35,
    people: false,
    entourage: 10,
  },

  // 3. Masterplan
  mpInputSource: 'upload',
  mpInputImage: null,
  mpPlanType: 'urban',
  mpScale: '1:1000',
  mpCustomScale: 1000,
  mpNorthRotation: 0,
  mpZoneDetection: 'manual',
  mpZones: [],
  mpBoundary: { mode: 'auto', points: [] },
  mpBoundaryUndoStack: [],
  mpBoundaryRedoStack: [],
  mpContext: {
    location: '',
    coordinates: null,
    radius: 300,
    loadBuildings: true,
    loadRoads: true,
    loadWater: false,
    loadTerrain: false,
    loadTransit: false,
    loadedData: null,
  },
  mpOutputStyle: 'diagrammatic',
  mpViewAngle: 'top',
  mpViewCustom: { elevation: 30, rotation: 45, perspective: 15 },
  mpBuildings: {
    style: 'Contemporary Mixed',
    heightMode: 'vary',
    defaultHeight: 24,
    heightRange: { min: 6, max: 45 },
    floorHeight: 3.5,
    roofStyle: 'flat',
    showShadows: true,
    transparent: false,
    facadeVariation: true,
    showFloorLabels: false,
  },
  mpLandscape: {
    season: 'summer',
    vegetationDensity: 70,
    treeVariation: 30,
    trees: true,
    grass: true,
    water: true,
    pathways: true,
    streetFurniture: false,
    vehicles: false,
    people: false,
    vegetationStyle: 'realistic',
  },
  mpAnnotations: {
    zoneLabels: true,
    streetNames: true,
    buildingLabels: false,
    lotNumbers: false,
    scaleBar: true,
    northArrow: true,
    dimensions: false,
    areaCalc: false,
    contourLabels: false,
    labelStyle: 'modern',
    labelSize: 'medium',
    labelColor: 'auto',
    labelHalo: true,
  },
  mpLegend: {
    include: true,
    position: 'bottom',
    showZones: true,
    showZoneAreas: true,
    showBuildings: false,
    showLandscape: false,
    showInfrastructure: false,
    style: 'compact',
  },
  mpExport: {
    resolution: '4k',
    customResolution: { width: 3840, height: 2160 },
    format: 'png',
    exportLayers: true,
    cadCompatible: false,
    includeSketch: false,
    layerExport: {
      base: true,
      zones: true,
      buildings: true,
      landscape: true,
      annotations: true,
      legend: true,
    },
  },

  // 4. Visual Edit
  activeTool: 'select',
  visualPrompt: '',
  visualReferenceImage: null,
  visualSelection: {
    mode: 'rect',
    brushSize: 20,
    featherEnabled: false,
    featherAmount: 10,
    strength: 60,
    autoTargets: [],
  },
  visualSelections: [],
  visualSelectionUndoStack: [],
  visualSelectionRedoStack: [],
  visualSelectionMask: null,
  visualSelectionMaskSize: null,
  visualSelectionViewScale: null,
  visualSelectionComposite: null,
  visualSelectionCompositeSize: null,
  visualAutoSelecting: false,
  visualMaterial: {
    category: 'Flooring',
    materialId: 'floor-oak',
    referenceEnabled: false,
    referenceImage: null,
    roughness: 60,
    colorTint: '#ffffff',
  },
  visualLighting: {
    mode: 'sun',
    sun: { azimuth: 140, elevation: 45, intensity: 120, colorTemp: 5600, shadowSoftness: 40 },
    hdri: { preset: 'Studio', rotation: 0, intensity: 120 },
    artificial: { type: 'point', position: { x: 50, y: 50 }, intensity: 80, color: '#ffffff', falloff: 40 },
    ambient: 35,
    preserveShadows: true,
  },
  visualSky: {
    preset: 'Clear Blue',
    horizonLine: 50,
    cloudDensity: 40,
    atmosphere: 40,
    brightness: 110,
    reflectInGlass: true,
    matchLighting: true,
    sunFlare: false,
  },
  visualObject: {
    category: 'Furniture',
    subcategory: 'All',
    assetId: '',
    selectionIds: [],
    placementMode: 'place',
    scale: 100,
    rotation: 0,
    autoPerspective: true,
    shadow: true,
    groundContact: true,
    position: { x: 0, y: 0 },
    depth: 'midground',
  },
  visualRemove: {
    brushSize: 120,
    hardness: 70,
    quickRemove: [],
    autoDetectEdges: true,
    preserveStructure: true,
  },
  visualReplace: {
    mode: 'similar',
    variation: 40,
    category: 'Furniture',
    style: 'Modern',
    prompt: '',
    matchScale: true,
    matchLighting: true,
    preserveShadows: true,
  },
  visualAdjust: {
    aspectRatio: 'same',
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    gamma: 0,
    saturation: 0,
    vibrance: 0,
    temperature: 0,
    tint: 0,
    hueShift: 0,
    texture: 0,
    dehaze: 0,
    sharpness: 0,
    sharpnessRadius: 1,
    sharpnessDetail: 0,
    sharpnessMasking: 0,
    noiseReduction: 0,
    noiseReductionColor: 0,
    noiseReductionDetail: 0,
    hslChannel: 'Reds',
    hslRedsHue: 0,
    hslRedsSaturation: 0,
    hslRedsLuminance: 0,
    hslOrangesHue: 0,
    hslOrangesSaturation: 0,
    hslOrangesLuminance: 0,
    hslYellowsHue: 0,
    hslYellowsSaturation: 0,
    hslYellowsLuminance: 0,
    hslGreensHue: 0,
    hslGreensSaturation: 0,
    hslGreensLuminance: 0,
    hslAquasHue: 0,
    hslAquasSaturation: 0,
    hslAquasLuminance: 0,
    hslBluesHue: 0,
    hslBluesSaturation: 0,
    hslBluesLuminance: 0,
    hslPurplesHue: 0,
    hslPurplesSaturation: 0,
    hslPurplesLuminance: 0,
    hslMagentasHue: 0,
    hslMagentasSaturation: 0,
    hslMagentasLuminance: 0,
    colorGradeShadowsHue: 0,
    colorGradeShadowsSaturation: 0,
    colorGradeMidtonesHue: 0,
    colorGradeMidtonesSaturation: 0,
    colorGradeHighlightsHue: 0,
    colorGradeHighlightsSaturation: 0,
    colorGradeBalance: 0,
    clarity: 0,
    vignette: 0,
    vignetteMidpoint: 0,
    vignetteRoundness: 0,
    vignetteFeather: 0,
    grain: 0,
    grainSize: 0,
    grainRoughness: 0,
    bloom: 0,
    chromaticAberration: 0,
    transformRotate: 0,
    transformHorizontal: 0,
    transformVertical: 0,
    transformDistortion: 0,
    transformPerspective: 0,
    styleStrength: 0,
  },
  visualPeople: {
    mode: 'enhance',

    airportZone: 'terminal-general',

    regionMix: ['european', 'east-asian', 'south-asian', 'middle-eastern', 'african', 'latin-american'],
    ageDistribution: 'mixed-all-ages',
    genderBalance: 'balanced',
    childrenPresence: 30,
    bodyTypeVariety: 60,

    density: 50,
    grouping: 'mixed-groups',
    flowPattern: 'random',
    movementDirection: 'mixed',
    paceOfMovement: 'moderate',
    clusteringTendency: 40,

    wardrobeStyle: 'mixed',
    seasonalClothing: 'mixed',
    formalityLevel: 50,
    culturalAttire: 20,

    activities: ['walking', 'standing', 'sitting', 'phone-use'],
    interactionLevel: 40,

    luggageTypes: ['rolling-suitcase', 'backpack', 'carry-on'],
    luggageAmount: 50,
    trolleyUsage: 20,
    personalDevices: 50,
    travelAccessories: 30,

    includeAirportStaff: true,
    includeSecurityPersonnel: false,
    includeAirlineCrew: false,
    includeGroundCrew: false,
    includeServiceStaff: false,
    staffDensity: 15,

    realism: 70,
    sharpness: 60,
    scaleAccuracy: 70,
    placementDiscipline: 70,
    motionBlur: 10,

    preserveExisting: true,
    matchLighting: true,
    matchPerspective: true,
    groundContact: true,
    removeArtifacts: true,
  },
  visualExtend: {
    direction: 'none',
    amount: 50,
    targetAspectRatio: '16:9',
    customRatio: { width: 16, height: 9 },
  },
  visualBackground: {
    mode: 'image',
    prompt: '',
    referenceImage: null,
    referenceMode: 'reference',
    matchPerspective: true,
    matchLighting: true,
    seamlessBlend: true,
    preserveDepth: true,
    quality: 'standard',
  },

  // 5. Exploded
  explodedSource: {
    type: 'revit',
    fileName: null,
    componentCount: 0,
  },
  explodedComponents: [],
  explodedDetection: 'auto',
  explodedDirection: 'vertical',
  explodedAxis: { x: 45, y: 30, z: 60 },
  explodedView: {
    type: 'axon',
    angle: 'iso-ne',
    cameraHeight: 1.6,
    fov: 50,
    lookAt: 'center',
    separation: 50,
  },
  explodedStyle: {
    render: 'stacked',
    colorMode: 'material',
    systemColors: {
      structure: '#4A90D9',
      envelope: '#7ED321',
      mep: '#F5A623',
      interior: '#9B9B9B',
    },
    edgeStyle: 'hidden-removed',
    lineWeight: 2,
  },
  explodedAnnotations: {
    labels: true,
    leaders: true,
    leaderStyle: 'straight',
    dimensions: false,
    assemblyNumbers: false,
    materialCallouts: false,
    labelStyle: 'minimal',
    fontSize: 'medium',
  },
  explodedAnim: {
    generate: true,
    type: 'explosion',
    duration: 3.0,
    easing: 'ease-in-out',
    stagger: 20,
    holdStart: 0.5,
    holdEnd: 1.0,
  },
  explodedOutput: {
    resolution: '4k',
    background: 'white',
    groundPlane: true,
    shadow: false,
    grid: false,
    exportLayers: false,
  },

  // 6. Section
  sectionCut: { type: 'horizontal', plane: 50, depth: 50, direction: 'fwd' },
  sectionStyle: { poche: '#1b1b1b', hatch: 'solid', weight: 'medium', showBeyond: 50 },
  sectionAreas: [],
  sectionAreaDetection: 'auto',
  sectionReveal: {
    style: 'front-peel',
    focus: 'mixed',
    facadeOpacity: 40,
    depthFade: 35,
  },
  sectionProgram: {
    colorMode: 'program',
    programColors: {
      residential: '#7ED321',
      parking: '#4A90D9',
      circulation: '#9B9B9B',
      services: '#F5A623',
    },
    labels: true,
    leaderLines: true,
    areaTags: false,
    labelStyle: 'minimal',
    fontSize: 'medium',
  },

  // 7. Sketch
  // Sketch Analysis
  sketchType: 'exterior',
  sketchAutoDetect: true,
  sketchDetectedPerspective: null,
  sketchLineQuality: 0,
  sketchCompleteness: 0,

  // Line Processing
  sketchCleanupIntensity: 50,
  sketchEnhanceFaint: true,
  sketchConnectLines: true,
  sketchStraighten: false,
  sketchRemoveConstruction: false,
  sketchLineWeight: 'medium',
  sketchPerspectiveCorrect: false,
  sketchPerspectiveStrength: 50,
  sketchFixVerticals: true,

  // View & Perspective
  sketchPerspectiveType: '2-point',
  sketchHorizonLine: 50,
  sketchCameraHeight: 'eye',
  sketchVanishingPoints: [],

  // Interpretation
  sketchInterpretation: 50,
  sketchPreserveOutline: true,
  sketchPreserveOpenings: true,
  sketchPreserveRoof: true,
  sketchPreserveFloors: false,
  sketchPreserveProportions: true,
  sketchAllowDetails: true,
  sketchAllowMaterials: true,
  sketchAllowEntourage: false,
  sketchAllowExtend: false,
  sketchAmbiguityMode: 'typical',

  // References
  sketchRefs: [],
  sketchRefInfluence: 50,
  sketchRefType: 'style',
  sketchMaterialPalette: 'Concrete & Glass',
  sketchMoodPreset: 'soft-daylight',

  // 8. Upscale
  upscaleMode: 'resolution',
  upscaleFactor: '8x',
  upscaleSharpness: 50,
  upscaleClarity: 40,
  upscaleEdgeDefinition: 50,
  upscaleFineDetail: 50,
  upscaleFormat: 'png',
  upscalePreserveMetadata: true,
  upscaleBatch: [],

  // 9. Multi-Angle
  multiAnglePreset: 'turntable',
  multiAngleViewCount: 8,
  multiAngleDistribution: 'even',
  multiAngleAzimuthRange: [0, 360],
  multiAngleElevationRange: [10, 10],
  multiAngleLockConsistency: true,
  multiAngleAngles: [],
  multiAngleOutputs: [],

  // 10. Angle Change
  angleChangeDegrees: 0,
  angleChangePitch: 0,
  angleChangeOutputs: [],

  // 11. Image to CAD
  imgToCadType: 'render',
  imgToCadOutput: 'detail',
  imgToCadLine: { sensitivity: 50, simplify: 20, connect: true },
  imgToCadLayers: { walls: true, windows: true, details: true, hidden: false },
  imgToCadFormat: 'dxf',

  // 12. Video Studio
  videoState: initialVideoState,

  // 13. Document Translation
  documentTranslate: initialDocumentTranslate,

  // 14. PDF Compression
  pdfCompression: initialPdfCompression,

  // 15. Headshot Generator
  headshot: initialHeadshot,
};

const initialMaterialValidation: MaterialValidationState = {
  activeTab: 'materials',
  documents: [],
  checks: {
    crossReferenceBoq: true,
    technicalSpec: true,
    dimensions: true,
    productRefs: true,
    quantities: true,
  },
  materials: [],
  boqItems: [],
  issues: [],
  stats: {
    total: 0,
    validated: 0,
    warnings: 0,
    errors: 0
  },
  selectedMaterialCode: null,
  isRunning: false,
  lastRunAt: null,
  aiSummary: null,
  error: null
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
  lod: {
    level: 'medium',
    preserveOrnaments: true,
    preserveMoldings: true,
    preserveTrim: true,
  },
  smoothing: {
    enabled: false,
    intensity: 50,
    preserveHardEdges: true,
    threshold: 30,
  },
  depthLayers: {
    enabled: false,
    foreground: 100,
    midground: 70,
    background: 40,
  },
  displacement: {
    enabled: false,
    strength: 30,
    scale: 'medium',
    adaptToMaterial: true,
  },
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
  resolution: '2k',
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
  mode: 'generate-text', // CHANGED: Set to 'generate-text' for default starting tab
  imageGenerationModel: DEFAULT_IMAGE_GENERATION_MODEL,
  activeStyleId: 'no-style',
  uploadedImage: null,
  sourceImage: null,
  isGenerating: false,
  progress: 0,
  generationStage: null,
  generationRetryNotice: null,
  prompt: '',
  workflow: initialWorkflow,
  materialValidation: initialMaterialValidation,
  chatMessages: [],
  customStyles: [],
  geometry: initialGeometry,
  camera: initialCamera,
  lighting: initialLighting,
  materials: initialMaterials,
  context: initialContext,
  output: initialOutput,
  canvas: initialCanvas,
  history: [],
  appAlert: null,
  
  leftSidebarWidth: 280,
  rightPanelWidth: 320,
  leftSidebarOpen: true,
  rightPanelOpen: true,

  bottomPanelHeight: 200,
  bottomPanelCollapsed: true,
  activeRightTab: 'geometry',
  activeBottomTab: 'prompt',
};

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_MODE': {
      const nextMode = action.payload;
      return {
        ...state,
        mode: nextMode,
        activeRightTab: 'default',
        prompt: '',
        imageGenerationModel: getLockedImageGenerationModel(nextMode, state.workflow) ?? state.imageGenerationModel
      };
    }
    case 'SET_IMAGE_GENERATION_MODEL': return {
      ...state,
      imageGenerationModel: getLockedImageGenerationModel(state.mode, state.workflow) ?? normalizeImageGenerationModel(action.payload)
    };
    case 'SET_PROMPT': return { ...state, prompt: action.payload };
    case 'SET_STYLE': return {
      ...state,
      activeStyleId: action.payload,
      workflow: { ...state.workflow, styleReferenceEnabled: false }
    };
    case 'SET_IMAGE': return { ...state, uploadedImage: action.payload };
    case 'SET_SOURCE_IMAGE': return { ...state, sourceImage: action.payload };
    case 'CLEAR_CANVAS': return { ...state, uploadedImage: null, sourceImage: null };
    case 'SET_GENERATING': return { ...state, isGenerating: action.payload };
    case 'SET_PROGRESS': return { ...state, progress: action.payload };
    case 'SET_GENERATION_STAGE': return { ...state, generationStage: action.payload };
    case 'SET_GENERATION_RETRY_NOTICE': return { ...state, generationRetryNotice: action.payload };
    case 'UPDATE_WORKFLOW': {
      const workflow = updateWorkflow(state.workflow, action.payload);
      return {
        ...state,
        workflow,
        imageGenerationModel: getLockedImageGenerationModel(state.mode, workflow) ?? state.imageGenerationModel
      };
    }
    
    // Video State Reducers
    case 'UPDATE_VIDEO_STATE': return { ...state, workflow: { ...state.workflow, videoState: { ...state.workflow.videoState, ...action.payload } } };
    case 'UPDATE_VIDEO_CAMERA': return { ...state, workflow: { ...state.workflow, videoState: { ...state.workflow.videoState, camera: { ...state.workflow.videoState.camera, ...action.payload } } } };
    case 'UPDATE_VIDEO_TIMELINE': return { ...state, workflow: { ...state.workflow, videoState: { ...state.workflow.videoState, timeline: { ...state.workflow.videoState.timeline, ...action.payload } } } };

    // Material Validation Reducer
    case 'UPDATE_MATERIAL_VALIDATION': return { ...state, materialValidation: { ...state.materialValidation, ...action.payload } };

    // Document Translation Reducer
    case 'UPDATE_DOCUMENT_TRANSLATE': return { ...state, workflow: { ...state.workflow, documentTranslate: { ...state.workflow.documentTranslate, ...action.payload } } };

    // Chat Reducers
    case 'ADD_CHAT_MESSAGE': return { ...state, chatMessages: [...state.chatMessages, action.payload] };
    case 'UPDATE_CHAT_MESSAGE': 
      return { 
        ...state, 
        chatMessages: state.chatMessages.map(msg => 
          msg.id === action.payload.id ? { ...msg, ...action.payload.updates } : msg
        ) 
      };
    case 'ADD_CUSTOM_STYLE': return { ...state, customStyles: [action.payload, ...state.customStyles] };

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
    
    // Toggle Actions
    case 'TOGGLE_LEFT_SIDEBAR': return { ...state, leftSidebarOpen: !state.leftSidebarOpen };
    case 'TOGGLE_RIGHT_PANEL': return { ...state, rightPanelOpen: !state.rightPanelOpen };

    case 'ADD_HISTORY': return { ...state, history: [...state.history, action.payload] };
    case 'SET_APP_ALERT': return { ...state, appAlert: action.payload };
    case 'LOAD_PROJECT': {
      const workflow = normalizeWorkflow(action.payload.workflow);
      return {
        ...action.payload,
        imageGenerationModel: getLockedImageGenerationModel(action.payload.mode, workflow) ?? normalizeImageGenerationModel(action.payload?.imageGenerationModel),
        workflow,
        sourceImage: action.payload?.sourceImage ?? action.payload?.uploadedImage ?? null,
        appAlert: action.payload?.appAlert ?? null
      };
    }
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
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!isArchwizTestBridgeEnabled()) return;

    const writeBridgeResult = (id: string, payload: unknown) => {
      document.documentElement.setAttribute(
        'data-archwiz-test-result',
        JSON.stringify({ id, payload })
      );
    };

    const handleBridgeCommand = (event: Event) => {
      const detail = (event as CustomEvent<ArchwizTestCommandDetail>).detail || {};
      const id = detail.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (detail.command === 'reset') {
        dispatch({ type: 'RESET_PROJECT' });
        window.setTimeout(() => writeBridgeResult(id, createTestSnapshot(stateRef.current)), 80);
        return;
      }
      writeBridgeResult(id, createTestSnapshot(stateRef.current));
    };

    const hooks: ArchwizTestHooks = {
      version: 1,
      getState: () => stateRef.current,
      getSnapshot: () => createTestSnapshot(stateRef.current),
      getPrompt: () => generatePrompt(stateRef.current),
      dispatchAction: (action) => dispatch(action),
      setMode: (mode) => dispatch({ type: 'SET_MODE', payload: mode }),
      setPrompt: (prompt) => dispatch({ type: 'SET_PROMPT', payload: prompt }),
      setImageDataUrl: (dataUrl, options = {}) => {
        dispatch({ type: 'SET_IMAGE', payload: dataUrl });
        if (options.setAsSource !== false) {
          dispatch({ type: 'SET_SOURCE_IMAGE', payload: dataUrl });
        }
      },
      applyWorkflowPatch: (patch) => {
        const workflow = deepMerge(stateRef.current.workflow, patch);
        dispatch({ type: 'UPDATE_WORKFLOW', payload: workflow });
      },
      applyStatePatch: (patch) => {
        if (patch.workflow) {
          const workflow = deepMerge(stateRef.current.workflow, patch.workflow);
          dispatch({ type: 'UPDATE_WORKFLOW', payload: workflow });
        }
        if (patch.output) dispatch({ type: 'UPDATE_OUTPUT', payload: patch.output });
        if (patch.geometry) dispatch({ type: 'UPDATE_GEOMETRY', payload: patch.geometry });
        if (patch.camera) dispatch({ type: 'UPDATE_CAMERA', payload: patch.camera });
        if (patch.lighting) dispatch({ type: 'UPDATE_LIGHTING', payload: patch.lighting });
        if (patch.materials) dispatch({ type: 'UPDATE_MATERIALS', payload: patch.materials });
        if (patch.context) dispatch({ type: 'UPDATE_CONTEXT', payload: patch.context });
        if (typeof patch.prompt === 'string') dispatch({ type: 'SET_PROMPT', payload: patch.prompt });
      },
      resetProject: () => dispatch({ type: 'RESET_PROJECT' }),
    };

    window.__ARCHWIZ_TEST_HOOKS__ = hooks;
    window.addEventListener('archwiz:test-store-command', handleBridgeCommand);
    return () => {
      window.removeEventListener('archwiz:test-store-command', handleBridgeCommand);
      if (window.__ARCHWIZ_TEST_HOOKS__ === hooks) {
        delete window.__ARCHWIZ_TEST_HOOKS__;
      }
    };
  }, [dispatch]);

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
