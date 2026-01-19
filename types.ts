
export type GenerationMode = 
  | 'generate-text'
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string; // text for user, image url for assistant
  type: 'text' | 'image';
  attachments?: string[]; // base64 strings
  timestamp: number;
  isLoading?: boolean;
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
  type: string;
  selected: boolean;
  areaHa?: number;
}

export interface SectionArea {
  id: string;
  title: string;
  description: string;
  order: number;
  active: boolean;
}

export interface VisualSelectionPoint {
  x: number;
  y: number;
}

export type VisualSelectionShape =
  | { id: string; type: 'rect'; start: VisualSelectionPoint; end: VisualSelectionPoint }
  | { id: string; type: 'brush'; points: VisualSelectionPoint[]; brushSize: number }
  | { id: string; type: 'lasso'; points: VisualSelectionPoint[] };

// Render 3D Panel Settings
export interface Render3DGeometry {
  edgeMode: 'soft' | 'medium' | 'sharp';
  strictPreservation: boolean;
  geometryFreedom: number;
  lod: {
    level: 'minimal' | 'low' | 'medium' | 'high' | 'ultra';
    preserveOrnaments: boolean;
    preserveMoldings: boolean;
    preserveTrim: boolean;
  };
  smoothing: {
    enabled: boolean;
    intensity: number;
    preserveHardEdges: boolean;
    threshold: number;
  };
  depthLayers: {
    enabled: boolean;
    foreground: number;
    midground: number;
    background: number;
  };
  displacement: {
    enabled: boolean;
    strength: number;
    scale: 'fine' | 'medium' | 'coarse';
    adaptToMaterial: boolean;
  };
}

export interface Render3DLighting {
  sun: { enabled: boolean; azimuth: number; elevation: number; intensity: number; colorTemp: number; softness: number };
  shadows: { enabled: boolean; intensity: number; softness: number; color: string };
  ambient: { intensity: number; occlusion: number };
  preset: string;
}

export interface Render3DCamera {
  preset: string;
  lens: number;
  fov: number;
  autoCorrect: boolean;
  dof: { enabled: boolean; aperture: number; focusDist: number };
}

export interface Render3DMaterials {
  emphasis: {
    concrete: number;
    wood: number;
    metal: number;
    glass: number;
    stone: number;
    brick: number;
    tile: number;
    fabric: number;
    paint: number;
    flooring: number;
  };
  reflectivity: number;
  roughness: number;
  weathering: { enabled: boolean; intensity: number };
}

export interface Render3DAtmosphere {
  mood: string;
  fog: { enabled: boolean; density: number };
  bloom: { enabled: boolean; intensity: number };
  temp: number;
}

export interface Render3DScenery {
  people: { enabled: boolean; count: number };
  trees: { enabled: boolean; count: number };
  cars: { enabled: boolean; count: number };
  preset: string;
}

export interface Render3DFormat {
  resolution: '720p' | '1080p' | '4k' | 'print';
  aspectRatio: '16:9' | '4:3' | '3:2' | '1:1' | '21:9' | '9:16';
  viewType: string;
  quality: 'draft' | 'preview' | 'production' | 'ultra';
}

export interface Render3DSettings {
  geometry: Render3DGeometry;
  lighting: Render3DLighting;
  camera: Render3DCamera;
  materials: Render3DMaterials;
  atmosphere: Render3DAtmosphere;
  scenery: Render3DScenery;
  render: Render3DFormat;
}

export interface WorkflowSettings {
  // 0. Text to Image
  textPrompt: string;

  // 1. 3D to Render
  sourceType: 'revit' | 'rhino' | 'sketchup' | 'blender' | '3dsmax' | 'archicad' | 'cinema4d' | 'clay' | 'other';
  viewType: 'exterior' | 'interior' | 'aerial' | 'detail';
  prioritizationEnabled: boolean;
  detectedElements: DetectedElement[];
  renderMode: 'enhance' | 'stylize' | 'hybrid' | 'strict-realism' | 'concept-push';
  canvasSync: boolean; // Used for Split View toggle
  compareMode: boolean;
  render3d: Render3DSettings;

