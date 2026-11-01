import {
  DeviceEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

const {
  TripBirrSmsModule,
  TripBirrLocationModule,
  TripBirrNotificationModule,
} = NativeModules;

export interface QueuedSmsItem {
  fingerprint: string;
  senderId: string;
  body: string;
  receivedAtMs: number;
}

export interface DeviceLocationFix {
  placeName: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  source: 'GPS' | 'MANUAL';
  timestamp: string;
}

export interface AddisLandmark {
  name: string;
  subCity: string;
  latitude: number;
  longitude: number;
}

export const ADDIS_ABABA_LANDMARKS: AddisLandmark[] = [
  { name: 'Ayat 49 Chefie Condominium, Addis Ababa', subCity: 'Bole', latitude: 9.0315, longitude: 38.8965 },
  { name: 'Ayat Zone 2 / 3, Addis Ababa', subCity: 'Bole', latitude: 9.0268, longitude: 38.8892 },
  { name: 'Ayat Square, Addis Ababa', subCity: 'Bole', latitude: 9.0185, longitude: 38.8812 },
  { name: 'Yeka Abado Condominium, Addis Ababa', subCity: 'Yeka', latitude: 9.0412, longitude: 38.8895 },
  { name: 'Tafo / Meri Lukie, Addis Ababa', subCity: 'Yeka', latitude: 9.0495, longitude: 38.8785 },
  { name: 'CMC Michael, Addis Ababa', subCity: 'Bole', latitude: 9.0229, longitude: 38.8467 },
  { name: 'Summit Condominium, Addis Ababa', subCity: 'Bole', latitude: 9.0052, longitude: 38.8542 },
  { name: 'Megenagna, Addis Ababa', subCity: 'Yeka', latitude: 9.0205, longitude: 38.8024 },
  { name: 'Bole Medhanialem, Addis Ababa', subCity: 'Bole', latitude: 8.9974, longitude: 38.7868 },
  { name: '4 Kilo, Addis Ababa', subCity: 'Arada', latitude: 9.0331, longitude: 38.7636 },
  { name: 'Piassa, Addis Ababa', subCity: 'Arada', latitude: 9.0358, longitude: 38.7524 },
  { name: 'Mexico Square, Addis Ababa', subCity: 'Kirkos', latitude: 9.0104, longitude: 38.7445 },
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
  { name: 'Tor Hailoch, Addis Ababa', subCity: 'Kolfe Keranio', latitude: 9.0085, longitude: 38.7168 },
  { name: 'Lideta, Addis Ababa', subCity: 'Lideta', latitude: 9.0126, longitude: 38.7348 },
  { name: 'Bisrate Gabriel, Addis Ababa', subCity: 'Nifas Silk-Lafto', latitude: 8.9935, longitude: 38.7245 },
  { name: 'Lancha, Addis Ababa', subCity: 'Kirkos', latitude: 8.9968, longitude: 38.7586 },
  { name: 'Kera, Addis Ababa', subCity: 'Kirkos', latitude: 8.9875, longitude: 38.7462 },
  { name: 'Jemo 1, Addis Ababa', subCity: 'Nifas Silk-Lafto', latitude: 8.9524, longitude: 38.7042 },
  { name: 'Kaliti Total, Addis Ababa', subCity: 'Akaki Kaliti', latitude: 8.9102, longitude: 38.7618 },
  { name: 'Addisu Gebeya, Addis Ababa', subCity: 'Gulele', latitude: 9.0584, longitude: 38.7385 },
];

export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
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

export function resolvePlaceNameFromCoords(lat: number, lng: number): string {
  let closest: AddisLandmark | null = null;
  let minDistanceMeters = Infinity;

  for (const landmark of ADDIS_ABABA_LANDMARKS) {
    const distMeters = calculateDistanceMeters(lat, lng, landmark.latitude, landmark.longitude);
    if (distMeters < minDistanceMeters) {
      minDistanceMeters = distMeters;
      closest = landmark;
    }
  }

  if (closest && minDistanceMeters <= 500) {
    return closest.name;
  }
  if (closest && minDistanceMeters <= 2500) {
    return `Near ${closest.name.replace(', Addis Ababa', '')}, ${closest.subCity}, Addis Ababa`;
  }
  return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E (Addis Ababa)`;
}

export async function requestAndroidReceiveSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    {
      title: 'Telebirr 127 SMS Detection Permission',
      message:
        'TripBirr needs RECEIVE_SMS permission to detect incoming Telebirr payment notifications from sender ID 127 while you drive. Your personal inbox is never read or uploaded.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    }
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function requestAndroidLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const fineResult = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Trip Endpoint Location Permission',
      message:
        'TripBirr captures your starting point and destination coordinates when you start and end a trip.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    }
  );
  if (fineResult === PermissionsAndroid.RESULTS.GRANTED) {
    return true;
  }
  const coarseResult = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
  );
  return coarseResult === PermissionsAndroid.RESULTS.GRANTED;
}

function queryGeolocationFix(options: {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: string;
}> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracy:
            position.coords.accuracy !== null && position.coords.accuracy !== undefined
              ? Number(position.coords.accuracy.toFixed(1))
              : null,
          timestamp: new Date(position.timestamp || Date.now()).toISOString(),
        });
      },
      (err) => reject(err),
      options
    );
  });
}

export async function getCurrentDeviceLocation(): Promise<DeviceLocationFix> {
  const hasPermission = await requestAndroidLocationPermission();
  if (!hasPermission) {
    throw new Error('Location permission denied by driver.');
  }

  // Tier 1: High-Accuracy GPS
  try {
    const fix = await queryGeolocationFix({
      enableHighAccuracy: true,
      timeout: 9000,
      maximumAge: 0,
    });
    const placeName = resolvePlaceNameFromCoords(fix.latitude, fix.longitude);
    return {
      placeName,
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy,
      source: 'GPS',
      timestamp: fix.timestamp,
    };
  } catch {
    // Proceed to Tier 2
  }

  // Tier 2: Coarse Wi-Fi / Cellular Geolocation
  try {
    const fix = await queryGeolocationFix({
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 30000,
    });
    const placeName = resolvePlaceNameFromCoords(fix.latitude, fix.longitude);
    return {
      placeName,
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy,
      source: 'GPS',
      timestamp: fix.timestamp,
    };
  } catch {
    // Proceed to Tier 3
  }

  // Tier 3: Native Kotlin LocationModule
  if (Platform.OS === 'android' && TripBirrLocationModule) {
    const nativeFix = await TripBirrLocationModule.captureSingleEndpoint();
    if (nativeFix && typeof nativeFix.latitude === 'number') {
      const lat = Number(nativeFix.latitude.toFixed(6));
      const lng = Number(nativeFix.longitude.toFixed(6));
      const acc = nativeFix.accuracy ? Number(nativeFix.accuracy.toFixed(1)) : null;
      const placeName = nativeFix.placeName || resolvePlaceNameFromCoords(lat, lng);
      return {
        placeName,
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        source: 'GPS',
        timestamp: new Date().toISOString(),
      };
    }
  }

  throw new Error('Unable to acquire device GPS fix. Please enter location manually.');
}

export async function checkAndroidSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || !TripBirrSmsModule) return false;
  return TripBirrSmsModule.checkSmsPermission();
}

export async function drainPendingNativeSmsQueue(): Promise<QueuedSmsItem[]> {
  if (Platform.OS !== 'android' || !TripBirrSmsModule) return [];
  return TripBirrSmsModule.drainPendingSmsQueue();
}

export async function acknowledgeNativeSms(fingerprint: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !TripBirrSmsModule) return false;
  return TripBirrSmsModule.acknowledgeProcessedSms(fingerprint);
}

export function subscribeToNativeTelebirrSms(
  onSmsReceived: (event: QueuedSmsItem) => void
) {
  const sub = DeviceEventEmitter.addListener('TripBirrSmsReceived', onSmsReceived);
  return () => sub.remove();
}

export async function triggerNativePaymentNotification(params: {
  amountFormatted: string;
  senderName: string;
  timeFormatted: string;
  speakVoice: boolean;
  spokenText: string;
}): Promise<void> {
  if (Platform.OS !== 'android' || !TripBirrNotificationModule) return;
  await TripBirrNotificationModule.showPaymentNotification(
    params.amountFormatted,
    params.senderName,
    params.timeFormatted,
    params.speakVoice,
    params.spokenText
  );
}
