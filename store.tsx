
import React, { createContext, useContext, useReducer, useEffect, PropsWithChildren } from 'react';
import { AppState, Action, GeometryState, CameraState, LightingState, MaterialState, ContextState, OutputState, WorkflowSettings, CanvasState, VideoState, MaterialValidationState, Render3DSettings, DocumentTranslateState, PdfCompressionState } from './types';
import { generatePrompt } from './engine/promptEngine';

const initialVideoState: VideoState = {
  inputMode: 'image-animate',
  model: 'veo-2',
  scenario: '',
  compareMode: false,
  accessUnlocked: false,

  duration: 10,
  resolution: '1080p',
  fps: 30,
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
  geometry: {
    edgeMode: 'medium',
    strictPreservation: true,
    geometryFreedom: 50,
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
  },
  lighting: {
    sun: { enabled: true, azimuth: 135, elevation: 45, intensity: 80, colorTemp: 5500, softness: 35 },
    shadows: { enabled: true, intensity: 75, softness: 40, color: '#1a237e' },
    ambient: { intensity: 40, occlusion: 50 },
    preset: 'golden-hour',
  },
  camera: {
    preset: 'eye-level',
    lens: 35,
    fov: 63,
    autoCorrect: true,
    dof: { enabled: false, aperture: 2.8, focusDist: 5 },
  },
  materials: {
    emphasis: {
      concrete: 50,
      wood: 50,
      metal: 50,
      glass: 50,
      stone: 50,
      brick: 50,
      tile: 50,
      fabric: 50,
      paint: 50,
      flooring: 50,
    },
    reflectivity: 50,
    roughness: 50,
    weathering: { enabled: false, intensity: 30 },
  },
  atmosphere: {
    mood: 'natural',
    fog: { enabled: false, density: 20 },
    bloom: { enabled: false, intensity: 30 },
    temp: 0,
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
    quality: 'production',
  },
};

const initialDocumentTranslate: DocumentTranslateState = {
  sourceDocument: null,
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  preserveFormatting: true,
  progress: {
    phase: 'idle',
    currentSegment: 0,
    totalSegments: 0,
    currentBatch: 0,
    totalBatches: 0,
  },
  translatedDocumentUrl: null,
  error: null,
};

const initialPdfCompression: PdfCompressionState = {
  queue: [],
  selectedId: null,
  outputs: [],
  remainingFiles: undefined,
  remainingCredits: undefined
};

const initialWorkflow: WorkflowSettings = {
  // 0. Text to Image
  textPrompt: '',

  // 1. 3D to Render
  sourceType: 'rhino',
  viewType: 'exterior',
  prioritizationEnabled: false,
  detectedElements: [],
  renderMode: 'enhance',
  canvasSync: false,
  compareMode: false,
  render3d: initialRender3D,

  // Background/Environment Reference
  backgroundReferenceImage: null,
  backgroundReferenceEnabled: false,

  // 2. CAD to Render
  cadDrawingType: 'plan',
  cadScale: '1:100',
  cadOrientation: 0,
  cadLayerDetectionEnabled: false,
  cadLayers: [],
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
    surfaceType: 'auto',
    category: 'Flooring',
    materialId: 'oak',
    scale: 100,
    rotation: 0,
    roughness: 60,
    colorTint: '#ffffff',
    matchLighting: true,
    preserveReflections: true,
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
    mode: 'fill',
    brushSize: 120,
    hardness: 70,
    cloneAligned: true,
    sourcePoint: null,
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
    density: 50,
    realism: 70,
    sharpness: 60,
    variety: 50,
    scaleAccuracy: 70,
    placementDiscipline: 70,
    luggage: 40,
    motionBlur: 10,
    wardrobeStyle: 'mixed',
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
    lockAspectRatio: true,
    seamlessBlend: true,
    highDetail: false,
    quality: 'standard',
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
  editLayers: [
    { id: '1', name: 'Material - Floor', type: 'material', visible: true, locked: false },
    { id: '2', name: 'Lighting Adj', type: 'lighting', visible: true, locked: false },
    { id: '3', name: 'Original', type: 'background', visible: true, locked: true },
  ],

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

  // 10. Image to CAD
  imgToCadType: 'render',
  imgToCadOutput: 'detail',
  imgToCadLine: { sensitivity: 50, simplify: 20, connect: true },
  imgToCadLayers: { walls: true, windows: true, details: true, hidden: false },
  imgToCadFormat: 'dxf',
  imgToCadPreprocess: { guidance: '', focus: [] },

  // 11. Image to 3D
  img3dInputs: [],
  img3dGeneratedModel: null,
  img3dOutputFormat: 'glb',
  img3dIncludeTextures: true,

  // 12. Video Studio
  videoState: initialVideoState,

  // 13. Document Translation
  documentTranslate: initialDocumentTranslate,

  // 14. PDF Compression
  pdfCompression: initialPdfCompression,
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
  activeStyleId: 'no-style',
  uploadedImage: null,
  sourceImage: null,
  isGenerating: false,
  progress: 0,
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
    case 'SET_MODE': return { ...state, mode: action.payload, activeRightTab: 'default' };
    case 'SET_STYLE': return { ...state, activeStyleId: action.payload };
    case 'SET_IMAGE': return { ...state, uploadedImage: action.payload };
    case 'SET_SOURCE_IMAGE': return { ...state, sourceImage: action.payload };
    case 'SET_GENERATING': return { ...state, isGenerating: action.payload };
    case 'SET_PROGRESS': return { ...state, progress: action.payload };
    case 'UPDATE_WORKFLOW': return { ...state, workflow: { ...state.workflow, ...action.payload } };
    
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
    case 'LOAD_PROJECT': return { 
      ...action.payload,
      sourceImage: action.payload?.sourceImage ?? action.payload?.uploadedImage ?? null,
      appAlert: action.payload?.appAlert ?? null
    };
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
