import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import {
  OPENAI_IMAGE_EDIT_LIMITS,
  buildInwardFeatherMatte,
  compositeLocalizedPixels,
  dilateEditableAlpha,
  evaluateEditableTranslationGate,
  estimateProtectedColorOffset,
  estimateProtectedTranslation,
  getEditableAlphaBounds,
  getOpenAIEditCanvasPlan,
  planLocalizedImageEdit,
} from '../lib/localizedImageEdit.js';
import {
  applyGeneratedTranslation,
  runLocalizedImageCompositePipeline,
} from '../lib/localizedImageCompositeWorker.js';
import {
  buildLocalizedVisualEditContract,
} from '../lib/visualEditPolicy.ts';

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const WIDTH = 1024;
const HEIGHT = 768;
const SELECT_X1 = 320;
const SELECT_Y1 = 224;
const SELECT_X2 = 704;
const SELECT_Y2 = 544;
const OPENAI_SELECTION_ALPHA_THRESHOLD = 16;
const LOCALIZED_EDIT_CHANGE_THRESHOLD = 24;
const PRECISE_EDIT_MAX_LONG_EDGE = 3840;
const PRECISE_EDIT_MAX_PIXELS = 8_294_400;
const PRECISE_EDIT_MIN_PIXELS = 655_360;
const PRECISE_EDIT_SIZE_MULTIPLE = 16;

