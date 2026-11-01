import {
  DeviceEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  resolvePlaceNameFromCoords,
  reverseGeocodeWithOfflineFallback,
} from '../../../src/services/location/locationService';

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
        'TripBirr captures your starting point and destination coordinates when you start and end a trip. It does not track your location continuously in the background.',
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

/**
 * Fetches actual device GPS coordinates using React Native Geolocation API:
 * - Tier 1: High-Accuracy Satellite GPS (enableHighAccuracy: true, timeout: 9000ms)
 * - Tier 2: Fast Wi-Fi / Cellular Triangulation (enableHighAccuracy: false, timeout: 8000ms)
 * - Tier 3: Native Kotlin LocationModule fallback with Android Geocoder
 */
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
    const placeName = await reverseGeocodeWithOfflineFallback(
      fix.latitude,
      fix.longitude
    );
    return {
      placeName,
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy,
      source: 'GPS',
      timestamp: fix.timestamp,
    };
  } catch {
    // Proceed to Tier 2 (Wi-Fi / Cellular location)
  }

  // Tier 2: Coarse Wi-Fi / Cellular Geolocation
  try {
    const fix = await queryGeolocationFix({
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 30000,
    });
    const placeName = await reverseGeocodeWithOfflineFallback(
      fix.latitude,
      fix.longitude
    );
    return {
      placeName,
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy,
      source: 'GPS',
      timestamp: fix.timestamp,
    };
  } catch {
    // Proceed to Tier 3 (Native Android LocationModule)
  }

  // Tier 3: Native Kotlin LocationModule
  if (Platform.OS === 'android' && TripBirrLocationModule) {
    const nativeFix = await TripBirrLocationModule.captureSingleEndpoint();
    if (nativeFix && typeof nativeFix.latitude === 'number') {
      const lat = Number(nativeFix.latitude.toFixed(6));
      const lng = Number(nativeFix.longitude.toFixed(6));
      const acc = nativeFix.accuracy ? Number(nativeFix.accuracy.toFixed(1)) : null;
      const placeName =
        nativeFix.placeName ||
        (await reverseGeocodeWithOfflineFallback(lat, lng)) ||
        resolvePlaceNameFromCoords(lat, lng);
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
