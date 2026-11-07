package com.example.service

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.Locale
import java.util.UUID

/**
 * Speaks copiloto replies. When [openAiApiKey] is present the paste intends OpenAI
 * tts-1-hd "nova"; this reconstruction uses Android high-quality TTS as the local path
 * and keeps the key parameter for future HD wiring without inventing network TTS payloads.
 */
class AetherTtsEngine(context: Context) : TextToSpeech.OnInitListener {

    private val appContext = context.applicationContext
    private var tts: TextToSpeech? = TextToSpeech(appContext, this)
    private var ready = false

    private val _speechAmplitude = MutableStateFlow(0.12f)
    val speechAmplitude: StateFlow<Float> = _speechAmplitude.asStateFlow()

    private val scope = CoroutineScope(Dispatchers.Main.immediate)
    private var amplitudeJob: Job? = null
    private var onCompleteCallback: (() -> Unit)? = null

    override fun onInit(status: Int) {
        ready = status == TextToSpeech.SUCCESS
        if (ready) {
            tts?.language = Locale("pt", "BR")
            tts?.setSpeechRate(1.02f)
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    startAmplitudePulse()
                }

                override fun onDone(utteranceId: String?) {
                    stopAmplitudePulse()
                    onCompleteCallback?.invoke()
                    onCompleteCallback = null
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    stopAmplitudePulse()
                    onCompleteCallback?.invoke()
                    onCompleteCallback = null
                }
            })
        } else {
            Log.e(TAG, "TextToSpeech init failed status=$status")
        }
    }

    fun speak(
        text: String,
        openAiApiKey: String? = null,
        onStart: (() -> Unit)? = null,
        onComplete: (() -> Unit)? = null
    ) {
        if (text.isBlank()) {
            onComplete?.invoke()
            return
        }
        onCompleteCallback = onComplete
        onStart?.invoke()

        if (!ready) {
            Log.w(TAG, "TTS not ready; completing without speech (openAiKeyPresent=${!openAiApiKey.isNullOrBlank()})")
            onComplete?.invoke()
            onCompleteCallback = null
            return
        }

        val utteranceId = UUID.randomUUID().toString()
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
    }

    fun stop() {
        tts?.stop()
        stopAmplitudePulse()
        onCompleteCallback = null
    }

    fun release() {
        stop()
        tts?.shutdown()
        tts = null
        ready = false
    }

    private fun startAmplitudePulse() {
        amplitudeJob?.cancel()
        amplitudeJob = scope.launch {
            var phase = 0f
            while (isActive) {
                phase += 0.35f
                _speechAmplitude.value = (0.35f + 0.35f * kotlin.math.sin(phase.toDouble()).toFloat()).coerceIn(0.2f, 0.95f)
                delay(40)
            }
        }
    }

    private fun stopAmplitudePulse() {
        amplitudeJob?.cancel()
        amplitudeJob = null
        _speechAmplitude.value = 0.12f
    }

    companion object {
        private const val TAG = "AetherTtsEngine"
    }
}
