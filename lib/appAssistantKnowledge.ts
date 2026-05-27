import type { AppState, GenerationMode } from '../types';

export interface AppAssistantFeatureGuide {
  mode: GenerationMode;
  title: string;
  summary: string;
  bestFor: string[];
  steps: string[];
  controls: string[];
  specificGuidance?: string[];
  watchOut: string[];
  suggestions: string[];
}

export interface AppAssistantPromptMessage {
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
}

export const APP_ASSISTANT_GLOBAL_RULES = [
  'The assistant is embedded inside ArchViz AI Studio and must answer as an in-app guide, not as marketing copy.',
  'The current app has 17 active features. Image-to-3D, mesh reconstruction, and 3D model export are not active features.',
  'If a user asks for a removed workflow, explain that it is unavailable and redirect to the closest active feature.',
  'Answer only from the provided app context. If the context does not contain a requested control or feature, say the current app context does not specify it and offer the closest listed control.',
  'When the user asks from an active feature, explain the controls in that feature before mentioning other features.',
  'For comparison questions, name each relevant in-app control and explain when to use it.',
  'Do not give generic rendering or AI theory unless it is tied directly to a named ArchViz AI Studio control or workflow.',
  'Prefer exact UI locations: top bar, left panel, canvas, right panel, history, mobile workflow dock, or the dedicated full-page workflow.',
  'Ask a clarifying question only when the missing input changes the recommended feature or next action.',
];

