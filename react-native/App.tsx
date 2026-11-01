import React, { useEffect, useState } from 'react';
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
import {
  initializeNativeSqliteDatabase,
  sqliteDb,
} from './src/database/sqliteNative';
import {
  acknowledgeNativeSms,
  DeviceLocationFix,
  drainPendingNativeSmsQueue,
  getCurrentDeviceLocation,
  requestAndroidReceiveSmsPermission,
  subscribeToNativeTelebirrSms,
  triggerNativePaymentNotification,
} from './src/native/TripBirrNativeBridge';
import {
  CompletedTripItem,
  CompletedTripMapCard,
} from './src/components/CompletedTripMapCard';
import { parseTelebirrSms } from '../src/services/sms/smsParser';
import { formatMinorUnits } from '../src/utils/formatters';

interface ActiveTripState {
  id: string;
  startLocationName: string;
  startLatitude: number | null;
  startLongitude: number | null;
  startAccuracy: number | null;
  startSource: 'GPS' | 'MANUAL';
  startTimeIso: string;
  collectedMinorUnits: number;
  paymentCount: number;
}

const INITIAL_COMPLETED_TRIPS: CompletedTripItem[] = [
  {
    id: 'trip_4kilo_piassa_01',
    startLocationName: '4 Kilo, Addis Ababa',
    startLatitude: 9.0331,
    startLongitude: 38.7636,
    startAccuracy: 11.5,
    startSource: 'GPS',
    startTimeIso: '2026-10-21T20:15:00.000Z',
    endLocationName: 'Piassa, Addis Ababa',
    endLatitude: 9.0358,
    endLongitude: 38.7524,
    endAccuracy: 14.0,
    endSource: 'GPS',
    endTimeIso: '2026-10-21T20:48:00.000Z',
    durationSec: 1980,
    totalCollectedMinorUnits: 10000, // ETB 100.00 (50 + 30 + 20)
    paymentCount: 3,
  },
  {
    id: 'trip_bole_mexico_02',
    startLocationName: 'Bole Medhanialem, Addis Ababa',
    startLatitude: 8.9974,
    startLongitude: 38.7868,
    startAccuracy: 9.2,
    startSource: 'GPS',
    startTimeIso: '2026-10-21T17:10:00.000Z',
    endLocationName: 'Mexico Square, Addis Ababa',
    endLatitude: 9.0104,
    endLongitude: 38.7445,
    endAccuracy: 12.0,
    endSource: 'GPS',
    endTimeIso: '2026-10-21T17:52:00.000Z',
    durationSec: 2520,
    totalCollectedMinorUnits: 18000, // ETB 180.00
    paymentCount: 1,
  },
];

