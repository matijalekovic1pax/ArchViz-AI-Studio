import { writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const WIDTH = 1024;
const HEIGHT = 768;
const OUT_PATH = process.env.OPENAI_IMAGE_EDIT_SMOKE_OUT || '/private/tmp/avas-openai-image-edit-smoke-composited.png';
const RAW_OUT_PATH = process.env.OPENAI_IMAGE_EDIT_SMOKE_RAW_OUT || '/private/tmp/avas-openai-image-edit-smoke-raw.png';
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
const OPENAI_SELECTION_ALPHA_THRESHOLD = 16;
const LOCALIZED_CHANGE_THRESHOLD = 24;

function readUint32(bytes, offset) {
  return (
    (bytes[offset] << 24) |
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
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
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

  return concatBytes([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND'),
  ]);
}

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function decodePngRgba(bytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) {
      throw new Error('Expected a PNG image from OpenAI image edit.');
    }
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];
  let offset = signature.length;
  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) throw new Error('Invalid PNG chunk length.');
    const data = bytes.subarray(dataStart, dataEnd);

    if (type === 'IHDR') {
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  if (!width || !height) throw new Error('PNG is missing dimensions.');
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}.`);
  if (interlace !== 0) throw new Error('Interlaced PNG output is not supported by the smoke verifier.');

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!channels) throw new Error(`Unsupported PNG color type: ${colorType}.`);

  const compressed = concatBytes(idatChunks);
  const inflated = inflateSync(compressed);
  const rowBytes = width * channels;
  const expectedLength = (rowBytes + 1) * height;
  if (inflated.length < expectedLength) {
    throw new Error(`PNG data is shorter than expected: ${inflated.length} < ${expectedLength}.`);
  }

  const reconstructed = new Uint8Array(rowBytes * height);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset++];
    const rowStart = y * rowBytes;
    const previousRowStart = rowStart - rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[inputOffset++];
      const left = x >= channels ? reconstructed[rowStart + x - channels] : 0;
      const up = y > 0 ? reconstructed[previousRowStart + x] : 0;
      const upperLeft = y > 0 && x >= channels ? reconstructed[previousRowStart + x - channels] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paethPredictor(left, up, upperLeft);
      else throw new Error(`Unsupported PNG filter: ${filter}.`);
      reconstructed[rowStart + x] = value & 255;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0, sourceIndex = 0, targetIndex = 0; pixel < width * height; pixel += 1, targetIndex += 4) {
    if (colorType === 6) {
      rgba[targetIndex] = reconstructed[sourceIndex++];
      rgba[targetIndex + 1] = reconstructed[sourceIndex++];
      rgba[targetIndex + 2] = reconstructed[sourceIndex++];
      rgba[targetIndex + 3] = reconstructed[sourceIndex++];
    } else if (colorType === 2) {
      rgba[targetIndex] = reconstructed[sourceIndex++];
      rgba[targetIndex + 1] = reconstructed[sourceIndex++];
      rgba[targetIndex + 2] = reconstructed[sourceIndex++];
      rgba[targetIndex + 3] = 255;
    } else {
      const gray = reconstructed[sourceIndex++];
      rgba[targetIndex] = gray;
      rgba[targetIndex + 1] = gray;
      rgba[targetIndex + 2] = gray;
      rgba[targetIndex + 3] = 255;
    }
  }

  return { width, height, data: rgba };
}

function getSelectionAlpha(maskImage) {
  const alpha = new Uint8Array(maskImage.width * maskImage.height);
  for (let index = 0, pixel = 0; index < alpha.length; index += 1, pixel += 4) {
    const luminance = Math.round((maskImage.data[pixel] + maskImage.data[pixel + 1] + maskImage.data[pixel + 2]) / 3);
    alpha[index] = Math.round((luminance * maskImage.data[pixel + 3]) / 255);
  }
  return alpha;
}

function maxChannelDelta(a, b, offset) {
  return Math.max(
    Math.abs(a[offset] - b[offset]),
    Math.abs(a[offset + 1] - b[offset + 1]),
    Math.abs(a[offset + 2] - b[offset + 2])
  );
}

function localizedDiffStats(sourceImage, generatedImage, selectionAlpha) {
  let insidePixels = 0;
  let outsidePixels = 0;
  let insideChanged = 0;
  let outsideChanged = 0;
  for (let index = 0, pixel = 0; index < selectionAlpha.length; index += 1, pixel += 4) {
    const inside = selectionAlpha[index] >= OPENAI_SELECTION_ALPHA_THRESHOLD;
    const changed = maxChannelDelta(sourceImage.data, generatedImage.data, pixel) >= LOCALIZED_CHANGE_THRESHOLD;
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

function compositeStrict(sourceImage, generatedImage, selectionAlpha) {
  const output = new Uint8Array(sourceImage.data);
  for (let index = 0, pixel = 0; index < selectionAlpha.length; index += 1, pixel += 4) {
    const alpha = selectionAlpha[index] / 255;
    if (alpha <= 0) continue;
    const inverse = 1 - alpha;
    output[pixel] = Math.round(sourceImage.data[pixel] * inverse + generatedImage.data[pixel] * alpha);
    output[pixel + 1] = Math.round(sourceImage.data[pixel + 1] * inverse + generatedImage.data[pixel + 1] * alpha);
    output[pixel + 2] = Math.round(sourceImage.data[pixel + 2] * inverse + generatedImage.data[pixel + 2] * alpha);
    output[pixel + 3] = Math.round(sourceImage.data[pixel + 3] * inverse + generatedImage.data[pixel + 3] * alpha);
  }
  return { width: sourceImage.width, height: sourceImage.height, data: output };
}

function createSourcePng() {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const pixel = (y * WIDTH + x) * 4;
      const checker = (Math.floor(x / 64) + Math.floor(y / 64)) % 2;
      rgba[pixel] = checker ? 232 : 248;
      rgba[pixel + 1] = checker ? 236 : 248;
      rgba[pixel + 2] = checker ? 240 : 248;
      rgba[pixel + 3] = 255;
      if (x >= 368 && x <= 656 && y >= 240 && y <= 528) {
        rgba[pixel] = 212;
        rgba[pixel + 1] = 58;
        rgba[pixel + 2] = 48;
      }
    }
  }
  return encodePngRgba(WIDTH, HEIGHT, rgba);
}

function createMaskPng() {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const pixel = (y * WIDTH + x) * 4;
      const editable = x >= 368 && x <= 656 && y >= 240 && y <= 528;
      rgba[pixel] = 255;
      rgba[pixel + 1] = 255;
      rgba[pixel + 2] = 255;
      rgba[pixel + 3] = editable ? 255 : 0;
    }
  }
  return encodePngRgba(WIDTH, HEIGHT, rgba);
}

function requireApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is required for the live GPT Image 2 edit smoke test.');
  }
  return key;
}

async function main() {
  const apiKey = requireApiKey();
  const source = createSourcePng();
  const mask = createMaskPng();
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', 'Replace only the masked red square with a crisp blue glass window panel. Preserve the unmasked checkerboard background exactly.');
  form.append('size', `${WIDTH}x${HEIGHT}`);
  form.append('quality', 'medium');
  form.append('output_format', 'png');
  form.append('background', 'opaque');
  form.append('image[]', new Blob([source], { type: 'image/png' }), 'source.png');
  form.append('mask', new Blob([mask], { type: 'image/png' }), 'mask.png');

  const response = await fetch(`${OPENAI_API_BASE}/images/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`OpenAI image edit failed ${response.status}: ${text.slice(0, 1000)}`);
  }

  const image = payload?.data?.[0];
  if (!image?.b64_json && !image?.url) {
    throw new Error(`OpenAI image edit response did not include b64_json or url: ${JSON.stringify(payload).slice(0, 1000)}`);
  }

  let outputBytes = null;
  if (image.b64_json) {
    outputBytes = Buffer.from(image.b64_json, 'base64');
  } else {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error(`Could not fetch OpenAI image URL ${imageResponse.status}: ${image.url}`);
    }
    outputBytes = Buffer.from(await imageResponse.arrayBuffer());
  }
  if (outputBytes.length < 1024) {
    throw new Error(`OpenAI image edit output was unexpectedly small: ${outputBytes.length} bytes.`);
  }

  const sourceImage = decodePngRgba(source);
  const maskImage = decodePngRgba(mask);
  const generatedImage = decodePngRgba(outputBytes);
  if (generatedImage.width !== WIDTH || generatedImage.height !== HEIGHT) {
    throw new Error(`OpenAI image edit output dimensions were ${generatedImage.width}x${generatedImage.height}, expected ${WIDTH}x${HEIGHT}.`);
  }

  const selectionAlpha = getSelectionAlpha(maskImage);
  const rawStats = localizedDiffStats(sourceImage, generatedImage, selectionAlpha);
  if (rawStats.insideChangedRatio < 0.02) {
    throw new Error(`OpenAI image edit did not materially change the masked area. Inside changed ratio: ${rawStats.insideChangedRatio}.`);
  }

  const compositedImage = compositeStrict(sourceImage, generatedImage, selectionAlpha);
  const compositedStats = localizedDiffStats(sourceImage, compositedImage, selectionAlpha);
  if (compositedStats.outsideChangedPixels !== 0) {
    throw new Error(`Strict post-composite changed locked pixels outside the mask: ${compositedStats.outsideChangedPixels}.`);
  }

  writeFileSync(RAW_OUT_PATH, outputBytes);
  writeFileSync(OUT_PATH, encodePngRgba(compositedImage.width, compositedImage.height, compositedImage.data));
  console.log(JSON.stringify({
    success: true,
    model: 'gpt-image-2',
    endpoint: `${OPENAI_API_BASE}/images/edits`,
    rawOutputPath: RAW_OUT_PATH,
    compositedOutputPath: OUT_PATH,
    outputBytes: outputBytes.length,
    outputSize: `${generatedImage.width}x${generatedImage.height}`,
    rawInsideChangedRatio: rawStats.insideChangedRatio,
    rawOutsideChangedRatio: rawStats.outsideChangedRatio,
    compositedInsideChangedRatio: compositedStats.insideChangedRatio,
    compositedOutsideChangedPixels: compositedStats.outsideChangedPixels,
    responseFields: Object.keys(image),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