const workerSource = readFileSync(new URL('../cloudflare-worker/worker.js', import.meta.url), 'utf8');
const workerWranglerSource = readFileSync(new URL('../cloudflare-worker/wrangler.toml', import.meta.url), 'utf8');
const generationHookSource = readFileSync(new URL('../hooks/useGeneration.ts', import.meta.url), 'utf8');
const promptEngineSource = readFileSync(new URL('../engine/promptEngine.ts', import.meta.url), 'utf8');
const localizedCompositeWorkerSource = readFileSync(new URL('../lib/localizedImageCompositeWorker.js', import.meta.url), 'utf8');
const localizedImageEditSource = readFileSync(new URL('../lib/localizedImageEdit.js', import.meta.url), 'utf8');
const apiGatewaySource = readFileSync(new URL('../services/apiGateway.ts', import.meta.url), 'utf8');
const geminiServiceSource = readFileSync(new URL('../services/geminiService.ts', import.meta.url), 'utf8');
const visualExtendSource = readFileSync(new URL('../lib/visualExtend.ts', import.meta.url), 'utf8');
const visualEditPanelSource = readFileSync(new URL('../components/panels/right/VisualEditPanel.tsx', import.meta.url), 'utf8');
const appAssistantSource = readFileSync(new URL('../components/AppAssistant.tsx', import.meta.url), 'utf8');
const topBarSource = readFileSync(new URL('../components/panels/TopBar.tsx', import.meta.url), 'utf8');
const mobilePanelsSource = readFileSync(new URL('../components/panels/mobile/MobilePanels.tsx', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../store.tsx', import.meta.url), 'utf8');
const imageCanvasSource = readFileSync(new URL('../components/canvas/ImageCanvas.tsx', import.meta.url), 'utf8');
const visualEditPolicySource = readFileSync(new URL('../lib/visualEditPolicy.ts', import.meta.url), 'utf8');
const mcpHarnessSource = readFileSync(new URL('../mcp/archwiz-test-mcp-server.mjs', import.meta.url), 'utf8');
const packageSource = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const liveSmokeSource = readFileSync(new URL('./verify-openai-image-edit-live.mjs', import.meta.url), 'utf8');

function extractFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `Expected production source to define ${name}.`);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function extractConstSource(source, name, nextName) {
  const start = source.indexOf(`const ${name} =`);
  assert.notEqual(start, -1, `Expected production source to define ${name}.`);
  const next = nextName
    ? source.indexOf(`\n  const ${nextName} =`, start + 1)
    : source.indexOf(`\n  const `, start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function assertSourceContract() {
  const maskBuilder = extractFunctionSource(workerSource, 'buildOpenAISelectionMaskPng');
  assert.match(maskBuilder, /rgba\[pixel \+ 3\] = 255 - selectedAlpha\[index\];/, 'worker must convert app-selected pixels to OpenAI transparent editable mask alpha');
  assert.match(workerSource, /const selectionAlpha = rgbaToSelectionAlpha\(maskPng\);/);
  assert.match(workerSource, /const serverSelectionStats = alphaStats\(selectionAlpha\);/);
  assert.match(workerSource, /const normalizedMaskBytes = await buildOpenAISelectionMaskPng\(maskPng\.width, maskPng\.height, selectionAlpha\);/);
  assert.match(workerSource, /form\.append\('mask', new Blob\(\[normalizedMaskBytes\], \{ type: 'image\/png' \}\), 'mask\.png'\);/);
  assert.match(workerSource, /sourceSize\.width % 16 !== 0 \|\| sourceSize\.height % 16 !== 0/);
  assert.match(workerSource, /totalPixels < 655_360 \|\| totalPixels > 8_294_400/);
  assert.match(workerSource, /if \(value === 'transparent'\) return 'opaque';/, 'gpt-image-2 background must not request transparency');
  assert.doesNotMatch(workerSource, /input_fidelity/, 'gpt-image-2 edit path must not send unsupported input_fidelity');
  assert.match(workerSource, /validateOpenAIMaskedEditUploads/, 'gateway must validate masked edit source and mask uploads before OpenAI');
  assert.match(workerSource, /Source image and mask must be the same PNG size/, 'gateway must enforce OpenAI mask same-size requirements');
  assert.match(workerSource, /Mask PNG must include an alpha channel/, 'gateway must enforce OpenAI mask alpha requirements');
  assert.match(workerWranglerSource, /name = "IMAGE_EDIT_LIMITER"[\s\S]*class_name = "ImageEditLimiter"/, 'the production gateway must bind the atomic image-edit limiter');
  assert.match(workerWranglerSource, /new_sqlite_classes = \["ImageEditLimiter"\]/, 'the image-edit limiter must ship with a Durable Object migration');
  assert.match(workerWranglerSource, /\[\[env\.production\.durable_objects\.bindings\]\]/, 'the production environment must explicitly inherit the Durable Object binding');

  assert.match(generationHookSource, /const OPENAI_SELECTION_ALPHA_THRESHOLD = 16;/);
  assert.match(generationHookSource, /const selectedAlpha = invert \? 255 - sourceSelectedAlpha : sourceSelectedAlpha;/, 'client must support intentionally inverted editable masks for background edits');
  assert.match(generationHookSource, /pixels\[index \+ 3\] = selectedAlpha;/, 'client mask PNG must carry selection in alpha');
  assert.match(generationHookSource, /const createOpenAIEditableMaskDataUrl = async/, 'client must build a dedicated OpenAI alpha mask instead of reusing the visible selection mask');
  assert.match(generationHookSource, /const protectedAlpha = editOutsideSelection[\s\S]*\? selectedAlpha[\s\S]*: 255 - selectedAlpha;/, 'client OpenAI mask must make selected pixels transparent for normal edits and protected for background edits');
  assert.match(generationHookSource, /state\.mode === 'visual-edit' \? null : generationConfig\?\.imageConfig\?\.aspectRatio/);
  assert.match(generationHookSource, /if \(!composited\.quality\.accepted\)/, 'localized property edits must fail closed when semantic preservation checks fail');
  assert.match(generationHookSource, /maxRetries: localizedContract\.maxDeterministicRetries/, 'localized deterministic preservation failures must receive a bounded automatic retry');
  const preciseToolsStart = generationHookSource.indexOf('const PRECISE_OPENAI_EDIT_TOOLS');
  const preciseToolsEnd = generationHookSource.indexOf('const drawMaskImageData');
  assert.notEqual(preciseToolsStart, -1, 'client must define precise OpenAI edit tools');
  assert.notEqual(preciseToolsEnd, -1, 'client must delimit precise OpenAI edit tools');
  const preciseToolsSource = generationHookSource.slice(preciseToolsStart, preciseToolsEnd);
  assert.match(preciseToolsSource, /'people'/, 'people edits should keep the precise OpenAI path');
  assert.match(preciseToolsSource, /'object'/, 'object edits should keep the precise OpenAI path');
  assert.match(preciseToolsSource, /'remove'/, 'remove edits should keep the precise OpenAI path');
  assert.match(preciseToolsSource, /'select'|'material'|'lighting'|'sky'/, 'all selected partial-edit tools must use the localized path');
  assert.doesNotMatch(preciseToolsSource, /'background'/, 'background replacement remains a whole-frame inverse-mask operation');
  assert.match(visualEditPolicySource, /visualEditRequiresSelection/, 'selection-required policy must be shared by generation and UI');
  assert.match(visualEditPolicySource, /hasSeparatedBrushPoints/, 'brush selections must contain spatially separated points');
  assert.match(visualEditPolicySource, /buildLocalizedVisualEditContract/, 'localized edits must use a deterministic operation contract');
  assert.match(visualEditPolicySource, /isColorOnlyChange/, 'Select-mode color requests must be classified as recolor');
  assert.match(visualEditPolicySource, /operation = 'recolor'/, 'recolor classification must be reachable from a free edit prompt');
  assert.match(visualEditPolicySource, /stripNegatedAndPreservationClauses/, 'negated safety constraints must not become edit actions');
  assert.match(promptEngineSource, /export const buildLocalizedVisualEditInstruction/, 'precise edits must share one concise tool-specific instruction compiler');
  assert.match(generationHookSource, /buildLocalizedVisualEditInstruction\(\s*state,\s*explicitPrompt\s*\)/, 'the localized route must use the same concise instruction contract as the UI preview');
  assert.match(generationHookSource, /resolveLocalizedEditIntent\(/, 'the localized path must use the image-aware AI intent compiler');
  assert.doesNotMatch(generationHookSource, /verifyLocalizedEditCandidate|semantic verifier unavailable|visual edit quality inspector|correctTargetChanged/, 'no AI verifier may inspect a generated localized candidate');
  assert.doesNotMatch(visualEditPolicySource, /evaluateLocalizedCandidateVerification|LocalizedCandidateVerificationDecision/, 'the removed post-generation AI verifier must not retain a policy contract');
  assert.match(generationHookSource, /lastDeterministicRejection/, 'a bounded retry must receive concrete feedback from deterministic compositor rejection');
  const localizedIntentCall = generationHookSource.indexOf('const resolvedIntent = await resolveLocalizedEditIntent');
  const localizedEditRequest = generationHookSource.indexOf('const editResponse = await imageEditRequest', localizedIntentCall);
  const localizedBranchEnd = generationHookSource.indexOf('if (!usedPreciseOpenAIEdit)', localizedEditRequest);
  assert.ok(localizedIntentCall >= 0 && localizedEditRequest > localizedIntentCall, 'the only localized AI layer must run before OpenAI generation');
  assert.ok(localizedBranchEnd > localizedEditRequest, 'localized generation branch must have a testable post-generation boundary');
  const localizedPostGenerationSource = generationHookSource.slice(localizedEditRequest, localizedBranchEnd);
  assert.doesNotMatch(localizedPostGenerationSource, /service\.generateText|generateText\(|parseLocalizedJsonObject|verifyLocalizedEditCandidate/, 'generated localized images must never be sent to another AI layer');
  assert.match(localizedPostGenerationSource, /compositeLocalizedVisualEditResult\(/, 'post-generation handling must retain the deterministic compositor');
  const localizedIntentDefinitionStart = generationHookSource.indexOf('const resolveLocalizedEditIntent');
  const localizedIntentDefinitionEnd = generationHookSource.indexOf('const pickFinalImage', localizedIntentDefinitionStart);
  const localizedIntentDefinition = generationHookSource.slice(localizedIntentDefinitionStart, localizedIntentDefinitionEnd);
  assert.match(localizedIntentDefinition, /console\.warn\('Localized edit instruction compiler failed; using the user instruction unchanged\.'/);
  assert.match(localizedIntentDefinition, /return fallback;/, 'invalid pre-generation AI JSON must fall back instead of blocking the edit');
  assert.match(generationHookSource, /visualEditRequiresSelection\(activeVisualTool\)/, 'generation must fail closed using the shared selection policy');
  assert.match(generationHookSource, /renderVisualSelectionSnapshot\(\s*sourceImageUrl!,\s*selectionShapesSnapshot\s*\)/, 'generation must synchronously rasterize canonical vector selections');
  assert.match(generationHookSource, /prepareLocalizedOpenAIEditInputs\(/, 'selected OpenAI edits must extract a context crop');
  assert.match(generationHookSource, /planLocalizedImageEdit\(/, 'localized edit preparation must retain explicit crop mapping metadata');
  assert.match(generationHookSource, /localizedPatch: true/, 'localized route must tell the gateway it is editing a fixed crop');
  assert.match(generationHookSource, /referenceImages: visualEditReferenceImages\.length > 0/, 'localized edits must forward tool-specific reference images');
  assert.match(generationHookSource, /compositeLocalizedVisualEditResult\(\s*sourceImageUrl!,\s*image,\s*preciseInputs\.layout\s*\)/, 'localized outputs must inverse-map through the exact crop layout');
  assert.match(generationHookSource, /unexpected edit size/, 'localized output size mismatches must fail instead of stretching into place');
  assert.doesNotMatch(generationHookSource, /estimateProtectedTranslation\(/, 'registration scoring must not block the browser main thread');
  assert.doesNotMatch(generationHookSource, /evaluateEditableTranslationGate\(/, 'translation gating must not block the browser main thread');
  assert.doesNotMatch(generationHookSource, /compositeLocalizedPixels\(/, 'pixel compositing must not block the browser main thread');
  assert.match(localizedCompositeWorkerSource, /estimateProtectedTranslation\(/, 'the module worker must register against protected crop context');
  assert.match(localizedCompositeWorkerSource, /evaluateEditableTranslationGate\(/, 'the module worker must gate translation using editable content');
  assert.match(localizedCompositeWorkerSource, /estimateProtectedColorOffset\(/, 'the module worker must perform robust protected-context color correction');
  assert.match(localizedCompositeWorkerSource, /compositeLocalizedPixels\(/, 'the module worker must use the deterministic production compositor');
  assert.match(localizedCompositeWorkerSource, /quality: \{[\s\S]*operation/, 'the module worker must return operation-aware semantic quality evidence');
  assert.match(generationHookSource, /LocalizedImageCompositeWorker from ['"]\.\.\/lib\/localizedImageCompositeWorker\.js\?worker['"]/, 'localized compositing must load as a Vite module worker');
  assert.match(generationHookSource, /worker\.postMessage\([\s\S]*transferList\);/, 'localized compositing must transfer typed-array buffers instead of cloning them into the worker');
  assert.match(localizedCompositeWorkerSource, /\[result\.pixels\.buffer, result\.matte\.buffer\]/, 'the module worker must transfer result buffers back to the browser');
  assert.match(generationHookSource, /runSynchronousFallback/, 'module-worker unavailability must retain a deterministic synchronous fallback');
  assert.match(generationHookSource, /setTimeout\(resolveFallback, LOCALIZED_COMPOSITE_WORKER_TIMEOUT_MS\)/, 'a hung module worker must be terminated through the bounded fallback path');
  assert.doesNotMatch(generationHookSource, /isOpenAIVisualEdit\s*\|\|[\s\S]{0,160}!shouldUseSelectionMask/, 'generic GPT Image selected edits must not skip local preservation compositing');
  assert.match(generationHookSource, /const finalizedImages = await Promise\.all\([\s\S]*compositeVisualEditResult\(sourceImageUrl!, image, selectedMaskDataUrl, editOutsideSelection/, 'generic selected edits must composite model output through the active selection mask');
  assert.match(generationHookSource, /operation: localizedContract\.operation/, 'the gateway must receive the classified operation instead of the active tool default');
  assert.match(generationHookSource, /prompt: localizedContract\.userInstruction/, 'the exact right-panel instruction must remain authoritative');
  assert.match(generationHookSource, /optimizedPrompt: retryInstruction/, 'the pre-generation visual interpretation must be sent separately from the exact user instruction');
  assert.doesNotMatch(generationHookSource, /createDeterministicLocalizedRecolor|localized deterministic recolor|refineLocalizedEditTargetMask/, 'localized edits must never take a mechanical recolor or AI-polygon path');
  assert.doesNotMatch(localizedImageEditSource, /recolorLocalizedSourcePixels|preserve-luminance|preserve-structure/, 'the production compositor must retain AI-generated pixels instead of reconstructing edits from source color or luminance');
  assert.match(generationHookSource, /state\.mode === 'visual-edit'[\s\S]*options\.prompt\?\.trim\(\) \|\| state\.workflow\.visualPrompt\?\.trim\(\)/, 'the right-panel prompt must take precedence in Visual Edit');
  assert.match(generationHookSource, /const prepareGenericOpenAIEditInputs = async/, 'non-precise masked OpenAI fallback must normalize edit inputs before gateway upload');
  assert.match(generationHookSource, /const size = getPreciseEditSize\(width, height\);[\s\S]*renderPngDataUrlAtSize\(sourceDataUrl, size\.width, size\.height/, 'masked OpenAI fallback source PNG must use a legal GPT Image 2 edit size');
  assert.match(generationHookSource, /renderPngDataUrlAtSize\(editableMaskDataUrl, size\.width, size\.height\)/, 'masked OpenAI fallback mask PNG must match the legal source size');
  assert.match(generationHookSource, /sourceImage: editSourceImage/, 'generic edit fallback must send the normalized OpenAI source image');
  assert.match(generationHookSource, /maskImage: editMaskImage \|\| undefined/, 'generic edit fallback must send the normalized OpenAI alpha mask');
  assert.match(generationHookSource, /size: openAISizeOverride/, 'generic masked OpenAI fallback must request source-sized output');
  const localizedComposite = extractConstSource(generationHookSource, 'compositeLocalizedVisualEditResult', 'compositeVisualEditResult');
  assert.match(localizedComposite, /sourceWidth !== layout\.sourceWidth/, 'final localized composite must reject a changed source image');
  assert.match(localizedComposite, /generatedWidth !== layout\.requestWidth/, 'final localized composite must validate provider output dimensions');
  assert.match(localizedComposite, /await runLocalizedImageCompositeOffThread\(/, 'final localized composite must await the off-main-thread pixel pipeline');
  assert.match(localizedComposite, /if \(!composited\.quality\.accepted\)/, 'final localized composite must reject an unsafe semantic result before canvas application');
  assert.match(localizedComposite, /outputCtx\.putImageData\(localizedImageData, sourceRect\.x, sourceRect\.y\)/, 'final localized composite must place only the planned source crop');
  assert.match(localizedComposite, /\.\.\.generated,[\s\S]*\.\.\.generatedImageFromDataUrl/, 'final localized composite must preserve provider result metadata');
  assert.match(apiGatewaySource, /normalizeOpenAISizeOverride/, 'client gateway must accept doc-legal custom GPT Image 2 sizes');
  assert.match(apiGatewaySource, /localizedPatch\?: boolean/, 'gateway contract must distinguish a fixed localized crop');
  assert.match(workerSource, /normalizeOpenAISizeValue\(generationConfig\.openAI\?\.size, null\)/, 'worker gateway must honor app-provided custom GPT Image 2 size overrides');
  assert.match(workerSource, /Return the identical crop, dimensions, camera, perspective, scale, framing, and pixel coordinate system/, 'worker prompt must prohibit crop recentering and camera drift');
  assert.match(workerSource, /readPngDimensions\(outputBytes, 'OpenAI edit output'\)/, 'worker must validate returned PNG dimensions');
  assert.match(workerSource, /versions\.length !== variants/, 'worker must reject partial or invalid variant sets');
  assert.match(workerSource, /join\('\\n\\n'\)\.slice\(0, OPENAI_IMAGE_MAX_PROMPT_CHARS\)/, 'worker must clamp the fully assembled edit prompt');
  assert.match(workerSource, /TASK: Re-render only the visible material color/, 'worker must compile a dedicated AI-rendered recolor contract');
  assert.match(workerSource, /same objects, count, geometry, silhouette, position, perspective/, 'recolor contract must preserve object identity and geometry');
  assert.match(workerSource, /transparent part of the mask is editable and the opaque part is protected/, 'the worker must describe documented mask polarity');
  assert.match(workerSource, /IMAGE INPUTS: Image 1 is the source image to edit/, 'reference roles must be indexed explicitly');
  assert.match(workerSource, /form\.append\('background', 'opaque'\)/, 'localized GPT Image 2 edits must request an opaque output for deterministic compositing');
  assert.match(generationHookSource, /registrationExclusionAlpha/, 'registration must exclude the provider-editable seam annulus');
  assert.match(generationHookSource, /for \(const image of editedImages\)/, 'multi-variant localized composites must be processed sequentially');
  assert.match(generationHookSource, /assertVisualEditSessionCurrent\(\);[\s\S]*dispatch\(\{ type: 'SET_IMAGE'/, 'stale visual-edit results must be rejected before applying to the canvas');
  assert.match(generationHookSource, /state\.workflow\.visualAutoSelecting[\s\S]*Wait for auto-selection to finish/, 'manual Apply must not overlap AI auto-selection');
  assert.match(generationHookSource, /latest\.workflow\.visualSelections !== visualEditSession\.visualSelections/, 'selection changes must invalidate an in-flight visual edit');
  assert.match(appAssistantSource, /hasUsableVisualSelection\(state\.workflow\.visualSelections\)/, 'Assistant selection readiness must use canonical geometry validity');
  assert.match(appAssistantSource, /state\.workflow\.visualAutoSelecting[\s\S]*Wait for auto-selection to finish/, 'Assistant Apply must not overlap AI auto-selection');

  assert.doesNotMatch(geminiServiceSource, /verifyImageOutput|buildOutputVerificationPrompt|parseOutputVerificationResult|output verification layer/i, 'Gemini service must not expose the removed output verification layer');
  assert.match(geminiServiceSource, /const readImageDimensionsFromBase64 = /, 'image data utility must preserve dimensions parsed from data URLs');
  assert.match(geminiServiceSource, /width: readUint32BE\(bytes, 16\),[\s\S]*height: readUint32BE\(bytes, 20\),/, 'PNG data URL dimensions must be parsed without async image loading');
  assert.match(geminiServiceSource, /normalizedMimeType === 'image\/jpeg'/, 'JPEG data URL dimensions must be parsed for uploaded photos');
  assert.match(geminiServiceSource, /const usesOpenAIAlphaMask = request\.imageGenerationModel === 'chatgpt-image-generation-2' && Boolean\(request\.maskImage\)/, 'GPT Image 2 edits must treat the mask as an alpha mask, not an ordinary reference image');
  assert.match(geminiServiceSource, /const maskedEditSizeOverride = openAIMaskImage[\s\S]*isValidOpenAIImageSize\(openAISourceImage\.width, openAISourceImage\.height\)/, 'masked GPT Image 2 edits must derive a source-sized output override when dimensions are legal');
  assert.match(geminiServiceSource, /size: maskedEditSizeOverride/, 'masked GPT Image 2 mask size override must be passed through generationConfig');
  assert.doesNotMatch(geminiServiceSource, /openAIImages\.push\(request\.maskImage\)/, 'GPT Image 2 must not append masks as normal image inputs');
  assert.match(geminiServiceSource, /maskImage: openAIMaskImage/, 'GPT Image 2 must send selection masks through the dedicated mask field');
  assert.match(geminiServiceSource, /case 'outpaint':[\s\S]*request\.maskImage[\s\S]*editable new canvas area/, 'outpaint prompts must describe the generated extension area when a mask is supplied');

  assert.match(visualExtendSource, /export const getVisualExtendCanvasLayout = /, 'visual extend canvas sizing must be shared between UI and generation');
  assert.match(visualExtendSource, /extendsLeft[\s\S]*offsetX = extendsLeft[\s\S]*extraWidth/, 'left outpaint must offset the protected source into the expanded canvas');
  assert.match(visualExtendSource, /extendsTop[\s\S]*offsetY = extendsTop[\s\S]*extraHeight/, 'top outpaint must offset the protected source into the expanded canvas');
  assert.match(storeSource, /workflow\.activeTool !== 'extend'\) return VISUAL_EDIT_IMAGE_MODEL/, 'visual edit model lock must relax only for the extend tool');
  assert.match(storeSource, /case 'SET_IMAGE':[\s\S]*clearVisualSelectionSession\(state\.workflow\)/, 'changing source images must clear revision-bound selections');
  assert.match(storeSource, /clearVisualSelectionDerivedArtifacts\(normalizeWorkflow\(action\.payload\.workflow\)\)/, 'project import must discard serialized raster selection caches');
  assert.match(storeSource, /visualExtend:[\s\S]*imageGenerationModel: DEFAULT_IMAGE_GENERATION_MODEL/, 'extend must default to the Nano Banana image model');
  assert.match(topBarSource, /state\.mode === 'visual-edit' && state\.workflow\.activeTool === 'extend'[\s\S]*visualExtend:[\s\S]*imageGenerationModel: model/, 'top bar model selector must update the extend-specific image model');
  assert.match(topBarSource, /visualEditBusy[\s\S]*visualAutoSelecting/, 'desktop Apply must be disabled while auto-selection is running');
  assert.match(mobilePanelsSource, /visualEditBusy[\s\S]*visualAutoSelecting/, 'mobile Apply must be disabled while auto-selection is running');
  assert.match(visualEditPanelSource, /autoSelectIntentRef\.current !== requestIntent/, 'auto-selection must discard responses after tool, target, mode, prompt, or image intent changes');
  assert.match(visualEditPanelSource, /autoSelectRequestIdRef\.current \+= 1;[\s\S]*visualAutoSelecting: false/, 'unmounting the selection panel must cancel auto-selection and clear its busy flag');
  assert.match(visualEditPanelSource, /Image Model[\s\S]*Nano Banana[\s\S]*chatgpt-image-generation-2/, 'extend settings must offer Nano Banana and GPT Image 2');
  assert.match(generationHookSource, /state\.workflow\.activeTool === 'extend'[\s\S]*state\.workflow\.visualExtend\.imageGenerationModel/, 'generation hook must route extend through the extend-specific image model');
  assert.match(generationHookSource, /const prepareVisualExtendOutpaintInputs = /, 'extend generation must prepare an expanded outpaint source and mask');
  assert.match(generationHookSource, /getVisualExtendMaskDataUrl\(layout, imageGenerationModel === 'chatgpt-image-generation-2'\)/, 'extend masks must use GPT alpha polarity only for GPT Image 2');
  assert.match(generationHookSource, /compositeVisualExtendResult\(sourceImageUrl!, image, visualExtendOutpaintInputs\.layout\)/, 'extend outputs must composite the original source image back into the protected area');

  const selectionMaskBuilder = extractConstSource(imageCanvasSource, 'buildSelectionMask', 'buildSelectionComposite');
  assert.match(selectionMaskBuilder, /img\.naturalWidth/, 'visual overlay mask must use source image natural width');
  assert.match(selectionMaskBuilder, /img\.naturalHeight/, 'visual overlay mask must use source image natural height');
  assert.match(selectionMaskBuilder, /ctx\.fillStyle = '#000';[\s\S]*ctx\.fillRect\(0, 0, width, height\);/, 'visual overlay mask must lock unselected pixels as black');
  assert.match(selectionMaskBuilder, /ctx\.fillStyle = '#fff';[\s\S]*ctx\.strokeStyle = '#fff';/, 'visual overlay mask must mark selected pixels as white');
  assert.match(selectionMaskBuilder, /shape\.type === 'rect'/, 'visual overlay mask must support rectangular selections');
  assert.match(selectionMaskBuilder, /shape\.type === 'lasso'/, 'visual overlay mask must support lasso selections');
  assert.match(selectionMaskBuilder, /ctx\.lineWidth = shape\.brushSize \|\| fallbackBrushSize;/, 'visual overlay mask must support brush selections');
  assert.match(selectionMaskBuilder, /dataUrl: canvas\.toDataURL\('image\/png'\)/, 'visual overlay mask must persist a PNG data URL');
  assert.match(imageCanvasSource, /const isSelectTool = isVisualEdit && state\.workflow\.activeTool !== 'extend';/, 'localized visual edit tools must accept selection gestures without forcing a separate select tool step');

  const selectionCompositeBuilder = extractConstSource(imageCanvasSource, 'buildSelectionComposite', 'getSelectionPoint');
  assert.match(selectionCompositeBuilder, /ctx\.drawImage\(img, 0, 0, outputWidth, outputHeight\);/, 'selection composite must preview over the source image');
  assert.match(selectionCompositeBuilder, /const selectionFill = 'rgba\(56, 189, 248, 0\.14\)';/, 'selection composite must use the visible overlay fill');
  assert.match(selectionCompositeBuilder, /resolve\(\{ dataUrl: canvas\.toDataURL\('image\/png'\), width: outputWidth, height: outputHeight \}\);/, 'selection composite must persist preview dimensions');

  assert.match(imageCanvasSource, /state\.mode !== 'visual-edit'/, 'selection mask lifecycle must be scoped to visual-edit mode');
  assert.match(imageCanvasSource, /visualSelectionMask: mask\.dataUrl/);
  assert.match(imageCanvasSource, /visualSelectionMaskSize: \{ width: mask\.width, height: mask\.height \}/);
  assert.match(imageCanvasSource, /visualSelectionComposite: composite\.dataUrl/);
  assert.match(imageCanvasSource, /visualSelectionCompositeSize: \{ width: composite\.width, height: composite\.height \}/);
  assert.match(imageCanvasSource, /const maskIsCurrent =[\s\S]*const compositeIsCurrent =[\s\S]*if \(compositeIsCurrent\) \{[\s\S]*return;/, 'selection artifact lifecycle must not skip composite generation when only the mask is current');
  assert.match(imageCanvasSource, /visualSelectionMask: mask\.dataUrl,[\s\S]*visualSelectionComposite: null,[\s\S]*visualSelectionCompositeSize: null/, 'changing a selection mask must clear stale composite artifacts');
  assert.match(imageCanvasSource, /visualSelectionMask: null,[\s\S]*visualSelectionMaskSize: null,[\s\S]*visualSelectionComposite: null,[\s\S]*visualSelectionCompositeSize: null/, 'selection artifacts must clear when no source/selection remains');
  assert.match(imageCanvasSource, /selectionMigrationRef\.current === state\.uploadedImage/, 'source image changes must migrate selection coordinates only once per source');
  assert.match(imageCanvasSource, /point\.x \* scaleX/, 'source-pixel selection rebasing must not apply object-contain offsets');
  assert.match(imageCanvasSource, /!isVisualEdit && !showCompare/, 'split view must be disabled while editing a single canonical frame');
  assert.match(imageCanvasSource, /activeSelectionRef\.current = resolved;[\s\S]*setActiveSelection\(resolved\);/, 'selection ref must update synchronously so fast drags commit on mouseup');
  assert.match(imageCanvasSource, /activeBoundaryRef\.current = resolved;[\s\S]*setActiveBoundary\(resolved\);/, 'boundary ref must update synchronously so fast drags commit on mouseup');
  assert.match(imageCanvasSource, /isSelectingRef\.current = next;[\s\S]*setIsSelecting\(next\);/, 'selection drag state must update synchronously so fast drags reach mousemove and mouseup handlers');
  assert.match(imageCanvasSource, /isBoundarySelectingRef\.current = next;[\s\S]*setIsBoundarySelecting\(next\);/, 'boundary drag state must update synchronously so fast drags reach mousemove and mouseup handlers');
  assert.match(imageCanvasSource, /if \(isSelectingRef\.current\) \{[\s\S]*updateSelectionPath\(e\);/, 'selection movement must use synchronous drag state');
  assert.match(imageCanvasSource, /if \(isSelectingRef\.current\) finishSelection\(finalPoint\);/, 'selection pointerup must use synchronous drag state and its final coordinate');
  assert.match(imageCanvasSource, /setPointerCapture\(e\.pointerId\)/, 'selection gestures must use pointer capture for mouse, pen, and touch');
  assert.match(imageCanvasSource, /onPointerCancel=\{handleCanvasPointerCancel\}/, 'selection gestures must handle OS and browser pointer cancellation');
  const cancelSelectionGesture = extractConstSource(imageCanvasSource, 'cancelSelectionGesture', 'cancelBoundaryGesture');
  assert.match(cancelSelectionGesture, /visualSelections: adjustDrag\.originalSelections/, 'canceling an adjust gesture must restore original geometry');
  assert.match(cancelSelectionGesture, /visualSelections: eraseSnapshot/, 'canceling an erase gesture must restore erased geometry');
  const cancelCanvasPointer = extractConstSource(imageCanvasSource, 'cancelCanvasPointer', 'handleCanvasPointerUp');
  assert.match(cancelCanvasPointer, /cancelSelectionGesture\(\)/, 'pointer cancellation must use rollback instead of commit');
  assert.doesNotMatch(cancelCanvasPointer, /finishSelection|finishBoundarySelection/, 'pointer cancellation must never commit selection work');
  assert.match(imageCanvasSource, /touchAction: state\.uploadedImage \? 'none' : 'auto'/, 'touch selection must disable browser panning before the gesture starts');
  assert.match(imageCanvasSource, /const latestPendingPoint = (?:finalPointOverride \|\| )?pendingPointRef\.current;[\s\S]*activeSelectionRef\.current = \{ \.\.\.current, end: latestPendingPoint \};/, 'selection mouseup must flush the final pending point before canceling requestAnimationFrame');
  assert.match(imageCanvasSource, /const latestPendingPoint = boundaryPendingPointRef\.current;[\s\S]*boundaryFullPointsRef\.current = \[\.\.\.boundaryFullPointsRef\.current, latestPendingPoint\];/, 'boundary mouseup must flush the final pending point before canceling requestAnimationFrame');
  assert.match(imageCanvasSource, /className="absolute inset-0 pointer-events-none"[\s\S]*<svg className="w-full h-full">/, 'visible selection overlay must be image-aligned and pointer-transparent');
  assert.match(mcpHarnessSource, /const imageAspect = image\.naturalWidth \/ image\.naturalHeight;/, 'browser overlay harness must account for object-contain image aspect');
  assert.match(mcpHarnessSource, /offsetY = \(rect\.height - renderedHeight\) \/ 2;/, 'browser overlay harness must account for vertical letterboxing');
  assert.match(mcpHarnessSource, /offsetX = \(rect\.width - renderedWidth\) \/ 2;/, 'browser overlay harness must account for horizontal letterboxing');
  assert.match(mcpHarnessSource, /left: rect\.left \+ offsetX,[\s\S]*top: rect\.top \+ offsetY,[\s\S]*width: renderedWidth,[\s\S]*height: renderedHeight,/, 'browser overlay harness must draw inside the rendered image content, not padded img bounds');
  assert.match(mcpHarnessSource, /type: 'mousePressed'[\s\S]*buttons: 1/, 'browser overlay harness must mark the left button as held on mouse down');
  assert.match(mcpHarnessSource, /type: 'mouseMoved'[\s\S]*buttons: 1/, 'browser overlay harness must mark the left button as held while dragging');
  assert.match(mcpHarnessSource, /type: 'mouseReleased'[\s\S]*buttons: 0/, 'browser overlay harness must release the held button on mouse up');
  assert.match(packageSource, /"verify:image-edit:live": "node scripts\/verify-openai-image-edit-live\.mjs"/, 'package scripts must expose a live OpenAI image-edit smoke gate');
  assert.match(liveSmokeSource, /OPENAI_API_KEY is required/, 'live smoke must fail explicitly when no OpenAI key is configured');
  assert.match(liveSmokeSource, /form\.append\('model', 'gpt-image-2'\)/, 'live smoke must use GPT Image 2');
  assert.match(liveSmokeSource, /form\.append\('size', `\$\{WIDTH\}x\$\{HEIGHT\}`\)/, 'live smoke must request source-sized GPT Image 2 output');
  assert.match(liveSmokeSource, /form\.append\('image\[\]'/, 'live smoke must use the GPT Image 2 edit image[] form field');
  assert.match(liveSmokeSource, /form\.append\('mask'/, 'live smoke must send an edit mask');
  assert.match(liveSmokeSource, /rgba\[pixel \+ 3\] = editable \? 0 : 255;/, 'live smoke must use OpenAI transparent-editable mask polarity');
  assert.match(liveSmokeSource, /255 - value/, 'live smoke local verification must convert protected alpha back to canonical editable alpha');
  assert.match(liveSmokeSource, /\/images\/edits/, 'live smoke must call the OpenAI image edits endpoint');
  assert.match(liveSmokeSource, /decodePngRgba\(outputBytes\)/, 'live smoke must decode and inspect the returned image');
  assert.match(liveSmokeSource, /rawStats\.insideChangedRatio < 0\.02/, 'live smoke must fail when the editable mask region does not change');
  assert.match(liveSmokeSource, /compositedStats\.outsideChangedPixels !== 0/, 'live smoke must prove post-composite locked pixels stay unchanged');
  assert.match(liveSmokeSource, /compositedOutputPath/, 'live smoke must write the final strict-composited proof output');
}

function assertLocalizedOperationClassification() {
  const cases = [
    ['Change the color of the seats on those chairs to magenta', 'recolor'],
    ['Change the colors of the seats from Black to magenta', 'recolor'],
    ['change the color of these marble tiles to sand yellow color, only change the color and nothing else, the shape and texture stays the same', 'recolor'],
    ['Change the chairs to magenta; do not remove them.', 'recolor'],
    ['Change only the color to sand yellow; do not change the texture.', 'recolor'],
    ['Do not add people; recolor the seats blue.', 'recolor'],
    ['Remove the blue tint from the wall.', 'recolor'],
    ['Replace only the blue color on the chair with magenta.', 'recolor'],
    ['Remove the chair next to the people.', 'remove_object'],
    ['Remove the chair, preserve all people unchanged.', 'remove_object'],
    ['Add a bench next to the people.', 'custom'],
    ['Replace this person with a metal robot.', 'custom'],
    ['Remove old finish and apply oak wood.', 'replace_material'],
    ['Restyle the chair as mid-century modern.', 'custom'],
  ];
  for (const [instruction, expectedOperation] of cases) {
    const contract = buildLocalizedVisualEditContract({
      activeTool: 'select',
      instruction,
    });
    assert.equal(
      contract.operation,
      expectedOperation,
      `unexpected operation for: ${instruction}`
    );
  }

  const namedColorRecolor = buildLocalizedVisualEditContract({
    activeTool: 'select',
    instruction: 'Change the colors of the seats from Black to magenta',
  });
  assert.equal(namedColorRecolor.operation, 'recolor');
  assert.match(namedColorRecolor.targetLabel, /\bseats\b/i, 'plural color-change wording must resolve the visible seats as the target');
  assert.doesNotMatch(namedColorRecolor.targetLabel, /named target|selected area/i, 'a named seat target must not fall back to a generic ROI label');
  assert.deepEqual(
    namedColorRecolor.sourceColor,
    { red: 0, green: 0, blue: 0 },
    '"from Black" should remain available to the pre-generation prompt compiler'
  );
  assert.deepEqual(
    namedColorRecolor.targetColor,
    { red: 255, green: 0, blue: 255 },
    'the named magenta destination should remain available as prompt metadata'
  );
  assert.equal(namedColorRecolor.compositeMode, 'generated-pixels', 'every localized operation must composite the AI-rendered pixels');
  assert.equal(
    namedColorRecolor.colorHex,
    undefined,
    'a named color must not be promoted to an exact user-specified hex value'
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(namedColorRecolor, 'colorHex'),
    false,
    'named-color recolors must omit colorHex unless the user explicitly typed a hex value'
  );

  assert.equal(buildLocalizedVisualEditContract({
    activeTool: 'material',
    instruction: 'Apply oak finish to the selected surface.',
  }).operation, 'replace_material');
  assert.equal(buildLocalizedVisualEditContract({
    activeTool: 'people',
    instruction: 'Enhance the selected existing people.',
    peopleMode: 'enhance',
  }).operation, 'custom');
  assert.equal(buildLocalizedVisualEditContract({
    activeTool: 'people',
    instruction: 'Add context-appropriate people.',
    peopleMode: 'automatic',
  }).operation, 'add_people');

}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function roundToPreciseEditMultiple(value) {
  return Math.max(
    PRECISE_EDIT_SIZE_MULTIPLE,
    Math.round(value / PRECISE_EDIT_SIZE_MULTIPLE) * PRECISE_EDIT_SIZE_MULTIPLE
  );
}

function getPreciseEditSize(width, height) {
  if (!width || !height) return null;
  const ratio = width / height;
  if (ratio > 3 || ratio < 1 / 3) return null;

  const pixels = width * height;
  const longEdge = Math.max(width, height);
  let scale = Math.min(
    1,
    PRECISE_EDIT_MAX_LONG_EDGE / Math.max(longEdge, 1),
    Math.sqrt(PRECISE_EDIT_MAX_PIXELS / Math.max(pixels, 1))
  );
  if (pixels * scale * scale < PRECISE_EDIT_MIN_PIXELS) {
    scale = Math.sqrt(PRECISE_EDIT_MIN_PIXELS / Math.max(pixels, 1));
  }

  const rawWidth = width * scale;
  const rawHeight = height * scale;
  const baseWidth = roundToPreciseEditMultiple(rawWidth);
  const baseHeight = roundToPreciseEditMultiple(rawHeight);
  const basePixels = baseWidth * baseHeight;
  const baseLongEdge = Math.max(baseWidth, baseHeight);
  if (
    baseLongEdge <= PRECISE_EDIT_MAX_LONG_EDGE &&
    basePixels <= PRECISE_EDIT_MAX_PIXELS &&
    basePixels >= PRECISE_EDIT_MIN_PIXELS
  ) {
    return { width: baseWidth, height: baseHeight };
  }

  let best = null;

  for (let widthStep = -4; widthStep <= 4; widthStep += 1) {
    for (let heightStep = -4; heightStep <= 4; heightStep += 1) {
      const candidateWidth = baseWidth + widthStep * PRECISE_EDIT_SIZE_MULTIPLE;
      const candidateHeight = baseHeight + heightStep * PRECISE_EDIT_SIZE_MULTIPLE;
      if (candidateWidth < PRECISE_EDIT_SIZE_MULTIPLE || candidateHeight < PRECISE_EDIT_SIZE_MULTIPLE) continue;
      const candidatePixels = candidateWidth * candidateHeight;
      const candidateLongEdge = Math.max(candidateWidth, candidateHeight);
      if (candidateLongEdge > PRECISE_EDIT_MAX_LONG_EDGE || candidatePixels > PRECISE_EDIT_MAX_PIXELS) continue;
      if (candidatePixels < PRECISE_EDIT_MIN_PIXELS) continue;

      const ratioError = Math.abs(candidateWidth / candidateHeight - ratio) / ratio;
      const sizeError = Math.abs(candidatePixels / Math.max(rawWidth * rawHeight, 1) - 1);
      const score = ratioError * 100 + sizeError;
      if (!best || score < best.score) {
        best = { width: candidateWidth, height: candidateHeight, score };
      }
    }
  }

  return best ? { width: best.width, height: best.height } : null;
}

function readUint32(bytes, offset) {
  return (
    ((bytes[offset] << 24) >>> 0) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 255;
  bytes[offset + 1] = (value >>> 16) & 255;
  bytes[offset + 2] = (value >>> 8) & 255;
  bytes[offset + 3] = value & 255;
}

let crcTable = null;
function getCrcTable() {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = table[(crc ^ bytes[index]) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function base64UrlEncodeBytes(bytes) {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function signTestJwt(payload, secret) {
  const encoder = new TextEncoder();
  const header = base64UrlEncodeBytes(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64UrlEncodeBytes(encoder.encode(JSON.stringify(payload)));
  const unsigned = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(unsigned)));
  return `${unsigned}.${base64UrlEncodeBytes(sig)}`;
}

function pngChunk(type, data = new Uint8Array()) {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  writeUint32(out, 0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  writeUint32(out, 8 + data.length, crc32(concatBytes([typeBytes, data])));
  return out;
}

function encodePngRgba(width, height, rgba) {
  const rowBytes = width * 4;
  const raw = new Uint8Array((rowBytes + 1) * height);
  let inputOffset = 0;
  let outputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[outputOffset++] = 0;
    raw.set(rgba.subarray(inputOffset, inputOffset + rowBytes), outputOffset);
    inputOffset += rowBytes;
    outputOffset += rowBytes;
  }

  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, width);
  writeUint32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return concatBytes([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND'),
  ]);
}

function encodePngRgb(width, height, rgb) {
  const rowBytes = width * 3;
  const raw = new Uint8Array((rowBytes + 1) * height);
  let inputOffset = 0;
  let outputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[outputOffset++] = 0;
    raw.set(rgb.subarray(inputOffset, inputOffset + rowBytes), outputOffset);
    inputOffset += rowBytes;
    outputOffset += rowBytes;
  }

  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, width);
  writeUint32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return concatBytes([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND'),
  ]);
}

function decodePngRgba(bytes) {
  assert.deepEqual(Array.from(bytes.subarray(0, 8)), Array.from(PNG_SIGNATURE));
  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === 'IHDR') {
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      bitDepth = data[8];
      colorType = data[9];
      assert.equal(data[12], 0, 'test PNGs must not be interlaced');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  assert.equal(bitDepth, 8);
  assert.equal(colorType, 6);
  const inflated = inflateSync(concatBytes(idat));
  const rowBytes = width * 4;
  const rgba = new Uint8Array(width * height * 4);
  let inputOffset = 0;
  let outputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset++];
    assert.equal(filter, 0, 'test decoder expects unfiltered rows');
    rgba.set(inflated.subarray(inputOffset, inputOffset + rowBytes), outputOffset);
    inputOffset += rowBytes;
    outputOffset += rowBytes;
  }
  return { width, height, data: rgba };
}

function makeSourceRgba(width, height) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      rgba[pixel] = 52 + Math.round((x / width) * 70);
      rgba[pixel + 1] = 70 + Math.round((y / height) * 88);
      rgba[pixel + 2] = 92 + Math.round(((x + y) / (width + height)) * 62);
      rgba[pixel + 3] = 255;
      if (x >= SELECT_X1 && x < SELECT_X2 && y >= SELECT_Y1 && y < SELECT_Y2) {
        rgba[pixel] = 118;
        rgba[pixel + 1] = 118;
        rgba[pixel + 2] = 122;
      }
    }
  }
  return rgba;
}

function makeSelectedAlpha(width, height) {
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= SELECT_X1 && x < SELECT_X2 && y >= SELECT_Y1 && y < SELECT_Y2) {
        alpha[y * width + x] = 255;
      }
    }
  }
  return alpha;
}

function invertAlpha(alpha) {
  const out = new Uint8Array(alpha.length);
  for (let index = 0; index < alpha.length; index += 1) {
    out[index] = 255 - alpha[index];
  }
  return out;
}

function makeGeneratedRgba(source, selectedAlpha, { outsideDrift = false } = {}) {
  const rgba = new Uint8Array(source);
  for (let index = 0, pixel = 0; index < selectedAlpha.length; index += 1, pixel += 4) {
    if (selectedAlpha[index] >= OPENAI_SELECTION_ALPHA_THRESHOLD) {
      rgba[pixel] = 200;
      rgba[pixel + 1] = 64;
      rgba[pixel + 2] = 150;
    } else if (outsideDrift && index % 997 === 0) {
      rgba[pixel] = clampByte(rgba[pixel] + 42);
      rgba[pixel + 1] = clampByte(rgba[pixel + 1] + 34);
      rgba[pixel + 2] = clampByte(rgba[pixel + 2] + 30);
    }
  }
  return rgba;
}

function buildOpenAISelectionMaskPng(width, height, selectedAlpha) {
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0, pixel = 0; index < selectedAlpha.length; index += 1, pixel += 4) {
    rgba[pixel] = 255;
    rgba[pixel + 1] = 255;
    rgba[pixel + 2] = 255;
    rgba[pixel + 3] = 255 - selectedAlpha[index];
  }
  return encodePngRgba(width, height, rgba);
}

function buildClientGrayscaleMaskPng(width, height, selectedAlpha) {
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0, pixel = 0; index < selectedAlpha.length; index += 1, pixel += 4) {
    rgba[pixel] = selectedAlpha[index];
    rgba[pixel + 1] = selectedAlpha[index];
    rgba[pixel + 2] = selectedAlpha[index];
    rgba[pixel + 3] = 255;
  }
  return encodePngRgba(width, height, rgba);
}

function buildRgbMaskPng(width, height, selectedAlpha) {
  const rgb = new Uint8Array(width * height * 3);
  for (let index = 0, pixel = 0; index < selectedAlpha.length; index += 1, pixel += 3) {
    rgb[pixel] = selectedAlpha[index];
    rgb[pixel + 1] = selectedAlpha[index];
    rgb[pixel + 2] = selectedAlpha[index];
  }
  return encodePngRgb(width, height, rgb);
}

function rgbaToSelectionAlpha(maskPng) {
  const alpha = new Uint8Array(maskPng.width * maskPng.height);
  for (let i = 0, p = 0; i < maskPng.data.length; i += 4, p += 1) {
    const luminance = Math.round((maskPng.data[i] + maskPng.data[i + 1] + maskPng.data[i + 2]) / 3);
    alpha[p] = Math.round((luminance * maskPng.data[i + 3]) / 255);
  }
  return alpha;
}

function alphaStats(alpha) {
  let selected = 0;
  for (let index = 0; index < alpha.length; index += 1) {
    if (alpha[index] >= OPENAI_SELECTION_ALPHA_THRESHOLD) selected += 1;
  }
  return { selected, ratio: selected / Math.max(alpha.length, 1) };
}

function compositeStrict(source, generated, selectedAlpha) {
  const out = new Uint8Array(source);
  for (let index = 0, pixel = 0; index < selectedAlpha.length; index += 1, pixel += 4) {
    const alpha = selectedAlpha[index] / 255;
    if (alpha <= 0) continue;
    const inverse = 1 - alpha;
    out[pixel] = clampByte(source[pixel] * inverse + generated[pixel] * alpha);
    out[pixel + 1] = clampByte(source[pixel + 1] * inverse + generated[pixel + 1] * alpha);
    out[pixel + 2] = clampByte(source[pixel + 2] * inverse + generated[pixel + 2] * alpha);
    out[pixel + 3] = clampByte(source[pixel + 3] * inverse + generated[pixel + 3] * alpha);
  }
  return out;
}

function maxDelta(a, b, pixel) {
  return Math.max(
    Math.abs(a[pixel] - b[pixel]),
    Math.abs(a[pixel + 1] - b[pixel + 1]),
    Math.abs(a[pixel + 2] - b[pixel + 2])
  );
}

function localizedDiffStats(source, generated, selectedAlpha) {
  let insidePixels = 0;
  let outsidePixels = 0;
  let insideChanged = 0;
  let outsideChanged = 0;
  for (let index = 0, pixel = 0; index < selectedAlpha.length; index += 1, pixel += 4) {
    const inside = selectedAlpha[index] >= OPENAI_SELECTION_ALPHA_THRESHOLD;
    const changed = maxDelta(source, generated, pixel) >= LOCALIZED_EDIT_CHANGE_THRESHOLD;
    if (inside) {
      insidePixels += 1;
      if (changed) insideChanged += 1;
    } else {
      outsidePixels += 1;
      if (changed) outsideChanged += 1;
    }
  }
  return {
    insideChangedRatio: insideChanged / Math.max(insidePixels, 1),
    outsideChangedRatio: outsideChanged / Math.max(outsidePixels, 1),
    outsideChangedPixels: outsideChanged,
  };
}

function assertGptImage2Size(width, height) {
  const totalPixels = width * height;
  assert.equal(width % 16, 0, 'width must be a multiple of 16');
  assert.equal(height % 16, 0, 'height must be a multiple of 16');
  assert.ok(Math.max(width, height) <= 3840, 'max edge must be <= 3840');
  assert.ok(Math.max(width, height) / Math.min(width, height) <= 3, 'aspect ratio must be <= 3:1');
  assert.ok(totalPixels >= 655_360, 'total pixels must meet GPT Image 2 minimum');
  assert.ok(totalPixels <= 8_294_400, 'total pixels must meet GPT Image 2 maximum');
}

function assertPreparedEditSize(sourceWidth, sourceHeight) {
  const size = getPreciseEditSize(sourceWidth, sourceHeight);
  assert.ok(size, `expected editable size for ${sourceWidth}x${sourceHeight}`);
  assertGptImage2Size(size.width, size.height);
  assert.ok(Math.max(size.width, size.height) <= PRECISE_EDIT_MAX_LONG_EDGE);
  assert.ok(size.width * size.height <= PRECISE_EDIT_MAX_PIXELS);
  const sourceRatio = sourceWidth / sourceHeight;
  const outputRatio = size.width / size.height;
  const ratioError = Math.abs(outputRatio - sourceRatio) / sourceRatio;
  assert.ok(ratioError < 0.015, `ratio drift too high for ${sourceWidth}x${sourceHeight}: ${ratioError}`);
  return size;
}

function assertPreparedEditSizePreservesLegalSource(sourceWidth, sourceHeight) {
  const size = assertPreparedEditSize(sourceWidth, sourceHeight);
  assert.ok(
    size.width >= roundToPreciseEditMultiple(sourceWidth) - PRECISE_EDIT_SIZE_MULTIPLE,
    `legal source width should not be unnecessarily downscaled: ${sourceWidth} -> ${size.width}`
  );
  assert.ok(
    size.height >= roundToPreciseEditMultiple(sourceHeight) - PRECISE_EDIT_SIZE_MULTIPLE,
    `legal source height should not be unnecessarily downscaled: ${sourceHeight} -> ${size.height}`
  );
  return size;
}

async function verifyWorkerImageEditRoute() {
  const { default: worker } = await import('../cloudflare-worker/worker.js');
  const source = makeSourceRgba(WIDTH, HEIGHT);
  const selectedAlpha = makeSelectedAlpha(WIDTH, HEIGHT);
  const sourceBytes = encodePngRgba(WIDTH, HEIGHT, source);
  const clientMaskBytes = buildClientGrayscaleMaskPng(WIDTH, HEIGHT, selectedAlpha);
  const openAIAlphaMaskBytes = buildOpenAISelectionMaskPng(WIDTH, HEIGHT, selectedAlpha);
  const expectedStats = alphaStats(selectedAlpha);
  const jwtSecret = 'image-edit-pipeline-test-secret';
  const token = await signTestJwt({
    email: 'image-edit-test@example.com',
    name: 'Image Edit Test',
    exp: Math.floor(Date.now() / 1000) + 300,
  }, jwtSecret);

  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedInit = null;
  globalThis.fetch = async (url, init = {}) => {
    capturedUrl = String(url);
    capturedInit = init;
    assert.equal(capturedUrl, 'https://api.openai.com/v1/images/edits');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers?.Authorization, 'Bearer test-openai-key');
    return new Response(JSON.stringify({
      data: [{ b64_json: bytesToBase64(sourceBytes) }],
      usage: { total_tokens: 0 },
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'test-openai-request',
      },
    });
  };

  try {
    const basePayload = {
      sourceImage: {
        base64: bytesToBase64(sourceBytes),
        mimeType: 'image/png',
        width: WIDTH,
        height: HEIGHT,
      },
      selectionMask: {
        base64: bytesToBase64(clientMaskBytes),
        mimeType: 'image/png',
        width: WIDTH,
        height: HEIGHT,
      },
      selectionStats: {
        selectedPixels: 1,
        selectedRatio: 1 / (WIDTH * HEIGHT),
      },
      prompt: 'Replace the selected floor material with brushed steel.',
      operation: 'replace_material',
      targetLabel: 'selected floor material',
      quality: 'standard',
      variants: 1,
      outputFormat: 'png',
      localizedPatch: true,
    };
    const makeRequest = (payload) => new Request('https://worker.test/api/image-edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const makeOpenAIImageRequest = (payload) => new Request('https://worker.test/api/openai/images', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const baseEnv = {
      JWT_SECRET: jwtSecret,
      OPENAI_API_KEY: 'test-openai-key',
      IMAGE_EDIT_RATE_LIMIT_PER_USER: '10000',
      IMAGE_EDIT_RATE_LIMIT_PER_IP: '20000',
    };
    const request = new Request('https://worker.test/api/image-edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(basePayload),
    });
    const response = await worker.fetch(request, baseEnv, { waitUntil() {} });
    if (response.status !== 200) {
      throw new Error(await response.text());
    }
    const json = await response.json();
    assert.equal(json.status, 'completed');
    assert.equal(json.versions?.length, 1);
    assert.ok(capturedInit?.body instanceof FormData, 'worker must forward multipart form data');
    const form = capturedInit.body;
    assert.equal(form.get('model'), 'gpt-image-2');
    assert.equal(form.get('n'), '1');
    assert.equal(form.get('size'), `${WIDTH}x${HEIGHT}`);
    assert.equal(form.get('quality'), 'medium');
    assert.equal(form.get('output_format'), 'png');
    assert.equal(form.get('background'), 'opaque');
    assert.match(String(form.get('prompt')), /identical crop, dimensions, camera, perspective/i);
    assert.equal(form.getAll('image[]').length, 1);
    const forwardedMaskBlob = form.get('mask');
    assert.ok(forwardedMaskBlob instanceof Blob, 'worker must forward a normalized mask blob');
    const forwardedMask = decodePngRgba(new Uint8Array(await forwardedMaskBlob.arrayBuffer()));
    const insidePixel = (SELECT_Y1 + 4) * WIDTH + SELECT_X1 + 4;
    const outsidePixel = 4 * WIDTH + 4;
    assert.equal(forwardedMask.data[insidePixel * 4], 255);
    assert.equal(forwardedMask.data[insidePixel * 4 + 1], 255);
    assert.equal(forwardedMask.data[insidePixel * 4 + 2], 255);
    assert.equal(forwardedMask.data[insidePixel * 4 + 3], 0, 'selected app pixels must be transparent/editable in the OpenAI mask');
    assert.equal(forwardedMask.data[outsidePixel * 4], 255);
    assert.equal(forwardedMask.data[outsidePixel * 4 + 1], 255);
    assert.equal(forwardedMask.data[outsidePixel * 4 + 2], 255);
    assert.equal(forwardedMask.data[outsidePixel * 4 + 3], 255, 'unselected app pixels must be opaque/protected in the OpenAI mask');
    const metadata = json.versions[0].metadata;
    assert.equal(metadata.selectedPixels, expectedStats.selected);
    assert.ok(Math.abs(metadata.selectedRatio - expectedStats.ratio) < 1e-12);
    assert.equal(metadata.clientSelectedRatio, 1 / (WIDTH * HEIGHT));
    assert.equal(metadata.requestId, 'test-openai-request');

    const longPromptResponse = await worker.fetch(makeRequest({
      ...basePayload,
      prompt: `Change only the selected finish. ${'x'.repeat(32_000)}`,
    }), baseEnv, { waitUntil() {} });
    assert.equal(longPromptResponse.status, 200);
    assert.ok(String(capturedInit.body.get('prompt')).length <= 32_000, 'fully assembled worker prompt must remain within OpenAI limits');
    assert.match(String(capturedInit.body.get('prompt')), /identical crop, dimensions, camera, perspective/i, 'prompt truncation must retain localized coordinate locks');

    const lightingResponse = await worker.fetch(makeRequest({
      ...basePayload,
      operation: 'custom',
      targetLabel: 'selected lighting area',
      prompt: 'Make the selected pool of sunlight warmer and deepen its cast shadow.',
    }), baseEnv, { waitUntil() {} });
    assert.equal(lightingResponse.status, 200);
    assert.match(String(capturedInit.body.get('prompt')), /AUTHORITATIVE USER REQUEST: Make the selected pool of sunlight warmer and deepen its cast shadow/i);
    assert.match(String(capturedInit.body.get('prompt')), /Apply the user-requested edit to selected lighting area exactly/i);

    const recolorResponse = await worker.fetch(makeRequest({
      ...basePayload,
      operation: 'recolor',
      targetLabel: 'seat upholstery on the selected chairs',
      colorHex: '#ff00ff',
      prompt: 'Change the color of the seat upholstery on those chairs to #ff00ff.',
      optimizedPrompt: 'Re-render only the seat upholstery on the selected chairs as realistic magenta upholstery under the existing terminal lighting.',
    }), baseEnv, { waitUntil() {} });
    assert.equal(recolorResponse.status, 200);
    const recolorPrompt = String(capturedInit.body.get('prompt'));
    assert.match(recolorPrompt, /TASK: Re-render only the visible material color/);
    assert.match(recolorPrompt, /seat upholstery on the selected chairs as #ff00ff/i);
    assert.match(recolorPrompt, /same objects, count, geometry, silhouette, position, perspective/i);
    assert.match(recolorPrompt, /PRE-GENERATION VISUAL INTERPRETATION:/i);
    assert.match(recolorPrompt, /transparent part of the mask is editable/i);

    const namedColorRecolorResponse = await worker.fetch(makeRequest({
      ...basePayload,
      operation: 'recolor',
      targetLabel: 'seats on the selected chairs',
      sourceColor: { red: 0, green: 0, blue: 0 },
      targetColor: { red: 255, green: 0, blue: 255 },
      prompt: 'Change the colors of the seats from Black to magenta.',
    }), baseEnv, { waitUntil() {} });
    assert.equal(namedColorRecolorResponse.status, 200);
    const namedColorRecolorPrompt = String(capturedInit.body.get('prompt'));
    assert.doesNotMatch(
      namedColorRecolorPrompt,
      /#[0-9a-f]{6}\b/i,
      'a named color must not be represented to the image model as an exact user-specified hex'
    );
    assert.match(
      namedColorRecolorPrompt,
      /real non-emissive material/i,
      'named-color recolors must request a real non-emissive material response'
    );
    assert.match(
      namedColorRecolorPrompt,
      /natural shading, highlights, reflections, and shadows/i,
      'named-color recolors must request a material-appropriate physical color response'
    );

    const partialVariantResponse = await worker.fetch(makeRequest({
      ...basePayload,
      variants: 2,
    }), baseEnv, { waitUntil() {} });
    assert.equal(partialVariantResponse.status, 502, 'worker must reject partial variant sets');
    assert.match(await partialVariantResponse.text(), /No partial result was applied/i);

    const backgroundEditableAlpha = invertAlpha(selectedAlpha);
    const backgroundExpectedStats = alphaStats(backgroundEditableAlpha);
    const backgroundResponse = await worker.fetch(makeRequest({
      ...basePayload,
      selectionMask: {
        ...basePayload.selectionMask,
        base64: bytesToBase64(buildClientGrayscaleMaskPng(WIDTH, HEIGHT, backgroundEditableAlpha)),
      },
      selectionStats: {
        selectedPixels: backgroundExpectedStats.selected,
        selectedRatio: backgroundExpectedStats.ratio,
      },
      operation: 'custom',
      targetLabel: 'background outside the selected subject',
      prompt: 'Replace only the background outside the selected subject with a quiet studio interior.',
    }), baseEnv, { waitUntil() {} });
    if (backgroundResponse.status !== 200) {
      throw new Error(await backgroundResponse.text());
    }
    const backgroundJson = await backgroundResponse.json();
    assert.equal(backgroundJson.status, 'completed');
    const backgroundForm = capturedInit.body;
    assert.equal(backgroundForm.get('model'), 'gpt-image-2');
    assert.equal(backgroundForm.get('size'), `${WIDTH}x${HEIGHT}`);
    assert.equal(backgroundForm.get('quality'), 'medium');
    assert.equal(backgroundForm.getAll('image[]').length, 1);
    const backgroundMaskBlob = backgroundForm.get('mask');
    assert.ok(backgroundMaskBlob instanceof Blob, 'background edit must forward a normalized mask blob');
    const backgroundForwardedMask = decodePngRgba(new Uint8Array(await backgroundMaskBlob.arrayBuffer()));
    assert.equal(backgroundForwardedMask.data[insidePixel * 4 + 3], 255, 'background edit must protect the originally selected foreground');
    assert.equal(backgroundForwardedMask.data[outsidePixel * 4 + 3], 0, 'background edit must make the outside background editable');
    assert.equal(backgroundJson.versions[0].metadata.selectedPixels, backgroundExpectedStats.selected);
    assert.ok(Math.abs(backgroundJson.versions[0].metadata.selectedRatio - backgroundExpectedStats.ratio) < 1e-12);

    const genericMaskedResponse = await worker.fetch(makeOpenAIImageRequest({
      prompt: 'Make only the masked floor tile warmer.',
      model: 'gpt-image-2',
      images: [{
        base64: bytesToBase64(sourceBytes),
        mimeType: 'image/png',
      }],
      maskImage: {
        base64: bytesToBase64(openAIAlphaMaskBytes),
        mimeType: 'image/png',
      },
      numberOfImages: 1,
      generationConfig: {
        openAI: { size: `${WIDTH}x${HEIGHT}` },
        imageConfig: { aspectRatio: '4:3', imageSize: '1K' },
      },
    }), baseEnv, { waitUntil() {} });
    assert.equal(genericMaskedResponse.status, 200);
    assert.equal(capturedInit.body.get('size'), `${WIDTH}x${HEIGHT}`, 'generic masked OpenAI proxy must preserve source-sized output overrides');
    assert.equal(capturedInit.body.getAll('image[]').length, 1);
    assert.ok(capturedInit.body.get('mask') instanceof Blob, 'generic OpenAI edit proxy must preserve a valid mask');

    const wrongOutputBytes = encodePngRgba(768, 1024, makeSourceRgba(768, 1024));
    globalThis.fetch = async () => new Response(JSON.stringify({
      data: [{ b64_json: bytesToBase64(wrongOutputBytes) }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-request-id': 'wrong-size-output' },
    });
    const mismatchedOutputResponse = await worker.fetch(makeRequest(basePayload), baseEnv, { waitUntil() {} });
    assert.equal(mismatchedOutputResponse.status, 502, 'worker must reject provider output with mismatched dimensions');
    assert.match(await mismatchedOutputResponse.text(), /valid PNG variant|No partial result/i);

    let upstreamCalledForRejectedInput = false;
    globalThis.fetch = async () => {
      upstreamCalledForRejectedInput = true;
      throw new Error('Upstream OpenAI must not be called for invalid masks.');
    };

    const genericJpegMaskedResponse = await worker.fetch(makeOpenAIImageRequest({
      prompt: 'Make only the masked floor tile warmer.',
      model: 'gpt-image-2',
      images: [{
        base64: bytesToBase64(sourceBytes),
        mimeType: 'image/jpeg',
      }],
      maskImage: {
        base64: bytesToBase64(openAIAlphaMaskBytes),
        mimeType: 'image/png',
      },
      numberOfImages: 1,
    }), baseEnv, { waitUntil() {} });
    assert.equal(genericJpegMaskedResponse.status, 400);
    assert.match(await genericJpegMaskedResponse.text(), /PNG image/i);

    const genericNoAlphaMaskResponse = await worker.fetch(makeOpenAIImageRequest({
      prompt: 'Make only the masked floor tile warmer.',
      model: 'gpt-image-2',
      images: [{
        base64: bytesToBase64(sourceBytes),
        mimeType: 'image/png',
      }],
      maskImage: {
        base64: bytesToBase64(buildRgbMaskPng(WIDTH, HEIGHT, selectedAlpha)),
        mimeType: 'image/png',
      },
      numberOfImages: 1,
    }), baseEnv, { waitUntil() {} });
    assert.equal(genericNoAlphaMaskResponse.status, 400);
    assert.match(await genericNoAlphaMaskResponse.text(), /alpha channel/i);

    const emptyAlpha = new Uint8Array(WIDTH * HEIGHT);
    const malformedBase64Response = await worker.fetch(makeRequest({
      ...basePayload,
      sourceImage: { ...basePayload.sourceImage, base64: 'not-valid-base64!' },
    }), baseEnv, { waitUntil() {} });
    assert.equal(malformedBase64Response.status, 400);
    assert.match(await malformedBase64Response.text(), /base64|invalid/i);

    const emptyMaskResponse = await worker.fetch(makeRequest({
      ...basePayload,
      selectionMask: {
        ...basePayload.selectionMask,
        base64: bytesToBase64(buildClientGrayscaleMaskPng(WIDTH, HEIGHT, emptyAlpha)),
      },
    }), baseEnv, { waitUntil() {} });
    assert.equal(emptyMaskResponse.status, 400);
    assert.match(await emptyMaskResponse.text(), /select an area/i);

    const fullAlpha = new Uint8Array(WIDTH * HEIGHT).fill(255);
    const oversizedMaskResponse = await worker.fetch(makeRequest({
      ...basePayload,
      selectionMask: {
        ...basePayload.selectionMask,
        base64: bytesToBase64(buildClientGrayscaleMaskPng(WIDTH, HEIGHT, fullAlpha)),
      },
    }), baseEnv, { waitUntil() {} });
    assert.equal(oversizedMaskResponse.status, 400);
    assert.match(await oversizedMaskResponse.text(), /protected context/i);

    const mismatchedMaskResponse = await worker.fetch(makeRequest({
      ...basePayload,
      selectionMask: {
        ...basePayload.selectionMask,
        base64: bytesToBase64(buildClientGrayscaleMaskPng(768, 1024, new Uint8Array(768 * 1024))),
      },
    }), baseEnv, { waitUntil() {} });
    assert.equal(mismatchedMaskResponse.status, 400);
    assert.match(await mismatchedMaskResponse.text(), /dimensions/i);
    assert.equal(upstreamCalledForRejectedInput, false, 'invalid masks must be rejected before upstream OpenAI fetch');

    const guardToken = await signTestJwt({
      sub: 'image-edit-guard-test',
      email: 'image-edit-guard@example.com',
      exp: Math.floor(Date.now() / 1000) + 300,
    }, jwtSecret);
    const makeGuardRequest = (payload, ip = '198.51.100.20', requestToken = guardToken) => new Request(
      'https://worker.test/api/image-edits',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${requestToken}`,
          Origin: 'http://localhost:3000',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': ip,
        },
        body: JSON.stringify(payload),
      }
    );
    const guardEnv = {
      JWT_SECRET: jwtSecret,
      OPENAI_API_KEY: 'test-openai-key',
      IMAGE_EDIT_RATE_LIMIT_PER_USER: '2',
      IMAGE_EDIT_RATE_LIMIT_PER_IP: '20',
      IMAGE_EDIT_MAX_CONCURRENT_PER_USER: '1',
      IMAGE_EDIT_MAX_CONCURRENT_PER_IP: '2',
    };
    const invalidGuardPayload = { prompt: 'Missing image inputs on purpose.' };
    assert.equal((await worker.fetch(makeGuardRequest(invalidGuardPayload), guardEnv, { waitUntil() {} })).status, 400);
    assert.equal((await worker.fetch(makeGuardRequest(invalidGuardPayload), guardEnv, { waitUntil() {} })).status, 400);
    const rateLimitedResponse = await worker.fetch(makeGuardRequest(invalidGuardPayload), guardEnv, { waitUntil() {} });
    assert.equal(rateLimitedResponse.status, 429, 'image edit route must rate-limit repeated requests per user');
    assert.ok(Number(rateLimitedResponse.headers.get('Retry-After')) >= 1);
    assert.equal((await rateLimitedResponse.json()).code, 'image_edit_rate_limited');

    const concurrencyToken = await signTestJwt({
      sub: 'image-edit-concurrency-test',
      email: 'image-edit-concurrency@example.com',
      exp: Math.floor(Date.now() / 1000) + 300,
    }, jwtSecret);
    let releaseUpstream;
    let markUpstreamStarted;
    const upstreamStarted = new Promise((resolve) => { markUpstreamStarted = resolve; });
    const upstreamGate = new Promise((resolve) => { releaseUpstream = resolve; });
    globalThis.fetch = async () => {
      markUpstreamStarted();
      await upstreamGate;
      return new Response(JSON.stringify({ data: [{ b64_json: bytesToBase64(sourceBytes) }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const concurrencyEnv = {
      ...guardEnv,
      IMAGE_EDIT_RATE_LIMIT_PER_USER: '20',
    };
    const firstConcurrentRequest = worker.fetch(
      makeGuardRequest(basePayload, '198.51.100.21', concurrencyToken),
      concurrencyEnv,
      { waitUntil() {} }
    );
    await upstreamStarted;
    const concurrentResponse = await worker.fetch(
      makeGuardRequest(basePayload, '198.51.100.21', concurrencyToken),
      concurrencyEnv,
      { waitUntil() {} }
    );
    assert.equal(concurrentResponse.status, 429, 'only one image edit may run per user at a time');
    assert.equal((await concurrentResponse.json()).code, 'image_edit_concurrency_limited');
    releaseUpstream();
    assert.equal((await firstConcurrentRequest).status, 200);
    assert.equal(
      (await worker.fetch(
        makeGuardRequest(invalidGuardPayload, '198.51.100.21', concurrencyToken),
        concurrencyEnv,
        { waitUntil() {} }
      )).status,
      400,
      'the concurrency lease must be released in finally'
    );

    const bodyLimitToken = await signTestJwt({
      sub: 'image-edit-body-limit-test',
      email: 'image-edit-body-limit@example.com',
      exp: Math.floor(Date.now() / 1000) + 300,
    }, jwtSecret);
    const oversizedJson = JSON.stringify({ prompt: 'x', padding: 'z'.repeat(4096) });
    const oversizedStreamRequest = new Request('https://worker.test/api/image-edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bodyLimitToken}`,
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '198.51.100.22',
      },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(oversizedJson));
          controller.close();
        },
      }),
      duplex: 'half',
    });
    assert.equal(oversizedStreamRequest.headers.get('Content-Length'), null, 'streaming request must exercise the missing Content-Length path');
    const bodyLimitEnv = {
      ...guardEnv,
      IMAGE_EDIT_RATE_LIMIT_PER_USER: '20',
      IMAGE_EDIT_MAX_BODY_BYTES: '1024',
    };
    const bodyLimitResponse = await worker.fetch(oversizedStreamRequest, bodyLimitEnv, { waitUntil() {} });
    assert.equal(bodyLimitResponse.status, 413, 'streamed image edit bodies must be bounded before JSON parsing');
    assert.equal((await bodyLimitResponse.json()).code, 'image_edit_body_too_large');
    assert.equal(
      (await worker.fetch(
        makeGuardRequest(invalidGuardPayload, '198.51.100.22', bodyLimitToken),
        bodyLimitEnv,
        { waitUntil() {} }
      )).status,
      400,
      'body-limit rejection must also release its concurrency lease'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function assertLocalizedProductionHelpers() {
  const cropSizes = [
    [517, 293],
    [293, 517],
    [1279, 431],
    [431, 1279],
    [1920, 1080],
    [73, 73],
    [4000, 900],
    [900, 4000],
  ];
  cropSizes.forEach(([width, height]) => {
    const request = getOpenAIEditCanvasPlan(width, height);
    assert.ok(request, `expected a legal request plan for ${width}x${height}`);
    assert.equal(request.requestWidth % OPENAI_IMAGE_EDIT_LIMITS.multiple, 0);
    assert.equal(request.requestHeight % OPENAI_IMAGE_EDIT_LIMITS.multiple, 0);
    assert.ok(request.requestWidth * request.requestHeight >= OPENAI_IMAGE_EDIT_LIMITS.minPixels);
    assert.ok(request.requestWidth * request.requestHeight <= OPENAI_IMAGE_EDIT_LIMITS.maxPixels);
    assert.ok(Math.max(request.requestWidth, request.requestHeight) <= OPENAI_IMAGE_EDIT_LIMITS.maxEdge);
    const scaleX = request.contentRect.width / width;
    const scaleY = request.contentRect.height / height;
    assert.ok(
      Math.abs(request.contentRect.width - width * scaleY) <= 1 &&
      Math.abs(request.contentRect.height - height * scaleX) <= 1,
      'integer localized mapping may differ from a uniform scale by at most one request pixel'
    );
    assert.equal(Number.isInteger(request.contentRect.x), true, 'localized content x must avoid half-pixel placement');
    assert.equal(Number.isInteger(request.contentRect.y), true, 'localized content y must avoid half-pixel placement');
    assert.equal(Number.isInteger(request.contentRect.width), true, 'localized content width must avoid fractional resampling bounds');
    assert.equal(Number.isInteger(request.contentRect.height), true, 'localized content height must avoid fractional resampling bounds');
  });

  const sourceWidth = 1921;
  const sourceHeight = 1081;
  const boundsCases = [
    { left: 830, top: 440, right: 1000, bottom: 610 },
    { left: 0, top: 0, right: 42, bottom: 57 },
    { left: 1860, top: 0, right: 1920, bottom: 70 },
    { left: 0, top: 1010, right: 80, bottom: 1080 },
    { left: 1840, top: 1000, right: 1920, bottom: 1080 },
    { left: 640, top: 535, right: 1280, bottom: 542 },
  ];
  boundsCases.forEach((rawBounds, index) => {
    const width = rawBounds.right - rawBounds.left + 1;
    const height = rawBounds.bottom - rawBounds.top + 1;
    const bounds = {
      ...rawBounds,
      width,
      height,
      selectedPixels: width * height,
      weightedSelectedPixels: width * height,
      selectedRatio: width * height / (sourceWidth * sourceHeight),
    };
    const plan = planLocalizedImageEdit({
      sourceWidth,
      sourceHeight,
      selectionBounds: bounds,
      operation: index % 2 === 0 ? 'remove_object' : 'custom',
      featherAmount: 60,
    });
    assert.ok(plan, `expected localized ROI plan for bounds case ${index}`);
    assert.ok(plan.sourceRect.x <= bounds.left);
    assert.ok(plan.sourceRect.y <= bounds.top);
    assert.ok(plan.sourceRect.x + plan.sourceRect.width > bounds.right);
    assert.ok(plan.sourceRect.y + plan.sourceRect.height > bounds.bottom);
    assert.ok(plan.sourceRect.x >= 0 && plan.sourceRect.y >= 0);
    assert.ok(plan.sourceRect.x + plan.sourceRect.width <= sourceWidth);
    assert.ok(plan.sourceRect.y + plan.sourceRect.height <= sourceHeight);
    assert.ok(Math.max(plan.sourceRect.width, plan.sourceRect.height) / Math.min(plan.sourceRect.width, plan.sourceRect.height) <= 3);
  });

  const maskWidth = 96;
  const maskHeight = 80;
  const editable = new Uint8ClampedArray(maskWidth * maskHeight);
  for (let y = 22; y < 58; y += 1) {
    for (let x = 28; x < 70; x += 1) editable[y * maskWidth + x] = 255;
  }
  const bounds = getEditableAlphaBounds(editable, maskWidth, maskHeight);
  assert.deepEqual(
    { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
    { left: 28, top: 22, right: 69, bottom: 57 }
  );
  const dilated = dilateEditableAlpha(editable, maskWidth, maskHeight, 4);
  assert.equal(dilated[18 * maskWidth + 24], 255, 'provider dilation must expand editable context');
  assert.equal(dilated[17 * maskWidth + 23], 0, 'provider dilation must remain bounded');
  const noFeatherPlan = planLocalizedImageEdit({
    sourceWidth: 640,
    sourceHeight: 480,
    selectionBounds: {
      left: 220,
      top: 160,
      right: 419,
      bottom: 319,
      width: 200,
      height: 160,
      selectedPixels: 32_000,
      weightedSelectedPixels: 32_000,
    },
    operation: 'remove_object',
    featherAmount: 0,
  });
  assert.ok(noFeatherPlan.compositeFeather >= 4, 'disabled creative feathering must still retain a technical multi-pixel seam band');

  const defaultSeamMatte = buildInwardFeatherMatte(editable, maskWidth, maskHeight, noFeatherPlan.compositeFeather);
  const defaultBoundary = defaultSeamMatte[40 * maskWidth + 28];
  const defaultNearInterior = defaultSeamMatte[40 * maskWidth + 29];
  const defaultDeepInterior = defaultSeamMatte[40 * maskWidth + 36];
  assert.ok(defaultBoundary < 64, 'the technical seam must strongly suppress the first selected boundary pixel');
  assert.ok(defaultNearInterior > defaultBoundary && defaultNearInterior < 255, 'the technical seam must transition across multiple inward pixels');
  assert.equal(defaultDeepInterior, 255, 'the technical seam must retain a full generated core away from the boundary');
  assert.equal(defaultSeamMatte[40 * maskWidth + 27], 0, 'the automatic seam must never write outside the original user selection');

  const thinMaskWidth = 128;
  const thinMaskHeight = 128;
  const thinMask = new Uint8ClampedArray(thinMaskWidth * thinMaskHeight);
  for (let coordinate = 14; coordinate < 108; coordinate += 1) {
    for (let offset = -2; offset <= 2; offset += 1) {
      const x = coordinate + offset;
      const y = coordinate;
      thinMask[y * thinMaskWidth + x] = 255;
    }
  }
  for (let y = 18; y < 22; y += 1) {
    for (let x = 102; x < 106; x += 1) thinMask[y * thinMaskWidth + x] = 255;
  }
  const thinMatte = buildInwardFeatherMatte(thinMask, thinMaskWidth, thinMaskHeight, 10);
  let diagonalCore = 0;
  let smallComponentCore = 0;
  for (let y = 0; y < thinMaskHeight; y += 1) {
    for (let x = 0; x < thinMaskWidth; x += 1) {
      const index = y * thinMaskWidth + x;
      assert.ok(thinMatte[index] <= thinMask[index], 'component-aware feathering must preserve the original hard-lock mask');
      if (x >= 12 && x < 110 && y >= 14 && y < 108) diagonalCore = Math.max(diagonalCore, thinMatte[index]);
      if (x >= 102 && x < 106 && y >= 18 && y < 22) smallComponentCore = Math.max(smallComponentCore, thinMatte[index]);
    }
  }
  assert.equal(diagonalCore, 255, 'a long thin diagonal selection must retain a full-strength generated ridge');
  assert.equal(smallComponentCore, 255, 'each disconnected thin selection component must retain a full-strength generated core');

  const sourcePixels = new Uint8ClampedArray(maskWidth * maskHeight * 4);
  const generatedPixels = new Uint8ClampedArray(sourcePixels.length);
  for (let index = 0, pixel = 0; index < editable.length; index += 1, pixel += 4) {
    const x = index % maskWidth;
    const y = Math.floor(index / maskWidth);
    sourcePixels[pixel] = (x * 3 + y) % 256;
    sourcePixels[pixel + 1] = (x + y * 4) % 256;
    sourcePixels[pixel + 2] = (x * 2 + y * 2) % 256;
    sourcePixels[pixel + 3] = 255;
    // Simulate provider drift everywhere plus a deliberately subtle valid edit.
    generatedPixels[pixel] = clampByte(sourcePixels[pixel] + (editable[index] ? 12 : 21));
    generatedPixels[pixel + 1] = clampByte(sourcePixels[pixel + 1] + (editable[index] ? 9 : 18));
    generatedPixels[pixel + 2] = clampByte(sourcePixels[pixel + 2] + (editable[index] ? 7 : 16));
    generatedPixels[pixel + 3] = 255;
  }
  const matte = buildInwardFeatherMatte(editable, maskWidth, maskHeight, 5);
  const localized = compositeLocalizedPixels({
    sourcePixels,
    generatedPixels,
    editableAlpha: editable,
    width: maskWidth,
    height: maskHeight,
    featherRadius: 5,
  });
  let outsideChanges = 0;
  for (let index = 0, pixel = 0; index < editable.length; index += 1, pixel += 4) {
    assert.ok(matte[index] <= editable[index], 'the final matte must never exceed user-selected coverage');
    if (editable[index] === 0) {
      assert.equal(matte[index], 0, 'the final matte must never expand into protected pixels');
      if (
        localized.pixels[pixel] !== sourcePixels[pixel] ||
        localized.pixels[pixel + 1] !== sourcePixels[pixel + 1] ||
        localized.pixels[pixel + 2] !== sourcePixels[pixel + 2] ||
        localized.pixels[pixel + 3] !== sourcePixels[pixel + 3]
      ) outsideChanges += 1;
    }
  }
  assert.equal(outsideChanges, 0, 'production localized composite must keep every protected pixel exact');
  const core = (40 * maskWidth + 48) * 4;
  assert.ok(localized.pixels[core] > sourcePixels[core], 'sub-threshold subtle edits must survive in the selected core');

  const registrationWidth = 256;
  const registrationHeight = 192;
  const registrationSource = new Uint8ClampedArray(registrationWidth * registrationHeight * 4);
  const registrationGenerated = new Uint8ClampedArray(registrationSource.length);
  const registrationMask = new Uint8ClampedArray(registrationWidth * registrationHeight);
  for (let y = 0; y < registrationHeight; y += 1) {
    for (let x = 0; x < registrationWidth; x += 1) {
      const pixel = (y * registrationWidth + x) * 4;
      const checker = ((Math.floor(x / 7) + Math.floor(y / 9)) % 2) * 120;
      registrationSource[pixel] = (x * 5 + checker) % 256;
      registrationSource[pixel + 1] = (y * 7 + checker) % 256;
      registrationSource[pixel + 2] = (x * 3 + y * 2 + checker) % 256;
      registrationSource[pixel + 3] = 255;
      if (x > 92 && x < 164 && y > 64 && y < 128) registrationMask[y * registrationWidth + x] = 255;
    }
  }
  const expectedDx = 3;
  const expectedDy = -2;
  for (let y = 0; y < registrationHeight; y += 1) {
    for (let x = 0; x < registrationWidth; x += 1) {
      const sourceX = Math.max(0, Math.min(registrationWidth - 1, x - expectedDx));
      const sourceY = Math.max(0, Math.min(registrationHeight - 1, y - expectedDy));
      const sourcePixel = (sourceY * registrationWidth + sourceX) * 4;
      const targetPixel = (y * registrationWidth + x) * 4;
      registrationGenerated.set(registrationSource.subarray(sourcePixel, sourcePixel + 4), targetPixel);
    }
  }
  const registration = estimateProtectedTranslation(
    registrationSource,
    registrationGenerated,
    registrationMask,
    registrationWidth,
    registrationHeight,
    6
  );
  assert.deepEqual(
    { dx: registration.dx, dy: registration.dy },
    { dx: expectedDx, dy: expectedDy },
    'protected-context registration must recover a known provider translation'
  );

  const makeShifted = (source, width, height, dx, dy) => {
    const shifted = new Uint8ClampedArray(source.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sourceX = Math.max(0, Math.min(width - 1, x - dx));
        const sourceY = Math.max(0, Math.min(height - 1, y - dy));
        const sourcePixel = (sourceY * width + sourceX) * 4;
        shifted.set(source.subarray(sourcePixel, sourcePixel + 4), (y * width + x) * 4);
      }
    }
    return shifted;
  };

  const periodicWidth = 240;
  const periodicHeight = 180;
  const periodicMask = new Uint8ClampedArray(periodicWidth * periodicHeight);
  for (let y = 65; y < 115; y += 1) {
    for (let x = 90; x < 150; x += 1) periodicMask[y * periodicWidth + x] = 255;
  }
  const verticalStripes = new Uint8ClampedArray(periodicWidth * periodicHeight * 4);
  const checkerGrid = new Uint8ClampedArray(verticalStripes.length);
  for (let y = 0; y < periodicHeight; y += 1) {
    for (let x = 0; x < periodicWidth; x += 1) {
      const pixel = (y * periodicWidth + x) * 4;
      const stripe = Math.floor(x / 6) % 2 ? 220 : 35;
      const checkerValue = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 225 : 30;
      verticalStripes.set([stripe, stripe, stripe, 255], pixel);
      checkerGrid.set([checkerValue, checkerValue, checkerValue, 255], pixel);
    }
  }
  const stripeRegistration = estimateProtectedTranslation(
    verticalStripes,
    makeShifted(verticalStripes, periodicWidth, periodicHeight, 1, 0),
    periodicMask,
    periodicWidth,
    periodicHeight,
    6
  );
  assert.deepEqual({ dx: stripeRegistration.dx, dy: stripeRegistration.dy }, { dx: 0, dy: 0 }, 'one-dimensional repeating architecture must not produce an arbitrary shift');
  const checkerRegistration = estimateProtectedTranslation(
    checkerGrid,
    makeShifted(checkerGrid, periodicWidth, periodicHeight, 3, 2),
    periodicMask,
    periodicWidth,
    periodicHeight,
    6
  );
  assert.deepEqual({ dx: checkerRegistration.dx, dy: checkerRegistration.dy }, { dx: 0, dy: 0 }, 'repeating two-dimensional grids must be rejected as ambiguous');

  const providerEditable = dilateEditableAlpha(registrationMask, registrationWidth, registrationHeight, 12);
  const registrationExclusion = dilateEditableAlpha(providerEditable, registrationWidth, registrationHeight, 4);
  const annulusChanged = new Uint8ClampedArray(registrationSource);
  for (let index = 0, pixel = 0; index < providerEditable.length; index += 1, pixel += 4) {
    if (providerEditable[index] > 4 && registrationMask[index] <= 4) {
      annulusChanged[pixel] = clampByte(annulusChanged[pixel] + 36);
      annulusChanged[pixel + 1] = clampByte(annulusChanged[pixel + 1] - 24);
      annulusChanged[pixel + 2] = clampByte(annulusChanged[pixel + 2] + 18);
    }
  }
  const annulusRegistration = estimateProtectedTranslation(
    registrationSource,
    annulusChanged,
    registrationExclusion,
    registrationWidth,
    registrationHeight,
    6
  );
  assert.deepEqual({ dx: annulusRegistration.dx, dy: annulusRegistration.dy }, { dx: 0, dy: 0 }, 'intentional provider seam changes must not create false registration');
  const annulusColorOffset = estimateProtectedColorOffset(
    registrationSource,
    annulusChanged,
    registrationExclusion,
    registrationWidth,
    registrationHeight
  );
  assert.ok(Math.abs(annulusColorOffset.red) < 0.1 && Math.abs(annulusColorOffset.green) < 0.1 && Math.abs(annulusColorOffset.blue) < 0.1, 'provider-editable seam pixels must not bias color correction');

  const anchoredEditGenerated = makeShifted(
    registrationSource,
    registrationWidth,
    registrationHeight,
    expectedDx,
    expectedDy
  );
  for (let index = 0, pixel = 0; index < registrationMask.length; index += 1, pixel += 4) {
    if (registrationMask[index] <= 4) continue;
    anchoredEditGenerated[pixel] = clampByte(registrationSource[pixel] + 8);
    anchoredEditGenerated[pixel + 1] = clampByte(registrationSource[pixel + 1] + 8);
    anchoredEditGenerated[pixel + 2] = clampByte(registrationSource[pixel + 2] + 8);
  }
  const anchoredContextRegistration = estimateProtectedTranslation(
    registrationSource,
    anchoredEditGenerated,
    registrationExclusion,
    registrationWidth,
    registrationHeight,
    6
  );
  assert.deepEqual(
    { dx: anchoredContextRegistration.dx, dy: anchoredContextRegistration.dy },
    { dx: expectedDx, dy: expectedDy },
    'the adversarial fixture must contain a real protected-context translation'
  );
  const anchoredGate = evaluateEditableTranslationGate({
    sourcePixels: registrationSource,
    generatedPixels: anchoredEditGenerated,
    editableAlpha: registrationMask,
    width: registrationWidth,
    height: registrationHeight,
    dx: anchoredContextRegistration.dx,
    dy: anchoredContextRegistration.dy,
  });
  assert.equal(anchoredGate.accepted, false, 'a fixed-mask edit that is already anchored must not be moved with drifting protected context');
  assert.equal(anchoredGate.reason, 'edit_already_anchored');

  const editedBeforeTranslation = new Uint8ClampedArray(registrationSource);
  for (let index = 0, pixel = 0; index < registrationMask.length; index += 1, pixel += 4) {
    if (registrationMask[index] <= 4) continue;
    editedBeforeTranslation[pixel] = clampByte(registrationSource[pixel] + 8);
    editedBeforeTranslation[pixel + 1] = clampByte(registrationSource[pixel + 1] + 8);
    editedBeforeTranslation[pixel + 2] = clampByte(registrationSource[pixel + 2] + 8);
  }
  const globallyShiftedEdit = makeShifted(
    editedBeforeTranslation,
    registrationWidth,
    registrationHeight,
    expectedDx,
    expectedDy
  );
  const globallyShiftedGate = evaluateEditableTranslationGate({
    sourcePixels: registrationSource,
    generatedPixels: globallyShiftedEdit,
    editableAlpha: registrationMask,
    width: registrationWidth,
    height: registrationHeight,
    dx: expectedDx,
    dy: expectedDy,
  });
  assert.equal(globallyShiftedGate.accepted, true, 'a generated edit that shares the protected global translation should remain eligible for registration');

  const translatedForComposite = applyGeneratedTranslation(
    globallyShiftedEdit,
    registrationWidth,
    registrationHeight,
    expectedDx,
    expectedDy
  );
  const translatedEdgePixel = 0;
  assert.deepEqual(
    [...translatedForComposite.subarray(translatedEdgePixel, translatedEdgePixel + 4)],
    [...globallyShiftedEdit.subarray(translatedEdgePixel, translatedEdgePixel + 4)],
    'registration must retain original generated pixels at exposed crop edges'
  );
  const pipelineResult = runLocalizedImageCompositePipeline({
    sourcePixels: registrationSource,
    generatedPixels: globallyShiftedEdit,
    editableAlpha: registrationMask,
    registrationExclusionAlpha: registrationExclusion,
    width: registrationWidth,
    height: registrationHeight,
    featherRadius: 4,
    maxShift: 6,
  });
  assert.deepEqual(
    pipelineResult.appliedTranslation,
    { dx: expectedDx, dy: expectedDy },
    'the worker pipeline must apply a translation only when registration and editable-content gating agree'
  );
  const expectedPipelineOffset = estimateProtectedColorOffset(
    registrationSource,
    translatedForComposite,
    registrationExclusion,
    registrationWidth,
    registrationHeight
  );
  const expectedPipelineComposite = compositeLocalizedPixels({
    sourcePixels: registrationSource,
    generatedPixels: translatedForComposite,
    editableAlpha: registrationMask,
    width: registrationWidth,
    height: registrationHeight,
    featherRadius: 4,
    colorOffset: expectedPipelineOffset,
  });
  assert.deepEqual(
    pipelineResult.pixels,
    expectedPipelineComposite.pixels,
    'worker and synchronous fallback must share the exact deterministic composite implementation'
  );
  assert.deepEqual(pipelineResult.colorOffset, expectedPipelineOffset, 'worker metadata must retain the robust color correction result');
  for (let index = 0, pixel = 0; index < registrationMask.length; index += 1, pixel += 4) {
    if (registrationMask[index] > 0) continue;
    assert.deepEqual(
      [...pipelineResult.pixels.subarray(pixel, pixel + 4)],
      [...registrationSource.subarray(pixel, pixel + 4)],
      'the off-thread composite must perform zero writes outside editableAlpha'
    );
  }

  const robustOffsetWidth = 100;
  const robustOffsetHeight = 100;
  const robustOffsetSource = new Uint8ClampedArray(robustOffsetWidth * robustOffsetHeight * 4);
  const robustOffsetGenerated = new Uint8ClampedArray(robustOffsetSource.length);
  const robustOffsetMask = new Uint8ClampedArray(robustOffsetWidth * robustOffsetHeight);
  for (let y = 0; y < robustOffsetHeight; y += 1) {
    for (let x = 0; x < robustOffsetWidth; x += 1) {
      const pixel = (y * robustOffsetWidth + x) * 4;
      robustOffsetSource.set([100, 100, 100, 255], pixel);
      const value = x < 40 ? 130 : 100;
      robustOffsetGenerated.set([value, value, value, 255], pixel);
    }
  }
  const contaminatedOffset = estimateProtectedColorOffset(
    robustOffsetSource,
    robustOffsetGenerated,
    robustOffsetMask,
    robustOffsetWidth,
    robustOffsetHeight
  );
  assert.ok(
    Math.abs(contaminatedOffset.red) < 0.1 &&
    Math.abs(contaminatedOffset.green) < 0.1 &&
    Math.abs(contaminatedOffset.blue) < 0.1,
    'a minority of moderately changed protected pixels must not tint the seam correction'
  );
  for (let y = 0; y < robustOffsetHeight; y += 1) {
    for (let x = 0; x < robustOffsetWidth; x += 1) {
      const pixel = (y * robustOffsetWidth + x) * 4;
      const value = x < 20 ? 144 : 114;
      robustOffsetGenerated.set([value, value, value, 255], pixel);
    }
  }
  const globalOffsetWithOutliers = estimateProtectedColorOffset(
    robustOffsetSource,
    robustOffsetGenerated,
    robustOffsetMask,
    robustOffsetWidth,
    robustOffsetHeight
  );
  assert.ok(Math.abs(globalOffsetWithOutliers.red + 14) < 0.1, 'robust color correction must retain the dominant global offset');
  assert.ok(Math.abs(globalOffsetWithOutliers.green + 14) < 0.1);
  assert.ok(Math.abs(globalOffsetWithOutliers.blue + 14) < 0.1);
}

function assertOperationAwareRecolorGuard() {
  const width = 96;
  const height = 72;
  const source = new Uint8ClampedArray(width * height * 4);
  const successfulGenerated = new Uint8ClampedArray(source.length);
  const deletedTargetGenerated = new Uint8ClampedArray(source.length);
  const roi = new Uint8ClampedArray(width * height);
  const registrationExclusion = new Uint8ClampedArray(width * height);
  const isRoi = (x, y) => x >= 12 && x < 84 && y >= 10 && y < 64;
  const isChair = (x, y) => x >= 28 && x < 68 && y >= 26 && y < 52;
  const luminance = (pixels, offset) =>
    pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const pixel = index * 4;
      const background = 154 + ((x * 3 + y * 5) % 11) - 5;
      const chairShade = 34 + ((x + y) % 13);
      const chairSeam = isChair(x, y) && ((x - 28) % 10 === 0 || (y - 26) % 12 === 0);
      const sourceValue = chairSeam ? chairShade + 22 : chairShade;
      source[pixel] = isChair(x, y) ? sourceValue : background + 6;
      source[pixel + 1] = isChair(x, y) ? sourceValue : background;
      source[pixel + 2] = isChair(x, y) ? sourceValue + 3 : background - 5;
      source[pixel + 3] = 255;
      if (isRoi(x, y)) roi[index] = 255;

      successfulGenerated[pixel] = source[pixel];
      successfulGenerated[pixel + 1] = source[pixel + 1];
      successfulGenerated[pixel + 2] = source[pixel + 2];
      successfulGenerated[pixel + 3] = 255;
      if (isChair(x, y)) {
        successfulGenerated[pixel] = clampByte(sourceValue + 112);
        successfulGenerated[pixel + 1] = clampByte(sourceValue - 22);
        successfulGenerated[pixel + 2] = clampByte(sourceValue + 104);
      }

      deletedTargetGenerated[pixel] = source[pixel];
      deletedTargetGenerated[pixel + 1] = source[pixel + 1];
      deletedTargetGenerated[pixel + 2] = source[pixel + 2];
      deletedTargetGenerated[pixel + 3] = 255;
      if (isChair(x, y)) {
        // Adversarial provider fixture matching the reported failure: the chair
        // is reconstructed as surrounding floor instead of being recolored.
        deletedTargetGenerated[pixel] = background + 6;
        deletedTargetGenerated[pixel + 1] = background;
        deletedTargetGenerated[pixel + 2] = background - 5;
      }
    }
  }

  const targetColor = { red: 255, green: 0, blue: 255 };
  const successful = runLocalizedImageCompositePipeline({
    sourcePixels: source,
    generatedPixels: successfulGenerated,
    editableAlpha: roi,
    registrationExclusionAlpha: registrationExclusion,
    width,
    height,
    featherRadius: 8,
    maxShift: 0,
    operation: 'recolor',
    compositeMode: 'preserve-luminance',
    targetColor,
  });
  assert.equal(successful.quality.accepted, true, 'a semantic magenta recolor must pass the operation guard');
  assert.ok(successful.quality.semanticCoverage > 0.1, 'the generated color delta must refine the broad ROI to the chair target');
  assert.ok(successful.quality.meanLuminanceError < 3.5, 'recolor must retain source luminance and texture structure');

  let outsideChanges = 0;
  let enclosedBackgroundChanges = 0;
  let chairLuminanceError = 0;
  let chairPixels = 0;
  let chairMagentaGain = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const pixel = index * 4;
      const changed = Math.max(
        Math.abs(successful.pixels[pixel] - source[pixel]),
        Math.abs(successful.pixels[pixel + 1] - source[pixel + 1]),
        Math.abs(successful.pixels[pixel + 2] - source[pixel + 2])
      );
      if (!isRoi(x, y) && changed !== 0) outsideChanges += 1;
      if (isRoi(x, y) && !isChair(x, y) && changed > 1) enclosedBackgroundChanges += 1;
      if (isChair(x, y)) {
        chairPixels += 1;
        chairLuminanceError += Math.abs(luminance(successful.pixels, pixel) - luminance(source, pixel));
        chairMagentaGain += (
          successful.pixels[pixel] + successful.pixels[pixel + 2] - successful.pixels[pixel + 1] * 2
        ) - (
          source[pixel] + source[pixel + 2] - source[pixel + 1] * 2
        );
      }
    }
  }
  assert.equal(outsideChanges, 0, 'recolor must keep every protected pixel byte-exact');
  assert.equal(enclosedBackgroundChanges, 0, 'semantic recolor must preserve unrelated floor/background inside a broad ROI');
  assert.ok(chairLuminanceError / chairPixels < 3.5, 'chair seams and shading must survive the recolor');
  assert.ok(chairMagentaGain / chairPixels > 80, 'the requested magenta chroma must be visibly applied');

  const deleted = runLocalizedImageCompositePipeline({
    sourcePixels: source,
    generatedPixels: deletedTargetGenerated,
    editableAlpha: roi,
    registrationExclusionAlpha: registrationExclusion,
    width,
    height,
    featherRadius: 8,
    maxShift: 0,
    operation: 'recolor',
    compositeMode: 'preserve-luminance',
    targetColor,
  });
  assert.equal(deleted.quality.accepted, false, 'a provider result that deletes chairs instead of recoloring them must fail closed');
  assert.equal(deleted.quality.reason, 'requested_color_missing');
  for (let index = 0; index < source.length; index += 1) {
    assert.equal(deleted.pixels[index], source[index], 'a rejected deletion fixture must never alter the source canvas');
  }

  const runAchromaticRecolor = (targetValue, label) => {
    const generated = new Uint8ClampedArray(source);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!isChair(x, y)) continue;
        const pixel = (y * width + x) * 4;
        const sourceTone = luminance(source, pixel);
        const retainedDetail = (sourceTone - 42) * 0.55;
        const tone = clampByte(targetValue + retainedDetail);
        generated[pixel] = tone;
        generated[pixel + 1] = tone;
        generated[pixel + 2] = tone;
      }
    }
    const result = runLocalizedImageCompositePipeline({
      sourcePixels: source,
      generatedPixels: generated,
      editableAlpha: roi,
      registrationExclusionAlpha: registrationExclusion,
      width,
      height,
      featherRadius: 8,
      maxShift: 0,
      operation: 'recolor',
      compositeMode: 'preserve-luminance',
      targetColor: { red: targetValue, green: targetValue, blue: targetValue },
    });
    assert.equal(result.quality.accepted, true, `${label} recolor should pass: ${JSON.stringify(result.quality)}`);
    assert.ok(result.quality.edgeRetention > 0.3, `${label} recolor must retain source edges`);
    let sourceMean = 0;
    let outputMean = 0;
    let samples = 0;
    for (let y = 30; y < 48; y += 1) {
      for (let x = 32; x < 64; x += 1) {
        const pixel = (y * width + x) * 4;
        sourceMean += luminance(source, pixel);
        outputMean += luminance(result.pixels, pixel);
        samples += 1;
      }
    }
    return { sourceMean: sourceMean / samples, outputMean: outputMean / samples };
  };
  const black = runAchromaticRecolor(8, 'black');
  assert.ok(black.outputMean < black.sourceMean - 18, 'black recolor must visibly darken the target');
  const white = runAchromaticRecolor(242, 'white');
  assert.ok(white.outputMean > white.sourceMean + 80, 'white recolor must visibly lighten the target');

  const speckWidth = 180;
  const speckHeight = 110;
  const speckSource = new Uint8ClampedArray(speckWidth * speckHeight * 4);
  const speckGenerated = new Uint8ClampedArray(speckSource.length);
  const speckRoi = new Uint8ClampedArray(speckWidth * speckHeight);
  for (let y = 0; y < speckHeight; y += 1) {
    for (let x = 0; x < speckWidth; x += 1) {
      const index = y * speckWidth + x;
      const pixel = index * 4;
      const value = 80 + ((x + y) % 19);
      speckSource.set([value, value, value, 255], pixel);
      speckGenerated.set([value, value, value, 255], pixel);
      if (x >= 10 && x < 170 && y >= 10 && y < 100) speckRoi[index] = 255;
      if (x >= 80 && x < 86 && y >= 52 && y < 58) {
        speckGenerated.set([240, 4, 235, 255], pixel);
      }
    }
  }
  const speck = runLocalizedImageCompositePipeline({
    sourcePixels: speckSource,
    generatedPixels: speckGenerated,
    editableAlpha: speckRoi,
    registrationExclusionAlpha: new Uint8ClampedArray(speckRoi.length),
    width: speckWidth,
    height: speckHeight,
    featherRadius: 8,
    maxShift: 0,
    operation: 'recolor',
    compositeMode: 'preserve-luminance',
    targetColor,
  });
  assert.equal(speck.quality.accepted, false, 'a tiny requested-color speck must not satisfy a broad target recolor');
  assert.equal(speck.quality.reason, 'requested_color_missing');

  const materialGenerated = new Uint8ClampedArray(source);
  for (let y = 10; y < 64; y += 1) {
    for (let x = 12; x < 84; x += 1) {
      materialGenerated.set([35, 188, 202, 255], (y * width + x) * 4);
    }
  }
  const flatMaterial = runLocalizedImageCompositePipeline({
    sourcePixels: source,
    generatedPixels: materialGenerated,
    editableAlpha: roi,
    registrationExclusionAlpha: registrationExclusion,
    width,
    height,
    featherRadius: 8,
    maxShift: 0,
    operation: 'replace_material',
    compositeMode: 'preserve-structure',
  });
  assert.equal(flatMaterial.quality.accepted, false, 'a flat material redraw that erases source edges must fail closed');
  assert.match(flatMaterial.quality.reason, /structure/);

  const structuralNoop = runLocalizedImageCompositePipeline({
    sourcePixels: source,
    generatedPixels: new Uint8ClampedArray(source),
    editableAlpha: roi,
    registrationExclusionAlpha: registrationExclusion,
    width,
    height,
    featherRadius: 8,
    maxShift: 0,
    operation: 'remove_object',
    compositeMode: 'generated-pixels',
  });
  assert.equal(structuralNoop.quality.accepted, false, 'a no-op remove result must not be reported as success');
  assert.equal(structuralNoop.quality.reason, 'requested_structural_change_missing');

  const roundTripped = new Uint8ClampedArray(source);
  for (let y = 1; y + 1 < height; y += 1) {
    for (let x = 1; x + 1 < width; x += 1) {
      const pixel = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        roundTripped[pixel + channel] = clampByte((
          source[pixel + channel] * 2 +
          source[pixel - 4 + channel] +
          source[pixel + 4 + channel]
        ) / 4);
      }
    }
  }
  const resamplingNoop = runLocalizedImageCompositePipeline({
    sourcePixels: source,
    comparisonPixels: roundTripped,
    generatedPixels: new Uint8ClampedArray(roundTripped),
    editableAlpha: roi,
    registrationExclusionAlpha: registrationExclusion,
    width,
    height,
    featherRadius: 8,
    maxShift: 0,
    operation: 'replace_material',
    compositeMode: 'preserve-structure',
  });
  assert.equal(resamplingNoop.quality.accepted, false, 'round-trip resampling alone must not count as a semantic material edit');
  assert.equal(resamplingNoop.quality.reason, 'no_semantic_material_change');
}

function assertDeterministicSourcePixelRecolorPreservesSceneStructure() {
  const width = 112;
  const height = 80;
  const source = new Uint8ClampedArray(width * height * 4);
  const roi = new Uint8ClampedArray(width * height);
  const upholstery = new Uint8ClampedArray(width * height);
  const floor = new Uint8ClampedArray(width * height).fill(255);
  const metalFrame = new Uint8ClampedArray(width * height);
  const pixelOffset = (x, y) => (y * width + x) * 4;
  const setPixel = (x, y, red, green, blue) => {
    const pixel = pixelOffset(x, y);
    source[pixel] = red;
    source[pixel + 1] = green;
    source[pixel + 2] = blue;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const pixel = index * 4;
      const texture = ((x * 3 + y * 5) % 9) - 4;
      source[pixel] = 199 + texture;
      source[pixel + 1] = 181 + texture;
      source[pixel + 2] = 147 + texture;
      source[pixel + 3] = 160 + ((x * 7 + y * 11) % 96);
      if (x >= 10 && x < 102 && y >= 8 && y < 72) roi[index] = 255;
    }
  }

  const paintUpholstery = (left, top, right, bottom, seamX) => {
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const index = y * width + x;
        const highlight = x === seamX || y === bottom - 2;
        const value = highlight ? 62 : 24 + ((x + y) % 7);
        setPixel(x, y, value, value + 1, value + 4);
        upholstery[index] = 255;
        floor[index] = 0;
      }
    }
  };
  paintUpholstery(25, 20, 46, 43, 34);
  paintUpholstery(24, 43, 48, 53, 34);
  paintUpholstery(54, 20, 75, 43, 63);
  paintUpholstery(53, 43, 77, 53, 63);

  const paintMetal = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const index = y * width + x;
    const glint = (x + y) % 5 === 0 ? 12 : 0;
    setPixel(x, y, 108 + glint, 113 + glint, 121 + glint);
    upholstery[index] = 0;
    floor[index] = 0;
    metalFrame[index] = 255;
  };
  for (let x = 20; x < 83; x += 1) {
    paintMetal(x, 54);
    paintMetal(x, 55);
  }
  for (const x of [22, 49, 78]) {
    for (let y = 34; y < 55; y += 1) paintMetal(x, y);
  }
  for (let step = 0; step < 14; step += 1) {
    paintMetal(29 - Math.floor(step / 2), 55 + step);
    paintMetal(41 + Math.floor(step / 2), 55 + step);
    paintMetal(58 - Math.floor(step / 2), 55 + step);
    paintMetal(70 + Math.floor(step / 2), 55 + step);
  }

  const result = recolorLocalizedSourcePixels({
    sourcePixels: source,
    editableAlpha: roi,
    width,
    height,
    sourceColor: { red: 0, green: 0, blue: 0 },
    targetColor: { red: 255, green: 0, blue: 255 },
    featherRadius: 5,
  });
  assert.equal(result.quality.accepted, true, `black upholstery should be recolored: ${JSON.stringify(result.quality)}`);

  let upholsteryPixels = 0;
  let changedUpholsteryPixels = 0;
  for (let index = 0, pixel = 0; index < roi.length; index += 1, pixel += 4) {
    const changed = Math.max(
      Math.abs(result.pixels[pixel] - source[pixel]),
      Math.abs(result.pixels[pixel + 1] - source[pixel + 1]),
      Math.abs(result.pixels[pixel + 2] - source[pixel + 2])
    );
    if (upholstery[index]) {
      upholsteryPixels += 1;
      if (changed >= 18) changedUpholsteryPixels += 1;
    }
    if (!roi[index]) {
      assert.deepEqual(
        [...result.pixels.subarray(pixel, pixel + 4)],
        [...source.subarray(pixel, pixel + 4)],
        'deterministic recolor must keep every pixel outside the broad ROI byte-identical'
      );
    }
    if (floor[index]) {
      assert.deepEqual(
        [...result.pixels.subarray(pixel, pixel + 4)],
        [...source.subarray(pixel, pixel + 4)],
        'beige floor pixels enclosed by the broad ROI must remain byte-identical'
      );
    }
    if (metalFrame[index]) {
      assert.deepEqual(
        [...result.pixels.subarray(pixel, pixel + 4)],
        [...source.subarray(pixel, pixel + 4)],
        'thin gray metal chair-frame pixels must not be mistaken for black upholstery'
      );
    }
    assert.equal(result.pixels[pixel + 3], source[pixel + 3], 'recolor must preserve every source alpha byte');
  }
  assert.ok(
    changedUpholsteryPixels / Math.max(upholsteryPixels, 1) > 0.72,
    'the deterministic recolor must visibly change a meaningful majority of black chair pixels'
  );

  const luminance = (pixels, x, y) => {
    const pixel = pixelOffset(x, y);
    return pixels[pixel] * 0.2126 + pixels[pixel + 1] * 0.7152 + pixels[pixel + 2] * 0.0722;
  };
  const samples = {
    floor: [18, 30],
    metal: [22, 40],
    highlight: [34, 30],
    dark: [28, 30],
  };
  const sourceLuminance = Object.fromEntries(
    Object.entries(samples).map(([name, [x, y]]) => [name, luminance(source, x, y)])
  );
  const resultLuminance = Object.fromEntries(
    Object.entries(samples).map(([name, [x, y]]) => [name, luminance(result.pixels, x, y)])
  );
  assert.ok(
    sourceLuminance.floor > sourceLuminance.metal &&
    sourceLuminance.metal > sourceLuminance.highlight &&
    sourceLuminance.highlight > sourceLuminance.dark,
    'the synthetic source must contain strong floor/frame/upholstery luminance ordering'
  );
  assert.ok(
    resultLuminance.floor > resultLuminance.metal &&
    resultLuminance.metal > resultLuminance.highlight &&
    resultLuminance.highlight > resultLuminance.dark,
    'recolor must retain source luminance ordering across scene edges and upholstery detail'
  );
  assert.ok(
    resultLuminance.floor - resultLuminance.dark > (sourceLuminance.floor - sourceLuminance.dark) * 0.72,
    'the strong floor-to-upholstery silhouette edge must remain clearly separated'
  );
  assert.ok(
    resultLuminance.highlight - resultLuminance.dark > (sourceLuminance.highlight - sourceLuminance.dark) * 0.35,
    'the source upholstery highlight/detail edge must remain visible after recoloring'
  );
}

function assertNamedSourceColorContainsBroadRoiRecolor() {
  const width = 96;
  const height = 72;
  const source = new Uint8ClampedArray(width * height * 4);
  const generated = new Uint8ClampedArray(source.length);
  const roi = new Uint8ClampedArray(width * height);
  const isChair = (x, y) => x >= 28 && x < 68 && y >= 26 && y < 52;
  const luminance = (pixels, offset) =>
    pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const pixel = index * 4;
      const chair = isChair(x, y);
      const base = chair
        ? 34 + ((x + y) % 13)
        : 154 + ((x * 3 + y * 5) % 11) - 5;
      source[pixel] = chair ? base : base + 6;
      source[pixel + 1] = base;
      source[pixel + 2] = chair ? base + 3 : base - 5;
      source[pixel + 3] = 255;
      generated.set(source.subarray(pixel, pixel + 4), pixel);
      if (x >= 12 && x < 84 && y >= 10 && y < 64) roi[index] = 255;
    }
  }

  // Reproduce the reported provider failure: a plausible-looking magenta tint
  // retains source luminance but fills a broad axis-aligned rectangle across the
  // chairs and the unrelated floor/background enclosed by the user's ROI.
  for (let y = 18; y < 60; y += 1) {
    for (let x = 20; x < 78; x += 1) {
      const pixel = (y * width + x) * 4;
      const sourceLuminance = luminance(source, pixel);
      generated[pixel] = clampByte(sourceLuminance + 62);
      generated[pixel + 1] = clampByte(sourceLuminance - 38);
      generated[pixel + 2] = clampByte(sourceLuminance + 62);
    }
  }

  const result = runLocalizedImageCompositePipeline({
    sourcePixels: source,
    generatedPixels: generated,
    editableAlpha: roi,
    registrationExclusionAlpha: new Uint8ClampedArray(roi.length),
    width,
    height,
    featherRadius: 8,
    maxShift: 0,
    operation: 'recolor',
    compositeMode: 'preserve-luminance',
    sourceColor: { red: 0, green: 0, blue: 0 },
    targetColor: { red: 255, green: 0, blue: 255 },
  });

  let nonChairPixels = 0;
  let changedNonChairPixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isChair(x, y)) continue;
      nonChairPixels += 1;
      const pixel = (y * width + x) * 4;
      const changed = Math.max(
        Math.abs(result.pixels[pixel] - source[pixel]),
        Math.abs(result.pixels[pixel + 1] - source[pixel + 1]),
        Math.abs(result.pixels[pixel + 2] - source[pixel + 2])
      ) > 5;
      if (changed) changedNonChairPixels += 1;
    }
  }
  const changedNonChairRatio = changedNonChairPixels / Math.max(nonChairPixels, 1);
  assert.ok(
    changedNonChairRatio < 0.01,
    `a black-to-magenta recolor must preserve non-black floor/background inside a broad ROI; changed ${(changedNonChairRatio * 100).toFixed(2)}% (${result.quality.reason})`
  );
}