export const APP_ASSISTANT_FEATURES: Record<GenerationMode, AppAssistantFeatureGuide> = {
  'generate-text': {
    mode: 'generate-text',
    title: 'Generate from Text',
    summary: 'Create an architectural image from a written prompt only.',
    bestFor: ['early concepts', 'style exploration', 'starting without a source image'],
    steps: [
      'Use the prompt composer on the canvas.',
      'Describe building type, location, style, materials, camera, lighting, weather, and mood.',
      'Generate variations, then use Visual Edit, Scene Compose, Upscale, or Video Studio for the next step.',
    ],
    controls: ['prompt', 'style language', 'camera language', 'lighting and atmosphere language'],
    specificGuidance: [
      'Generate from Text does not require an uploaded source image; the written prompt is the source.',
      'Good answers should help the user specify building type, site/context, style, materials, camera, lighting, weather, and mood.',
      'If the user needs to alter an existing image, redirect to Visual Edit, Scene Compose, or 3D Rendering instead of treating this as text generation.',
    ],
    watchOut: ['Vague prompts produce generic buildings.', 'Text generation is for ideation, not measured documentation.'],
    suggestions: ['Help me write a strong prompt', 'What should I include in my prompt?', 'How do I refine this after generation?'],
  },
  'render-3d': {
    mode: 'render-3d',
    title: '3D Rendering',
    summary: 'Turn a 3D model screenshot into a polished architectural render.',
    bestFor: ['Rhino/Revit/SketchUp/Blender screenshots', 'clay renders', 'viewport screenshots'],
    steps: [
      'Upload the model screenshot to the canvas.',
      'Set source type and view type in the left panel.',
      'Choose a style preset or upload a style reference, then optionally add a background reference.',
      'Use the right panel for generation mode, lighting, atmosphere, scenery, aspect ratio, and resolution.',
    ],
    controls: ['source type', 'view type', 'style reference', 'background reference', 'AI problem analysis', 'Strict Realism/Enhance/Concept Push', 'lighting', 'atmosphere', 'scenery', 'resolution'],
    specificGuidance: [
      'A style preset is a built-in style selected in the left panel Presets tab. It applies a known visual style bundle without requiring an uploaded reference image.',
      'A style reference image is uploaded in the left panel Image tab. It is for visual language only: rendering medium, color grading, contrast curve, material finish, lighting character, atmosphere, camera polish, grain, and mood.',
      'A style reference image must not be treated as content to copy. Do not tell users it copies geometry, subject, composition, background, furniture, people, signage, logos, or scene layout.',
      'A background reference is a separate left-panel control for the surrounding environment/background context. It is not the same as a style reference.',
      'The three right-panel generation modes are Strict Realism, Enhance, and Concept Push. If the user calls them three styles, clarify that they are generation modes, not style presets.',
      'Strict Realism is for preserving source geometry, camera, composition, walls, openings, and spatial relationships as closely as possible while turning the model screenshot into a realistic render.',
      'Enhance is the default middle option for a source that already reads well; it improves lighting, atmosphere, color grading, clarity, material polish, and presentation without redesigning the project.',
      'Concept Push is for looser exploration; it keeps the source recognizable but allows bolder interpretation of forms, materials, lighting, atmosphere, and entourage.',
    ],
    watchOut: ['Use Strict Realism when geometry must stay close.', 'Clean clay renders usually preserve geometry better than noisy viewport screenshots.'],
    suggestions: ['Walk me through 3D Rendering', 'Which generation mode should I use?', 'How do I preserve geometry?'],
  },
  'scene-compose': {
    mode: 'scene-compose',
    title: 'Scene Compose',
    summary: 'Insert referenced objects into a locked base scene.',
    bestFor: ['furniture placement', 'fixtures', 'vehicles', 'artwork', 'planting', 'product placement'],
    steps: [
      'Upload the base scene first.',
      'Add reference images in the right panel.',
      'Caption each reference and place pins on the canvas when exact placement matters.',
      'Generate with strict base-scene preservation.',
    ],
    controls: ['reference stack', 'reference captions', 'placement pins', 'base scene preservation'],
    specificGuidance: [
      'Scene Compose starts from a locked base scene and adds referenced objects into it.',
      'Reference captions explain what each uploaded object is and how it should appear.',
      'Placement pins are instruction markers for where referenced objects should go; they are not rendered into the final image.',
      'If the user wants to replace or erase existing pixels instead of adding referenced objects, redirect to Visual Edit.',
    ],
    watchOut: ['Pins are instructions and will not appear in the final render.', 'Use Visual Edit when replacing or removing existing pixels.'],
    suggestions: ['How do placement pins work?', 'What should I write in captions?', 'When should I use Visual Edit instead?'],
  },
  'render-cad': {
    mode: 'render-cad',
    title: 'CAD to Render',
    summary: 'Convert flat CAD exports into architectural visualization.',
    bestFor: ['floor plans', 'elevations', 'sections', 'site plans', 'axonometric drawings'],
    steps: [
      'Upload a clean high-contrast PNG or JPG export.',
      'Set drawing type, scale, orientation, output view, and room or project type.',
      'Use AI layer detection when the drawing has readable walls, openings, and circulation.',
      'Tune camera, furnishing, people, context, lighting, atmosphere, style, and output resolution in the right panel.',
    ],
    controls: ['drawing type', 'scale', 'orientation', 'layer detection', 'room type', 'camera', 'furnishing', 'context', 'style reference'],
    specificGuidance: [
      'CAD to Render uses flat CAD exports as visual guidance for a render; it does not create measured CAD geometry.',
      'Layer detection helps identify readable walls, openings, stairs, dimensions, text, and circulation from the uploaded drawing.',
      'Drawing type should match the input: plan, section, elevation, or site.',
      'If the user wants line extraction or DXF/DWG/SVG/PDF output, redirect to Image to CAD.',
    ],
    watchOut: ['CAD to Render creates visualization, not measured vector CAD.', 'Use Image to CAD for linework extraction.'],
    suggestions: ['How do I prepare a CAD export?', 'Which drawing type should I pick?', 'How do I make a plan become an interior view?'],
  },
  masterplan: {
    mode: 'masterplan',
    title: 'Masterplan',
    summary: 'Render aerial site strategies from maps, satellite images, or diagrams.',
    bestFor: ['urban plans', 'site strategies', 'zoning diagrams', 'campus or resort concepts'],
    steps: [
      'Upload a top-down site image or use the canvas source.',
      'Set plan type, scale, and north rotation.',
      'Draw a boundary, use the full image, or work with detected/manual zones.',
      'Tune output style, view angle, buildings, landscape, annotations, and legend in the right panel.',
    ],
    controls: ['boundary mode', 'zone detection', 'location context', 'view angle', 'building heights', 'landscape density', 'annotations', 'legend'],
    specificGuidance: [
      'Masterplan is for aerial site strategy and diagrammatic urban visualization, not legal planning verification.',
      'Boundary mode controls whether the tool uses the full image, a drawn boundary, or detected/manual zones.',
      'Zones are for program or land-use areas; annotations and legend make the output presentation-ready.',
    ],
    watchOut: ['Treat output as concept visualization.', 'Verify planning metrics, boundaries, and legal constraints outside the render.'],
    suggestions: ['How do I draw a site boundary?', 'Should I use zones or full image?', 'How do I make it diagrammatic?'],
  },
  'visual-edit': {
    mode: 'visual-edit',
    title: 'Visual Edit',
    summary: 'Change only a selected region of an existing image.',
    bestFor: ['material swaps', 'object removal', 'sky changes', 'people edits', 'lighting fixes', 'outpainting'],
    steps: [
      'Upload or select the image to edit.',
      'Create a selection with rectangle, brush, lasso, AI selection, erase, or adjust tools.',
      'Choose the active edit tool and write a direct instruction.',
      'Upload material or object references when matching something real matters.',
    ],
    controls: ['active tool', 'selection mode', 'mask feather/strength', 'material reference image', 'lighting', 'people density', 'background reference', 'outpaint direction'],
    specificGuidance: [
      'Visual Edit changes selected pixels in an existing image. The mask or selection is the main safety control.',
      'Use rectangle, brush, lasso, AI selection, erase, or adjust tools to define the editable region.',
      'Material references are for matching material appearance in the selected area.',
      'If the user wants to add many separately referenced objects with placement control, redirect to Scene Compose.',
    ],
    watchOut: ['Tight masks produce cleaner edits.', 'Use Scene Compose for many new referenced objects.'],
    suggestions: ['How do I mask this area?', 'How do I swap material from a reference?', 'Why did unselected pixels change?'],
  },
  exploded: {
    mode: 'exploded',
    title: 'Exploded View',
    summary: 'Create explanatory exploded architectural diagrams.',
    bestFor: ['axonometric views', 'isometric model screenshots', 'system diagrams', 'presentation boards'],
    steps: [
      'Upload an uncluttered three-quarter or axonometric source.',
      'Choose component detection, explosion direction, view type, and separation.',
      'Tune render style, labels, leaders, dimensions, background, and output resolution.',
    ],
    controls: ['component detection', 'vertical/radial/custom direction', 'separation', 'diagram style', 'annotations', 'background'],
    specificGuidance: [
      'Exploded View is a presentation diagram workflow, not a BIM model exporter.',
      'Component detection decides what layers or systems the app should separate.',
      'Separation controls how far apart the inferred layers move; annotations and leaders explain the diagram.',
    ],
    watchOut: ['Straight-on elevations are weaker for exploded diagrams.', 'Keep inputs clean so layers are easier to infer.'],
    suggestions: ['How should I set explosion distance?', 'What source image works best?', 'How do I label the layers?'],
  },
  section: {
    mode: 'section',
    title: 'Section Render',
    summary: 'Turn section drawings into spatial presentation sections.',
    bestFor: ['vertical cuts', 'section perspectives', 'narrative sections', 'presentation boards'],
    steps: [
      'Upload a clean section drawing.',
      'Set cut type, poche, hatch, line weight, and show-beyond depth.',
      'Tune reveal style, program colors, labels, materials, lighting, people, and vegetation.',
    ],
    controls: ['section cut', 'poche', 'hatch', 'show beyond', 'reveal style', 'program colors', 'labels'],
    specificGuidance: [
      'Section Render turns a section drawing into a spatial presentation section.',
      'Poche and hatch affect the cut material graphic; show-beyond controls how much depth appears past the cut line.',
      'Program colors and labels are for presentation clarity, not code-compliant documentation.',
    ],
    watchOut: ['This is for presentation, not construction documentation.', 'Use CAD to Render for plans or elevations.'],
    suggestions: ['How do I prepare a section?', 'What is show-beyond depth?', 'How do I color program areas?'],
  },
  'render-sketch': {
    mode: 'render-sketch',
    title: 'Sketch to Render',
    summary: 'Transform rough sketches into polished architectural images.',
    bestFor: ['hand sketches', 'digital sketches', 'massing drawings', 'early concepts'],
    steps: [
      'Upload a sketch with clear main edges.',
      'Set sketch type, perspective, cleanup, and line processing.',
      'Choose faithful or creative interpretation, then add style/material/mood references if needed.',
    ],
    controls: ['sketch type', 'auto detect', 'cleanup intensity', 'perspective correction', 'interpretation strength', 'reference influence'],
    specificGuidance: [
      'Sketch to Render uses a sketch as the source, so answers should focus on line clarity, perspective, cleanup, and interpretation strength.',
      'Faithful interpretation keeps the sketch closer; creative interpretation lets the app elaborate missing architectural detail.',
      'References can guide style, material, or mood but should not replace the sketch as the main composition.',
    ],
    watchOut: ['Dark lines on a clean background work best.', 'Add prompt details for materials or program that are not visible.'],
    suggestions: ['Should I use faithful or creative?', 'How do I clean up a sketch?', 'What references should I add?'],
  },
  'multi-angle': {
    mode: 'multi-angle',
    title: 'Multi-Angle',
    summary: 'Generate a consistent set of views from one source image.',
    bestFor: ['front/side/rear sets', 'turntables', 'aerial alternates', 'presentation packages'],
    steps: [
      'Upload the strongest source view.',
      'Choose turntable, architectural, bird-eye, or custom preset.',
      'Set view count, azimuth and elevation ranges, consistency lock, style, and output resolution.',
    ],
    controls: ['preset', 'view count', 'azimuth range', 'elevation range', 'consistency lock', 'custom angles'],
    specificGuidance: [
      'Multi-Angle generates a set of related views from one source image.',
      'Consistency lock is the key control when materials, massing, and style must stay aligned across views.',
      'Preset controls the type of view set, while view count and angle ranges control how many outputs and how far the camera moves.',
    ],
    watchOut: ['Visible corners improve consistency.', 'Use Visual Edit for isolated issues in one generated angle.'],
    suggestions: ['Which angle preset should I use?', 'How many views should I generate?', 'How do I keep materials consistent?'],
  },
  upscale: {
    mode: 'upscale',
    title: 'Upscale',
    summary: 'Increase resolution and sharpen final images.',
    bestFor: ['presentation exports', 'client delivery', 'better video source stills'],
    steps: [
      'Upload or select approved images.',
      'Choose 2x, 4x, or 8x.',
      'Tune sharpness, clarity, edge recovery, fine detail, output format, and batch queue.',
    ],
    controls: ['upscale factor', 'sharpness', 'clarity', 'edge definition', 'fine detail', 'format', 'batch queue'],
    specificGuidance: [
      'Upscale improves resolution and detail after the composition is approved.',
      '2x is safer for modest cleanup, 4x is typical for delivery, and 8x is for large output when artifacts are acceptable to manage.',
      'Sharpness, clarity, edge definition, and fine detail should be conservative when the user needs the image to stay natural.',
    ],
    watchOut: ['Do major composition edits before upscaling.', 'Use conservative settings when exact appearance matters.'],
    suggestions: ['Should I use 2x, 4x, or 8x?', 'How do I avoid over-sharpening?', 'Should I upscale before video?'],
  },
  'img-to-cad': {
    mode: 'img-to-cad',
    title: 'Image to CAD',
    summary: 'Extract CAD-like 2D linework from images.',
    bestFor: ['facade linework', 'plan/elevation extraction', 'drawing overlays', 'diagram references'],
    steps: [
      'Upload a clear photo, render, plan image, or facade image.',
      'Choose photo or render input type and elevation, plan, or detail output.',
      'Run Generate CAD Guidance when the source is complex.',
      'Tune line sensitivity, simplify, connect gaps, layer toggles, and export format.',
    ],
    controls: ['input type', 'output intent', 'CAD guidance', 'line sensitivity', 'simplify', 'connect gaps', 'layers', 'DXF/DWG/SVG/PDF format'],
    specificGuidance: [
      'Image to CAD extracts 2D CAD-like linework from an image; it does not generate a 3D mesh or model.',
      'Line sensitivity controls how much line detail is detected, simplify reduces noise, and connect gaps helps broken lines become continuous.',
      'Use DXF/DWG for CAD handoff, SVG/PDF for presentation or overlay workflows.',
    ],
    watchOut: ['This does not generate a 3D model.', 'Verify extracted geometry before technical use.'],
    suggestions: ['How do I get cleaner linework?', 'Which export format should I use?', 'Can this make a 3D model?'],
  },
  video: {
    mode: 'video',
    title: 'Video Studio',
    summary: 'Create short MP4 clips from still images.',
    bestFor: ['animated stills', 'start/end interpolation', 'presentation clips', 'website motion'],
    steps: [
      'Choose Animate Image for one image or Interpolate Frames for start and end frames.',
      'Upload the required image inputs.',
      'Describe camera or subject motion.',
      'Set duration, aspect ratio, resolution, generated audio, people behavior, and seed lock.',
    ],
    controls: ['input mode', 'Veo 3.1 Preview', 'duration', '16:9 or 9:16', '720p/1080p/4K', 'audio', 'people in scene', 'seed lock'],
    specificGuidance: [
      'Video Studio creates short MP4 clips from still images.',
      'Animate Image uses one still; Interpolate Frames uses a start frame and an end frame.',
      '4K requires or sets an 8 second duration, so do not promise arbitrary 4K durations.',
      'Seed lock is for repeatability when iterating the same motion direction.',
    ],
    watchOut: ['4K requires or sets an 8 second duration.', 'Video quality depends heavily on the source still.'],
    suggestions: ['Should I use Animate Image or Interpolate Frames?', 'How should I write motion direction?', 'Why does 4K use 8 seconds?'],
  },
  'material-validation': {
    mode: 'material-validation',
    title: 'Material Validation',
    summary: 'Review material schedules and specs against project requirements.',
    bestFor: ['material schedules', 'technical specs', 'BoQ checks', 'drawing consistency review'],
    steps: [
      'Upload PDFs, DOCX, XLSX, drawings, BoQ files, or pasted schedule content.',
      'Add project requirements and reference links if relevant.',
      'Select checks and run validation.',
      'Review compliant items, warnings, errors, severity, alternatives, and next actions.',
    ],
    controls: ['documents', 'materials', 'drawings', 'BoQ', 'checks', 'issues', 'reports'],
    specificGuidance: [
      'Material Validation reviews uploaded project documents, material schedules, specs, BoQ files, and drawings against provided requirements.',
      'Answers should frame results as review assistance, not certification or professional sign-off.',
      'Good guidance should explain compliant items, warnings, errors, severity, alternatives, and next actions.',
    ],
    watchOut: ['Use this as a review aid, not professional certification.', 'Provide actual project criteria for useful results.'],
    suggestions: ['What documents should I upload?', 'How should I interpret warnings?', 'Can it check BoQ consistency?'],
  },
  'document-translate': {
    mode: 'document-translate',
    title: 'Document Translate',
    summary: 'Translate DOCX, XLSX, PPTX, and PDF files while preserving layout where possible.',
    bestFor: ['technical documents', 'spreadsheets', 'presentations', 'PDF-to-DOCX translation'],
    steps: [
      'Open the dedicated Document Translate workflow.',
      'Upload DOCX, XLSX, PPTX, or PDF.',
      'Choose source language or Auto, target language, Fast or Pro quality, and preservation options.',
      'Run translation, inspect warnings, then download the rebuilt file.',
    ],
    controls: ['source language', 'target language', 'Fast/Pro quality', 'preserve formatting', 'headers/footers', 'footnotes'],
    specificGuidance: [
      'Document Translate is a dedicated full-page workflow, not a canvas image mode.',
      'It accepts DOCX, XLSX, PPTX, and PDF, with PDFs converted to DOCX output.',
      'Fast is for speed; Pro is for higher quality on technical or layout-sensitive documents.',
    ],
    watchOut: ['PDF translation converts to Word first and outputs DOCX.', 'Complex PDFs may need cleanup after conversion.'],
    suggestions: ['Which quality mode should I use?', 'What happens to PPTX animations?', 'Why does PDF output as DOCX?'],
  },
  'pdf-compression': {
    mode: 'pdf-compression',
    title: 'PDF Compression',
    summary: 'Compress architectural PDFs for delivery.',
    bestFor: ['drawing sets', 'reports', 'submission portals', 'email-size limits'],
    steps: [
      'Open the dedicated PDF Compression workflow.',
      'Upload up to 20 PDFs into the queue.',
      'Choose light, balanced, or aggressive compression.',
      'Preview and download selected files or all compressed outputs.',
    ],
    controls: ['PDF queue', 'selected PDF', 'compression level', 'preview', 'download selected/all'],
    specificGuidance: [
      'PDF Compression is a dedicated full-page workflow for reducing PDF file size.',
      'It supports a queue of up to 20 PDFs and lets users download selected files or all compressed outputs.',
      'Light preserves more quality, balanced is the default recommendation, and aggressive is for strict size limits.',
    ],
    watchOut: ['Balanced is best for most drawing sets.', 'Use aggressive only when the file-size limit matters more than visual fidelity.'],
    suggestions: ['Which compression level should I choose?', 'Can I batch compress PDFs?', 'How do I keep small text readable?'],
  },
  headshot: {
    mode: 'headshot',
    title: 'Headshot Studio',
    summary: 'Create professional headshots from user-provided portraits.',
    bestFor: ['team pages', 'CVs', 'LinkedIn', 'student cards', 'ID-style images', 'portfolio profiles'],
    steps: [
      'Upload clear portrait references, ideally including a front-facing photo.',
      'Choose professional or website-custom style.',
      'Set tone, purpose, color mode, background, quality, and website role/facing direction when needed.',
      'Generate variations and choose the most natural result.',
    ],
    controls: ['left/front/right references', 'style', 'tone', 'purpose', 'color mode', 'background', 'role', 'facing', 'quality'],
    specificGuidance: [
      'Headshot Studio creates professional headshot variations from user-provided portrait references.',
      'Reference slots are left, front, and right; a clear front-facing photo is the most important input.',
      'Answers must not identify people or infer sensitive traits. Focus on photo quality, style, tone, purpose, background, facing, and consistency.',
    ],
    watchOut: ['Do not use this to identify people.', 'Avoid inferring sensitive traits from portraits.'],
    suggestions: ['What reference photos should I upload?', 'Which headshot purpose should I choose?', 'How do I make team headshots consistent?'],
  },
};

