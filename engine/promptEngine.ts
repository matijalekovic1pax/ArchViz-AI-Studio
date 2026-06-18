
import { AppState, DEFAULT_RENDER3D_SOURCE_MODE, DEFAULT_RENDER_GENERATION_MODE, ImageGenerationModel, RENDER_GENERATION_MODES, RenderGenerationMode, StyleConfiguration, VisualSelectionShape } from '../types';
import { getMaterialById } from '../lib/materialCatalog';

type ImagePromptMode = AppState['mode'];
type ImagePromptTool = AppState['workflow']['activeTool'] | string | undefined;

interface PromptIntent {
  artifact: string;
  task: string;
  keep: string;
  change: string;
  textRule: string;
}

interface ImagePromptAdapterOptions {
  mode?: ImagePromptMode | string;
  activeTool?: ImagePromptTool;
  hasSourceImage?: boolean;
  hasReferenceImages?: boolean;
  promptKind?: 'generation' | 'edit' | 'batch' | 'grid';
  settingsDigest?: string[];
  modelGuidance?: string[];
}

const DEFAULT_PROMPT_INTENT: PromptIntent = {
  artifact: 'complete image',
  task: 'Create the requested visual result from the brief.',
  keep: 'Keep any attached source image faithful wherever the feature does not explicitly request a change.',
  change: 'Apply only the requested feature settings and user brief.',
  textRule: 'Preserve existing visible text and render new visible text only when the user explicitly requests it.'
};

const getPromptIntent = (mode?: string, activeTool?: ImagePromptTool): PromptIntent => {
  if (mode === 'visual-edit') {
    const tool = activeTool === 'replace' ? 'object' : activeTool;
    const visualEditIntents: Record<string, PromptIntent> = {
      select: {
        artifact: 'targeted image edit',
        task: 'Use the selection as target guidance for a focused edit.',
        keep: 'Keep unrelated source camera, architecture, people, materials, signage, and composition unchanged.',
        change: 'Apply the user instruction to the selected target, allowing natural blending beyond the drawn edge when needed.',
        textRule: 'Do not render the prompt wording as captions or labels; preserve existing text unless text editing is requested.'
      },
      material: {
        artifact: 'material replacement edit',
        task: 'Change the intended or clearly named target surface finish.',
        keep: 'Keep geometry, seams, edges, reflections, object count, layout, camera, and unrelated materials unchanged.',
        change: 'Apply the requested material, color, texture scale, roughness, tint, and lighting response to the target surface only.',
        textRule: 'Preserve all existing signs, labels, logos, and text-shaped marks.'
      },
      lighting: {
        artifact: 'relit image',
        task: 'Relight the existing scene without redesigning it.',
        keep: 'Keep objects, architecture, materials, camera, sky unless requested, text, and composition unchanged.',
        change: 'Apply the requested light type, direction, color temperature, shadow softness, and mood.',
        textRule: 'Preserve existing visible text and do not add captions.'
      },
      object: {
        artifact: 'object insertion or replacement edit',
        task: 'Place or replace the requested object naturally in the existing scene.',
        keep: 'Keep source architecture, camera, materials, layout, people, signage, and unrelated objects unchanged.',
        change: 'Add or replace only the specified object with correct scale, perspective, occlusion, grounding, and shadows.',
        textRule: 'Do not add labels or prompt text unless the requested object explicitly contains quoted text.'
      },
      sky: {
        artifact: 'sky replacement edit',
        task: 'Replace the sky and harmonize the atmosphere.',
        keep: 'Keep buildings, horizon logic, camera, materials, people, ground, signage, and composition unchanged.',
        change: 'Apply the requested sky, cloud density, horizon, brightness, reflections, and matching light.',
        textRule: 'Preserve all existing text and signage.'
      },
      remove: {
        artifact: 'object removal edit',
        task: 'Remove the selected or named unwanted content.',
        keep: 'Keep every unrelated object, person, architectural element, material boundary, camera, and text unchanged.',
        change: 'Remove the whole target including attached accessories, shadows, and reflections, then reconstruct the background naturally.',
        textRule: 'Do not replace removed content with labels, blank marks, or prompt text.'
      },
      adjust: {
        artifact: 'post-production adjustment',
        task: 'Apply color, tone, detail, crop/aspect, or perspective adjustments only.',
        keep: 'Keep object count, architecture, material identity, people, signage, and scene layout unchanged.',
        change: 'Apply the requested adjustment directions at the specified strength without inventing content.',
        textRule: 'Preserve existing text and signage as source-faithful marks.'
      },
      extend: {
        artifact: 'outpainted image',
        task: 'Extend the canvas in the requested direction.',
        keep: 'Keep original source pixels and source camera logic unchanged.',
        change: 'Paint only the new canvas area, continuing perspective, materials, light, shadows, reflections, and context.',
        textRule: 'Continue existing text/signage shapes only when physically present at the extension edge; do not invent new text.'
      },
      background: {
        artifact: 'background replacement edit',
        task: 'Replace only the background around the protected selection.',
        keep: 'Keep the selected foreground pixels untouched and preserve their identity, geometry, and details.',
        change: 'Create a new background that matches perspective, horizon, lighting, depth, and color grade.',
        textRule: 'Preserve text in the protected selection exactly and do not add prompt labels.'
      },
      people: {
        artifact: 'people-focused architectural edit',
        task: 'Improve, repopulate, or clean up human figures only.',
        keep: 'Keep architecture, materials, landscaping, vehicles, sky, signage, camera, and composition unchanged.',
        change: 'Modify only people and immediate personal accessories according to the people settings.',
        textRule: 'Do not render captions, labels, UI, handwriting, or prompt wording.'
      }
    };
    return visualEditIntents[String(tool)] || visualEditIntents.select;
  }

  const modeIntents: Partial<Record<ImagePromptMode, PromptIntent>> = {
    'generate-text': {
      artifact: 'standalone generated image',
      task: 'Create a new image from the user brief.',
      keep: 'If references are attached, preserve only the requested subject, object, material, mood, or style relationship.',
      change: 'Build one coherent complete image from the brief rather than a keyword collage.',
      textRule: 'Render visible text only if the user asks for it; exact text should be quoted.'
    },
    'render-3d': {
      artifact: 'architectural render from a 3D source',
      task: 'Convert or enhance the 3D/model source into a believable architectural visualization.',
      keep: 'Preserve source architecture, camera, massing, openings, scale, composition, and existing text/signage.',
      change: 'Apply render mode, style, lighting, atmosphere, entourage, context, and output format settings.',
      textRule: 'Keep existing text/signage as source-faithful shapes; do not invent new labels.'
    },
    'scene-compose': {
      artifact: 'source-based scene composition',
      task: 'Insert reference objects or entourage into the base scene.',
      keep: 'Preserve base architecture, camera, layout, material boundaries, and existing composition.',
      change: 'Use each reference only for the explicitly requested object, material, placement, mood, or style.',
      textRule: 'Do not render placement pins, markers, captions, or prompt metadata.'
    },
    'render-cad': {
      artifact: 'CAD-derived architectural visualization',
      task: 'Transform the CAD/drawing source into the requested visualization.',
      keep: 'Preserve drawing geometry, orientation, scale logic, wall/opening positions, labels, dimensions, and line hierarchy.',
      change: 'Apply room, camera, furnishing, material, context, render mode, lighting, atmosphere, and format settings.',
      textRule: 'Preserve source drawing text; render new text only when annotation settings request it.'
    },
    masterplan: {
      artifact: 'masterplan visualization',
      task: 'Create a presentation-ready site, urban, zoning, or massing plan.',
      keep: 'Preserve boundaries, parcels, roads, water, footprints, north orientation, labels, and legend positions from any source plan.',
      change: 'Apply plan type, scale, view angle, building, landscape, annotation, legend, and export settings.',
      textRule: 'Use concise exact labels only when annotation or legend settings request them.'
    },
    exploded: {
      artifact: 'exploded architectural diagram',
      task: 'Separate the source model into an explanatory exploded assembly.',
      keep: 'Preserve component geometry, scale, internal alignment, project identity, facade rhythm, openings, and material identity.',
      change: 'Apply explosion direction, view, dissection style, color mode, edge style, labels, and background settings.',
      textRule: 'Render labels, leaders, dimensions, and assembly numbers only when requested.'
    },
    section: {
      artifact: 'architectural section or cutaway',
      task: 'Create the requested section cut and reveal style.',
      keep: 'Preserve source geometry, scale, section position, projection logic, floor datums, structural grid, and source labels.',
      change: 'Apply cut plane, reveal style, focus, program colors, poché, hatching, line weight, labels, and depth settings.',
      textRule: 'Use sharp exact labels only when requested; preserve existing source text where visible.'
    },
    'render-sketch': {
      artifact: 'sketch-to-render transformation',
      task: 'Transform the sketch into the requested architectural visualization.',
      keep: 'Preserve sketch composition, perspective, silhouette, proportions, line positions, openings, roof, and floor datums according to settings.',
      change: 'Interpret ambiguous areas only to the allowed degree and apply material, style, lighting, context, and render mode settings.',
      textRule: 'Do not add labels unless requested; preserve source notes as source-faithful marks if present.'
    },
    'img-to-cad': {
      artifact: 'CAD-style technical drawing',
      task: 'Convert the source image into a clean CAD drawing.',
      keep: 'Preserve visible proportions, structural rhythm, opening positions, edge relationships, and readable annotations or dimensions.',
      change: 'Apply output drawing type, line sensitivity, simplification, layer, and export settings.',
      textRule: 'Convert readable source annotations exactly where possible; do not invent unsupported labels.'
    },
    upscale: {
      artifact: 'enhanced source image',
      task: 'Upscale and restore the source image conservatively.',
      keep: 'Preserve source layout, camera, object count, identity, materials, text, signage, and composition.',
      change: 'Improve resolution, clarity, detail, noise, compression artifacts, and optional user-requested finish.',
      textRule: 'Preserve text and signage as source-faithful marks; do not rewrite them.'
    },
    'multi-angle': {
      artifact: 'multi-panel architectural angle study',
      task: 'Show the same building from multiple requested angles.',
      keep: 'Preserve building identity, materials, massing, facade rhythm, openings, scale, and lighting logic across panels.',
      change: 'Change only the camera angle per panel and apply grid/count/distribution settings.',
      textRule: 'Do not add panel labels or annotations unless explicitly requested.'
    },
    'angle-change': {
      artifact: 'new camera-view image',
      task: 'Reshoot the same scene from the requested angle and pitch.',
      keep: 'Preserve design, layout, materials, lighting, people, source identity, and overall style.',
      change: 'Create a new upright camera view with the requested rotation and tilt.',
      textRule: 'Preserve existing text/signage; do not add captions.'
    },
    headshot: {
      artifact: 'professional headshot',
      task: 'Create the requested professional headshot from the reference image.',
      keep: 'Preserve the person identity, facial likeness, age, and natural proportions.',
      change: 'Apply headshot style, background, crop, wardrobe, lighting, and color settings.',
      textRule: 'Do not add visible text or watermarks.'
    }
  };

  return modeIntents[mode as ImagePromptMode] || DEFAULT_PROMPT_INTENT;
};

const compactItems = (items: Array<string | false | null | undefined>): string[] =>
  items
    .filter((item): item is string => Boolean(item && item.trim()))
    .map((item) => item.replace(/\s+/g, ' ').trim());

const describeSettingStrength = (value: number, low: string, medium: string, high: string): string => {
  if (value <= 35) return low;
  if (value >= 70) return high;
  return medium;
};

const describeCanvasPosition = (position: { x: number; y: number }): string => {
  const horizontal = position.x <= 35 ? 'left' : position.x >= 65 ? 'right' : 'center';
  const vertical = position.y <= 35 ? 'upper' : position.y >= 65 ? 'lower' : 'middle';
  return `${vertical}-${horizontal}`;
};

const summarizeChangedChannels = (
  channels: Array<{ name: string; values: number[] }>
): string[] =>
  channels
    .filter((channel) => channel.values.some((value) => value !== 0))
    .map((channel) => channel.name);

const summarizeRenderSettings = (state: AppState): string[] => {
  const { workflow } = state;
  const render = workflow.render3d;
  const renderMode = state.mode === 'render-3d'
    ? (workflow.renderMode === 'enhance' ? 'enhance' : DEFAULT_RENDER_GENERATION_MODE)
    : state.mode === 'render-cad'
      ? DEFAULT_RENDER_GENERATION_MODE
      : workflow.renderMode;
  const render3dSourceMode = workflow.render3dSourceMode || DEFAULT_RENDER3D_SOURCE_MODE;

  if (state.mode === 'render-3d' && render3dSourceMode === 'alter-rendering') {
    return compactItems([
      'render flow alter rendering',
      'use latest render as source',
      'apply settings as restrained refinements'
    ]);
  }

  if (state.mode === 'render-3d' && renderMode === 'enhance') {
    return compactItems([
      'render mode enhance',
      'one-click photorealistic re-render of the existing image'
    ]);
  }

  const lightingSummary = state.mode === 'render-3d'
    ? `lighting ${render.lighting.preset}${render.lighting.sun.enabled ? ', direct sun' : ', no direct sun'}`
    : `lighting ${render.lighting.preset}${render.lighting.sun.enabled ? `, ${describeSettingStrength(render.lighting.sun.intensity, 'soft', 'balanced', 'strong')} sun` : ', no direct sun'}${render.lighting.shadows.enabled ? `, ${describeSettingStrength(render.lighting.shadows.intensity, 'light', 'natural', 'strong')} shadows` : ', soft/no shadows'}`;
  const activeEntourage = compactItems([
    render.scenery.people.enabled ? `people ${describeSettingStrength(render.scenery.people.count, 'sparse', 'balanced', 'busy')}` : null,
    render.scenery.trees.enabled ? `vegetation ${describeSettingStrength(render.scenery.trees.count, 'light', 'moderate', 'lush')}` : null,
    render.scenery.cars.enabled ? 'vehicles included' : null
  ]);

  return compactItems([
    state.mode === 'render-3d' ? `render flow ${render3dSourceMode}` : null,
    `render mode ${renderMode}`,
    `view ${workflow.viewType}, source ${workflow.sourceType}`,
    lightingSummary,
    `ambient ${describeSettingStrength(render.lighting.ambient.intensity, 'low', 'balanced', 'bright')}, occlusion ${describeSettingStrength(render.lighting.ambient.occlusion, 'subtle', 'natural', 'deep')}`,
    `atmosphere ${render.atmosphere.mood}${render.atmosphere.fog.enabled ? `, ${describeSettingStrength(render.atmosphere.fog.density, 'light haze', 'moderate haze', 'dense haze')}` : ''}${render.atmosphere.bloom.enabled ? `, ${describeSettingStrength(render.atmosphere.bloom.intensity, 'subtle bloom', 'balanced bloom', 'strong bloom')}` : ''}`,
    activeEntourage.length ? `context ${render.scenery.preset}; ${activeEntourage.join(', ')}` : `context ${render.scenery.preset}`,
    workflow.styleReferenceEnabled && workflow.styleReferenceImage ? 'style reference enabled' : null,
    workflow.backgroundReferenceEnabled && workflow.backgroundReferenceImage ? 'environment reference enabled' : null,
    `output ${render.render.aspectRatio}, ${render.render.resolution}, ${render.render.viewType}`
  ]);
};

const summarizeVisualEditSettings = (state: AppState): string[] => {
  const { workflow } = state;
  const rawTool = workflow.activeTool;
  const tool = rawTool === 'replace' ? 'object' : rawTool;
  const selectionSummary = workflow.visualSelections.length > 0 || workflow.visualSelectionMask
    ? `selection-guided ${workflow.visualSelection.mode} edit`
    : 'no explicit selection; infer target conservatively';
  const selectionControls = compactItems([
    workflow.visualSelection.featherEnabled ? `feather ${describeSettingStrength(workflow.visualSelection.featherAmount, 'subtle', 'balanced', 'soft')}` : null,
    workflow.visualSelection.strength !== 60 ? `selection strength ${describeSettingStrength(workflow.visualSelection.strength, 'light', 'balanced', 'strong')}` : null,
    workflow.visualSelection.autoTargets.length ? `auto targets ${workflow.visualSelection.autoTargets.join(', ')}` : null
  ]);

  if (tool === 'material') {
    const material = getMaterialById(workflow.visualMaterial.materialId);
    return compactItems([
      selectionSummary,
      ...selectionControls,
      workflow.visualMaterial.referenceEnabled ? 'material from reference image' : `material ${material?.label || workflow.visualMaterial.materialId}`,
      `roughness ${describeSettingStrength(workflow.visualMaterial.roughness, 'polished', 'natural', 'matte')}`,
      workflow.visualMaterial.colorTint && workflow.visualMaterial.colorTint !== '#ffffff' ? `tint ${workflow.visualMaterial.colorTint}` : null
    ]);
  }

  if (tool === 'lighting') {
    const lighting = workflow.visualLighting;
    return compactItems([
      selectionSummary,
      ...selectionControls,
      `lighting mode ${lighting.mode}`,
      lighting.mode === 'sun'
        ? `sun ${describeSettingStrength(lighting.sun.intensity, 'soft', 'balanced', 'strong')}, shadows ${describeSettingStrength(lighting.sun.shadowSoftness, 'crisp', 'natural', 'soft')}`
        : null,
      lighting.mode === 'sun' ? `sun color ${describeSettingStrength(lighting.sun.colorTemp, 'warm', 'neutral', 'cool')}` : null,
      lighting.mode === 'hdri' ? `HDRI ${lighting.hdri.preset}, ${describeSettingStrength(lighting.hdri.intensity, 'subtle', 'balanced', 'strong')} environment` : null,
      lighting.mode === 'artificial' ? `${lighting.artificial.type} artificial light at ${describeCanvasPosition(lighting.artificial.position)}, ${describeSettingStrength(lighting.artificial.intensity, 'soft', 'balanced', 'strong')} intensity, ${describeSettingStrength(lighting.artificial.falloff, 'wide', 'natural', 'tight')} falloff` : null,
      `ambient ${describeSettingStrength(lighting.ambient, 'low', 'balanced', 'bright')}`,
      lighting.preserveShadows ? 'preserve source shadow logic' : null
    ]);
  }

  if (rawTool === 'replace') {
    const replace = workflow.visualReplace;
    return compactItems([
      selectionSummary,
      ...selectionControls,
      `replace mode ${replace.mode}, variation ${describeSettingStrength(replace.variation, 'close match', 'moderate variation', 'strong variation')}`,
      `replacement ${replace.category}, style ${replace.style}`,
      replace.prompt?.trim() ? `custom replacement ${replace.prompt.trim()}` : null,
      replace.matchScale ? 'match source scale' : null,
      replace.matchLighting ? 'match scene lighting' : null,
      replace.preserveShadows ? 'preserve/contact shadows' : null
    ]);
  }

  if (tool === 'object') {
    const object = workflow.visualObject;
    return compactItems([
      selectionSummary,
      ...selectionControls,
      `${object.placementMode} ${object.category}${object.subcategory ? `/${object.subcategory}` : ''}`,
      `depth ${object.depth}, scale ${describeSettingStrength(object.scale, 'small', 'natural', 'large')}`,
      object.rotation ? `rotation ${object.rotation} degrees` : null,
      `position ${describeCanvasPosition(object.position)}`,
      object.autoPerspective ? 'auto-match perspective' : null,
      object.shadow ? 'cast contact shadow' : null,
      object.groundContact ? 'ground object physically' : null
    ]);
  }

  if (tool === 'sky') {
    const sky = workflow.visualSky;
    return compactItems([
      selectionSummary,
      ...selectionControls,
      `sky ${sky.preset}, clouds ${describeSettingStrength(sky.cloudDensity, 'clear', 'partly cloudy', 'cloudy')}`,
      `brightness ${describeSettingStrength(sky.brightness, 'subtle', 'balanced', 'bright')}`,
      `horizon ${sky.horizonLine}, atmosphere ${describeSettingStrength(sky.atmosphere, 'clear', 'light haze', 'atmospheric')}`,
      sky.matchLighting ? 'harmonize scene lighting' : null,
      sky.reflectInGlass ? 'reflect sky in glass' : null,
      sky.sunFlare ? 'include restrained sun flare' : null
    ]);
  }

  if (tool === 'remove') {
    const remove = workflow.visualRemove;
    return compactItems([
      selectionSummary,
      ...selectionControls,
      remove.quickRemove.length ? `targets ${remove.quickRemove.join(', ')}` : null,
      `brush ${describeSettingStrength(remove.brushSize, 'small', 'medium', 'large')}, edge ${describeSettingStrength(remove.hardness, 'soft', 'balanced', 'hard')}`,
      remove.autoDetectEdges ? 'detect object edges' : null,
      remove.preserveStructure ? 'preserve architecture while reconstructing background' : null
    ]);
  }

  if (tool === 'adjust') {
    const adjust = workflow.visualAdjust;
    const toneChanges = summarizeChangedChannels([
      { name: 'exposure', values: [adjust.exposure] },
      { name: 'contrast', values: [adjust.contrast] },
      { name: 'highlights/shadows', values: [adjust.highlights, adjust.shadows] },
      { name: 'white/black point', values: [adjust.whites, adjust.blacks] },
      { name: 'gamma', values: [adjust.gamma] }
    ]);
    const colorChanges = summarizeChangedChannels([
      { name: 'saturation/vibrance', values: [adjust.saturation, adjust.vibrance] },
      { name: 'temperature/tint', values: [adjust.temperature, adjust.tint] },
      { name: 'hue shift', values: [adjust.hueShift] }
    ]);
    const hslChanges = summarizeChangedChannels([
      { name: 'reds', values: [adjust.hslRedsHue, adjust.hslRedsSaturation, adjust.hslRedsLuminance] },
      { name: 'oranges', values: [adjust.hslOrangesHue, adjust.hslOrangesSaturation, adjust.hslOrangesLuminance] },
      { name: 'yellows', values: [adjust.hslYellowsHue, adjust.hslYellowsSaturation, adjust.hslYellowsLuminance] },
      { name: 'greens', values: [adjust.hslGreensHue, adjust.hslGreensSaturation, adjust.hslGreensLuminance] },
      { name: 'aquas', values: [adjust.hslAquasHue, adjust.hslAquasSaturation, adjust.hslAquasLuminance] },
      { name: 'blues', values: [adjust.hslBluesHue, adjust.hslBluesSaturation, adjust.hslBluesLuminance] },
      { name: 'purples', values: [adjust.hslPurplesHue, adjust.hslPurplesSaturation, adjust.hslPurplesLuminance] },
      { name: 'magentas', values: [adjust.hslMagentasHue, adjust.hslMagentasSaturation, adjust.hslMagentasLuminance] }
    ]);
    const gradeChanges = summarizeChangedChannels([
      { name: 'shadow grade', values: [adjust.colorGradeShadowsHue, adjust.colorGradeShadowsSaturation] },
      { name: 'midtone grade', values: [adjust.colorGradeMidtonesHue, adjust.colorGradeMidtonesSaturation] },
      { name: 'highlight grade', values: [adjust.colorGradeHighlightsHue, adjust.colorGradeHighlightsSaturation] },
      { name: 'grade balance', values: [adjust.colorGradeBalance] }
    ]);
    return compactItems([
      selectionSummary,
      ...selectionControls,
      adjust.aspectRatio !== 'same' ? `target aspect ${adjust.aspectRatio}` : 'same aspect ratio',
      toneChanges.length ? `tone ${toneChanges.join(', ')}` : null,
      colorChanges.length ? `color ${colorChanges.join(', ')}` : null,
      `detail clarity ${describeSettingStrength(Math.abs(adjust.clarity), 'gentle', 'balanced', 'strong')}, sharpness ${describeSettingStrength(Math.abs(adjust.sharpness), 'gentle', 'balanced', 'strong')}, noise cleanup ${describeSettingStrength(Math.max(Math.abs(adjust.noiseReduction), Math.abs(adjust.noiseReductionColor)), 'light', 'balanced', 'strong')}`,
      hslChanges.length ? `selective color ${hslChanges.join(', ')}` : null,
      gradeChanges.length ? `color grade ${gradeChanges.join(', ')}` : null,
      adjust.vignette || adjust.grain || adjust.bloom || adjust.chromaticAberration ? `effects ${compactItems([
        adjust.vignette ? 'vignette' : null,
        adjust.grain ? 'grain' : null,
        adjust.bloom ? 'bloom' : null,
        adjust.chromaticAberration ? 'chromatic edge' : null
      ]).join(', ')}` : null,
      adjust.styleStrength !== 50 ? `global adjustment strength ${adjust.styleStrength}` : null,
      adjust.transformRotate || adjust.transformHorizontal || adjust.transformVertical || adjust.transformPerspective
        ? 'geometry transform requested'
        : null
    ]);
  }

  if (tool === 'extend') {
    const extend = workflow.visualExtend;
    return compactItems([
      `extend ${extend.direction}`,
      `amount ${describeSettingStrength(extend.amount, 'slight', 'moderate', 'large')}`,
      `target aspect ${extend.targetAspectRatio === 'custom' ? `${extend.customRatio.width}:${extend.customRatio.height}` : extend.targetAspectRatio}`
    ]);
  }

  if (tool === 'background') {
    const background = workflow.visualBackground;
    return compactItems([
      selectionSummary,
      ...selectionControls,
      `background mode ${background.mode}`,
      background.mode === 'image' ? `reference ${background.referenceMode}` : `prompt background ${background.prompt || 'from user direction'}`,
      background.matchPerspective ? 'match perspective' : null,
      background.matchLighting ? 'match lighting' : null,
      background.seamlessBlend ? 'seamless blend' : null,
      background.preserveDepth ? 'preserve depth relationships' : null,
      `quality ${background.quality}`
    ]);
  }

  if (tool === 'people') {
    const people = workflow.visualPeople;
    const peopleMode = people.mode === 'automatic' || people.mode === 'repopulate' ? people.mode : 'enhance';
    if (peopleMode === 'enhance') {
      return compactItems([
        selectionSummary,
        ...selectionControls,
        'people mode enhance',
        're-render existing 3D people as realistic humans',
        'preserve existing pose, placement, scale, count, lighting, perspective, ground contact, and immediate accessories',
        'fix low-poly faces, hands, silhouettes, clothing, and render artifacts'
      ]);
    }
    if (peopleMode === 'automatic') {
      return compactItems([
        selectionSummary,
        ...selectionControls,
        'people mode automatic',
        'analyze current image context and existing people',
        'infer zone, density, scale, flow, demographics, wardrobe, luggage, staff presence, lighting, and perspective automatically',
        'add or refine only context-appropriate people on walkable or occupiable areas',
        'preserve architecture, materials, camera, signage, and composition; avoid overcrowding'
      ]);
    }
    const staffTypes = compactItems([
      people.includeAirportStaff ? 'airport staff' : null,
      people.includeSecurityPersonnel ? 'security' : null,
      people.includeAirlineCrew ? 'airline crew' : null,
      people.includeGroundCrew ? 'ground crew' : null,
      people.includeServiceStaff ? 'service staff' : null
    ]);
    return compactItems([
      selectionSummary,
      ...selectionControls,
      `people mode ${peopleMode}, airport zone ${people.airportZone}`,
      `demographics ${people.ageDistribution}, ${people.genderBalance}, regions ${people.regionMix.slice(0, 4).join(', ') || 'mixed'}`,
      `diversity children ${describeSettingStrength(people.childrenPresence, 'few', 'some', 'many')}, body variety ${describeSettingStrength(people.bodyTypeVariety, 'low', 'moderate', 'high')}`,
      `density ${describeSettingStrength(people.density, 'sparse', 'balanced', 'crowded')}, flow ${people.flowPattern}`,
      `movement ${people.movementDirection}, pace ${people.paceOfMovement}, grouping ${people.grouping}, clustering ${describeSettingStrength(people.clusteringTendency, 'spread out', 'natural clusters', 'clustered')}`,
      `wardrobe ${people.wardrobeStyle}, season ${people.seasonalClothing}, formality ${describeSettingStrength(people.formalityLevel, 'casual', 'smart-casual', 'formal')}`,
      people.activities.length ? `activities ${people.activities.join(', ')}` : null,
      people.luggageTypes.length ? `luggage ${people.luggageTypes.join(', ')}, amount ${describeSettingStrength(people.luggageAmount, 'light', 'moderate', 'heavy')}` : null,
      people.trolleyUsage || people.personalDevices || people.travelAccessories ? `accessories trolleys ${describeSettingStrength(people.trolleyUsage, 'few', 'some', 'many')}, devices ${describeSettingStrength(people.personalDevices, 'few', 'some', 'many')}` : null,
      staffTypes.length ? `staff ${staffTypes.join(', ')}, density ${describeSettingStrength(people.staffDensity, 'few', 'some', 'many')}` : null,
      `quality realism ${describeSettingStrength(people.realism, 'stylized', 'natural', 'high')}, scale ${describeSettingStrength(people.scaleAccuracy, 'loose', 'balanced', 'strict')}, placement ${describeSettingStrength(people.placementDiscipline, 'loose', 'balanced', 'strict')}`,
      people.motionBlur ? `motion blur ${describeSettingStrength(people.motionBlur, 'subtle', 'moderate', 'noticeable')}` : null,
      people.preserveExisting ? 'preserve existing people where possible' : null,
      people.matchLighting ? 'match lighting' : null,
      people.matchPerspective ? 'match perspective' : null,
      people.groundContact ? 'ground every figure' : null,
      people.removeArtifacts ? 'remove people artifacts' : null
    ]);
  }

  return compactItems([
    selectionSummary,
    workflow.visualReferenceImage ? 'general reference image attached' : null,
    workflow.visualPrompt ? `instruction ${workflow.visualPrompt}` : null
  ]);
};

