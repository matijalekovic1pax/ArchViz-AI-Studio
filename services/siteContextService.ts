/**
 * Site Context Service
 *
 * Pulls the real surroundings of a map location for the masterplan feature:
 * a north-up satellite capture stitched from Web Mercator tiles, and live
 * OpenStreetMap feature counts from Overpass. Both run in the browser — the
 * tile host and Overpass send `Access-Control-Allow-Origin: *`, so the capture
 * can be read back from a canvas without going through the gateway.
 */

import type { MasterplanSiteAerialMeta, MasterplanSiteFootprint } from '../types';

/**
 * Esri World Imagery. Free to use with attribution for development and
 * non-commercial use; production commercial use needs an ArcGIS Location
 * Platform key (or a swap to another XYZ satellite source here).
 */
const SATELLITE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_MAX_ZOOM = 19;
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_TIMEOUT_MS = 12_000;
/** The public instance answers 429/504 when busy; one delayed retry usually clears it. */
const OVERPASS_RETRY_DELAY_MS = 1_500;
const TILE_SIZE = 256;
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

export const SITE_AERIAL_ATTRIBUTION = 'Imagery © Esri, Maxar, Earthstar Geographics · Data © OpenStreetMap contributors';

/** GPT Images' native landscape size, so the capture is never resampled to a different ratio. */
export const SITE_AERIAL_WIDTH = 1536;
export const SITE_AERIAL_HEIGHT = 1024;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SiteAerialCapture {
  dataUrl: string;
  meta: MasterplanSiteAerialMeta;
}

export interface SiteFeatureCounts {
  buildings: number;
  roads: number;
  water: number;
  terrain: boolean;
  transit: number;
}

export interface SiteFeatureLayers {
  loadBuildings: boolean;
  loadRoads: boolean;
  loadWater: boolean;
  loadTerrain: boolean;
  loadTransit: boolean;
}

// ─── Web Mercator ───────────────────────────────────────────────────────────

const worldSize = (zoom: number) => TILE_SIZE * 2 ** zoom;

const toWorldPixel = ({ lat, lng }: LatLng, zoom: number) => {
  const size = worldSize(zoom);
  const sinLat = Math.min(0.9999, Math.max(-0.9999, Math.sin((lat * Math.PI) / 180)));
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * size,
  };
};

const fromWorldPixel = (x: number, y: number, zoom: number): LatLng => {
  const size = worldSize(zoom);
  const n = Math.PI - (2 * Math.PI * y) / size;
  return {
    lat: (Math.atan(Math.sinh(n)) * 180) / Math.PI,
    lng: (x / size) * 360 - 180,
  };
};

const tileMetersPerPixel = (lat: number, zoom: number) =>
  (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / worldSize(zoom);

/** Where a coordinate lands on a capture, in capture pixels. */
export const latLngToAerialPixel = (point: LatLng, meta: MasterplanSiteAerialMeta) => {
  const center = toWorldPixel(meta.center, meta.zoom);
  const world = toWorldPixel(point, meta.zoom);
  return {
    x: meta.width / 2 + (world.x - center.x) * meta.scale,
    y: meta.height / 2 + (world.y - center.y) * meta.scale,
  };
};

/** The coordinate under a capture pixel. */
export const aerialPixelToLatLng = (x: number, y: number, meta: MasterplanSiteAerialMeta): LatLng => {
  const center = toWorldPixel(meta.center, meta.zoom);
  return fromWorldPixel(
    center.x + (x - meta.width / 2) / meta.scale,
    center.y + (y - meta.height / 2) / meta.scale,
    meta.zoom
  );
};

// ─── Satellite capture ──────────────────────────────────────────────────────

const loadTile = (url: string, signal?: AbortSignal): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const abort = () => {
      image.src = '';
      resolve(null);
    };
    signal?.addEventListener('abort', abort, { once: true });
    image.onload = () => {
      signal?.removeEventListener('abort', abort);
      resolve(image);
    };
    // A missing tile (ocean, or beyond the imagery's zoom) leaves a gap rather than failing the capture.
    image.onerror = () => {
      signal?.removeEventListener('abort', abort);
      resolve(null);
    };
    image.src = url;
  });

