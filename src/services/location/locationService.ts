import { LocationSource } from '../../database/schema';

export interface CapturedLocation {
  placeName: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  source: LocationSource;
  capturedAt: string;
  statusMessage?: string;
  providerLabel?: 'HIGH_ACCURACY_GPS' | 'WIFI_CELL_GPS' | 'NETWORK_GEO' | 'MANUAL_PIN';
}

export interface AddisLandmark {
  name: string;
  subCity: string;
  latitude: number;
  longitude: number;
}

/**
 * Comprehensive Addis Ababa taxi & driver hubs with verified WGS84 coordinates
 * for instant 1-tap selection or 100% offline Haversine reverse-lookup.
 */
export const ADDIS_ABABA_LANDMARKS: AddisLandmark[] = [
  { name: '4 Kilo, Addis Ababa', subCity: 'Arada', latitude: 9.0331, longitude: 38.7636 },
  { name: 'Piassa, Addis Ababa', subCity: 'Arada', latitude: 9.0358, longitude: 38.7524 },
  { name: 'Bole Medhanialem, Addis Ababa', subCity: 'Bole', latitude: 8.9974, longitude: 38.7868 },
  { name: 'Mexico Square, Addis Ababa', subCity: 'Kirkos', latitude: 9.0104, longitude: 38.7445 },
  { name: 'Megenagna, Addis Ababa', subCity: 'Yeka', latitude: 9.0205, longitude: 38.8024 },
  { name: 'CMC Michael, Addis Ababa', subCity: 'Bole', latitude: 9.0229, longitude: 38.8467 },
  { name: 'Kazanchis, Addis Ababa', subCity: 'Kirkos', latitude: 9.0168, longitude: 38.7675 },
  { name: 'Merkato, Addis Ababa', subCity: 'Addis Ketema', latitude: 9.0308, longitude: 38.7369 },
  { name: 'Meskel Square, Addis Ababa', subCity: 'Kirkos', latitude: 9.0108, longitude: 38.7612 },
  { name: 'Sarbet, Addis Ababa', subCity: 'Nifas Silk-Lafto', latitude: 8.9942, longitude: 38.7378 },
  { name: 'Gotera, Addis Ababa', subCity: 'Kirkos', latitude: 8.9854, longitude: 38.7601 },
  { name: 'Autobus Tera, Addis Ababa', subCity: 'Addis Ketema', latitude: 9.0352, longitude: 38.7321 },
  { name: '6 Kilo (Sidist Kilo), Addis Ababa', subCity: 'Arada', latitude: 9.0478, longitude: 38.7614 },
  { name: '5 Kilo, Addis Ababa', subCity: 'Arada', latitude: 9.0398, longitude: 38.7628 },
  { name: 'Shiro Meda, Addis Ababa', subCity: 'Gulele', latitude: 9.0625, longitude: 38.7618 },
  { name: '22 Mazoria (Hayahulet), Addis Ababa', subCity: 'Bole', latitude: 9.0145, longitude: 38.7848 },
  { name: 'Bole Atlas, Addis Ababa', subCity: 'Bole', latitude: 9.0046, longitude: 38.7825 },
  { name: 'Bole Michael, Addis Ababa', subCity: 'Bole', latitude: 8.9822, longitude: 38.7764 },
  { name: 'Bole Bulbula, Addis Ababa', subCity: 'Bole', latitude: 8.9435, longitude: 38.7795 },
  { name: 'Gerji Imperial, Addis Ababa', subCity: 'Bole', latitude: 9.0022, longitude: 38.8085 },
  { name: 'Summit Condominium, Addis Ababa', subCity: 'Bole', latitude: 9.0052, longitude: 38.8542 },
  { name: 'Ayat Square, Addis Ababa', subCity: 'Bole', latitude: 9.0185, longitude: 38.8812 },
  { name: 'Tor Hailoch, Addis Ababa', subCity: 'Kolfe Keranio', latitude: 9.0085, longitude: 38.7168 },
  { name: 'Lideta, Addis Ababa', subCity: 'Lideta', latitude: 9.0126, longitude: 38.7348 },
  { name: 'Bisrate Gabriel, Addis Ababa', subCity: 'Nifas Silk-Lafto', latitude: 8.9935, longitude: 38.7245 },
  { name: 'Lancha, Addis Ababa', subCity: 'Kirkos', latitude: 8.9968, longitude: 38.7586 },
  { name: 'Kera, Addis Ababa', subCity: 'Kirkos', latitude: 8.9875, longitude: 38.7462 },
  { name: 'Jemo 1, Addis Ababa', subCity: 'Nifas Silk-Lafto', latitude: 8.9524, longitude: 38.7042 },
  { name: 'Kaliti Total, Addis Ababa', subCity: 'Akaki Kaliti', latitude: 8.9102, longitude: 38.7618 },
  { name: 'Addisu Gebeya, Addis Ababa', subCity: 'Gulele', latitude: 9.0584, longitude: 38.7385 },
];

