
export type GenerationMode =
  | 'generate-text'
  | 'render-3d'
  | 'scene-compose'
  | 'render-cad'
  | 'masterplan'
  | 'visual-edit'
  | 'angle-change'
  | 'exploded'
  | 'section'
  | 'render-sketch'
  | 'multi-angle'
  | 'upscale'
  | 'img-to-cad'
  | 'video'
  | 'material-validation'
  | 'document-translate'
  | 'pdf-compression'
  | 'headshot';

export type ImageGenerationModel = 'nano-banana' | 'chatgpt-image-generation-2';

export const DEFAULT_IMAGE_GENERATION_MODEL: ImageGenerationModel = 'nano-banana';
export const AI_SLOP_UPSCALE_IMAGE_MODEL: ImageGenerationModel = 'chatgpt-image-generation-2';

export const IMAGE_GENERATION_MODELS: readonly ImageGenerationModel[] = [
  'nano-banana',
  'chatgpt-image-generation-2',
] as const;

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

export interface SceneInsertionReference {
  id: string;
  image: string;
  caption: string;
  placement: {
    x: number; // normalized 0-1 (from left)
    y: number; // normalized 0-1 (from top)
  } | null;
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
export interface Render3DLighting {
  sun: { enabled: boolean; azimuth: number; elevation: number; intensity: number; colorTemp: number };
  shadows: { enabled: boolean; intensity: number; color: string };
  ambient: { intensity: number; occlusion: number };
  preset: string;
}

export interface Render3DAtmosphere {
  mood: string;
  fog: { enabled: boolean; density: number };
  bloom: { enabled: boolean; intensity: number };
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
}

export type RenderGenerationMode = 'strict-realism' | 'enhance' | 'concept-push';

export const DEFAULT_RENDER_GENERATION_MODE: RenderGenerationMode = 'strict-realism';

export const RENDER_GENERATION_MODES: readonly RenderGenerationMode[] = [
  'strict-realism',
  'enhance',
  'concept-push',
] as const;

export type Render3DSourceMode = 'rerender' | 'alter-rendering';

export const DEFAULT_RENDER3D_SOURCE_MODE: Render3DSourceMode = 'rerender';

export const RENDER3D_SOURCE_MODES: readonly Render3DSourceMode[] = [
  'rerender',
  'alter-rendering',
] as const;

export interface Render3DSettings {
  lighting: Render3DLighting;
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
  render3dSourceMode: Render3DSourceMode;
  renderMode: RenderGenerationMode;
  canvasSync: boolean; // Used for Split View toggle
  compareMode: boolean;
  render3d: Render3DSettings;
  sceneInsertionReferences: SceneInsertionReference[];
  sceneComposeActivePlacementId: string | null;

  // Background/Environment Reference
  styleReferenceImage: string | null;
  styleReferenceEnabled: boolean;
  backgroundReferenceImage: string | null;
  backgroundReferenceEnabled: boolean;