export default function TripBirrReactNativeApp() {
  const [smsPermissionGranted, setSmsPermissionGranted] = useState(false);
  const [activeTrip, setActiveTrip] = useState<ActiveTripState | null>(null);
  const [completedTrips, setCompletedTrips] = useState<CompletedTripItem[]>(
    INITIAL_COMPLETED_TRIPS
  );
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [todayTotalMinorUnits, setTodayTotalMinorUnits] = useState(34500);

  useEffect(() => {
    initializeNativeSqliteDatabase();

    requestAndroidReceiveSmsPermission().then(async (granted) => {
      setSmsPermissionGranted(granted);
      if (granted) {
        const queued = await drainPendingNativeSmsQueue();
        for (const item of queued) {
          const parsed = parseTelebirrSms({
            senderId: item.senderId,
            body: item.body,
          });
          if (parsed.isIncomingIncome && parsed.amountMinorUnits) {
            setTodayTotalMinorUnits((prev) => prev + parsed.amountMinorUnits!);
            setActiveTrip((curr) =>
              curr
                ? {
                    ...curr,
                    collectedMinorUnits:
                      curr.collectedMinorUnits + parsed.amountMinorUnits!,
                    paymentCount: curr.paymentCount + 1,
                  }
                : null
            );
          }
          await acknowledgeNativeSms(item.fingerprint);
        }
      }
    });

    const unsubscribe = subscribeToNativeTelebirrSms(async (event) => {
      const parsed = parseTelebirrSms({
        senderId: event.senderId,
        body: event.body,
      });
      if (parsed.isIncomingIncome && parsed.amountMinorUnits) {
        setTodayTotalMinorUnits((prev) => prev + parsed.amountMinorUnits!);
        setActiveTrip((curr) =>
          curr
            ? {
                ...curr,
                collectedMinorUnits:
                  curr.collectedMinorUnits + parsed.amountMinorUnits!,
                paymentCount: curr.paymentCount + 1,
              }
            : null
        );
        const formatted = formatMinorUnits(parsed.amountMinorUnits, 'ETB');
        await triggerNativePaymentNotification({
          amountFormatted: formatted,
          senderName: parsed.senderName || 'Telebirr Passenger',
          timeFormatted: (parsed.transactionTime || '').slice(0, 5),
          speakVoice: true,
          spokenText: `Payment received, ${Math.floor(
            parsed.amountMinorUnits / 100
          )} birr from ${parsed.senderName || 'passenger'}`,
        });
      }
      await acknowledgeNativeSms(event.fingerprint);
    });

    return unsubscribe;
  }, []);

  /**
   * Starts a new trip by fetching actual device coordinates via Geolocation API.
   * Falls back to manual location input if GPS is disabled or permission is denied.
   */
  const handleStartTrip = async () => {
    setIsLocatingGps(true);
    setLocationError(null);

    try {
      const gpsFix: DeviceLocationFix = await getCurrentDeviceLocation();
      const tripId = `trip_${Date.now()}`;
      const nowIso = gpsFix.timestamp;

      sqliteDb.execute(
        `INSERT INTO trips (
          id, start_location_name, start_latitude, start_longitude,
          start_location_accuracy, start_location_source, start_time,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?);`,
        [
          tripId,
          gpsFix.placeName,
          gpsFix.latitude,
          gpsFix.longitude,
          gpsFix.accuracy,
          'GPS',
          nowIso,
          nowIso,
          nowIso,
        ]
      );

      setActiveTrip({
        id: tripId,
        startLocationName: gpsFix.placeName,
        startLatitude: gpsFix.latitude,
        startLongitude: gpsFix.longitude,
        startAccuracy: gpsFix.accuracy,
        startSource: 'GPS',
        startTimeIso: nowIso,
        collectedMinorUnits: 0,
        paymentCount: 0,
      });
    } catch (err) {
      const fallbackManual = manualLocationInput.trim();
      if (fallbackManual) {
        const tripId = `trip_${Date.now()}`;
        const nowIso = new Date().toISOString();

        sqliteDb.execute(
          `INSERT INTO trips (
            id, start_location_name, start_latitude, start_longitude,
            start_location_accuracy, start_location_source, start_time,
            status, created_at, updated_at
          ) VALUES (?, ?, NULL, NULL, NULL, 'MANUAL', ?, 'ACTIVE', ?, ?);`,
          [tripId, fallbackManual, nowIso, nowIso, nowIso]
        );

        setActiveTrip({
          id: tripId,
          startLocationName: fallbackManual,
          startLatitude: null,
          startLongitude: null,
          startAccuracy: null,
          startSource: 'MANUAL',
          startTimeIso: nowIso,
          collectedMinorUnits: 0,
          paymentCount: 0,
        });
      } else {
        setLocationError(
          err instanceof Error
            ? err.message
            : 'GPS unavailable. Enter starting point manually below.'
        );
      }
    } finally {
      setIsLocatingGps(false);
    }
  };

  /**
   * Ends the active trip by fetching actual destination coordinates via Geolocation API
   * and appends the completed trip to the react-native-maps history list.
   */
  const handleEndTrip = async () => {
    if (!activeTrip) return;
    setIsLocatingGps(true);
    setLocationError(null);

    try {
      const endFix = await getCurrentDeviceLocation();
      const endIso = endFix.timestamp;
      const durationSec = Math.max(
        60,
        Math.round(
          (new Date(endIso).getTime() - new Date(activeTrip.startTimeIso).getTime()) /
            1000
        )
      );

      sqliteDb.execute(
        `UPDATE trips SET
          end_location_name = ?,
          end_latitude = ?,
          end_longitude = ?,
          end_location_accuracy = ?,
          end_location_source = 'GPS',
          end_time = ?,
          duration = ?,
          status = 'COMPLETED',
          updated_at = ?
        WHERE id = ?;`,
        [
          endFix.placeName,
          endFix.latitude,
          endFix.longitude,
          endFix.accuracy,
          endIso,
          durationSec,
          endIso,
          activeTrip.id,
        ]
      );

      const completedItem: CompletedTripItem = {
        id: activeTrip.id,
        startLocationName: activeTrip.startLocationName,
        startLatitude: activeTrip.startLatitude,
        startLongitude: activeTrip.startLongitude,
        startAccuracy: activeTrip.startAccuracy,
        startSource: activeTrip.startSource,
        startTimeIso: activeTrip.startTimeIso,
        endLocationName: endFix.placeName,
        endLatitude: endFix.latitude,
        endLongitude: endFix.longitude,
        endAccuracy: endFix.accuracy,
        endSource: 'GPS',
        endTimeIso: endIso,
        durationSec,
        totalCollectedMinorUnits: activeTrip.collectedMinorUnits,
        paymentCount: activeTrip.paymentCount,
      };

      setCompletedTrips((prev) => [completedItem, ...prev]);
      setActiveTrip(null);
      setManualLocationInput('');
    } catch {
      const manualDest = manualLocationInput.trim() || 'Completed Destination';
      const endIso = new Date().toISOString();
      const durationSec = Math.max(
        60,
        Math.round(
          (new Date(endIso).getTime() - new Date(activeTrip.startTimeIso).getTime()) /
            1000
        )
      );

      sqliteDb.execute(
        `UPDATE trips SET
          end_location_name = ?,
          end_location_source = 'MANUAL',
          end_time = ?,
          duration = ?,
          status = 'COMPLETED',
          updated_at = ?
        WHERE id = ?;`,
        [manualDest, endIso, durationSec, endIso, activeTrip.id]
      );

      const completedItem: CompletedTripItem = {
        id: activeTrip.id,
        startLocationName: activeTrip.startLocationName,
        startLatitude: activeTrip.startLatitude,
        startLongitude: activeTrip.startLongitude,
        startAccuracy: activeTrip.startAccuracy,
        startSource: activeTrip.startSource,
        startTimeIso: activeTrip.startTimeIso,
        endLocationName: manualDest,
        endLatitude: null,
        endLongitude: null,
        endAccuracy: null,
        endSource: 'MANUAL',
        endTimeIso: endIso,
        durationSec,
        totalCollectedMinorUnits: activeTrip.collectedMinorUnits,
        paymentCount: activeTrip.paymentCount,
      };

      setCompletedTrips((prev) => [completedItem, ...prev]);
      setActiveTrip(null);
      setManualLocationInput('');
    } finally {
      setIsLocatingGps(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#123C35" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <Text style={styles.brandTitle}>TripBirr Android</Text>
          <Text style={styles.subtitle}>
            Sender 127 Listener: {smsPermissionGranted ? 'ACTIVE' : 'PERMISSION NEEDED'}
          </Text>
          <Text style={styles.totalValue}>
            {formatMinorUnits(todayTotalMinorUnits, 'ETB')}
          </Text>
          <Text style={styles.caption}>Today&apos;s Verified Telebirr Collections</Text>
        </View>

        <View style={styles.tripCard}>
          <Text style={styles.sectionTitle}>
            {activeTrip
              ? `Active Trip: From ${activeTrip.startLocationName}`
              : 'Ready to Start Trip (GPS Assisted)'}
          </Text>

          {activeTrip && (
            <Text style={styles.coordMeta}>
              Source: {activeTrip.startSource}
              {activeTrip.startLatitude !== null && activeTrip.startLongitude !== null
                ? ` · ${activeTrip.startLatitude.toFixed(5)}°N, ${activeTrip.startLongitude.toFixed(5)}°E (±${activeTrip.startAccuracy ?? 10}m)`
                : ''}
            </Text>
          )}

          <TextInput
            style={styles.manualInput}
            value={manualLocationInput}
            onChangeText={setManualLocationInput}
            placeholder={
              activeTrip
                ? 'Optional manual destination override (if GPS off)'
                : 'Optional manual starting location (if GPS off)'
            }
            placeholderTextColor="#75847D"
          />

          {locationError && <Text style={styles.errorText}>{locationError}</Text>}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              activeTrip ? styles.endButton : styles.startButton,
            ]}
            disabled={isLocatingGps}
            onPress={activeTrip ? handleEndTrip : handleStartTrip}
          >
            {isLocatingGps ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {activeTrip
                  ? 'Acquire Destination GPS & End Trip'
                  : 'Acquire Current GPS & Start Trip'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Completed Trips Visualized with react-native-maps */}
        <View style={styles.completedSection}>
          <Text style={styles.completedHeading}>
            Completed Trips ({completedTrips.length}) · Start & End Coordinates Map
          </Text>
          {completedTrips.map((trip) => (
            <CompletedTripMapCard key={trip.id} trip={trip} currency="ETB" />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F5',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  headerCard: {
    backgroundColor: '#123C35',
    borderRadius: 20,
    padding: 22,
  },
  brandTitle: {
    color: '#43C99A',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#DDF5E9',
    fontSize: 12,
    marginTop: 4,
  },
  totalValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    marginTop: 14,
  },
  caption: {
    color: '#DDF5E9',
    fontSize: 12,
    marginTop: 4,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E3EAE5',
  },
  sectionTitle: {
    color: '#172B25',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  coordMeta: {
    color: '#16866A',
    fontSize: 12,
    marginBottom: 12,
  },
  manualInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3EAE5',
    backgroundColor: '#F5F7F5',
    paddingHorizontal: 12,
    color: '#172B25',
    fontSize: 13,
    marginBottom: 12,
  },
  errorText: {
    color: '#D9534F',
    fontSize: 12,
    marginBottom: 10,
  },
  primaryButton: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: '#16866A',
  },
  endButton: {
    backgroundColor: '#123C35',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  completedSection: {
    marginTop: 4,
  },
  completedHeading: {
    color: '#172B25',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
});
