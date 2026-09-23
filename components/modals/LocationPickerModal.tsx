import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, MapPin, Loader2, Building2, Route, Droplets, Train, Crosshair } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Slider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';
import type { MasterplanSiteAerialMeta, WorkflowSettings } from '../../types';
import {
  SITE_AERIAL_ATTRIBUTION,
  SITE_AERIAL_HEIGHT,
  SITE_AERIAL_WIDTH,
  aerialPixelToLatLng,
  captureSiteAerial,
  fetchSiteFeatureCounts,
  getFootprintPolygon,
  latLngToAerialPixel,
  type LatLng,
} from '../../services/siteContextService';

type MasterplanContext = WorkflowSettings['mpContext'];

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (data: MasterplanContext) => void;
  /** OpenStreetMap counts arrive after the modal closes; they never hold up loading the site. */
  onFeatureCounts?: (coordinates: LatLng, counts: NonNullable<MasterplanContext['loadedData']>) => void;
  initialData: MasterplanContext;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface Capture {
  dataUrl: string;
  meta: MasterplanSiteAerialMeta;
}

const CAPTURE_DEBOUNCE_MS = 450;

const samePoint = (a: LatLng, b: LatLng) =>
  Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  onLoad,
  onFeatureCounts,
  initialData,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [locationName, setLocationName] = useState('');
  /** Centre of the satellite capture; moves only when a new place is chosen. */
  const [captureCenter, setCaptureCenter] = useState<LatLng | null>(null);
  /** Where the building goes; the user moves it by clicking the capture. */
  const [pin, setPin] = useState<LatLng | null>(null);
  const [radius, setRadius] = useState(150);
  const [footprint, setFootprint] = useState(initialData.footprint);
  const [storeys, setStoreys] = useState(initialData.storeys);
  const [loadBuildings, setLoadBuildings] = useState(true);
  const [loadRoads, setLoadRoads] = useState(true);
  const [loadWater, setLoadWater] = useState(false);
  const [loadTransit, setLoadTransit] = useState(false);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const searchTimeoutRef = useRef<number | null>(null);
  const captureAbortRef = useRef<AbortController | null>(null);

  // The modal stays mounted while closed, so re-seed it from the store on every open.
  useEffect(() => {
    if (!isOpen) return;
    const coordinates = initialData.coordinates;
    setSearchQuery(initialData.location || '');
    setSearchResults([]);
    setSearchError(null);
    setLocationName(initialData.location || '');
    setCaptureCenter(initialData.aerialMeta?.center || coordinates);
    setPin(coordinates);
    setRadius(initialData.radius || 150);
    setFootprint(initialData.footprint);
    setStoreys(initialData.storeys);
    setLoadBuildings(initialData.loadBuildings ?? true);
    setLoadRoads(initialData.loadRoads ?? true);
    setLoadWater(initialData.loadWater ?? false);
    setLoadTransit(initialData.loadTransit ?? false);
    setCapture(
      initialData.aerialImage && initialData.aerialMeta
        ? { dataUrl: initialData.aerialImage, meta: initialData.aerialMeta }
        : null
    );
    setCaptureError(null);
    // Only on open: later store updates come from this modal's own onLoad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    captureAbortRef.current?.abort();
  }, []);

  // Recapture when the place or radius changes. A capture already matching
  // both (e.g. the one restored on open) is kept.
  useEffect(() => {
    if (!isOpen || !captureCenter) return;
    if (
      capture &&
      samePoint(capture.meta.center, captureCenter) &&
      Math.abs(capture.meta.metersPerPixel - (radius * 2) / SITE_AERIAL_HEIGHT) < 1e-9
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      captureAbortRef.current?.abort();
      const controller = new AbortController();
      captureAbortRef.current = controller;
      setIsCapturing(true);
      setCaptureError(null);
      captureSiteAerial(captureCenter, radius, { signal: controller.signal })
        .then((next) => {
          if (!controller.signal.aborted) setCapture(next);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setCaptureError(error instanceof Error ? error.message : 'Satellite imagery could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsCapturing(false);
        });
    }, CAPTURE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen, captureCenter, radius, capture]);

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      if (!response.ok) throw new Error(`Search failed (${response.status})`);
      const data: SearchResult[] = await response.json();
      setSearchResults(data);
    } catch (error) {
      setSearchResults([]);
      setSearchError(t('locationModal.searchUnavailable', 'Search unavailable — enter coordinates manually'));
      setShowManualInput(true);
    } finally {
      setIsSearching(false);
    }
  }, [t]);

  const handleQueryChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = window.setTimeout(() => handleSearch(value), 400);
  };

  const choosePlace = (name: string, point: LatLng) => {
    setLocationName(name);
    setCaptureCenter(point);
    setPin(point);
  };

  const handleApplyManualCoords = useCallback(() => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng) || lat < -85 || lat > 85 || lng < -180 || lng > 180) return;
    const name = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    choosePlace(name, { lat, lng });
    setSearchQuery(name);
  }, [manualLat, manualLng]);

  const handleSelectResult = (result: SearchResult) => {
    const shortName = result.display_name.split(',').slice(0, 2).join(',');
    choosePlace(shortName, { lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setSearchQuery(shortName);
    setSearchResults([]);
  };

  const handlePreviewClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!capture) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * capture.meta.width;
    const y = ((event.clientY - bounds.top) / bounds.height) * capture.meta.height;
    setPin(aerialPixelToLatLng(x, y, capture.meta));
  };

  const footprintPoints = useMemo(() => {
    if (!capture || !pin) return null;
    return getFootprintPolygon(pin, footprint, capture.meta);
  }, [capture, pin, footprint]);

  const pinPixel = capture && pin ? latLngToAerialPixel(pin, capture.meta) : null;

  const handleLoadContext = async () => {
    if (!pin || !capture) return;

    setIsLoading(true);
    setCaptureError(null);
    try {
      // Recentre on the building so it sits in the middle of the result.
      const finalCapture = samePoint(capture.meta.center, pin)
        ? capture
        : await captureSiteAerial(pin, radius);
      const layers = { loadBuildings, loadRoads, loadWater, loadTerrain: false, loadTransit };

      onLoad({
        location: locationName || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`,
        coordinates: pin,
        radius,
        loadBuildings,
        loadRoads,
        loadWater,
        loadTerrain: false,
        loadTransit,
        loadedData: null,
        aerialImage: finalCapture.dataUrl,
        aerialMeta: finalCapture.meta,
        footprint,
        storeys,
      });
      onClose();
      void fetchSiteFeatureCounts(pin, radius, layers).then((counts) => {
        if (counts) onFeatureCounts?.(pin, counts);
      });
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Satellite imagery could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const layerToggles = [
    { key: 'buildings', icon: Building2, checked: loadBuildings, onChange: setLoadBuildings },
    { key: 'roads', icon: Route, checked: loadRoads, onChange: setLoadRoads },
    { key: 'water', icon: Droplets, checked: loadWater, onChange: setLoadWater },
    { key: 'transit', icon: Train, checked: loadTransit, onChange: setLoadTransit },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-elevated border border-border rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-accent" />
            <h2 className="text-sm font-semibold">{t('locationModal.title')}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-sunken transition-colors" aria-label={t('common.cancel')}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="md:w-3/5 space-y-2">
              <div
                className="relative bg-surface-sunken rounded-lg border border-border overflow-hidden"
                style={{ aspectRatio: `${SITE_AERIAL_WIDTH} / ${SITE_AERIAL_HEIGHT}` }}
              >
                {capture ? (
                  <>
                    <img
                      src={capture.dataUrl}
                      alt={t('locationModal.mapPreview')}
                      className="absolute inset-0 w-full h-full select-none"
                      draggable={false}
                    />
                    <svg
                      viewBox={`0 0 ${capture.meta.width} ${capture.meta.height}`}
                      className="absolute inset-0 w-full h-full cursor-crosshair"
                      onClick={handlePreviewClick}
                      role="img"
                      aria-label={t('locationModal.placeHint', 'Click the image to place the building')}
                    >
                      {footprintPoints && (
                        <>
                          <polygon
                            points={footprintPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                            fill="rgba(255, 0, 170, 0.25)"
                            stroke="#ff00aa"
                            strokeWidth={4}
                          />
                          <line
                            x1={footprintPoints[0].x}
                            y1={footprintPoints[0].y}
                            x2={footprintPoints[1].x}
                            y2={footprintPoints[1].y}
                            stroke="#ffe600"
                            strokeWidth={8}
                          />
                        </>
                      )}
                      {pinPixel && (
                        <circle cx={pinPixel.x} cy={pinPixel.y} r={6} fill="#ffffff" stroke="#ff00aa" strokeWidth={3} />
                      )}
                    </svg>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground-muted">
                    <MapPin size={24} className="mb-2 opacity-50" />
                    <span className="text-xs">{t('locationModal.empty')}</span>
                  </div>
                )}
                {isCapturing && (
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white">
                    <Loader2 size={12} className="animate-spin" />
                    {t('locationModal.capturing', 'Loading satellite imagery…')}
                  </div>
                )}
              </div>
              <div className="flex items-start justify-between gap-3 text-[10px] text-foreground-muted">
                <span className="flex items-center gap-1">
                  <Crosshair size={12} />
                  {t('locationModal.placeHint', 'Click the image to place the building')}
                </span>
                <span className="text-right">{SITE_AERIAL_ATTRIBUTION}</span>
              </div>
              {captureError && <div className="text-[10px] text-red-500">{captureError}</div>}
            </div>

            <div className="md:w-2/5 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder={t('locationModal.searchPlaceholder')}
                  className="w-full h-10 pl-9 pr-4 bg-surface-elevated border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                {isSearching && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-foreground-muted" />
                )}

                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface-elevated border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.place_id}
                        onClick={() => handleSelectResult(result)}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-surface-sunken transition-colors border-b border-border last:border-0"
                      >
                        <div className="truncate">{result.display_name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {searchError && <div className="text-[10px] text-red-500 -mt-2">{searchError}</div>}
              {!showManualInput && !searchError && (
                <button
                  type="button"
                  onClick={() => setShowManualInput(true)}
                  className="text-[10px] text-accent hover:underline -mt-2"
                >
                  {t('locationModal.manualCoords', 'Enter coordinates manually')}
                </button>
              )}
              {showManualInput && (
                <div className="flex items-center gap-2 -mt-2">
                  <input
                    type="number"
                    step="any"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    placeholder="Lat"
                    className="w-24 h-8 px-2 bg-surface-elevated border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <input
                    type="number"
                    step="any"
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    placeholder="Lng"
                    className="w-24 h-8 px-2 bg-surface-elevated border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <button
                    type="button"
                    onClick={handleApplyManualCoords}
                    disabled={!manualLat || !manualLng}
                    className={cn(
                      'h-8 px-3 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors',
                      manualLat && manualLng
                        ? 'bg-foreground text-background hover:bg-foreground/90'
                        : 'bg-foreground/30 text-background/50 cursor-not-allowed'
                    )}
                  >
                    {t('locationModal.apply', 'Apply')}
                  </button>
                </div>
              )}

              {/* Area */}
              <div>
                <Slider
                  label={t('locationModal.radius')}
                  value={radius}
                  min={100}
                  max={2000}
                  step={50}
                  onChange={setRadius}
                />
                <div className="text-[10px] text-foreground-muted mt-1">{t('locationModal.radiusHint', { radius })}</div>
              </div>

              {/* Building */}
              <div className="border-t border-border pt-3 space-y-3">
                <div className="text-[10px] text-foreground-muted uppercase tracking-wider">
                  {t('locationModal.building', 'Proposed building')}
                </div>
                <Slider
                  label={t('locationModal.footprintWidth', 'Width (m, east–west)')}
                  value={footprint.width}
                  min={4}
                  max={250}
                  onChange={(width) => setFootprint((prev) => ({ ...prev, width }))}
                />
                <Slider
                  label={t('locationModal.footprintDepth', 'Depth (m, north–south)')}
                  value={footprint.depth}
                  min={4}
                  max={250}
                  onChange={(depth) => setFootprint((prev) => ({ ...prev, depth }))}
                />
                <Slider
                  label={t('locationModal.footprintRotation', 'Rotation (°)')}
                  value={footprint.rotation}
                  min={0}
                  max={359}
                  onChange={(rotation) => setFootprint((prev) => ({ ...prev, rotation }))}
                />
                <Slider
                  label={t('locationModal.storeys', 'Storeys')}
                  value={storeys}
                  min={1}
                  max={60}
                  onChange={setStoreys}
                />
                <div className="text-[10px] text-foreground-muted">
                  {t('locationModal.frontHint', 'The yellow edge is the front of the building.')}
                </div>
              </div>

              {/* Data */}
              <div className="border-t border-border pt-3">
                <div className="text-[10px] text-foreground-muted uppercase tracking-wider mb-2">{t('locationModal.dataToLoad')}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {layerToggles.map(({ key, icon: Icon, checked, onChange }) => (
                    <div key={key} className="flex items-center justify-between gap-3 p-2 bg-surface-elevated rounded border border-border">
                      <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                        <Icon size={14} className="text-foreground-muted" />
                        <span>{t(`locationModal.data.${key}`)}</span>
                      </div>
                      <Toggle label="" checked={checked} onChange={onChange} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-border bg-surface-sunken">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-medium rounded-lg border border-border hover:bg-surface-elevated transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleLoadContext}
            disabled={!pin || !capture || isLoading || isCapturing}
            className={cn(
              'flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2',
              pin && capture && !isLoading && !isCapturing
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'bg-foreground/50 text-background/70 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t('locationModal.loading')}
              </>
            ) : (
              t('locationModal.loadContext')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