  // 2. CAD to Render
  cadDrawingType: 'plan' | 'section' | 'elevation' | 'site';
  cadScale: string;
  cadOrientation: number;
  cadLayerDetectionEnabled: boolean;
  cadLayers: DetectedLayer[];
  cadCamera: {
    height: number;
    angle: 'horizontal' | 'down' | 'up';
    focalLength: number;
    position: { x: number; y: number };
    lookAt: 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
    verticalCorrection: boolean;
  };
  cadSpace: {
    roomType: string;
    ceilingStyle: 'flat' | 'coffered' | 'beams' | 'vaulted';
    windowStyle: 'slim' | 'heavy' | 'curtain' | 'frosted' | 'tinted';
    doorStyle: 'panel' | 'glass' | 'flush' | 'industrial';
  };
  cadContext: {
    landscape: 'garden' | 'native' | 'minimal' | 'tropical' | 'xeriscape';
    environment: 'urban' | 'suburban' | 'rural';
    season: 'spring' | 'summer' | 'autumn' | 'winter';
  };
  cadSpatial: { ceilingHeight: number; floorThick: number; wallThick: number; style: number }; // style 0-100 conservative-creative
  cadMaterialAssignments: Record<string, string>; // elementId -> materialId
  cadFurnishing: {
    auto: boolean;
    styles: string[];
    density: number;
    occupancy: 'empty' | 'staged' | 'lived-in';
    clutter: number;
    people: boolean;
    entourage: number;
  };

  // 3. Masterplan
  mpInputSource: 'upload' | 'canvas';
  mpInputImage: string | null;
  mpPlanType: 'site' | 'urban' | 'zoning' | 'massing';
  mpScale: '1:200' | '1:500' | '1:1000' | '1:2500' | '1:5000' | '1:10000' | 'custom';
  mpCustomScale: number;
  mpNorthRotation: number;
  mpZoneDetection: 'auto' | 'manual';
  mpZones: ZoneItem[];
  mpBoundary: { mode: 'auto' | 'custom' | 'full'; points: { x: number; y: number }[] };
  mpBoundaryUndoStack: { x: number; y: number }[][];
  mpBoundaryRedoStack: { x: number; y: number }[][];
  mpContext: {
    location: string;
    coordinates: { lat: number; lng: number } | null;
    radius: number;
    loadBuildings: boolean;
    loadRoads: boolean;
    loadWater: boolean;
    loadTerrain: boolean;
    loadTransit: boolean;
    loadedData: {
      buildings: number;
      roads: number;
      water: number;
      terrain: boolean;
      transit: number;
    } | null;
  };
  mpOutputStyle: 'photorealistic' | 'diagrammatic' | 'hybrid' | 'illustrative';
  mpViewAngle: 'top' | 'iso-ne' | 'iso-nw' | 'iso-se' | 'iso-sw' | 'custom';
  mpViewCustom: { elevation: number; rotation: number; perspective: number };
  mpBuildings: {
    style: string;
    heightMode: 'uniform' | 'from-color' | 'vary';
    defaultHeight: number;
    heightRange: { min: number; max: number };
    floorHeight: number;
    roofStyle: 'flat' | 'gabled' | 'hip' | 'mansard' | 'green' | 'mixed';
    showShadows: boolean;
    transparent: boolean;
    facadeVariation: boolean;
    showFloorLabels: boolean;
  };
  mpLandscape: {
    season: 'spring' | 'summer' | 'autumn' | 'winter';
    vegetationDensity: number;
    treeVariation: number;
    trees: boolean;
    grass: boolean;
    water: boolean;
    pathways: boolean;
    streetFurniture: boolean;
    vehicles: boolean;
    people: boolean;
    vegetationStyle: 'realistic' | 'stylized' | 'watercolor' | 'technical';
  };
  mpAnnotations: {
    zoneLabels: boolean;
    streetNames: boolean;
    buildingLabels: boolean;
    lotNumbers: boolean;
    scaleBar: boolean;
    northArrow: boolean;
    dimensions: boolean;
    areaCalc: boolean;
    contourLabels: boolean;
    labelStyle: 'modern' | 'classic' | 'technical' | 'handwritten' | 'minimal';
    labelSize: 'small' | 'medium' | 'large';
    labelColor: 'auto' | 'dark' | 'light';
    labelHalo: boolean;
  };
  mpLegend: {
    include: boolean;
    position: 'top-left' | 'top-right' | 'bottom';
    showZones: boolean;
    showZoneAreas: boolean;
    showBuildings: boolean;
    showLandscape: boolean;
    showInfrastructure: boolean;
    style: 'compact' | 'detailed' | 'professional' | 'minimal';
  };
  mpExport: {
    resolution: '1080p' | '2k' | '4k' | 'print-a3' | 'print-a2' | 'print-a1' | 'print-a0' | 'custom';
    customResolution: { width: number; height: number };
    format: 'png' | 'tiff' | 'pdf' | 'psd';
    exportLayers: boolean;
    cadCompatible: boolean;
    includeSketch: boolean;
    layerExport: {
      base: boolean;
      zones: boolean;
      buildings: boolean;
      landscape: boolean;
      annotations: boolean;
      legend: boolean;
    };
  };

