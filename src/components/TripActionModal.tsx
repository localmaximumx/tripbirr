import React, { useState } from 'react';
import { Crosshair, MapPin, Navigation, X } from 'lucide-react';
import { LocationSource, TripRecord } from '../database/schema';
import {
  ADDIS_ABABA_LANDMARKS,
  captureSingleGpsPoint,
} from '../services/location/locationService';

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
  const [placeName, setPlaceName] = useState(
    mode === 'START' ? '4 Kilo, Addis Ababa' : 'Piassa, Addis Ababa'
  );
  const [latitude, setLatitude] = useState<number | null>(
    mode === 'START' ? 9.0331 : 9.0358
  );
  const [longitude, setLongitude] = useState<number | null>(
    mode === 'START' ? 38.7636 : 38.7524
  );
  const [accuracy, setAccuracy] = useState<number | null>(12.0);
  const [source, setSource] = useState<LocationSource>(LocationSource.GPS);
  const [notes, setNotes] = useState(activeTrip?.notes || '');
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectLandmark = (landmark: (typeof ADDIS_ABABA_LANDMARKS)[number]) => {
    setPlaceName(landmark.name);
    setLatitude(landmark.latitude);
    setLongitude(landmark.longitude);
    setAccuracy(11.5);
    setSource(LocationSource.GPS);
    setErrorMsg(null);
  };

  const handleCaptureGps = async () => {
    setIsCapturingGps(true);
    setErrorMsg(null);
    const captured = await captureSingleGpsPoint(placeName);
    setPlaceName(captured.placeName);
    setLatitude(captured.latitude);
    setLongitude(captured.longitude);
    setAccuracy(captured.accuracy);
    setSource(LocationSource.GPS);
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
      setErrorMsg('Please enter or select a location name.');
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#E3EAE5] dark:border-[#253831]">
          <div>
            <h2 className="text-lg font-bold text-[#172B25] dark:text-[#EDF6F0]">
              {mode === 'START' ? 'Start New Trip' : 'Complete Active Trip'}
            </h2>
            <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
              {mode === 'START'
                ? 'Record starting point (single-point GPS or manual entry — no continuous tracking)'
                : `Starting from ${activeTrip?.start_location_name}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#75847D] hover:text-[#172B25] dark:hover:text-[#EDF6F0] hover:bg-[#F5F7F5] dark:hover:bg-[#101A17] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                {mode === 'START' ? 'Starting Location' : 'Destination Location'}
              </label>
              <span className="text-xs text-[#75847D] dark:text-[#94A8A0] font-mono tabular-nums">
                Source: {source}
                {latitude && longitude ? ` · ${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : ''}
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="w-4 h-4 text-[#16866A] dark:text-[#43C99A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={placeName}
                  onChange={(e) => handleManualInput(e.target.value)}
                  placeholder="e.g., 4 Kilo, Addis Ababa"
                  className="w-full h-11 pl-10 pr-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] text-sm text-[#172B25] dark:text-[#EDF6F0] focus:outline-none focus:border-[#16866A]"
                />
              </div>
              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={isCapturingGps}
                className="h-11 px-3.5 rounded-xl bg-[#DDF5E9] dark:bg-[#1D352D] text-[#123C35] dark:text-[#43C99A] text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                <Crosshair className="w-4 h-4" />
                {isCapturingGps ? 'Locating...' : 'Use GPS'}
              </button>
            </div>
            {errorMsg && (
              <p className="text-xs text-[#D9534F] mt-1.5 font-medium">{errorMsg}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0] mb-2">
              Quick Addis Ababa Hubs
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {ADDIS_ABABA_LANDMARKS.slice(0, 9).map((lm) => {
                const isSelected = placeName === lm.name;
                return (
                  <button
                    key={lm.name}
                    type="button"
                    onClick={() => handleSelectLandmark(lm)}
                    className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors border truncate ${
                      isSelected
                        ? 'bg-[#123C35] text-white border-[#123C35] dark:bg-[#43C99A] dark:text-[#101A17] dark:border-[#43C99A] font-semibold'
                        : 'bg-[#F5F7F5] dark:bg-[#101A17] text-[#172B25] dark:text-[#EDF6F0] border-[#E3EAE5] dark:border-[#253831] hover:border-[#16866A]'
                    }`}
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
              placeholder="e.g., Shared taxi route via Arat Kilo"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] text-sm text-[#172B25] dark:text-[#EDF6F0] focus:outline-none focus:border-[#16866A]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E3EAE5] dark:border-[#253831] text-xs font-semibold text-[#75847D] dark:text-[#94A8A0] hover:text-[#172B25] dark:hover:text-[#EDF6F0] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-opacity hover:opacity-95 ${
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