  // 2. CAD to Render
  cadDrawingType: 'plan' | 'section' | 'elevation' | 'site';
  cadScale: string;
  cadOrientation: number;
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
  activeTool: 'select' | 'material' | 'lighting' | 'object' | 'sky' | 'remove' | 'replace' | 'adjust' | 'extend' | 'background' | 'people';
  visualPrompt: string; // The specific prompt for the active operation
  visualSelection: {
    mode: 'rect' | 'brush' | 'lasso' | 'ai' | 'erase' | 'adjust';
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
  visualAutoSelecting: boolean;
  visualMaterial: {
    category: 'Flooring' | 'Wall' | 'Facade' | 'Roof' | 'Metal' | 'Glass' | 'Stone' | 'Fabric';
    materialId: string;
    referenceEnabled: boolean;
    referenceImage: string | null;
    roughness: number;
    colorTint: string;
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
    brushSize: number;
    hardness: number;
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
    aspectRatio: 'same' | '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
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
  visualPeople: {
    // Operation mode
    mode: 'enhance' | 'automatic' | 'repopulate';

    // Airport zone context
    airportZone: 'terminal-general' | 'check-in' | 'security' | 'departure-gate' | 'arrival-hall' | 'baggage-claim' | 'retail-area' | 'food-court' | 'lounge' | 'transit-corridor';

    // Demographics & Diversity
    regionMix: string[];
    ageDistribution: 'young-adults' | 'mixed-all-ages' | 'adults' | 'families' | 'elderly-included';
    genderBalance: 'balanced' | 'male-leaning' | 'female-leaning';
    childrenPresence: number;
    bodyTypeVariety: number;

    // Crowd configuration
    density: number;
    grouping: 'solo-dominant' | 'couples' | 'families' | 'mixed-groups' | 'business-groups';
    flowPattern: 'random' | 'directional' | 'converging' | 'dispersing' | 'queuing';
    movementDirection: 'mixed' | 'mostly-left' | 'mostly-right' | 'toward-camera' | 'away-from-camera';
    paceOfMovement: 'relaxed' | 'moderate' | 'hurried' | 'mixed';
    clusteringTendency: number;

    // Appearance & Wardrobe
    wardrobeStyle: 'business' | 'casual' | 'travel' | 'luxury' | 'sporty' | 'mixed';
    seasonalClothing: 'summer' | 'winter' | 'spring-fall' | 'tropical' | 'mixed';
    formalityLevel: number;
    culturalAttire: number;

    // Activities & Behavior
    activities: string[];
    interactionLevel: number;

    // Luggage & Accessories
    luggageTypes: string[];
    luggageAmount: number;
    trolleyUsage: number;
    personalDevices: number;
    travelAccessories: number;

    // Airport Staff
    includeAirportStaff: boolean;
    includeSecurityPersonnel: boolean;
    includeAirlineCrew: boolean;
    includeGroundCrew: boolean;
    includeServiceStaff: boolean;
    staffDensity: number;

    // Quality & Integration
    realism: number;
    sharpness: number;
    scaleAccuracy: number;
    placementDiscipline: number;
    motionBlur: number;

    // Advanced toggles
    preserveExisting: boolean;
    matchLighting: boolean;
    matchPerspective: boolean;
    groundContact: boolean;
    removeArtifacts: boolean;
  };
  visualExtend: {
    direction: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'none';
    amount: number;
    targetAspectRatio: '16:9' | '21:9' | '4:3' | '1:1' | '9:16' | 'custom';
    customRatio: { width: number; height: number };
  };
  visualBackground: {
    mode: 'prompt' | 'image';
    prompt: string;
    referenceImage: string | null;
    referenceMode: 'absolute' | 'reference';
    matchPerspective: boolean;
    matchLighting: boolean;
    seamlessBlend: boolean;
    preserveDepth: boolean;
    quality: 'draft' | 'standard' | 'high';
  };

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
  // Sketch Analysis
  sketchType: 'exterior' | 'interior' | 'detail' | 'aerial';
  sketchAutoDetect: boolean;
  sketchDetectedPerspective:
    | '1-point'
    | '2-point'
    | '3-point'
    | 'isometric'
    | 'axonometric'
    | 'freehand'
    | null;
  sketchLineQuality: number;
  sketchCompleteness: number;

  // Line Processing
  sketchCleanupIntensity: number;
  sketchEnhanceFaint: boolean;
  sketchConnectLines: boolean;
  sketchStraighten: boolean;
  sketchRemoveConstruction: boolean;
  sketchLineWeight: 'thin' | 'medium' | 'thick' | 'vary';
  sketchPerspectiveCorrect: boolean;
  sketchPerspectiveStrength: number;
  sketchFixVerticals: boolean;

  // View & Perspective
  sketchPerspectiveType: '1-point' | '2-point' | '3-point' | 'isometric' | 'axonometric' | 'freehand';
  sketchHorizonLine: number;
  sketchCameraHeight: 'ground' | 'eye' | 'elevated' | 'aerial';
  sketchVanishingPoints: { x: number; y: number }[];

  // Interpretation
  sketchInterpretation: number; // 0-100 faithful-creative
  sketchPreserveOutline: boolean;
  sketchPreserveOpenings: boolean;
  sketchPreserveRoof: boolean;
  sketchPreserveFloors: boolean;
  sketchPreserveProportions: boolean;
  sketchAllowDetails: boolean;
  sketchAllowMaterials: boolean;
  sketchAllowEntourage: boolean;
  sketchAllowExtend: boolean;
  sketchAmbiguityMode: 'ask' | 'conservative' | 'creative' | 'typical';

  // References
  sketchRefs: { id: string; url: string; type: 'style' | 'material' | 'mood' }[];
  sketchRefInfluence: number;
  sketchRefType: 'style' | 'material' | 'mood';
  sketchMaterialPalette: string;
  sketchMoodPreset: string;

  // 8. Upscale
  upscaleMode: 'resolution' | 'ai-slop';
  upscaleFactor: '2x' | '4x' | '8x';
  upscaleSharpness: number;
  upscaleClarity: number;
  upscaleEdgeDefinition: number;
  upscaleFineDetail: number;
  upscaleFormat: 'png' | 'jpg' | 'tiff';
  upscalePreserveMetadata: boolean;
  upscaleBatch: { id: string; name: string; status: 'queued' | 'done' | 'processing' | 'failed'; url?: string; retryCount?: number; error?: string }[];

  // 9. Multi-Angle
  multiAnglePreset: 'turntable' | 'architectural' | 'birds-eye' | 'custom';
  multiAngleViewCount: number;
  multiAngleDistribution: 'even' | 'manual';
  multiAngleAzimuthRange: [number, number];
  multiAngleElevationRange: [number, number];
  multiAngleLockConsistency: boolean;
  multiAngleAngles: { id: string; azimuth: number; elevation: number }[];
  multiAngleOutputs: { id: string; name: string; url: string }[];

  // 10. Angle Change
  angleChangeDegrees: number;
  angleChangePitch: number;
  angleChangeOutputs: {
    id: string;
    name: string;
    url: string;
    rotation: number;
    pitch: number;
    createdAt: number;
  }[];

  // 11. Image to CAD
  imgToCadType: 'photo' | 'render';
  imgToCadOutput: 'elevation' | 'plan' | 'detail';
  imgToCadLine: { sensitivity: number; simplify: number; connect: boolean };
  imgToCadLayers: { walls: boolean; windows: boolean; details: boolean; hidden: boolean };
  imgToCadFormat: 'dxf' | 'dwg' | 'svg' | 'pdf';

  // 12. Video Studio
  videoState: VideoState;

  // 13. Document Translation
  documentTranslate: DocumentTranslateState;

  // 14. PDF Compression
  pdfCompression: PdfCompressionState;

  // 15. Headshot Generator
  headshot: HeadshotSettings;
}

export interface HeadshotGeneratedItem {
  id: string;
  url: string;
  style: 'professional' | 'website-custom';
  colorMode: 'color' | 'black-and-white';
  createdAt: number;
}

export interface HeadshotSettings {
  // Reference images (up to 3 angles)
  leftImage: string | null;
  frontImage: string | null;
  rightImage: string | null;

  // Style
  style: 'professional' | 'website-custom';

  // Tone — controls formality of attire and expression
  tone: 'formal' | 'smart-casual' | 'casual' | 'creative';

  // Purpose — intended use of the headshot
  purpose: 'linkedin' | 'student-card' | 'team-page' | 'social-media' | 'id-document' | 'portfolio';

  // Color treatment
  colorMode: 'color' | 'black-and-white';

  // For website-custom: employee role drives the activity shown
  role: string;

  // For website-custom: which direction the person faces
  facing: 'left' | 'right';

  // Background (professional only)
  background: 'studio-white' | 'studio-grey' | 'studio-dark' | 'blurred-office' | 'gradient';

  // Quality
  quality: 'standard' | 'high';

  // Generated results
  generatedItems: HeadshotGeneratedItem[];
}

// Video Studio Types
export type VideoModel = 'veo-3.1-generate-preview' | 'kling-2.6';
export type VideoInputMode = 'image-animate' | 'camera-path' | 'image-morph' | 'multi-shot';
export type CameraMotionType = 'static' | 'pan' | 'orbit' | 'dolly' | 'crane' | 'drone' | 'rotate' | 'push-in' | 'pull-out' | 'custom';

// Social Media Presets
export type SocialMediaPlatform =
  | 'linkedin'
  | 'instagram-story'
  | 'instagram-post'
  | 'tiktok'
  | 'youtube-shorts'
  | 'website-hero';

export interface SocialMediaPreset {
  platform: SocialMediaPlatform;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
  duration: number; // seconds
  resolution: '720p' | '1080p' | '4k';
  fps: 24 | 30 | 60;
  description: string;
}

// Motion Style Presets
export type MotionStyle =
  | 'smooth'
  | 'dynamic'
  | 'energetic'
  | 'elegant'
  | 'cinematic'
  | 'subtle'
  | 'dramatic'
  | 'gentle';

// Image data passed to video generation services
export interface ImageData {
  dataUrl?: string;
  base64?: string;
  mimeType?: string;
}

// API Provider Types
export type KlingProvider = 'piapi' | 'ulazai' | 'wavespeedai';

// Video Generation Progress
export interface VideoGenerationProgress {
  phase: 'initializing' | 'processing' | 'rendering' | 'complete' | 'error';
  progress: number; // 0-100
  message?: string;
  estimatedTimeRemaining?: number;
  videoUrl?: string;
}

export interface VideoState {
  inputMode: VideoInputMode;
  model: VideoModel;
  scenario: string;
  compareMode: boolean;
  accessUnlocked: boolean;

  // Generation Params
  duration: number; // seconds
  resolution: '720p' | '1080p' | '4k';
  fps: 24 | 30 | 60;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
  motionAmount: number; // 1-10
  seed: number;
  seedLocked: boolean;

  // Veo 3.1 Specific Parameters
  generateAudio?: boolean;
  personGeneration?: 'allow_adult' | 'dont_allow' | 'allow_all';
  negativePrompt?: string;

  // Veo input images
  videoInputImage: string | null; // base64 data URL for image-animate mode
  startFrame: string | null;      // base64 data URL for start frame (interpolation)
  endFrame: string | null;        // base64 data URL for end frame (interpolation)

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

  // NEW: Social Media & Motion Presets
  socialMediaPreset: SocialMediaPlatform | null;
  motionStyle: MotionStyle;

  // NEW: API & Quality Settings
  klingProvider: KlingProvider;
  quality: 'draft' | 'standard' | 'high' | 'ultra';
  transitionEffect: 'cut' | 'fade' | 'dissolve' | 'wipe' | 'none';

  // NEW: Generation Progress & History
  generationProgress: VideoGenerationProgress | null;
  generationHistory: Array<{
    id: string;
    url: string;
    thumbnail: string;
    timestamp: number;
    settings: Partial<VideoState>;
  }>;
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
  application?: string;
}

export interface BoQItem {
  code: string;
  section: string;
  description: string;
  materialRef: string;
  product?: {
    type: string;
    brand: string;
  };
  quantity: {
    terminal?: number;
    cargo?: number;
    unit: string;
  };
}

export interface MaterialValidationDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  uploadedAt: number;
}

export interface MaterialValidationChecks {
  crossReferenceBoq: boolean;
  technicalSpec: boolean;
  dimensions: boolean;
  productRefs: boolean;
  quantities: boolean;
}

export interface MaterialValidationState {
  activeTab: 'dashboard' | 'documents' | 'materials' | 'drawings' | 'boq' | 'issues' | 'reports';
  documents: MaterialValidationDocument[];
  checks: MaterialValidationChecks;
  materials: ParsedMaterial[];
  boqItems: BoQItem[];
  issues: ValidationIssue[];
  stats: {
    total: number;
    validated: number;
    warnings: number;
    errors: number;
  };
  selectedMaterialCode: string | null;
  isRunning: boolean;
  lastRunAt: number | null;
  aiSummary: string | null;
  error?: string | null;
}

// --- Enhanced Material Validation Types for Batch Processing ---

/** Content fetched from a web link accompanying a material specification */
export interface FetchedLinkContent {
  url: string;
  title?: string;
  /** Extracted text content (max ~2000 chars) */
  content: string;
  fetchedAt: number;
  error?: string;
}

/** Material candidate enriched with fetched web content */
export interface EnrichedMaterialCandidate {
  id: string;
  code: string;
  name: string;
  specText: string;
  links: string[];
  docId: string;
  docName: string;
  source: 'terminal' | 'cargo';
  pageRef?: string;
  /** Web content fetched from material reference links */
  fetchedLinks: FetchedLinkContent[];
}

/** Batch processing state for progress tracking */
export interface BatchProcessingState {
  currentDocument: string;
  currentPhase: 'parsing' | 'fetching-links' | 'technical-validation' | 'boq-validation';
  documentsProcessed: number;
  documentsTotal: number;
  materialsProcessed: number;
  materialsTotal: number;
  batchJobId?: string;
  batchJobState?: string;
}

/** Result from the material validation service */
export interface MaterialValidationResult {
  materials: ParsedMaterial[];
  issues: ValidationIssue[];
  boqItems: BoQItem[];
  summary: string;
}

// --- Document Translation Types ---

export interface DocumentTranslateDocument {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'xlsx' | 'pptx';
  mimeType:
    | 'application/pdf'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    | 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  size: number;
  dataUrl: string;
  uploadedAt: number;
}

export interface SegmentContext {
  location: 'body' | 'header' | 'footer' | 'footnote' | 'table-cell';
  styleInfo?: string;
}

export interface TextSegment {
  id: string;
  text: string;
  translatedText?: string;
  xmlPath: string;
  paragraphIndex: number;
  context: SegmentContext;
  status: 'pending' | 'completed' | 'error';
  error?: string;
}

export interface DocumentMetadata {
  totalParagraphs: number;
  totalCharacters: number;
  estimatedBatches: number;
}

export interface ParsedDocx {
  zipInstance: any; // JSZip instance
  xmlDocuments: Map<string, Document>;
  segments: TextSegment[];
  metadata: DocumentMetadata;
}

export interface LegalSection {
  title: string;
  startIndex: number;
  endIndex: number;
  level: number;
}

export interface ParsedLegalDocx extends ParsedDocx {
  sections: LegalSection[];
}

export type XlsxTranslationTargetKind = 'shared-string' | 'inline-string' | 'formula-string';

export interface XlsxTranslationTarget {
  kind: XlsxTranslationTargetKind;
  xmlPath: string;
  sheetName: string;
  cellAddress: string;
  textElement: Element;
  sharedStringIndex?: number;
}

export type XlsxSkipReason =
  | 'formula-cell'
  | 'rich-text'
  | 'malformed-cell-reference'
  | 'missing-text-node'
  | 'missing-shared-strings'
  | 'invalid-shared-string-index'
  | 'unsupported-cell-type';

export interface XlsxSkippedCell {
  sheetName: string;
  cellAddress: string;
  reason: XlsxSkipReason;
}

export interface ParsedXlsx {
  zipInstance: any; // JSZip instance
  xmlDocuments: Map<string, Document>;
  segments: TextSegment[];
  targetMap: Map<string, XlsxTranslationTarget>;
  skippedCells: XlsxSkippedCell[];
  detectedTextCount: number;
  sheetCount: number;
  metadata: DocumentMetadata;
}

export interface PptxTranslationTarget {
  xmlPath: string;
  textElements: Element[];
}

export interface ParsedPptx {
  zipInstance: any; // JSZip instance
  xmlDocuments: Map<string, Document>;
  segments: TextSegment[];
  targetMap: Map<string, PptxTranslationTarget>;
  detectedTextCount: number;
  slideCount: number;
  metadata: DocumentMetadata;
}

export interface TranslationConfig {
  batchSize: number;
  maxCharsPerBatch: number;
  maxConcurrentBatches: number;
  sourceLanguage: string;
  targetLanguage: string;
  excludedTerms?: string[];
  translateHeaders: boolean;
  translateFooters: boolean;
  translateFootnotes: boolean;
  modelTemperature: number;
  model?: string;
}

export interface TranslationBatch {
  id: string;
  segments: TextSegment[];
  startIndex: number;
  totalCharacters: number;
  status: 'pending' | 'translating' | 'completed' | 'error';
  retryCount: number;
}

export interface TranslationProgress {
  phase: 'idle' | 'parsing' | 'translating' | 'rebuilding' | 'complete' | 'error';
  currentSegment: number;
  totalSegments: number;
  currentBatch: number;
  totalBatches: number;
  message?: string;
}

export interface XlsxTranslationStats {
  translatedCount: number;
  skippedCount: number;
  detectedTextCount: number;
}

export interface DocumentTranslationResult {
  dataUrl: string;
  warnings: string[] | null;
  xlsxStats: XlsxTranslationStats | null;
}

export interface DocumentTranslateState {
  sourceDocument: DocumentTranslateDocument | null;
  sourceLanguage: string;
  targetLanguage: string;
  translateHeaders: boolean;
  translateFootnotes: boolean;
  progress: TranslationProgress;
  translatedDocumentUrl: string | null;
  warnings: string[] | null;
  xlsxStats: XlsxTranslationStats | null;
  error: string | null;
}

// --- PDF Compression Types ---

export interface PdfCompressionDocument {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
  uploadedAt: number;
}

export interface PdfCompressionOutput {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
  sourceId?: string;
  compressedAt: number;
}

export interface PdfCompressionState {
  queue: PdfCompressionDocument[];
  selectedId: string | null;
  outputs: PdfCompressionOutput[];
  compressionLevel?: 'light' | 'balanced' | 'aggressive';
  imageQuality?: number; // 0-100
  stripMetadata?: boolean;
  preserveText?: boolean;
  preserveVectors?: boolean;
  remainingFiles?: number;
  remainingCredits?: number;
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
  resolution: '2k' | '4k' | 'custom';
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
  modelPrompt?: string;
  attachments?: string[];
  mode: GenerationMode;
  settings?: any;
}

export interface AppAlert {
  id: string;
  title?: string;
  message: string;
  tone: 'info' | 'warning' | 'error';
}

export type GenerationProgressStage =
  | 'preparing'
  | 'aiLayer'
  | 'generation'
  | 'transfer'
  | 'finalizing'
  | 'complete';

export interface GenerationRetryNotice {
  reason: 'unsatisfactory-result';
  attempt: number;
}

export interface AppState {
  mode: GenerationMode;
  imageGenerationModel: ImageGenerationModel;
  activeStyleId: string;
  uploadedImage: string | null;
  sourceImage: string | null;
  isGenerating: boolean;
  progress: number;
  generationStage: GenerationProgressStage | null;
  generationRetryNotice: GenerationRetryNotice | null;
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
  appAlert: AppAlert | null;

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
  | { type: 'SET_IMAGE_GENERATION_MODEL'; payload: ImageGenerationModel }
  | { type: 'SET_STYLE'; payload: string }
  | { type: 'SET_IMAGE'; payload: string | null }
  | { type: 'SET_SOURCE_IMAGE'; payload: string | null }
  | { type: 'CLEAR_CANVAS' }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'SET_PROGRESS'; payload: number }
  | { type: 'SET_GENERATION_STAGE'; payload: GenerationProgressStage | null }
  | { type: 'SET_GENERATION_RETRY_NOTICE'; payload: GenerationRetryNotice | null }
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
  | { type: 'SET_APP_ALERT'; payload: AppAlert | null }
  | { type: 'LOAD_PROJECT'; payload: AppState }
  | { type: 'RESET_PROJECT' }
  // Document Translation
  | { type: 'UPDATE_DOCUMENT_TRANSLATE'; payload: Partial<DocumentTranslateState> }
  | { type: 'SET_PROMPT'; payload: string };

export type FeedbackReportStatus = 'new' | 'triaged' | 'in_progress' | 'resolved' | 'closed';
export type FeedbackReportPriority = 'low' | 'normal' | 'high' | 'urgent';
export type FeedbackReportCategory = 'bug' | 'quality' | 'ux' | 'performance' | 'feature_request' | 'other';
export type FeedbackImageSourceType = 'source' | 'current' | 'history';

export interface FeedbackImageMarkupLassoPoint {
  x: number; // normalized 0-1
  y: number; // normalized 0-1
}

export interface FeedbackImageMarkupLasso {
  id: string;
  points: FeedbackImageMarkupLassoPoint[];
}

export interface FeedbackImageMarkupCircleLegacy {
  id: string;
  x: number; // normalized 0-1
  y: number; // normalized 0-1
  radius: number; // normalized 0-1
}

export type FeedbackImageMarkupShape = FeedbackImageMarkupLasso | FeedbackImageMarkupCircleLegacy;

export interface FeedbackImageAnnotation {
  id: string;
  sourceType: FeedbackImageSourceType;
  label: string;
  previewDataUrl?: string;
  historyId?: string | null;
  historyIndex?: number | null;
  mode?: GenerationMode | null;
  timestamp?: number | null;
  note?: string;
  markups: FeedbackImageMarkupShape[];
}

export type FeedbackDocumentAttachmentKind = 'original' | 'translated';

export interface FeedbackDocumentAttachment {
  id: string;
  kind: FeedbackDocumentAttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  sourceDocumentId?: string | null;
}

export interface FeedbackProjectSnapshot {
  snapshotVersion: number;
  createdAt: string;
  reporterEmail: string;
  projectName: string | null;
  mode: GenerationMode;
  historyCount: number;
  appState: AppState;
  metadata: {
    app: 'archviz-ai-studio';
    schema: 'feedback-project-snapshot-v1';
  };
}

export interface FeedbackActivityItem {
  id: number;
  created_at: string;
  actor_email: string;
  actor_name: string | null;
  kind: 'created' | 'comment' | 'status_changed' | 'priority_changed' | 'system';
  message: string;
  from_status?: FeedbackReportStatus | null;
  to_status?: FeedbackReportStatus | null;
  from_priority?: FeedbackReportPriority | null;
  to_priority?: FeedbackReportPriority | null;
  metadata?: Record<string, any> | null;
}

export interface FeedbackReportSummary {
  id: string;
  created_at: string;
  updated_at?: string;
  last_activity_at?: string;
  reporter_email: string;
  reporter_name?: string | null;
  status: FeedbackReportStatus;
  priority: FeedbackReportPriority;
  category: FeedbackReportCategory;
  title: string;
  mode?: string | null;
  project_name?: string | null;
  history_count?: number;
  snapshot_size_bytes?: number;
  snapshot_storage_path?: string | null;
}

export interface FeedbackReportDetail extends FeedbackReportSummary {
  reporter_picture?: string | null;
  description: string;
  reproduction_steps?: string | null;
  expected_behavior?: string | null;
  app_version?: string | null;
  user_agent?: string | null;
  snapshot_version?: number;
  snapshot_hash?: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  metadata?: Record<string, any>;
}

export interface FeedbackReportCreatePayload {
  title: string;
  description: string;
  category: FeedbackReportCategory;
  priority: FeedbackReportPriority;
  reproductionSteps?: string;
  expectedBehavior?: string;
  projectName?: string;
  mode: GenerationMode;
  appVersion?: string;
  userAgent?: string;
  historyCount: number;
  snapshotVersion: number;
  snapshot: FeedbackProjectSnapshot;
  reportedFeatureKey?: string;
  reportedFeatureLabel?: string;
  imageFeedback?: FeedbackImageAnnotation[];
  documentFeedback?: FeedbackDocumentAttachment[];
}