  // 4. Visual Edit
  activeTool: 'select' | 'material' | 'lighting' | 'object' | 'sky' | 'remove' | 'replace' | 'adjust' | 'extend';
  visualPrompt: string; // The specific prompt for the active operation
  visualSelection: {
    mode: 'rect' | 'brush' | 'lasso' | 'ai';
    brushSize: number;
    featherEnabled: boolean;
    featherAmount: number;
    strength: number;
    autoTargets: string[];
  };
  visualSelections: VisualSelectionShape[];
  visualSelectionUndoStack: VisualSelectionShape[][];
  visualSelectionRedoStack: VisualSelectionShape[][];
  visualSelectionMask: string | null;
  visualSelectionMaskSize: { width: number; height: number } | null;
  visualSelectionViewScale: number | null;
  visualSelectionComposite: string | null;
  visualSelectionCompositeSize: { width: number; height: number } | null;
  visualMaterial: {
    surfaceType: 'auto' | 'manual';
    category: 'Flooring' | 'Wall' | 'Facade' | 'Roof' | 'Metal' | 'Glass' | 'Stone' | 'Fabric';
    materialId: string;
    scale: number;
    rotation: number;
    roughness: number;
    colorTint: string;
    matchLighting: boolean;
    preserveReflections: boolean;
  };
  visualLighting: {
    mode: 'sun' | 'hdri' | 'artificial';
    sun: { azimuth: number; elevation: number; intensity: number; colorTemp: number; shadowSoftness: number };
    hdri: { preset: string; rotation: number; intensity: number };
    artificial: { type: 'point' | 'spot' | 'area'; position: { x: number; y: number }; intensity: number; color: string; falloff: number };
    ambient: number;
    preserveShadows: boolean;
  };
  visualSky: {
    preset: string;
    horizonLine: number;
    cloudDensity: number;
    atmosphere: number;
    brightness: number;
    reflectInGlass: boolean;
    matchLighting: boolean;
    sunFlare: boolean;
  };
  visualObject: {
    category: 'Furniture' | 'People' | 'Vehicles' | 'Vegetation' | 'Props';
    subcategory: string;
    assetId: string;
    selectionIds: string[];
    placementMode: 'place' | 'replace';
    scale: number;
    rotation: number;
    autoPerspective: boolean;
    shadow: boolean;
    groundContact: boolean;
    position: { x: number; y: number };
    depth: 'foreground' | 'midground' | 'background';
  };
  visualRemove: {
    mode: 'fill' | 'aware' | 'clone';
    brushSize: number;
    hardness: number;
    cloneAligned: boolean;
    sourcePoint: { x: number; y: number } | null;
    quickRemove: string[];
    autoDetectEdges: boolean;
    preserveStructure: boolean;
  };
  visualReplace: {
    mode: 'similar' | 'different' | 'custom';
    variation: number;
    category: 'Furniture' | 'Vehicle' | 'Plant' | 'Person' | 'Object';
    style: string;
    prompt: string;
    matchScale: boolean;
    matchLighting: boolean;
    preserveShadows: boolean;
  };
  visualAdjust: {
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
    whites: number;
    blacks: number;
    gamma: number;
    saturation: number;
    vibrance: number;
    temperature: number;
    tint: number;
    hueShift: number;
    texture: number;
    dehaze: number;
    sharpness: number;
    sharpnessRadius: number;
    sharpnessDetail: number;
    sharpnessMasking: number;
    noiseReduction: number;
    noiseReductionColor: number;
    noiseReductionDetail: number;
    hslChannel: string;
    hslRedsHue: number;
    hslRedsSaturation: number;
    hslRedsLuminance: number;
    hslOrangesHue: number;
    hslOrangesSaturation: number;
    hslOrangesLuminance: number;
    hslYellowsHue: number;
    hslYellowsSaturation: number;
    hslYellowsLuminance: number;
    hslGreensHue: number;
    hslGreensSaturation: number;
    hslGreensLuminance: number;
    hslAquasHue: number;
    hslAquasSaturation: number;
    hslAquasLuminance: number;
    hslBluesHue: number;
    hslBluesSaturation: number;
    hslBluesLuminance: number;
    hslPurplesHue: number;
    hslPurplesSaturation: number;
    hslPurplesLuminance: number;
    hslMagentasHue: number;
    hslMagentasSaturation: number;
    hslMagentasLuminance: number;
    colorGradeShadowsHue: number;
    colorGradeShadowsSaturation: number;
    colorGradeMidtonesHue: number;
    colorGradeMidtonesSaturation: number;
    colorGradeHighlightsHue: number;
    colorGradeHighlightsSaturation: number;
    colorGradeBalance: number;
    clarity: number;
    vignette: number;
    vignetteMidpoint: number;
    vignetteRoundness: number;
    vignetteFeather: number;
    grain: number;
    grainSize: number;
    grainRoughness: number;
    bloom: number;
    chromaticAberration: number;
    transformRotate: number;
    transformHorizontal: number;
    transformVertical: number;
    transformDistortion: number;
    transformPerspective: number;
    styleStrength: number;
  };
  visualExtend: {
    direction: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'none';
    amount: number;
    targetAspectRatio: '16:9' | '21:9' | '4:3' | '1:1' | '9:16' | 'custom';
    customRatio: { width: number; height: number };
    lockAspectRatio: boolean;
    seamlessBlend: boolean;
    highDetail: boolean;
    quality: 'draft' | 'standard' | 'high';
  };
  editLayers: { id: string; name: string; type: string; visible: boolean; locked: boolean }[];

