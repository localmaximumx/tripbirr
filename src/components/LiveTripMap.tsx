import React, { useEffect, useState } from 'react';
import {
  Compass,
  Crosshair,
  Layers,
  MapPin,
  Navigation,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { TransactionRecord, TripRecord, TripStatus } from '../database/schema';
import {
  ADDIS_ABABA_LANDMARKS,
  calculateDistanceMeters,
  captureSingleGpsPoint,
  reverseGeocodeWithOfflineFallback,
} from '../services/location/locationService';
import { formatMinorUnits } from '../utils/formatters';

interface LiveTripMapProps {
  trip: TripRecord;
  associatedTransactions: TransactionRecord[];
  currency: 'ETB' | 'Birr';
  compact?: boolean;
}

// Default bounding box for Addis Ababa coordinate projection
const BASE_MIN_LAT = 8.975;
const BASE_MAX_LAT = 9.055;
const BASE_MIN_LNG = 38.715;
const BASE_MAX_LNG = 38.865;

// Major Addis Ababa arterial corridors for offline vector reference
const ADDIS_ARTERIAL_CORRIDORS = [
  // North-South: 6 Kilo -> 4 Kilo -> Piassa -> Kazanchis -> Meskel Square -> Gotera
  [
    { lat: 9.0478, lng: 38.7614 }, // 6 Kilo
    { lat: 9.0358, lng: 38.7524 }, // Piassa
    { lat: 9.0331, lng: 38.7636 }, // 4 Kilo
    { lat: 9.0168, lng: 38.7675 }, // Kazanchis
    { lat: 9.0108, lng: 38.7612 }, // Meskel Square
    { lat: 8.9854, lng: 38.7601 }, // Gotera
  ],
  // East-West Corridor: Autobus Tera -> Merkato -> Mexico -> Meskel -> Megenagna -> CMC
  [
    { lat: 9.0352, lng: 38.7321 }, // Autobus Tera
    { lat: 9.0308, lng: 38.7369 }, // Merkato
    { lat: 9.0104, lng: 38.7445 }, // Mexico Square
    { lat: 9.0108, lng: 38.7612 }, // Meskel Square
    { lat: 9.0205, lng: 38.8024 }, // Megenagna
    { lat: 9.0229, lng: 38.8467 }, // CMC Michael
  ],
  // Bole Avenue: Sarbet -> Mexico -> Meskel Square -> Bole Medhanialem
  [
    { lat: 8.9942, lng: 38.7378 }, // Sarbet
    { lat: 9.0104, lng: 38.7445 }, // Mexico
    { lat: 9.0108, lng: 38.7612 }, // Meskel Square
    { lat: 8.9974, lng: 38.7868 }, // Bole Medhanialem
  ],
];

export const LiveTripMap: React.FC<LiveTripMapProps> = ({
  trip,
  associatedTransactions,
  currency,
  compact = false,
}) => {
  const isTripActive = trip.status === TripStatus.ACTIVE;

  const startLat = trip.start_latitude ?? 9.0331;
  const startLng = trip.start_longitude ?? 38.7636;

  const [liveLat, setLiveLat] = useState<number>(
    trip.end_latitude ?? startLat
  );
  const [liveLng, setLiveLng] = useState<number>(
    trip.end_longitude ?? startLng
  );
  const [liveAccuracy, setLiveAccuracy] = useState<number>(
    trip.start_location_accuracy ?? 10.0
  );
  const [livePlaceLabel, setLivePlaceLabel] = useState<string>(
    trip.end_location_name || trip.start_location_name
  );
  const [mapMode, setMapMode] = useState<'VECTOR_OFFLINE' | 'STREET_MAP'>('VECTOR_OFFLINE');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isUpdatingGps, setIsUpdatingGps] = useState<boolean>(false);
  const [trailPoints, setTrailPoints] = useState<{ lat: number; lng: number }[]>([
    { lat: startLat, lng: startLng },
  ]);

  // Dynamically expand projection bounds so real device coordinates are never clamped off-screen
  const minLat = Math.min(BASE_MIN_LAT, startLat - 0.008, liveLat - 0.008);
  const maxLat = Math.max(BASE_MAX_LAT, startLat + 0.008, liveLat + 0.008);
  const minLng = Math.min(BASE_MIN_LNG, startLng - 0.01, liveLng - 0.01);
  const maxLng = Math.max(BASE_MAX_LNG, startLng + 0.01, liveLng + 0.01);

  const projectToSvg = (lat: number, lng: number): { x: number; y: number } => {
    const clampedLat = Math.max(minLat, Math.min(maxLat, lat));
    const clampedLng = Math.max(minLng, Math.min(maxLng, lng));

    const x = ((clampedLng - minLng) / (maxLng - minLng)) * 720 + 40;
    const y = (1 - (clampedLat - minLat) / (maxLat - minLat)) * 300 + 30;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  };

  // Reset coordinates when trip changes
  useEffect(() => {
    const sLat = trip.start_latitude ?? 9.0331;
    const sLng = trip.start_longitude ?? 38.7636;
    if (trip.status === TripStatus.COMPLETED && trip.end_latitude && trip.end_longitude) {
      setLiveLat(trip.end_latitude);
      setLiveLng(trip.end_longitude);
      setLivePlaceLabel(trip.end_location_name || 'Destination');
      setTrailPoints([
        { lat: sLat, lng: sLng },
        { lat: trip.end_latitude, lng: trip.end_longitude },
      ]);
    } else {
      setLiveLat(sLat);
      setLiveLng(sLng);
      setLivePlaceLabel(trip.start_location_name);
      setTrailPoints([{ lat: sLat, lng: sLng }]);
    }
  }, [
    trip.id,
    trip.status,
    trip.start_latitude,
    trip.start_longitude,
    trip.end_latitude,
    trip.end_longitude,
    trip.start_location_name,
    trip.end_location_name,
  ]);

  // Subscribe to real device geolocation updates while trip is ACTIVE
  useEffect(() => {
    if (!isTripActive || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const nextLat = Number(pos.coords.latitude.toFixed(6));
        const nextLng = Number(pos.coords.longitude.toFixed(6));
        const nextAcc = pos.coords.accuracy ? Number(pos.coords.accuracy.toFixed(1)) : 10.0;
        setLiveLat(nextLat);
        setLiveLng(nextLng);
        setLiveAccuracy(nextAcc);
        setTrailPoints((prev) => {
          const last = prev[prev.length - 1];
          if (
            !last ||
            Math.abs(last.lat - nextLat) > 0.0002 ||
            Math.abs(last.lng - nextLng) > 0.0002
          ) {
            return [...prev.slice(-12), { lat: nextLat, lng: nextLng }];
          }
          return prev;
        });
        const resolved = await reverseGeocodeWithOfflineFallback(nextLat, nextLng);
        setLivePlaceLabel(resolved);
      },
      () => {
        // Ignore watch errors if browser blocks continuous watch
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isTripActive]);

  const handleRefreshLiveGps = async () => {
    setIsUpdatingGps(true);
    const captured = await captureSingleGpsPoint();
    if (captured.latitude !== null && captured.longitude !== null) {
      setLiveLat(captured.latitude);
      setLiveLng(captured.longitude);
      setLiveAccuracy(captured.accuracy || 10.0);
      setLivePlaceLabel(captured.placeName);
      setTrailPoints((prev) => [
        ...prev.slice(-12),
        { lat: captured.latitude!, lng: captured.longitude! },
      ]);
    }
    setIsUpdatingGps(false);
  };

  const startPt = projectToSvg(startLat, startLng);
  const currentPt = projectToSvg(liveLat, liveLng);

  const displacementKm = (
    calculateDistanceMeters(startLat, startLng, liveLat, liveLng) / 1000
  ).toFixed(2);

  // Compute viewBox based on zoomLevel centered around midpoint between start and current
  const centerX = (startPt.x + currentPt.x) / 2;
  const centerY = (startPt.y + currentPt.y) / 2;
  const viewWidth = 800 / zoomLevel;
  const viewHeight = 360 / zoomLevel;
  const viewMinX = Math.max(0, Math.min(800 - viewWidth, centerX - viewWidth / 2));
  const viewMinY = Math.max(0, Math.min(360 - viewHeight, centerY - viewHeight / 2));

  // OpenStreetMap embed bbox around current live position for Street Map mode
  const osmDelta = 0.015 / zoomLevel;
  const osmBbox = `${(liveLng - osmDelta).toFixed(5)}%2C${(liveLat - osmDelta * 0.6).toFixed(5)}%2C${(liveLng + osmDelta).toFixed(5)}%2C${(liveLat + osmDelta * 0.6).toFixed(5)}`;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${osmBbox}&layer=mapnik&marker=${liveLat.toFixed(5)}%2C${liveLng.toFixed(5)}`;

  return (
    <div className="rounded-2xl overflow-hidden bg-[#0D1F1B] border border-[#16866A]/40 text-white">
      {/* Top Map Control Bar */}
      <div className="px-4 py-3 bg-[#102923] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Compass className="w-4 h-4 text-[#43C99A]" />
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <span>
                {isTripActive
                  ? 'Live Active Trip Map'
                  : 'Completed Trip Endpoint Map (react-native-maps)'}
              </span>
              <span aria-hidden="true" className="text-white/40">
                ·
              </span>
              <span className="font-mono text-[#43C99A]">
                {liveLat.toFixed(4)}°N, {liveLng.toFixed(4)}°E (±{liveAccuracy}m)
              </span>
              <span aria-hidden="true" className="text-white/40">
                ·
              </span>
              <span className="font-mono text-[#FFE082]">{displacementKm} km</span>
            </div>
            <p className="text-[11px] text-[#DDF5E9]/75 truncate max-w-md">
              {isTripActive
                ? `Start: ${trip.start_location_name.replace(', Addis Ababa', '')} → Current: ${livePlaceLabel.replace(', Addis Ababa', '')}`
                : `Start (${startLat.toFixed(4)}, ${startLng.toFixed(4)}) → End (${liveLat.toFixed(4)}, ${liveLng.toFixed(4)})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isTripActive && (
            <button
              type="button"
              onClick={handleRefreshLiveGps}
              disabled={isUpdatingGps}
              className="h-8 px-2.5 rounded-lg bg-[#43C99A]/15 hover:bg-[#43C99A]/25 border border-[#43C99A]/40 text-[#43C99A] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Acquire fresh GPS fix or simulate movement along Addis Ababa route"
            >
              <Crosshair className={`w-3.5 h-3.5 ${isUpdatingGps ? 'animate-spin' : ''}`} />
              {isUpdatingGps ? 'Locating...' : 'Update GPS Fix'}
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              setMapMode((m) => (m === 'VECTOR_OFFLINE' ? 'STREET_MAP' : 'VECTOR_OFFLINE'))
            }
            className="h-8 px-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-[#DDF5E9] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Layers className="w-3.5 h-3.5 text-[#43C99A]" />
            {mapMode === 'VECTOR_OFFLINE' ? 'Street Map' : 'Offline Vector'}
          </button>

          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(2.2, Number((z + 0.3).toFixed(1))))}
            className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/15 flex items-center justify-center text-white transition-colors cursor-pointer"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(1, Number((z - 0.3).toFixed(1))))}
            className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/15 flex items-center justify-center text-white transition-colors cursor-pointer"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Map Viewport */}
      {mapMode === 'STREET_MAP' ? (
        <div className={`relative w-full ${compact ? 'h-60' : 'h-72'} bg-[#101A17]`}>
          <iframe
            title="Addis Ababa Live Trip Street Map"
            src={osmEmbedUrl}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0D1F1B]/90 backdrop-blur-xs border border-white/15 text-xs">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#43C99A]" />
              <span className="font-semibold text-white">{livePlaceLabel}</span>
            </div>
            <span className="font-mono text-[11px] text-[#DDF5E9]/80">
              {associatedTransactions.length} Telebirr/Cash payment(s) linked
            </span>
          </div>
        </div>
      ) : (
        <div className={`relative w-full ${compact ? 'h-60' : 'h-72'} bg-[#0B1916]`}>
          <svg
            viewBox={`${viewMinX} ${viewMinY} ${viewWidth} ${viewHeight}`}
            className="w-full h-full select-none"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <pattern
                id="addisGrid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="rgba(67, 201, 154, 0.08)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>

            {/* Coordinate Grid Background */}
            <rect x="0" y="0" width="800" height="360" fill="url(#addisGrid)" />

            {/* Addis Ababa Arterial Reference Corridors */}
            {ADDIS_ARTERIAL_CORRIDORS.map((corridor, idx) => {
              const pathPoints = corridor
                .map((pt) => {
                  const p = projectToSvg(pt.lat, pt.lng);
                  return `${p.x},${p.y}`;
                })
                .join(' ');
              return (
                <polyline
                  key={idx}
                  points={pathPoints}
                  fill="none"
                  stroke="rgba(221, 245, 233, 0.12)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {/* Background Addis Ababa Landmarks */}
            {ADDIS_ABABA_LANDMARKS.map((lm) => {
              const pt = projectToSvg(lm.latitude, lm.longitude);
              const shortName = lm.name.replace(', Addis Ababa', '');
              return (
                <g key={lm.name}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="3.5"
                    fill="rgba(221, 245, 233, 0.28)"
                  />
                  <text
                    x={pt.x + 6}
                    y={pt.y + 3}
                    fill="rgba(221, 245, 233, 0.45)"
                    fontSize="9.5"
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {shortName}
                  </text>
                </g>
              );
            })}

            {/* Start-to-End Dashed Polyline Connector */}
            <line
              x1={startPt.x}
              y1={startPt.y}
              x2={currentPt.x}
              y2={currentPt.y}
              stroke="#43C99A"
              strokeWidth="2.5"
              strokeDasharray="7 5"
              strokeOpacity="0.85"
            />

            {/* Observed GPS Breadcrumb Points (only when multiple live GPS fixes were captured) */}
            {trailPoints.length > 1 &&
              trailPoints.map((tp, index) => {
                const p = projectToSvg(tp.lat, tp.lng);
                return (
                  <circle
                    key={`${tp.lat}_${tp.lng}_${index}`}
                    cx={p.x}
                    cy={p.y}
                    r="2.5"
                    fill="#43C99A"
                    fillOpacity={0.5}
                  />
                );
              })}

            {/* Telebirr Payment Pins Linked to This Trip */}
            {associatedTransactions.map((tx, idx) => {
              // Position payment badges near the active trip corridor
              const ratio =
                associatedTransactions.length === 1
                  ? 0.5
                  : (idx + 1) / (associatedTransactions.length + 1);
              const px = startPt.x + (currentPt.x - startPt.x) * ratio;
              const py = startPt.y + (currentPt.y - startPt.y) * ratio - 18 - (idx % 2) * 16;

              return (
                <g key={tx.id}>
                  <line
                    x1={px}
                    y1={py + 8}
                    x2={startPt.x + (currentPt.x - startPt.x) * ratio}
                    y2={startPt.y + (currentPt.y - startPt.y) * ratio}
                    stroke="#43C99A"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <rect
                    x={px - 42}
                    y={py - 10}
                    width="84"
                    height="18"
                    rx="5"
                    fill="#123C35"
                    stroke="#43C99A"
                    strokeWidth="1"
                  />
                  <text
                    x={px}
                    y={py + 2}
                    textAnchor="middle"
                    fill="#43C99A"
                    fontSize="8.5"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    +{formatMinorUnits(tx.amount_minor_units, currency)}
                  </text>
                </g>
              );
            })}

            {/* Start Location Endpoint Marker */}
            <g>
              <circle
                cx={startPt.x}
                cy={startPt.y}
                r="11"
                fill="rgba(22, 134, 106, 0.25)"
              />
              <circle
                cx={startPt.x}
                cy={startPt.y}
                r="5.5"
                fill="#FFFFFF"
                stroke="#16866A"
                strokeWidth="2.5"
              />
              <rect
                x={startPt.x - 52}
                y={startPt.y + 9}
                width="104"
                height="18"
                rx="4"
                fill="rgba(16, 26, 23, 0.88)"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="0.8"
              />
              <text
                x={startPt.x}
                y={startPt.y + 21}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="8.5"
                fontWeight="600"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                START: {trip.start_location_name.replace(', Addis Ababa', '').slice(0, 14)}
              </text>
            </g>

            {/* Current Live Driver Marker (or Completed Destination Marker) */}
            <g>
              {/* GPS Accuracy Radius Ring */}
              <circle
                cx={currentPt.x}
                cy={currentPt.y}
                r="18"
                fill="rgba(67, 201, 154, 0.16)"
                stroke="rgba(67, 201, 154, 0.45)"
                strokeWidth="1"
              />
              <circle
                cx={currentPt.x}
                cy={currentPt.y}
                r="7"
                fill="#43C99A"
                stroke="#0B1916"
                strokeWidth="2"
              />
              <rect
                x={currentPt.x - 62}
                y={currentPt.y - 30}
                width="124"
                height="20"
                rx="5"
                fill="#43C99A"
              />
              <text
                x={currentPt.x}
                y={currentPt.y - 17}
                textAnchor="middle"
                fill="#101A17"
                fontSize="9"
                fontWeight="700"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                {isTripActive ? 'LIVE: ' : 'END: '}
                {livePlaceLabel.replace(', Addis Ababa', '').slice(0, 15)}
              </text>
            </g>
          </svg>

          {/* Bottom Map Legend Bar */}
          <div className="absolute bottom-2.5 left-3 right-3 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#0D1F1B]/85 backdrop-blur-xs border border-white/10 text-[11px] text-[#DDF5E9]/85">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#16866A] inline-block" />
                Start Point
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#43C99A] inline-block" />
                {isTripActive ? 'Live Driver GPS' : 'Destination Point'}
              </span>
              {associatedTransactions.length > 0 && (
                <span className="flex items-center gap-1.5 font-mono text-[#43C99A]">
                  <Navigation className="w-3 h-3" />
                  {associatedTransactions.length} payment pin(s)
                </span>
              )}
            </div>
            <span className="font-mono text-[10px] text-[#DDF5E9]/60">
              Addis Ababa Offline Vector Grid
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