/**
 * Captures a north-up satellite image centred on `center`, with `radiusMeters`
 * spanning half the image height. Returns the capture plus the geometry needed
 * to map between pixels and coordinates.
 */
export async function captureSiteAerial(
  center: LatLng,
  radiusMeters: number,
  options: { width?: number; height?: number; signal?: AbortSignal } = {}
): Promise<SiteAerialCapture> {
  const width = options.width ?? SITE_AERIAL_WIDTH;
  const height = options.height ?? SITE_AERIAL_HEIGHT;
  const metersPerPixel = (radiusMeters * 2) / height;

  // Round rather than floor so the tiles are drawn between 0.71x and 1.41x:
  // sharp enough for the model, without fetching four times the tiles.
  const idealZoom = Math.log2(tileMetersPerPixel(center.lat, 0) / metersPerPixel);
  const zoom = Math.max(1, Math.min(SATELLITE_MAX_ZOOM, Math.round(idealZoom)));
  const scale = tileMetersPerPixel(center.lat, zoom) / metersPerPixel;

  const centerWorld = toWorldPixel(center, zoom);
  const halfWorldWidth = width / 2 / scale;
  const halfWorldHeight = height / 2 / scale;
  const minTileX = Math.floor((centerWorld.x - halfWorldWidth) / TILE_SIZE);
  const maxTileX = Math.floor((centerWorld.x + halfWorldWidth) / TILE_SIZE);
  const minTileY = Math.max(0, Math.floor((centerWorld.y - halfWorldHeight) / TILE_SIZE));
  const maxTileY = Math.min(2 ** zoom - 1, Math.floor((centerWorld.y + halfWorldHeight) / TILE_SIZE));
  const tileCount = 2 ** zoom;

  const jobs: Array<Promise<{ image: HTMLImageElement | null; tileX: number; tileY: number }>> = [];
  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
      const url = SATELLITE_TILE_URL
        .replace('{z}', String(zoom))
        .replace('{y}', String(tileY))
        .replace('{x}', String(wrappedX));
      jobs.push(loadTile(url, options.signal).then((image) => ({ image, tileX, tileY })));
    }
  }
  const tiles = await Promise.all(jobs);
  if (options.signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  const loaded = tiles.filter((tile) => tile.image);
  if (loaded.length === 0) {
    throw new Error('Satellite imagery could not be loaded for this location.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available in this browser.');
  context.fillStyle = '#6b7069';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = 'high';

  const drawnSize = TILE_SIZE * scale;
  for (const { image, tileX, tileY } of loaded) {
    const x = (tileX * TILE_SIZE - centerWorld.x) * scale + width / 2;
    const y = (tileY * TILE_SIZE - centerWorld.y) * scale + height / 2;
    // Half a pixel of overlap hides the antialiased seam between tiles.
    context.drawImage(image as HTMLImageElement, x, y, drawnSize + 0.5, drawnSize + 0.5);
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    meta: {
      width,
      height,
      metersPerPixel,
      center,
      zoom,
      scale,
      capturedAt: Date.now(),
    },
  };
}

// ─── Placement guide ────────────────────────────────────────────────────────

/** Corners of the footprint rectangle in capture pixels, clockwise from the north-west. */
export const getFootprintPolygon = (
  pin: LatLng,
  footprint: MasterplanSiteFootprint,
  meta: MasterplanSiteAerialMeta
): Array<{ x: number; y: number }> => {
  const centre = latLngToAerialPixel(pin, meta);
  const halfWidth = footprint.width / meta.metersPerPixel / 2;
  const halfDepth = footprint.depth / meta.metersPerPixel / 2;
  const angle = (footprint.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ].map(([x, y]) => ({
    x: centre.x + x * cos - y * sin,
    y: centre.y + x * sin + y * cos,
  }));
};

const loadDataUrlImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read the site capture.'));
    image.src = dataUrl;
  });

/**
 * The capture with the proposed footprint marked, for the image model to read
 * position, size and orientation from. The clean capture is sent alongside it
 * as the image to build on, so the marking never has to be painted out.
 */