  // 5. Exploded
  explodedSource: {
    type: 'revit' | 'rhino' | 'sketchup' | 'archicad' | 'ifc' | 'other';
    fileName: string | null;
    componentCount: number;
  };
  explodedComponents: {
    id: string;
    name: string;
    title: string;
    description: string;
    attributes: string[];
    order: number;
    active: boolean;
    category: 'structure' | 'envelope' | 'interior' | 'mep' | 'site';
    color?: string;
  }[];
  explodedDetection: 'auto' | 'manual' | 'category';
  explodedDirection: 'vertical' | 'radial' | 'custom';
  explodedAxis: { x: number; y: number; z: number };
  explodedView: {
    type: 'axon' | 'perspective';
    angle: 'iso-ne' | 'iso-nw' | 'iso-se' | 'iso-sw';
    cameraHeight: number;
    fov: number;
    lookAt: 'center' | 'top' | 'bottom';
    separation: number;
  };
  explodedStyle: {
    render: 'stacked' | 'radial' | 'sequential' | 'core-shell' | 'slice' | 'systems';
    colorMode: 'material' | 'system' | 'mono';
    systemColors: Record<string, string>;
    edgeStyle: 'hidden-removed' | 'hidden-dashed' | 'all-visible' | 'silhouette';
    lineWeight: number;
  };
  explodedAnnotations: {
    labels: boolean;
    leaders: boolean;
    leaderStyle: 'straight' | 'angled' | 'curved';
    dimensions: boolean;
    assemblyNumbers: boolean;
    materialCallouts: boolean;
    labelStyle: 'minimal' | 'technical' | 'descriptive';
    fontSize: 'small' | 'medium' | 'large';
  };
  explodedAnim: {
    generate: boolean;
    type: 'assembly' | 'explosion';
    duration: number;
    easing: 'ease-in-out' | 'linear' | 'bounce';
    stagger: number;
    holdStart: number;
    holdEnd: number;
  };
  explodedOutput: {
    resolution: '1080p' | '2k' | '4k' | 'print-a3';
    background: 'white' | 'gray' | 'black' | 'transparent';
    groundPlane: boolean;
    shadow: boolean;
    grid: boolean;
    exportLayers: boolean;
  };