export function getAppAssistantFeature(mode: GenerationMode): AppAssistantFeatureGuide {
  return APP_ASSISTANT_FEATURES[mode];
}

export function getAppAssistantModeList(): string {
  return Object.values(APP_ASSISTANT_FEATURES)
    .map((feature) => `${feature.title} (${feature.mode})`)
    .join(', ');
}

export function buildAppAssistantFeatureManual(mode: GenerationMode): string {
  const feature = getAppAssistantFeature(mode);
  const sections = [
    `Feature: ${feature.title} (${feature.mode})`,
    `Summary: ${feature.summary}`,
    `Best for: ${feature.bestFor.join('; ')}`,
    `Primary steps: ${feature.steps.join(' | ')}`,
    `Important controls: ${feature.controls.join('; ')}`,
  ];

  if (feature.specificGuidance?.length) {
    sections.push(`Feature-specific answer rules: ${feature.specificGuidance.join(' | ')}`);
  }

  sections.push(
    `Watch-outs: ${feature.watchOut.join('; ')}`,
    `Current suggested questions: ${feature.suggestions.join('; ')}`
  );

  return sections.join('\n');
}

export function buildAppAssistantPrompt({
  mode,
  question,
  language,
  messages,
  workspaceSnapshot,
}: {
  mode: GenerationMode;
  question: string;
  language: string;
  messages: AppAssistantPromptMessage[];
  workspaceSnapshot: string;
}): string {
  const recent = messages
    .slice(-8)
    .filter((message) => !message.isLoading)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n') || 'No previous chat in this feature.';

  return [
    'You are the embedded ArchViz AI Studio assistant inside the actual app.',
    `Answer in this app language when possible: ${language}.`,
    'Use the active feature context first. The user opened the assistant from the current feature, so assume they need help with that feature unless they ask otherwise.',
    'Be precise and practical. Prefer 3-6 concise bullets, exact UI locations, and concrete settings. Complete every sentence; never stop mid-list or mid-thought.',
    'Never invent buttons, models, file types, export formats, or controls that are not in the provided context.',
    'If the active feature guide contains direct guidance for the question, answer from that guidance first.',
    APP_ASSISTANT_GLOBAL_RULES.map((rule) => `- ${rule}`).join('\n'),
    '',
    `All active features: ${getAppAssistantModeList()}`,
    '',
    'ACTIVE FEATURE GUIDE:',
    buildAppAssistantFeatureManual(mode),
    '',
    'CURRENT WORKSPACE STATE:',
    workspaceSnapshot,
    '',
    'RECENT CHAT IN THIS FEATURE:',
    recent,
    '',
    `USER QUESTION: ${question}`,
  ].join('\n');
}

