package com.tripbirr.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

/**
 * One-shot GPS endpoint capture for TripBirr.
 * Selects the freshest, highest-accuracy fix across GPS_PROVIDER, NETWORK_PROVIDER,
 * and PASSIVE_PROVIDER, and resolves street/neighborhood name via Android Geocoder.
 */
class LocationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TripBirrLocationModule"

    @ReactMethod
    fun captureSingleEndpoint(promise: Promise) {
        val hasFine = ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val hasCoarse = ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasFine && !hasCoarse) {
            promise.reject("ERR_LOC_PERMISSION", "Location permission not granted.")
            return
        }

        try {
            val locationManager =
                reactContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager

            val providers = listOf(
                LocationManager.GPS_PROVIDER,
                LocationManager.NETWORK_PROVIDER,
                LocationManager.PASSIVE_PROVIDER
            )

            var bestLocation: Location? = null
            for (provider in providers) {
                if (locationManager.isProviderEnabled(provider)) {
                    val candidate = locationManager.getLastKnownLocation(provider) ?: continue
                    if (bestLocation == null || candidate.time > bestLocation!!.time) {
                        bestLocation = candidate
                    }
                }
            }

            if (bestLocation != null) {
                var resolvedAddress: String? = null
                try {
                    if (Geocoder.isPresent()) {
                        val geocoder = Geocoder(reactContext, Locale.ENGLISH)
                        @Suppress("DEPRECATION")
                        val addresses = geocoder.getFromLocation(
                            bestLocation.latitude,
                            bestLocation.longitude,
                            1
                        )
                        if (!addresses.isNullOrEmpty()) {
                            val addr = addresses[0]
                            val parts = listOfNotNull(
                                addr.featureName,
                                addr.subLocality,
                                addr.locality ?: addr.subAdminArea
                            ).distinct()
                            if (parts.isNotEmpty()) {
                                resolvedAddress = parts.joinToString(", ")
                            }
                        }
                    }
                } catch (_: Exception) {
                    // Offline or Geocoder unavailable; JS Haversine lookup will resolve
                }

                val map = Arguments.createMap().apply {
                    putDouble("latitude", bestLocation.latitude)
                    putDouble("longitude", bestLocation.longitude)
                    putDouble("accuracy", bestLocation.accuracy.toDouble())
                    putString("source", "GPS")
                    if (resolvedAddress != null) {
                        putString("placeName", resolvedAddress)
                    }
                }
                promise.resolve(map)
            } else {
                promise.reject("ERR_NO_FIX", "No recent GPS fix available; use manual entry.")
            }
        } catch (e: SecurityException) {
            promise.reject("ERR_LOC_SEC", e.message, e)
        }
    }
}
