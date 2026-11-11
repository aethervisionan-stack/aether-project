package com.aethervision.mobile.handsfree

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import kotlin.concurrent.thread

/**
 * Continuous 16 kHz mono PCM capture for wake + VAD (+ later Live WS uplink).
 */
class AudioCapturePipeline(
    private val onFrame: (ShortArray) -> Unit,
) {
    @Volatile private var running = false
    private var worker: Thread? = null

    fun start() {
        if (running) return
        running = true
        worker = thread(name = "aether-pcm", isDaemon = true) {
            val minBuf = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
            )
            val bufferSize = minBuf.coerceAtLeast(FRAME_SAMPLES * 2)
            val recorder = try {
                AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    bufferSize,
                )
            } catch (t: Throwable) {
                Log.e(TAG, "AudioRecord create failed", t)
                running = false
                return@thread
            }
            if (recorder.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord not initialized")
                recorder.release()
                running = false
                return@thread
            }
            val frame = ShortArray(FRAME_SAMPLES)
            try {
                recorder.startRecording()
                while (running) {
                    val n = recorder.read(frame, 0, frame.size)
                    if (n > 0) {
                        onFrame(if (n == frame.size) frame.copyOf() else frame.copyOf(n))
                    }
                }
            } catch (t: Throwable) {
                Log.e(TAG, "capture loop", t)
            } finally {
                try {
                    recorder.stop()
                } catch (_: Throwable) {
                }
                recorder.release()
            }
        }
    }

    fun stop() {
        running = false
        worker?.join(1000)
        worker = null
    }

    companion object {
        private const val TAG = "AudioCapturePipeline"
        const val SAMPLE_RATE = 16_000
        const val FRAME_SAMPLES = 512
    }
}
