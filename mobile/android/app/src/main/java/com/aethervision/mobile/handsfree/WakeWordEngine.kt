package com.aethervision.mobile.handsfree

import android.content.Context
import android.util.Log
import ai.picovoice.porcupine.Porcupine
import com.aethervision.mobile.BuildConfig

/**
 * Porcupine / Picovoice wake-word hook on a shared PCM pipeline
 * (same frames as [ContinuousVad] — avoids a second AudioRecord).
 *
 * Without [BuildConfig.PICOVOICE_ACCESS_KEY], stays in stub mode so the FGS still boots.
 */
class WakeWordEngine(
    private val context: Context,
    private val onWake: () -> Unit,
) {
    private var porcupine: Porcupine? = null
    private var frameBuffer = ShortArray(0)
    private var frameOffset = 0
    private var stubMode = false

    val isLive: Boolean get() = porcupine != null

    fun start() {
        val key = BuildConfig.PICOVOICE_ACCESS_KEY.trim()
        if (key.isEmpty()) {
            Log.w(TAG, "PICOVOICE_ACCESS_KEY empty — wake stub (call debugArm() or auto-arm VAD)")
            stubMode = true
            return
        }
        try {
            porcupine = Porcupine.Builder()
                .setAccessKey(key)
                .setKeyword(Porcupine.BuiltInKeyword.COMPUTER)
                .setSensitivity(BuildConfig.PICOVOICE_SENSITIVITY.toFloat())
                .build(context)
            frameBuffer = ShortArray(porcupine!!.frameLength)
            frameOffset = 0
            Log.i(TAG, "Porcupine ready frameLength=${frameBuffer.size}")
        } catch (t: Throwable) {
            Log.e(TAG, "Porcupine init failed — stub mode", t)
            porcupine = null
            stubMode = true
        }
    }

    /** Feed PCM from [AudioCapturePipeline]; detects wake on complete Porcupine frames. */
    fun processPcm(frame: ShortArray) {
        val engine = porcupine ?: return
        var i = 0
        while (i < frame.size) {
            val need = frameBuffer.size - frameOffset
            val take = minOf(need, frame.size - i)
            System.arraycopy(frame, i, frameBuffer, frameOffset, take)
            frameOffset += take
            i += take
            if (frameOffset >= frameBuffer.size) {
                try {
                    val idx = engine.process(frameBuffer)
                    if (idx >= 0) {
                        Log.i(TAG, "Wake word detected idx=$idx")
                        onWake()
                    }
                } catch (t: Throwable) {
                    Log.w(TAG, "Porcupine process", t)
                }
                frameOffset = 0
            }
        }
    }

    /** Dev path when no AccessKey. */
    fun debugArm() {
        if (stubMode || porcupine == null) onWake()
    }

    fun stop() {
        try {
            porcupine?.delete()
        } catch (t: Throwable) {
            Log.w(TAG, "Porcupine delete", t)
        }
        porcupine = null
        stubMode = false
        frameOffset = 0
    }

    companion object {
        private const val TAG = "WakeWordEngine"
    }
}
