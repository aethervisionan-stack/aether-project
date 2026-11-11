package com.aethervision.mobile.handsfree

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.aethervision.mobile.BuildConfig
import com.aethervision.mobile.MainActivity
import com.aethervision.mobile.R
import com.aethervision.mobile.sensors.ContinuousGpsTracker
import com.aethervision.mobile.sensors.VisionSidebandCapture
import com.aethervision.mobile.shared.SidebandBus

/**
 * Always-on hands-free host: wake word → VAD → voice uplink,
 * continuous GPS, and periodic camera frames for the vision sideband.
 */
class HandsFreeForegroundService : Service() {
    private var wake: WakeWordEngine? = null
    private var vad: ContinuousVad? = null
    private var audio: AudioCapturePipeline? = null
    private var gps: ContinuousGpsTracker? = null
    private var vision: VisionSidebandCapture? = null
    private var armedForVad = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startAsForeground()
        startPipeline()
        return START_STICKY
    }

    private fun startAsForeground() {
        val pi = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification: Notification = NotificationCompat.Builder(this, getString(R.string.handsfree_channel_id))
            .setContentTitle(getString(R.string.handsfree_notification_title))
            .setContentText(getString(R.string.handsfree_notification_text))
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pi)
            .setOngoing(true)
            .setSilent(true)
            .build()

        val types = if (Build.VERSION.SDK_INT >= 34) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
        } else if (Build.VERSION.SDK_INT >= 29) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
        } else {
            0
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, types)
    }

    private fun startPipeline() {
        if (audio != null) return

        vad = ContinuousVad(
            onSpeechStart = {
                Log.i(TAG, "VAD speech start — open Live uplink without tap")
                SidebandBus.emitVoiceSessionStart(BuildConfig.AETHER_LIVE_WS_URL)
            },
            onSpeechEnd = {
                Log.i(TAG, "VAD speech end")
                SidebandBus.emitVoiceSessionEnd()
            },
        )

        wake = WakeWordEngine(this) {
            armedForVad = true
            vad?.setEnabled(true)
            Log.i(TAG, "Wake armed continuous VAD")
        }.also { it.start() }

        // Without AccessKey, auto-arm VAD so field bring-up still exercises the path.
        if (BuildConfig.PICOVOICE_ACCESS_KEY.isBlank()) {
            armedForVad = true
            vad?.setEnabled(true)
        }

        audio = AudioCapturePipeline { frame ->
            wake?.processPcm(frame)
            if (armedForVad) {
                vad?.pushPcm16(frame)
            }
        }.also { it.start() }

        gps = ContinuousGpsTracker(this) { fix ->
            SidebandBus.emitGeo(fix)
        }.also { it.start() }

        vision = VisionSidebandCapture(this, BuildConfig.VISION_SIDEBAND_INTERVAL_MS) { frame ->
            SidebandBus.emitVisionFrame(frame)
        }.also { it.start() }
    }

    override fun onDestroy() {
        audio?.stop()
        audio = null
        wake?.stop()
        wake = null
        vad?.setEnabled(false)
        vad = null
        gps?.stop()
        gps = null
        vision?.stop()
        vision = null
        super.onDestroy()
    }

    companion object {
        private const val TAG = "HandsFreeFGS"
        private const val NOTIFICATION_ID = 4201
    }
}