export async function buildSitePlacementGuide(
  aerialDataUrl: string,
  meta: MasterplanSiteAerialMeta,
  pin: LatLng,
  footprint: MasterplanSiteFootprint
): Promise<string> {
  const image = await loadDataUrlImage(aerialDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = meta.width;
  canvas.height = meta.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available in this browser.');
  context.drawImage(image, 0, 0, meta.width, meta.height);

  // Dim the surroundings so the plot reads as the subject.
  context.fillStyle = 'rgba(0, 0, 0, 0.28)';
  context.fillRect(0, 0, meta.width, meta.height);

  const polygon = getFootprintPolygon(pin, footprint, meta);
  context.save();
  context.beginPath();
  polygon.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
  context.closePath();
  context.clip();
  context.drawImage(image, 0, 0, meta.width, meta.height);
  context.fillStyle = 'rgba(255, 0, 170, 0.22)';
  context.fillRect(0, 0, meta.width, meta.height);
  context.restore();

  context.beginPath();
  polygon.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
  context.closePath();
  context.lineWidth = 4;
  context.strokeStyle = '#ff00aa';
  context.stroke();

  // Mark the front edge (the first edge, facing north before rotation) so orientation is unambiguous.
  context.beginPath();
  context.moveTo(polygon[0].x, polygon[0].y);
  context.lineTo(polygon[1].x, polygon[1].y);
  context.lineWidth = 9;
  context.strokeStyle = '#ffe600';
  context.stroke();

  return canvas.toDataURL('image/jpeg', 0.92);
}

// ─── OpenStreetMap feature counts ───────────────────────────────────────────

/**
 * Counts mapped features around the site. Returns null when Overpass is
 * unreachable; callers should show nothing rather than an invented number.
 */
export async function fetchSiteFeatureCounts(
  center: LatLng,
  radiusMeters: number,
  layers: SiteFeatureLayers,
  signal?: AbortSignal
): Promise<SiteFeatureCounts | null> {
  const around = `(around:${Math.round(radiusMeters)},${center.lat.toFixed(6)},${center.lng.toFixed(6)})`;
  const statements: Array<{ key: keyof Omit<SiteFeatureCounts, 'terrain'>; query: string }> = [];
  if (layers.loadBuildings) {
    statements.push({ key: 'buildings', query: `(way["building"]${around};relation["building"]${around};);out count;` });
  }
  if (layers.loadRoads) {
    statements.push({ key: 'roads', query: `way["highway"]${around};out count;` });
  }
  if (layers.loadWater) {
    statements.push({ key: 'water', query: `(way["natural"="water"]${around};relation["natural"="water"]${around};way["waterway"]${around};);out count;` });
  }
  if (layers.loadTransit) {
    statements.push({ key: 'transit', query: `(node["highway"="bus_stop"]${around};node["railway"~"^(station|halt|tram_stop)$"]${around};node["public_transport"="station"]${around};);out count;` });
  }

  const counts: SiteFeatureCounts = { buildings: 0, roads: 0, water: 0, terrain: layers.loadTerrain, transit: 0 };
  if (statements.length === 0) return counts;

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = window.setTimeout(abort, OVERPASS_TIMEOUT_MS);

  try {
    const query = `[out:json][timeout:${Math.round(OVERPASS_TIMEOUT_MS / 1000)}];${statements.map((statement) => statement.query).join('')}`;
    const request = () => fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    let response = await request();
    if (response.status === 429 || response.status === 504) {
      await new Promise((resolve) => window.setTimeout(resolve, OVERPASS_RETRY_DELAY_MS));
      response = await request();
    }
    if (!response.ok) return null;
    const payload = await response.json();
    const elements: Array<{ type?: string; tags?: { total?: string } }> = Array.isArray(payload?.elements) ? payload.elements : [];
    const countElements = elements.filter((element) => element.type === 'count');
    if (countElements.length !== statements.length) return null;
    statements.forEach((statement, index) => {
      counts[statement.key] = Number(countElements[index].tags?.total) || 0;
    });
    return counts;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