/**
 * Calculates exact Haversine distance in meters between two WGS84 coordinates.
 */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Offline reverse-lookup using true Haversine distance in meters:
 * - Within 450m of a known hub: returns the hub name
 * - Within 2,000m of a known hub: returns "Near <Hub>, <SubCity>, Addis Ababa"
 * - Otherwise: returns formatted GPS coordinates
 */
export function resolvePlaceNameFromCoords(lat: number, lng: number): string {
  let closest: AddisLandmark | null = null;
  let minDistanceMeters = Infinity;

  for (const landmark of ADDIS_ABABA_LANDMARKS) {
    const distMeters = calculateDistanceMeters(
      lat,
      lng,
      landmark.latitude,
      landmark.longitude
    );
    if (distMeters < minDistanceMeters) {
      minDistanceMeters = distMeters;
      closest = landmark;
    }
  }

  if (closest && minDistanceMeters <= 450) {
    return closest.name;
  }

  if (closest && minDistanceMeters <= 2000) {
    const hubShort = closest.name.replace(', Addis Ababa', '');
    return `Near ${hubShort}, ${closest.subCity}, Addis Ababa`;
  }

  return `GPS (${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E)`;
}

/**
 * Street-level reverse geocoding with multi-provider fallback:
 * 1. OpenStreetMap Nominatim (zoom=18) for exact street, neighborhood, and sub-city
 * 2. BigDataCloud Client Reverse Geocoder (fast, zero rate-limit CORS API)
 * 3. Deterministic offline Haversine coordinate lookup
 */
export async function reverseGeocodeWithOfflineFallback(
  lat: number,
  lng: number
): Promise<string> {
  const offlineResolved = resolvePlaceNameFromCoords(lat, lng);
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return offlineResolved;
  }

  // Provider 1: OpenStreetMap Nominatim at street/neighborhood zoom=18
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5500);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const addr = data?.address;
      if (addr) {
        // Prioritize specific neighborhood, street, or landmark before broad sub-city
        const specificSpot =
          data.name ||
          addr.amenity ||
          addr.building ||
          addr.neighbourhood ||
          addr.quarter ||
          addr.road ||
          addr.pedestrian ||
          addr.residential ||
          addr.commercial;

        const district =
          addr.suburb ||
          addr.city_district ||
          addr.borough ||
          addr.municipality ||
          addr.county;

        const city = addr.city || addr.town || addr.state || '';

        const parts: string[] = [];
        for (const candidate of [specificSpot, district, city]) {
          if (
            candidate &&
            typeof candidate === 'string' &&
            !parts.some((p) => p.toLowerCase() === candidate.toLowerCase())
          ) {
            parts.push(candidate);
          }
        }

        if (parts.length > 0) {
          return parts.slice(0, 3).join(', ');
        }
      }
    }
  } catch {
    // Proceed to secondary provider
  }

  // Provider 2: BigDataCloud Reverse Geocode Client API (CORS-friendly, instant)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const locality = data?.locality || '';
      const city = data?.city || data?.principalSubdivision || '';
      const informative = Array.isArray(data?.localityInfo?.administrative)
        ? data.localityInfo.administrative
            .slice(-2)
            .map((item: { name?: string }) => item?.name)
            .filter(Boolean)
        : [];

      const parts: string[] = [];
      for (const candidate of [...informative.reverse(), locality, city]) {
        if (
          candidate &&
          typeof candidate === 'string' &&
          !parts.some((p) => p.toLowerCase() === candidate.toLowerCase())
        ) {
          parts.push(candidate);
        }
      }
      if (parts.length > 0) {
        return parts.slice(0, 3).join(', ');
      }
    }
  } catch {
    // Fall back to deterministic offline Haversine coordinate lookup
  }

  return offlineResolved;
}

/**
 * Helper to wrap navigator.geolocation.getCurrentPosition in a Promise.
 */
function requestBrowserPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation API not supported in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * Fallback network/IP location lookup ONLY used when browser navigator.geolocation
 * is blocked by iframe policy or OS settings. Returns actual client network location.
 */