function assertAiGeneratedPixelsRemainAuthoritative() {
  const width = 160;
  const height = 112;
  const source = new Uint8ClampedArray(width * height * 4);
  const editable = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const pixel = index * 4;
      source[pixel] = 92 + Math.round(x * 0.28);
      source[pixel + 1] = 104 + Math.round(y * 0.22);
      source[pixel + 2] = 118 + ((x + y) % 7);
      source[pixel + 3] = 255;
      if (x >= 28 && x < 132 && y >= 18 && y < 94) editable[index] = 255;
    }
  }
  const registrationExclusion = dilateEditableAlpha(editable, width, height, 8);
  const operations = ['recolor', 'replace_material', 'add_people', 'remove_object', 'custom'];

  for (const operation of operations) {
    const generated = new Uint8ClampedArray(source);
    // Simulate the small global exposure/white-balance drift seen in model
    // output, then place an unmistakably AI-authored render in the edit core.
    for (let pixel = 0; pixel < generated.length; pixel += 4) {
      generated[pixel] = clampByte(generated[pixel] + 6);
      generated[pixel + 1] = clampByte(generated[pixel + 1] - 4);
      generated[pixel + 2] = clampByte(generated[pixel + 2] + 3);
    }
    for (let y = 34; y < 78; y += 1) {
      for (let x = 48; x < 116; x += 1) {
        const pixel = (y * width + x) * 4;
        generated[pixel] = 26 + ((x * 7 + y * 3) % 42);
        generated[pixel + 1] = 76 + ((x + y * 5) % 54);
        generated[pixel + 2] = 174 + ((x * 3 + y) % 68);
      }
    }

    const result = runLocalizedImageCompositePipeline({
      sourcePixels: source,
      generatedPixels: generated,
      editableAlpha: editable,
      registrationExclusionAlpha: registrationExclusion,
      width,
      height,
      featherRadius: 10,
      maxShift: 0,
      operation,
    });
    assert.equal(result.quality.accepted, true, `${operation} AI render should pass the deterministic seam gate`);
    assert.equal(result.quality.compositeMode, 'generated-pixels');

    let coreError = 0;
    let coreSamples = 0;
    for (let y = 42; y < 70; y += 1) {
      for (let x = 58; x < 106; x += 1) {
        const pixel = (y * width + x) * 4;
        coreError += Math.max(
          Math.abs(result.pixels[pixel] - generated[pixel]),
          Math.abs(result.pixels[pixel + 1] - generated[pixel + 1]),
          Math.abs(result.pixels[pixel + 2] - generated[pixel + 2])
        );
        coreSamples += 1;
      }
    }
    assert.ok(coreError / coreSamples <= 1, `${operation} must retain raw AI pixels in the generated core`);

    for (let index = 0, pixel = 0; index < editable.length; index += 1, pixel += 4) {
      if (editable[index]) continue;
      assert.deepEqual(
        [...result.pixels.subarray(pixel, pixel + 4)],
        [...source.subarray(pixel, pixel + 4)],
        `${operation} must keep every protected pixel byte-identical`
      );
    }

    // The inward linear-light blend must meet the source continuously instead
    // of exposing the generated crop as a rectangular stamp.
    for (let y = 24; y < 88; y += 8) {
      const outsidePixel = (y * width + 27) * 4;
      const insidePixel = (y * width + 28) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const outputStep = result.pixels[insidePixel + channel] - result.pixels[outsidePixel + channel];
        const sourceStep = source[insidePixel + channel] - source[outsidePixel + channel];
        assert.ok(Math.abs(outputStep - sourceStep) <= 2, `${operation} must not introduce a left-edge rectangle seam`);
      }
    }
  }

  const noOp = runLocalizedImageCompositePipeline({
    sourcePixels: source,
    generatedPixels: new Uint8ClampedArray(source),
    editableAlpha: editable,
    registrationExclusionAlpha: registrationExclusion,
    width,
    height,
    featherRadius: 10,
    maxShift: 0,
    operation: 'custom',
  });
  assert.equal(noOp.quality.accepted, false, 'a no-op provider result must not be applied as a successful edit');
  assert.equal(noOp.quality.reason, 'no_semantic_edit_change');
}

