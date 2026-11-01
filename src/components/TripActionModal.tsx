import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Crosshair,
  MapPin,
  Navigation,
  Search,
  X,
} from 'lucide-react';
import { LocationSource, TripRecord } from '../database/schema';
import {
  ADDIS_ABABA_LANDMARKS,
  captureSingleGpsPoint,
  reverseGeocodeWithOfflineFallback,
} from '../services/location/locationService';
import { useTripBirrStore } from '../store/useTripBirrStore';

interface TripActionModalProps {
  mode: 'START' | 'END';
  activeTrip?: TripRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmStart: (params: {
    startLocationName: string;
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    source: LocationSource;
    notes?: string;
  }) => void;
  onConfirmEnd: (
    tripId: string,
    params: {
      endLocationName: string;
      latitude: number | null;
      longitude: number | null;
      accuracy: number | null;
      source: LocationSource;
      notes?: string;
    }
  ) => void;
}

export const TripActionModal: React.FC<TripActionModalProps> = ({
  mode,
  activeTrip,
  isOpen,
  onClose,
  onConfirmStart,
  onConfirmEnd,
}) => {
  const { settings } = useTripBirrStore();

  const [placeName, setPlaceName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [source, setSource] = useState<LocationSource>(LocationSource.GPS);
  const [notes, setNotes] = useState(activeTrip?.notes || '');
  const [hubSearch, setHubSearch] = useState('');
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Automatically fetch actual device coordinates via Geolocation API when modal opens
  useEffect(() => {
    let isCancelled = false;

    if (isOpen) {
      setNotes(activeTrip?.notes || '');
      setErrorMsg(null);
      setHubSearch('');

      if (settings.location_permission_status === 'DENIED') {
        setPlaceName('');
        setLatitude(null);
        setLongitude(null);
        setAccuracy(null);
        setSource(LocationSource.MANUAL);
        setGpsStatusMsg(
          'Location permission is set to DENIED in Settings. Enter location manually or select a hub below.'
        );
        return;
      }

      setIsCapturingGps(true);
      setGpsStatusMsg('Acquiring live device GPS coordinates...');

      captureSingleGpsPoint().then((captured) => {
        if (isCancelled) return;
        if (captured.latitude !== null && captured.longitude !== null) {
          setPlaceName(captured.placeName);
          setLatitude(captured.latitude);
          setLongitude(captured.longitude);
          setAccuracy(captured.accuracy);
          setSource(LocationSource.GPS);
          setGpsStatusMsg(
            captured.statusMessage ||
              `GPS position acquired: ${captured.placeName}`
          );
        } else {
          setSource(LocationSource.MANUAL);
          setGpsStatusMsg(null);
          setErrorMsg(
            captured.statusMessage ||
              'Could not acquire automatic GPS fix. Please allow browser location access or pick a location below.'
          );
        }
        setIsCapturingGps(false);
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [isOpen, mode, settings.location_permission_status]);

  const filteredLandmarks = useMemo(() => {
    const q = hubSearch.trim().toLowerCase();
    if (!q) return ADDIS_ABABA_LANDMARKS;
    return ADDIS_ABABA_LANDMARKS.filter(
      (lm) =>
        lm.name.toLowerCase().includes(q) ||
        lm.subCity.toLowerCase().includes(q)
    );
  }, [hubSearch]);

  if (!isOpen) return null;

  const handleSelectLandmark = (landmark: (typeof ADDIS_ABABA_LANDMARKS)[number]) => {
    setPlaceName(landmark.name);
    setLatitude(landmark.latitude);
    setLongitude(landmark.longitude);
    setAccuracy(10.0);
    setSource(LocationSource.GPS);
    setGpsStatusMsg(
      `Pinned to ${landmark.name} (${landmark.latitude.toFixed(5)}°N, ${landmark.longitude.toFixed(5)}°E)`
    );
    setErrorMsg(null);
  };

  const handleCaptureGps = async () => {
    setErrorMsg(null);
    setGpsStatusMsg('Requesting high-accuracy device GPS fix...');

    if (settings.location_permission_status === 'DENIED') {
      setErrorMsg(
        'Location permission is currently DENIED in Settings. Enable GPS in Settings or choose a hub below.'
      );
      setGpsStatusMsg(null);
      setSource(LocationSource.MANUAL);
      return;
    }

    setIsCapturingGps(true);
    const captured = await captureSingleGpsPoint();
    if (captured.latitude !== null && captured.longitude !== null) {
      // Also re-verify reverse geocoding for the fresh coordinates
      const freshName =
        captured.placeName ||
        (await reverseGeocodeWithOfflineFallback(
          captured.latitude,
          captured.longitude
        ));
      setPlaceName(freshName);
      setLatitude(captured.latitude);
      setLongitude(captured.longitude);
      setAccuracy(captured.accuracy);
      setSource(LocationSource.GPS);
      setGpsStatusMsg(
        captured.statusMessage ||
          `Live GPS lock: ${freshName} (${captured.latitude.toFixed(5)}°N, ${captured.longitude.toFixed(5)}°E)`
      );
    } else {
      setGpsStatusMsg(null);
      setErrorMsg(
        captured.statusMessage ||
          'Unable to read device GPS. Check browser location permissions or select a hub below.'
      );
    }
    setIsCapturingGps(false);
  };

  const handleManualInput = (val: string) => {
    setPlaceName(val);
    setSource(LocationSource.MANUAL);
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeName.trim()) {
      setErrorMsg('Please wait for GPS fix, select a hub, or enter a location name.');
      return;
    }

    if (mode === 'START') {
      onConfirmStart({
        startLocationName: placeName.trim(),
        latitude,
        longitude,
        accuracy,
        source,
        notes: notes.trim() || undefined,
      });
    } else if (mode === 'END' && activeTrip) {
      onConfirmEnd(activeTrip.id, {
        endLocationName: placeName.trim(),
        latitude,
        longitude,
        accuracy,
        source,
        notes: notes.trim() || undefined,
      });
    }
    onClose();
  };

  // Compute OpenStreetMap preview bbox when coordinates are available
  const osmDelta = 0.0045;
  const osmPreviewUrl =
    latitude !== null && longitude !== null
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${(
          longitude - osmDelta
        ).toFixed(5)}%2C${(latitude - osmDelta * 0.65).toFixed(5)}%2C${(
          longitude + osmDelta
        ).toFixed(5)}%2C${(latitude + osmDelta * 0.65).toFixed(
          5
        )}&layer=mapnik&marker=${latitude.toFixed(5)}%2C${longitude.toFixed(5)}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] p-5 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#E3EAE5] dark:border-[#253831]">
          <div>
            <h2 className="text-lg font-bold text-[#172B25] dark:text-[#EDF6F0]">
              {mode === 'START' ? 'Start New Trip' : 'Complete Active Trip'}
            </h2>
            <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
              {mode === 'START'
                ? 'Captures your live device GPS position or lets you pick any hub'
                : `Started from ${activeTrip?.start_location_name}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#75847D] hover:text-[#172B25] dark:hover:text-[#EDF6F0] hover:bg-[#F5F7F5] dark:hover:bg-[#101A17] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                {mode === 'START' ? 'Starting Location' : 'Destination Location'}
              </label>
              <span className="text-xs text-[#75847D] dark:text-[#94A8A0] font-mono tabular-nums">
                {latitude !== null && longitude !== null
                  ? `GPS: ${latitude.toFixed(5)}°N, ${longitude.toFixed(5)}°E${
                      accuracy ? ` (±${accuracy}m)` : ''
                    }`
                  : `Source: ${source}`}
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="w-4 h-4 text-[#16866A] dark:text-[#43C99A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={placeName}
                  onChange={(e) => handleManualInput(e.target.value)}
                  placeholder={
                    isCapturingGps
                      ? 'Detecting your current GPS location...'
                      : 'Enter street/area or tap Use My GPS'
                  }
                  className="w-full h-11 pl-10 pr-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] text-sm text-[#172B25] dark:text-[#EDF6F0] focus:outline-none focus:border-[#16866A]"
                />
              </div>
              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={isCapturingGps}
                className="h-11 px-3.5 rounded-xl bg-[#16866A] text-white dark:bg-[#43C99A] dark:text-[#101A17] text-xs font-bold flex items-center gap-1.5 hover:opacity-95 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Crosshair className={`w-4 h-4 ${isCapturingGps ? 'animate-spin' : ''}`} />
                {isCapturingGps ? 'Locating...' : 'Use My GPS'}
              </button>
            </div>

            {gpsStatusMsg && (
              <div className="mt-2 p-2.5 rounded-xl bg-[#DDF5E9]/70 dark:bg-[#1D352D]/70 border border-[#16866A]/30 flex items-center gap-2 text-xs text-[#123C35] dark:text-[#EDF6F0]">
                <CheckCircle2 className="w-4 h-4 text-[#16866A] dark:text-[#43C99A] shrink-0" />
                <span className="font-mono text-[11px] leading-snug">{gpsStatusMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="mt-2 p-2.5 rounded-xl bg-[#D9534F]/10 border border-[#D9534F]/30 flex items-center gap-2 text-xs text-[#D9534F]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Live Map Pin Verification Preview */}
          {osmPreviewUrl && (
            <div className="rounded-xl overflow-hidden border border-[#E3EAE5] dark:border-[#253831] bg-[#0D1F1B]">
              <div className="px-3 py-1.5 bg-[#123C35] text-white flex items-center justify-between text-[11px]">
                <span className="font-semibold flex items-center gap-1.5">
                  <Navigation className="w-3 h-3 text-[#43C99A]" />
                  Verified GPS Endpoint Pin
                </span>
                <span className="font-mono text-[#43C99A]">
                  {latitude?.toFixed(5)}, {longitude?.toFixed(5)}
                </span>
              </div>
              <iframe
                title="GPS Endpoint Verification Map"
                src={osmPreviewUrl}
                className="w-full h-32 border-0"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* Searchable Addis Ababa Hubs */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-semibold text-[#75847D] dark:text-[#94A8A0]">
                Addis Ababa Neighborhoods & Taxi Hubs ({ADDIS_ABABA_LANDMARKS.length})
              </p>
              <div className="relative w-44">
                <Search className="w-3.5 h-3.5 text-[#75847D] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={hubSearch}
                  onChange={(e) => setHubSearch(e.target.value)}
                  placeholder="Search area (e.g. 6 Kilo, Gerji)"
                  className="w-full h-7 pl-7 pr-2 rounded-lg bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] text-[11px] text-[#172B25] dark:text-[#EDF6F0] focus:outline-none focus:border-[#16866A]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {filteredLandmarks.map((lm) => {
                const isSelected = placeName === lm.name;
                return (
                  <button
                    key={lm.name}
                    type="button"
                    onClick={() => handleSelectLandmark(lm)}
                    className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors border truncate cursor-pointer ${
                      isSelected
                        ? 'bg-[#123C35] text-white border-[#123C35] dark:bg-[#43C99A] dark:text-[#101A17] dark:border-[#43C99A] font-semibold'
                        : 'bg-[#F5F7F5] dark:bg-[#101A17] text-[#172B25] dark:text-[#EDF6F0] border-[#E3EAE5] dark:border-[#253831] hover:border-[#16866A]'
                    }`}
                    title={`${lm.name} (${lm.subCity})`}
                  >
                    {lm.name.replace(', Addis Ababa', '')}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1.5">
              Trip Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Shared taxi route or passenger note"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] text-sm text-[#172B25] dark:text-[#EDF6F0] focus:outline-none focus:border-[#16866A]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E3EAE5] dark:border-[#253831] text-xs font-semibold text-[#75847D] dark:text-[#94A8A0] hover:text-[#172B25] dark:hover:text-[#EDF6F0] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCapturingGps}
              className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-opacity hover:opacity-95 disabled:opacity-50 cursor-pointer ${
                mode === 'START'
                  ? 'bg-[#16866A] dark:bg-[#43C99A] dark:text-[#101A17]'
                  : 'bg-[#123C35] dark:bg-[#43C99A] dark:text-[#101A17]'
              }`}
            >
              <Navigation className="w-4 h-4" />
              {mode === 'START' ? 'Start Trip Now' : 'Complete & Save Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