async function fetchNetworkFallbackLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
  placeName: string;
} | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }

  // Try BigDataCloud client geolocation (works without coordinates to detect client IP location)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      'https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en',
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const lat = Number(data.latitude.toFixed(6));
        const lng = Number(data.longitude.toFixed(6));
        const resolved = await reverseGeocodeWithOfflineFallback(lat, lng);
        return {
          latitude: lat,
          longitude: lng,
          accuracy: 85,
          placeName: resolved,
        };
      }
    }
  } catch {
    // Try secondary IP geo provider
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.success && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const lat = Number(data.latitude.toFixed(6));
        const lng = Number(data.longitude.toFixed(6));
        const resolved = await reverseGeocodeWithOfflineFallback(lat, lng);
        return {
          latitude: lat,
          longitude: lng,
          accuracy: 120,
          placeName: resolved,
        };
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Captures the user's real device coordinates for trip start or trip end:
 * - Tier 1: High-Accuracy Device GPS (enableHighAccuracy: true, timeout: 9000ms)
 * - Tier 2: Fast Wi-Fi / Cellular Triangulation (enableHighAccuracy: false, timeout: 8000ms)
 * - Tier 3: Network Geolocation fallback if browser/iframe blocks navigator.geolocation
 * Never silently substitutes a fake random landmark when real GPS is requested.
 */
export async function captureSingleGpsPoint(): Promise<CapturedLocation> {
  const nowIso = new Date().toISOString();

  // Tier 1: High-Accuracy Device GPS
  try {
    const pos = await requestBrowserPosition({
      enableHighAccuracy: true,
      timeout: 9000,
      maximumAge: 0,
    });
    const latitude = Number(pos.coords.latitude.toFixed(6));
    const longitude = Number(pos.coords.longitude.toFixed(6));
    const accuracy = pos.coords.accuracy ? Number(pos.coords.accuracy.toFixed(1)) : 8.0;
    const placeName = await reverseGeocodeWithOfflineFallback(latitude, longitude);

    return {
      placeName,
      latitude,
      longitude,
      accuracy,
      source: LocationSource.GPS,
      capturedAt: nowIso,
      providerLabel: 'HIGH_ACCURACY_GPS',
      statusMessage: `Live GPS lock: ${placeName} (${latitude.toFixed(5)}°N, ${longitude.toFixed(5)}°E · ±${accuracy}m)`,
    };
  } catch {
    // Proceed to Tier 2 (Wi-Fi / Cellular positioning)
  }

  // Tier 2: Wi-Fi / Cellular Browser Geolocation (enableHighAccuracy: false)
  try {
    const pos = await requestBrowserPosition({
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 30000,
    });
    const latitude = Number(pos.coords.latitude.toFixed(6));
    const longitude = Number(pos.coords.longitude.toFixed(6));
    const accuracy = pos.coords.accuracy ? Number(pos.coords.accuracy.toFixed(1)) : 25.0;
    const placeName = await reverseGeocodeWithOfflineFallback(latitude, longitude);

    return {
      placeName,
      latitude,
      longitude,
      accuracy,
      source: LocationSource.GPS,
      capturedAt: nowIso,
      providerLabel: 'WIFI_CELL_GPS',
      statusMessage: `Device location acquired: ${placeName} (${latitude.toFixed(5)}°N, ${longitude.toFixed(5)}°E · ±${accuracy}m)`,
    };
  } catch {
    // Proceed to Tier 3 (Network Location fallback when iframe/browser blocks geolocation)
  }

  // Tier 3: Client Network Geolocation
  const networkFix = await fetchNetworkFallbackLocation();
  if (networkFix) {
    return {
      placeName: networkFix.placeName,
      latitude: networkFix.latitude,
      longitude: networkFix.longitude,
      accuracy: networkFix.accuracy,
      source: LocationSource.GPS,
      capturedAt: nowIso,
      providerLabel: 'NETWORK_GEO',
      statusMessage: `Location detected: ${networkFix.placeName} (${networkFix.latitude.toFixed(5)}°N, ${networkFix.longitude.toFixed(5)}°E)`,
    };
  }

  // If completely offline and browser hardware GPS is denied/unavailable, return empty with clear status
  return {
    placeName: '',
    latitude: null,
    longitude: null,
    accuracy: null,
    source: LocationSource.MANUAL,
    capturedAt: nowIso,
    providerLabel: 'MANUAL_PIN',
    statusMessage:
      'Browser GPS permission was blocked or unavailable. Please allow Location access in your browser, tap the map, or select an Addis Ababa hub below.',
  };
}
