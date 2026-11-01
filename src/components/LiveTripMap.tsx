import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Crosshair,
  Layers,
  LocateFixed,
  MapPin,
  Navigation,
  StopCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { TransactionRecord, TripRecord, TripStatus } from '../database/schema';
import {
  ADDIS_ABABA_LANDMARKS,
  calculateDistanceMeters,
} from '../services/location/locationService';
import {
  getHybridRoadRoute,
  RoadRouteResult,
} from '../services/location/routingService';
import {
  captureSingleGpsPoint,
  reverseGeocodeWithOfflineFallback,
} from '../services/location/locationService';
import { useTripBirrStore } from '../store/useTripBirrStore';

interface LiveTripMapProps {
  trip: TripRecord;
  associatedTransactions?: TransactionRecord[];
  currency?: 'ETB' | 'Birr';
  compact?: boolean;
  edgeToEdge?: boolean;
  onEndTrip?: () => void;
}

// Bounding box for Addis Ababa SVG Vector fallback projection
const BASE_MIN_LAT = 8.965;
const BASE_MAX_LAT = 9.06;
const BASE_MIN_LNG = 38.71;
const BASE_MAX_LNG = 38.86;

const ADDIS_PRIMARY_ROADS = [
  {
    name: 'Africa Ave (Bole Rd)',
    points: [
      { lat: 9.0108, lng: 38.7612 },
      { lat: 9.0055, lng: 38.7678 },
      { lat: 8.9974, lng: 38.7868 },
      { lat: 8.9895, lng: 38.7955 },
      { lat: 8.9968, lng: 38.8095 },
    ],
  },
  {
    name: 'Churchill & King George VI St',
    points: [
      { lat: 8.9942, lng: 38.7378 },
      { lat: 9.0104, lng: 38.7445 },
      { lat: 9.0245, lng: 38.7512 },
      { lat: 9.0358, lng: 38.7524 },
      { lat: 9.0331, lng: 38.7636 },
      { lat: 9.0478, lng: 38.7614 },
    ],
  },
  {
    name: 'Haile Gebrselassie Ave',
    points: [
      { lat: 9.0108, lng: 38.7612 },
      { lat: 9.0168, lng: 38.7675 },
      { lat: 9.0152, lng: 38.7795 },
      { lat: 9.0205, lng: 38.8024 },
      { lat: 9.0218, lng: 38.8245 },
      { lat: 9.0229, lng: 38.8467 },
    ],
  },
  {
    name: 'Addis Ring Corridor',
    points: [
      { lat: 9.0352, lng: 38.7321 },
      { lat: 9.0308, lng: 38.7369 },
      { lat: 9.0104, lng: 38.7445 },
      { lat: 8.9854, lng: 38.7601 },
      { lat: 8.9725, lng: 38.7695 },
    ],
  },
];

const ADDIS_SECONDARY_STREETS = [
  [
    { lat: 9.0331, lng: 38.7636 },
    { lat: 9.0168, lng: 38.7675 },
    { lat: 9.0055, lng: 38.7678 },
    { lat: 8.9854, lng: 38.7601 },
  ],
  [
    { lat: 9.0358, lng: 38.7524 },
    { lat: 9.0108, lng: 38.7612 },
  ],
  [
    { lat: 9.0152, lng: 38.7795 },
    { lat: 8.9974, lng: 38.7868 },
    { lat: 8.9854, lng: 38.7601 },
  ],
  [
    { lat: 9.0205, lng: 38.8024 },
    { lat: 8.9974, lng: 38.7868 },
  ],
  [
    { lat: 9.0478, lng: 38.7614 },
    { lat: 9.0205, lng: 38.8024 },
  ],
];