const summarizeWorkflowSettings = (state: AppState): string[] => {
  const { workflow } = state;

  if (state.mode === 'render-3d') return summarizeRenderSettings(state);
  if (state.mode === 'render-cad') {
    const materialAssignments = Object.entries(workflow.cadMaterialAssignments || {})
      .slice(0, 3)
      .map(([target, material]) => `${target}=${material}`);
    return compactItems([
      `CAD ${workflow.cadDrawingType}${workflow.cadScale ? `, scale ${workflow.cadScale}` : ''}, orientation ${workflow.cadOrientation}`,
      `space ${workflow.cadSpace.roomType}, ${workflow.cadSpace.ceilingStyle} ceiling, ${workflow.cadSpace.windowStyle} windows, ${workflow.cadSpace.doorStyle} doors`,
      `spatial assumptions ${describeSettingStrength(workflow.cadSpatial.style, 'conservative', 'balanced', 'creative')}, ${workflow.cadSpatial.ceilingHeight < 2.7 ? 'low ceiling' : workflow.cadSpatial.ceilingHeight > 3.4 ? 'tall ceiling' : 'typical ceiling'}`,
      `camera ${workflow.cadCamera.angle}, look ${workflow.cadCamera.lookAt}, ${workflow.cadCamera.focalLength < 28 ? 'wide lens' : workflow.cadCamera.focalLength > 60 ? 'compressed lens' : 'natural lens'}${workflow.cadCamera.verticalCorrection ? ', corrected verticals' : ''}`,
      `furnishing ${workflow.cadFurnishing.auto ? 'auto' : 'manual'} ${workflow.cadFurnishing.occupancy}, density ${describeSettingStrength(workflow.cadFurnishing.density, 'sparse', 'balanced', 'full')}, clutter ${describeSettingStrength(workflow.cadFurnishing.clutter, 'clean', 'styled', 'lived-in')}`,
      workflow.cadFurnishing.styles.length ? `furniture styles ${workflow.cadFurnishing.styles.join(', ')}` : null,
      workflow.cadFurnishing.people ? `people/entourage ${describeSettingStrength(workflow.cadFurnishing.entourage, 'light', 'balanced', 'busy')}` : null,
      materialAssignments.length ? `materials ${materialAssignments.join(', ')}` : null,
      `context ${workflow.cadContext.environment}, ${workflow.cadContext.season}, ${workflow.cadContext.landscape} landscape`,
      ...summarizeRenderSettings(state)
    ]);
  }
  if (state.mode === 'render-sketch') {
    const preserve = compactItems([
      workflow.sketchPreserveOutline ? 'outline' : null,
      workflow.sketchPreserveOpenings ? 'openings' : null,
      workflow.sketchPreserveRoof ? 'roof' : null,
      workflow.sketchPreserveFloors ? 'floors' : null,
      workflow.sketchPreserveProportions ? 'proportions' : null
    ]);
    return compactItems([
      `sketch ${workflow.sketchType}, perspective ${workflow.sketchPerspectiveType}`,
      `analysis auto ${formatToggle(workflow.sketchAutoDetect)}, cleanup ${workflow.sketchCleanupIntensity}, line weight ${workflow.sketchLineWeight}`,
      `line processing enhance faint ${formatToggle(workflow.sketchEnhanceFaint)}, connect ${formatToggle(workflow.sketchConnectLines)}, straighten ${formatToggle(workflow.sketchStraighten)}, remove construction ${formatToggle(workflow.sketchRemoveConstruction)}`,
      `line quality ${describeSettingStrength(workflow.sketchLineQuality, 'rough', 'readable', 'clean')}, completeness ${describeSettingStrength(workflow.sketchCompleteness, 'sparse', 'partial', 'complete')}`,
      `view horizon ${workflow.sketchHorizonLine}, camera ${workflow.sketchCameraHeight}${workflow.sketchPerspectiveCorrect ? `, perspective correction ${describeSettingStrength(workflow.sketchPerspectiveStrength, 'subtle', 'balanced', 'strong')}` : ''}${workflow.sketchFixVerticals ? ', fix verticals' : ''}`,
      `interpretation ${describeSettingStrength(workflow.sketchInterpretation, 'conservative', 'balanced', 'creative')}`,
      `ambiguity ${workflow.sketchAmbiguityMode}`,
      preserve.length ? `preserve ${preserve.join(', ')}` : null,
      workflow.sketchAllowDetails || workflow.sketchAllowMaterials || workflow.sketchAllowEntourage || workflow.sketchAllowExtend ? `allowed additions ${compactItems([
        workflow.sketchAllowDetails ? 'details' : null,
        workflow.sketchAllowMaterials ? 'materials' : null,
        workflow.sketchAllowEntourage ? 'entourage' : null,
        workflow.sketchAllowExtend ? 'extend scene' : null
      ]).join(', ')}` : null,
      workflow.sketchRefs.length ? `${workflow.sketchRefs.length} ${workflow.sketchRefType} reference image${workflow.sketchRefs.length === 1 ? '' : 's'}, influence ${describeSettingStrength(workflow.sketchRefInfluence, 'light', 'balanced', 'strong')}` : null,
      `palette ${workflow.sketchMaterialPalette}, mood ${workflow.sketchMoodPreset}`,
      ...summarizeRenderSettings(state)
    ]);
  }
  if (state.mode === 'scene-compose') {
    const references = workflow.sceneInsertionReferences || [];
    const placed = references.filter((reference) => reference.placement).length;
    return compactItems([
      `base ${workflow.viewType} scene from ${workflow.sourceType}`,
      `${references.length} insertion reference${references.length === 1 ? '' : 's'}, ${placed} pinned placement${placed === 1 ? '' : 's'}`,
      workflow.styleReferenceEnabled && workflow.styleReferenceImage ? 'style reference enabled' : null,
      workflow.backgroundReferenceEnabled && workflow.backgroundReferenceImage ? 'environment reference enabled' : null
    ]);
  }
  if (state.mode === 'masterplan') {
    const annotations = compactItems([
      workflow.mpAnnotations.zoneLabels ? 'zone labels' : null,
      workflow.mpAnnotations.streetNames ? 'street names' : null,
      workflow.mpAnnotations.buildingLabels ? 'building labels' : null,
      workflow.mpAnnotations.scaleBar ? 'scale bar' : null,
      workflow.mpAnnotations.northArrow ? 'north arrow' : null,
      workflow.mpAnnotations.dimensions ? 'dimensions' : null
    ]);
    return compactItems([
      `plan ${workflow.mpPlanType}, style ${workflow.mpOutputStyle}, view ${workflow.mpViewAngle}`,
      `scale ${workflow.mpScale === 'custom' ? `1:${workflow.mpCustomScale}` : workflow.mpScale}, north ${Math.round(workflow.mpNorthRotation)} degrees, zones ${workflow.mpZoneDetection}/${workflow.mpZones.length}`,
      `boundary ${workflow.mpBoundary.mode}${workflow.mpBoundary.mode === 'custom' ? `/${workflow.mpBoundary.points.length} points` : ''}`,
      workflow.mpContext.location ? `location ${workflow.mpContext.location}, radius ${workflow.mpContext.radius}m` : null,
      workflow.mpContext.loadedData ? `context data buildings ${workflow.mpContext.loadedData.buildings}, roads ${workflow.mpContext.loadedData.roads}, water ${workflow.mpContext.loadedData.water}, transit ${workflow.mpContext.loadedData.transit}` : `context layers ${compactItems([
        workflow.mpContext.loadBuildings ? 'buildings' : null,
        workflow.mpContext.loadRoads ? 'roads' : null,
        workflow.mpContext.loadWater ? 'water' : null,
        workflow.mpContext.loadTerrain ? 'terrain' : null,
        workflow.mpContext.loadTransit ? 'transit' : null
      ]).join(', ') || 'none'}`,
      `buildings ${workflow.mpBuildings.style}, heights ${workflow.mpBuildings.heightMode}, roof ${workflow.mpBuildings.roofStyle}${workflow.mpBuildings.showShadows ? ', shadows' : ''}${workflow.mpBuildings.transparent ? ', ghosted massing' : ''}${workflow.mpBuildings.facadeVariation ? ', facade variation' : ''}`,
      workflow.mpBuildings.showFloorLabels ? 'building floor labels enabled' : null,
      `landscape ${workflow.mpLandscape.vegetationStyle}, ${workflow.mpLandscape.season}, density ${describeSettingStrength(workflow.mpLandscape.vegetationDensity, 'minimal', 'balanced', 'lush')}, tree variation ${describeSettingStrength(workflow.mpLandscape.treeVariation, 'regular', 'varied', 'diverse')}`,
      `site elements ${compactItems([
        workflow.mpLandscape.trees ? 'trees' : null,
        workflow.mpLandscape.grass ? 'grass' : null,
        workflow.mpLandscape.water ? 'water' : null,
        workflow.mpLandscape.pathways ? 'paths' : null,
        workflow.mpLandscape.streetFurniture ? 'street furniture' : null,
        workflow.mpLandscape.vehicles ? 'vehicles' : null,
        workflow.mpLandscape.people ? 'people' : null
      ]).join(', ') || 'minimal'}`,
      annotations.length ? `annotations ${annotations.join(', ')}, ${workflow.mpAnnotations.labelStyle}/${workflow.mpAnnotations.labelSize}/${workflow.mpAnnotations.labelColor}${workflow.mpAnnotations.labelHalo ? '/halo' : ''}` : 'no new labels unless source requires them',
      workflow.mpLegend.include ? `legend ${workflow.mpLegend.position}, ${workflow.mpLegend.style}, content ${compactItems([
        workflow.mpLegend.showZones ? 'zones' : null,
        workflow.mpLegend.showZoneAreas ? 'areas' : null,
        workflow.mpLegend.showBuildings ? 'buildings' : null,
        workflow.mpLegend.showLandscape ? 'landscape' : null,
        workflow.mpLegend.showInfrastructure ? 'infrastructure' : null
      ]).join(', ') || 'minimal'}` : null,
      `export ${workflow.mpExport.resolution}, ${workflow.mpExport.format}${workflow.mpExport.exportLayers ? ', layers' : ''}${workflow.mpExport.cadCompatible ? ', CAD hierarchy' : ''}${workflow.mpExport.includeSketch ? ', include sketch' : ''}`
    ]);
  }
  if (state.mode === 'exploded') {
    const activeComponents = workflow.explodedComponents.filter((component) => component.active);
    const annotations = compactItems([
      workflow.explodedAnnotations.labels ? 'labels' : null,
      workflow.explodedAnnotations.leaders ? 'leaders' : null,
      workflow.explodedAnnotations.dimensions ? 'dimensions' : null,
      workflow.explodedAnnotations.assemblyNumbers ? 'assembly numbers' : null,
      workflow.explodedAnnotations.materialCallouts ? 'material callouts' : null
    ]);
    return compactItems([
      `source ${workflow.explodedSource.type}, detection ${workflow.explodedDetection}, components ${activeComponents.length || workflow.explodedSource.componentCount}`,
      `explode ${workflow.explodedDirection}, separation ${describeSettingStrength(workflow.explodedView.separation, 'tight', 'clear', 'wide')}`,
      `view ${workflow.explodedView.type}/${workflow.explodedView.angle}, camera ${workflow.explodedView.cameraHeight < 5 ? 'low' : workflow.explodedView.cameraHeight < 15 ? 'eye-level' : 'elevated'}, look ${workflow.explodedView.lookAt}`,
      workflow.explodedDirection === 'custom' ? `axis x${workflow.explodedAxis.x} y${workflow.explodedAxis.y} z${workflow.explodedAxis.z}` : null,
      `diagram style ${workflow.explodedStyle.render}, color ${workflow.explodedStyle.colorMode}, edges ${workflow.explodedStyle.edgeStyle}, line ${describeSettingStrength(workflow.explodedStyle.lineWeight, 'thin', 'balanced', 'heavy')}`,
      annotations.length ? `annotations ${annotations.join(', ')}, ${workflow.explodedAnnotations.labelStyle}/${workflow.explodedAnnotations.fontSize}/${workflow.explodedAnnotations.leaderStyle}` : 'no new labels',
      workflow.explodedAnim.generate ? `animation intent ${workflow.explodedAnim.type}, ${workflow.explodedAnim.easing}` : null,
      `output ${workflow.explodedOutput.resolution}, background ${workflow.explodedOutput.background}${workflow.explodedOutput.groundPlane ? ', ground plane' : ''}${workflow.explodedOutput.shadow ? ', shadows' : ''}${workflow.explodedOutput.grid ? ', grid' : ''}${workflow.explodedOutput.exportLayers ? ', layers' : ''}`
    ]);
  }
  if (state.mode === 'section') {
    const programAnnotations = compactItems([
      workflow.sectionProgram.labels ? 'space labels' : null,
      workflow.sectionProgram.leaderLines ? 'leader lines' : null,
      workflow.sectionProgram.areaTags ? 'area tags' : null
    ]);
    return compactItems([
      `cut ${workflow.sectionCut.type}, plane ${workflow.sectionCut.plane}, direction ${workflow.sectionCut.direction}, depth ${describeSettingStrength(workflow.sectionCut.depth, 'shallow', 'primary spaces', 'deep')}`,
      `area detection ${workflow.sectionAreaDetection}`,
      `reveal ${workflow.sectionReveal.style}, focus ${workflow.sectionReveal.focus}, facade ${describeSettingStrength(workflow.sectionReveal.facadeOpacity, 'ghosted', 'translucent', 'opaque')}, depth fade ${describeSettingStrength(workflow.sectionReveal.depthFade, 'subtle', 'balanced', 'strong')}`,
      `style poché ${workflow.sectionStyle.poche}, hatch ${workflow.sectionStyle.hatch}, weight ${workflow.sectionStyle.weight}, beyond ${describeSettingStrength(workflow.sectionStyle.showBeyond, 'minimal', 'balanced', 'deep')}`,
      workflow.sectionAreas.filter((area) => area.active).length ? `${workflow.sectionAreas.filter((area) => area.active).length} highlighted section area${workflow.sectionAreas.filter((area) => area.active).length === 1 ? '' : 's'}` : null,
      programAnnotations.length ? `annotations ${programAnnotations.join(', ')}, ${workflow.sectionProgram.labelStyle}/${workflow.sectionProgram.fontSize}` : 'no new labels',
      `program color ${workflow.sectionProgram.colorMode}, show beyond ${workflow.sectionStyle.showBeyond}`
    ]);
  }
  if (state.mode === 'visual-edit') return summarizeVisualEditSettings(state);
  if (state.mode === 'upscale') {
    return compactItems([
      `upscale ${workflow.upscaleFactor}`,
      `sharpness ${describeSettingStrength(workflow.upscaleSharpness, 'soft', 'balanced', 'crisp')}`,
      `clarity ${describeSettingStrength(workflow.upscaleClarity, 'gentle', 'balanced', 'strong')}`,
      `edge definition ${describeSettingStrength(workflow.upscaleEdgeDefinition, 'soft', 'balanced', 'defined')}`,
      `fine detail ${describeSettingStrength(workflow.upscaleFineDetail, 'restrained', 'balanced', 'enhanced')}`,
      `format ${workflow.upscaleFormat}${workflow.upscalePreserveMetadata ? ', preserve metadata' : ''}`,
      workflow.upscaleBatch.length ? `batch ${workflow.upscaleBatch.length} image${workflow.upscaleBatch.length === 1 ? '' : 's'}` : null
    ]);
  }
  if (state.mode === 'multi-angle') {
    return compactItems([
      `preset ${workflow.multiAnglePreset}, views ${workflow.multiAngleViewCount}, ${workflow.multiAngleDistribution} distribution`,
      `azimuth ${workflow.multiAngleAzimuthRange[0]} to ${workflow.multiAngleAzimuthRange[1]} degrees`,
      `elevation ${workflow.multiAngleElevationRange[0]} to ${workflow.multiAngleElevationRange[1]} degrees`,
      workflow.multiAngleDistribution === 'manual' && workflow.multiAngleAngles.length ? `manual angles ${workflow.multiAngleAngles.slice(0, 6).map((angle) => `${angle.azimuth}/${angle.elevation}`).join(', ')}` : null,
      workflow.multiAngleLockConsistency ? 'lock identity/material consistency' : null
    ]);
  }
  if (state.mode === 'angle-change') {
    return compactItems([
      `rotate ${Math.round(workflow.angleChangeDegrees)} degrees`,
      `pitch ${Math.round(workflow.angleChangePitch)} degrees`
    ]);
  }
  if (state.mode === 'img-to-cad') {
    const layers = compactItems([
      workflow.imgToCadLayers.walls ? 'walls' : null,
      workflow.imgToCadLayers.windows ? 'windows' : null,
      workflow.imgToCadLayers.details ? 'details' : null,
      workflow.imgToCadLayers.hidden ? 'hidden lines' : null
    ]);
    return compactItems([
      `source ${workflow.imgToCadType}, output ${workflow.imgToCadOutput}`,
      `line sensitivity ${workflow.imgToCadLine.sensitivity}, simplification ${workflow.imgToCadLine.simplify}, connect gaps ${formatToggle(workflow.imgToCadLine.connect)}`,
      layers.length ? `layers ${layers.join(', ')}` : null,
      `format ${workflow.imgToCadFormat.toUpperCase()}`
    ]);
  }
  if (state.mode === 'headshot') {
    const headshot = workflow.headshot;
    return compactItems([
      `style ${headshot.style}, purpose ${headshot.purpose}`,
      `tone ${headshot.tone}, color ${headshot.colorMode}`,
      headshot.style === 'professional' ? `background ${headshot.background}` : `website role ${headshot.role || 'unspecified'}, facing ${headshot.facing}`,
      `quality ${headshot.quality}`,
      `references ${compactItems([
        headshot.frontImage ? 'front' : null,
        headshot.leftImage ? 'left' : null,
        headshot.rightImage ? 'right' : null
      ]).join(', ') || 'single/current'}`
    ]);
  }
  if (state.mode === 'generate-text') {
    return compactItems([
      state.prompt?.trim() ? 'user prompt is the primary brief' : null,
      workflow.textPrompt?.trim() ? 'workflow text prompt is the primary brief' : null
    ]);
  }

  return [];
};

const getModelSpecificGuidance = (
  state: AppState,
  model: ImageGenerationModel,
  promptKind?: ImagePromptAdapterOptions['promptKind']
): string[] => {
  const mode = state.mode;
  const tool = state.workflow.activeTool === 'replace' ? 'object' : state.workflow.activeTool;
  const isDiagramMode = mode === 'masterplan' || mode === 'exploded' || mode === 'section' || mode === 'img-to-cad';
  const isSourceMode = mode !== 'generate-text' && mode !== 'headshot';
  const isEditMode = mode === 'visual-edit' || mode === 'upscale' || mode === 'angle-change';
  const toolKey = String(tool || 'select');

  const gptModeGuidance: Partial<Record<ImagePromptMode, string[]>> = {
    'generate-text': [
      'Describe the final artifact as a composed image with subject, setting, layout, lighting, and style.',
      'For posters, UI, slides, maps, labels, or infographics, treat text as layout content with exact quoted spelling.'
    ],
    'render-3d': [
      'Read the source as a 3D/model capture; preserve massing, facade rhythm, openings, camera, and scale before applying render polish.',
      'Group changes into lighting, atmosphere, material finish, entourage, and output format; do not let style rewrite the building.'
    ],
    'render-cad': [
      'Read the drawing as geometry and hierarchy first; preserve orientation, line relationships, labels, walls, openings, and dimensions.',
      'Convert drawing conventions into spatial visualization only where settings request it; keep technical text exact.'
    ],
    'render-sketch': [
      'Use the sketch as a layout and perspective scaffold; resolve ambiguity conservatively unless settings request creative interpretation.',
      'Preserve major strokes, silhouette, openings, roof, floor datums, and viewpoint before adding materials or lighting.'
    ],
    'scene-compose': [
      'Treat the base image as the locked scene and each later image as a role-specific reference.',
      'Use placement pins as spatial guidance only; never render pins, callouts, UI marks, or reference-frame artifacts.'
    ],
    masterplan: [
      'Preserve source plan geometry, north logic, boundaries, parcels, roads, water, footprints, legend, and existing labels.',
      'Keep new labels minimal, exact, aligned, and tied to annotation settings.'
    ],
    exploded: [
      'Preserve component identity and alignment while separating parts; show assembly logic through spacing, hierarchy, edge style, and optional labels.',
      'Avoid decorative scatter: every offset should explain a system, layer, or assembly sequence.'
    ],
    section: [
      'Keep cut plane, floor datums, projection logic, structural grid, and source labels coherent.',
      'Make poche, hatching, depth fade, program color, and labels support section readability rather than illustration noise.'
    ],
    'img-to-cad': [
      'Convert visible evidence into a clean technical drawing; do not invent hidden rooms, openings, dimensions, or labels.',
      'Prioritize line hierarchy, continuous polylines, orthographic correction, and exact readable source annotations.'
    ],
    upscale: [
      'Treat this as restoration, not re-generation: sharpen and de-noise only evidence already visible in the source.',
      'Do not fabricate readable letters, faces, material seams, plants, people, or architectural details from blur.'
    ],
    'multi-angle': [
      'Keep all panels as one controlled study: same building identity, materials, scale, light logic, and output style.',
      'Only camera orbit and pitch may change; no panel labels unless explicitly requested.'
    ],
    'angle-change': [
      'Create a new upright camera view of the same scene instead of rotating or stretching the source bitmap.',
      'Preserve design identity, layout, people, materials, light mood, and text/signage shapes.'
    ],
    headshot: [
      'Identity fidelity outranks styling; preserve face shape, age, skin tone, hairline, distinctive features, and natural proportions.',
      'Apply only the requested wardrobe, crop, background, lighting, website context, and polish.'
    ]
  };

  const nanoModeGuidance: Partial<Record<ImagePromptMode, string[]>> = {
    'generate-text': [
      'Use one natural descriptive paragraph: subject, setting, composition, lighting, style, and any exact text.',
      'For stickers, icons, or assets, request a white background because this model does not output real transparency.'
    ],
    'render-3d': [
      'State the source-to-render transformation plainly and keep the source architecture as the anchor.',
      'Avoid dense camera math; describe the desired view, light, atmosphere, and material mood in ordinary language.'
    ],
    'render-cad': [
      'Say what the drawing should become, then name the few drawing facts that must stay fixed.',
      'Keep labels and dimensions source-faithful; do not ask for unsupported hidden information.'
    ],
    'render-sketch': [
      'Use the sketch as a coherent visual brief rather than a line-by-line checklist.',
      'Name only the key preserved sketch facts: viewpoint, silhouette, proportions, openings, and major line positions.'
    ],
    'scene-compose': [
      'Explain the relationship between the base scene and each reference in simple terms.',
      'Ask for natural integration with matching scale, occlusion, contact shadows, and lighting instead of collage-like copying.'
    ],
    masterplan: [
      'Ask for simple graphic clarity and plan hierarchy, not dense annotation.',
      'Use source labels only when readable and add new labels only when settings request them.'
    ],
    exploded: [
      'Describe the assembly separation as a clear visual explanation with simple component hierarchy.',
      'Keep labels sparse and avoid requesting tiny text-heavy callouts.'
    ],
    section: [
      'Describe the section cut and reveal style as one readable diagram.',
      'Favor clear poche, depth, and program hierarchy over many labels or small details.'
    ],
    'img-to-cad': [
      'Ask for a clean CAD-style drawing based only on visible evidence.',
      'Favor simple line hierarchy and exact visible annotations over speculative detail.'
    ],
    upscale: [
      'Ask for faithful restoration in plain language: cleaner, sharper, less noisy, same image.',
      'Tell the model to leave ambiguous or tiny areas slightly soft rather than inventing detail.'
    ],
    'multi-angle': [
      'Ask for a clean unlabeled grid of the same building from different camera angles.',
      'Repeat that identity, materials, scale, and light should stay consistent across every panel.'
    ],
    'angle-change': [
      'Ask for a new view of the same place, not a rotated existing image.',
      'Name the requested turn and tilt in simple camera language.'
    ],
    headshot: [
      'Ask for a natural professional portrait while keeping the person recognizable.',
      'Keep styling requests simple: crop, background, wardrobe, lighting, and purpose.'
    ]
  };

  const gptToolGuidance: Record<string, string[]> = {
    select: [
      'The selection/mask identifies the intended target; use it as guidance, not as a hard clipping boundary.',
      'Blend naturally beyond the drawn edge when needed and never draw mask edges, outlines, or white patches.'
    ],
    material: [
      'Treat material edits as surface-finish replacement on existing geometry: color, grain, texture scale, roughness, and reflectivity only.',
      'Preserve seams, joints, UV direction, object edges, reflections, and adjacent materials.'
    ],
    lighting: [
      'Relight the existing scene without changing objects, sky, geometry, materials, camera, or text.',
      'Apply light direction, color temperature, shadow softness, and ambient fill as the visible change set.'
    ],
    object: [
      'Insert or replace only the specified object with correct scale, perspective, occlusion, grounding, and contact shadow.',
      'Do not use reference backgrounds or unrelated reference objects as scene content.'
    ],
    sky: [
      'Replace sky and atmosphere only, preserving silhouettes, buildings, ground, people, signage, and horizon logic.',
      'Harmonize reflections and scene light only as needed to match the new sky.'
    ],
    remove: [
      'Remove the whole selected or named target, including attached accessories, shadows, and reflections.',
      'Reconstruct the revealed background from surrounding evidence without simplifying unrelated content.'
    ],
    adjust: [
      'Treat every slider as post-production, not content generation.',
      'Apply tone, color, detail, and geometry adjustments without adding, removing, or relocating scene elements.'
    ],
    extend: [
      'Outpaint only the new canvas area; preserve original pixels unchanged.',
      'Continue perspective, material boundaries, lighting, shadows, reflections, and text fragments only when they physically reach the edge.'
    ],
    background: [
      'Keep protected selection pixels untouched and replace only the surrounding background.',
      'Match perspective, horizon, color grade, depth cues, and lighting so the foreground and new background read as one photograph.'
    ],
    people: [
      'Change only human figures and immediate personal accessories.',
      'Preserve architecture, signage, vehicles, landscaping, materials, camera, and composition.'
    ]
  };

  const nanoToolGuidance: Record<string, string[]> = {
    select: [
      'Make one clear target-area edit guided by the selection and preserve unrelated scene content.',
      'Describe the intended target plainly; avoid hard selection edges, labels, outlines, or mask artifacts.'
    ],
    material: [
      'Describe the desired material finish in natural language and keep the existing shape unchanged.',
      'Ask for matching light and reflections without changing nearby surfaces.'
    ],
    lighting: [
      'Describe the new light mood and direction in simple scene terms.',
      'Keep the scene itself unchanged except for light, shadows, reflections, and color temperature.'
    ],
    object: [
      'Describe the object to add or replace and where it belongs in the scene.',
      'Ask for natural scale, contact, shadow, and occlusion rather than many numeric placement details.'
    ],
    sky: [
      'Describe the desired sky and mood while preserving the building silhouette and foreground.',
      'Ask for scene light to harmonize gently with the new sky.'
    ],
    remove: [
      'Say exactly what should disappear and ask for natural reconstruction from nearby content.',
      'Keep all unrelated objects and architecture unchanged.'
    ],
    adjust: [
      'Summarize color and tone changes in simple words while preserving content.',
      'Avoid treating slider numbers as permission to redraw or restyle the scene.'
    ],
    extend: [
      'Ask for a natural continuation of the scene beyond the edge.',
      'Keep original image content unchanged and continue perspective, light, and materials.'
    ],
    background: [
      'Describe the new background as a believable environment around the protected foreground.',
      'Keep the protected subject unchanged and blend with matching horizon, light, and color.'
    ],
    people: [
      'Describe the people edit as one focused human-figure task.',
      'Keep the architectural scene and all non-people content anchored to the source.'
    ]
  };

  if (model === 'chatgpt-image-generation-2') {
    return compactItems([
      'Use a structured artifact plan: preserve/source constraints first, then visible changes, then style and quality.',
      ...(gptModeGuidance[mode] || []),
      ...(mode === 'visual-edit' ? gptToolGuidance[toolKey] || [] : []),
      isDiagramMode ? 'For diagrams, prioritize readable hierarchy, clean alignment, exact requested labels, and no invented annotation text.' : null,
      mode === 'generate-text' ? 'If the request is poster, UI, slide, map, label, or infographic-like, treat text as a first-class layout element with exact spelling.' : null,
      isEditMode ? 'For edits, split the job mentally into Change and Preserve; do not reinterpret untouched regions.' : null,
      mode === 'scene-compose' ? 'Treat each reference image as a role-specific source; never blend unrelated reference background or framing into the base scene.' : null,
      mode === 'multi-angle' || promptKind === 'grid' ? 'Keep all panels consistent as a single designed study; only camera position changes between panels.' : null,
      mode === 'headshot' ? 'Identity fidelity outranks styling; preserve face shape, age, expression realism, and natural proportions.' : null
    ]);
  }

  return compactItems([
    'Use natural language and one coherent visual goal; treat settings as intent cues, not a keyword checklist.',
    ...(nanoModeGuidance[mode] || []),
    ...(mode === 'visual-edit' ? nanoToolGuidance[toolKey] || [] : []),
    isSourceMode ? 'Keep the source image as the visual anchor and make only the requested transformation.' : null,
    isDiagramMode ? 'Prefer simple graphic clarity over dense text; use labels only when the feature settings request them.' : null,
    mode === 'generate-text' ? 'Avoid over-specifying camera math; describe the scene, subject, context, lighting, and mood in plain language.' : null,
    mode === 'visual-edit' ? `Make a single ${tool} edit and preserve everything outside the tool scope.` : null,
    mode === 'scene-compose' ? 'Insert referenced objects by relationship and placement; avoid collage-like copying.' : null,
    mode === 'upscale' ? 'Restore existing evidence; do not sharpen by inventing new architecture, people, or text.' : null,
    mode === 'multi-angle' || promptKind === 'grid' ? 'Keep the grid clean and unlabeled; maintain the same building identity across every view.' : null,
    mode === 'headshot' ? 'Keep the person recognizable and natural; avoid beauty-filter drift.' : null
  ]);
};

