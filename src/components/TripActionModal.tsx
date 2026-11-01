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
import { getTranslation, Language } from '../utils/i18n';

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
  const isDark = settings.theme === 'dark';
  const lang = (settings.language || 'en') as Language;

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
  }, [isOpen, mode, settings.location_permission_status, activeTrip?.notes]);

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
      setErrorMsg(lang === 'am' ? 'እባክዎ የGPS አካባቢ ይጠብቁ፣ አካባቢ ይምረጡ ወይም ስም ይጻፉ።' : 'Please wait for GPS fix, select a hub, or enter a location name.');
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div
        className={`w-full max-w-[430px] rounded-t-3xl sm:rounded-3xl border p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto ${
          isDark
            ? 'bg-[#141B2D] border-white/10 text-white'
            : 'bg-white border-slate-200 text-[#0F172A]'
        }`}
      >
        <div
          className={`flex items-center justify-between pb-3.5 border-b ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}
        >
          <div>
            <h2 className="text-lg font-extrabold">
              {mode === 'START' ? getTranslation('start_new_trip_title', lang) : getTranslation('end_active_trip_title', lang)}
            </h2>
            <p className="text-xs text-[#8E9BAE] mt-0.5">
              {mode === 'START'
                ? getTranslation('start_new_trip_desc', lang)
                : (lang === 'am' ? `የተጀመረው ከ ${activeTrip?.start_location_name}` : `Started from ${activeTrip?.start_location_name}`)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#8E9BAE] transition-colors cursor-pointer ${
              isDark ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-slate-100 hover:text-[#0F172A]'
            }`}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold">
                {mode === 'START' ? getTranslation('start_location_label', lang) : getTranslation('end_location_label', lang)}
              </label>
              <span className="text-xs text-[#5CA4F8] font-mono tabular-nums">
                {latitude !== null && longitude !== null
                  ? `GPS: ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`
                  : `Source: ${source}`}
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="w-4 h-4 text-[#2CD48D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={placeName}
                  onChange={(e) => handleManualInput(e.target.value)}
                  placeholder={
                    isCapturingGps
                      ? (lang === 'am' ? 'የአሁኑን GPS አካባቢ በመፈለግ ላይ...' : 'Detecting your current GPS location...')
                      : (lang === 'am' ? 'አካባቢ ይጻፉ ወይም የአሁኑን GPS ተጫኑ' : 'Enter street/area or tap Use My GPS')
                  }
                  className={`w-full h-11 pl-10 pr-3 rounded-xl border text-sm focus:outline-none focus:border-[#2CD48D] ${
                    isDark
                      ? 'bg-[#0B0F1A] border-white/10 text-white placeholder:text-[#8E9BAE]'
                      : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A] placeholder:text-[#8E9BAE]'
                  }`}
                />
              </div>
              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={isCapturingGps}
                className="h-11 px-3.5 rounded-xl bg-[#2CD48D] text-[#052115] text-xs font-extrabold flex items-center gap-1.5 hover:opacity-95 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Crosshair className={`w-4 h-4 ${isCapturingGps ? 'animate-spin' : ''}`} />
                {isCapturingGps ? (lang === 'am' ? 'በመፈለግ ላይ...' : 'Locating...') : (lang === 'am' ? 'የአሁኑን GPS ተጠቀም' : 'Use My GPS')}
              </button>
            </div>

            {gpsStatusMsg && (
              <div
                className={`mt-2 p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                  isDark
                    ? 'bg-[#0B0F1A] border-[#2CD48D]/40 text-white'
                    : 'bg-[#E8F1FF]/60 border-[#5CA4F8]/50 text-[#0F172A]'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-[#2CD48D] shrink-0" />
                <span className="font-mono text-[11px] leading-snug">{gpsStatusMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="mt-2 p-2.5 rounded-xl bg-[#F87171]/15 border border-[#F87171]/40 flex items-center gap-2 text-xs text-[#F87171]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>


          {/* Searchable Addis Ababa Hubs */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-bold text-[#8E9BAE]">
                {lang === 'am' ? `የአዲስ አበባ ታዋቂ አካባቢዎች (${ADDIS_ABABA_LANDMARKS.length})` : `Addis Ababa Hubs (${ADDIS_ABABA_LANDMARKS.length})`}
              </p>
              <div className="relative w-44">
                <Search className="w-3.5 h-3.5 text-[#8E9BAE] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={hubSearch}
                  onChange={(e) => setHubSearch(e.target.value)}
                  placeholder={getTranslation('search_hubs_placeholder', lang)}
                  className={`w-full h-7 pl-7 pr-2 rounded-lg border text-[11px] focus:outline-none focus:border-[#2CD48D] ${
                    isDark
                      ? 'bg-[#0B0F1A] border-white/10 text-white placeholder:text-[#8E9BAE]'
                      : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A] placeholder:text-[#8E9BAE]'
                  }`}
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
                    className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors border truncate cursor-pointer ${
                      isSelected
                        ? 'bg-[#2CD48D] text-[#052115] border-[#2CD48D] font-extrabold'
                        : isDark
                        ? 'bg-[#0B0F1A] text-white border-white/10 hover:border-[#5CA4F8]'
                        : 'bg-[#F7F9FC] text-[#0F172A] border-slate-200 hover:border-[#5CA4F8]'
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
            <label className="block text-xs font-bold mb-1.5">
              {lang === 'am' ? 'የጉዞ ማስታወሻ (አማራጭ)' : 'Trip Notes (Optional)'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === 'am' ? 'ለምሳሌ፡ የታክሲ መስመር ወይም የተሳፋሪ ማስታወሻ' : 'e.g., Shared taxi route or passenger note'}
              className={`w-full h-11 px-3.5 rounded-xl border text-sm focus:outline-none focus:border-[#2CD48D] ${
                isDark
                  ? 'bg-[#0B0F1A] border-white/10 text-white placeholder:text-[#8E9BAE]'
                  : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A] placeholder:text-[#8E9BAE]'
              }`}
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                isDark
                  ? 'border-white/10 text-[#8E9BAE] hover:text-white'
                  : 'border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {getTranslation('cancel', lang)}
            </button>
            <button
              type="submit"
              disabled={isCapturingGps}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#2CD48D] text-[#052115] text-xs font-extrabold flex items-center gap-2 transition-opacity hover:opacity-95 disabled:opacity-50 cursor-pointer"
            >
              <Navigation className="w-4 h-4" />
              {mode === 'START' ? (lang === 'am' ? 'አሁን ጉዞ ጀምር' : 'Start Trip Now') : (lang === 'am' ? 'ጉዞ ጨርስ እና መዝግብ' : 'Complete & Save Trip')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
