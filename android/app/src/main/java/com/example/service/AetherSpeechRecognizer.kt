package com.example.service

import android.content.Context
import android.content.Intent
import android.os.Bundle
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
    private var recognizer: SpeechRecognizer? = null

    private val _rmsAmplitude = MutableStateFlow(0.12f)
    val rmsAmplitude: StateFlow<Float> = _rmsAmplitude.asStateFlow()

    var onFinalResult: ((String) -> Unit)? = null
    var isContinuousListening: Boolean = false

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            _rmsAmplitude.value = 0.25f
        }

        override fun onBeginningOfSpeech() {
            _rmsAmplitude.value = 0.4f
        }

        override fun onRmsChanged(rmsdB: Float) {
            val normalized = ((rmsdB + 2f) / 12f).coerceIn(0.08f, 1f)
            _rmsAmplitude.value = normalized
        }

        override fun onBufferReceived(buffer: ByteArray?) = Unit

        override fun onEndOfSpeech() {
            _rmsAmplitude.value = 0.15f
        }

        override fun onError(error: Int) {
            Log.w(TAG, "SpeechRecognizer error=$error")
            _rmsAmplitude.value = 0.12f
            if (isContinuousListening) {
                startListening()
            }
        }

        override fun onResults(results: Bundle?) {
            val text = results
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                ?.trim()
                .orEmpty()
            if (text.isNotBlank()) {
                onFinalResult?.invoke(text)
            } else if (isContinuousListening) {
                startListening()
            }
            _rmsAmplitude.value = 0.12f
        }

        override fun onPartialResults(partialResults: Bundle?) = Unit

        override fun onEvent(eventType: Int, params: Bundle?) = Unit
    }

    fun startListening() {
        if (!SpeechRecognizer.isRecognitionAvailable(appContext)) {
            Log.e(TAG, "Speech recognition unavailable on this device")
            return
        }
        stopListening()
        recognizer = SpeechRecognizer.createSpeechRecognizer(appContext).also {
            it.setRecognitionListener(listener)
            it.startListening(buildIntent())
        }
    }

    fun stopListening() {
        recognizer?.runCatching {
            stopListening()
            cancel()
            destroy()
        }
        recognizer = null
        _rmsAmplitude.value = 0.12f
    }

    fun release() {
        isContinuousListening = false
        stopListening()
        onFinalResult = null
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

    companion object {
        private const val TAG = "AetherSpeechRecognizer"
    }
}