assertSourceContract();
assertLocalizedOperationClassification();
assertLocalizedProductionHelpers();
assertAiGeneratedPixelsRemainAuthoritative();
assertGptImage2Size(WIDTH, HEIGHT);
const referencePhotoEditSize = assertPreparedEditSizePreservesLegalSource(3024, 1964);
assert.equal(referencePhotoEditSize.width, 3024, 'attached reference photo width should be preserved for GPT Image 2 edits');
assert.equal(referencePhotoEditSize.height, 1968, 'attached reference photo height should round to the nearest legal 16px multiple');
assertPreparedEditSize(768, 1024);
assertPreparedEditSize(1600, 900);
assert.deepEqual(assertPreparedEditSize(3840, 2160), { width: 3840, height: 2160 }, '4K landscape edits are within GPT Image 2 limits');
assert.equal(getPreciseEditSize(4000, 900), null, 'extreme aspect ratios must not be sent to image edit');
await verifyWorkerImageEditRoute();

const source = makeSourceRgba(WIDTH, HEIGHT);
const selectedAlpha = makeSelectedAlpha(WIDTH, HEIGHT);
const maskBytes = buildOpenAISelectionMaskPng(WIDTH, HEIGHT, selectedAlpha);
const decodedMask = decodePngRgba(maskBytes);
const protectedAlpha = rgbaToSelectionAlpha(decodedMask);
const editableAlpha = invertAlpha(protectedAlpha);
const stats = alphaStats(editableAlpha);

