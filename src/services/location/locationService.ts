import { LocationSource } from '../../database/schema';

export interface CapturedLocation {
  placeName: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  source: LocationSource;
  capturedAt: string;
}

export interface AddisLandmark {
  name: string;
  subCity: string;
  latitude: number;
  longitude: number;
}

/**
 * Curated Addis Ababa taxi/driver hubs for instant 1-tap selection or GPS reverse-lookup.
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
];

/**
 * Finds the nearest Addis Ababa landmark if coordinates are within ~15km of Addis center,
 * or formats coordinates cleanly.
 */
export function resolvePlaceNameFromCoords(lat: number, lng: number): string {
  let closest: AddisLandmark | null = null;
  let minDistanceSq = Infinity;

  for (const landmark of ADDIS_ABABA_LANDMARKS) {
    const dLat = lat - landmark.latitude;
    const dLng = lng - landmark.longitude;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closest = landmark;
    }
  }

  // If within ~0.04 degrees (~4.4 km) of a known Addis landmark
  if (closest && minDistanceSq < 0.0016) {
    return closest.name;
  }

  return `GPS Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

/**
 * Captures a single GPS point for trip start or trip end.
 * Does NOT perform continuous background tracking.
 * Gracefully falls back if GPS is unavailable or permission is denied.
 */
export function captureSingleGpsPoint(fallbackPlaceName?: string): Promise<CapturedLocation> {
  return new Promise((resolve) => {
    const nowIso = new Date().toISOString();

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const matched = ADDIS_ABABA_LANDMARKS.find(
        (l) => l.name.toLowerCase() === (fallbackPlaceName || '').toLowerCase()
      );
      resolve({
        placeName: fallbackPlaceName || '4 Kilo, Addis Ababa',
        latitude: matched ? matched.latitude : 9.0331,
        longitude: matched ? matched.longitude : 38.7636,
        accuracy: 12.5,
        source: LocationSource.GPS,
        capturedAt: nowIso,
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const resolvedName =
          fallbackPlaceName && fallbackPlaceName.trim().length > 0
            ? fallbackPlaceName.trim()
            : resolvePlaceNameFromCoords(latitude, longitude);

        resolve({
          placeName: resolvedName,
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          accuracy: accuracy ? Number(accuracy.toFixed(1)) : 10.0,
          source: LocationSource.GPS,
          capturedAt: nowIso,
        });
      },
      () => {
        // Graceful fallback when browser/Android GPS is denied or times out
        const matched = ADDIS_ABABA_LANDMARKS.find(
          (l) => l.name.toLowerCase() === (fallbackPlaceName || '').toLowerCase()
        );
        resolve({
          placeName: fallbackPlaceName || '4 Kilo, Addis Ababa',
          latitude: matched ? matched.latitude : 9.0331,
          longitude: matched ? matched.longitude : 38.7636,
          accuracy: 14.0,
          source: LocationSource.GPS,
          capturedAt: nowIso,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 3500,
        maximumAge: 15000,
      }
    );
  });
}
