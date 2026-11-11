package com.aethervision.mobile.shared

import android.util.Log
import com.aethervision.mobile.sensors.GeoFix
import com.aethervision.mobile.sensors.VisionFrame
import org.json.JSONObject

/**
 * Scaffold sink for geo / vision / voice session events.
 * Swap to Live WS / OkHttp sender when wiring against backend/app/websocket/live.py.
 */
object SidebandBus {
    private const val TAG = "SidebandBus"

    fun emitGeo(fix: GeoFix) {
        val json = JSONObject()
            .put("type", "geo")
            .put("lat", fix.lat)
            .put("lon", fix.lon)
            .put("accuracy_m", fix.accuracyM.toDouble())
            .put("speed_mps", fix.speedMps.toDouble())
            .put("ts", fix.ts)
        Log.d(TAG, json.toString())
    }

    fun emitVisionFrame(frame: VisionFrame) {
        val json = JSONObject()
            .put("type", "vision_frame")
            .put("mime", frame.mime)
            .put("b64_len", frame.b64.length)
            .put("ts", frame.ts)
            .put("facing", frame.facing)
        Log.d(TAG, json.toString())
    }

    fun emitVoiceSessionStart(wsUrl: String) {
        Log.i(TAG, """{"type":"voice_session_start","ws":"$wsUrl"}""")
    }

    fun emitVoiceSessionEnd() {
        Log.i(TAG, """{"type":"voice_session_end"}""")
    }
}
