export interface NativeKotlinFileSpec {
  path: string;
  title: string;
  responsibility: string;
  code: string;
}

export const NATIVE_ANDROID_KOTLIN_FILES: NativeKotlinFileSpec[] = [
  {
    path: 'react-native/src/components/CompletedTripMapCard.tsx',
    title: 'CompletedTripMapCard.tsx (react-native-maps Start & End Visualization)',
    responsibility:
      'Renders a react-native-maps MapView with Start & End Marker pins, a dashed Polyline connecting the recorded endpoints, automatic fitToCoordinates framing, and Haversine displacement.',
    code: `import React, { useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { LatLng, Marker, Polyline, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { calculateDistanceMeters } from '../../../src/services/location/locationService';
import { formatDurationSeconds, formatMinorUnits } from '../../../src/utils/formatters';

export const CompletedTripMapCard = ({ trip, currency = 'ETB' }) => {
  const mapRef = useRef<MapView | null>(null);

  const startCoord: LatLng | null =
    typeof trip.startLatitude === 'number' && typeof trip.startLongitude === 'number'
      ? { latitude: trip.startLatitude, longitude: trip.startLongitude }
      : null;

  const endCoord: LatLng | null =
    typeof trip.endLatitude === 'number' && typeof trip.endLongitude === 'number'
      ? { latitude: trip.endLatitude, longitude: trip.endLongitude }
      : null;

  return (
    <View style={{ borderRadius: 20, padding: 16, backgroundColor: '#FFF' }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={{ height: 195, width: '100%' }}
        onMapReady={() => {
          if (mapRef.current && startCoord && endCoord) {
            mapRef.current.fitToCoordinates([startCoord, endCoord], {
              edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
              animated: true,
            });
          }
        }}
      >
        {startCoord && (
          <Marker
            coordinate={startCoord}
            title={\`Start: \${trip.startLocationName}\`}
            description={\`\${startCoord.latitude.toFixed(5)}°N, \${startCoord.longitude.toFixed(5)}°E\`}
            pinColor="#16866A"
          />
        )}
        {endCoord && (
          <Marker
            coordinate={endCoord}
            title={\`End: \${trip.endLocationName}\`}
            description={\`\${endCoord.latitude.toFixed(5)}°N, \${endCoord.longitude.toFixed(5)}°E\`}
            pinColor="#123C35"
          />
        )}
        {startCoord && endCoord && (
          <Polyline
            coordinates={[startCoord, endCoord]}
            strokeColor="#16866A"
            strokeWidth={3}
            lineDashPattern={[8, 5]}
          />
        )}
      </MapView>
    </View>
  );
};`,
  },
  {
    path: 'react-native/App.tsx',
    title: 'react-native/App.tsx (React Native Community CLI Root)',
    responsibility:
      'React Native Android entry point using Geolocation API (getCurrentDeviceLocation) on Start/End Trip and rendering CompletedTripMapCard (react-native-maps) for completed trips.',
    code: `import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { initializeNativeSqliteDatabase, sqliteDb } from './src/database/sqliteNative';
import {
  acknowledgeNativeSms,
  DeviceLocationFix,
  drainPendingNativeSmsQueue,
  getCurrentDeviceLocation,
  requestAndroidReceiveSmsPermission,
  subscribeToNativeTelebirrSms,
  triggerNativePaymentNotification,
} from './src/native/TripBirrNativeBridge';
import { CompletedTripItem, CompletedTripMapCard } from './src/components/CompletedTripMapCard';
import { parseTelebirrSms } from '../src/services/sms/smsParser';
import { formatMinorUnits } from '../src/utils/formatters';

export default function TripBirrReactNativeApp() {
  const [smsPermissionGranted, setSmsPermissionGranted] = useState(false);
  const [activeTrip, setActiveTrip] = useState<any | null>(null);
  const [completedTrips, setCompletedTrips] = useState<CompletedTripItem[]>([]);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [todayTotalMinorUnits, setTodayTotalMinorUnits] = useState(34500);

  const handleStartTrip = async () => {
    setIsLocatingGps(true);
    try {
      const gpsFix: DeviceLocationFix = await getCurrentDeviceLocation();
      const tripId = \`trip_\${Date.now()}\`;
      sqliteDb.execute(
        \`INSERT INTO trips (id, start_location_name, start_latitude, start_longitude, start_location_accuracy, start_location_source, start_time, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'GPS', ?, 'ACTIVE', ?, ?);\`,
        [tripId, gpsFix.placeName, gpsFix.latitude, gpsFix.longitude, gpsFix.accuracy, gpsFix.timestamp, gpsFix.timestamp, gpsFix.timestamp]
      );
      setActiveTrip({
        id: tripId,
        startLocationName: gpsFix.placeName,
        startLatitude: gpsFix.latitude,
        startLongitude: gpsFix.longitude,
        startAccuracy: gpsFix.accuracy,
        startSource: 'GPS',
        startTimeIso: gpsFix.timestamp,
      });
    } finally {
      setIsLocatingGps(false);
    }
  };
}`,
  },
  {
    path: 'react-native/src/native/TripBirrNativeBridge.ts',
    title: 'TripBirrNativeBridge.ts (Geolocation & Kotlin NativeBridge)',
    responsibility:
      'Fetches live device coordinates via @react-native-community/geolocation with native Kotlin LocationModule fallback, and wraps RECEIVE_SMS permissions.',
    code: `import {
  DeviceEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { resolvePlaceNameFromCoords } from '../../../src/services/location/locationService';

const { TripBirrSmsModule, TripBirrLocationModule } = NativeModules;

export async function getCurrentDeviceLocation() {
  const fineResult = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  if (fineResult !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Location permission denied by driver.');
  }

  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(6));
        const longitude = Number(position.coords.longitude.toFixed(6));
        const accuracy = position.coords.accuracy ? Number(position.coords.accuracy.toFixed(1)) : null;
        resolve({
          placeName: resolvePlaceNameFromCoords(latitude, longitude),
          latitude,
          longitude,
          accuracy,
          source: 'GPS',
          timestamp: new Date(position.timestamp || Date.now()).toISOString(),
        });
      },
      async () => {
        const nativeFix = await TripBirrLocationModule.captureSingleEndpoint();
        resolve({
          placeName: resolvePlaceNameFromCoords(nativeFix.latitude, nativeFix.longitude),
          latitude: nativeFix.latitude,
          longitude: nativeFix.longitude,
          accuracy: nativeFix.accuracy,
          source: 'GPS',
          timestamp: new Date().toISOString(),
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  });
}`,
  },
  {
    path: 'android/app/src/main/java/com/tripbirr/sms/SmsReceiver.kt',
    title: 'SmsReceiver.kt (Native BroadcastReceiver & SQLite Queue)',
    responsibility:
      'Intercepts android.provider.Telephony.SMS_RECEIVED from sender ID 127 even when the React Native JS runtime is killed, deduplicates by SHA-256 fingerprint, and queues in native SQLite.',
    code: `package com.tripbirr.sms

import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.provider.Telephony
import com.facebook.react.ReactApplication
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.Arguments
import java.security.MessageDigest

class SmsReceiver : BroadcastReceiver() {
    companion object {
        const val TELEBIRR_SENDER_ID = "127"
        const val EVENT_TELEBIRR_SMS_RECEIVED = "TripBirrSmsReceived"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (messages.isEmpty()) return

        val senderAddress = messages[0].originatingAddress?.trim() ?: return
        if (!senderAddress.equals(TELEBIRR_SENDER_ID, ignoreCase = true)) return

        val messageBody = messages.joinToString("") { it.messageBody ?: "" }.trim()
        if (messageBody.isEmpty()) return

        val timestampMs = messages[0].timestampMillis
        val fingerprint = sha256("$senderAddress|$timestampMs|\${messageBody.lowercase()}")

        val queueHelper = NativeSmsQueueDbHelper(context.applicationContext)
        val inserted = queueHelper.enqueueSms(fingerprint, senderAddress, messageBody, timestampMs)
        if (!inserted) return

        val reactApp = context.applicationContext as? ReactApplication
        val reactContext = reactApp?.reactNativeHost?.reactInstanceManager?.currentReactContext
        if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
            val payload = Arguments.createMap().apply {
                putString("fingerprint", fingerprint)
                putString("senderId", senderAddress)
                putString("body", messageBody)
                putDouble("receivedAtMs", timestampMs.toDouble())
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_TELEBIRR_SMS_RECEIVED, payload)
        }
    }

    private fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }
}`,
  },
  {
    path: 'android/app/src/main/java/com/tripbirr/location/LocationModule.kt',
    title: 'LocationModule.kt (Native Android GPS Endpoint Provider)',
    responsibility:
      'Provides native Android LocationManager fallback for single-point trip start/end coordinate capture without continuous background tracking.',
    code: `package com.tripbirr.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*

class LocationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TripBirrLocationModule"

    @ReactMethod
    fun captureSingleEndpoint(promise: Promise) {
        val locationManager = reactContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val provider = if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER))
            LocationManager.GPS_PROVIDER else LocationManager.NETWORK_PROVIDER
        val lastKnown = locationManager.getLastKnownLocation(provider)
        if (lastKnown != null) {
            val map = Arguments.createMap().apply {
                putDouble("latitude", lastKnown.latitude)
                putDouble("longitude", lastKnown.longitude)
                putDouble("accuracy", lastKnown.accuracy.toDouble())
                putString("source", "GPS")
            }
            promise.resolve(map)
        } else {
            promise.reject("ERR_NO_FIX", "No recent GPS fix available.")
        }
    }
}`,
  },
  {
    path: 'android/app/src/main/AndroidManifest.xml',
    title: 'AndroidManifest.xml (Minimal Permissions & Broadcast Filter)',
    responsibility:
      'Declares RECEIVE_SMS and ACCESS_FINE_LOCATION/ACCESS_COARSE_LOCATION and registers SmsReceiver.',
    code: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.tripbirr">

    <uses-permission android:name="android.permission.RECEIVE_SMS" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:name=".MainApplication"
        android:label="@string/app_name"
        android:allowBackup="false">

        <receiver
            android:name=".sms.SmsReceiver"
            android:enabled="true"
            android:exported="true"
            android:permission="android.permission.BROADCAST_SMS">
            <intent-filter android:priority="999">
                <action android:name="android.provider.Telephony.SMS_RECEIVED" />
            </intent-filter>
        </receiver>
    </application>
</manifest>`,
  },
];