const normalizePromptWhitespace = (prompt: string): string =>
  prompt
    .replace(/\*\*/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const sanitizeUnsupportedTransparencyRequest = (prompt: string): string =>
  prompt
    .replace(/\btransparent\s+(background|fondo)\b/gi, 'plain pure white background')
    .replace(/\b(background|fondo)\s+(transparent|transparente)\b/gi, 'plain pure white background')
    .replace(/\balpha\s+transparency\b/gi, 'plain pure white background')
    .replace(/\btransparent\s+png\b/gi, 'PNG-style image on a pure white background');

const simplifyNanoBananaPrompt = (prompt: string): string =>
  normalizePromptWhitespace(sanitizeUnsupportedTransparencyRequest(prompt))
    .replace(/\b(stunning|compelling|breathtaking|masterpiece|ultra[- ]?detailed)\b/gi, '')
    .replace(/\s*\((\d+% intensity|\d+K)\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const wordCount = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

const splitPromptSentences = (prompt: string): string[] =>
  (prompt.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [prompt])
    .map(sentence => sentence.trim())
    .filter(Boolean);

const isLowValueBriefSentence = (sentence: string): boolean => {
  const lower = sentence.toLowerCase();
  return [
    'camera lock:',
    'text/signage lock:',
    'unchanged content lock:',
    'source fidelity contract:',
    'prompting framework:',
    'final output should',
    'use positive, concrete visual language',
    'when visible text is requested',
    'instruction labels are for the model only'
  ].some(prefix => lower.startsWith(prefix)) ||
    lower.includes('treat front as camera-side') ||
    lower.includes('do not rotate, mirror, stretch, or reframe the source accidentally') ||
    lower.includes('do not copy unrelated background content');
};

const isHighValueBriefSentence = (sentence: string): boolean =>
  /user brief|user request|edit instruction|current user request|additional user request|material assignments?|furnish|people|crowd|object|sky|background|lighting|reference|labels?|legend|zones?|components?|section|sketch|drawing|cad|upscale|grid|angle|headshot|poster|sticker|icon|pure white|quoted|"/i.test(sentence);

const buildConciseFeatureBrief = (
  prompt: string,
  model: ImageGenerationModel
): string => {
  const normalized = model === 'nano-banana'
    ? simplifyNanoBananaPrompt(prompt)
    : normalizePromptWhitespace(sanitizeUnsupportedTransparencyRequest(prompt));
  const maxWords = model === 'nano-banana' ? 230 : 270;
  if (wordCount(normalized) <= maxWords) return normalized;

  const sentences = splitPromptSentences(normalized);
  const candidateIndexes = sentences
    .map((sentence, index) => ({ sentence, index }))
    .filter(({ sentence }) => !isLowValueBriefSentence(sentence));
  const selected = new Set<number>();
  const selectedWordCount = () =>
    [...selected].reduce((total, index) => total + wordCount(sentences[index]), 0);
  const addIfRoom = (index: number, reserve = 0): void => {
    const sentenceWords = wordCount(sentences[index]);
    if (selected.has(index)) return;
    if (selectedWordCount() + sentenceWords <= maxWords + reserve) selected.add(index);
  };

  if (candidateIndexes.length) addIfRoom(candidateIndexes[0].index, 40);
  candidateIndexes
    .filter(({ sentence }) => /user brief|user request|edit instruction|current user request|additional user request|"/i.test(sentence))
    .forEach(({ index }) => addIfRoom(index, 60));
  candidateIndexes
    .filter(({ sentence }) => isHighValueBriefSentence(sentence))
    .forEach(({ index }) => addIfRoom(index));
  candidateIndexes.forEach(({ index }) => addIfRoom(index));

  const brief = [...selected]
    .sort((a, b) => a - b)
    .map(index => sentences[index])
    .join(' ')
    .trim();

  return brief || normalized.split(/\s+/).slice(0, maxWords).join(' ');
};

export function adaptPromptForImageGenerationModel(
  prompt: string,
  model: ImageGenerationModel = 'nano-banana',
  options: ImagePromptAdapterOptions = {}
): string {
  const sourcePrompt = buildConciseFeatureBrief(prompt, model);
  if (!sourcePrompt) return sourcePrompt;

  const intent = getPromptIntent(options.mode, options.activeTool);
  const sourceLine = options.hasSourceImage
    ? `Source handling: ${intent.keep}`
    : options.hasReferenceImages
      ? `Reference handling: ${intent.keep}`
      : '';
  const referenceLine = options.hasReferenceImages && options.hasSourceImage
    ? 'Reference images are secondary to the source image and only supply the explicitly requested relationship.'
    : '';
  const instructionLabel = 'Instruction labels are for the model only; do not render them as visible text.';
  const settingsDigest = compactItems(options.settingsDigest || []).slice(0, 12);
  const modelGuidance = compactItems(options.modelGuidance || []).slice(0, model === 'nano-banana' ? 4 : 5);
  const settingsBlock = settingsDigest.length
    ? `Active feature settings:\n- ${settingsDigest.join('\n- ')}`
    : '';
  const guidanceBlock = modelGuidance.length
    ? `Model-specific guidance:\n- ${modelGuidance.join('\n- ')}`
    : '';

  if (model === 'chatgpt-image-generation-2') {
    return [
      'Model: ChatGPT Image Generation 2 / GPT Image 2.',
      instructionLabel,
      `Output artifact: ${intent.artifact}.`,
      `Primary task: ${intent.task}`,
      sourceLine,
      referenceLine,
      `Allowed change: ${intent.change}`,
      `Text discipline: ${intent.textRule} If new visible copy is required, render only exact quoted strings and keep hierarchy, placement, and spelling clean.`,
      settingsBlock,
      guidanceBlock,
      'Follow this priority order: source/reference relationships first, user brief second, feature settings third, style/quality last.',
      `Feature brief:\n${sourcePrompt}`
    ].filter(Boolean).join('\n\n');
  }

  return [
    'Model: Nano Banana Pro / Gemini 3 Pro Image.',
    instructionLabel,
    'Use this as a short natural-language creative brief, not a keyword stack.',
    `Task: ${intent.task}`,
    sourceLine ? `Keep: ${intent.keep}` : '',
    referenceLine,
    `Change: ${intent.change}`,
    `Text: ${intent.textRule}`,
    settingsBlock,
    guidanceBlock,
    'Prefer the source image and the user intent over excessive technical micro-specification. Make one coherent image/edit.',
    `Brief:\n${sourcePrompt}`
  ].filter(Boolean).join('\n\n');
}

export function adaptImagePromptForModel(
  state: AppState,
  prompt: string,
  options: ImagePromptAdapterOptions = {}
): string {
  return adaptPromptForImageGenerationModel(prompt, state.imageGenerationModel, {
    mode: state.mode,
    activeTool: state.mode === 'visual-edit' ? state.workflow.activeTool : undefined,
    hasSourceImage: Boolean(state.sourceImage || state.uploadedImage),
    hasReferenceImages: Boolean(
      state.workflow.styleReferenceImage ||
      state.workflow.backgroundReferenceImage ||
      state.workflow.sceneInsertionReferences?.length ||
      state.workflow.sketchRefs?.length
    ),
    settingsDigest: summarizeWorkflowSettings(state),
    modelGuidance: getModelSpecificGuidance(state, state.imageGenerationModel, options.promptKind),
    ...options
  });
}

export const BUILT_IN_STYLES: StyleConfiguration[] = [
  {
    id: 'no-style',
    name: 'No Style',
    category: 'Base',
    description: 'No style. Use the raw prompt without stylistic bias.',
    previewUrl: 'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=600&q=80',
    promptBundle: {}
  },
  // --- EXISTING STYLES (14) ---
  {
    id: 'contemporary-minimalist',
    name: 'Contemporary Minimalist',
    category: 'Residential',
    description: 'Style: Contemporary Minimalist. Architectural vocabulary of clean lines, minimal ornamentation, open plan. Material palette of white plaster, floor-to-ceiling glass with secondary materials like warm oak accents, matte black steel. Lighting favors soft natural light, diffused daylight. Overall mood is serene, sophisticated.',
    previewUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['clean lines', 'minimal ornamentation', 'open plan', 'floating planes', 'cubic forms'],
      materialBias: {
        primary: ['white plaster', 'floor-to-ceiling glass', 'polished concrete'],
        secondary: ['warm oak accents', 'matte black steel', 'marble'],
        avoid: ['ornate details', 'clutter', 'heavy textures']
      },
      lightingBias: {
        preferred: ['soft natural light', 'diffused daylight', 'ambient occlusion'],
        avoid: ['harsh direct sun', 'colored lights']
      },
      cameraBias: { preferredAngles: ['eye-level', 'two-point perspective'], preferredFraming: ['rule of thirds', 'balanced'] },
      renderingLanguage: { quality: ['photorealistic', 'archviz', 'unreal engine 5'], atmosphere: ['serene', 'sophisticated', 'airy'], detail: ['crisp edges', 'high fidelity'] }
    }
  },
  {
    id: 'brutalist',
    name: 'Neo-Brutalist',
    category: 'Cultural',
    description: 'Style: Neo-Brutalist. Architectural vocabulary of massive forms, monolithic, geometric. Material palette of exposed concrete, raw timber with secondary materials like weathered steel, glass. Lighting favors dramatic shadows, contrast. Overall mood is imposing, atmospheric.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/A_hotel_%28known_as_Fullerton_Hotel%29_looks_grand_and_imposing_at_the_time_of_dusk.jpg',
    promptBundle: {
      architectureVocabulary: ['massive forms', 'monolithic', 'geometric', 'raw materiality', 'heavy volumes'],
      materialBias: {
        primary: ['exposed concrete', 'raw timber', 'beton brut'],
        secondary: ['weathered steel', 'glass', 'rough stone'],
        avoid: ['polished surfaces', 'delicate details', 'paint']
      },
      lightingBias: {
        preferred: ['dramatic shadows', 'contrast', 'volumetric fog'],
        avoid: ['flat lighting', 'overexposed']
      },
      cameraBias: { preferredAngles: ['low angle', 'worm-eye'], preferredFraming: ['monumental', 'imposing'] },
      renderingLanguage: { quality: ['cinematic', 'high fidelity'], atmosphere: ['imposing', 'atmospheric', 'moody'], detail: ['concrete texture', 'imperfections'] }
    }
  },
  {
    id: 'parametric',
    name: 'Parametric Fluidity',
    category: 'Conceptual',
    description: 'Style: Parametric Fluidity. Architectural vocabulary of organic curves, parametric facade, flowing geometry. Material palette of white corian, curved glass with secondary materials like perforated metal, fiber composites. Lighting favors soft gradients, ambient glow. Overall mood is futuristic, ethereal.',
    previewUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['organic curves', 'parametric facade', 'flowing geometry', 'biomimetic', 'voronoi pattern'],
      materialBias: {
        primary: ['white corian', 'curved glass', 'fiberglass'],
        secondary: ['perforated metal', 'fiber composites', 'carbon fiber'],
        avoid: ['rectilinear', 'brick', 'sharp corners']
      },
      lightingBias: {
        preferred: ['soft gradients', 'ambient glow', 'caustics'],
        avoid: ['hard shadows', 'darkness']
      },
      cameraBias: { preferredAngles: ['aerial', 'dynamic', 'curved'], preferredFraming: ['fluid', 'sweeping'] },
      renderingLanguage: { quality: ['high-end render', 'corona render'], atmosphere: ['futuristic', 'ethereal', 'motion'], detail: ['smooth surfaces', 'seamless'] }
    }
  },
  {
    id: 'vernacular',
    name: 'Modern Vernacular',
    category: 'Residential',
    description: 'Style: Modern Vernacular. Architectural vocabulary of gabled roof, local adaptation, warm tones. Material palette of brick, stone with secondary materials like copper, slate. Lighting favors golden hour, warm interior glow. Overall mood is inviting, cozy.',
    previewUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['gabled roof', 'local adaptation', 'warm tones', 'tactile', 'pitched roof'],
      materialBias: {
        primary: ['brick', 'stone', 'wood siding'],
        secondary: ['copper', 'slate', 'clay tiles'],
        avoid: ['high-tech', 'plastic', 'chrome']
      },
      lightingBias: {
        preferred: ['golden hour', 'warm interior glow', 'dappled light'],
        avoid: ['cool blue tones', 'neon']
      },
      cameraBias: { preferredAngles: ['eye-level', 'approachable'], preferredFraming: ['contextual', 'landscaped'] },
      renderingLanguage: { quality: ['architectural photography'], atmosphere: ['inviting', 'cozy', 'homely'], detail: ['material richness', 'texture'] }
    }
  },
  {
    id: 'scandinavian',
    name: 'Scandinavian',
    category: 'Residential',
    description: 'Style: Scandinavian. Architectural vocabulary of simple forms, functionalism, hygge. Material palette of pine wood, white walls with secondary materials like wool, linen. Lighting favors diffused north light, bright interiors. Overall mood is cozy, clean.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Castle_Rising%2C_St._Lawrence%27s_Church%2C_The_Norman_Nave_Arch_4%2C_Scandinavian_style_capital_carving_-_geograph.org.uk_-_5109279.jpg',
    promptBundle: {
      architectureVocabulary: ['simple forms', 'functionalism', 'hygge', 'connection to nature'],
      materialBias: {
        primary: ['pine wood', 'white walls', 'light timber'],
        secondary: ['wool', 'linen', 'glass'],
        avoid: ['dark heavy woods', 'baroque', 'clutter']
      },
      lightingBias: {
        preferred: ['diffused north light', 'bright interiors'],
        avoid: ['dark corners']
      },
      cameraBias: { preferredAngles: ['interior', 'eye-level'], preferredFraming: ['intimate'] },
      renderingLanguage: { quality: ['magazine style'], atmosphere: ['cozy', 'clean', 'bright'], detail: ['soft textures'] }
    }
  },
  {
    id: 'industrial-loft',
    name: 'Industrial Loft',
    category: 'Commercial',
    description: 'Style: Industrial Loft. Architectural vocabulary of adaptive reuse, open ceilings, large windows. Material palette of exposed brick, steel beams with secondary materials like ductwork, distressed leather. Lighting favors large daylighting, edison bulbs. Overall mood is urban, raw.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/HeinzLofts.jpg',
    promptBundle: {
      architectureVocabulary: ['adaptive reuse', 'open ceilings', 'large windows', 'structural honesty'],
      materialBias: {
        primary: ['exposed brick', 'steel beams', 'polished concrete'],
        secondary: ['ductwork', 'distressed leather', 'black metal'],
        avoid: ['plaster', 'carpet', 'pastels']
      },
      lightingBias: {
        preferred: ['large daylighting', 'edison bulbs'],
        avoid: ['clinical light']
      },
      cameraBias: { preferredAngles: ['wide angle'], preferredFraming: ['spacious'] },
      renderingLanguage: { quality: ['photorealistic'], atmosphere: ['urban', 'raw', 'gritty'], detail: ['rust', 'patina'] }
    }
  },
  {
    id: 'biophilic',
    name: 'Biophilic Design',
    category: 'Sustainable',
    description: 'Style: Biophilic Design. Architectural vocabulary of vertical gardens, indoor-outdoor flow, organic patterns. Material palette of living walls, natural wood with secondary materials like water features, bamboo. Lighting favors dappled sunlight, skylights. Overall mood is lush, restorative.',
    previewUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['vertical gardens', 'indoor-outdoor flow', 'organic patterns', 'nature integration'],
      materialBias: {
        primary: ['living walls', 'natural wood', 'stone'],
        secondary: ['water features', 'bamboo', 'glass'],
        avoid: ['synthetic materials', 'sterile surfaces']
      },
      lightingBias: {
        preferred: ['dappled sunlight', 'skylights'],
        avoid: ['artificial glare']
      },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['immersed in green'] },
      renderingLanguage: { quality: ['vibrant'], atmosphere: ['lush', 'restorative', 'fresh'], detail: ['foliage', 'organic textures'] }
    }
  },
  {
    id: 'mid-century',
    name: 'Mid-Century Modern',
    category: 'Residential',
    description: 'Style: Mid-Century Modern. Architectural vocabulary of cantilevered, flat planes, integration with landscape. Material palette of teak, glass with secondary materials like brass, terrazzo. Lighting favors warm sunlight, globe lights. Overall mood is nostalgic, stylish.',
    previewUrl: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['cantilevered', 'flat planes', 'integration with landscape', 'retro aesthetic'],
      materialBias: {
        primary: ['teak', 'glass', 'stone fireplace'],
        secondary: ['brass', 'terrazzo', 'pops of color'],
        avoid: ['ornamentation', 'clutter']
      },
      lightingBias: {
        preferred: ['warm sunlight', 'globe lights'],
        avoid: ['cool LEDs']
      },
      cameraBias: { preferredAngles: ['eye-level', 'low angle'], preferredFraming: ['horizontal'] },
      renderingLanguage: { quality: ['cinematic', 'vintage feel'], atmosphere: ['nostalgic', 'stylish'], detail: ['wood grain'] }
    }
  },
  {
    id: 'japanese-zen',
    name: 'Japanese Zen',
    category: 'Cultural',
    description: 'Style: Japanese Zen. Architectural vocabulary of engawa, shoji screens, minimalist. Material palette of hinoki wood, tatami with secondary materials like river stones, paper. Lighting favors diffused soft light, shadow play. Overall mood is peaceful, meditative.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Architectural_Detail_-_Kennin-ji_Zen_Temple_-_Kyoto_-_Japan_%2847929070538%29.jpg',
    promptBundle: {
      architectureVocabulary: ['engawa', 'shoji screens', 'minimalist', 'connection to garden'],
      materialBias: {
        primary: ['hinoki wood', 'tatami', 'plaster'],
        secondary: ['river stones', 'paper', 'bamboo'],
        avoid: ['clutter', 'bright plastic']
      },
      lightingBias: {
        preferred: ['diffused soft light', 'shadow play'],
        avoid: ['direct harsh light']
      },
      cameraBias: { preferredAngles: ['low angle', 'interior'], preferredFraming: ['framed views', 'asymmetry'] },
      renderingLanguage: { quality: ['photorealistic'], atmosphere: ['peaceful', 'meditative', 'quiet'], detail: ['texture focus'] }
    }
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    category: 'Conceptual',
    description: 'Style: Cyberpunk. Architectural vocabulary of megastructure, dense urban, high-tech. Material palette of metal, glass with secondary materials like holograms, wires. Lighting favors neon pink, cyan glow. Overall mood is dark, gritty.',
    previewUrl: 'https://images.unsplash.com/photo-1515630278258-407f66498911?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['megastructure', 'dense urban', 'high-tech', 'dystopian'],
      materialBias: {
        primary: ['metal', 'glass', 'concrete'],
        secondary: ['holograms', 'wires', 'neon signs'],
        avoid: ['wood', 'nature', 'clean']
      },
      lightingBias: {
        preferred: ['neon pink', 'cyan glow', 'rain reflections'],
        avoid: ['daylight', 'warm white']
      },
      cameraBias: { preferredAngles: ['aerial', 'street level'], preferredFraming: ['crowded', 'vertical'] },
      renderingLanguage: { quality: ['digital art', 'octane render'], atmosphere: ['dark', 'gritty', 'electric'], detail: ['rain', 'reflections'] }
    }
  },
  {
    id: 'bauhaus',
    name: 'Bauhaus',
    category: 'Cultural',
    description: 'Style: Bauhaus. Architectural vocabulary of geometric, functionalism, asymmetry. Material palette of white stucco, steel with secondary materials like primary color accents, concrete. Lighting favors clear daylight, studio lighting. Overall mood is rational, modern.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/12/20er_Bauhaus.png',
    promptBundle: {
      architectureVocabulary: ['geometric', 'functionalism', 'asymmetry', 'industrial'],
      materialBias: {
        primary: ['white stucco', 'steel', 'glass'],
        secondary: ['primary color accents', 'concrete'],
        avoid: ['decoration', 'ornament']
      },
      lightingBias: {
        preferred: ['clear daylight', 'studio lighting'],
        avoid: ['moody']
      },
      cameraBias: { preferredAngles: ['axonometric', 'front'], preferredFraming: ['balanced'] },
      renderingLanguage: { quality: ['clean'], atmosphere: ['rational', 'modern'], detail: ['sharp lines'] }
    }
  },
  {
    id: 'tropical-modern',
    name: 'Tropical Modernism',
    category: 'Residential',
    description: 'Style: Tropical Modernism. Architectural vocabulary of large overhangs, passive ventilation, open spaces. Material palette of concrete, tropical hardwood with secondary materials like water, vegetation. Lighting favors bright sun, deep shade. Overall mood is humid, lush.',
    previewUrl: 'https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['large overhangs', 'passive ventilation', 'open spaces', 'breeze blocks'],
      materialBias: {
        primary: ['concrete', 'tropical hardwood', 'stone'],
        secondary: ['water', 'vegetation'],
        avoid: ['glass curtain wall', 'insulation']
      },
      lightingBias: {
        preferred: ['bright sun', 'deep shade'],
        avoid: ['overcast']
      },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['surrounded by nature'] },
      renderingLanguage: { quality: ['vivid'], atmosphere: ['humid', 'lush', 'relaxed'], detail: ['foliage shadows'] }
    }
  },
  {
    id: 'alpine-chalet',
    name: 'Alpine Chalet',
    category: 'Residential',
    description: 'Style: Alpine Chalet. Architectural vocabulary of steep roof, panoramic windows, mountain retreat. Material palette of timber cladding, slate with secondary materials like glass, fur. Lighting favors warm interior light, blue hour snow. Overall mood is cold outside warm inside, majestic.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Alpine_flowers_and_gardens_%28IA_alpineflowersgar00flemrich%29.pdf',
    promptBundle: {
      architectureVocabulary: ['steep roof', 'panoramic windows', 'mountain retreat'],
      materialBias: {
        primary: ['timber cladding', 'slate', 'stone base'],
        secondary: ['glass', 'fur', 'fire'],
        avoid: ['concrete block', 'palm trees']
      },
      lightingBias: {
        preferred: ['warm interior light', 'blue hour snow'],
        avoid: ['green cast']
      },
      cameraBias: { preferredAngles: ['exterior'], preferredFraming: ['landscape context'] },
      renderingLanguage: { quality: ['crisp'], atmosphere: ['cold outside warm inside', 'majestic'], detail: ['snow texture'] }
    }
  },
  {
    id: 'desert-modern',
    name: 'Desert Modernism',
    category: 'Residential',
    description: 'Style: Desert Modernism. Architectural vocabulary of horizontal planes, earth shelter, arid landscape. Material palette of rammed earth, corten steel with secondary materials like glass, succulents. Lighting favors hard sunlight, long shadows. Overall mood is dry, hot.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Architect_and_engineer_%28IA_architectenginee11333sanf%29.pdf',
    promptBundle: {
      architectureVocabulary: ['horizontal planes', 'earth shelter', 'arid landscape', 'shadow patterns'],
      materialBias: {
        primary: ['rammed earth', 'corten steel', 'sandstone'],
        secondary: ['glass', 'succulents'],
        avoid: ['green grass', 'white plastic']
      },
      lightingBias: {
        preferred: ['hard sunlight', 'long shadows'],
        avoid: ['diffused mist']
      },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['wide landscape'] },
      renderingLanguage: { quality: ['high contrast'], atmosphere: ['dry', 'hot', 'silent'], detail: ['sand grains', 'heat haze'] }
    }
  },
  // --- NEW STYLES (40) ---
  {
    id: 'art-deco',
    name: 'Art Deco',
    category: 'Historical',
    description: 'Style: Art Deco. Architectural vocabulary of geometric patterns, vertical emphasis, ziggurat forms. Material palette of limestone, chrome with secondary materials like brass, terrazzo. Lighting favors dramatic up-lighting, neon accents. Overall mood is glamorous, bold.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Art_Deco_Building_on_1_Fifth_Avenue_behind_Washington_Square_Arch_2019-09-29_23-34.jpg',
    promptBundle: {
      architectureVocabulary: ['geometric patterns', 'vertical emphasis', 'ziggurat forms', 'decorative', 'streamlined'],
      materialBias: { primary: ['limestone', 'chrome', 'glass block'], secondary: ['brass', 'terrazzo'], avoid: ['minimalism'] },
      lightingBias: { preferred: ['dramatic up-lighting', 'neon accents'], avoid: ['soft diffuse'] },
      cameraBias: { preferredAngles: ['low angle', 'front'], preferredFraming: ['symmetrical'] },
      renderingLanguage: { quality: ['cinematic'], atmosphere: ['glamorous', 'bold'], detail: ['ornamental'] }
    }
  },
  {
    id: 'beaux-arts',
    name: 'Beaux-Arts',
    category: 'Historical',
    description: 'Style: Beaux-Arts. Architectural vocabulary of symmetry, columns, cornices. Material palette of limestone, marble with secondary materials like bronze. Lighting favors natural daylight, chandelier glow. Overall mood is monumental, formal.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/77/%28Narbonne%29_Mgr_Jules_de_M%C3%A9dicis_-_Mus%C3%A9e_des_Beaux-Arts_de_Narbonne.jpg',
    promptBundle: {
      architectureVocabulary: ['symmetry', 'columns', 'cornices', 'grand entrance', 'sculptural details'],
      materialBias: { primary: ['limestone', 'marble', 'granite'], secondary: ['bronze'], avoid: ['exposed steel'] },
      lightingBias: { preferred: ['natural daylight', 'chandelier glow'], avoid: ['neon'] },
      cameraBias: { preferredAngles: ['eye-level', 'front'], preferredFraming: ['centered'] },
      renderingLanguage: { quality: ['detailed'], atmosphere: ['monumental', 'formal'], detail: ['carved stone'] }
    }
  },
  {
    id: 'gothic-revival',
    name: 'Gothic Revival',
    category: 'Historical',
    description: 'Style: Gothic Revival. Architectural vocabulary of pointed arches, steep roofs, tracery. Material palette of stone, brick with secondary materials like stained glass, slate. Lighting favors mysterious, shadowy. Overall mood is imposing, historic.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Kenilwood-gothic-revival-architecture.jpg',
    promptBundle: {
      architectureVocabulary: ['pointed arches', 'steep roofs', 'tracery', 'verticality', 'spires'],
      materialBias: { primary: ['stone', 'brick'], secondary: ['stained glass', 'slate'], avoid: ['concrete'] },
      lightingBias: { preferred: ['mysterious', 'shadowy'], avoid: ['bright flat light'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['vertical'] },
      renderingLanguage: { quality: ['dramatic'], atmosphere: ['imposing', 'historic'], detail: ['intricate'] }
    }
  },
  {
    id: 'victorian',
    name: 'Victorian',
    category: 'Historical',
    description: 'Style: Victorian. Architectural vocabulary of asymmetry, decorative trim, turrets. Material palette of painted wood, brick with secondary materials like shingles, stained glass. Lighting favors warm, inviting light. Overall mood is charming, detailed.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9e/Osborne_Street_Victorian%2C_Danbury%2C_Connecticut.jpg',
    promptBundle: {
      architectureVocabulary: ['asymmetry', 'decorative trim', 'turrets', 'bay windows', 'porches'],
      materialBias: { primary: ['painted wood', 'brick'], secondary: ['shingles', 'stained glass'], avoid: ['glass curtain wall'] },
      lightingBias: { preferred: ['warm', 'inviting'], avoid: ['cool industrial'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['contextual'] },
      renderingLanguage: { quality: ['nostalgic'], atmosphere: ['charming', 'detailed'], detail: ['ornate'] }
    }
  },
  {
    id: 'mediterranean',
    name: 'Mediterranean Revival',
    category: 'Residential',
    description: 'Style: Mediterranean Revival. Architectural vocabulary of arches, courtyards, red tile roof. Material palette of stucco, terracotta with secondary materials like wrought iron, wood. Lighting favors warm sun, dappled shade. Overall mood is sunny, relaxed.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/60/%281%29Mediterranean_Revival_style-1.jpg',
    promptBundle: {
      architectureVocabulary: ['arches', 'courtyards', 'red tile roof', 'balconies'],
      materialBias: { primary: ['stucco', 'terracotta'], secondary: ['wrought iron', 'wood'], avoid: ['siding'] },
      lightingBias: { preferred: ['warm sun', 'dappled shade'], avoid: ['gloomy'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['garden context'] },
      renderingLanguage: { quality: ['vibrant'], atmosphere: ['sunny', 'relaxed'], detail: ['textured'] }
    }
  },
  {
    id: 'tudor',
    name: 'Tudor Revival',
    category: 'Residential',
    description: 'Style: Tudor Revival. Architectural vocabulary of half-timbering, steep gables, prominent chimneys. Material palette of brick, stucco with secondary materials like stone. Lighting favors warm, cozy light. Overall mood is fairytale, historic.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/An_example_of_Tudor_Revival_architecture_in_the_Belle_Meade_Links_neighborhood_%28Nashville%2C_Tennessee%29.jpg',
    promptBundle: {
      architectureVocabulary: ['half-timbering', 'steep gables', 'prominent chimneys', 'leaded glass'],
      materialBias: { primary: ['brick', 'stucco', 'wood'], secondary: ['stone'], avoid: ['modern materials'] },
      lightingBias: { preferred: ['warm', 'cozy'], avoid: ['harsh'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['picturesque'] },
      renderingLanguage: { quality: ['classic'], atmosphere: ['fairytale', 'historic'], detail: ['craftsmanship'] }
    }
  },
  {
    id: 'craftsman',
    name: 'Craftsman',
    category: 'Residential',
    description: 'Style: Craftsman. Architectural vocabulary of low-pitched roof, exposed rafters, tapered columns. Material palette of wood, stone with secondary materials like brick, shingle. Lighting favors warm light. Overall mood is homely, natural.',
    previewUrl: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['low-pitched roof', 'exposed rafters', 'tapered columns', 'porch'],
      materialBias: { primary: ['wood', 'stone'], secondary: ['brick', 'shingle'], avoid: ['steel'] },
      lightingBias: { preferred: ['warm'], avoid: ['cool'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['welcoming'] },
      renderingLanguage: { quality: ['warm'], atmosphere: ['homely', 'natural'], detail: ['joinery'] }
    }
  },
  {
    id: 'prairie',
    name: 'Prairie Style',
    category: 'Residential',
    description: 'Style: Prairie Style. Architectural vocabulary of horizontal lines, cantilevers, open plan. Material palette of brick, wood with secondary materials like art glass. Lighting favors natural light. Overall mood is grounded, peaceful.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Frank_Lloyd_Wright_Prairie_Style_Marysville.jpg',
    promptBundle: {
      architectureVocabulary: ['horizontal lines', 'cantilevers', 'open plan', 'organic architecture'],
      materialBias: { primary: ['brick', 'wood'], secondary: ['art glass'], avoid: ['verticality'] },
      lightingBias: { preferred: ['natural'], avoid: ['artificial'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['landscape'] },
      renderingLanguage: { quality: ['organic'], atmosphere: ['grounded', 'peaceful'], detail: ['linear'] }
    }
  },
  {
    id: 'international',
    name: 'International Style',
    category: 'Modern',
    description: 'Style: International Style. Architectural vocabulary of rectilinear, volume over mass, regularity. Material palette of glass, steel with secondary materials like white render. Lighting favors even light. Overall mood is rational, efficient.',
    previewUrl: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['rectilinear', 'volume over mass', 'regularity', 'no ornament'],
      materialBias: { primary: ['glass', 'steel', 'concrete'], secondary: ['white render'], avoid: ['texture'] },
      lightingBias: { preferred: ['even'], avoid: ['dramatic'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['objective'] },
      renderingLanguage: { quality: ['clean'], atmosphere: ['rational', 'efficient'], detail: ['precise'] }
    }
  },
  {
    id: 'deconstructivism',
    name: 'Deconstructivism',
    category: 'Conceptual',
    description: 'Style: Deconstructivism. Architectural vocabulary of fragmentation, non-linear, distortion. Material palette of titanium, steel with secondary materials like concrete. Lighting favors dynamic light. Overall mood is chaotic, innovative.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/df/0156-Stuttgart-Hysolar.jpg',
    promptBundle: {
      architectureVocabulary: ['fragmentation', 'non-linear', 'distortion', 'dislocation'],
      materialBias: { primary: ['titanium', 'steel', 'glass'], secondary: ['concrete'], avoid: ['symmetry'] },
      lightingBias: { preferred: ['dynamic'], avoid: ['flat'] },
      cameraBias: { preferredAngles: ['dynamic'], preferredFraming: ['unconventional'] },
      renderingLanguage: { quality: ['artistic'], atmosphere: ['chaotic', 'innovative'], detail: ['complex'] }
    }
  },
  {
    id: 'high-tech',
    name: 'High-Tech',
    category: 'Modern',
    description: 'Style: High-Tech. Architectural vocabulary of exposed structure, functionalism, industrial aesthetic. Material palette of steel, glass with secondary materials like bright colors. Lighting favors technical light. Overall mood is engineered, advanced.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Futuristic_architecture_at_Holm_Island_-_geograph.org.uk_-_5246329.jpg',
    promptBundle: {
      architectureVocabulary: ['exposed structure', 'functionalism', 'industrial aesthetic', 'flexibility'],
      materialBias: { primary: ['steel', 'glass', 'aluminum'], secondary: ['bright colors'], avoid: ['masonry'] },
      lightingBias: { preferred: ['technical'], avoid: ['soft'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['structural'] },
      renderingLanguage: { quality: ['precise'], atmosphere: ['engineered', 'advanced'], detail: ['mechanical'] }
    }
  },
  {
    id: 'postmodern',
    name: 'Postmodernism',
    category: 'Modern',
    description: 'Style: Postmodernism. Architectural vocabulary of historical reference, color, playfulness. Material palette of stucco, stone veneer with secondary materials like tile. Lighting favors bright light. Overall mood is playful, eclectic.',
    previewUrl: 'https://images.unsplash.com/photo-1545558014-8692077e9b5c?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['historical reference', 'color', 'playfulness', 'irony'],
      materialBias: { primary: ['stucco', 'stone veneer'], secondary: ['tile'], avoid: ['pure minimalism'] },
      lightingBias: { preferred: ['bright'], avoid: ['dark'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['pop'] },
      renderingLanguage: { quality: ['graphic'], atmosphere: ['playful', 'eclectic'], detail: ['stylized'] }
    }
  },
  {
    id: 'metabolism',
    name: 'Metabolism',
    category: 'Conceptual',
    description: 'Style: Metabolism. Architectural vocabulary of capsules, modularity, growth. Material palette of concrete, pre-fab units with secondary materials like steel. Lighting favors natural light. Overall mood is futuristic, organic.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Albendazole_metabolism_%28blank%29.svg',
    promptBundle: {
      architectureVocabulary: ['capsules', 'modularity', 'growth', 'megastructure'],
      materialBias: { primary: ['concrete', 'pre-fab units'], secondary: ['steel'], avoid: ['traditional'] },
      lightingBias: { preferred: ['natural'], avoid: ['artificial'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['repetitive'] },
      renderingLanguage: { quality: ['utopian'], atmosphere: ['futuristic', 'organic'], detail: ['cellular'] }
    }
  },
  {
    id: 'eco-brutalism',
    name: 'Eco-Brutalism',
    category: 'Sustainable',
    description: 'Style: Eco-Brutalism. Architectural vocabulary of concrete, vegetation, overgrown. Material palette of concrete, plants with secondary materials like water. Lighting favors dappled light. Overall mood is post-apocalyptic, serene.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Architectural_record_%28IA_architecturalrec5319unse%29.pdf',
    promptBundle: {
      architectureVocabulary: ['concrete', 'vegetation', 'overgrown', 'monolithic'],
      materialBias: { primary: ['concrete', 'plants'], secondary: ['water'], avoid: ['plastic'] },
      lightingBias: { preferred: ['dappled'], avoid: ['sterile'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['nature-dominant'] },
      renderingLanguage: { quality: ['atmospheric'], atmosphere: ['post-apocalyptic', 'serene'], detail: ['weathering'] }
    }
  },
  {
    id: 'tiny-house',
    name: 'Tiny House',
    category: 'Residential',
    description: 'Style: Tiny House. Architectural vocabulary of compact, efficient, loft. Material palette of wood with secondary materials like metal. Lighting favors cozy light. Overall mood is simple, free.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7a/The_Tiny_House_at_SMAK%27s_Hotel.jpg',
    promptBundle: {
      architectureVocabulary: ['compact', 'efficient', 'loft', 'wheels'],
      materialBias: { primary: ['wood'], secondary: ['metal'], avoid: ['excess'] },
      lightingBias: { preferred: ['cozy'], avoid: ['cold'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['intimate'] },
      renderingLanguage: { quality: ['charming'], atmosphere: ['simple', 'free'], detail: ['clever'] }
    }
  },
  {
    id: 'shipping-container',
    name: 'Container Arch',
    category: 'Sustainable',
    description: 'Style: Container Arch. Architectural vocabulary of modular, industrial, corrugated. Material palette of metal, glass with secondary materials like wood deck. Lighting favors natural light. Overall mood is innovative, upcycled.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8b/Architectural_Review_and_American_Builders%27_Journal%2C_Volume_1%2C_1869.pdf',
    promptBundle: {
      architectureVocabulary: ['modular', 'industrial', 'corrugated', 'stacked'],
      materialBias: { primary: ['metal', 'glass'], secondary: ['wood deck'], avoid: ['stone'] },
      lightingBias: { preferred: ['natural'], avoid: ['dim'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['geometric'] },
      renderingLanguage: { quality: ['modern'], atmosphere: ['innovative', 'upcycled'], detail: ['corrugation'] }
    }
  },
  {
    id: 'earthship',
    name: 'Earthship',
    category: 'Sustainable',
    description: 'Style: Earthship. Architectural vocabulary of earth-bermed, passive solar, recycled. Material palette of tires, adobe with secondary materials like wood. Lighting favors natural light. Overall mood is sustainable, rugged.',
    previewUrl: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['earth-bermed', 'passive solar', 'recycled', 'organic'],
      materialBias: { primary: ['tires', 'adobe', 'glass bottles'], secondary: ['wood'], avoid: ['industrial'] },
      lightingBias: { preferred: ['natural'], avoid: ['artificial'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['landscape'] },
      renderingLanguage: { quality: ['organic'], atmosphere: ['sustainable', 'rugged'], detail: ['handmade'] }
    }
  },
  {
    id: 'bamboo',
    name: 'Bamboo Architecture',
    category: 'Sustainable',
    description: 'Style: Bamboo Architecture. Architectural vocabulary of organic, curved, open air. Material palette of bamboo with secondary materials like thatch. Lighting favors warm light. Overall mood is tropical, serene.',
    previewUrl: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['organic', 'curved', 'open air', 'sustainable'],
      materialBias: { primary: ['bamboo'], secondary: ['thatch'], avoid: ['concrete'] },
      lightingBias: { preferred: ['warm'], avoid: ['cool'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['upward'] },
      renderingLanguage: { quality: ['natural'], atmosphere: ['tropical', 'serene'], detail: ['joints'] }
    }
  },
  {
    id: 'nordic-noir',
    name: 'Nordic Noir',
    category: 'Residential',
    description: 'Style: Nordic Noir. Architectural vocabulary of minimalist, dark exterior, cozy interior. Material palette of charred wood, glass with secondary materials like concrete. Lighting favors moody light. Overall mood is quiet, mysterious.',
    previewUrl: 'https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['minimalist', 'dark exterior', 'cozy interior', 'nature'],
      materialBias: { primary: ['charred wood', 'glass'], secondary: ['concrete'], avoid: ['color'] },
      lightingBias: { preferred: ['moody'], avoid: ['bright'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['isolated'] },
      renderingLanguage: { quality: ['cinematic'], atmosphere: ['quiet', 'mysterious'], detail: ['texture'] }
    }
  },
  {
    id: 'a-frame',
    name: 'A-Frame',
    category: 'Residential',
    description: 'Style: A-Frame. Architectural vocabulary of triangular, steep roof, open gable. Material palette of wood, glass with secondary materials like metal roof. Lighting favors warm light. Overall mood is cabin, retreat.',
    previewUrl: 'https://images.unsplash.com/photo-1527030280862-64139fba04ca?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['triangular', 'steep roof', 'open gable', 'deck'],
      materialBias: { primary: ['wood', 'glass'], secondary: ['metal roof'], avoid: ['flat roof'] },
      lightingBias: { preferred: ['warm'], avoid: ['cool'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['centered'] },
      renderingLanguage: { quality: ['cozy'], atmosphere: ['cabin', 'retreat'], detail: ['wood'] }
    }
  },
  {
    id: 'geodesic',
    name: 'Geodesic Dome',
    category: 'Conceptual',
    description: 'Style: Geodesic Dome. Architectural vocabulary of spherical, triangular lattice, efficient. Material palette of glass, steel with secondary materials like ETFE. Lighting favors bright light. Overall mood is futuristic, scientific.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/43/Geodesic_Dome_Tent.webp',
    promptBundle: {
      architectureVocabulary: ['spherical', 'triangular lattice', 'efficient', 'dome'],
      materialBias: { primary: ['glass', 'steel'], secondary: ['ETFE'], avoid: ['brick'] },
      lightingBias: { preferred: ['bright'], avoid: ['dark'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['geometric'] },
      renderingLanguage: { quality: ['tech'], atmosphere: ['futuristic', 'scientific'], detail: ['structure'] }
    }
  },
  {
    id: 'parametric-timber',
    name: 'Parametric Timber',
    category: 'Conceptual',
    description: 'Style: Parametric Timber. Architectural vocabulary of fluid, computational, layered. Material palette of wood with secondary materials like glass. Lighting favors warm light. Overall mood is innovative, natural.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Computational_analysis_of_hygromorphic_self-shaping_wood_gridshell_structures.pdf',
    promptBundle: {
      architectureVocabulary: ['fluid', 'computational', 'layered', 'organic'],
      materialBias: { primary: ['wood'], secondary: ['glass'], avoid: ['block'] },
      lightingBias: { preferred: ['warm'], avoid: ['cold'] },
      cameraBias: { preferredAngles: ['dynamic'], preferredFraming: ['flowing'] },
      renderingLanguage: { quality: ['high-end'], atmosphere: ['innovative', 'natural'], detail: ['grain'] }
    }
  },
  {
    id: 'floating-home',
    name: 'Floating Arch',
    category: 'Residential',
    description: 'Style: Floating Arch. Architectural vocabulary of floating, buoyant, deck. Material palette of wood, composite with secondary materials like glass. Lighting favors reflected light. Overall mood is peaceful, aquatic.',
    previewUrl: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['floating', 'buoyant', 'deck', 'water view'],
      materialBias: { primary: ['wood', 'composite'], secondary: ['glass'], avoid: ['heavy stone'] },
      lightingBias: { preferred: ['reflected'], avoid: ['dull'] },
      cameraBias: { preferredAngles: ['water-level'], preferredFraming: ['reflection'] },
      renderingLanguage: { quality: ['serene'], atmosphere: ['peaceful', 'aquatic'], detail: ['reflection'] }
    }
  },
  {
    id: 'mars-habitat',
    name: 'Mars Habitat',
    category: 'Conceptual',
    description: 'Style: Mars Habitat. Architectural vocabulary of 3D printed, protective, dome. Material palette of regolith, composite with secondary materials like glass. Lighting favors artificial, reddish light. Overall mood is hostile, advanced.',
    previewUrl: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['3D printed', 'protective', 'dome', 'pressurized'],
      materialBias: { primary: ['regolith', 'composite'], secondary: ['glass'], avoid: ['wood'] },
      lightingBias: { preferred: ['artificial', 'reddish'], avoid: ['blue sky'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['landscape'] },
      renderingLanguage: { quality: ['sci-fi'], atmosphere: ['hostile', 'advanced'], detail: ['texture'] }
    }
  },
  {
    id: 'solarpunk',
    name: 'Solarpunk',
    category: 'Conceptual',
    description: 'Style: Solarpunk. Architectural vocabulary of green tech, organic curves, stained glass. Material palette of glass, plants with secondary materials like solar panels. Lighting favors bright light. Overall mood is utopian, vibrant.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f8/Casa_Terracota_in_Villa_de_Leyva.jpg',
    promptBundle: {
      architectureVocabulary: ['green tech', 'organic curves', 'stained glass', 'solar'],
      materialBias: { primary: ['glass', 'plants', 'wood'], secondary: ['solar panels'], avoid: ['grunge'] },
      lightingBias: { preferred: ['bright'], avoid: ['dark'] },
      cameraBias: { preferredAngles: ['aerial'], preferredFraming: ['lush'] },
      renderingLanguage: { quality: ['optimistic'], atmosphere: ['utopian', 'vibrant'], detail: ['vegetation'] }
    }
  },
  {
    id: 'steampunk',
    name: 'Steampunk',
    category: 'Conceptual',
    description: 'Style: Steampunk. Architectural vocabulary of industrial, victorian, gears. Material palette of brass, copper with secondary materials like brick. Lighting favors warm, hazy light. Overall mood is retro-future, mechanical.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/10/Steampunk_festival_in_Lincoln_2014_-_Photo_39_-_geograph.org.uk_-_4170042.jpg',
    promptBundle: {
      architectureVocabulary: ['industrial', 'victorian', 'gears', 'pipes'],
      materialBias: { primary: ['brass', 'copper', 'iron'], secondary: ['brick'], avoid: ['plastic'] },
      lightingBias: { preferred: ['warm', 'hazy'], avoid: ['clean'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['detailed'] },
      renderingLanguage: { quality: ['gritty'], atmosphere: ['retro-future', 'mechanical'], detail: ['pipes'] }
    }
  },
  {
    id: 'islamic-modern',
    name: 'Islamic Modern',
    category: 'Cultural',
    description: 'Style: Islamic Modern. Architectural vocabulary of geometry, pattern, screening. Material palette of stone, screen with secondary materials like water. Lighting favors filtered, shadow patterns. Overall mood is spiritual, cool.',
    previewUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['geometry', 'pattern', 'screening', 'courtyard'],
      materialBias: { primary: ['stone', 'screen'], secondary: ['water'], avoid: ['plain'] },
      lightingBias: { preferred: ['filtered', 'shadow patterns'], avoid: ['flat'] },
      cameraBias: { preferredAngles: ['interior'], preferredFraming: ['symmetrical'] },
      renderingLanguage: { quality: ['intricate'], atmosphere: ['spiritual', 'cool'], detail: ['pattern'] }
    }
  },
  {
    id: 'chinese-modern',
    name: 'Chinese Modern',
    category: 'Cultural',
    description: 'Style: Chinese Modern. Architectural vocabulary of sweeping roof, brackets, courtyard. Material palette of wood, tile with secondary materials like stone. Lighting favors soft light. Overall mood is peaceful, historic.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/61/20240729_Sign_of_Badaguan_Modern_Architectures.jpg',
    promptBundle: {
      architectureVocabulary: ['sweeping roof', 'brackets', 'courtyard', 'symmetry'],
      materialBias: { primary: ['wood', 'tile'], secondary: ['stone'], avoid: ['concrete block'] },
      lightingBias: { preferred: ['soft'], avoid: ['harsh'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['balanced'] },
      renderingLanguage: { quality: ['elegant'], atmosphere: ['peaceful', 'historic'], detail: ['woodwork'] }
    }
  },
  {
    id: 'wabi-sabi',
    name: 'Wabi-Sabi',
    category: 'Cultural',
    description: 'Style: Wabi-Sabi. Architectural vocabulary of imperfection, simplicity, natural aging. Material palette of aged wood, rough plaster with secondary materials like stone. Lighting favors shadowy. Overall mood is quiet, melancholy.',
    previewUrl: 'https://images.unsplash.com/photo-1598928636135-d146006ff4be?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['imperfection', 'simplicity', 'natural aging', 'rough'],
      materialBias: { primary: ['aged wood', 'rough plaster'], secondary: ['stone'], avoid: ['shiny'] },
      lightingBias: { preferred: ['shadowy'], avoid: ['bright'] },
      cameraBias: { preferredAngles: ['interior'], preferredFraming: ['detail'] },
      renderingLanguage: { quality: ['textured'], atmosphere: ['quiet', 'melancholy'], detail: ['patina'] }
    }
  },
  {
    id: 'memphis',
    name: 'Memphis Group',
    category: 'Modern',
    description: 'Style: Memphis Group. Architectural vocabulary of geometric, colorful, pattern. Material palette of laminate, terrazzo with secondary materials like plastic. Lighting favors bright light. Overall mood is fun, bold.',
    previewUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['geometric', 'colorful', 'pattern', 'asymmetry'],
      materialBias: { primary: ['laminate', 'terrazzo'], secondary: ['plastic'], avoid: ['natural'] },
      lightingBias: { preferred: ['bright'], avoid: ['moody'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['graphic'] },
      renderingLanguage: { quality: ['vibrant'], atmosphere: ['fun', 'bold'], detail: ['pattern'] }
    }
  },
  {
    id: 'art-nouveau',
    name: 'Art Nouveau',
    category: 'Historical',
    description: 'Style: Art Nouveau. Architectural vocabulary of curves, organic lines, floral motifs. Material palette of stone, iron with secondary materials like ceramic. Lighting favors soft light. Overall mood is romantic, flowery.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Art_Nouveau_Riga_17.jpg',
    promptBundle: {
      architectureVocabulary: ['curves', 'organic lines', 'floral motifs', 'asymmetry'],
      materialBias: { primary: ['stone', 'iron', 'glass'], secondary: ['ceramic'], avoid: ['rectilinear'] },
      lightingBias: { preferred: ['soft'], avoid: ['harsh'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['fluid'] },
      renderingLanguage: { quality: ['elegant'], atmosphere: ['romantic', 'flowery'], detail: ['curve'] }
    }
  },
  {
    id: 'neoclassical',
    name: 'Neoclassical',
    category: 'Historical',
    description: 'Style: Neoclassical. Architectural vocabulary of columns, pediment, symmetry. Material palette of stone, marble with secondary materials like white paint. Lighting favors bright light. Overall mood is imposing, stately.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/92/Neo-Classical_-_Seattle%2C_WA_-_Smith_Tower_%281%29.jpg',
    promptBundle: {
      architectureVocabulary: ['columns', 'pediment', 'symmetry', 'dome'],
      materialBias: { primary: ['stone', 'marble'], secondary: ['white paint'], avoid: ['wood'] },
      lightingBias: { preferred: ['bright'], avoid: ['dark'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['symmetrical'] },
      renderingLanguage: { quality: ['formal'], atmosphere: ['imposing', 'stately'], detail: ['order'] }
    }
  },
  {
    id: 'colonial',
    name: 'Colonial Revival',
    category: 'Residential',
    description: 'Style: Colonial Revival. Architectural vocabulary of symmetry, shutters, dormers. Material palette of brick, siding with secondary materials like shingles. Lighting favors daylight. Overall mood is traditional, stately.',
    previewUrl: 'https://images.unsplash.com/photo-1605276373954-0c4a0dac5b12?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['symmetry', 'shutters', 'dormers', 'columns'],
      materialBias: { primary: ['brick', 'siding'], secondary: ['shingles'], avoid: ['modern'] },
      lightingBias: { preferred: ['daylight'], avoid: ['neon'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['centered'] },
      renderingLanguage: { quality: ['classic'], atmosphere: ['traditional', 'stately'], detail: ['trim'] }
    }
  },
  {
    id: 'ranch',
    name: 'Ranch Style',
    category: 'Residential',
    description: 'Style: Ranch Style. Architectural vocabulary of single story, horizontal, low roof. Material palette of brick, wood with secondary materials like glass. Lighting favors sunny. Overall mood is relaxed, spacious.',
    previewUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['single story', 'horizontal', 'low roof', 'patio'],
      materialBias: { primary: ['brick', 'wood'], secondary: ['glass'], avoid: ['vertical'] },
      lightingBias: { preferred: ['sunny'], avoid: ['gloomy'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['wide'] },
      renderingLanguage: { quality: ['suburban'], atmosphere: ['relaxed', 'spacious'], detail: ['horizontal'] }
    }
  },
  {
    id: 'swiss-chalet',
    name: 'Swiss Chalet',
    category: 'Residential',
    description: 'Style: Swiss Chalet. Architectural vocabulary of wide eaves, balconies, decorative carving. Material palette of wood with secondary materials like stone. Lighting favors bright light. Overall mood is alpine, charming.',
    previewUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['wide eaves', 'balconies', 'decorative carving', 'gables'],
      materialBias: { primary: ['wood'], secondary: ['stone'], avoid: ['concrete'] },
      lightingBias: { preferred: ['bright'], avoid: ['dark'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['scenic'] },
      renderingLanguage: { quality: ['picturesque'], atmosphere: ['alpine', 'charming'], detail: ['carving'] }
    }
  },
  {
    id: 'pueblo',
    name: 'Pueblo Revival',
    category: 'Residential',
    description: 'Style: Pueblo Revival. Architectural vocabulary of adobe, rounded edges, flat roof. Material palette of stucco, wood with secondary materials like tile. Lighting favors sunlight. Overall mood is desert, soft.',
    previewUrl: 'https://images.unsplash.com/photo-1534237710431-e2fc698436d0?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['adobe', 'rounded edges', 'flat roof', 'vigas'],
      materialBias: { primary: ['stucco', 'wood'], secondary: ['tile'], avoid: ['siding'] },
      lightingBias: { preferred: ['sunlight'], avoid: ['cloudy'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['landscape'] },
      renderingLanguage: { quality: ['warm'], atmosphere: ['desert', 'soft'], detail: ['texture'] }
    }
  },
  {
    id: 'greek-revival',
    name: 'Greek Revival',
    category: 'Historical',
    description: 'Style: Greek Revival. Architectural vocabulary of temple front, columns, pediment. Material palette of wood, stucco with secondary materials like stone. Lighting favors bright light. Overall mood is historic, formal.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Best_Lucas_House_-_Galveston.jpg',
    promptBundle: {
      architectureVocabulary: ['temple front', 'columns', 'pediment', 'white'],
      materialBias: { primary: ['wood', 'stucco'], secondary: ['stone'], avoid: ['brick'] },
      lightingBias: { preferred: ['bright'], avoid: ['dark'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['symmetrical'] },
      renderingLanguage: { quality: ['stately'], atmosphere: ['historic', 'formal'], detail: ['columns'] }
    }
  },
  {
    id: 'italianate',
    name: 'Italianate',
    category: 'Historical',
    description: 'Style: Italianate. Architectural vocabulary of brackets, tall windows, low roof. Material palette of brick, stucco with secondary materials like iron. Lighting favors warm light. Overall mood is elegant, tall.',
    previewUrl: 'https://images.unsplash.com/photo-1572953109213-3be62398eb95?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['brackets', 'tall windows', 'low roof', 'cupola'],
      materialBias: { primary: ['brick', 'stucco', 'wood'], secondary: ['iron'], avoid: ['glass'] },
      lightingBias: { preferred: ['warm'], avoid: ['cool'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['vertical'] },
      renderingLanguage: { quality: ['ornate'], atmosphere: ['elegant', 'tall'], detail: ['brackets'] }
    }
  },
  {
    id: 'futuristic-organic',
    name: 'Futuristic Organic',
    category: 'Conceptual',
    description: 'Style: Futuristic Organic. Architectural vocabulary of fluid, seamless, curved. Material palette of corian, fiberglass with secondary materials like glass. Lighting favors diffused light. Overall mood is future, clean.',
    previewUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['fluid', 'seamless', 'curved', 'white'],
      materialBias: { primary: ['corian', 'fiberglass', 'concrete'], secondary: ['glass'], avoid: ['brick'] },
      lightingBias: { preferred: ['diffused'], avoid: ['hard shadows'] },
      cameraBias: { preferredAngles: ['dynamic'], preferredFraming: ['flowing'] },
      renderingLanguage: { quality: ['pristine'], atmosphere: ['future', 'clean'], detail: ['smooth'] }
    }
  },
  {
    id: 'cyber-organic',
    name: 'Cyber-Organic',
    category: 'Conceptual',
    description: 'Style: Cyber-Organic. Architectural vocabulary of tech, biology, integrated. Material palette of bioplastic, metal with secondary materials like light. Lighting favors glowing. Overall mood is hybrid, advanced.',
    previewUrl: 'https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['tech', 'biology', 'integrated', 'complex'],
      materialBias: { primary: ['bioplastic', 'metal'], secondary: ['light'], avoid: ['traditional'] },
      lightingBias: { preferred: ['glowing'], avoid: ['flat'] },
      cameraBias: { preferredAngles: ['close-up'], preferredFraming: ['detail'] },
      renderingLanguage: { quality: ['complex'], atmosphere: ['hybrid', 'advanced'], detail: ['structure'] }
    }
  }
];

const formatTimePreset = (preset: string): string => {
  const timeDescriptions: Record<string, string> = {
    'pre-dawn': 'pre-dawn twilight with deep blue sky',
    'sunrise': 'sunrise with warm orange and pink tones',
    'early-morning': 'early morning with soft golden light',
    'high-noon': 'high noon with direct overhead sunlight',
    'late-afternoon': 'late afternoon with warm directional light',
    'golden-hour': 'golden hour with rich amber tones',
    'sunset-glow': 'sunset glow with dramatic warm colors',
    'blue-hour': 'blue hour with cool twilight atmosphere',
    'moonlit-night': 'moonlit night scene with artificial lighting',
  };
  return timeDescriptions[preset] || preset.replace(/-/g, ' ');
};

const formatContextPreset = (preset: string): string => {
  return preset.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const formatViewType = (viewType: string): string => {
  const viewDescriptions: Record<string, string> = {
    'passenger-pov': 'passenger point-of-view perspective',
    'concourse-walk': 'concourse corridor perspective',
    'atrium-overview': 'atrium overview from ground level',
    'gate-seating': 'seated gate waiting view',
    'lounge-interior': 'lounge interior seated angle',
    'mezzanine-view': 'mezzanine view from upper level',
    'drone-low': 'low-altitude drone perspective',
    'drone-high': 'high-altitude drone overview',
    'section-cut': 'architectural section cut view',
    'spherical-360': '360-degree spherical panorama',
    'perspective': 'perspective view',
    'orthographic': 'orthographic view',
    'isometric': 'isometric view',
    'section': 'section view',
    'elevation': 'elevation view',
  };
  return viewDescriptions[viewType] || viewType.replace(/-/g, ' ');
};

const formatMood = (mood: string): string => {
  const moodDescriptions: Record<string, string> = {
    'natural': 'natural balanced tones',
    'warm': 'warm inviting atmosphere',
    'cool': 'cool contemporary feel',
    'dramatic': 'dramatic high-contrast lighting',
    'soft': 'soft diffused ambiance',
    'moody': 'moody atmospheric shadows',
    'luxury': 'luxurious high-end finish',
    'cinematic': 'cinematic wide dynamic range',
    'hazy': 'hazy atmospheric depth',
    'crisp': 'crisp sharp clarity',
    'stormy': 'stormy dramatic skies',
    'noir': 'noir-style dramatic shadows',
  };
  return moodDescriptions[mood] || mood;
};

// ============================================================================
// DESCRIPTIVE LANGUAGE HELPERS
// These functions convert technical values into natural, human-like descriptions
// that work better with AI image generation models
// ============================================================================

// ============================================================================
// ENHANCED DESCRIPTION HELPERS - Granular architectural visualization language
// ============================================================================

const describeLightSourcePosition = (azimuth: number, elevation: number): string => {
  const leftRight = Math.min(1, Math.max(0, azimuth / 360));
  const frontBack = Math.min(1, Math.max(0, elevation / 90));

  const horizontal =
    leftRight < 0.2 ? 'far left of the image'
      : leftRight < 0.4 ? 'left side of the image'
        : leftRight > 0.8 ? 'far right of the image'
          : leftRight > 0.6 ? 'right side of the image'
            : 'center of the image';

  const depth =
    frontBack > 0.8 ? 'strongly from the front, near the observer or camera'
      : frontBack > 0.6 ? 'from the front of the scene, toward the observer'
        : frontBack < 0.2 ? 'strongly from the back of the scene, behind the visible subject'
          : frontBack < 0.4 ? 'from the back of the scene, deeper in the image'
            : 'from a neutral mid-depth position in the scene';

  const frameDirection = (() => {
    if (horizontal === 'center of the image') {
      if (frontBack > 0.6) return 'front';
      if (frontBack < 0.4) return 'back';
      return 'centered';
    }
    const side = horizontal.includes('left') ? 'left' : 'right';
    if (frontBack > 0.6) return `front-${side}`;
    if (frontBack < 0.4) return `back-${side}`;
    return side;
  })();

  const lightingEffect: Record<string, string> = {
    front: 'visible faces should brighten evenly, with shadows pushed subtly behind objects',
    back: 'the scene should gain backlight, rim highlights, and shadows falling toward the viewer',
    centered: 'illumination should feel centered and balanced from the viewer direction',
    left: 'shadows should travel across the frame toward the right',
    right: 'shadows should travel across the frame toward the left',
    'front-left': 'visible faces should catch light from image-left and the camera side, with shadows falling back and right',
    'front-right': 'visible faces should catch light from image-right and the camera side, with shadows falling back and left',
    'back-left': 'the image-left rear should act as the source, producing backlit edges and shadows toward the front-right',
    'back-right': 'the image-right rear should act as the source, producing backlit edges and shadows toward the front-left',
  };

  const sideApertureInstruction = (() => {
    if (!frameDirection.includes('left') && !frameDirection.includes('right')) return '';
    const side = frameDirection.includes('left') ? 'image-left' : 'image-right';
    const opposite = frameDirection.includes('left') ? 'right' : 'left';
    return `For interior or terminal scenes, physically anchor this light to existing ${side} apertures: doors, glazed entries, windows, curtain wall openings, or bright exterior portals visible in the source image. If the source shows a sign above or near that ${side} aperture, treat the doorway/glazing under that sign as the believable light entry point, but preserve the sign text exactly. The brightest glow, floor highlights, and first contact shadows should originate from that ${side} opening and fall naturally toward image-${opposite}.`;
  })();

  return `primary light source placed camera-relative from the ${frameDirection} (${horizontal}, ${depth}). Treat Front as camera-side, Back as the deeper scene, Left as image-left, and Right as image-right, not as a geographic compass angle. ${lightingEffect[frameDirection]}. ${sideApertureInstruction}`;
};

const describeSunIntensity = (intensity: number): string => {
  if (intensity < 15) return 'very soft diffused sunlight';
  if (intensity < 30) return 'gentle sunlight';
  if (intensity < 50) return 'balanced sunlight';
  if (intensity < 70) return 'clear strong sunlight';
  if (intensity < 85) return 'bright direct sunlight';
  return 'intense direct sunlight, controlled to avoid blown highlights';
};

const describeColorTemperature = (kelvin: number): string => {
  if (kelvin < 2700) return 'deep warm amber light';
  if (kelvin < 3200) return 'warm interior light';
  if (kelvin < 4000) return 'warm golden daylight';
  if (kelvin < 4500) return 'neutral-warm daylight';
  if (kelvin < 5500) return 'neutral daylight';
  if (kelvin < 6500) return 'clean cool daylight';
  if (kelvin < 7500) return 'cool blue daylight';
  return 'cold blue overcast light';
};

const describeShadows = (intensity: number): string => {
  const intensityDesc = intensity > 80
    ? 'deep cast shadows'
    : intensity > 60
      ? 'clear cast shadows'
      : intensity > 40
        ? 'balanced cast shadows'
        : intensity > 20
          ? 'light cast shadows'
          : 'minimal cast shadows';

  return `${intensityDesc}, grounded to scene geometry and consistent with the selected light direction`;
};

const describeLens = (mm: number): string => {
  if (mm < 18) return `an extreme wide ${mm}mm architectural lens with corrected verticals`;
  if (mm < 24) return `a wide ${mm}mm interior lens with controlled distortion`;
  if (mm < 28) return `a wide-angle ${mm}mm architectural lens`;
  if (mm < 35) return `a moderate wide ${mm}mm lens`;
  if (mm < 50) return `a natural ${mm}mm lens`;
  if (mm < 70) return `a short telephoto ${mm}mm lens with slight facade compression`;
  if (mm < 100) return `a medium telephoto ${mm}mm lens`;
  if (mm < 150) return `a telephoto ${mm}mm lens`;
  return `a long telephoto ${mm}mm lens with strong compression`;
};

const describeAtmosphericMood = (mood: string): string => {
  const moodDescriptions: Record<string, string> = {
    'natural': 'a balanced, true-to-life atmosphere',
    'warm': 'an inviting, cozy warmth suffusing the scene',
    'cool': 'a refreshing, contemporary coolness',
    'dramatic': 'bold, theatrical lighting with striking contrasts',
    'soft': 'gentle, embracing light that flatters every surface',
    'moody': 'atmospheric shadows creating depth and mystery',
    'luxury': 'refined, high-end illumination suggesting opulence',
    'cinematic': 'film-quality lighting with dramatic presence',
    'hazy': 'dreamy atmospheric haze adding depth and romance',
    'crisp': 'crystal-clear air with sharp definition',
    'stormy': 'dramatic weather bringing tension and energy',
    'noir': 'deep shadows and highlights in classic noir style',
  };

  return moodDescriptions[mood] || mood;
};

const describeFog = (density: number): string => {
  if (density < 20) return 'a whisper of atmospheric haze adding subtle depth';
  if (density < 40) return 'gentle fog creating soft atmospheric perspective';
  if (density < 60) return 'noticeable mist enveloping distant elements';
  if (density < 80) return 'thick fog dramatically obscuring the background';
  return 'dense, enveloping fog creating an ethereal, mysterious atmosphere';
};

const describeBloom = (intensity: number): string => {
  if (intensity < 25) return 'subtle light bloom around bright sources';
  if (intensity < 50) return 'gentle glow emanating from highlights';
  if (intensity < 75) return 'prominent bloom creating a dreamy quality';
  return 'intense, radiant bloom suffusing bright areas with light';
};

const describePeopleActivity = (count: number): string => {
  if (count < 10) return 'a few carefully placed figures adding human scale';
  if (count < 30) return 'a modest gathering of people bringing life to the space';
  if (count < 60) return 'a lively crowd animating the scene';
  return 'a bustling throng of people creating urban energy';
};

const describeVegetation = (count: number): string => {
  if (count < 20) return 'minimal landscaping with carefully selected plants';
  if (count < 40) return 'thoughtful greenery complementing the architecture';
  if (count < 60) return 'abundant vegetation creating a garden-like atmosphere';
  if (count < 80) return 'lush, verdant landscaping embracing the building';
  return 'profuse, almost wild vegetation integrating nature and architecture';
};

const describeResolution = (res: string): string => {
  const descriptions: Record<string, string> = {
    '720p': 'rendered at HD resolution for quick visualization',
    '1080p': 'rendered in Full HD with clean detail',
    '4k': 'rendered in 4K with clear existing detail',
    'print': 'rendered at print-ready resolution for large-format reproduction',
  };
  return descriptions[res] || res;
};

const describeAspectRatio = (ratio: string): string => {
  const descriptions: Record<string, string> = {
    '16:9': 'in widescreen format',
    '4:3': 'in classic standard format',
    '1:1': 'in balanced square format',
    '3:2': 'in traditional photography format',
    '21:9': 'in panoramic format',
    '9:16': 'in vertical portrait format',
  };
  return descriptions[ratio] || `in ${ratio} format`;
};

const normalizeRenderGenerationMode = (mode: unknown): RenderGenerationMode => {
  return RENDER_GENERATION_MODES.includes(mode as RenderGenerationMode)
    ? mode as RenderGenerationMode
    : DEFAULT_RENDER_GENERATION_MODE;
};

const describeRenderMode = (mode: string): string => {
  const normalizedMode = normalizeRenderGenerationMode(mode);
  const descriptions: Record<RenderGenerationMode, string> = {
    'strict-realism': [
      'Render mode: strict realism.',
      'Convert the source into a believable architectural photograph.',
      'Keep architecture, camera, scale, proportions, openings, stairs, columns, ceilings, signage blocks, and major object placement anchored to the source.',
      'Use plausible light, grounded shadows, natural reflections, realistic materials, and clean camera behavior.',
      'Do not redesign, stylize, exaggerate, simplify into graphics, invent alternate forms, or add decorative ideas that are not grounded in the source.'
    ].join(' '),
    'enhance': [
      'Render mode: enhance.',
      'Re-render the existing standard or CGI architectural render as a hyper-realistic architectural photograph.',
      'Preserve the exact camera, crop, perspective, architecture, geometry, material identity, signage/text positions, furniture, people, object layout, and spatial relationships.',
      'Replace the synthetic render look with photographic lighting, realistic material response, natural shadows, believable reflections, lens behavior, texture clarity, and clean detail.',
      'Do not remodel the project, change the design language, replace major elements, alter text/signage, add new objects, remove existing objects, or invent new architecture.'
    ].join(' '),
    'concept-push': [
      'Render mode: concept push.',
      'Create an architectural concept image rather than a literal photograph.',
      'Keep the source recognizable through massing, camera angle, spatial organization, and key design intent.',
      'Allow bolder interpretation of secondary forms, materials, lighting, atmosphere, and entourage.',
      'Do not drift into an unrelated building or ignore the source composition.'
    ].join(' '),
  };
  return descriptions[normalizedMode];
};

const describeRenderModeClosing = (mode: string, resolution: string): string => {
  const normalizedMode = normalizeRenderGenerationMode(mode);
  const isHighResolution = resolution === '4k' || resolution === 'print';

  if (normalizedMode === 'strict-realism') {
    return isHighResolution
      ? 'Finish as a clean architectural photograph with source-faithful detail and no visible model or viewport artifacts.'
      : 'Finish as a believable architectural photograph with accurate light, natural materials, and no viewport artifacts.';
  }

  if (normalizedMode === 'enhance') {
    return isHighResolution
      ? 'Finish as the same completed render, but re-rendered as a clean hyper-realistic architectural photograph with no obvious CGI or viewport artifacts.'
      : 'Finish as the same image, but more photorealistic, cleaner, better lit, sharper, and materially believable.';
  }

  return isHighResolution
    ? 'Finish as a clear artificial concept visualization with readable design intent.'
    : 'Finish as a clear, intentionally artificial concept render.';
};

const describeSourceFidelityForRenderMode = (mode: string): string => {
  const normalizedMode = normalizeRenderGenerationMode(mode);
  if (normalizedMode === 'concept-push') {
    return 'Use the source as a spatial and compositional scaffold. Preserve the primary layout, major walls, openings, circulation, massing, and camera direction, but allow concept-level interpretation of secondary details, material language, lighting, styling, and entourage. Do not rotate, crop, or ignore the source.';
  }
  return 'Treat the source as the absolute source of truth. Every wall position, opening, grid line, dimensional relationship, camera angle, horizon, and perspective relationship must be preserved exactly. Do not rotate, skew, crop, reframe, add, remove, relocate, or redesign architectural elements.';
};

const getStyleReferenceInstruction = (hasSourceImage: boolean): string => {
  const imageOrder = hasSourceImage
    ? 'provided immediately after the source image'
    : 'provided as an input image';
  return `Style reference: a style image is ${imageOrder}. Use it only for rendering medium, color grade, contrast, material finish, lighting character, atmosphere, and camera polish. Do not copy its scene, subject, composition, background, furniture, people, signage, logos, or geometry. Transfer style cues, not content.`;
};

const getEnvironmentReferenceInstruction = (): string =>
  'Environment reference: use the reference photo only for time of day, sky, ambient color, haze, weather mood, and color grade. Do not paste it as a backdrop. Integrate the architecture with matching horizon, shadow direction, atmospheric depth, ground plane, and color so the result reads as one image, not a collage.';

const SOURCE_CAMERA_LOCK = [
  'Camera lock: keep the source view, crop, horizon, perspective, scale, and lens behavior unless a new camera is requested.'
].join(' ');

const SOURCE_TEXT_SIGNAGE_LOCK = [
  'Text lock: preserve existing words, labels, logos, numbers, and signage as source-faithful marks; add new text only when explicitly quoted.'
].join(' ');

const UNCHANGED_CONTENT_LOCK = [
  'Unchanged content lock: preserve unaffected layout, objects, geometry, material boundaries, shadows, reflections, and scale relationships.'
].join(' ');

const buildSourceImageRelationship = (
  role: string,
  scope = 'Use the source as the authoritative visual blueprint.'
) => [
  `Input relationship: the first attached image is the locked ${role}.`,
  scope,
  SOURCE_CAMERA_LOCK,
  SOURCE_TEXT_SIGNAGE_LOCK,
  UNCHANGED_CONTENT_LOCK
].join(' ');

const buildReferenceStackRelationship = (referenceRole: string) => [
  `Reference relationship: attachment #1 is the locked source image; later attachments are ${referenceRole}.`,
  'Use reference images only for their stated role: material, object identity, mood, style, or endpoint frame.'
].join(' ');

const TEXT_TO_IMAGE_FRAMEWORK = [
  'Prompting framework: turn the brief into one concrete visual scene with subject, setting, composition, lighting, materiality, and style.',
  'If visible text is requested, render only exact quoted copy with clean placement and hierarchy.'
].join(' ');

// Generate comprehensive prompt for 3D Render mode
function generate3DRenderPrompt(state: AppState): string {
  const { workflow, activeStyleId, customStyles } = state;
  const r3d = workflow.render3d;
  const hasSourceImage = Boolean(state.sourceImage || state.uploadedImage);
  const hasStyleReference = Boolean(workflow.styleReferenceEnabled && workflow.styleReferenceImage);
  const renderMode: RenderGenerationMode = workflow.renderMode === 'enhance'
    ? 'enhance'
    : DEFAULT_RENDER_GENERATION_MODE;
  const render3dSourceMode = workflow.render3dSourceMode || DEFAULT_RENDER3D_SOURCE_MODE;
  const isAlterRenderingMode = render3dSourceMode === 'alter-rendering';
  const isEnhanceMode = !isAlterRenderingMode && renderMode === 'enhance';

  const availableStyles = [...BUILT_IN_STYLES, ...(customStyles ?? [])];
  const style = availableStyles.find(s => s.id === activeStyleId);
  const isNoStyle = !hasStyleReference && style?.id === 'no-style';

  const parts: string[] = [];

  // 1. SUBJECT & SOURCE
  if (isEnhanceMode) {
    parts.push('Enhance the existing rendered architectural image into a hyper-realistic architectural photograph.');
    if (hasSourceImage) {
      parts.push(buildSourceImageRelationship(
        'existing rendered image',
        'Treat the source as a completed standard or CGI render that must be re-rendered more realistically. Preserve the exact composition, crop, camera, architecture, geometry, materials, signage/text positions, people, furniture, objects, and spatial relationships.'
      ));
    } else {
      parts.push(TEXT_TO_IMAGE_FRAMEWORK);
    }
    parts.push(describeRenderMode(renderMode));
    parts.push('Use only the source image to infer the intended lighting, materials, color, entourage, and scene context. Ignore any hidden style, lighting, atmosphere, scenery, source-type, view-type, or render-format controls as change requests.');
    parts.push(describeRenderModeClosing(renderMode, '1080p'));
    return parts.filter(p => p.trim()).join(' ');
  }

  const sourceDescriptions: Record<string, string> = {
    'rhino': 'a Rhino 3D model',
    'revit': 'a Revit BIM model',
    'sketchup': 'a SketchUp model',
    'blender': 'a Blender scene',
    '3dsmax': 'a 3ds Max scene',
    'archicad': 'an ArchiCAD model',
    'cinema4d': 'a Cinema 4D scene',
    'clay': 'a clean clay render as the foundation',
    'other': 'a 3D architectural model',
  };

  const viewDescriptions: Record<string, string> = {
    'exterior': 'Create an exterior architectural render showing the building in its setting',
    'interior': 'Create an interior architectural render showing spatial quality and atmosphere',
    'aerial': 'Create an aerial architectural render showing form and context',
    'detail': 'Create a detail render focused on the selected architectural element',
  };

  if (isAlterRenderingMode) {
    parts.push('Alter the latest rendered architectural image with restrained, source-faithful adjustments.');
    if (hasSourceImage) {
      parts.push(buildSourceImageRelationship(
        'latest rendered image',
        'Treat the source as an approved render that should remain recognizable as the same image. Preserve the exact composition, crop, camera, architecture, geometry, material identity, signage/text positions, furniture, people, objects, and spatial relationships. Apply style, lighting, atmosphere, and render-quality changes as subtle refinements, color grade, accents, and polish rather than a full redesign or fresh re-render.'
      ));
    } else {
      parts.push(TEXT_TO_IMAGE_FRAMEWORK);
    }
  } else {
    const viewIntro = viewDescriptions[workflow.viewType] || 'Create an architectural render';
    parts.push(`${viewIntro}, rendered from ${sourceDescriptions[workflow.sourceType] || 'a 3D architectural model'}.`);
    if (hasSourceImage) {
      parts.push(buildSourceImageRelationship(
        '3D/render source',
        'Convert or enhance what is already present in the source; keep the architectural design, spatial relationships, major entourage, and composition anchored to that image.'
      ));
    } else {
      parts.push(TEXT_TO_IMAGE_FRAMEWORK);
    }
  }

  // 2. STYLE
  if (hasStyleReference) {
    parts.push(isAlterRenderingMode
      ? 'Style reference: use the reference image only as a gentle color, material, contrast, lighting, and atmosphere influence. Do not copy its content or replace the approved render style wholesale.'
      : getStyleReferenceInstruction(hasSourceImage));
  } else if (!isNoStyle && style) {
    parts.push(isAlterRenderingMode
      ? `Subtle style adjustment: borrow light accents from this style without replacing the approved render: ${style.description}`
      : style.description);
    if (style.promptBundle?.renderingLanguage?.atmosphere) {
      const atmosphereWords = style.promptBundle.renderingLanguage.atmosphere;
      parts.push(isAlterRenderingMode
        ? `Nudge the atmosphere toward ${atmosphereWords.slice(0, -1).join(', ')}${atmosphereWords.length > 1 ? ' and ' : ''}${atmosphereWords[atmosphereWords.length - 1]} while keeping the same render identity.`
        : `The overall feeling should be ${atmosphereWords.slice(0, -1).join(', ')}${atmosphereWords.length > 1 ? ' and ' : ''}${atmosphereWords[atmosphereWords.length - 1]}.`);
    }
  }

  // 3. GENERATION MODE
  parts.push(isAlterRenderingMode
    ? 'Render flow: alter rendering. Keep the current image mostly intact and adjust only the visible rendering treatment. Do not rebuild from the original model, change geometry, replace major materials, rearrange objects, add new entourage, remove existing content, or reinterpret the design.'
    : describeRenderMode(renderMode));

  // 5. LIGHTING
  const light = r3d.lighting;
  const lightParts: string[] = [];

  lightParts.push(`The scene is illuminated by ${formatTimePreset(light.preset)}`);

  if (light.sun.enabled) {
    lightParts.push(`. ${describeLightSourcePosition(light.sun.azimuth, light.sun.elevation)}`);
    lightParts.push(` with ${describeColorTemperature(light.sun.colorTemp)}`);
  }

  parts.push(`${lightParts.join('')}.`);

  // 8. ATMOSPHERE & MOOD
  const atm = r3d.atmosphere;
  parts.push(`The atmosphere conveys ${describeAtmosphericMood(atm.mood)}.`);

  if (atm.fog.enabled) {
    parts.push(describeFog(atm.fog.density) + '.');
  }

  if (atm.bloom.enabled) {
    parts.push(`Light sources and bright areas have ${describeBloom(atm.bloom.intensity)}.`);
  }

  // 9. SCENERY & CONTEXT
  if (isAlterRenderingMode) {
    parts.push('Preserve the existing setting, entourage, furniture, planting, vehicles, and object count. Do not use scenery controls as permission to add or remove content.');
  } else {
    const scene = r3d.scenery;
    const sceneParts: string[] = [];

    const contextDescriptions: Record<string, string> = {
      'urban': 'set within a vibrant urban environment',
      'suburban': 'nestled in a peaceful suburban neighborhood',
      'rural': 'situated in a serene rural landscape',
      'coastal': 'positioned along a coastal setting',
      'forest': 'embraced by a natural forest environment',
      'mountain': 'set against a dramatic mountain backdrop',
      'desert': 'placed in an expansive desert landscape',
    };
    sceneParts.push(`The building is ${contextDescriptions[scene.preset] || `in a ${formatContextPreset(scene.preset)} setting`}`);

    if (scene.people.enabled) {
      sceneParts.push(`, with ${describePeopleActivity(scene.people.count)}`);
    }

    if (scene.trees.enabled) {
      sceneParts.push(`, complemented by ${describeVegetation(scene.trees.count)}`);
    }

    if (scene.cars.enabled) {
      sceneParts.push(', with realistically placed vehicles adding to the sense of place');
    }

    parts.push(`${sceneParts.join('')}.`);
  }

  // 9b. BACKGROUND REFERENCE - Environment matching instruction
  if (workflow.backgroundReferenceEnabled && workflow.backgroundReferenceImage) {
    parts.push(getEnvironmentReferenceInstruction());
  }

  // 10. RENDER FORMAT & OUTPUT
  const rend = r3d.render;
  parts.push(isAlterRenderingMode
    ? 'Keep the same crop, framing, aspect ratio, perspective, and camera behavior as the attached render.'
    : `${describeResolution(rend.resolution)} ${describeAspectRatio(rend.aspectRatio)}, presented as a ${formatViewType(rend.viewType)}.`);

  // 11. TECHNICAL QUALITY
  parts.push(isAlterRenderingMode
    ? 'Finish as the same render with more refined lighting, tone, material response, and atmosphere, not as a new composition.'
    : describeRenderModeClosing(renderMode, rend.resolution));

  return parts.filter(p => p.trim()).join(' ');
}

const formatToggle = (value: boolean) => (value ? 'on' : 'off');

const summarizeMaterialAssignments = (assignments: Record<string, string>, limit = 6): string => {
  const entries = Object.entries(assignments || {})
    .filter(([, materialId]) => Boolean(materialId))
    .slice(0, limit)
    .map(([elementId, materialId]) => {
      const material = getMaterialById(materialId);
      return `${elementId}: ${material?.label || materialId}`;
    });
  const total = Object.keys(assignments || {}).length;
  if (!entries.length) return '';
  return `${entries.join('; ')}${total > limit ? '; additional assignments follow same logic' : ''}`;
};

const buildSelectionBounds = (
  shapes: VisualSelectionShape[],
  size?: { width: number; height: number } | null
) => {
  if (!shapes.length) return [];
  return shapes
    .map((shape) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let pointsCount = 0;

      if (shape.type === 'rect') {
        minX = Math.min(shape.start.x, shape.end.x);
        minY = Math.min(shape.start.y, shape.end.y);
        maxX = Math.max(shape.start.x, shape.end.x);
        maxY = Math.max(shape.start.y, shape.end.y);
        pointsCount = 2;
      } else {
        const points = shape.points || [];
        pointsCount = points.length;
        points.forEach((point) => {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        });
        if (shape.type === 'brush') {
          const pad = (shape.brushSize || 0) / 2;
          minX -= pad;
          minY -= pad;
          maxX += pad;
          maxY += pad;
        }
      }

      if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        return null;
      }

      const width = Math.max(0, maxX - minX);
      const height = Math.max(0, maxY - minY);
      const normalize = (value: number, max: number) =>
        max > 0 ? Number((value / max).toFixed(4)) : Number(value.toFixed(2));

      const box = size
        ? {
            x: normalize(minX, size.width),
            y: normalize(minY, size.height),
            w: normalize(width, size.width),
            h: normalize(height, size.height),
          }
        : {
            x: Number(minX.toFixed(2)),
            y: Number(minY.toFixed(2)),
            w: Number(width.toFixed(2)),
            h: Number(height.toFixed(2)),
          };

      return {
        type: shape.type,
        points: pointsCount,
        box,
      };
    })
    .filter((item) => item);
};

type SelectionContextRole = 'edit' | 'preserve' | 'guide';

const buildSelectionContext = (workflow: AppState['workflow'], role: SelectionContextRole = 'edit') => {
  const selectionCount = workflow.visualSelections.length;
  const parts: string[] = [];

  if (selectionCount === 0) {
    parts.push(
      role === 'preserve'
        ? 'No protected area has been selected, so background replacement should be applied thoughtfully where appropriate.'
        : role === 'guide'
          ? 'No specific target area has been selected, so infer the best edit target from the tool settings and user instruction while preserving unrelated scene content.'
        : 'No specific area has been selected, so the edits should be applied thoughtfully across the entire image where appropriate.'
    );
  } else {
    const summary = workflow.visualSelections.reduce(
      (acc, shape) => {
        acc[shape.type] = (acc[shape.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const shapeDescriptions: Record<string, string> = {
      rect: 'rectangular region',
      ellipse: 'elliptical area',
      polygon: 'custom polygon shape',
      brush: 'hand-painted area',
      lasso: 'freeform selection',
    };
    const summaryParts = Object.entries(summary).map(([type, count]) =>
      count === 1 ? `a ${shapeDescriptions[type] || type}` : `${count} ${shapeDescriptions[type] || type}s`
    );

    if (role === 'preserve') {
      parts.push(`The user has carefully selected ${summaryParts.join(' and ')} to define the protected region that must remain unchanged. Apply edits only outside this selected region, respecting its exact boundaries rather than using a simplified bounding box.`);
    } else if (role === 'guide') {
      parts.push(`The user has selected ${summaryParts.join(' and ')} as spatial guidance for the primary target area. Use the selection to identify where the edit belongs, but do not treat the boundary as a hard cutout or paste edge; allow natural reconstruction and blending slightly beyond it when needed.`);
    } else {
      parts.push(`The user has selected ${summaryParts.join(' and ')} to indicate the intended target area. Use the selection to identify what should change, but do not treat its outline as a literal cut line; allow natural reconstruction and blending slightly beyond it when needed.`);
    }

    if (workflow.visualSelectionMask) {
      parts.push(
        role === 'preserve'
          ? 'A selection mask is provided to identify the protected selected region; the app may invert it before editing so only unselected pixels are changed.'
          : role === 'guide'
            ? 'A selection mask is provided as target guidance. White areas indicate the user intended focus area, but the final edit must blend naturally and must not show the mask, a white patch, an outline, or a hard-edged silhouette.'
          : 'A selection mask is provided as target guidance. White areas indicate the intended focus area, but they are not a hard output boundary and must not appear as a visible edge.'
      );
    }

    const bounds = buildSelectionBounds(workflow.visualSelections, workflow.visualSelectionMaskSize);
    if (bounds.length > 0) {
      parts.push(
        role === 'guide'
          ? `Selection geometry summary in normalized image coordinates for reference only; use it as target guidance rather than a literal output boundary: ${JSON.stringify(bounds)}.`
          : role === 'preserve'
            ? `Selection geometry summary in normalized image coordinates for reference only; the protected mask remains authoritative: ${JSON.stringify(bounds)}.`
            : `Selection geometry summary in normalized image coordinates for reference only; use it as target guidance rather than a literal output boundary: ${JSON.stringify(bounds)}.`
      );
    }
  }

  const autoTargets = workflow.visualSelection.autoTargets;
  if (autoTargets.length > 0) {
    parts.push(`The selection should intelligently target ${autoTargets.join(', ')}.`);
  }

  if (workflow.visualSelection.featherEnabled && workflow.visualSelection.featherAmount > 0) {
    const featherDesc = workflow.visualSelection.featherAmount > 50
      ? 'heavily feathered edges that blend very gradually into surrounding areas'
      : workflow.visualSelection.featherAmount > 20
        ? 'softly feathered edges for natural blending'
        : 'slightly feathered edges for subtle transitions';
    parts.push(`The selection has ${featherDesc}.`);
  }

  parts.push(
    role === 'preserve'
      ? 'Fundamental constraints: maintain the original camera angle, perspective, and overall composition. Preserve every pixel inside the selected region exactly. Confine modifications strictly to the unselected background/tool scope and blend naturally at the selection edge.'
      : role === 'guide'
        ? 'Fundamental constraints: maintain the original camera angle, perspective, and overall composition. Keep edits focused on the selected target area while preserving unrelated architecture, layout, materials, people, and signage. Natural texture continuation, cleanup, reflections, contact shadows, and occlusion may extend slightly beyond the selection only when required for a seamless result.'
      : 'Fundamental constraints: maintain the original camera angle, perspective, and overall composition. Keep modifications focused on the intended selected target or tool scope while leaving unrelated architectural elements, layout, people, signage, and materials untouched. Let edges blend seamlessly and naturally into the surrounding image instead of following the drawn selection outline.'
  );

  return parts;
};

const buildRemoveSelectionTargeting = (workflow: AppState['workflow']) => {
  const hasSelection = workflow.visualSelections.length > 0 || Boolean(workflow.visualSelectionMask);
  const parts: string[] = [];

  if (!hasSelection) {
    parts.push('When no selection is provided, remove only targets clearly named by the user or quick-remove settings; do not broadly simplify the scene.');
    return parts;
  }

  parts.push('Removal target semantics: in each selected region, identify the complete foreground subject or subjects centered in or deliberately enclosed by the selection. Remove the whole subject, not merely the easiest visible subpart.');
  parts.push('If a selected target is a person, remove the entire human figure including head, torso, limbs, clothing, hair, pose silhouette, hands, feet, carried bags, wheeled luggage, straps, personal items, contact shadows, reflections, and any partial extension just outside the selection needed to eliminate the complete figure.');
  parts.push('Selected floor, walls, kiosks, ceilings, signs, and other background surfaces are context to reconstruct after the subject is removed unless they are themselves the clear selected subject.');
  parts.push('Do not leave a person behind after removing luggage, bags, shadows, or accessories; the central selected subject and attached personal items must disappear together.');

  return parts;
};

const generateVisualEditPrompt = (state: AppState): string => {
  const { workflow } = state;
  const tool = workflow.activeTool === 'replace' ? 'object' : workflow.activeTool;
  const selectionCount = workflow.visualSelections.length;
  const userPrompt = workflow.visualPrompt?.trim();
  const selectionParts = buildSelectionContext(workflow, 'guide');
  const parts: string[] = [];
  parts.push('Image editing framework: make only the requested change, then actively preserve everything else from the source image.');
  parts.push(buildSourceImageRelationship(
    'image being edited',
    'The requested target/tool scope is the intended focus of change; all unrelated scene content stays locked while local blending may extend as needed.'
  ));

  // User's creative intent
  const describeUserIntent = (prompt: string | undefined) => {
    if (prompt) {
      return `The user's vision for this edit: "${prompt}". Interpret this intent thoughtfully and execute it with precision.`;
    }
    return '';
  };

  if (tool === 'select') {
    const selectParts: string[] = [];
    const basePrompt = state.prompt?.trim();
    const personTarget = /\b(person|people|human|figure|man|woman|traveler|passenger|avatar|3d person|silhouette)\b/i.test(userPrompt || '');
    selectParts.push('Selection-guided target edit.');
    if (basePrompt) {
      selectParts.push(`Scene context only: "${basePrompt}".`);
    }
    if (userPrompt) {
      selectParts.push(`Edit instruction: "${userPrompt}".`);
    }
    selectParts.push('The selection mask is target guidance. Use it to identify the intended pixels, surface, object, or subject, but do not treat the drawn outline as a cut line.');
    selectParts.push('If the selected target naturally continues slightly beyond the selection, refine and blend those connected nearby pixels as needed so the final result does not reveal the selection shape.');
    if (personTarget) {
      selectParts.push('Person target rule: if the selection contains a plain white, clay, placeholder, silhouette, or low-quality 3D person, convert that exact selected figure into one realistic human. Preserve the original pose, scale, body orientation, ground contact, location, occlusion, and camera perspective. Match the existing scene lighting, shadow direction, color temperature, and render quality. Do not add any extra people, do not modify any other people, and do not change nearby architecture, signage, floor, furniture, vegetation, or background.');
    }
    selectParts.push('Preserve camera, crop, perspective, horizon, signage/text, architecture, materials, existing people outside the intended target, shadows, reflections, and overall composition.');
    selectParts.push('Blend the selected edit naturally at the boundary without showing the mask, lasso shape, outline, white patch, smudge, or pasted edge.');
    return selectParts.filter(Boolean).join(' ');
  }

  if (tool === 'material') {
    parts.push('Transform the surface materials indicated by the selection while preserving the underlying architectural form.');
    parts.push(...selectionParts);
    parts.push(describeUserIntent(userPrompt));

    const material = workflow.visualMaterial;
    const selectedMaterial = getMaterialById(material.materialId);
    const hasAuthoritativeSelection = selectionCount > 0 || Boolean(workflow.visualSelectionMask);
    if (hasAuthoritativeSelection) {
      parts.push('The selection indicates the intended material target. Use it to identify the surface or object to refinish, not as the exact visible edge of the material change.');
      parts.push('Treat the edit as a surface finish replacement on the existing target geometry. Continue the finish naturally over the connected visible target where needed, while preserving real object edges, seams, joints, perspective, reflections, and shadow structure.');
    } else {
      parts.push('No mask is provided, so infer the target only from the user instruction and modify only existing objects or surfaces that clearly match that target.');
      parts.push('For object-specific requests such as machines, counters, kiosks, appliances, panels, doors, or fixtures, change only the visible finish of those existing target objects. Do not edit surrounding queues, posts, belts, floors, walls, ceilings, signage, luggage, furniture, people, or reflections except for physically consistent reflections on the target object itself.');
      parts.push('If the target object is ambiguous, make the smallest conservative material-only change to the clearly matching area and leave all uncertain areas unchanged.');
    }

    // Describe material in natural language
    const materialDesc: string[] = [];
    if (material.referenceEnabled && material.referenceImage) {
      parts.push('Reference relationship: the uploaded material image defines finish only. Sample its color, grain, veining, aggregate, weave, reflectivity, and scale; do not paste the reference image, copy its lighting setup, or introduce its background as content.');
      materialDesc.push('Use the uploaded material reference image as the authoritative target finish');
      materialDesc.push('match its color palette, grain or aggregate pattern, texture scale, roughness, reflectivity, joint logic, seams, and surface wear without copying the reference image composition or adding it as an object');
    } else if (selectedMaterial) {
      materialDesc.push(`Apply ${selectedMaterial.label.toLowerCase()} as a ${selectedMaterial.category.toLowerCase()} finish`);
      materialDesc.push(selectedMaterial.modelPrompt);
    } else if (material.category && material.materialId) {
      materialDesc.push(`Apply a ${material.materialId} ${material.category} finish`);
    } else if (material.category) {
      materialDesc.push(`Apply a ${material.category} material`);
    }

    const roughnessDesc = material.roughness < 30 ? 'with a polished, reflective finish' :
      material.roughness < 60 ? 'with a natural surface texture' : 'with a matte, textured appearance';
    materialDesc.push(roughnessDesc);

    if (material.colorTint && material.colorTint !== '#ffffff') {
      materialDesc.push(`tinted with ${material.colorTint}`);
    }

    parts.push(`${materialDesc.join(', ')}.`);

    parts.push('Material lock: re-render the target finish as a physically integrated AI edit. Do not paste, tile, or overlay a flat texture image. Preserve geometry, edges, joints, seams, UV direction, adjacent materials, objects, positions, camera, lighting, shadows, reflections, and image clarity.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'lighting') {
    parts.push('Relight this scene to transform its mood and atmosphere while keeping all physical elements in place.');
    parts.push(...selectionParts);
    parts.push(describeUserIntent(userPrompt));

    const lighting = workflow.visualLighting;
    if (lighting.mode === 'sun') {
      parts.push(`Illuminate the scene with ${describeLightSourcePosition(lighting.sun.azimuth, lighting.sun.elevation)}. ${describeSunIntensity(lighting.sun.intensity)}, casting light with ${describeColorTemperature(lighting.sun.colorTemp)}.`);
      const shadowDesc = lighting.sun.shadowSoftness > 60 ? 'soft, diffused shadows' :
        lighting.sun.shadowSoftness > 30 ? 'moderately soft shadows' : 'crisp, defined shadows';
      parts.push(`Create ${shadowDesc}.`);
    } else if (lighting.mode === 'hdri') {
      const hdriDescriptions: Record<string, string> = {
        'studio': 'clean, professional studio lighting wrapping around the subject',
        'overcast': 'soft, even overcast sky light with gentle shadows',
        'sunset': 'warm, golden sunset illumination with rich color',
        'blue-hour': 'cool, ethereal blue hour lighting with magical quality',
        'interior': 'balanced interior lighting as through large windows',
      };
      const hdriDesc = hdriDescriptions[lighting.hdri.preset] || `${lighting.hdri.preset} environment lighting`;
      const intensityDesc = lighting.hdri.intensity > 80 ? 'bright and prominent' :
        lighting.hdri.intensity > 50 ? 'naturally balanced' : 'subtle and understated';
      parts.push(`Bathe the scene in ${hdriDesc}, rendered ${intensityDesc}.`);
    } else {
      const lightTypes: Record<string, string> = {
        'point': 'a focused point light source',
        'spot': 'a directional spotlight',
        'area': 'a soft area light',
        'linear': 'a linear light strip',
      };
      const typeDesc = lightTypes[lighting.artificial.type] || 'artificial lighting';
      parts.push(`Add ${typeDesc} with ${lighting.artificial.color} tones, creating ${lighting.artificial.falloff > 60 ? 'dramatic, rapid falloff' : 'gentle, gradual falloff'} from the light source.`);
    }

    const ambientDesc = lighting.ambient > 60 ? 'generous ambient fill preventing harsh shadows' :
      lighting.ambient > 30 ? 'moderate ambient fill for balanced contrast' : 'minimal ambient light allowing dramatic shadows';
    parts.push(`The scene should have ${ambientDesc}.`);

    if (lighting.preserveShadows) {
      parts.push('Preserve the essential character of existing shadows while adjusting the overall lighting.');
    }

    parts.push('Constraints: modify only the lighting. Do not replace the sky, alter any materials or textures, or change the geometry. Keep the camera position fixed. If a selection is active, use it as the lighting focus and allow smooth, natural falloff beyond the drawn edge.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'object') {
    const object = workflow.visualObject;
    const replace = workflow.visualReplace;
    const replacePrompt = replace.prompt?.trim();

    if (object.placementMode === 'replace') {
      parts.push('Replace the existing object indicated by the selection with a new one that fits naturally into the scene.');
      parts.push(...selectionParts);
      parts.push(describeUserIntent(userPrompt));

      if (replace.mode === 'similar') {
        const variationDesc = replace.variation > 60 ? 'with noticeable variety' :
          replace.variation > 30 ? 'with subtle variations' : 'closely matching the original';
        parts.push(`Find and replace with a similar object ${variationDesc}.`);
      } else {
        parts.push(`Replace with a ${object.subcategory || ''} ${object.category || 'object'}${object.assetId ? ` (specifically: ${object.assetId})` : ''}.`);
      }

      if (replace.style) {
        parts.push(`The replacement should have a ${replace.style} aesthetic.`);
      }
      if (replacePrompt) {
        parts.push(`Additional guidance: ${replacePrompt}.`);
      }

      const matchingFeatures: string[] = [];
      if (replace.matchScale) matchingFeatures.push('matching the original scale');
      if (replace.matchLighting) matchingFeatures.push('responding correctly to scene lighting');
      if (replace.preserveShadows) matchingFeatures.push('casting appropriate shadows');
      if (matchingFeatures.length > 0) {
        parts.push(`The replacement should integrate seamlessly, ${matchingFeatures.join(', ')}.`);
      }
    } else {
      parts.push('Place a new object into the scene that integrates naturally with the existing environment.');
      parts.push(...selectionParts);
      parts.push(describeUserIntent(userPrompt));
      parts.push(`Add a ${object.subcategory || ''} ${object.category || 'object'}${object.assetId ? ` (specifically: ${object.assetId})` : ''}.`);
    }

    // Placement details in natural language
    const placementDesc: string[] = [];
    if (object.scale !== 100) {
      placementDesc.push(object.scale > 100 ? 'scaled up for prominence' : 'scaled down for subtlety');
    }
    if (object.rotation !== 0) {
      placementDesc.push(`rotated ${object.rotation} degrees`);
    }
    if (object.autoPerspective) {
      placementDesc.push('automatically aligned to the scene perspective');
    }
    if (object.shadow) {
      placementDesc.push('with realistic contact shadows');
    }
    if (object.groundContact) {
      placementDesc.push('firmly grounded on the surface');
    }

    if (placementDesc.length > 0) {
      parts.push(`Place the object ${placementDesc.join(', ')}.`);
    }

    if (selectionCount === 0) {
      parts.push('Since no specific area is selected, intelligently choose the most appropriate location based on the context and keep the addition minimal and purposeful.');
    }

    parts.push('Object lock: add or replace only the requested object. Preserve architecture, materials, spatial layout, camera, and all unrelated scene content. Match scale, perspective, occlusion, grounding, and contact shadows.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'people') {
    const people = workflow.visualPeople;
    const peopleMode = people.mode === 'automatic' || people.mode === 'repopulate' ? people.mode : 'enhance';
    const describeRange = (value: number, low: string, mid: string, high: string) =>
      value > 65 ? high : value > 30 ? mid : low;
    const joinIf = (items: Array<string | false | null | undefined>) => compactItems(items).join(', ');

    parts.push(
      peopleMode === 'automatic'
        ? 'People-only architectural edit. Add, refine, or repair human figures and immediate personal accessories only; keep architecture, materials, landscaping, vehicles, signage, camera, and composition unchanged.'
        : 'People-only architectural edit. Modify human figures and immediate personal accessories only; keep architecture, materials, landscaping, vehicles, signage, camera, and composition unchanged.'
    );
    parts.push(...selectionParts);

    if (selectionCount === 0) {
      parts.push(
        peopleMode === 'automatic'
          ? 'No selection is provided: analyze the full frame and choose context-appropriate walkable, queuing, standing, or seated areas for people.'
          : 'No selection is provided: detect people across the frame and target people only.'
      );
    } else {
      parts.push(
        peopleMode === 'automatic'
          ? 'Within the selected area, use the full image as context and add or refine people only where the selection contains plausible occupiable space; floors, furniture, walls, and background pixels are placement and reconstruction context.'
          : 'Within the selected area, identify human figures and edit those people only; floors, furniture, walls, and background pixels are reconstruction context, not overwrite targets.'
      );
    }

    const zoneDescriptions: Record<string, string> = {
      'terminal-general': 'general terminal concourse',
      'check-in': 'check-in hall with counters, queues, and kiosks',
      'security': 'security screening area',
      'departure-gate': 'departure gate waiting area',
      'arrival-hall': 'arrival hall',
      'baggage-claim': 'baggage claim area',
      'retail-area': 'airport retail zone',
      'food-court': 'airport food court',
      'lounge': 'airport lounge',
      'transit-corridor': 'transit corridor',
    };

    const operationDesc: Record<string, string> = {
      enhance: 'enhance existing people while preserving count and placement unless a small correction is needed',
      repopulate: 'replace or repopulate people to match requested density and flow',
      automatic: 'automatically infer and add context-appropriate people from the current image',
    };

    if (peopleMode === 'enhance') {
      parts.push('Operation: re-render existing 3D, low-poly, clay, placeholder, or unrealistic archviz people as believable realistic humans.');
      parts.push('Preserve each existing person count, pose, location, body orientation, scale, ground contact, occlusion, and camera perspective. Do not add new people, remove people, change crowd density, alter demographics, redesign clothing categories, or move figures unless a tiny correction is required to repair an artifact.');
      parts.push('Improve faces, hands, hair, clothing folds, body proportions, silhouettes, edge blending, and render quality. Match the scene lighting, shadow direction, color temperature, lens behavior, depth of field, and resolution.');
      parts.push('Keep immediate personal accessories attached to the same people when present, including luggage, bags, phones, carts, and contact shadows.');
      parts.push('Constraints: modify only existing people and their attached artifacts/accessories. Do not change building, landscape, vehicles, sky, signage, materials, camera, perspective, composition, or nearby non-human content. Do not add captions, labels, UI, handwriting, or prompt text.');
      return parts.filter(Boolean).join(' ');
    }

    if (peopleMode === 'automatic') {
      parts.push('Operation: automatically repopulate the image with believable people using visual analysis only.');
      parts.push('Infer the scene type, public-space function, walkable areas, camera height, perspective, human scale, crowd density, movement flow, queue logic, seating/waiting zones, staff presence, luggage needs, wardrobe, demographics, lighting, shadows, and image quality directly from the current image.');
      parts.push('Use any existing people as the primary reference for scale, density, pose language, wardrobe style, motion, demographics, luggage, staff roles, lighting, and render fidelity. Preserve existing people unless they are clear artifacts; add a natural number of new people that makes the scene feel plausibly occupied without overcrowding.');
      parts.push('Place figures only where people could physically stand, walk, queue, or sit. Match perspective, occlusion, ground contact, contact shadows, depth of field, color temperature, and resolution. Leave architectural focal areas and circulation clear where the image suggests they should remain open.');
      parts.push('Do not use manual people settings in this automatic mode. Do not change building, landscape, vehicles, sky, signage, materials, camera, perspective, or composition. Do not add captions, labels, UI, handwriting, or prompt text.');
      return parts.filter(Boolean).join(' ');
    }

    const ageDescriptions: Record<string, string> = {
      'young-adults': 'mostly young adults',
      'adults': 'mostly adults',
      'mixed-all-ages': 'mixed ages',
      'families': 'family groups',
      'elderly-included': 'elderly travelers included',
    };
    const genderDesc: Record<string, string> = {
      balanced: 'balanced gender mix',
      'male-leaning': 'slightly male-leaning crowd',
      'female-leaning': 'slightly female-leaning crowd',
    };
    const groupingDescriptions: Record<string, string> = {
      'solo-dominant': 'mostly solo travelers',
      couples: 'couples and pairs',
      families: 'family groups',
      'business-groups': 'business groups',
      'mixed-groups': 'mixed solo travelers, pairs, families, and small groups',
    };
    const flowDescriptions: Record<string, string> = {
      random: 'organic mixed movement',
      directional: 'dominant directional flow',
      converging: 'people converging toward a focal point',
      dispersing: 'people dispersing outward',
      queuing: 'visible queue formations',
    };
    const directionDescriptions: Record<string, string> = {
      mixed: 'mixed directions',
      'mostly-left': 'mostly moving left',
      'mostly-right': 'mostly moving right',
      'toward-camera': 'mostly toward camera',
      'away-from-camera': 'mostly away from camera',
    };
    const paceDescriptions: Record<string, string> = {
      relaxed: 'relaxed pace',
      moderate: 'moderate airport walking pace',
      hurried: 'hurried purposeful movement',
      mixed: 'mixed pace',
    };
    const wardrobeMap: Record<string, string> = {
      business: 'business attire',
      casual: 'casual travel clothing',
      travel: 'practical layered travel outfits',
      luxury: 'upscale travel attire',
      sporty: 'athleisure and sporty outfits',
      mixed: 'mixed airport wardrobe',
    };
    const seasonDescriptions: Record<string, string> = {
      summer: 'summer clothing',
      winter: 'winter layers',
      'spring-fall': 'transitional spring/autumn clothing',
      tropical: 'tropical travel clothing',
      mixed: 'mixed seasonal clothing',
    };
    const selectedRegions = people.regionMix.length ? people.regionMix.join(', ') : 'diverse international mix';
    const staffTypes = compactItems([
      people.includeAirportStaff ? 'airport or airline staff' : null,
      people.includeSecurityPersonnel ? 'security staff' : null,
      people.includeAirlineCrew ? 'airline crew' : null,
      people.includeGroundCrew ? 'ground crew' : null,
      people.includeServiceStaff ? 'service staff' : null
    ]);

    parts.push(`Operation: ${operationDesc[peopleMode] || peopleMode}. Airport zone: ${zoneDescriptions[people.airportZone] || people.airportZone}.`);
    parts.push(`Crowd: ${describeRange(people.density, 'sparse', 'balanced', 'dense')} density; ${groupingDescriptions[people.grouping] || people.grouping}; ${flowDescriptions[people.flowPattern] || people.flowPattern}; ${directionDescriptions[people.movementDirection] || people.movementDirection}; ${paceDescriptions[people.paceOfMovement] || people.paceOfMovement}; ${describeRange(people.clusteringTendency, 'evenly distributed', 'some natural clustering', 'clustered near amenities')}.`);
    parts.push(`Demographics: ${selectedRegions}; ${ageDescriptions[people.ageDistribution] || people.ageDistribution}; ${genderDesc[people.genderBalance] || people.genderBalance}; children ${describeRange(people.childrenPresence, 'minimal', 'some', 'prominent')}; body variety ${describeRange(people.bodyTypeVariety, 'low', 'moderate', 'high')}.`);
    parts.push(`Wardrobe: ${wardrobeMap[people.wardrobeStyle] || people.wardrobeStyle}; ${seasonDescriptions[people.seasonalClothing] || people.seasonalClothing}; formality ${describeRange(people.formalityLevel, 'casual', 'smart-casual', 'formal')}; cultural attire ${describeRange(people.culturalAttire, 'occasional', 'some', 'significant')}.`);
    parts.push(`Behavior and accessories: ${joinIf([
      people.activities.length ? `activities ${people.activities.join(', ')}` : null,
      `interaction ${describeRange(people.interactionLevel, 'low', 'moderate', 'high')}`,
      people.luggageTypes.length ? `luggage ${people.luggageTypes.join(', ')}` : null,
      `luggage amount ${describeRange(people.luggageAmount, 'light', 'moderate', 'heavy')}`,
      `trolleys ${describeRange(people.trolleyUsage, 'few', 'some', 'many')}`,
      `devices ${describeRange(people.personalDevices, 'few', 'some', 'many')}`,
      `travel accessories ${describeRange(people.travelAccessories, 'few', 'some', 'prominent')}`
    ])}.`);
    if (staffTypes.length > 0) {
      parts.push(`Staff: include ${staffTypes.join(', ')} at about ${people.staffDensity}% of visible people.`);
    }
    parts.push(`Quality: realism ${describeRange(people.realism, 'stylized', 'natural archviz', 'high realism')}; detail ${describeRange(people.sharpness, 'soft', 'clean', 'crisp')}; scale ${describeRange(people.scaleAccuracy, 'approximate', 'balanced', 'strict')}; placement ${describeRange(people.placementDiscipline, 'loose but plausible', 'realistic', 'strictly on walkable surfaces')}; motion ${describeRange(people.motionBlur, 'mostly sharp', 'subtle motion blur', 'noticeable motion blur')}.`);
    parts.push(`Integration locks: ${joinIf([
      people.preserveExisting ? 'preserve existing people where possible' : 'allow replacing existing people as needed',
      people.matchLighting ? 'match scene lighting' : null,
      people.matchPerspective ? 'match perspective and lens' : null,
      people.groundContact ? 'ground every figure with contact shadows' : null,
      people.removeArtifacts ? 'remove people artifacts' : null
    ])}.`);
    parts.push('Constraints: modify only people and immediate accessories. Do not change building, landscape, vehicles, sky, signage, materials, camera, perspective, or composition. Do not add captions, labels, UI, handwriting, or prompt text.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'sky') {
    parts.push('Replace the sky to transform the entire atmosphere and mood of this architectural scene.');
    parts.push(...selectionParts);
    parts.push(describeUserIntent(userPrompt));

    const sky = workflow.visualSky;
    const skyPresets: Record<string, string> = {
      'clear': 'a pristine clear blue sky',
      'partly-cloudy': 'a dynamic sky with scattered clouds',
      'overcast': 'a soft, evenly overcast sky',
      'dramatic': 'a dramatic sky with striking cloud formations',
      'sunset': 'a warm, golden sunset sky',
      'sunrise': 'a fresh sunrise sky with delicate colors',
      'twilight': 'a dusky twilight sky transitioning between day and night',
      'night': 'a deep night sky',
      'stormy': 'a moody, stormy sky full of tension',
    };
    const skyDesc = skyPresets[sky.preset] || `a ${sky.preset} sky`;
    parts.push(`Create ${skyDesc}.`);
    parts.push(`Horizon discipline: align the new sky to the existing camera perspective and preserve the source horizon relationship; the intended horizon sits around ${sky.horizonLine}% of image height from the top.`);

    const cloudDesc = sky.cloudDensity > 70 ? 'abundant, dramatic clouds' :
      sky.cloudDensity > 40 ? 'moderate cloud coverage' :
      sky.cloudDensity > 10 ? 'light, wispy clouds' : 'virtually no clouds';
    parts.push(`The sky should feature ${cloudDesc}.`);

    if (sky.atmosphere > 30) {
      const hazeDesc = sky.atmosphere > 60 ? 'significant atmospheric haze adding depth' : 'subtle atmospheric haze';
      parts.push(`Add ${hazeDesc}.`);
    }

    const brightnessDesc = sky.brightness > 70 ? 'bright and luminous' :
      sky.brightness > 40 ? 'naturally balanced' : 'subdued and moody';
    parts.push(`The overall sky brightness should be ${brightnessDesc}.`);

    if (sky.reflectInGlass) {
      parts.push('Reflect this new sky appropriately in any glass surfaces.');
    }
    if (sky.matchLighting) {
      parts.push('Adjust the scene lighting to match the new sky conditions.');
    }
    if (sky.sunFlare) {
      parts.push('Include a natural sun flare effect where appropriate.');
    }

    parts.push('The sky replacement affects the entire image. Constraints: only replace the sky and atmospheric elements. Preserve the precise building silhouettes, maintain accurate horizon alignment, and keep the foreground exposure consistent. Do not modify any geometry or add objects to the scene.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'remove') {
    parts.push('Cleanly remove the specified unwanted elements from this image, reconstructing the background naturally.');
    parts.push(...selectionParts);
    parts.push(...buildRemoveSelectionTargeting(workflow));
    parts.push(describeUserIntent(userPrompt));

    const remove = workflow.visualRemove;
    parts.push('Remove the selected content and reconstruct the revealed background naturally.');

    if (remove.quickRemove.length > 0) {
      parts.push(`Automatically detect and remove all instances of: ${remove.quickRemove.join(', ')} throughout the image.`);
    }

    if (remove.autoDetectEdges) {
      parts.push('Intelligently detect edges to ensure clean removal boundaries.');
    }
    if (remove.preserveStructure) {
      parts.push('Carefully preserve structural and architectural lines when reconstructing.');
    }

    parts.push('Constraints: remove only what is specified. Reconstruct the revealed background using materials, textures, and patterns consistent with the surrounding area. Maintain straight lines where architectural elements continue behind removed objects. Never remove structural or important architectural elements unless they are explicitly selected for removal.');
    parts.push('The removed area must not become a white, empty, blurred, or flat blank spot. Continue floor joints, reflections, lighting, shadows, perspective, and surrounding texture so the result looks as if the removed content was never present.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'adjust') {
    parts.push('Apply a focused post-production adjustment to this architectural image. Treat settings as visual intent, not permission to redraw content.');
    parts.push(...selectionParts);
    parts.push(describeUserIntent(userPrompt));

    const adjust = workflow.visualAdjust;
    const describeDirection = (value: number, positive: string, negative: string) =>
      value > 0 ? positive : value < 0 ? negative : '';
    const describeAmount = (value: number) => {
      const abs = Math.abs(value);
      return abs > 65 ? 'strong' : abs > 30 ? 'moderate' : 'subtle';
    };
    const describeSigned = (value: number, positive: string, negative: string) =>
      value === 0 ? '' : `${describeAmount(value)} ${describeDirection(value, positive, negative)}`;
    const joinAdjustments = (items: Array<string | false | null | undefined>) => compactItems(items).join(', ');

    if (adjust.aspectRatio && adjust.aspectRatio !== 'same') {
      parts.push(`Composition: adapt to ${adjust.aspectRatio} while preserving perspective; extend canvas naturally before cropping, and never stretch the scene.`);
    }

    const tone = joinAdjustments([
      describeSigned(adjust.exposure, 'brighter exposure', 'darker exposure'),
      describeSigned(adjust.contrast, 'stronger contrast', 'softer contrast'),
      describeSigned(adjust.highlights, 'brighter highlights', 'recovered highlights'),
      describeSigned(adjust.shadows, 'more open shadows', 'deeper shadows'),
      describeSigned(adjust.whites, 'cleaner white point', 'softer white point'),
      describeSigned(adjust.blacks, 'lifted blacks', 'deeper blacks'),
      describeSigned(adjust.gamma, 'brighter midtones', 'darker midtones')
    ]);
    if (tone) {
      parts.push(`Tone: ${tone}.`);
    }

    const color = joinAdjustments([
      describeSigned(adjust.saturation, 'richer saturation', 'lower saturation'),
      describeSigned(adjust.vibrance, 'stronger muted colors', 'quieter muted colors'),
      describeSigned(adjust.temperature, 'warmer color temperature', 'cooler color temperature'),
      describeSigned(adjust.tint, 'magenta tint', 'green tint'),
      adjust.hueShift !== 0 ? `${describeAmount(adjust.hueShift)} global hue shift` : null
    ]);
    if (color) {
      parts.push(`Color: ${color}.`);
    }

    const detail = joinAdjustments([
      describeSigned(adjust.clarity, 'clearer local contrast', 'softer local contrast'),
      describeSigned(adjust.texture, 'more visible surface texture', 'smoother surface texture'),
      describeSigned(adjust.dehaze, 'less haze', 'more atmospheric haze'),
      describeSigned(adjust.sharpness, 'sharper edges', 'softer edges'),
      adjust.noiseReduction !== 0 ? `${describeAmount(adjust.noiseReduction)} luminance noise cleanup` : null,
      adjust.noiseReductionColor !== 0 ? `${describeAmount(adjust.noiseReductionColor)} color-noise cleanup` : null
    ]);
    if (detail) {
      parts.push(`Detail: ${detail}. Preserve real architectural edges; do not invent small features.`);
    }

    const hslChanges: string[] = [];
    const hslChannels = [
      { name: 'Reds', hue: adjust.hslRedsHue, sat: adjust.hslRedsSaturation, lum: adjust.hslRedsLuminance },
      { name: 'Oranges', hue: adjust.hslOrangesHue, sat: adjust.hslOrangesSaturation, lum: adjust.hslOrangesLuminance },
      { name: 'Yellows', hue: adjust.hslYellowsHue, sat: adjust.hslYellowsSaturation, lum: adjust.hslYellowsLuminance },
      { name: 'Greens', hue: adjust.hslGreensHue, sat: adjust.hslGreensSaturation, lum: adjust.hslGreensLuminance },
      { name: 'Aquas', hue: adjust.hslAquasHue, sat: adjust.hslAquasSaturation, lum: adjust.hslAquasLuminance },
      { name: 'Blues', hue: adjust.hslBluesHue, sat: adjust.hslBluesSaturation, lum: adjust.hslBluesLuminance },
      { name: 'Purples', hue: adjust.hslPurplesHue, sat: adjust.hslPurplesSaturation, lum: adjust.hslPurplesLuminance },
      { name: 'Magentas', hue: adjust.hslMagentasHue, sat: adjust.hslMagentasSaturation, lum: adjust.hslMagentasLuminance },
    ];
    for (const ch of hslChannels) {
      const changes: string[] = [];
      if (ch.hue !== 0) changes.push(ch.hue > 0 ? 'warmer hue' : 'cooler hue');
      if (ch.sat !== 0) changes.push(ch.sat > 0 ? 'more saturated' : 'less saturated');
      if (ch.lum !== 0) changes.push(ch.lum > 0 ? 'lighter' : 'darker');
      if (changes.length > 0) {
        hslChanges.push(`${ch.name.toLowerCase()} ${changes.join('/')}`);
      }
    }
    if (hslChanges.length > 0) {
      parts.push(`Selective color: ${hslChanges.join('; ')}.`);
    }

    const grade = joinAdjustments([
      adjust.colorGradeShadowsHue !== 0 || adjust.colorGradeShadowsSaturation !== 0 ? 'tint shadows with the requested grade' : null,
      adjust.colorGradeMidtonesHue !== 0 || adjust.colorGradeMidtonesSaturation !== 0 ? 'tint midtones with the requested grade' : null,
      adjust.colorGradeHighlightsHue !== 0 || adjust.colorGradeHighlightsSaturation !== 0 ? 'tint highlights with the requested grade' : null,
      describeSigned(adjust.colorGradeBalance, 'grade biased toward highlights', 'grade biased toward shadows')
    ]);
    if (grade) {
      parts.push(`Color grade: ${grade}.`);
    }

    const effects = joinAdjustments([
      adjust.vignette !== 0 ? `${describeAmount(adjust.vignette)} ${adjust.vignette > 0 ? 'dark-corner' : 'bright-corner'} vignette` : null,
      adjust.grain !== 0 ? `${describeAmount(adjust.grain)} film grain` : null,
      adjust.bloom !== 0 ? `${describeAmount(adjust.bloom)} bloom around bright areas` : null,
      adjust.chromaticAberration !== 0 ? `${describeAmount(adjust.chromaticAberration)} chromatic edge separation` : null
    ]);
    if (effects) {
      parts.push(`Effects: ${effects}. Keep effects photographic and restrained.`);
    }

    const transforms = joinAdjustments([
      adjust.transformRotate !== 0 ? `${describeAmount(adjust.transformRotate)} rotation correction` : null,
      adjust.transformHorizontal !== 0 ? `${describeAmount(adjust.transformHorizontal)} horizontal perspective correction` : null,
      adjust.transformVertical !== 0 ? `${describeAmount(adjust.transformVertical)} vertical perspective correction` : null,
      adjust.transformDistortion !== 0 ? `${describeAmount(adjust.transformDistortion)} lens distortion correction` : null,
      adjust.transformPerspective !== 0 ? `${describeAmount(adjust.transformPerspective)} perspective-depth correction` : null
    ]);
    if (transforms) {
      parts.push(`Geometry correction: ${transforms}. Preserve straight architectural lines and avoid warping people, objects, or text.`);
    }

    const intensityPercent = Math.round(adjust.styleStrength);
    if (adjust.styleStrength !== 50) {
      const strength = intensityPercent > 75 ? 'strong' :
        intensityPercent > 50 ? 'slightly strong' :
        intensityPercent > 25 ? 'subtle' : 'very subtle';
      parts.push(`Overall strength: ${strength}; keep the image believable and architectural.`);
    }

    parts.push(
      adjust.aspectRatio && adjust.aspectRatio !== 'same'
        ? 'Constraints: adjust tone, color, detail, effects, and requested format only. Do not add, remove, replace, or relocate objects or people; do not redesign architecture; blend any selected adjustment naturally.'
        : 'Constraints: adjust tone, color, detail, and effects only. Do not crop, resize, add, remove, replace, or relocate objects or people; do not redesign architecture; blend any selected adjustment naturally.'
    );
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'extend') {
    parts.push('Extend this image beyond its current boundaries, seamlessly continuing the scene.');
    parts.push(...selectionParts);
    parts.push(describeUserIntent(userPrompt));

    const extend = workflow.visualExtend;
    const directionDesc: Record<string, string> = {
      'left': 'to the left',
      'right': 'to the right',
      'top': 'upward',
      'bottom': 'downward',
      'top-left': 'upward and to the left',
      'top-right': 'upward and to the right',
      'bottom-left': 'downward and to the left',
      'bottom-right': 'downward and to the right',
      'horizontal': 'horizontally on both sides',
      'vertical': 'vertically above and below',
      'all': 'in all directions',
    };

    if (extend.direction === 'none') {
      parts.push('No extension direction is specified - keep the image unchanged.');
      return parts.filter(Boolean).join(' ');
    }

    const amountDesc = extend.amount > 75 ? 'significantly' :
      extend.amount > 40 ? 'moderately' : 'slightly';
    parts.push(`Extend the canvas ${amountDesc} ${directionDesc[extend.direction] || extend.direction}.`);

    if (extend.targetAspectRatio !== 'custom') {
      parts.push(`Target a ${extend.targetAspectRatio} aspect ratio.`);
    } else {
      parts.push(`Target a ${extend.customRatio.width}:${extend.customRatio.height} aspect ratio.`);
    }

    parts.push('Outpaint lock: preserve the original image area unchanged. Paint only the new canvas space, continuing perspective, horizon, materials, lighting, shadows, reflections, and edge text/signage shapes naturally.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'background') {
    parts.push('Replace the background of this architectural image while keeping the selected area unchanged.');
    parts.push(...buildSelectionContext(workflow, 'preserve'));
    const background = workflow.visualBackground;
    const backgroundPrompt = background.prompt?.trim() || userPrompt;

    if (background.mode === 'image' && background.referenceImage) {
      parts.push('Background reference: a reference image shows the desired background environment.');
      parts.push('Keep the selected area unchanged. Do not modify, retouch, or alter pixels within the selection; replace only the background around it.');

      if (background.referenceMode === 'absolute') {
        parts.push('Treat the reference image as the exact background to integrate into. Preserve its layout, horizon line, dominant elements, and overall composition. Do not introduce new background elements that conflict with the reference.');
      } else {
        parts.push('Use the reference image as creative guidance. Match its mood, palette, and environmental cues, but allow tasteful variation and creativity in the background.');
      }

      if (background.matchPerspective) {
        parts.push('Match the perspective and horizon line from the reference image, ensuring the background aligns naturally with the architectural elements in the preserved selection.');
      }

      if (background.matchLighting) {
        parts.push('Match the lighting conditions from the reference: time of day, sky conditions, ambient light color temperature, and shadow directions. The preserved selection should appear as if it was photographed in the reference environment.');
      }

      if (background.seamlessBlend) {
        parts.push('Create a seamless blend at the edges of the selection. The transition between the preserved area and new background must be natural and imperceptible, with proper atmospheric perspective and depth integration.');
      }

      if (background.preserveDepth) {
        parts.push('Maintain proper depth relationships. Apply appropriate atmospheric haze and desaturation to background elements based on their distance, ensuring the preserved selection appears naturally integrated into the space.');
      }

      parts.push('The final image must look like a single cohesive photograph where the preserved area naturally exists in the new background environment.');
    } else {
      if (backgroundPrompt) {
        parts.push(`Background direction: "${backgroundPrompt}".`);
      } else {
        parts.push('No background reference is provided. Apply a natural background replacement based on the context and user instructions.');
      }
    }

    const qualityDesc = background.quality === 'high' ? 'with maximum detail and photorealism' :
      background.quality === 'standard' ? 'with balanced quality' : 'with faster processing';
    parts.push(`Process ${qualityDesc}.`);

    parts.push('Constraints: keep pixels inside the selected area unchanged. Replace only the background. Match horizon lines, color grade, atmosphere, ground plane, and depth cues so the result reads as one unified photograph, not a collage.');
    return parts.filter(Boolean).join(' ');
  }

  parts.push(...selectionParts);
  return parts.filter(Boolean).join(' ');
};

function generateSceneComposePrompt(state: AppState): string {
  const { workflow } = state;
  const references = workflow.sceneInsertionReferences || [];
  const referencesWithPlacement = references.filter((reference) => Boolean(reference.placement));

  const sourceDescriptions: Record<string, string> = {
    'rhino': 'a Rhino model screenshot',
    'revit': 'a Revit model screenshot',
    'sketchup': 'a SketchUp model screenshot',
    'blender': 'a Blender scene screenshot',
    '3dsmax': 'a 3ds Max scene screenshot',
    'archicad': 'an ArchiCAD model screenshot',
    'cinema4d': 'a Cinema 4D scene screenshot',
    'clay': 'a clay render screenshot',
    'other': 'a 3D scene screenshot',
  };

  const viewDescriptions: Record<string, string> = {
    'exterior': 'exterior',
    'interior': 'interior',
    'aerial': 'aerial',
    'detail': 'detail',
  };

  const parts: string[] = [
    `Create a photorealistic ${viewDescriptions[workflow.viewType] || 'architectural'} scene composition by editing the current base scene from ${sourceDescriptions[workflow.sourceType] || 'a 3D scene screenshot'}.`,
    buildSourceImageRelationship(
      'base scene',
      'Preserve the base scene architecture, structural geometry, room or site layout, material boundaries, existing people, furniture, planting, signage, graphics, and composition exactly unless a reference caption explicitly requests a local insertion that must occlude something.'
    ),
    'Reference relationship: attachment #1 is the locked base scene. A placement guidance map may appear after the source; use it only as hidden spatial metadata and never as scene content. The remaining photographic attachments are object, material, entourage, and placement references for scene insertion in listed order.',
    'Do not redesign the architecture. Only insert, arrange, and render scene elements based on the provided reference stack.',
    'This is an additive local edit, not a fresh render. Do not clear, simplify, or repopulate the rest of the image.',
    'All outputs must look like a single coherent photograph with consistent lens behavior, lighting direction, shadows, reflections, and contact points.'
  ];

  if (references.length === 0) {
    parts.push(
      'No insertion references were provided. Keep the space minimally staged and photoreal without adding unrelated feature objects.'
    );
  } else {
    parts.push(
      `There ${references.length === 1 ? 'is' : 'are'} ${references.length} insertion reference${references.length === 1 ? '' : 's'} in stack order. If a placement guidance map is supplied, skip it when mapping references: Reference 1 maps to the first photographic insertion reference, Reference 2 to the next, and so on.`
    );
    references.forEach((reference, index) => {
      const caption = reference.caption?.trim();
      const placement = reference.placement
        ? ` Placement pin: x=${(reference.placement.x * 100).toFixed(2)}%, y=${(reference.placement.y * 100).toFixed(2)}% from the top-left of the base image (normalized coordinates on attachment #1). Treat this as the intended ground/contact or placement anchor, not as a UI mark. Keep the inserted object's contact footprint as close to that pin as physically plausible.`
        : ' No explicit placement pin provided; choose the most plausible location based on scene logic.';
      parts.push(
        `Reference ${index + 1}: ${
          caption && caption.length > 0
            ? caption
            : 'Insert the key object(s) from this reference naturally with realistic scale and placement.'
        }${placement}`
      );
    });
    parts.push(
      'Honor every caption as an instruction for what to insert and how to place/style it. If captions conflict with scene physics, choose the most realistic interpretation.'
    );
    parts.push(
      'When a caption uses spatial language such as behind, in front of, beside, left of, right of, under, on top of, or against, resolve that relationship against visible objects in the base scene and maintain correct occlusion and depth ordering.'
    );
    parts.push(
      'Scale inserted furniture and objects from nearby people, seats, doors, floor tiles, and perspective lines. Keep them grounded on the same floor plane or supporting surface as the placement pin.'
    );
    if (referencesWithPlacement.length > 0) {
      parts.push(
        'Placement pins are authoritative and per-reference: do not swap pins between references. Keep inserted objects centered on or strongly anchored to their own pinned coordinates unless physically impossible.'
      );
      parts.push(
        'Placement pins are internal guidance metadata only. Never render dots, numbered badges, markers, crosshairs, labels, callouts, or any UI-style annotation in the final image.'
      );
    }
  }

  parts.push(
    'Avoid collage artifacts. Blend all inserted objects with correct occlusion, depth, grounding, and material response to the scene lighting.'
  );

  return parts.join(' ');
}

function generateCadRenderPrompt(state: AppState): string {
  const { workflow, activeStyleId, customStyles } = state;
  const r3d = workflow.render3d;
  const availableStyles = [...BUILT_IN_STYLES, ...(customStyles ?? [])];
  const style = availableStyles.find(s => s.id === activeStyleId);
  const hasSourceImage = Boolean(state.sourceImage || state.uploadedImage);
  const hasStyleReference = Boolean(workflow.styleReferenceEnabled && workflow.styleReferenceImage);
  const isNoStyle = !hasStyleReference && style?.id === 'no-style';

  const parts: string[] = [];

  // Opening based on CAD drawing type
  const cadTypeDescriptions: Record<string, string> = {
    'plan': 'Transform this architectural floor plan into a clear visualization of the spatial layout',
    'section': 'Convert this architectural section drawing into a visualization of the building interior and structure',
    'elevation': 'Render this elevation drawing as a facade visualization',
    'site': 'Transform this site plan into an overhead visualization of the development',
  };

  const projectionDescriptions: Record<string, string> = {
    plan: 'viewed directly from above in true orthographic projection',
    section: 'cut cleanly through the building to reveal its internal organization',
    elevation: 'viewed straight-on showing the true proportions of the facade',
    site: 'surveyed from directly overhead capturing the full site context',
  };

  parts.push(`${cadTypeDescriptions[workflow.cadDrawingType] || 'Create an architectural visualization from this CAD drawing'}, ${projectionDescriptions[workflow.cadDrawingType] || 'in orthographic projection'}.`);
  if (hasSourceImage) {
    parts.push(buildSourceImageRelationship(
      'CAD/drawing source',
      'The drawing establishes exact geometry, diagram orientation, wall/opening locations, line hierarchy, labels, dimensions, and source proportions.'
    ));
  }

  if (workflow.cadScale) {
    parts.push(`The drawing is prepared at ${workflow.cadScale} scale.`);
  }
  if (workflow.cadOrientation) {
    parts.push(`Preserve the drawing orientation at ${Math.round(workflow.cadOrientation)} degrees; do not rotate or normalize it unless the camera settings require a rendered viewpoint.`);
  }

  parts.push(describeRenderMode(DEFAULT_RENDER_GENERATION_MODE));

  const cadMaterials = summarizeMaterialAssignments(workflow.cadMaterialAssignments);
  if (cadMaterials) {
    parts.push(`Material assignments from the CAD setup: ${cadMaterials}. Use these only on their assigned elements.`);
  }

  // Space description
  const space = workflow.cadSpace;
  const roomDescriptions: Record<string, string> = {
    'living': 'a comfortable living space',
    'bedroom': 'a restful bedroom',
    'kitchen': 'a functional kitchen',
    'bathroom': 'a clean bathroom',
    'office': 'a productive office environment',
    'commercial': 'a commercial space',
    'retail': 'an inviting retail environment',
    'restaurant': 'a welcoming dining space',
  };
  parts.push(`This is ${roomDescriptions[space.roomType] || `a ${space.roomType}`}.`);

  const ceilingDescMap: Record<string, string> = {
    'flat': 'clean, flat ceilings',
    'coffered': 'elegant coffered ceilings',
    'exposed': 'honest exposed structure above',
    'beams': 'exposed ceiling beams adding character',
    'vaulted': 'dramatic vaulted ceilings',
  };
  const ceilingDesc = ceilingDescMap[space.ceilingStyle] || `${space.ceilingStyle} ceilings`;
  parts.push(`The space features ${ceilingDesc}, ${space.windowStyle} windows, and ${space.doorStyle} doors.`);
  const spatial = workflow.cadSpatial;
  const spatialStyle = spatial.style < 35 ? 'conservative interpretation' :
    spatial.style > 70 ? 'creative spatial interpretation' : 'balanced spatial interpretation';
  parts.push(`Use CAD spatial assumptions: ceiling height ${spatial.ceilingHeight}m, wall thickness ${spatial.wallThick}m, floor thickness ${spatial.floorThick}m, ${spatialStyle}.`);

  // Style
  if (hasStyleReference) {
    parts.push(getStyleReferenceInstruction(hasSourceImage));
  } else if (!isNoStyle && style) {
    parts.push(style.description);
    if (style.promptBundle?.renderingLanguage?.atmosphere) {
      const atmosphereWords = style.promptBundle.renderingLanguage.atmosphere;
      parts.push(`Infuse the visualization with a feeling that is ${atmosphereWords.join(', ')}.`);
    }
  }

  // Camera in natural language
  const cam = workflow.cadCamera;
  const heightDesc = cam.height < 1.2 ? 'low viewpoint as if seated' :
    cam.height < 1.7 ? 'natural eye-level perspective' :
    cam.height < 2.5 ? 'slightly elevated viewpoint' : 'elevated perspective';
  const lookAtDesc: Record<string, string> = {
    n: 'looking north',
    ne: 'looking northeast',
    e: 'looking east',
    se: 'looking southeast',
    s: 'looking south',
    sw: 'looking southwest',
    w: 'looking west',
    nw: 'looking northwest',
  };
  parts.push(compactItems([
    `Camera: ${heightDesc}, ${describeLens(cam.focalLength)}`,
    cam.position ? `from ${Math.round(cam.position.x)}% left / ${Math.round(cam.position.y)}% top on plan` : null,
    cam.lookAt ? lookAtDesc[cam.lookAt] || `looking ${cam.lookAt}` : null,
    cam.verticalCorrection ? 'straight corrected verticals' : null
  ]).join(', ') + '.');

  // Furnishing description
  const furn = workflow.cadFurnishing;
  const occupancyDesc: Record<string, string> = {
    'empty': 'completely empty, showing pure architectural space',
    'staged': 'staged with selected furniture for presentation',
    'lived-in': 'furnished with a natural lived-in feel',
  };
  const furnishingNotes = compactItems([
    occupancyDesc[furn.occupancy] || furn.occupancy,
    furn.auto ? 'automatic furnishing only where it clarifies room function' : null,
    furn.styles.length > 0 ? `style ${furn.styles.join(', ')}` : null,
    `density ${describeSettingStrength(furn.density, 'sparse', 'balanced', 'full')}`
  ]);
  if (furn.auto) {
    furnishingNotes.push('do not obscure source geometry');
  }
  const clutterDesc = furn.clutter > 60 ? 'with realistic everyday items adding authenticity' :
    furn.clutter > 30 ? 'with tasteful accessories and details' : 'kept clean and uncluttered';
  furnishingNotes.push(clutterDesc);
  parts.push(`Furnishing: ${furnishingNotes.join('; ')}.`);

  if (furn.people) {
    const entourageDesc = furn.entourage < 30 ? 'a few people adding human scale' :
      furn.entourage < 70 ? 'people naturally occupying the space' :
      'a lively gathering of people bringing energy to the scene';
    parts.push(`Include ${entourageDesc}.`);
  }

  // Context
  const cadContext = workflow.cadContext;
  const envDesc: Record<string, string> = {
    'urban': 'an urban setting with city views beyond',
    'suburban': 'a peaceful suburban neighborhood',
    'rural': 'a serene rural landscape',
    'coastal': 'a beautiful coastal environment',
  };
  const seasonDesc: Record<string, string> = {
    'spring': 'fresh spring atmosphere with new growth',
    'summer': 'warm summer ambiance with full foliage',
    'autumn': 'rich autumn colors in the landscape',
    'winter': 'crisp winter setting',
  };
  parts.push(`Place this in ${envDesc[cadContext.environment] || `a ${cadContext.environment} environment`} with ${cadContext.landscape} landscaping and ${seasonDesc[cadContext.season] || `${cadContext.season} atmosphere`}.`);

  // Lighting
  const light = r3d.lighting;
  parts.push(`The scene is bathed in ${formatTimePreset(light.preset)}.`);

  if (light.sun.enabled) {
    parts.push(`${describeLightSourcePosition(light.sun.azimuth, light.sun.elevation)}, with ${describeSunIntensity(light.sun.intensity)} and ${describeColorTemperature(light.sun.colorTemp)}.`);
  }

  if (light.shadows.enabled) {
    parts.push(`Shadows are ${describeShadows(light.shadows.intensity)}.`);
  }

  // Atmosphere
  const atm = r3d.atmosphere;
  parts.push(`The overall atmosphere conveys ${describeAtmosphericMood(atm.mood)}.`);

  if (atm.fog.enabled) {
    parts.push(describeFog(atm.fog.density) + '.');
  }

  if (atm.bloom.enabled) {
    parts.push(`Highlights have ${describeBloom(atm.bloom.intensity)}.`);
  }

  // Scene elements
  const scene = r3d.scenery;
  if (scene.people.enabled) {
    parts.push(`${describePeopleActivity(scene.people.count)}.`);
  }
  if (scene.trees.enabled) {
    parts.push(`The landscaping features ${describeVegetation(scene.trees.count)}.`);
  }
  if (scene.cars.enabled) {
    parts.push('Vehicles are realistically placed in the scene.');
  }

  // Background Reference - Environment matching instruction
  if (workflow.backgroundReferenceEnabled && workflow.backgroundReferenceImage) {
    parts.push(getEnvironmentReferenceInstruction());
  }

  // Output quality
  const rend = r3d.render;
  parts.push(`${describeResolution(rend.resolution)} ${describeAspectRatio(rend.aspectRatio)}.`);

  // Closing
  parts.push(describeRenderModeClosing(DEFAULT_RENDER_GENERATION_MODE, rend.resolution));

  return parts.filter(p => p.trim()).join(' ');
}

function generateSketchPrompt(state: AppState): string {
  const { workflow, activeStyleId, customStyles } = state;
  const r3d = workflow.render3d;
  const availableStyles = [...BUILT_IN_STYLES, ...(customStyles ?? [])];
  const style = availableStyles.find(s => s.id === activeStyleId);
  const isNoStyle = style?.id === 'no-style';

  const parts: string[] = [];

  // Opening - describe the transformation
  if (state.prompt?.trim()) {
    parts.push(`Transform this sketch according to the user brief: "${state.prompt.trim()}".`);
  } else {
    parts.push('Transform this hand-drawn architectural sketch into a clear architectural visualization.');
  }
  parts.push(buildSourceImageRelationship(
    'architectural sketch',
    'The sketch establishes the composition, design intent, camera direction, perspective system, silhouettes, line positions, and proportions.'
  ));

  // Sketch type description
  const sketchTypeDesc: Record<string, string> = {
    'exterior': 'This is an exterior architectural sketch',
    'interior': 'This is an interior architectural sketch',
    'detail': 'This is a detail sketch focused on a specific architectural element',
    'aerial': 'This is an aerial or site-oriented sketch',
  };
  parts.push(`${sketchTypeDesc[workflow.sketchType] || `This is a ${workflow.sketchType} sketch`}.`);
  parts.push(`Sketch handling: auto-detect ${formatToggle(workflow.sketchAutoDetect)}, ${workflow.sketchLineWeight} line weight, cleanup ${describeSettingStrength(workflow.sketchCleanupIntensity, 'light', 'balanced', 'strong')}.`);

  // Perspective and composition constraints
  const perspDesc: Record<string, string> = {
    '1-point': 'one-point perspective with a central vanishing point',
    '2-point': 'two-point perspective with converging horizontals',
    '3-point': 'three-point perspective',
    'isometric': 'clean isometric projection',
    'axonometric': 'axonometric view',
    'freehand': 'freehand perspective with approximate viewpoint cues',
  };
  parts.push(`The sketch uses ${perspDesc[workflow.sketchPerspectiveType] || workflow.sketchPerspectiveType}.`);
  parts.push(`View cues: horizon around ${workflow.sketchHorizonLine}% of image height, camera height ${workflow.sketchCameraHeight}.`);

  // Main fidelity constraints in natural language
  parts.push('Use the sketch as the composition and form blueprint. Preserve viewpoint, silhouette, proportions, and major line positions; add only the material, light, and context allowed by settings.');

  if (workflow.sketchDetectedPerspective) {
    parts.push(`The detected perspective (${workflow.sketchDetectedPerspective}) must be matched precisely.`);
  }

  if (workflow.sketchVanishingPoints.length > 0) {
    parts.push('Maintain the exact vanishing points established in the sketch.');
  }

  if (!workflow.sketchAllowExtend) {
    parts.push('Do not extend the image beyond the original sketch boundaries.');
  }

  // Line quality interpretation
  const lineQualityDesc = workflow.sketchLineQuality > 80 ? 'exceptionally clean and confident' :
    workflow.sketchLineQuality > 60 ? 'clear and readable' :
    workflow.sketchLineQuality > 40 ? 'somewhat rough but interpretable' : 'rough and gestural';

  const completenessDesc = workflow.sketchCompleteness > 80 ? 'highly complete with most details defined' :
    workflow.sketchCompleteness > 60 ? 'substantially complete' :
    workflow.sketchCompleteness > 40 ? 'partially complete with areas left to interpretation' : 'sparse, leaving much to be imagined';

  if (workflow.sketchLineQuality > 0 || workflow.sketchCompleteness > 0) {
    parts.push(`The sketch linework is ${lineQualityDesc} and ${completenessDesc}.`);
  }

  // Line processing in natural language
  const lineProcessing: string[] = [];
  if (workflow.sketchEnhanceFaint) lineProcessing.push('strengthen faint, tentative lines');
  if (workflow.sketchConnectLines) lineProcessing.push('intelligently connect broken line segments');
  if (workflow.sketchStraighten) lineProcessing.push('gently straighten wobbly hand-drawn lines');
  if (workflow.sketchRemoveConstruction) lineProcessing.push('ignore construction and guide lines');

  if (lineProcessing.length > 0) {
    parts.push(`When interpreting the sketch: ${lineProcessing.join(', ')}.`);
  }

  if (workflow.sketchPerspectiveCorrect) {
    const correctionStrength = workflow.sketchPerspectiveStrength > 70 ? 'strongly' :
      workflow.sketchPerspectiveStrength > 40 ? 'moderately' : 'subtly';
    parts.push(`${correctionStrength.charAt(0).toUpperCase() + correctionStrength.slice(1)} correct any perspective inconsistencies${workflow.sketchFixVerticals ? ', especially ensuring vertical lines are truly vertical' : ''}.`);
  }

  // Creative interpretation level
  const interpretationDesc = workflow.sketchInterpretation > 70 ? 'significant creative freedom to interpret ambiguous areas and add architectural details' :
    workflow.sketchInterpretation > 40 ? 'moderate creative license to fill in undefined areas while respecting the design intent' :
    'minimal interpretation, staying very close to what is explicitly drawn';
  parts.push(`Allow ${interpretationDesc}.`);

  // What to preserve
  const preserveElements: string[] = [];
  if (workflow.sketchPreserveOutline) preserveElements.push('the overall building outline and massing');
  if (workflow.sketchPreserveOpenings) preserveElements.push('the exact positions of windows and doors');
  if (workflow.sketchPreserveRoof) preserveElements.push('the roof form and profile');
  if (workflow.sketchPreserveFloors) preserveElements.push('the floor levels and horizontal datums');
  if (workflow.sketchPreserveProportions) preserveElements.push('the proportions and scale relationships');

  if (preserveElements.length > 0) {
    parts.push(`Strictly preserve ${preserveElements.join(', ')}.`);
  }

  // What creative additions are allowed
  const allowedVariations: string[] = [];
  if (workflow.sketchAllowDetails) allowedVariations.push('invent appropriate architectural details not shown in the sketch');
  if (workflow.sketchAllowMaterials) allowedVariations.push('select and render realistic material textures');
  if (workflow.sketchAllowEntourage) allowedVariations.push('add people, vegetation, and contextual elements');
  if (workflow.sketchAllowExtend) allowedVariations.push('extend the scene beyond the sketch boundaries where appropriate');

  if (allowedVariations.length > 0) {
    parts.push(`You may ${allowedVariations.join(', ')}.`);
  }

  // Ambiguity handling
  const ambiguityDesc: Record<string, string> = {
    'ask': 'If sketch ambiguity cannot be resolved visually, choose the most conservative interpretation',
    'conservative': 'When encountering ambiguous areas, make conservative, safe interpretations that don\'t add unnecessary complexity',
    'typical': 'Resolve ambiguous areas using typical architectural logic for this building type',
    'creative': 'Where the sketch is ambiguous, feel free to make creative decisions that enhance the architectural vision',
  };
  parts.push(`${ambiguityDesc[workflow.sketchAmbiguityMode] || 'Handle ambiguous areas thoughtfully'}.`);

  // Style
  if (!isNoStyle && style) {
    parts.push(style.description);
    if (style.promptBundle?.renderingLanguage?.atmosphere) {
      const atmosphereWords = style.promptBundle.renderingLanguage.atmosphere;
      parts.push(`Infuse the render with an atmosphere that feels ${atmosphereWords.join(', ')}.`);
    }
  }

  // Reference images
  if (workflow.sketchRefs.length > 0) {
    parts.push(buildReferenceStackRelationship('style, material, or mood references for interpreting the sketch'));
    const counts = workflow.sketchRefs.reduce(
      (acc, ref) => {
        acc[ref.type] += 1;
        return acc;
      },
      { style: 0, material: 0, mood: 0 }
    );

    const refParts: string[] = [];
    if (counts.style > 0) refParts.push(`${counts.style} style reference${counts.style > 1 ? 's' : ''}`);
    if (counts.material > 0) refParts.push(`${counts.material} material reference${counts.material > 1 ? 's' : ''}`);
    if (counts.mood > 0) refParts.push(`${counts.mood} mood reference${counts.mood > 1 ? 's' : ''}`);

    const influenceDesc = workflow.sketchRefInfluence > 70 ? 'strongly' :
      workflow.sketchRefInfluence > 40 ? 'moderately' : 'subtly';
    parts.push(`Use the provided ${refParts.join(' and ')} to ${influenceDesc} guide the visualization.`);
  }

  if (workflow.sketchRefType === 'material') {
    parts.push(`Draw the material palette from the ${workflow.sketchMaterialPalette} collection.`);
  }
  if (workflow.sketchRefType === 'mood') {
    parts.push(`The overall mood should evoke ${workflow.sketchMoodPreset}.`);
  }

  // Render mode
  parts.push(describeRenderMode(workflow.renderMode));

  // Lighting
  const light = r3d.lighting;
  parts.push(`Illuminate the scene with ${formatTimePreset(light.preset)}.`);

  if (light.sun.enabled) {
    parts.push(`${describeLightSourcePosition(light.sun.azimuth, light.sun.elevation)}, casting ${describeSunIntensity(light.sun.intensity)} with ${describeColorTemperature(light.sun.colorTemp)}.`);
  }

  if (light.shadows.enabled) {
    parts.push(`Create ${describeShadows(light.shadows.intensity)}.`);
  }

  // Atmosphere
  const atm = r3d.atmosphere;
  parts.push(`The atmosphere should convey ${describeAtmosphericMood(atm.mood)}.`);

  if (atm.fog.enabled) {
    parts.push(describeFog(atm.fog.density) + '.');
  }

  if (atm.bloom.enabled) {
    parts.push(`Add ${describeBloom(atm.bloom.intensity)}.`);
  }

  // Context and scenery
  const scene = r3d.scenery;
  if (scene.people.enabled) {
    parts.push(`Populate the scene with ${describePeopleActivity(scene.people.count)}.`);
  }

  if (scene.trees.enabled) {
    parts.push(`Include ${describeVegetation(scene.trees.count)}.`);
  }

  if (scene.cars.enabled) {
    parts.push('Add realistically placed vehicles where appropriate.');
  }

  // Output quality
  const rend = r3d.render;
  parts.push(`${describeResolution(rend.resolution)} ${describeAspectRatio(rend.aspectRatio)}.`);

  // Closing
  parts.push(describeRenderModeClosing(workflow.renderMode, rend.resolution));

  return parts.filter(p => p.trim()).join(' ');
}

function generateImageToCadPrompt(state: AppState): string {
  const { workflow } = state;
  const parts: string[] = [];

  if (state.prompt?.trim()) {
    parts.push(`Convert this source image according to the user brief: "${state.prompt.trim()}".`);
  } else {
    parts.push('Convert this image into a clean, accurate CAD drawing.');
  }
  parts.push('Source analysis contract: preserve the source building identity, visible proportions, structural rhythm, opening positions, edge relationships, and any readable annotations or dimensions as exact CAD text where possible. Do not invent hidden rooms, extra openings, extra floors, decorative details, or labels that are not supported by the source.');

  const typeDesc: Record<string, string> = {
    photo: 'The source is a photograph, so infer true edges and geometry from perspective cues.',
    render: 'The source is a render, so treat visible edges and material boundaries as authoritative.',
  };
  parts.push(typeDesc[workflow.imgToCadType] || `The source is a ${workflow.imgToCadType}.`);

  const outputDesc: Record<string, string> = {
    elevation: 'Produce an orthographic elevation with true proportions and no perspective distortion.',
    plan: 'Produce a clean plan view with consistent line weights and legible wall thickness.',
    detail: 'Produce a close-up detail drawing with accurate joints and edge conditions.',
  };
  parts.push(outputDesc[workflow.imgToCadOutput] || `Produce a ${workflow.imgToCadOutput} drawing.`);

  const line = workflow.imgToCadLine;
  parts.push(`Line sensitivity: ${line.sensitivity}/100, simplification: ${line.simplify}/100, connect gaps: ${line.connect ? 'yes' : 'no'}.`);

  const layers: string[] = [];
  if (workflow.imgToCadLayers.walls) layers.push('walls');
  if (workflow.imgToCadLayers.windows) layers.push('windows');
  if (workflow.imgToCadLayers.details) layers.push('details');
  if (workflow.imgToCadLayers.hidden) layers.push('hidden lines');
  if (layers.length > 0) {
    parts.push(`Include CAD layers for ${layers.join(', ')}.`);
  }

  parts.push(`Export as ${workflow.imgToCadFormat.toUpperCase()} with clean, continuous polylines and readable line hierarchy.`);

  return parts.filter(Boolean).join(' ');
}

function generateUpscalePrompt(state: AppState): string {
  const { workflow } = state;
  const parts: string[] = [];
  const userPrompt = state.prompt?.trim();
  const outputResolution = state.output?.resolution?.toUpperCase?.() || '4K';
  const isAiSlopMode = workflow.upscaleMode === 'ai-slop';
  const describeSlider = (value: number, low: string, high: string) => {
    if (value <= 20) return `very ${low}`;
    if (value <= 40) return low;
    if (value <= 60) return 'balanced';
    if (value <= 80) return high;
    return `very ${high}`;
  };

  parts.push(isAiSlopMode
    ? 'AI artifact restoration and precision cleanup for a degraded generated or repeatedly edited architectural image.'
    : 'Conservative architectural image restoration and upscale.'
  );
  parts.push(buildSourceImageRelationship(
    'upscale/restoration source',
    isAiSlopMode
      ? 'This is an artifact repair pass, not generation from imagination. Restore the same image to cleaner original-looking clarity using only visible source evidence.'
      : 'This is a restoration pass, not generation from imagination. Make the same image cleaner, sharper, and less noisy using only visible source evidence.'
  ));
  parts.push(`Upscale goal: ${workflow.upscaleFactor} toward ${outputResolution}; keep the original crop, aspect ratio, camera, perspective, object count, people, material identity, colors, lighting direction, and signage layout.`);
  if (isAiSlopMode) {
    parts.push(`AI slop restoration intent: sharpness ${describeSlider(workflow.upscaleSharpness, 'soft', 'crisp')}, clarity ${describeSlider(workflow.upscaleClarity, 'low', 'high')}, edge stabilization ${describeSlider(workflow.upscaleEdgeDefinition, 'soft', 'precise')}, fine-detail recovery ${describeSlider(workflow.upscaleFineDetail, 'restrained', 'detailed')}.`);
    parts.push('Repair targets: wiggly or wavy lines, melted geometry, warped edges, foggy haze, muddy texture, blotchy discoloration, color banding, over-smoothed surfaces, over-sharpen halos, noisy compression, and AI regeneration smear.');
    parts.push('Allowed changes: straighten already-visible architectural lines, restore crisp material boundaries, normalize strange color patches, remove artificial haze, deblur gently, improve anti-aliasing, and clarify source-supported texture.');
    parts.push('Strict preservation: do not redesign architecture, replace materials, change signage text or layout, alter people, add objects, remove objects, change lighting direction, or invent detail where the source is ambiguous.');
  } else {
    parts.push(`Restoration intent: sharpness ${describeSlider(workflow.upscaleSharpness, 'soft', 'crisp')}, clarity ${describeSlider(workflow.upscaleClarity, 'low', 'high')}, edge definition ${describeSlider(workflow.upscaleEdgeDefinition, 'soft', 'sharp')}, fine detail ${describeSlider(workflow.upscaleFineDetail, 'smooth', 'detailed')}.`);
    parts.push('Allowed changes: reduce noise and compression artifacts, gently deblur, improve anti-aliasing, recover local contrast, and clarify already-visible texture.');
    parts.push('Ambiguity rule: blurry, tiny, occluded, or uncertain areas should stay source-faithful and slightly soft rather than sharp and invented.');
  }

  if (userPrompt) {
    parts.push(`User notes, subordinate to preservation rules: ${userPrompt}.`);
  }

  parts.push('Final check: if enhancement and fidelity conflict, preserve the source image.');

  return parts.filter(p => p.trim()).join('\n');
}

function generateMultiAnglePrompt(state: AppState): string {
  const { workflow, activeStyleId, customStyles, lighting, context } = state;
  const parts: string[] = [];
  const availableStyles = [...BUILT_IN_STYLES, ...(customStyles ?? [])];
  const style = availableStyles.find(s => s.id === activeStyleId);
  const isNoStyle = style?.id === 'no-style';

  const count = Math.max(1, workflow.multiAngleViewCount);

  // Determine optimal grid layout (matches useGeneration.ts logic)
  let gridRows = 1;
  let gridCols = count;

  if (count === 1) {
    gridRows = 1;
    gridCols = 1;
  } else if (count === 2) {
    gridRows = 1;
    gridCols = 2;
  } else if (count === 3) {
    gridRows = 1;
    gridCols = 3;
  } else if (count === 4) {
    gridRows = 2;
    gridCols = 2;
  } else if (count === 5) {
    gridRows = 2;
    gridCols = 3;
  } else if (count === 6) {
    gridRows = 2;
    gridCols = 3;
  } else if (count === 7) {
    gridRows = 2;
    gridCols = 4;
  } else if (count === 8) {
    gridRows = 2;
    gridCols = 4;
  } else if (count === 9) {
    gridRows = 3;
    gridCols = 3;
  } else if (count === 10) {
    gridRows = 2;
    gridCols = 5;
  } else if (count === 12) {
    gridRows = 3;
    gridCols = 4;
  } else {
    gridRows = 2;
    gridCols = Math.ceil(count / 2);
  }

  // Core multi-angle instruction
  parts.push(`Act as a 3D camera operator. Using the attached image as the absolute geometric reference, generate a multi-angle orthographic study of this building. Keep the internal proportions, textures, and material properties 100% consistent.`);
  parts.push('Input relationship: the attached image is the locked building identity reference. Reconstruct the same building across every panel with identical massing, facade rhythm, openings, roof form, materials, colors, signage blocks, and entourage rules; only the camera orbit changes.');
  parts.push(`Render a ${gridRows}x${gridCols} grid showing ${count} different camera angles with Y-axis rotations (0°, 90°, 180°, 270°, etc.).`);
  parts.push('Camera discipline: each panel must use a consistent orthographic lens, matching camera height and elevation unless the selected angle range says otherwise. Do not change scale or crop between panels.');
  parts.push(SOURCE_TEXT_SIGNAGE_LOCK);
  parts.push(`Lighting Instruction: Maintain a fixed global light source so that shadows shift realistically as the camera moves around the building. No hallucinations, extra wings, new facade systems, alternate materials, or added features.`);

  // User's custom prompt/description
  if (state.prompt?.trim()) {
    parts.push(`Additional requirements: ${state.prompt.trim()}`);
  }

  // Style description
  if (!isNoStyle && style && style.description) {
    parts.push(`Style: ${style.description}`);
  }

  // Lighting description
  const timeDesc: Record<string, string> = {
    'dawn': 'soft early morning light',
    'morning': 'fresh morning sunlight',
    'noon': 'midday sun',
    'afternoon': 'warm afternoon light',
    'golden-hour': 'rich golden hour illumination',
    'sunset': 'dramatic sunset colors',
    'dusk': 'fading twilight',
    'night': 'nighttime illumination',
  };
  const weatherDesc: Record<string, string> = {
    'clear': 'under clear skies',
    'partly-cloudy': 'with scattered clouds',
    'overcast': 'under soft overcast conditions',
    'stormy': 'with dramatic storm clouds',
  };
  parts.push(`Lighting: ${timeDesc[lighting.timeOfDay] || lighting.timeOfDay} ${weatherDesc[lighting.weather] || ''}.`);

  // Context description
  if (context.vegetation) {
    const vegDesc = context.vegetationDensity > 50 ? 'lush, abundant' : 'tasteful, restrained';
    parts.push(`Landscape: ${vegDesc} ${context.season} landscaping.`);
  }
  if (context.people) {
    parts.push('Include people for scale.');
  }

  return parts.filter(p => p.trim()).join(' ');
}

function generateAngleChangePrompt(state: AppState): string {
  const angleDeg = Math.max(-90, Math.min(90, Math.round(state.workflow.angleChangeDegrees)));
  const tiltDeg = Math.max(-30, Math.min(30, Math.round(state.workflow.angleChangePitch)));
  const angleAbs = Math.abs(angleDeg);
  const tiltAbs = Math.abs(tiltDeg);
  const angle =
    Math.abs(angleDeg) < 3
      ? 'from the original camera direction'
      : angleDeg > 0
        ? `as if the photographer turned ${angleAbs}° to the right`
        : `as if the photographer turned ${angleAbs}° to the left`;
  const tilt =
    Math.abs(tiltDeg) < 3
      ? 'with a level camera'
      : tiltDeg > 0
        ? `with the camera tilted ${tiltAbs}° up, showing more ceiling`
        : `with the camera tilted ${tiltAbs}° down, showing more floor`;

  return [
    `Show the same space ${angle}, ${tilt}.`,
    'Keep the design, layout, materials, lighting, and any people consistent with the reference image.',
    'Do not rotate, flip, or crop the existing picture; create a new upright camera view.',
  ].join(' ');
}

const formatYesNo = (value: boolean) => (value ? 'yes' : 'no');

function generateMasterplanPrompt(state: AppState): string {
  const { workflow } = state;
  const parts: string[] = [];

  // Opening
  if (state.prompt?.trim()) {
    parts.push(`Create the masterplan visualization from this user brief: "${state.prompt.trim()}".`);
  } else {
    const planTypeDescriptions: Record<string, string> = {
      site: 'Create a site plan visualization that clearly communicates the development layout and spatial relationships',
      urban: 'Generate an urban masterplan visualization showing the broader district context and city fabric',
      zoning: 'Produce a clear zoning diagram that effectively communicates land use designations and boundaries',
      massing: 'Create a massing study visualization that reveals the volumetric relationships between buildings',
    };
    parts.push(`${planTypeDescriptions[workflow.mpPlanType] || 'Create a masterplan visualization'}.`);
  }

  // Scale context
  const scaleValue = workflow.mpScale === 'custom' ? `1:${workflow.mpCustomScale}` : workflow.mpScale;
  const scaleDesc = scaleValue.includes('500') ? 'detailed site scale' :
    scaleValue.includes('1000') ? 'neighborhood scale' :
    scaleValue.includes('2500') ? 'district scale' : `${scaleValue} scale`;
  parts.push(`Render at ${scaleDesc} with north oriented ${Math.round(workflow.mpNorthRotation) === 0 ? 'to the top of the image' : `${Math.round(workflow.mpNorthRotation)} degrees from vertical`}.`);

  // Fidelity constraints
  const boundaryMode = workflow.mpBoundary?.mode || 'auto';
  parts.push('If a masterplan drawing is provided as input, treat it as the authoritative layout. Preserve boundaries, parcel edges, roads, water, footprints, existing labels, legend position, and north orientation. Do not rotate, mirror, reframe, or redraw the plan unless the selected view angle requires a controlled axonometric translation.');
  parts.push('Label discipline: preserve readable source labels. For new labels, render only concise exact annotation text with clean, sharp alignment.');

  if (boundaryMode === 'custom') {
    parts.push('Respect the custom site boundary exactly as defined.');
  }
  if (workflow.mpZones.length > 0) {
    const zoneNames = workflow.mpZones.slice(0, 8).map((zone) => zone.name).filter(Boolean);
    parts.push(`Use the configured ${workflow.mpZoneDetection} zone logic${zoneNames.length ? ` for zones such as ${zoneNames.join(', ')}` : ''}.`);
  }
  const contextData = compactItems([
    workflow.mpContext.loadBuildings ? 'surrounding buildings' : null,
    workflow.mpContext.loadRoads ? 'roads' : null,
    workflow.mpContext.loadWater ? 'water' : null,
    workflow.mpContext.loadTerrain ? 'terrain' : null,
    workflow.mpContext.loadTransit ? 'transit' : null
  ]);
  if (contextData.length > 0) {
    parts.push(`Use contextual data cues for ${contextData.join(', ')} while keeping the submitted plan layout authoritative.`);
  }

  // Output style
  const styleDescriptions: Record<string, string> = {
    'photorealistic': 'Render in a realistic aerial photography style with natural materials, shadows, and textures',
    'illustrative': 'Create an elegant illustrative style with stylized graphics and clear visual hierarchy',
    'diagrammatic': 'Produce a clean diagrammatic representation optimized for clarity and information',
    'hybrid': 'Blend realistic aerial context with clean diagram overlays and readable plan hierarchy',
  };
  parts.push(`${styleDescriptions[workflow.mpOutputStyle] || `Use ${workflow.mpOutputStyle} styling`}.`);

  // View angle
  if (workflow.mpViewAngle === 'custom') {
    const perspDesc = workflow.mpViewCustom.perspective > 50 ? 'with noticeable perspective depth' : 'with minimal perspective distortion';
    parts.push(`View the plan from a custom angle: elevation ${workflow.mpViewCustom.elevation} degrees, rotation ${workflow.mpViewCustom.rotation} degrees, ${perspDesc}.`);
  } else {
    const viewDescriptions: Record<string, string> = {
      'top': 'View directly from above in true plan view',
      'iso-ne': 'Use a northeast isometric view that reveals building height while keeping plan logic readable',
      'iso-nw': 'Use a northwest isometric view that reveals building height while keeping plan logic readable',
      'iso-se': 'Use a southeast isometric view that reveals building height while keeping plan logic readable',
      'iso-sw': 'Use a southwest isometric view that reveals building height while keeping plan logic readable',
    };
    parts.push(`${viewDescriptions[workflow.mpViewAngle] || workflow.mpViewAngle}.`);
  }

  // Buildings
  const buildings = workflow.mpBuildings;
  const buildingStyleDesc: Record<string, string> = {
    'massing': 'as simple volumetric masses focusing on form and scale',
    'detailed': 'with detailed facades and architectural character',
    'schematic': 'as schematic blocks with clear footprints',
    'realistic': 'with realistic materials and architectural detail',
  };
  parts.push(`Render buildings ${buildingStyleDesc[buildings.style] || `in ${buildings.style} style`}.`);

  const heightDesc = buildings.heightMode === 'vary'
    ? `Heights should vary naturally between ${buildings.heightRange.min}m and ${buildings.heightRange.max}m to create a dynamic skyline`
    : buildings.heightMode === 'from-color'
      ? 'Building heights should be derived from the color coding in the source'
      : `Buildings should be rendered at a uniform ${buildings.defaultHeight}m height`;
  parts.push(`${heightDesc}, with ${buildings.roofStyle} roof forms.`);

  if (buildings.showShadows) {
    parts.push('Cast realistic shadows to communicate building heights and light direction.');
  }
  if (buildings.transparent) {
    parts.push('Render buildings with some transparency to reveal ground-level activity beneath.');
  }
  if (buildings.facadeVariation) {
    parts.push('Add subtle facade variations to differentiate individual buildings.');
  }
  if (buildings.showFloorLabels) {
    parts.push('Show floor labels only where legible and useful; keep them exact and minimal.');
  }

  // Landscape
  const landscape = workflow.mpLandscape;
  const seasonDesc: Record<string, string> = {
    'spring': 'fresh spring colors with new growth',
    'summer': 'lush summer foliage at full density',
    'autumn': 'warm autumn tones with changing leaves',
    'winter': 'sparse winter vegetation',
  };
  parts.push(`Show ${seasonDesc[landscape.season] || landscape.season} landscaping.`);

  const vegDensityDesc = landscape.vegetationDensity > 70 ? 'abundant, park-like' :
    landscape.vegetationDensity > 40 ? 'balanced' : 'minimal, urban';
  parts.push(`The vegetation should be ${vegDensityDesc} in character.`);

  const landscapeFeatures: string[] = [];
  if (landscape.trees) landscapeFeatures.push('mature trees providing canopy');
  if (landscape.grass) landscapeFeatures.push('manicured lawns and green spaces');
  if (landscape.water) landscapeFeatures.push('water features and bodies');
  if (landscape.pathways) landscapeFeatures.push('pedestrian paths and walkways');
  if (landscape.streetFurniture) landscapeFeatures.push('street furniture and urban amenities');
  if (landscape.vehicles) landscapeFeatures.push('parked vehicles indicating activity');
  if (landscape.people) landscapeFeatures.push('people animating public spaces');

  if (landscapeFeatures.length > 0) {
    parts.push(`Include ${landscapeFeatures.join(', ')}.`);
  }

  // Annotations
  const annotations = workflow.mpAnnotations;
  const annotationElements: string[] = [];
  if (annotations.zoneLabels) annotationElements.push('clear zone labels');
  if (annotations.streetNames) annotationElements.push('street names');
  if (annotations.buildingLabels) annotationElements.push('building identifiers');
  if (annotations.lotNumbers) annotationElements.push('lot numbers');
  if (annotations.scaleBar) annotationElements.push('a graphic scale bar');
  if (annotations.northArrow) annotationElements.push('a north arrow');
  if (annotations.dimensions) annotationElements.push('key dimensions');
  if (annotations.areaCalc) annotationElements.push('area calculations');
  if (annotations.contourLabels) annotationElements.push('topographic contour labels');

  if (annotationElements.length > 0) {
    parts.push(`Add ${annotationElements.join(', ')} using ${annotations.labelStyle} typography with clean alignment, ${annotations.labelSize} size, ${annotations.labelColor} label color${annotations.labelHalo ? ', and subtle halos for contrast' : ''}.`);
  }

  // Legend
  const legend = workflow.mpLegend;
  if (legend.include) {
    const legendElements: string[] = [];
    if (legend.showZones) legendElements.push('land use zones');
    if (legend.showZoneAreas) legendElements.push('zone areas');
    if (legend.showBuildings) legendElements.push('building types');
    if (legend.showLandscape) legendElements.push('landscape elements');
    if (legend.showInfrastructure) legendElements.push('infrastructure');

    if (legendElements.length > 0) {
      parts.push(`Include a ${legend.style} legend in the ${legend.position} showing ${legendElements.join(', ')}.`);
    }
  }

  // Context
  if (workflow.mpContext?.location) {
    parts.push(`This development is located in ${workflow.mpContext.location}.`);
  }
  const exportSettings = workflow.mpExport;
  parts.push(`Export intent: ${exportSettings.resolution} ${exportSettings.format.toUpperCase()}${exportSettings.exportLayers ? ', layer-friendly output' : ''}${exportSettings.cadCompatible ? ', CAD-compatible graphic hierarchy' : ''}${exportSettings.includeSketch ? ', include sketch traces where useful' : ''}.`);

  // Quality closing
  parts.push('The final visualization should clearly communicate the design intent and plan hierarchy.');

  return parts.filter(Boolean).join(' ');
}

function generateExplodedPrompt(state: AppState): string {
  const { workflow } = state;
  const parts: string[] = [];

  // Opening
  if (state.prompt?.trim()) {
    parts.push(`Create the exploded architectural view from this user brief: "${state.prompt.trim()}".`);
  } else {
    parts.push('Create an exploded architectural view that explains the building assembly.');
  }

  // Fidelity constraints
  parts.push('Treat the input model as the definitive source for all geometry. Each component must maintain its exact shape, scale, and internal alignment. Separate the parts only along the specified explosion axis without introducing any rotation, distortion, or scaling changes. Do not add or remove any components. Keep the camera framing consistent with the source view.');
  parts.push('Source preservation: the exploded result must still read as the same project, with the same proportions, facade rhythm, openings, roof shape, structural grid, material identity, and existing signage or annotation blocks. Only the disassembly spacing, diagram hierarchy, and requested labels may change.');
  parts.push('Text discipline: render new component labels, leader notes, dimensions, and assembly numbers only when requested, with crisp readable typography. Preserve any existing source text as source-faithful marks unless a new diagram label intentionally replaces it.');
  parts.push(`Component detection mode: ${workflow.explodedDetection}. Source type: ${workflow.explodedSource.type}${workflow.explodedSource.fileName ? ` (${workflow.explodedSource.fileName})` : ''}.`);

  // Explosion direction
  const directionDesc: Record<string, string> = {
    'vertical': 'Separate the building layers vertically, lifting floor plates, roof, and systems upward to reveal the stacking logic',
    'radial': 'Explode components outward from the center, revealing the core and peripheral relationships',
    'custom': `Separate components along the custom axis x=${workflow.explodedAxis.x}, y=${workflow.explodedAxis.y}, z=${workflow.explodedAxis.z}`,
  };
  parts.push(`${directionDesc[workflow.explodedDirection] || `Explode ${workflow.explodedDirection}`}.`);

  // Separation amount
  const separationDesc = workflow.explodedView.separation > 100 ? 'generous spacing that clearly separates each component' :
    workflow.explodedView.separation > 50 ? 'moderate spacing for clear component identification' :
    'tight spacing that maintains spatial relationships while revealing connections';
  parts.push(`Use ${separationDesc}.`);

  // View description
  const view = workflow.explodedView;
  if (view.type === 'axon') {
    const angleDesc: Record<string, string> = {
      'iso-ne': 'northeast isometric projection with clear front and side faces',
      'iso-nw': 'northwest isometric projection with clear front and side faces',
      'iso-se': 'southeast isometric projection with clear front and side faces',
      'iso-sw': 'southwest isometric projection with clear front and side faces',
    };
    parts.push(`Present the exploded view in ${angleDesc[view.angle] || `${view.angle} axonometric projection`}.`);
  } else {
    const heightDesc = view.cameraHeight < 5 ? 'intimate, low angle' :
      view.cameraHeight < 15 ? 'comfortable eye-level perspective' : 'elevated overview';
    parts.push(`View the exploded assembly from a ${heightDesc}, with a field of view that captures all components in context.`);
  }

  // Dissection style (make this highly specific to avoid similar results)
  const style = workflow.explodedStyle;
  const dissectionDesc: Record<string, string[]> = {
    'stacked': [
      'Dissection style: stacked layers.',
      'Split the building into clear horizontal strata (foundation/core, floor plates, roof, and major systems).',
      'Keep every layer perfectly aligned on a single vertical axis with equal, consistent spacing.',
      'No rotation or lateral drift; the stack should read as a clean vertical assembly diagram.'
    ],
    'radial': [
      'Dissection style: radial burst.',
      'Explode all components outward from the geometric center in 360° while keeping their original orientation.',
      'Maintain a fixed core at the center and place components on concentric rings with increasing radius.',
      'The layout should feel like a starburst diagram with clear radial gaps between parts.'
    ],
    'sequential': [
      'Dissection style: sequential assembly.',
      'Lay components along a single primary axis in a strict order of assembly (start → finish).',
      'Use progressive spacing so the order is unambiguous, like frames in an assembly timeline.',
      'Keep components aligned to the axis with no rotation; the sequence should read left-to-right or bottom-to-top.'
    ],
    'core-shell': [
      'Dissection style: core-shell separation.',
      'Keep the structural core fixed and separate the envelope and roof as distinct shells around it.',
      'Pull the facade and roof outward evenly, preserving their alignment to the core.',
      'The result should clearly show the relationship between core, interior, and envelope layers.'
    ],
    'slice': [
      'Dissection style: slice-lift.',
      'Cut the building into a small number of thick slices (3-6) perpendicular to the main axis.',
      'Lift or offset each slice evenly while preserving perfect registration between slices.',
      'The slices should read like clean cross-sections with visible cut faces.'
    ],
    'systems': [
      'Dissection style: systems separation.',
      'Group components by system (structure, envelope, MEP, interior) and separate each group into its own band.',
      'Keep parts within each system tightly clustered and aligned, with clear gaps between systems.',
      'The diagram should read as distinct system layers rather than individual parts scattered evenly.'
    ],
  };
  const dissection = dissectionDesc[style.render] || [`Dissection style: ${style.render}.`];
  parts.push(...dissection);

  // Color treatment
  const colorDesc: Record<string, string> = {
    'material': 'Color each component according to its actual material appearance',
    'system': 'Use a color-coding scheme to differentiate building systems',
    'mono': 'Keep the palette monochromatic to emphasize form over material',
  };
  parts.push(`${colorDesc[style.colorMode] || `Use ${style.colorMode} coloring`}.`);

  // Edge treatment
  const edgeStyleDesc: Record<string, string> = {
    'hidden-removed': 'clean edges with hidden lines removed for clarity',
    'hidden-dashed': 'technical style with hidden lines shown as dashes',
    'all-visible': 'all edges visible for complete structural understanding',
    'silhouette': 'bold silhouette edges emphasizing overall form',
  };
  const edgeDesc = edgeStyleDesc[style.edgeStyle] || `${style.edgeStyle} edge treatment`;
  const weightDesc = style.lineWeight > 2 ? 'bold line weights for clear hierarchy' :
    style.lineWeight < 1 ? 'delicate line weights for a refined look' : 'balanced line weights';
  parts.push(`Apply ${edgeDesc} with ${weightDesc}.`);

  // Components
  const activeComponents = workflow.explodedComponents.filter((comp) => comp.active);
  if (activeComponents.length > 0) {
    const names = activeComponents.slice(0, 6).map((comp) => comp.title || comp.name);
    parts.push(`Feature these key components in the explosion: ${names.join(', ')}${activeComponents.length > 6 ? ' and others' : ''}.`);
    const componentNotes = activeComponents
      .slice(0, 4)
      .map((comp) => compactItems([comp.description, comp.attributes?.length ? `attributes ${comp.attributes.join(', ')}` : null]).join(', '))
      .filter(Boolean);
    if (componentNotes.length > 0) {
      parts.push(`Component notes: ${componentNotes.join('; ')}.`);
    }
  }

  // Annotations
  const annotations = workflow.explodedAnnotations;
  const annotationElements: string[] = [];
  if (annotations.labels) annotationElements.push('clear component labels');
  if (annotations.leaders) annotationElements.push('leader lines connecting labels to parts');
  if (annotations.dimensions) annotationElements.push('key dimensions');
  if (annotations.assemblyNumbers) annotationElements.push('assembly sequence numbers');
  if (annotations.materialCallouts) annotationElements.push('material callouts');

  if (annotationElements.length > 0) {
    parts.push(`Add ${annotationElements.join(', ')} using ${annotations.labelStyle} typography, ${annotations.fontSize} size, and ${annotations.leaderStyle} leader logic where leaders are enabled.`);
  }

  // Animation
  const anim = workflow.explodedAnim;
  if (anim.generate) {
    const easingDesc: Record<string, string> = {
      'linear': 'smooth, constant speed',
      'ease-in-out': 'graceful acceleration and deceleration',
      'ease-out': 'energetic start settling to a gentle stop',
      'bounce': 'playful bounce as components reach position',
    };
    parts.push(`Generate an animation that ${anim.type === 'explosion' ? 'separates the components outward' : 'assembles the components together'} over ${anim.duration} seconds with ${easingDesc[anim.easing] || anim.easing}.`);
  }

  // Output
  const output = workflow.explodedOutput;
  const bgDesc: Record<string, string> = {
    'white': 'a clean white background',
    'gray': 'a neutral gray background',
    'black': 'a clean black background with readable contrast',
    'transparent': 'a clean pure white background for compositing',
  };
  parts.push(`Render against ${bgDesc[output.background] || output.background}.`);
  parts.push(`Output target: ${output.resolution}${output.exportLayers ? ', layer-friendly diagram organization' : ''}.`);

  if (output.groundPlane) {
    parts.push('Include a ground plane to anchor the assembly.');
  }
  if (output.shadow) {
    parts.push('Cast soft shadows to enhance depth and component separation.');
  }
  if (output.grid) {
    parts.push('Show a reference grid for scale.');
  }

  parts.push('The final image should clearly communicate the building assembly logic.');

  return parts.filter(Boolean).join(' ');
}

function generateSectionPrompt(state: AppState): string {
  const { workflow } = state;
  const parts: string[] = [];

  // Opening
  if (state.prompt?.trim()) {
    parts.push(`Create the architectural section from this user brief: "${state.prompt.trim()}".`);
  } else {
    parts.push('Create an architectural section/cutaway that explains interior space, construction logic, and inside-outside relationships.');
  }

  // Fidelity constraints
  parts.push('Treat the input model or drawing as the authoritative source. Keep the cut plane, scale, orientation, alignment, proportions, and section depth as specified. Do not relocate components or reveal content outside the cut and visibility settings.');
  parts.push('POV and text preservation: keep the sectional viewpoint, projection logic, floor datums, structural grid, and source label positions consistent. Preserve readable source text; render new labels only when requested, exact, sharp, and unobtrusive.');
  parts.push(`Section setup: ${workflow.sectionAreaDetection} area detection, cut plane ${workflow.sectionCut.plane}, direction ${workflow.sectionCut.direction}.`);

  // Cut description
  const cut = workflow.sectionCut;
  const cutTypeDesc: Record<string, string> = {
    'vertical': 'Cut vertically through the building, revealing the stacked spatial sequence from foundation to roof',
    'horizontal': 'Cut horizontally at the specified height to expose the plan-level organization',
    'diagonal': 'Cut diagonally to reveal unique spatial relationships',
  };
  parts.push(`${cutTypeDesc[cut.type] || `Make a ${cut.type} cut`}.`);

  const depthDesc = cut.depth > 70 ? 'deep into the building, revealing multiple layers' :
    cut.depth > 40 ? 'through the primary spaces' : 'at a shallow depth focusing on the facade zone';
  parts.push(`The section cuts ${depthDesc}.`);

  // Reveal style
  const reveal = workflow.sectionReveal;
  const revealStyleDesc: Record<string, string[]> = {
    'front-peel': [
      'Reveal style: front peel.',
      'Pull the front facade forward as a single, clean slab to expose the interior behind it.',
      'Keep the peeled layer parallel to the original facade plane; do not tilt or warp it.',
      'Show a clear gap between the peeled facade and the remaining building mass to emphasize depth.',
      'Interior elements should be fully visible and undistorted, with the peeled face acting as a foreground layer.',
      'Example: a townhouse where the street facade is peeled forward to reveal rooms and stairs inside.',
    ],
    'slice-lift': [
      'Reveal style: slice + lift.',
      'Extract a vertical slice of the building and lift it upward, keeping the slice thickness consistent.',
      'The lifted slice should remain aligned with the original cut plane and stay orthographic, not skewed.',
      'Expose the void left behind with clean cut faces and a readable interior cross-section.',
      'Maintain the original stacking and spacing of floors within the lifted slice.',
      'Example: an office tower with a central slice lifted to show floor plates and core alignment.',
    ],
    'stacked-floors': [
      'Reveal style: stacked floors.',
      'Separate each floor plate and its immediate program layer into clean, horizontal strata.',
      'Stack the floors upward with equal spacing, keeping them perfectly aligned in plan.',
      'Maintain consistent thickness for slabs, ceilings, and floor assemblies across all layers.',
      'Expose the vertical voids (stairs, cores, atriums) by aligning them through the stack.',
      'Use clear gaps between floors so the hierarchy of levels reads instantly.',
      'Example: a residential block with four floor plates separated vertically, showing rooms, slabs, and the core aligned through all levels.',
    ],
    'core-focus': [
      'Reveal style: core focus.',
      'Emphasize the central core (stairs, elevators, shafts) as the primary element in the section.',
      'De-emphasize perimeter rooms with lighter line weight or translucency.',
      'Keep the core solid, high-contrast, and uninterrupted through all floors.',
      'Show structural connections from the core to the floor plates clearly.',
      'Example: a mid-rise where the core is bold and dark, with lighter surrounding rooms.',
    ],
    'program-color': [
      'Reveal style: program blocks.',
      'Divide the section into clear program zones and color each zone distinctly.',
      'Use large, legible color blocks with minimal texture so program reads at a glance.',
      'Keep cut faces and structure visible beneath or alongside color fields.',
      'Maintain consistent program colors across all levels for coherence.',
      'Example: a school section with classrooms, circulation, and services each in different colors.',
    ],
    circulation: [
      'Reveal style: circulation.',
      'Highlight circulation paths (stairs, corridors, ramps) with strong contrast or a single accent color.',
      'Keep program spaces secondary so circulation reads as the dominant graphic.',
      'Show vertical connections clearly through multiple levels, emphasizing continuity.',
      'Use simplified, clean linework for circulation elements to avoid clutter.',
      'Example: a museum section where stair and corridor paths are highlighted in dark gray.',
    ],
    services: [
      'Reveal style: services.',
      'Emphasize mechanical, electrical, and plumbing routes in the section.',
      'Use distinct linework or color for ducts, risers, and service zones.',
      'Keep architectural spaces visible but lighter than the service network.',
      'Make service runs continuous and legible across floors.',
      'Example: a hospital section showing bold service bands and vertical risers throughout.',
    ],
    sharp: [
      'Reveal style: sharp cut.',
      'Use crisp, hard edges at the cut plane with no feathering, blur, or glow.',
      'Keep the cut line perfectly straight and planar, exposing material faces cleanly and uniformly.',
      'Make the cut faces read like freshly sliced material, with tight edges and no softness.',
      'Maintain strong contrast between cut surfaces and uncut context so the section reads instantly.',
      'Use solid pochÃ© or firm hatching on cut faces; avoid gradients or translucency.',
      'Keep interior linework lighter than the cut to preserve a clear hierarchy.',
      'Example: a library section with bold black cut walls, sharp slab edges, and clear interior spaces visible beyond.',
    ],
    gradient: [
      'Reveal style: gradient cut.',
      'Let the cut edge transition smoothly into the interior with a clear depth falloff.',
      'Fade foreground cut surfaces first, then soften secondary elements deeper in the section.',
      'Use a controlled tonal ramp so the cut plane remains readable while depth cues build.',
      'Avoid sudden drop-offs; the reveal should feel atmospheric and layered, not erased.',
      'Keep a subtle but visible edge line at the cut plane to anchor the section.',
      'Let glazing and thin elements remain legible as they fade, rather than disappearing abruptly.',
      'Example: an office section where the cut edge is firm, then fades into lighter interior details and background structure.',
    ],
    outlined: [
      'Reveal style: outlined cut.',
      'Draw bold outlines around cut faces and sectional edges to emphasize the slice.',
      'Use a strong graphic contour to separate cut materials from background geometry.',
      'Keep outlines continuous and clean, with consistent line weight and no sketchiness.',
      'Let the outline act as a visual boundary for the section plane, framing the interior.',
      'Use minimal fill or flat, light fills so the outline carries the graphic weight.',
      'Interior detail should be thinner and lighter than the outline to avoid clutter.',
      'Example: a residential section where the cut plane is traced in a heavy line, with lighter interior lines and minimal fills.',
    ],
    ghosted: [
      'Reveal style: ghosted cut.',
      'Make the removed material semi-transparent so the void is implied rather than fully erased.',
      'Leave a faint silhouette of the cut mass while keeping interior elements readable.',
      'Use translucency to show both the removed volume and the revealed interior in balance.',
      'Keep the cut plane visible but subtle, like a thin veil over the removed material.',
      'Ghost the removed volume with low opacity and keep interior structure at higher opacity for clarity.',
      'Avoid heavy pochÃ©; use light tonal overlays to suggest mass without blocking the interior.',
      'Example: a factory section with the cut volume lightly ghosted while structure and spaces stay clear and readable.',
    ],
  };
  const revealStyleLines = revealStyleDesc[reveal.style] || [`Reveal style: ${reveal.style}.`];
  parts.push(...revealStyleLines);

  const focusDesc: Record<string, string> = {
    'residential': 'Focus attention on residential spaces and domestic organization',
    'parking': 'Emphasize parking, ramps, access, and vehicle circulation',
    'circulation': 'Highlight circulation routes and vertical connections',
    'services': 'Emphasize service routes, shafts, and mechanical organization',
    'mixed': 'Balance multiple program types with clear hierarchy',
    'amenities': 'Highlight amenity spaces and shared program',
    'lobby': 'Emphasize lobby sequence, entry, and public threshold',
    'retail': 'Highlight retail frontage, depth, and public access',
    'office': 'Show office floor organization, cores, and work areas',
    'mechanical': 'Emphasize mechanical zones and service clearances',
    'storage': 'Highlight storage areas and back-of-house relationships',
  };
  if (reveal.focus) {
    parts.push(`${focusDesc[reveal.focus] || `Focus on ${reveal.focus}`}.`);
  }

  // Facade and depth treatment
  const facadeDesc = reveal.facadeOpacity > 70 ? 'Keep the facade mostly opaque, with the section revealing what lies behind' :
    reveal.facadeOpacity > 30 ? 'Make the facade semi-transparent to hint at interior conditions' :
    'Ghost the facade almost completely to prioritize the sectional view';
  parts.push(`${facadeDesc}.`);

  if (reveal.depthFade > 30) {
    const fadeDesc = reveal.depthFade > 60 ? 'Fade elements significantly with depth, creating atmospheric perspective' :
      'Apply subtle depth fade to enhance spatial reading';
    parts.push(`${fadeDesc}.`);
  }

  // Section areas
  const areas = workflow.sectionAreas || [];
  const activeAreas = areas.filter((area) => area.active);
  if (activeAreas.length > 0) {
    const areaNames = activeAreas.slice(0, 6).map(area => {
      const title = area.title?.trim() || 'Untitled space';
      return title;
    });
    parts.push(`Highlight these key spaces in the section: ${areaNames.join(', ')}${activeAreas.length > 6 ? ' and others' : ''}.`);
  }

  // Program visualization
  const program = workflow.sectionProgram;
  const colorModeDesc: Record<string, string> = {
    'program': 'Color-code spaces by their programmatic use',
    'material': 'Show actual material colors in the section',
    'mono': 'Keep the section monochromatic for a clean, technical look',
  };
  parts.push(`${colorModeDesc[program.colorMode] || `Use ${program.colorMode} coloring`}.`);

  const programAnnotations: string[] = [];
  if (program.labels) programAnnotations.push('space labels');
  if (program.leaderLines) programAnnotations.push('leader lines');
  if (program.areaTags) programAnnotations.push('area measurements');

  if (programAnnotations.length > 0) {
    parts.push(`Add ${programAnnotations.join(', ')} using ${program.labelStyle} typography at ${program.fontSize} size.`);
  }

  // Section style
  const style = workflow.sectionStyle;
  const pocheDesc: Record<string, string> = {
    'solid': 'Render cut materials as solid black poché',
    'hatched': 'Apply traditional hatching to indicate cut materials',
    'gradient': 'Use gradient fills in cut areas',
    'none': 'Leave cut areas unfilled',
  };
  parts.push(`${pocheDesc[style.poche] || `Use ${style.poche} poché`}.`);

  if (style.hatch) {
    const hatchDesc: Record<string, string> = {
      'solid': 'solid fill hatching',
      'diag': 'diagonal line hatching',
      'cross': 'cross-hatch patterns',
    };
    parts.push(`Apply ${hatchDesc[style.hatch] || style.hatch} patterns to differentiate materials.`);
  }

  const weightDescMap: Record<string, string> = {
    'light': 'delicate line weights for a refined drawing',
    'medium': 'balanced line weights',
    'heavy': 'bold line weights that read clearly at any scale',
  };
  const weightDesc = weightDescMap[style.weight] || 'balanced line weights';
  parts.push(`Use ${weightDesc}.`);

  if (style.showBeyond > 50) {
    parts.push('Show elements beyond the cut plane to provide context and depth.');
  } else if (style.showBeyond > 20) {
    parts.push('Lightly indicate elements beyond the cut plane.');
  }

  parts.push('The final section should clearly communicate spatial organization and construction.');

  return parts.filter(Boolean).join(' ');
}

function generateVideoPrompt(state: AppState): string {
  const { workflow } = state;
  const video = workflow.videoState;
  const parts: string[] = [];
  const userBrief = state.prompt?.trim() || video.scenario?.trim();

  const modeDesc: Record<string, string> = {
    'image-animate': 'Animate the attached architectural image into a coherent short video.',
    'image-morph': 'Create a smooth architectural video transition between the provided start frame and end frame.',
    'camera-path': 'Generate an architectural visualization video with a deliberate camera path.',
    'multi-shot': 'Generate a concise multi-shot architectural visualization sequence.',
  };
  parts.push(modeDesc[video.inputMode] || 'Generate an architectural visualization video.');

  if (userBrief) {
    parts.push(`Creative direction: ${userBrief}.`);
  }

  if (video.inputMode === 'image-animate') {
    parts.push('Input relationship: the attached image is the locked first frame. Preserve its architecture, materials, lighting mood, signage/text shapes, camera perspective, horizon, crop, and object placement at the start of the video.');
  } else if (video.inputMode === 'image-morph') {
    parts.push('Input relationship: the first frame and final frame are authoritative keyframes. Preserve each keyframe composition at its endpoint and interpolate only the physically plausible motion between them.');
  } else if (video.keyframes.length > 0) {
    parts.push(`Input relationship: use the ${video.keyframes.length} provided keyframe images as authoritative continuity anchors. Preserve project identity, proportions, materials, signage/text shapes, lighting logic, and viewpoint continuity between shots.`);
  } else {
    parts.push(TEXT_TO_IMAGE_FRAMEWORK);
  }

  const motionStyleDesc: Record<string, string> = {
    smooth: 'smooth and controlled motion',
    dynamic: 'dynamic motion with confident pacing',
    energetic: 'energetic motion with faster transitions',
    elegant: 'elegant, premium architectural camera movement',
    cinematic: 'cinematic motion with measured acceleration and atmospheric depth',
    subtle: 'subtle motion with minimal transformation',
    dramatic: 'dramatic movement with expressive reveal timing',
    gentle: 'gentle motion with calm pacing',
  };
  parts.push(`Motion style: ${motionStyleDesc[video.motionStyle] || video.motionStyle}. Duration ${video.duration}s, aspect ratio ${video.aspectRatio}, target resolution ${video.resolution}.`);

  const camera = video.camera;
  if (camera.type === 'static') {
    parts.push('Camera: static locked-off shot with only natural environmental motion where appropriate.');
  } else {
    parts.push(`Camera: ${camera.type} movement at ${camera.speed} speed, direction ${camera.direction} degrees, smoothness ${camera.smoothness}/100. Keep the motion physically plausible for an architectural camera rig; avoid sudden jumps, rolling shutter wobble, or perspective drift.`);
  }

  parts.push('Continuity contract: preserve building identity, room or site layout, material boundaries, window/door positions, furniture/entourage placement, shadows, reflections, and scale relationships over time. Motion should reveal or animate the scene, not redesign it.');
  parts.push('Text/signage continuity: existing text, logos, numbers, signs, labels, screens, and graphic blocks must stay stable and source-faithful across frames. Do not translate, rewrite, invent, melt, flicker, or replace text unless explicitly requested.');
  parts.push('Temporal quality: maintain stable geometry with no warping, pulsing walls, swimming textures, duplicated people, disappearing objects, or changing camera viewpoint beyond the requested camera path.');

  if (video.generateAudio) {
    parts.push('If audio is generated, keep it subtle, spatially plausible, and secondary to the architectural visualization.');
  }

  return parts.filter(Boolean).join(' ');
}

export function generatePrompt(state: AppState): string {
  const { workflow, activeStyleId, lighting, context, materials, camera } = state;

  // If user provided a specific text prompt in text-to-image mode or visual edit, prioritize it or combine it.
  if (state.mode === 'generate-text' && workflow.textPrompt) {
     return [
       `Create an image from this user brief: ${workflow.textPrompt.trim()}.`,
       TEXT_TO_IMAGE_FRAMEWORK,
       'If reference images are attached, use them only for the relationship implied by the brief (subject identity, product/object appearance, material, mood, or style) and do not copy unrelated reference composition.',
       'Final output should be a coherent complete image, not a contact sheet, collage, prompt text, or UI mockup unless explicitly requested.'
     ].join(' ');
  }

  if (state.mode === 'visual-edit') {
    return generateVisualEditPrompt(state);
  }

  if (state.mode === 'render-sketch') {
    return generateSketchPrompt(state);
  }
  if (state.mode === 'img-to-cad') {
    return generateImageToCadPrompt(state);
  }
  if (state.mode === 'upscale') {
    return generateUpscalePrompt(state);
  }
  if (state.mode === 'multi-angle') {
    return generateMultiAnglePrompt(state);
  }

  if (state.mode === 'angle-change') {
    return generateAngleChangePrompt(state);
  }

  if (state.mode === 'headshot') {
    return generateHeadshotPrompt(state);
  }

  // Use specialized prompt generator for 3D Render mode
  if (state.mode === 'render-3d') {
    return generate3DRenderPrompt(state);
  }
  if (state.mode === 'scene-compose') {
    return generateSceneComposePrompt(state);
  }
  if (state.mode === 'render-cad') {
    return generateCadRenderPrompt(state);
  }
  if (state.mode === 'masterplan') {
    return generateMasterplanPrompt(state);
  }
  if (state.mode === 'exploded') {
    return generateExplodedPrompt(state);
  }
  if (state.mode === 'section') {
    return generateSectionPrompt(state);
  }
  if (state.mode === 'video') {
    return generateVideoPrompt(state);
  }

  const availableStyles = [...BUILT_IN_STYLES, ...(state.customStyles ?? [])];
  const style = availableStyles.find(s => s.id === activeStyleId);
  const isNoStyle = style?.id === 'no-style';

  let promptParts: string[] = [];

  // 1. Base Prompt / Subject
  if (state.prompt) {
    promptParts.push(`Create an architectural visualization from this user brief: ${state.prompt}.`);
  } else if (style && !isNoStyle) {
    promptParts.push(`Create a ${style.name.toLowerCase()} architectural visualization of this design`);
  } else {
    promptParts.push('Create an architectural visualization of this design');
  }
  promptParts.push(TEXT_TO_IMAGE_FRAMEWORK);

  // 2. Style Specifics - Enhanced descriptions
  if (!isNoStyle && style?.description) {
    const styleDescription = style.description.trim();
    promptParts.push(styleDescription.endsWith('.') ? styleDescription : `${styleDescription}.`);
  }
  if (!isNoStyle && style?.promptBundle) {
    const architectureVocabulary = style.promptBundle.architectureVocabulary || [];
    const materialBias = style.promptBundle.materialBias || {};
    if (architectureVocabulary.length > 0) {
      promptParts.push(`The architecture should express ${architectureVocabulary.slice(0, 3).join(', ')}.`);
    }
    const primaryMaterials = materialBias.primary || [];
    const secondaryMaterials = materialBias.secondary || [];
    if (primaryMaterials.length > 0 || secondaryMaterials.length > 0) {
      const primaryText = primaryMaterials.length > 0 ? primaryMaterials.join(', ') : 'balanced materials';
      const secondaryText = secondaryMaterials.slice(0, 2).join(', ');
      const materialsText = secondaryText ? `${primaryText} complemented by ${secondaryText}` : primaryText;
      promptParts.push(`The material palette features ${materialsText}.`);
    }
  }

  // 3. Lighting - Natural language descriptions
  const timeDescriptions: Record<string, string> = {
    'dawn': 'Illuminate the scene with soft, ethereal dawn light as the sun begins to rise',
    'morning': 'Bathe the building in fresh, clear morning light',
    'noon': 'Light the scene with bright midday sun',
    'afternoon': 'Warm the scene with golden afternoon light',
    'golden-hour': 'Capture the magic of golden hour with rich, warm illumination',
    'sunset': 'Paint the scene with dramatic sunset colors',
    'dusk': 'Show the building in the fading light of dusk',
    'night': 'Illuminate the building at night, showcasing its artificial lighting',
  };

  const weatherDescriptions: Record<string, string> = {
    'clear': 'under a pristine clear sky',
    'partly-cloudy': 'with scattered clouds adding interest to the sky',
    'overcast': 'under soft, even overcast conditions',
    'cloudy': 'beneath dramatic cloud formations',
    'stormy': 'with moody storm clouds gathering',
    'foggy': 'with atmospheric fog adding mystery',
  };

  const timeDesc = timeDescriptions[lighting.timeOfDay] || `during ${lighting.timeOfDay}`;
  const weatherDesc = weatherDescriptions[lighting.weather] || lighting.weather;
  promptParts.push(`${timeDesc} ${weatherDesc}.`);

  // 4. Context - Vivid environmental description
  if (context.vegetation) {
    const densityDesc = context.vegetationDensity > 70 ? 'lush, abundant' :
      context.vegetationDensity > 40 ? 'thoughtfully landscaped' : 'minimal, carefully placed';
    const seasonDescriptions: Record<string, string> = {
      'spring': 'fresh spring greenery with new growth',
      'summer': 'full summer foliage in vibrant greens',
      'autumn': 'warm autumn colors with changing leaves',
      'winter': 'stark winter landscape',
    };
    const seasonDesc = seasonDescriptions[context.season] || `${context.season} vegetation`;
    promptParts.push(`Surround the building with ${densityDesc} ${seasonDesc}.`);
  }

  if (context.people) {
    promptParts.push('Include people to provide human scale and bring life to the scene.');
  }

  // 5. Camera/Technical - Natural descriptions
  const viewTypeDescriptions: Record<string, string> = {
    'eye-level': 'Capture from a natural eye-level perspective that a visitor would experience',
    'elevated': 'View from an elevated vantage point that reveals the building\'s form',
    'aerial': 'Present an aerial view showing the building in its context',
    'worms-eye': 'Look up dramatically from below, emphasizing the building\'s presence',
    'interior': 'Reveal the interior spaces and their spatial qualities',
  };

  const projectionDescriptions: Record<string, string> = {
    'perspective': 'with natural perspective',
    'orthographic': 'in measured orthographic projection',
    'isometric': 'in clean isometric view',
  };

  const viewDesc = viewTypeDescriptions[camera.viewType] || `Show a ${camera.viewType} view`;
  const projDesc = projectionDescriptions[camera.projection] || camera.projection;
  promptParts.push(`${viewDesc} ${projDesc}.`);

  // Material emphasis
  if (materials.concreteEmphasis > 70) {
    promptParts.push('Pay special attention to rendering the concrete with rich texture and subtle color variations.');
  }

  // Quality closing
  promptParts.push('Render with exceptional photorealistic quality - believable materials, accurate lighting, and the level of detail expected in professional architectural photography.');

  return promptParts.join(' ');
}

function generateHeadshotPrompt(state: AppState): string {
  const hs = state.workflow.headshot;
  const parts: string[] = [];

  const isColor = hs.colorMode === 'color';
  const colorDesc = isColor
    ? 'Full natural color photography with accurate skin tones and lifelike detail.'
    : 'Black and white photography with rich tonal contrast, deep shadows, and luminous highlights.';

  // Tone → attire + expression
  const toneMap: Record<string, { attire: string; expression: string }> = {
    'formal':       { attire: 'formal business attire — suit, tie or formal blouse', expression: 'composed, confident, and serious' },
    'smart-casual': { attire: 'smart casual attire — collared shirt, blazer, or polished business-casual outfit', expression: 'warm, approachable, and professionally friendly' },
    'casual':       { attire: 'everyday casual clothing — relaxed and natural', expression: 'genuinely friendly and approachable, with a natural easy smile' },
    'creative':     { attire: 'expressive, individualistic attire that reflects their creative personality', expression: 'confident, distinctive, and full of personality' },
  };
  const tone = toneMap[hs.tone] ?? toneMap['smart-casual'];

  // Purpose → framing + contextual note
  const purposeMap: Record<string, string> = {
    'linkedin':     'The photo is for a LinkedIn profile or professional bio — polished, career-oriented, and business-ready.',
    'student-card': 'The photo is for a student ID card — clear face visibility, simple background, relaxed and youthful feel.',
    'team-page':    'The photo is for a company team page — personable, professional, and inviting.',
    'social-media': 'The photo is for a social media profile — vibrant, engaging, and reflective of personality.',
    'id-document':  'The photo is for an official ID document — strict frontal framing, neutral expression, plain uncluttered background.',
    'portfolio':    'The photo is for a personal portfolio or creative website — memorable, brand-aligned, and distinctively styled.',
  };
  const purposeNote = purposeMap[hs.purpose] ?? purposeMap['linkedin'];

  if (hs.style === 'professional') {
    const bgMap: Record<string, string> = {
      'studio-white':   'clean white studio backdrop',
      'studio-grey':    'neutral mid-grey studio backdrop',
      'studio-dark':    'deep charcoal studio backdrop',
      'blurred-office': 'subtly blurred corporate office environment with soft depth-of-field',
      'gradient':       'smooth soft-gradient background blending warm and cool tones',
    };
    const bg = bgMap[hs.background] || 'neutral studio backdrop';

    parts.push('Generate a portrait headshot photograph.');
    parts.push('Reference relationship: use the provided reference photographs as the authoritative identity references. Preserve the person\'s facial structure, skin tone, hairline, hairstyle, facial hair, distinctive features, age impression, and natural expression identity while changing only wardrobe, lighting, background, crop, and polish requested below.');
    parts.push(`The subject is dressed in ${tone.attire}. Their expression is ${tone.expression}.`);
    parts.push('The subject is photographed straight-on, facing the camera directly.');
    parts.push(`Background: ${bg}.`);
    parts.push('Lighting: professional studio lighting with soft key light, subtle fill light, and gentle rim light for depth.');
    parts.push('Framing: head and shoulders, centered composition, slightly above eye-level camera angle.');
    parts.push('Skin should appear natural and professionally retouched — no heavy filters.');
    parts.push(purposeNote);
    parts.push(colorDesc);
    if (hs.quality === 'high') {
      parts.push('Ultra-high resolution, fine skin texture, tack-sharp focus, broadcast-quality photography.');
    }
    parts.push('Do not change identity, face shape, eye spacing, nose shape, mouth shape, hair color, or hairstyle. Retouch conservatively: preserve real skin texture and avoid waxy skin, face swapping, plastic smoothing, or invented accessories.');
  } else {
    // website-custom — derive activity from role
    const role = hs.role?.trim() || '';
    const activity = role
      ? `engaged in their role as ${role} — deeply focused and immersed in their specific work`
      : 'studying architectural drawings and blueprints spread across a desk';

    const facingDir = hs.facing === 'left' ? 'facing left, profile oriented to the left side of the frame' : 'facing right, profile oriented to the right side of the frame';

    parts.push('Generate a cinematic, editorial team portrait photograph in a wide rectangular landscape format (approximately 16:9 aspect ratio or wider).');
    parts.push('Reference relationship: use the provided reference photographs as the authoritative identity references. Preserve the person\'s facial structure, skin tone, hairline, hairstyle, facial hair, distinctive features, and age impression while changing only pose, work context, lighting, background, crop, and editorial styling.');
    parts.push(`The subject is dressed in ${tone.attire} with an ${tone.expression} demeanor.`);
    parts.push(`The subject is photographed from the side — a close-up side profile, ${facingDir}, from roughly chest or shoulder height upward.`);
    parts.push(`The person appears completely absorbed and immersed in their work: ${activity}.`);
    parts.push('The composition is tight and close-up, showing the face in profile with the subject\'s gaze directed at their work, not the camera.');
    parts.push('The background should be softly blurred (shallow depth of field), suggesting a professional workspace.');
    parts.push('Lighting: dramatic cinematic side-lighting or window light that sculpts the face and creates depth.');
    parts.push(purposeNote);
    parts.push(colorDesc);
    if (hs.quality === 'high') {
      parts.push('Ultra-high resolution, cinematic grain texture, shallow depth of field, magazine-quality photography.');
    }
    parts.push('Keep the profile direction, face proportions, hair color, and recognizable identity consistent with the references. Avoid face swapping, invented glasses/jewelry, distorted hands, text overlays, or signage unless explicitly requested.');
  }

  return parts.join(' ');
}
