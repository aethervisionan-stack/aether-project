package com.aethervision.mobile.handsfree

/**
 * Energy VAD aligned with client/src/voice/VadController.ts —
 * speech start without a tap once the wake-word arm is active.
 */
class ContinuousVad(
    private val startThreshold: Float = 0.025f,
    private val endThreshold: Float = 0.015f,
    private val hangoverMs: Long = 420L,
    private val onSpeechStart: () -> Unit = {},
    private val onSpeechEnd: () -> Unit = {},
) {
    enum class Phase { SILENCE, SPEECH, HANGOVER }

    private var phase = Phase.SILENCE
    private var quietSince = 0L
    private var enabled = false

    fun setEnabled(value: Boolean) {
        enabled = value
        if (!value) {
            phase = Phase.SILENCE
            quietSince = 0L
        }
    }

    fun isEnabled(): Boolean = enabled

    fun phase(): Phase = phase

    /** Feed PCM 16-LE mono; returns true while speech (incl. hangover) is active. */
    fun pushPcm16(pcm: ShortArray, nowMs: Long = System.currentTimeMillis()): Boolean {
        if (!enabled) return false
        val rms = rms(pcm)
        when (phase) {
            Phase.SILENCE -> {
                if (rms >= startThreshold) {
                    phase = Phase.SPEECH
                    quietSince = 0L
                    onSpeechStart()
                }
            }
            Phase.SPEECH -> {
                if (rms < endThreshold) {
                    phase = Phase.HANGOVER
                    quietSince = nowMs
                }
            }
            Phase.HANGOVER -> {
                if (rms >= startThreshold) {
                    phase = Phase.SPEECH
                    quietSince = 0L
                } else if (nowMs - quietSince >= hangoverMs) {
                    phase = Phase.SILENCE
                    onSpeechEnd()
                    return false
                }
            }
        }
        return phase != Phase.SILENCE
    }

    private fun rms(pcm: ShortArray): Float {
        if (pcm.isEmpty()) return 0f
        var sum = 0.0
        for (s in pcm) {
            val n = s / 32768.0
            sum += n * n
        }
        return kotlin.math.sqrt(sum / pcm.size).toFloat()
    }
}
