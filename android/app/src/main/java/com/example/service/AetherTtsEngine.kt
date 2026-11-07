package com.example.service

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.Locale
import java.util.UUID

/**
 * Speaks copiloto replies. When [openAiApiKey] is present the product intends OpenAI
 * tts-1-hd "nova"; this path uses Android high-quality TTS locally and logs the key presence
 * for pipeline tracing without inventing a network TTS client.
 */
class AetherTtsEngine(context: Context) : TextToSpeech.OnInitListener {

    private val appContext = context.applicationContext
    private var tts: TextToSpeech? = TextToSpeech(appContext, this)
    private var ready = false

    private val _speechAmplitude = MutableStateFlow(0.12f)
    val speechAmplitude: StateFlow<Float> = _speechAmplitude.asStateFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var amplitudeJob: Job? = null
    private var onCompleteCallback: (() -> Unit)? = null

    override fun onInit(status: Int) {
        ready = status == TextToSpeech.SUCCESS
        if (ready) {
            val langResult = tts?.setLanguage(Locale("pt", "BR"))
            tts?.setSpeechRate(1.02f)
            Log.i(TAG, "TTS ready langResult=$langResult")
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    Log.d(TAG, "utterance start id=$utteranceId")
                    startAmplitudePulse()
                }

                override fun onDone(utteranceId: String?) {
                    Log.d(TAG, "utterance done id=$utteranceId")
                    stopAmplitudePulse()
                    completeOnce()
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    Log.e(TAG, "utterance error id=$utteranceId")
                    stopAmplitudePulse()
                    completeOnce()
                }

                override fun onError(utteranceId: String?, errorCode: Int) {
                    Log.e(TAG, "utterance error id=$utteranceId code=$errorCode")
                    stopAmplitudePulse()
                    completeOnce()
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
            Log.w(TAG, "speak() ignored blank text")
            onComplete?.invoke()
            return
        }
        onCompleteCallback = onComplete
        try {
            onStart?.invoke()
            if (!ready) {
                Log.w(
                    TAG,
                    "TTS not ready; completing without speech (openAiKeyPresent=${!openAiApiKey.isNullOrBlank()})"
                )
                completeOnce()
                return
            }
            val utteranceId = UUID.randomUUID().toString()
            Log.i(
                TAG,
                "speak len=${text.length} openAiKeyPresent=${!openAiApiKey.isNullOrBlank()} id=$utteranceId"
            )
            val result = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
            if (result == TextToSpeech.ERROR) {
                Log.e(TAG, "tts.speak returned ERROR")
                completeOnce()
            }
        } catch (e: Exception) {
            Log.e(TAG, "speak failed: ${e.localizedMessage}", e)
            stopAmplitudePulse()
            completeOnce()
        }
    }

    fun stop() {
        try {
            tts?.stop()
        } catch (e: Exception) {
            Log.w(TAG, "stop failed: ${e.localizedMessage}")
        }
        stopAmplitudePulse()
        onCompleteCallback = null
    }

    fun release() {
        stop()
        try {
            tts?.shutdown()
        } catch (e: Exception) {
            Log.w(TAG, "shutdown failed: ${e.localizedMessage}")
        }
        tts = null
        ready = false
        scope.cancel()
        Log.i(TAG, "release()")
    }

    private fun completeOnce() {
        val cb = onCompleteCallback
        onCompleteCallback = null
        cb?.invoke()
    }

    private fun startAmplitudePulse() {
        amplitudeJob?.cancel()
        amplitudeJob = scope.launch {
            var phase = 0f
            while (isActive) {
                phase += 0.35f
                _speechAmplitude.value =
                    (0.35f + 0.35f * kotlin.math.sin(phase.toDouble()).toFloat()).coerceIn(0.2f, 0.95f)
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
