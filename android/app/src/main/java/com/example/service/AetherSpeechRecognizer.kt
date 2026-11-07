package com.example.service

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale

class AetherSpeechRecognizer(context: Context) {

    private val appContext = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null

    private val _rmsAmplitude = MutableStateFlow(0.12f)
    val rmsAmplitude: StateFlow<Float> = _rmsAmplitude.asStateFlow()

    var onFinalResult: ((String) -> Unit)? = null
    var isContinuousListening: Boolean = false

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            Log.d(TAG, "onReadyForSpeech")
            _rmsAmplitude.value = 0.25f
        }

        override fun onBeginningOfSpeech() {
            Log.d(TAG, "onBeginningOfSpeech")
            _rmsAmplitude.value = 0.4f
        }

        override fun onRmsChanged(rmsdB: Float) {
            val normalized = ((rmsdB + 2f) / 12f).coerceIn(0.08f, 1f)
            _rmsAmplitude.value = normalized
        }

        override fun onBufferReceived(buffer: ByteArray?) = Unit

        override fun onEndOfSpeech() {
            Log.d(TAG, "onEndOfSpeech")
            _rmsAmplitude.value = 0.15f
        }

        override fun onError(error: Int) {
            Log.w(TAG, "SpeechRecognizer error=${errorName(error)} ($error)")
            _rmsAmplitude.value = 0.12f
            if (isContinuousListening && error != SpeechRecognizer.ERROR_CLIENT) {
                mainHandler.postDelayed({ startListening() }, 350L)
            }
        }

        override fun onResults(results: Bundle?) {
            val text = results
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                ?.trim()
                .orEmpty()
            Log.i(TAG, "onResults transcript='${text.take(120)}'")
            if (text.isNotBlank()) {
                onFinalResult?.invoke(text)
            } else if (isContinuousListening) {
                mainHandler.postDelayed({ startListening() }, 250L)
            }
            _rmsAmplitude.value = 0.12f
        }

        override fun onPartialResults(partialResults: Bundle?) = Unit

        override fun onEvent(eventType: Int, params: Bundle?) = Unit
    }

    fun startListening() {
        try {
            if (!SpeechRecognizer.isRecognitionAvailable(appContext)) {
                Log.e(TAG, "Speech recognition unavailable on this device")
                return
            }
            stopListening()
            Log.i(TAG, "startListening continuous=$isContinuousListening")
            recognizer = SpeechRecognizer.createSpeechRecognizer(appContext).also {
                it.setRecognitionListener(listener)
                it.startListening(buildIntent())
            }
        } catch (e: Exception) {
            Log.e(TAG, "startListening failed: ${e.localizedMessage}", e)
            _rmsAmplitude.value = 0.12f
        }
    }

    fun stopListening() {
        try {
            recognizer?.run {
                stopListening()
                cancel()
                destroy()
            }
        } catch (e: Exception) {
            Log.w(TAG, "stopListening cleanup: ${e.localizedMessage}")
        } finally {
            recognizer = null
            _rmsAmplitude.value = 0.12f
        }
    }

    fun release() {
        isContinuousListening = false
        mainHandler.removeCallbacksAndMessages(null)
        stopListening()
        onFinalResult = null
        Log.i(TAG, "release()")
    }

    private fun buildIntent(): Intent {
        return Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale("pt", "BR"))
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, appContext.packageName)
        }
    }

    private fun errorName(code: Int): String = when (code) {
        SpeechRecognizer.ERROR_AUDIO -> "ERROR_AUDIO"
        SpeechRecognizer.ERROR_CLIENT -> "ERROR_CLIENT"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "ERROR_INSUFFICIENT_PERMISSIONS"
        SpeechRecognizer.ERROR_NETWORK -> "ERROR_NETWORK"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "ERROR_NETWORK_TIMEOUT"
        SpeechRecognizer.ERROR_NO_MATCH -> "ERROR_NO_MATCH"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "ERROR_RECOGNIZER_BUSY"
        SpeechRecognizer.ERROR_SERVER -> "ERROR_SERVER"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "ERROR_SPEECH_TIMEOUT"
        else -> "UNKNOWN"
    }

    companion object {
        private const val TAG = "AetherSpeechRecognizer"
    }
}