assert.equal(decodedMask.width, WIDTH);
assert.equal(decodedMask.height, HEIGHT);
assert.equal(protectedAlpha[SELECT_Y1 * WIDTH + SELECT_X1], 0, 'selected OpenAI mask alpha must be transparent/editable');
assert.equal(protectedAlpha[0], 255, 'unselected OpenAI mask alpha must be opaque/protected');
assert.equal(editableAlpha[SELECT_Y1 * WIDTH + SELECT_X1], 255, 'selected editable alpha must remain selected');
assert.equal(editableAlpha[0], 0, 'unselected editable alpha must remain locked');
assert.equal(stats.selected, (SELECT_X2 - SELECT_X1) * (SELECT_Y2 - SELECT_Y1));
assert.ok(stats.ratio > 0.15 && stats.ratio < 0.16, `unexpected selected ratio ${stats.ratio}`);

const backgroundEditableAlpha = invertAlpha(selectedAlpha);
const backgroundMaskBytes = buildOpenAISelectionMaskPng(WIDTH, HEIGHT, backgroundEditableAlpha);
const backgroundDecodedMask = decodePngRgba(backgroundMaskBytes);
const backgroundProtectedAlpha = rgbaToSelectionAlpha(backgroundDecodedMask);
const backgroundEditableFromMask = invertAlpha(backgroundProtectedAlpha);
const backgroundStats = alphaStats(backgroundEditableFromMask);
assert.equal(backgroundProtectedAlpha[SELECT_Y1 * WIDTH + SELECT_X1], 255, 'background OpenAI mask must protect the originally selected foreground');
assert.equal(backgroundProtectedAlpha[0], 0, 'background OpenAI mask must make the outside original background transparent/editable');
assert.equal(backgroundEditableFromMask[SELECT_Y1 * WIDTH + SELECT_X1], 0, 'background editable alpha must lock the originally selected foreground');
assert.equal(backgroundEditableFromMask[0], 255, 'background editable alpha must edit outside the original selection');
assert.ok(backgroundStats.ratio > 0.84 && backgroundStats.ratio < 0.85, `unexpected background editable ratio ${backgroundStats.ratio}`);

