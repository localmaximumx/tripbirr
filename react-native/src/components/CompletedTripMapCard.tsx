import React, { useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, {
  LatLng,
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  Region,
} from 'react-native-maps';
import { calculateDistanceMeters } from '../../../src/services/location/locationService';
import {
  formatDurationSeconds,
  formatMinorUnits,
} from '../../../src/utils/formatters';

export interface CompletedTripItem {
  id: string;
  startLocationName: string;
  startLatitude: number | null;
  startLongitude: number | null;
  startAccuracy: number | null;
  startSource: 'GPS' | 'MANUAL';
  startTimeIso: string;
  endLocationName: string;
  endLatitude: number | null;
  endLongitude: number | null;
  endAccuracy: number | null;
  endSource: 'GPS' | 'MANUAL';
  endTimeIso: string;
  durationSec: number;
  totalCollectedMinorUnits: number;
  paymentCount: number;
}

interface CompletedTripMapCardProps {
  trip: CompletedTripItem;
  currency?: 'ETB' | 'Birr';
}

/**
 * Computes an initial react-native-maps Region that frames both the start
 * and end coordinates of a completed trip with comfortable padding.
 */
function computeTripRegion(startCoord: LatLng | null, endCoord: LatLng | null): Region {
  if (startCoord && endCoord) {
    const midLat = (startCoord.latitude + endCoord.latitude) / 2;
    const midLng = (startCoord.longitude + endCoord.longitude) / 2;
    const latSpan = Math.abs(startCoord.latitude - endCoord.latitude);
    const lngSpan = Math.abs(startCoord.longitude - endCoord.longitude);

    return {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: Math.max(0.012, latSpan * 1.8),
      longitudeDelta: Math.max(0.012, lngSpan * 1.8),
    };
  }

  const single = startCoord || endCoord || { latitude: 9.0331, longitude: 38.7636 };
  return {
    latitude: single.latitude,
    longitude: single.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };
}

export const CompletedTripMapCard: React.FC<CompletedTripMapCardProps> = ({
  trip,
  currency = 'ETB',
}) => {
  const mapRef = useRef<MapView | null>(null);

  const startCoord: LatLng | null = useMemo(() => {
    if (typeof trip.startLatitude === 'number' && typeof trip.startLongitude === 'number') {
      return {
        latitude: trip.startLatitude,
        longitude: trip.startLongitude,
      };
    }
    return null;
  }, [trip.startLatitude, trip.startLongitude]);

  const endCoord: LatLng | null = useMemo(() => {
    if (typeof trip.endLatitude === 'number' && typeof trip.endLongitude === 'number') {
      return {
        latitude: trip.endLatitude,
        longitude: trip.endLongitude,
      };
    }
    return null;
  }, [trip.endLatitude, trip.endLongitude]);

  const initialRegion = useMemo(
    () => computeTripRegion(startCoord, endCoord),
    [startCoord, endCoord]
  );

  const displacementKm = useMemo(() => {
    if (!startCoord || !endCoord) return null;
    const meters = calculateDistanceMeters(
      startCoord.latitude,
      startCoord.longitude,
      endCoord.latitude,
      endCoord.longitude
    );
    return (meters / 1000).toFixed(2);
  }, [startCoord, endCoord]);

  const handleMapReady = () => {
    if (mapRef.current && startCoord && endCoord) {
      mapRef.current.fitToCoordinates([startCoord, endCoord], {
        edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
        animated: true,
      });
    }
  };

  return (
    <View style={styles.card}>
      {/* Trip Header & Earnings Summary */}
      <View style={styles.headerRow}>
        <View style={styles.routeHeaderLeft}>
          <Text style={styles.statusBadge}>COMPLETED TRIP</Text>
          <Text style={styles.routeTitle}>
            {trip.startLocationName.replace(', Addis Ababa', '')} →{' '}
            {trip.endLocationName.replace(', Addis Ababa', '')}
          </Text>
          <Text style={styles.metaText}>
            Duration: {formatDurationSeconds(trip.durationSec)}
            {displacementKm ? ` · Displacement: ${displacementKm} km` : ''}
          </Text>
        </View>

        <View style={styles.earningsRight}>
          <Text style={styles.earningsAmount}>
            {formatMinorUnits(trip.totalCollectedMinorUnits, currency)}
          </Text>
          <Text style={styles.paymentCountText}>
            {trip.paymentCount} {trip.paymentCount === 1 ? 'payment' : 'payments'}
          </Text>
        </View>
      </View>

      {/* react-native-maps MapView Visualizing Start and End Coordinates */}
      {startCoord || endCoord ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            initialRegion={initialRegion}
            onMapReady={handleMapReady}
            showsScale
            showsCompass
            toolbarEnabled={false}
          >
            {startCoord && (
              <Marker
                identifier={`start_${trip.id}`}
                coordinate={startCoord}
                title={`Start: ${trip.startLocationName}`}
                description={`GPS: ${startCoord.latitude.toFixed(5)}°N, ${startCoord.longitude.toFixed(5)}°E${
                  trip.startAccuracy ? ` (±${trip.startAccuracy}m)` : ''
                }`}
                pinColor="#16866A"
              />
            )}

            {endCoord && (
              <Marker
                identifier={`end_${trip.id}`}
                coordinate={endCoord}
                title={`End: ${trip.endLocationName}`}
                description={`GPS: ${endCoord.latitude.toFixed(5)}°N, ${endCoord.longitude.toFixed(5)}°E${
                  trip.endAccuracy ? ` (±${trip.endAccuracy}m)` : ''
                }`}
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
      ) : (
        <View style={styles.noGpsBox}>
          <Text style={styles.noGpsText}>
            Manual location entry used for this trip (no GPS coordinates recorded).
          </Text>
        </View>
      )}

      {/* Recorded Start & End Coordinate Readout */}
      <View style={styles.coordGrid}>
        <View style={styles.coordBox}>
          <Text style={styles.coordLabel}>START ({trip.startSource})</Text>
          <Text style={styles.coordPlace} numberOfLines={1}>
            {trip.startLocationName}
          </Text>
          <Text style={styles.coordNumbers}>
            {startCoord
              ? `${startCoord.latitude.toFixed(5)}°N, ${startCoord.longitude.toFixed(5)}°E`
              : 'Manual Entry'}
          </Text>
        </View>

        <View style={styles.coordBox}>
          <Text style={styles.coordLabelEnd}>END ({trip.endSource})</Text>
          <Text style={styles.coordPlace} numberOfLines={1}>
            {trip.endLocationName}
          </Text>
          <Text style={styles.coordNumbers}>
            {endCoord
              ? `${endCoord.latitude.toFixed(5)}°N, ${endCoord.longitude.toFixed(5)}°E`
              : 'Manual Entry'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E3EAE5',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  routeHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  statusBadge: {
    color: '#16866A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  routeTitle: {
    color: '#172B25',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  metaText: {
    color: '#75847D',
    fontSize: 11,
    marginTop: 3,
  },
  earningsRight: {
    alignItems: 'flex-end',
  },
  earningsAmount: {
    color: '#123C35',
    fontSize: 16,
    fontWeight: '700',
  },
  paymentCountText: {
    color: '#75847D',
    fontSize: 11,
    marginTop: 2,
  },
  mapContainer: {
    height: 195,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E3EAE5',
    marginBottom: 12,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  noGpsBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F5F7F5',
    marginBottom: 12,
  },
  noGpsText: {
    color: '#75847D',
    fontSize: 12,
    textAlign: 'center',
  },
  coordGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  coordBox: {
    flex: 1,
    backgroundColor: '#F5F7F5',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E3EAE5',
  },
  coordLabel: {
    color: '#16866A',
    fontSize: 10,
    fontWeight: '700',
  },
  coordLabelEnd: {
    color: '#123C35',
    fontSize: 10,
    fontWeight: '700',
  },
  coordPlace: {
    color: '#172B25',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  coordNumbers: {
    color: '#75847D',
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'monospace',
  },
});