  // 6. Section
  sectionCut: { type: 'vertical' | 'horizontal' | 'diagonal'; plane: number; depth: number; direction: 'fwd' | 'bwd' };
  sectionStyle: { poche: string; hatch: 'solid' | 'diag' | 'cross'; weight: 'heavy' | 'medium' | 'light'; showBeyond: number };
  sectionAreas: SectionArea[];
  sectionAreaDetection: 'auto' | 'manual';
  sectionReveal: {
    style: 'front-peel' | 'slice-lift' | 'stacked-floors' | 'core-focus' | 'program-color' | 'circulation' | 'services';
    focus:
      | 'residential'
      | 'parking'
      | 'circulation'
      | 'services'
      | 'mixed'
      | 'amenities'
      | 'lobby'
      | 'retail'
      | 'office'
      | 'mechanical'
      | 'storage';
    facadeOpacity: number;
    depthFade: number;
  };
  sectionProgram: {
    colorMode: 'program' | 'material' | 'mono';
    programColors: Record<string, string>;
    labels: boolean;
    leaderLines: boolean;
    areaTags: boolean;
    labelStyle: 'minimal' | 'technical' | 'descriptive';
    fontSize: 'small' | 'medium' | 'large';
  };

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
  
  keyframes: { id: string; url: string; duration: number }[];
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
  lod: {
    level: 'minimal' | 'low' | 'medium' | 'high' | 'ultra';
    preserveOrnaments: boolean;
    preserveMoldings: boolean;
    preserveTrim: boolean;
  };
  smoothing: {
    enabled: boolean;
    intensity: number;
    preserveHardEdges: boolean;
    threshold: number;
  };
  depthLayers: {
    enabled: boolean;
    foreground: number;
    midground: number;
    background: number;
  };
  displacement: {
    enabled: boolean;
    strength: number;
    scale: 'fine' | 'medium' | 'coarse';
    adaptToMaterial: boolean;
  };
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
  attachments?: string[];
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
  
  chatMessages: ChatMessage[];
  customStyles: StyleConfiguration[];

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
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_CHAT_MESSAGE'; payload: { id: string; updates: Partial<ChatMessage> } }
  | { type: 'ADD_CUSTOM_STYLE'; payload: StyleConfiguration }
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