const generatedWithDrift = makeGeneratedRgba(source, editableAlpha, { outsideDrift: true });
const rawDiff = localizedDiffStats(source, generatedWithDrift, editableAlpha);
assert.ok(rawDiff.insideChangedRatio > 0.99, 'raw generated edit should change the selected region');
assert.ok(rawDiff.outsideChangedRatio > 0, 'raw generated drift should be visible to proof-map stats');

const composited = compositeStrict(source, generatedWithDrift, editableAlpha);
const compositedDiff = localizedDiffStats(source, composited, editableAlpha);
assert.ok(compositedDiff.insideChangedRatio > 0.99, 'composited edit should keep the selected change');
assert.equal(compositedDiff.outsideChangedPixels, 0, 'composited edit must preserve unselected pixels exactly');

const outsideIndex = 12 * WIDTH + 12;
const outsidePixel = outsideIndex * 4;
assert.equal(maxDelta(source, composited, outsidePixel), 0, 'outside sample pixel must be preserved');
const insideIndex = (SELECT_Y1 + 10) * WIDTH + SELECT_X1 + 10;
const insidePixel = insideIndex * 4;
assert.ok(maxDelta(source, composited, insidePixel) >= 24, 'inside sample pixel must be edited');

const backgroundGenerated = makeGeneratedRgba(source, backgroundEditableFromMask);
const backgroundComposited = compositeStrict(source, backgroundGenerated, backgroundEditableFromMask);
const backgroundCompositedDiff = localizedDiffStats(source, backgroundComposited, backgroundEditableFromMask);
assert.ok(backgroundCompositedDiff.insideChangedRatio > 0.99, 'background composite should edit the outside background');
assert.equal(maxDelta(source, backgroundComposited, insidePixel), 0, 'background composite must preserve the protected foreground exactly');
assert.ok(maxDelta(source, backgroundComposited, outsidePixel) >= 24, 'background outside sample pixel must be edited');

console.log('Image edit pipeline verification passed.');
console.log(`Mask selected ratio: ${(stats.ratio * 100).toFixed(2)}%`);
console.log(`Background editable ratio: ${(backgroundStats.ratio * 100).toFixed(2)}%`);
console.log(`Raw outside drift ratio caught: ${(rawDiff.outsideChangedRatio * 100).toFixed(4)}%`);
console.log(`Composited outside drift pixels: ${compositedDiff.outsideChangedPixels}`);
