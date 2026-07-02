import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

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
const generationHookSource = readFileSync(new URL('../hooks/useGeneration.ts', import.meta.url), 'utf8');
const apiGatewaySource = readFileSync(new URL('../services/apiGateway.ts', import.meta.url), 'utf8');
const verifierSource = readFileSync(new URL('../services/geminiService.ts', import.meta.url), 'utf8');
const imageCanvasSource = readFileSync(new URL('../components/canvas/ImageCanvas.tsx', import.meta.url), 'utf8');
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

  assert.match(generationHookSource, /const OPENAI_SELECTION_ALPHA_THRESHOLD = 16;/);
  assert.match(generationHookSource, /const selectedAlpha = invert \? 255 - sourceSelectedAlpha : sourceSelectedAlpha;/, 'client must support intentionally inverted editable masks for background edits');
  assert.match(generationHookSource, /pixels\[index \+ 3\] = selectedAlpha;/, 'client mask PNG must carry selection in alpha');
  assert.match(generationHookSource, /const createOpenAIEditableMaskDataUrl = async/, 'client must build a dedicated OpenAI alpha mask instead of reusing the visible selection mask');
  assert.match(generationHookSource, /const protectedAlpha = editOutsideSelection[\s\S]*\? selectedAlpha[\s\S]*: 255 - selectedAlpha;/, 'client OpenAI mask must make selected pixels transparent for normal edits and protected for background edits');
  assert.match(generationHookSource, /state\.mode === 'visual-edit' \? null : generationConfig\?\.imageConfig\?\.aspectRatio/);
  assert.match(generationHookSource, /prepareVerification: createLocalizedVerificationPreparation/);
  assert.match(generationHookSource, /buildLocalizedEditProofMap/);
  const preciseToolsStart = generationHookSource.indexOf('const PRECISE_OPENAI_EDIT_TOOLS');
  const preciseToolsEnd = generationHookSource.indexOf('const PRECISE_OPENAI_SELECTED_RATIO_LIMITS');
  assert.notEqual(preciseToolsStart, -1, 'client must define precise OpenAI edit tools');
  assert.notEqual(preciseToolsEnd, -1, 'client must define precise OpenAI ratio limits');
  const preciseToolsSource = generationHookSource.slice(preciseToolsStart, preciseToolsEnd);
  assert.match(preciseToolsSource, /'people'/, 'people edits should keep the precise OpenAI path');
  assert.match(preciseToolsSource, /'object'/, 'object edits should keep the precise OpenAI path');
  assert.match(preciseToolsSource, /'remove'/, 'remove edits should keep the precise OpenAI path');
  assert.doesNotMatch(preciseToolsSource, /'select'|'material'|'lighting'|'sky'|'background'/, 'broad surface and background edits must not use the precise local-composite path');
  assert.match(generationHookSource, /preparePreciseEditInputs\(\s*sourceImageUrl!,\s*selectedMaskDataUrl,\s*editOutsideSelection\s*\)/, 'precise edit inputs must receive mask orientation');
  assert.match(generationHookSource, /sourceSelectionStats/, 'precise background edits must keep original selection stats for blank-selection guards');
  assert.match(generationHookSource, /compositeVisualEditResult\(sourceImageUrl!, image, selectedMaskDataUrl, editOutsideSelection/, 'precise edits must composite using the active mask orientation');
  assert.match(generationHookSource, /isOpenAIVisualEdit \|\|[\s\S]*!shouldUseSelectionMask/, 'generic GPT Image visual edits must return the provider frame instead of local mask-compositing broad selections');
  assert.match(generationHookSource, /maskPolarity: options\.editOutsideSelection \? 'outside-selection-editable' : 'selected-area-editable'/, 'verification context must carry explicit mask polarity');
  assert.match(generationHookSource, /protectedTargetLabel: editOutsideSelection[\s\S]*originally selected foreground or subject/, 'background verification must label the protected foreground/subject');
  assert.match(generationHookSource, /const prepareGenericOpenAIEditInputs = async/, 'non-precise masked OpenAI fallback must normalize edit inputs before gateway upload');
  assert.match(generationHookSource, /const size = getPreciseEditSize\(width, height\);[\s\S]*renderPngDataUrlAtSize\(sourceDataUrl, size\.width, size\.height/, 'masked OpenAI fallback source PNG must use a legal GPT Image 2 edit size');
  assert.match(generationHookSource, /renderPngDataUrlAtSize\(editableMaskDataUrl, size\.width, size\.height\)/, 'masked OpenAI fallback mask PNG must match the legal source size');
  assert.match(generationHookSource, /sourceImage: editSourceImage/, 'generic edit fallback must send the normalized OpenAI source image');
  assert.match(generationHookSource, /maskImage: editMaskImage \|\| undefined/, 'generic edit fallback must send the normalized OpenAI alpha mask');
  assert.match(generationHookSource, /size: openAISizeOverride/, 'generic masked OpenAI fallback must request source-sized output');
  const visualComposite = extractConstSource(generationHookSource, 'compositeVisualEditResult', 'ensureServiceInitialized');
  assert.match(visualComposite, /const width = source\.naturalWidth \|\| source\.width;/, 'final composite must use original source width');
  assert.match(visualComposite, /const height = source\.naturalHeight \|\| source\.height;/, 'final composite must use original source height');
  assert.match(visualComposite, /editCtx\.drawImage\(generatedImage, 0, 0, width, height\);/, 'rounded OpenAI edit output must be resampled back to the original frame before masking');
  assert.match(apiGatewaySource, /normalizeOpenAISizeOverride/, 'client gateway must accept doc-legal custom GPT Image 2 sizes');
  assert.match(workerSource, /normalizeOpenAISizeValue\(generationConfig\.openAI\?\.size, null\)/, 'worker gateway must honor app-provided custom GPT Image 2 size overrides');

  assert.match(verifierSource, /automatic localized-edit proof map/);
  assert.match(verifierSource, /Mask polarity: the editable region is outside the original user selection/, 'verifier must understand background edit mask polarity');
  assert.match(verifierSource, /originally selected foreground\/subject is protected/, 'verifier must preserve protected foreground for background edits');
  assert.match(verifierSource, /Measured changed pixels in \$\{editableRegionLabel\}/);
  assert.match(verifierSource, /Measured protected-region changed pixels/);
  assert.match(verifierSource, /Fail localized edits when the requested editable target is not changed/);
  assert.match(verifierSource, /const readImageDimensionsFromBase64 = /, 'image data utility must preserve dimensions parsed from data URLs');
  assert.match(verifierSource, /width: readUint32BE\(bytes, 16\),[\s\S]*height: readUint32BE\(bytes, 20\),/, 'PNG data URL dimensions must be parsed without async image loading');
  assert.match(verifierSource, /normalizedMimeType === 'image\/jpeg'/, 'JPEG data URL dimensions must be parsed for uploaded photos');
  assert.match(verifierSource, /const usesOpenAIAlphaMask = request\.imageGenerationModel === 'chatgpt-image-generation-2' && Boolean\(request\.maskImage\)/, 'GPT Image 2 edits must treat the mask as an alpha mask, not an ordinary reference image');
  assert.match(verifierSource, /const maskedEditSizeOverride = openAIMaskImage[\s\S]*isValidOpenAIImageSize\(openAISourceImage\.width, openAISourceImage\.height\)/, 'masked GPT Image 2 edits must derive a source-sized output override when dimensions are legal');
  assert.match(verifierSource, /size: maskedEditSizeOverride/, 'masked GPT Image 2 mask size override must be passed through generationConfig');
  assert.doesNotMatch(verifierSource, /openAIImages\.push\(request\.maskImage\)/, 'GPT Image 2 must not append masks as normal image inputs');
  assert.match(verifierSource, /maskImage: openAIMaskImage/, 'GPT Image 2 must send selection masks through the dedicated mask field');

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
  assert.match(imageCanvasSource, /activeSelectionRef\.current = resolved;[\s\S]*setActiveSelection\(resolved\);/, 'selection ref must update synchronously so fast drags commit on mouseup');
  assert.match(imageCanvasSource, /activeBoundaryRef\.current = resolved;[\s\S]*setActiveBoundary\(resolved\);/, 'boundary ref must update synchronously so fast drags commit on mouseup');
  assert.match(imageCanvasSource, /isSelectingRef\.current = next;[\s\S]*setIsSelecting\(next\);/, 'selection drag state must update synchronously so fast drags reach mousemove and mouseup handlers');
  assert.match(imageCanvasSource, /isBoundarySelectingRef\.current = next;[\s\S]*setIsBoundarySelecting\(next\);/, 'boundary drag state must update synchronously so fast drags reach mousemove and mouseup handlers');
  assert.match(imageCanvasSource, /if \(isSelectingRef\.current\) \{[\s\S]*updateSelectionPath\(e\);/, 'selection movement must use synchronous drag state');
  assert.match(imageCanvasSource, /if \(isSelectTool && isSelectingRef\.current\) \{[\s\S]*finishSelection\(\);/, 'selection mouseup must use synchronous drag state');
  assert.match(imageCanvasSource, /const latestPendingPoint = pendingPointRef\.current;[\s\S]*activeSelectionRef\.current = \{ \.\.\.current, end: latestPendingPoint \};/, 'selection mouseup must flush the final pending point before canceling requestAnimationFrame');
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
  assert.match(liveSmokeSource, /\/images\/edits/, 'live smoke must call the OpenAI image edits endpoint');
  assert.match(liveSmokeSource, /decodePngRgba\(outputBytes\)/, 'live smoke must decode and inspect the returned image');
  assert.match(liveSmokeSource, /rawStats\.insideChangedRatio < 0\.02/, 'live smoke must fail when the editable mask region does not change');
  assert.match(liveSmokeSource, /compositedStats\.outsideChangedPixels !== 0/, 'live smoke must prove post-composite locked pixels stay unchanged');
  assert.match(liveSmokeSource, /compositedOutputPath/, 'live smoke must write the final strict-composited proof output');
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
    const request = new Request('https://worker.test/api/image-edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(basePayload),
    });
    const response = await worker.fetch(request, {
      JWT_SECRET: jwtSecret,
      OPENAI_API_KEY: 'test-openai-key',
    }, { waitUntil() {} });
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
    }), {
      JWT_SECRET: jwtSecret,
      OPENAI_API_KEY: 'test-openai-key',
    }, { waitUntil() {} });
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
    }), {
      JWT_SECRET: jwtSecret,
      OPENAI_API_KEY: 'test-openai-key',
    }, { waitUntil() {} });
    assert.equal(genericMaskedResponse.status, 200);
    assert.equal(capturedInit.body.get('size'), `${WIDTH}x${HEIGHT}`, 'generic masked OpenAI proxy must preserve source-sized output overrides');
    assert.equal(capturedInit.body.getAll('image[]').length, 1);
    assert.ok(capturedInit.body.get('mask') instanceof Blob, 'generic OpenAI edit proxy must preserve a valid mask');

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
    }), {
      JWT_SECRET: jwtSecret,
      OPENAI_API_KEY: 'test-openai-key',
    }, { waitUntil() {} });
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
    }), {
      JWT_SECRET: jwtSecret,
      OPENAI_API_KEY: 'test-openai-key',
    }, { waitUntil() {} });
    assert.equal(genericNoAlphaMaskResponse.status, 400);
    assert.match(await genericNoAlphaMaskResponse.text(), /alpha channel/i);

    const emptyAlpha = new Uint8Array(WIDTH * HEIGHT);
    const emptyMaskResponse = await worker.fetch(makeRequest({
      ...basePayload,
      selectionMask: {
        ...basePayload.selectionMask,
        base64: bytesToBase64(buildClientGrayscaleMaskPng(WIDTH, HEIGHT, emptyAlpha)),
      },
    }), {
      JWT_SECRET: jwtSecret,
      OPENAI_API_KEY: 'test-openai-key',
    }, { waitUntil() {} });
    assert.equal(emptyMaskResponse.status, 400);
    assert.match(await emptyMaskResponse.text(), /select an area/i);

    const fullAlpha = new Uint8Array(WIDTH * HEIGHT).fill(255);
    const oversizedMaskResponse = await worker.fetch(makeRequest({
      ...basePayload,
      selectionMask: {
        ...basePayload.selectionMask,
        base64: bytesToBase64(buildClientGrayscaleMaskPng(WIDTH, HEIGHT, fullAlpha)),
      },
    }), {
      JWT_SECRET: jwtSecret,
      OPENAI_API_KEY: 'test-openai-key',
    }, { waitUntil() {} });
    assert.equal(oversizedMaskResponse.status, 400);
    assert.match(await oversizedMaskResponse.text(), /too large/i);

    const mismatchedMaskResponse = await worker.fetch(makeRequest({
      ...basePayload,
      selectionMask: {
        ...basePayload.selectionMask,
        base64: bytesToBase64(buildClientGrayscaleMaskPng(768, 1024, new Uint8Array(768 * 1024))),
      },
    }), {
      JWT_SECRET: jwtSecret,
      OPENAI_API_KEY: 'test-openai-key',
    }, { waitUntil() {} });
    assert.equal(mismatchedMaskResponse.status, 400);
    assert.match(await mismatchedMaskResponse.text(), /dimensions/i);
    assert.equal(upstreamCalledForRejectedInput, false, 'invalid masks must be rejected before upstream OpenAI fetch');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

assertSourceContract();
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