export function buildAppAssistantWorkspaceSnapshot(state: AppState): string {
  const wf = state.workflow;
  const lines = [
    `Active mode: ${state.mode}`,
    `Canvas image uploaded: ${state.uploadedImage ? 'yes' : 'no'}`,
    `Prompt field: ${state.prompt.trim() ? state.prompt.trim().slice(0, 500) : 'empty'}`,
    `Generation status: ${state.isGenerating ? `running at ${Math.round(state.progress)}%` : 'idle'}`,
    `History items: ${state.history.length}`,
  ];

  switch (state.mode) {
    case 'generate-text':
      lines.push(`Text prompt: ${wf.textPrompt.trim() ? wf.textPrompt.trim().slice(0, 500) : 'empty'}`);
      break;
    case 'render-3d':
      lines.push(
        `Source type: ${wf.sourceType}`,
        `View type: ${wf.viewType}`,
        `Generation mode: ${wf.renderMode}`,
        `Style reference enabled: ${wf.styleReferenceEnabled ? 'yes' : 'no'}`,
        `Background reference enabled: ${wf.backgroundReferenceEnabled ? 'yes' : 'no'}`,
        `Detected problem areas: ${wf.detectedElements.length}`,
        `Output: ${wf.render3d.render.resolution}, ${wf.render3d.render.aspectRatio}`
      );
      break;
    case 'scene-compose':
      lines.push(
        `Reference images: ${wf.sceneInsertionReferences.length}`,
        `Placed references: ${wf.sceneInsertionReferences.filter((item) => item.placement).length}`,
        `Active placement: ${wf.sceneComposeActivePlacementId ? 'yes' : 'no'}`
      );
      break;
    case 'render-cad':
      lines.push(
        `Drawing type: ${wf.cadDrawingType}`,
        `Scale: ${wf.cadScale}`,
        `Layer detection: ${wf.cadLayerDetectionEnabled ? 'enabled' : 'disabled'}`,
        `Detected layers: ${wf.cadLayers.length}`,
        `Room type: ${wf.cadSpace.roomType}`,
        `Camera: ${wf.cadCamera.height}m, ${wf.cadCamera.focalLength}mm, look ${wf.cadCamera.lookAt}`,
        `Furnishing: ${wf.cadFurnishing.auto ? 'auto' : 'manual'}, ${wf.cadFurnishing.occupancy}`
      );
      break;
    case 'masterplan':
      lines.push(
        `Plan type: ${wf.mpPlanType}`,
        `Scale: ${wf.mpScale}`,
        `Boundary mode: ${wf.mpBoundary.mode}`,
        `Boundary points: ${wf.mpBoundary.points.length}`,
        `Zones: ${wf.mpZones.length}`,
        `Location: ${wf.mpContext.location || 'not set'}`,
        `Output style: ${wf.mpOutputStyle}`,
        `View angle: ${wf.mpViewAngle}`
      );
      break;
    case 'visual-edit':
      lines.push(
        `Active edit tool: ${wf.activeTool}`,
        `Selection mode: ${wf.visualSelection.mode}`,
        `Selection shapes: ${wf.visualSelections.length}`,
        `Selection mask: ${wf.visualSelectionMask ? 'yes' : 'no'}`,
        `Visual prompt: ${wf.visualPrompt.trim() ? wf.visualPrompt.trim().slice(0, 500) : 'empty'}`,
        `Material reference: ${wf.visualMaterial.referenceEnabled && wf.visualMaterial.referenceImage ? 'yes' : 'no'}`
      );
      break;
    case 'exploded':
      lines.push(
        `Detection: ${wf.explodedDetection}`,
        `Direction: ${wf.explodedDirection}`,
        `View: ${wf.explodedView.type}, ${wf.explodedView.angle}`,
        `Separation: ${wf.explodedView.separation}`,
        `Components: ${wf.explodedComponents.length}`,
        `Labels: ${wf.explodedAnnotations.labels ? 'on' : 'off'}`
      );
      break;
    case 'section':
      lines.push(
        `Cut type: ${wf.sectionCut.type}`,
        `Cut depth: ${wf.sectionCut.depth}`,
        `Poche: ${wf.sectionStyle.poche}`,
        `Show beyond: ${wf.sectionStyle.showBeyond}`,
        `Area detection: ${wf.sectionAreaDetection}`,
        `Areas: ${wf.sectionAreas.length}`
      );
      break;
    case 'render-sketch':
      lines.push(
        `Sketch type: ${wf.sketchType}`,
        `Auto detect: ${wf.sketchAutoDetect ? 'yes' : 'no'}`,
        `Detected perspective: ${wf.sketchDetectedPerspective || 'none'}`,
        `Interpretation: ${wf.sketchInterpretation}`,
        `Cleanup intensity: ${wf.sketchCleanupIntensity}`,
        `References: ${wf.sketchRefs.length}`
      );
      break;
    case 'multi-angle':
      lines.push(
        `Preset: ${wf.multiAnglePreset}`,
        `View count: ${wf.multiAngleViewCount}`,
        `Distribution: ${wf.multiAngleDistribution}`,
        `Consistency lock: ${wf.multiAngleLockConsistency ? 'yes' : 'no'}`,
        `Generated outputs: ${wf.multiAngleOutputs.length}`
      );
      break;
    case 'upscale':
      lines.push(
        `Factor: ${wf.upscaleFactor}`,
        `Sharpness: ${wf.upscaleSharpness}`,
        `Clarity: ${wf.upscaleClarity}`,
        `Edge definition: ${wf.upscaleEdgeDefinition}`,
        `Format: ${wf.upscaleFormat}`,
        `Batch items: ${wf.upscaleBatch.length}`
      );
      break;
    case 'img-to-cad':
      lines.push(
        `Input type: ${wf.imgToCadType}`,
        `Output intent: ${wf.imgToCadOutput}`,
        `Format: ${wf.imgToCadFormat}`,
        `Line sensitivity: ${wf.imgToCadLine.sensitivity}`,
        `Simplify: ${wf.imgToCadLine.simplify}`,
        `Connect gaps: ${wf.imgToCadLine.connect ? 'yes' : 'no'}`,
        `CAD guidance: ${wf.imgToCadPreprocess.guidance ? 'present' : 'empty'}`
      );
      break;
    case 'video':
      lines.push(
        `Input mode: ${wf.videoState.inputMode}`,
        `Model: ${wf.videoState.model}`,
        `Duration: ${wf.videoState.duration}s`,
        `Resolution: ${wf.videoState.resolution}`,
        `Aspect ratio: ${wf.videoState.aspectRatio}`,
        `Audio: ${wf.videoState.generateAudio ? 'on' : 'off'}`,
        `Seed locked: ${wf.videoState.seedLocked ? 'yes' : 'no'}`
      );
      break;
    case 'material-validation':
      lines.push(
        `Documents: ${state.materialValidation.documents.length}`,
        `Materials parsed: ${state.materialValidation.materials.length}`,
        `Issues: ${state.materialValidation.issues.length}`,
        `Running: ${state.materialValidation.isRunning ? 'yes' : 'no'}`,
        `Active tab: ${state.materialValidation.activeTab}`
      );
      break;
    case 'document-translate':
      lines.push(
        `Source document: ${wf.documentTranslate.sourceDocument?.name || 'none'}`,
        `Source language: ${wf.documentTranslate.sourceLanguage}`,
        `Target language: ${wf.documentTranslate.targetLanguage}`,
        `Quality: ${wf.documentTranslate.translationQuality}`,
        `Preserve formatting: ${wf.documentTranslate.preserveFormatting ? 'yes' : 'no'}`,
        `Progress phase: ${wf.documentTranslate.progress.phase}`
      );
      break;
    case 'pdf-compression':
      lines.push(
        `Queue: ${wf.pdfCompression.queue.length}`,
        `Outputs: ${wf.pdfCompression.outputs.length}`,
        `Selected PDF: ${wf.pdfCompression.selectedId ? 'yes' : 'no'}`,
        `Compression level: ${wf.pdfCompression.compressionLevel || 'balanced'}`
      );
      break;
    case 'headshot':
      lines.push(
        `References: left ${wf.headshot.leftImage ? 'yes' : 'no'}, front ${wf.headshot.frontImage ? 'yes' : 'no'}, right ${wf.headshot.rightImage ? 'yes' : 'no'}`,
        `Style: ${wf.headshot.style}`,
        `Tone: ${wf.headshot.tone}`,
        `Purpose: ${wf.headshot.purpose}`,
        `Color mode: ${wf.headshot.colorMode}`,
        `Quality: ${wf.headshot.quality}`,
        `Generated items: ${wf.headshot.generatedItems.length}`
      );
      break;
  }

  return lines.join('\n');
}
