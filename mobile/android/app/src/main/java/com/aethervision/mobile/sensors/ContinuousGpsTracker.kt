package com.aethervision.mobile.sensors

import android.annotation.SuppressLint
import android.content.Context
import android.os.Looper
import android.util.Log
import com.aethervision.mobile.BuildConfig
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

data class GeoFix(
    val lat: Double,
    val lon: Double,
    val accuracyM: Float,
    val speedMps: Float,
    val ts: Long,
)

class ContinuousGpsTracker(
    context: Context,
    private val onFix: (GeoFix) -> Unit,
) {
    private val client = LocationServices.getFusedLocationProviderClient(context)
    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val loc = result.lastLocation ?: return
            onFix(
                GeoFix(
                    lat = loc.latitude,
                    lon = loc.longitude,
                    accuracyM = loc.accuracy,
                    speedMps = if (loc.hasSpeed()) loc.speed else 0f,
                    ts = loc.time,
                ),
            )
        }
    }

    @SuppressLint("MissingPermission")
    fun start() {
        val request = LocationRequest.Builder(
            Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            BuildConfig.GPS_MIN_INTERVAL_MS,
        )
            .setMinUpdateDistanceMeters(BuildConfig.GPS_MIN_DISTANCE_M)
            .setWaitForAccurateLocation(false)
            .build()
        try {
            client.requestLocationUpdates(request, callback, Looper.getMainLooper())
            Log.i(TAG, "GPS continuous updates requested")
        } catch (t: SecurityException) {
            Log.e(TAG, "GPS permission missing", t)
        } catch (t: Throwable) {
            Log.e(TAG, "GPS start failed", t)
        }
    }

    fun stop() {
        try {
            client.removeLocationUpdates(callback)
        } catch (t: Throwable) {
            Log.w(TAG, "GPS stop", t)
        }
    }

    companion object {
        private const val TAG = "ContinuousGps"
    }
}
