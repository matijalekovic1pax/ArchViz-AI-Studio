import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, MapPin, Loader2, Building2, Route, Droplets, Mountain, Train } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Slider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';

interface LocationData {
  location: string;
  coordinates: { lat: number; lng: number };
  radius: number;
  loadBuildings: boolean;
  loadRoads: boolean;
  loadWater: boolean;
  loadTerrain: boolean;
  loadTransit: boolean;
}

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (data: LocationData & { loadedData: { buildings: number; roads: number; water: number; terrain: boolean; transit: number } }) => void;
  initialData: Partial<LocationData>;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  onLoad,
  initialData,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ name: string; lat: number; lng: number } | null>(
    initialData.coordinates ? { name: initialData.location || '', lat: initialData.coordinates.lat, lng: initialData.coordinates.lng } : null
  );
  const [radius, setRadius] = useState(initialData.radius || 300);
  const [loadBuildings, setLoadBuildings] = useState(initialData.loadBuildings ?? true);
  const [loadRoads, setLoadRoads] = useState(initialData.loadRoads ?? true);
  const [loadWater, setLoadWater] = useState(initialData.loadWater ?? false);
  const [loadTerrain, setLoadTerrain] = useState(initialData.loadTerrain ?? false);
  const [loadTransit, setLoadTransit] = useState(initialData.loadTransit ?? false);

  const searchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        { headers: { 'User-Agent': 'ArchViz-AI-Studio/1.0' } }
      );
      const data: SearchResult[] = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Geocoding error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = window.setTimeout(() => handleSearch(value), 400);
  };

  const handleSelectResult = (result: SearchResult) => {
    const shortName = result.display_name.split(',').slice(0, 2).join(',');
    setSelectedLocation({
      name: shortName,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    });
    setSearchQuery(shortName);
    setSearchResults([]);
  };

  const handleLoadContext = async () => {
    if (!selectedLocation) return;

    setIsLoading(true);

    // Simulate fetching data from Overpass API (in production, replace with real API call)
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Mock loaded data counts
    const loadedData = {
      buildings: loadBuildings ? Math.floor(Math.random() * 80) + 20 : 0,
      roads: loadRoads ? Math.floor(Math.random() * 20) + 5 : 0,
      water: loadWater ? Math.floor(Math.random() * 5) : 0,
      terrain: loadTerrain,
      transit: loadTransit ? Math.floor(Math.random() * 8) : 0,
    };

    onLoad({
      location: selectedLocation.name,
      coordinates: { lat: selectedLocation.lat, lng: selectedLocation.lng },
      radius,
      loadBuildings,
      loadRoads,
      loadWater,
      loadTerrain,
      loadTransit,
      loadedData,
    });

    setIsLoading(false);
    onClose();
  };

  const getMapPreviewUrl = () => {
    if (!selectedLocation) return null;
    const previewScale = 1.35;
    const lat = selectedLocation.lat;
    const lng = selectedLocation.lng;
    const latDelta = (radius * previewScale) / 111320;
    const lngDelta = (radius * previewScale) / (111320 * Math.cos((lat * Math.PI) / 180));
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - lngDelta},${lat - latDelta},${lng + lngDelta},${lat + latDelta}&layer=mapnik&marker=${lat},${lng}&radius=${radius}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-border rounded-xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-elevated">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-accent" />
            <h2 className="text-sm font-semibold">{t('locationModal.title')}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-elevated transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="md:w-1/2">
              <div className="relative aspect-square bg-surface-sunken rounded-lg border border-border overflow-hidden">
                {selectedLocation ? (
                  <iframe
                    key={`${selectedLocation.lat}-${selectedLocation.lng}-${radius}`}
                    src={getMapPreviewUrl() || ''}
                    className="w-full h-full border-0"
                    title={t('locationModal.mapPreview')}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-foreground-muted">
                    <MapPin size={24} className="mb-2 opacity-50" />
                    <span className="text-xs">{t('locationModal.empty')}</span>
                  </div>
                )}
                {selectedLocation && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className="rounded-full border-2 border-red-500/80 bg-red-500/10 shadow-[0_0_0_1px_rgba(255,255,255,0.3)]"
                      style={{ width: '72%', aspectRatio: '1 / 1' }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="md:w-1/2 space-y-4">
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

                {/* Search Results Dropdown */}
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

              {/* Radius */}
              <div>
                <Slider
                  label={t('locationModal.radius')}
                  value={radius}
                  min={100}
                  max={2000}
                  step={100}
                  onChange={setRadius}
                />
                <br></br>
                <div className="text-[10px] text-foreground-muted -mt-2">{t('locationModal.radiusHint', { radius })}</div>
              </div>

              {/* Data */}
              <div className="border-t border-border pt-3">
                <div className="text-[10px] text-foreground-muted uppercase tracking-wider mb-2">{t('locationModal.dataToLoad')}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center justify-between gap-3 p-2 bg-surface-elevated rounded border border-border">
                    <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                      <Building2 size={14} className="text-foreground-muted" />
                      <span>{t('locationModal.data.buildings')}</span>
                    </div>
                    <Toggle label="" checked={loadBuildings} onChange={setLoadBuildings} />
                  </div>
                  <div className="flex items-center justify-between gap-3 p-2 bg-surface-elevated rounded border border-border">
                    <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                      <Route size={14} className="text-foreground-muted" />
                      <span>{t('locationModal.data.roads')}</span>
                    </div>
                    <Toggle label="" checked={loadRoads} onChange={setLoadRoads} />
                  </div>
                  <div className="flex items-center justify-between gap-3 p-2 bg-surface-elevated rounded border border-border">
                    <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                      <Droplets size={14} className="text-foreground-muted" />
                      <span>{t('locationModal.data.water')}</span>
                    </div>
                    <Toggle label="" checked={loadWater} onChange={setLoadWater} />
                  </div>
                  <div className="flex items-center justify-between gap-3 p-2 bg-surface-elevated rounded border border-border">
                    <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                      <Mountain size={14} className="text-foreground-muted" />
                      <span>{t('locationModal.data.terrain')}</span>
                    </div>
                    <Toggle label="" checked={loadTerrain} onChange={setLoadTerrain} />
                  </div>
                  <div className="flex items-center justify-between gap-3 p-2 bg-surface-elevated rounded border border-border col-span-2">
                    <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                      <Train size={14} className="text-foreground-muted" />
                      <span>{t('locationModal.data.transit')}</span>
                    </div>
                    <Toggle label="" checked={loadTransit} onChange={setLoadTransit} />
                  </div>
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
            disabled={!selectedLocation || isLoading}
            className={cn(
              'flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2',
              selectedLocation && !isLoading
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