// Build curved lat/lng points between start and current/end for Leaflet GPS polyline
function buildCurvedLatLngs(
  sLat: number,
  sLng: number,
  eLat: number,
  eLng: number,
  steps = 24
): [number, number][] {
  const midLat = (sLat + eLat) / 2;
  const midLng = (sLng + eLng) / 2;
  const dLat = eLat - sLat;
  const dLng = eLng - sLng;
  const ctrlLat = midLat + dLng * 0.14;
  const ctrlLng = midLng - dLat * 0.14;

  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    const lat = inv * inv * sLat + 2 * inv * t * ctrlLat + t * t * eLat;
    const lng = inv * inv * sLng + 2 * inv * t * ctrlLng + t * t * eLng;
    points.push([lat, lng]);
  }
  return points;
}

export const LiveTripMap: React.FC<LiveTripMapProps> = ({
  trip,
  compact = false,
  edgeToEdge = false,
  onEndTrip,
}) => {
  const { settings, updateTripDetails } = useTripBirrStore();
  const isDark = settings.theme === 'dark';
  const isTripActive = trip.status === TripStatus.ACTIVE;

  // Map mode: 'GPS' (Interactive Leaflet OpenStreetMap street tiles) or 'VECTOR' (SVG vector map)
  const [mapMode, setMapMode] = useState<'GPS' | 'VECTOR'>('GPS');

  const startLat = trip.start_latitude ?? 9.0168;
  const startLng = trip.start_longitude ?? 38.7675;

  const [liveLat, setLiveLat] = useState<number>(
    trip.end_latitude ?? startLat + 0.0065
  );
  const [liveLng, setLiveLng] = useState<number>(
    trip.end_longitude ?? startLng + 0.0082
  );
  const [livePlaceLabel, setLivePlaceLabel] = useState<string>(
    trip.end_location_name || 'Urael / Atlas, Addis Ababa'
  );
  const [isUpdatingGps, setIsUpdatingGps] = useState<boolean>(false);
  const [roadRoute, setRoadRoute] = useState<RoadRouteResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    getHybridRoadRoute(
      startLat,
      startLng,
      liveLat,
      liveLng,
      trip.route_polyline,
      trip.route_distance_meters
    ).then((result) => {
      if (isMounted) {
        setRoadRoute(result);
        if (!trip.route_distance_meters || !trip.route_polyline) {
          updateTripDetails(trip.id, {
            route_distance_meters: result.distanceMeters,
            route_polyline: result.polyline,
            route_source: result.source,
          });
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [trip.id, startLat, startLng, liveLat, liveLng]);

  // Leaflet GPS Map refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Interactive Pan & Two-Finger Pinch-to-Zoom state for Vector Mode
  const [scale, setScale] = useState<number>(1.45);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const gestureRef = useRef<{
    mode: 'NONE' | 'PAN' | 'PINCH';
    startX: number;
    startY: number;
    initialPanX: number;
    initialPanY: number;
    initialDist: number;
    initialScale: number;
  }>({
    mode: 'NONE',
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
    initialDist: 0,
    initialScale: 1.45,
  });

  // Sync coordinates when trip changes
  useEffect(() => {
    const sLat = trip.start_latitude ?? 9.0168;
    const sLng = trip.start_longitude ?? 38.7675;
    if (trip.status === TripStatus.COMPLETED && trip.end_latitude && trip.end_longitude) {
      setLiveLat(trip.end_latitude);
      setLiveLng(trip.end_longitude);
      setLivePlaceLabel(trip.end_location_name || 'Destination');
    } else {
      const nextLat = trip.end_latitude ?? sLat + 0.0065;
      const nextLng = trip.end_longitude ?? sLng + 0.0082;
      setLiveLat(nextLat);
      setLiveLng(nextLng);
      setLivePlaceLabel(trip.end_location_name || 'Urael / Atlas, Addis Ababa');
    }
    setPan({ x: 0, y: 0 });
    setScale(1.45);
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
        setLiveLat(nextLat);
        setLiveLng(nextLng);
        const resolved = await reverseGeocodeWithOfflineFallback(nextLat, nextLng);
        setLivePlaceLabel(resolved);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isTripActive]);

  const startShort = trip.start_location_name.replace(', Addis Ababa', '');
  const currentShort = livePlaceLabel.replace(', Addis Ababa', '');

  // Initialize Leaflet Interactive GPS Map (using official keyless OpenStreetMap tiles)
  useEffect(() => {
    if (mapMode !== 'GPS' || !mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [(startLat + liveLat) / 2, (startLng + liveLng) / 2],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
      });

      // Keyless official OpenStreetMap street tiles (zero CartoDB API key watermark)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        crossOrigin: true,
      }).addTo(map);

      const group = L.layerGroup().addTo(map);
      leafletMapRef.current = map;
      layerGroupRef.current = group;

      // Ensure container dimensions are accurate after bottom sheet slide-up animation
      setTimeout(() => {
        map.invalidateSize();
      }, 280);
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, [mapMode]);

  // Update Leaflet Route & Pins (Only Start Pin + Current/Destination Pin + Curved Route)
  useEffect(() => {
    if (mapMode !== 'GPS' || !leafletMapRef.current || !layerGroupRef.current) {
      return;
    }

    const map = leafletMapRef.current;
    const group = layerGroupRef.current;
    group.clearLayers();

    const routePts =
      roadRoute?.polyline && roadRoute.polyline.length >= 2
        ? roadRoute.polyline
        : buildCurvedLatLngs(startLat, startLng, liveLat, liveLng);

    // Outer glow polyline
    L.polyline(routePts, {
      color: '#5CA4F8',
      weight: 9,
      opacity: 0.28,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(group);

    // Primary emerald/blue route line
    L.polyline(routePts, {
      color: '#2CD48D',
      weight: 4.5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(group);

    // Animated white flow dash
    L.polyline(routePts, {
      color: '#FFFFFF',
      weight: 2,
      opacity: 0.75,
      dashArray: '6, 12',
      className: 'tb-route-dash',
    }).addTo(group);

    // Start Pin Marker (Clean modern badge + glowing dot)
    const startIcon = L.divIcon({
      className: 'bg-transparent border-0',
      iconSize: [120, 48],
      iconAnchor: [60, 38],
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
          <div style="background:#141B2D;color:#FFFFFF;border:1.5px solid #5CA4F8;padding:2px 9px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.45);margin-bottom:4px;">
            ${startShort.slice(0, 16)}
          </div>
          <div style="width:16px;height:16px;border-radius:999px;background:#FFFFFF;border:4px solid #5CA4F8;box-shadow:0 0 0 5px rgba(92,164,248,0.28),0 4px 10px rgba(0,0,0,0.5);"></div>
        </div>
      `,
    });

    // Current / Destination Navigation Puck Pin
    const currentIcon = L.divIcon({
      className: 'bg-transparent border-0',
      iconSize: [130, 56],
      iconAnchor: [65, 42],
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
          <div style="background:#2CD48D;color:#052115;padding:2.5px 10px;border-radius:999px;font-size:10.5px;font-weight:800;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,0.45);margin-bottom:4px;">
            ${currentShort.slice(0, 16)}
          </div>
          <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
            <div class="tb-pulse-ring" style="position:absolute;inset:-6px;border-radius:999px;background:rgba(44,212,141,0.38);"></div>
            <div style="position:relative;width:22px;height:22px;border-radius:999px;background:#2CD48D;border:2.5px solid #0B0F1A;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.55);">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#052115">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
              </svg>
            </div>
          </div>
        </div>
      `,
    });

    L.marker([startLat, startLng], { icon: startIcon }).addTo(group);
    L.marker([liveLat, liveLng], { icon: currentIcon }).addTo(group);

    const bounds = L.latLngBounds([
      [startLat, startLng],
      [liveLat, liveLng],
    ]);
    map.fitBounds(bounds, { padding: [46, 46], maxZoom: 16 });
  }, [mapMode, startLat, startLng, liveLat, liveLng, startShort, currentShort]);

  const displacementKm = (
    calculateDistanceMeters(startLat, startLng, liveLat, liveLng) / 1000
  ).toFixed(2);
  const distanceKmDisplay = roadRoute
    ? roadRoute.formattedDistanceKm
    : displacementKm;

  // Actively acquire live GPS coordinates, update the map & trip, and fly to user position
  const handleRefreshLiveGps = async () => {
    setIsUpdatingGps(true);
    const captured = await captureSingleGpsPoint();
    if (captured.latitude !== null && captured.longitude !== null) {
      setLiveLat(captured.latitude);
      setLiveLng(captured.longitude);
      setLivePlaceLabel(captured.placeName);

      if (isTripActive) {
        updateTripDetails(trip.id, {
          end_latitude: captured.latitude,
          end_longitude: captured.longitude,
          end_location_name: captured.placeName,
        });
      }

      if (mapMode === 'GPS' && leafletMapRef.current) {
        leafletMapRef.current.flyTo([captured.latitude, captured.longitude], 15, {
          duration: 0.9,
        });
      }
    }
    setIsUpdatingGps(false);
  };

  const handleRecenter = () => {
    if (mapMode === 'GPS' && leafletMapRef.current) {
      const bounds = L.latLngBounds([
        [startLat, startLng],
        [liveLat, liveLng],
      ]);
      leafletMapRef.current.fitBounds(bounds, { padding: [46, 46], maxZoom: 16 });
    } else {
      setScale(1.45);
      setPan({ x: 0, y: 0 });
    }
  };

  const handleZoomIn = () => {
    if (mapMode === 'GPS' && leafletMapRef.current) {
      leafletMapRef.current.zoomIn();
    } else {
      setScale((s) => Math.min(3.5, Number((s + 0.35).toFixed(2))));
    }
  };

  const handleZoomOut = () => {
    if (mapMode === 'GPS' && leafletMapRef.current) {
      leafletMapRef.current.zoomOut();
    } else {
      setScale((s) => Math.max(0.85, Number((s - 0.35).toFixed(2))));
    }
  };

  // Vector Mode SVG Coordinate Projection ( dynamically adapts to any GPS coordinates )
  const latSpan = Math.max(0.035, Math.abs(startLat - liveLat) * 2.2);
  const lngSpan = Math.max(0.045, Math.abs(startLng - liveLng) * 2.2);
  const centerLat = (startLat + liveLat) / 2;
  const centerLng = (startLng + liveLng) / 2;

  const isNearAddis =
    centerLat >= 8.85 && centerLat <= 9.15 && centerLng >= 38.65 && centerLng <= 38.95;

  const minLat = isNearAddis
    ? Math.min(BASE_MIN_LAT, startLat - 0.008, liveLat - 0.008)
    : centerLat - latSpan / 2;
  const maxLat = isNearAddis
    ? Math.max(BASE_MAX_LAT, startLat + 0.008, liveLat + 0.008)
    : centerLat + latSpan / 2;
  const minLng = isNearAddis
    ? Math.min(BASE_MIN_LNG, startLng - 0.01, liveLng - 0.01)
    : centerLng - lngSpan / 2;
  const maxLng = isNearAddis
    ? Math.max(BASE_MAX_LNG, startLng + 0.01, liveLng + 0.01)
    : centerLng + lngSpan / 2;

  const projectToSvg = (lat: number, lng: number): { x: number; y: number } => {
    const clampedLat = Math.max(minLat, Math.min(maxLat, lat));
    const clampedLng = Math.max(minLng, Math.min(maxLng, lng));

    const x = ((clampedLng - minLng) / (maxLng - minLng)) * 720 + 40;
    const y = (1 - (clampedLat - minLat) / (maxLat - minLat)) * 300 + 30;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  };

  const startPt = projectToSvg(startLat, startLng);
  const currentPt = projectToSvg(liveLat, liveLng);
  const midX = (startPt.x + currentPt.x) / 2;
  const midY = (startPt.y + currentPt.y) / 2;
  const ctrlX = midX + (currentPt.y - startPt.y) * 0.18;
  const ctrlY = midY - (currentPt.x - startPt.x) * 0.18;

  const viewWidth = 800 / scale;
  const viewHeight = 360 / scale;
  const viewMinX = Math.max(
    -160,
    Math.min(960 - viewWidth, midX - viewWidth / 2 - pan.x / scale)
  );
  const viewMinY = Math.max(
    -120,
    Math.min(480 - viewHeight, midY - viewHeight / 2 - pan.y / scale)
  );

  // Touch & Mouse Gesture Handlers for Vector Mode
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      gestureRef.current = {
        ...gestureRef.current,
        mode: 'PINCH',
        initialDist: Math.hypot(dx, dy),
        initialScale: scale,
      };
    } else if (e.touches.length === 1) {
      gestureRef.current = {
        ...gestureRef.current,
        mode: 'PAN',
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        initialPanX: pan.x,
        initialPanY: pan.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const st = gestureRef.current;
    if (st.mode === 'PINCH' && e.touches.length === 2 && st.initialDist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / st.initialDist;
      const nextScale = Math.max(0.85, Math.min(3.5, st.initialScale * ratio));
      setScale(Number(nextScale.toFixed(2)));
    } else if (st.mode === 'PAN' && e.touches.length === 1) {
      const dx = e.touches[0].clientX - st.startX;
      const dy = e.touches[0].clientY - st.startY;
      setPan({
        x: st.initialPanX + dx * 1.35,
        y: st.initialPanY + dy * 1.35,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    gestureRef.current.mode = 'NONE';
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    gestureRef.current = {
      ...gestureRef.current,
      mode: 'PAN',
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const st = gestureRef.current;
    if (st.mode !== 'PAN') return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    setPan({
      x: st.initialPanX + dx * 1.35,
      y: st.initialPanY + dy * 1.35,
    });
  };

  const handleMouseUp = () => {
    gestureRef.current.mode = 'NONE';
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.24 : -0.24;
    setScale((s) => Math.max(0.85, Math.min(3.5, Number((s + delta).toFixed(2)))));
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`overflow-hidden ${
        edgeToEdge
          ? 'w-full'
          : `rounded-[24px] border ${
              isDark
                ? 'bg-[#141B2D] border-white/10'
                : 'bg-white border-slate-200/80 shadow-xs'
            }`
      }`}
    >
      {/* Interactive Edge-to-Edge GPS & Vector Map Canvas */}
      <div
        className={`relative w-full ${
          compact ? 'h-60' : 'h-72'
        } bg-[#0B0F1A] select-none overflow-hidden`}
      >
        {/* Top Overlay Bar: Active Status Pill on Left + End Trip Button on Top Right */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#141B2D]/90 backdrop-blur-md border border-white/15 shadow-lg">
            <span
              className={`w-2 h-2 rounded-full ${
                isTripActive ? 'bg-[#2CD48D] animate-pulse' : 'bg-[#5CA4F8]'
              }`}
            />
            <span className="text-[11px] font-extrabold text-white tracking-wide">
              {isTripActive ? 'Active' : trip.status}
            </span>
            <span className="text-white/30">·</span>
            <span className="text-xs font-extrabold font-mono text-[#F5BA36]">
              {distanceKmDisplay} km
            </span>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#2CD48D]/20 text-[#2CD48D]">
              {roadRoute?.isActualRoad ? "Road" : "Est. Road"}
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            {isTripActive && onEndTrip && (
              <button
                type="button"
                onClick={onEndTrip}
                className="min-h-[36px] px-4 py-1.5 rounded-full bg-[#2CD48D] hover:bg-[#25be7d] active:scale-95 text-[#052115] text-xs font-extrabold flex items-center gap-1.5 shadow-[0_6px_20px_rgba(44,212,141,0.4)] transition-all cursor-pointer"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>End trip</span>
              </button>
            )}
          </div>
        </div>

        {/* Map Canvas: Real Interactive Leaflet GPS Map OR Offline Vector Map */}
        {mapMode === 'GPS' ? (
          <div
            ref={mapContainerRef}
            className={`w-full h-full z-10 ${
              isDark ? 'tb-map-dark' : 'tb-map-light'
            }`}
          />
        ) : (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onDoubleClick={handleZoomIn}
            className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
          >
            <svg
              viewBox={`${viewMinX} ${viewMinY} ${viewWidth} ${viewHeight}`}
              className="w-full h-full select-none"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <radialGradient id="addisMapSurface" cx="50%" cy="50%" r="65%">
                  <stop
                    offset="0%"
                    stopColor={isDark ? '#152238' : '#EBF2FA'}
                    stopOpacity="1"
                  />
                  <stop
                    offset="100%"
                    stopColor={isDark ? '#0B0F1A' : '#DDE7F5'}
                    stopOpacity="1"
                  />
                </radialGradient>

                <pattern
                  id="urbanBlocks"
                  width="36"
                  height="36"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 36 0 L 0 0 0 36"
                    fill="none"
                    stroke={
                      isDark
                        ? 'rgba(92, 164, 248, 0.055)'
                        : 'rgba(15, 23, 42, 0.045)'
                    }
                    strokeWidth="0.9"
                  />
                </pattern>

                <linearGradient
                  id="activeRouteGradient"
                  x1={startPt.x}
                  y1={startPt.y}
                  x2={currentPt.x}
                  y2={currentPt.y}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#5CA4F8" />
                  <stop offset="100%" stopColor="#2CD48D" />
                </linearGradient>

                <filter id="pinDropShadow" x="-35%" y="-35%" width="170%" height="170%">
                  <feDropShadow
                    dx="0"
                    dy="4"
                    stdDeviation="4.5"
                    floodColor="#000000"
                    floodOpacity="0.45"
                  />
                </filter>
              </defs>

              <rect
                x="-300"
                y="-250"
                width="1400"
                height="900"
                fill="url(#addisMapSurface)"
              />
              <rect
                x="-300"
                y="-250"
                width="1400"
                height="900"
                fill="url(#urbanBlocks)"
              />

              {isNearAddis &&
                ADDIS_SECONDARY_STREETS.map((street, idx) => {
                  const pts = street
                    .map((pt) => {
                      const p = projectToSvg(pt.lat, pt.lng);
                      return `${p.x},${p.y}`;
                    })
                    .join(' ');
                  return (
                    <polyline
                      key={`sec_${idx}`}
                      points={pts}
                      fill="none"
                      stroke={
                        isDark
                          ? 'rgba(148, 163, 184, 0.14)'
                          : 'rgba(100, 116, 139, 0.22)'
                      }
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}

              {isNearAddis &&
                ADDIS_PRIMARY_ROADS.map((road) => {
                  const pts = road.points
                    .map((pt) => {
                      const p = projectToSvg(pt.lat, pt.lng);
                      return `${p.x},${p.y}`;
                    })
                    .join(' ');
                  return (
                    <g key={road.name}>
                      <polyline
                        points={pts}
                        fill="none"
                        stroke={
                          isDark
                            ? 'rgba(30, 43, 69, 0.85)'
                            : 'rgba(203, 213, 225, 0.9)'
                        }
                        strokeWidth="8.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <polyline
                        points={pts}
                        fill="none"
                        stroke={
                          isDark
                            ? 'rgba(92, 164, 248, 0.22)'
                            : 'rgba(255, 255, 255, 0.95)'
                        }
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })}

              {isNearAddis &&
                ADDIS_ABABA_LANDMARKS.map((lm) => {
                  const pt = projectToSvg(lm.latitude, lm.longitude);
                  const shortName = lm.name.replace(', Addis Ababa', '');
                  return (
                    <g key={lm.name}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="2.8"
                        fill={
                          isDark
                            ? 'rgba(148, 163, 184, 0.4)'
                            : 'rgba(71, 85, 105, 0.45)'
                        }
                      />
                      <text
                        x={pt.x + 5.5}
                        y={pt.y + 3}
                        fill={
                          isDark
                            ? 'rgba(148, 163, 184, 0.62)'
                            : 'rgba(51, 65, 85, 0.72)'
                        }
                        fontSize="8.2"
                        fontWeight="600"
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        {shortName}
                      </text>
                    </g>
                  );
                })}

              {/* Real Road Route Polyline or Clean Fallback Ribbon */}
              {roadRoute?.polyline && roadRoute.polyline.length >= 2 ? (
                (() => {
                  const svgRoadPts = roadRoute.polyline
                    .map(([lat, lng]: [number, number]) => {
                      const p = projectToSvg(lat, lng);
                      return `${p.x},${p.y}`;
                    })
                    .join(' ');
                  return (
                    <g>
                      <polyline
                        points={svgRoadPts}
                        fill="none"
                        stroke="#5CA4F8"
                        strokeOpacity="0.32"
                        strokeWidth="11"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <polyline
                        points={svgRoadPts}
                        fill="none"
                        stroke="url(#activeRouteGradient)"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <polyline
                        points={svgRoadPts}
                        fill="none"
                        stroke="#FFFFFF"
                        strokeOpacity="0.75"
                        strokeWidth="2"
                        strokeDasharray="6 12"
                        className="tb-route-dash"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })()
              ) : (
                <g>
                  <path
                    d={`M ${startPt.x} ${startPt.y} Q ${ctrlX} ${ctrlY} ${currentPt.x} ${currentPt.y}`}
                    fill="none"
                    stroke="#5CA4F8"
                    strokeOpacity="0.28"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${startPt.x} ${startPt.y} Q ${ctrlX} ${ctrlY} ${currentPt.x} ${currentPt.y}`}
                    fill="none"
                    stroke="url(#activeRouteGradient)"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${startPt.x} ${startPt.y} Q ${ctrlX} ${ctrlY} ${currentPt.x} ${currentPt.y}`}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeOpacity="0.75"
                    strokeWidth="2"
                    strokeDasharray="6 12"
                    className="tb-route-dash"
                  />
                </g>
              )}

              {/* Start Origin Pin */}
              <g filter="url(#pinDropShadow)">
                <circle
                  cx={startPt.x}
                  cy={startPt.y}
                  r="13"
                  fill="rgba(92, 164, 248, 0.25)"
                />
                <circle
                  cx={startPt.x}
                  cy={startPt.y}
                  r="6.5"
                  fill="#FFFFFF"
                  stroke="#5CA4F8"
                  strokeWidth="3.2"
                />
                <rect
                  x={startPt.x - 48}
                  y={startPt.y - 33}
                  width="96"
                  height="20"
                  rx="10"
                  fill="#141B2D"
                  stroke="#5CA4F8"
                  strokeWidth="1.2"
                />
                <text
                  x={startPt.x}
                  y={startPt.y - 20}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="8.5"
                  fontWeight="800"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {startShort.slice(0, 14)}
                </text>
              </g>

              {/* Current / Destination Navigation Puck Pin */}
              <g filter="url(#pinDropShadow)">
                <circle
                  cx={currentPt.x}
                  cy={currentPt.y}
                  r="20"
                  fill="rgba(44, 212, 141, 0.22)"
                  stroke="rgba(44, 212, 141, 0.55)"
                  strokeWidth="1"
                />
                <circle
                  cx={currentPt.x}
                  cy={currentPt.y}
                  r="11"
                  fill="#2CD48D"
                  stroke="#0B0F1A"
                  strokeWidth="2.5"
                />
                <path
                  d={`M ${currentPt.x} ${currentPt.y - 5.5} L ${currentPt.x - 4.5} ${
                    currentPt.y + 4.5
                  } L ${currentPt.x} ${currentPt.y + 2.2} L ${currentPt.x + 4.5} ${
                    currentPt.y + 4.5
                  } Z`}
                  fill="#052115"
                />
                <rect
                  x={currentPt.x - 54}
                  y={currentPt.y - 37}
                  width="108"
                  height="21"
                  rx="10.5"
                  fill="#2CD48D"
                />
                <text
                  x={currentPt.x}
                  y={currentPt.y - 23.5}
                  textAnchor="middle"
                  fill="#052115"
                  fontSize="9"
                  fontWeight="800"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {currentShort.slice(0, 15)}
                </text>
              </g>
            </svg>
          </div>
        )}

        {/* Bottom-Left Mode Switcher: GPS Street Map vs Vector Map */}
        <div className="absolute bottom-3 left-3 z-30 flex items-center rounded-xl bg-[#141B2D]/90 backdrop-blur-md border border-white/15 p-0.5 shadow-md">
          <button
            type="button"
            onClick={() => setMapMode('GPS')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer ${
              mapMode === 'GPS'
                ? 'bg-[#2CD48D] text-[#052115]'
                : 'text-[#8E9BAE] hover:text-white'
            }`}
          >
            GPS Map
          </button>
          <button
            type="button"
            onClick={() => setMapMode('VECTOR')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer ${
              mapMode === 'VECTOR'
                ? 'bg-[#5CA4F8] text-[#09152B]'
                : 'text-[#8E9BAE] hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Vector</span>
          </button>
        </div>

        {/* Floating Interactive Map Controls on Bottom Right */}
        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRefreshLiveGps}
            disabled={isUpdatingGps}
            className="h-8 px-2.5 rounded-xl bg-[#141B2D]/90 backdrop-blur-md border border-white/15 text-[#2CD48D] text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shadow-md hover:border-[#2CD48D]"
            title="Acquire live device GPS position"
          >
            <Crosshair className={`w-3.5 h-3.5 ${isUpdatingGps ? 'animate-spin' : ''}`} />
            <span>{isUpdatingGps ? 'Locating...' : 'My GPS'}</span>
          </button>

          <button
            type="button"
            onClick={handleRecenter}
            className="h-8 w-8 rounded-xl bg-[#141B2D]/90 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#5CA4F8] cursor-pointer shadow-md"
            title="Fit route in view"
            aria-label="Fit route in view"
          >
            <LocateFixed className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            className="h-8 w-8 rounded-xl bg-[#141B2D]/90 backdrop-blur-md border border-white/15 flex items-center justify-center text-white cursor-pointer shadow-md"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="h-8 w-8 rounded-xl bg-[#141B2D]/90 backdrop-blur-md border border-white/15 flex items-center justify-center text-white cursor-pointer shadow-md"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Start, Current & Distance Bar (No Lat/Lng Degrees) */}
      <div
        className={`px-4 py-3.5 border-b grid grid-cols-3 gap-2 items-center ${
          isDark
            ? 'bg-[#141B2D] border-white/10'
            : 'bg-white border-slate-200/80'
        }`}
      >
        {/* Start Section */}
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#5CA4F8] flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            <span>Start</span>
          </p>
          <p
            className={`text-sm font-extrabold truncate mt-0.5 ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            {startShort}
          </p>
        </div>

        {/* Current / Destination Section */}
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#2CD48D] flex items-center gap-1">
            <Navigation className="w-3 h-3 shrink-0" />
            <span>{isTripActive ? 'Current' : 'Destination'}</span>
          </p>
          <p
            className={`text-sm font-extrabold truncate mt-0.5 ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            {currentShort}
          </p>
        </div>

        {/* Distance Measure */}
        <div className="text-right">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#8E9BAE]">
            {roadRoute?.isActualRoad ? "Road Distance" : "Est. Distance"}
          </p>
          <p className="text-sm font-extrabold font-mono text-[#F5BA36] mt-0.5">
            {distanceKmDisplay} km
          </p>
        </div>
      </div>
    </div>
  );
};
