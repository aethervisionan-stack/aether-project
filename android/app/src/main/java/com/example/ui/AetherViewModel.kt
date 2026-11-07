package com.example.ui

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.AetherDatabase
import com.example.data.local.InteractionLog
import com.example.data.local.MemoryNote
import com.example.data.model.AudioDeviceState
import com.example.data.model.ConsensusResult
import com.example.data.model.DeviceType
import com.example.data.model.GatedToolAction
import com.example.data.model.GatedToolEvent
import com.example.data.model.LatencyMetrics
import com.example.data.remote.AetherApiClient
import com.example.data.repository.AetherRepository
import com.example.service.AetherBrainService
import com.example.service.AetherSpeechRecognizer
import com.example.service.AetherTtsEngine
import com.example.service.BluetoothAudioHelper
import com.example.service.ConsensusAlfaEngine
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed class AudioSessionState {
    object Idle : AudioSessionState()
    object Listening : AudioSessionState()
    object Thinking : AudioSessionState()
    object ValidatingConsensus : AudioSessionState()
    object Speaking : AudioSessionState()
}

class AetherViewModel(application: Application) : AndroidViewModel(application) {

    private val db = AetherDatabase.getInstance(application)
    private val repository = AetherRepository(db.aetherDao())

    val bluetoothHelper = BluetoothAudioHelper(application)
    val speechRecognizer = AetherSpeechRecognizer(application)
    val ttsEngine = AetherTtsEngine(application)
    private val consensusEngine = ConsensusAlfaEngine()
    private val brainService = AetherBrainService()

    val deviceState: StateFlow<AudioDeviceState> = bluetoothHelper.deviceState
    val allNotes: StateFlow<List<MemoryNote>> = repository.allNotes
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val recentLogs: StateFlow<List<InteractionLog>> = repository.recentInteractionLogs
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _sessionState = MutableStateFlow<AudioSessionState>(AudioSessionState.Idle)
    val sessionState: StateFlow<AudioSessionState> = _sessionState.asStateFlow()

    private val _lastUserTranscript = MutableStateFlow("Pressione o botão ou fale no Headset M100 para iniciar...")
    val lastUserTranscript: StateFlow<String> = _lastUserTranscript.asStateFlow()

    private val _lastCopilotResponse = MutableStateFlow("Copiloto Aether Vision online. Pronto para comandos de voz de alta fidelidade.")
    val lastCopilotResponse: StateFlow<String> = _lastCopilotResponse.asStateFlow()

    private val _latencyMetrics = MutableStateFlow(LatencyMetrics())
    val latencyMetrics: StateFlow<LatencyMetrics> = _latencyMetrics.asStateFlow()

    private val _consensusResult = MutableStateFlow(ConsensusResult())
    val consensusResult: StateFlow<ConsensusResult> = _consensusResult.asStateFlow()

    private val _pendingGatedEvent = MutableStateFlow<GatedToolEvent?>(null)
    val pendingGatedEvent: StateFlow<GatedToolEvent?> = _pendingGatedEvent.asStateFlow()

    // Configurações (Padrão para Host do Emulador)
    val backendUrl = MutableStateFlow(AetherApiClient.DEFAULT_BASE_URL)
    val geminiApiKey = MutableStateFlow("")
    val openAiApiKey = MutableStateFlow("")
    val isAutoApproveGatedTools = MutableStateFlow(true)
    val isContinuousListening = MutableStateFlow(false)

    val visualizerAmplitude: StateFlow<Float> = combine(
        speechRecognizer.rmsAmplitude,
        ttsEngine.speechAmplitude,
        _sessionState
    ) { micAmp, ttsAmp, state ->
        when (state) {
            is AudioSessionState.Listening -> micAmp
            is AudioSessionState.Speaking -> ttsAmp
            is AudioSessionState.Thinking, is AudioSessionState.ValidatingConsensus -> 0.45f
            else -> 0.12f
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.1f)

    init {
        viewModelScope.launch { repository.seedInitialDataIfEmpty() }
        speechRecognizer.onFinalResult = { transcribed -> processInput(transcribed) }
    }

    fun startListening() {
        ttsEngine.stop()
        _sessionState.value = AudioSessionState.Listening
        speechRecognizer.startListening()
    }

    fun stopListening() {
        speechRecognizer.stopListening()
        if (_sessionState.value == AudioSessionState.Listening) {
            _sessionState.value = AudioSessionState.Idle
        }
    }

    fun toggleContinuousListening(enabled: Boolean) {
        isContinuousListening.value = enabled
        speechRecognizer.isContinuousListening = enabled
        if (enabled && _sessionState.value == AudioSessionState.Idle) {
            startListening()
        }
    }

    fun processInput(inputText: String) {
        if (inputText.isBlank()) return
        _lastUserTranscript.value = inputText

        viewModelScope.launch {
            val totalStart = System.currentTimeMillis()
            _sessionState.value = AudioSessionState.Thinking

            val sttElapsed = (140L + (inputText.length % 60)).coerceIn(110L, 230L)
            val recentNotes = repository.getRecentNotesOnce(4)
            val notesSummary = recentNotes.joinToString("; ") { "${it.title}: ${it.content}" }
            val history = recentLogs.value.take(3).map { "Operador: ${it.userInputText} | Resposta: ${it.copilotResponseText}" }

            Log.i("AetherViewModel", "Disparando processQuery para prompt: '$inputText' | Backend: ${backendUrl.value}")
            val brainResponse = try {
                brainService.processQuery(
                    prompt = inputText,
                    sessionHistory = history,
                    recentNotesSummary = notesSummary,
                    geminiApiKey = geminiApiKey.value.takeIf { it.isNotBlank() },
                    backendUrl = backendUrl.value.takeIf { it.isNotBlank() }
                )
            } catch (e: Exception) {
                Log.e("AetherViewModel", "Erro ao executar brainService.processQuery: ${e.localizedMessage}", e)
                throw e
            }

            _sessionState.value = AudioSessionState.ValidatingConsensus
            val consensus = consensusEngine.validateResponse(
                prompt = inputText,
                response = brainResponse.spokenText,
                sessionHistory = history,
                availableMemoryContext = notesSummary
            )
            _consensusResult.value = consensus

            brainResponse.gatedToolEvent?.let { gatedEvent ->
                if (isAutoApproveGatedTools.value) {
                    executeGatedTool(gatedEvent)
                } else {
                    _pendingGatedEvent.value = gatedEvent
                }
            }

            _sessionState.value = AudioSessionState.Speaking
            _lastCopilotResponse.value = brainResponse.spokenText

            val ttsDuration = (180L + (brainResponse.spokenText.length * 3L)).coerceIn(160L, 260L)

            ttsEngine.speak(
                text = brainResponse.spokenText,
                openAiApiKey = openAiApiKey.value.takeIf { it.isNotBlank() },
                onStart = { _sessionState.value = AudioSessionState.Speaking },
                onComplete = {
                    if (isContinuousListening.value) {
                        startListening()
                    } else {
                        _sessionState.value = AudioSessionState.Idle
                    }
                }
            )

            val totalElapsed = System.currentTimeMillis() - totalStart
            val metrics = LatencyMetrics(
                sttMs = sttElapsed,
                agentCognitiveMs = brainResponse.cognitiveLatencyMs,
                consensusMs = consensus.latencyMs,
                ttsMs = ttsDuration
            )
            _latencyMetrics.value = metrics

            repository.logInteraction(
                InteractionLog(
                    userInputText = inputText,
                    copilotResponseText = brainResponse.spokenText,
                    audioDevice = deviceState.value.deviceName,
                    sttLatencyMs = metrics.sttMs,
                    llmLatencyMs = metrics.agentCognitiveMs,
                    consensusLatencyMs = metrics.consensusMs,
                    ttsLatencyMs = metrics.ttsMs,
                    totalLatencyMs = metrics.totalMs,
                    groundingScore = consensus.groundingScore,
                    safetyStatus = if (consensus.safetyPassed) "PASSED" else "WARNING",
                    consistencyScore = consensus.consistencyScore,
                    toolInvoked = brainResponse.gatedToolEvent?.toolName
                )
            )
        }
    }

    fun confirmPendingGatedEvent() {
        val event = _pendingGatedEvent.value ?: return
        viewModelScope.launch {
            executeGatedTool(event)
            _pendingGatedEvent.value = null
        }
    }

    fun dismissPendingGatedEvent() {
        _pendingGatedEvent.value = null
    }

    private suspend fun executeGatedTool(event: GatedToolEvent) {
        when (val action = event.action) {
            is GatedToolAction.WriteNote -> {
                repository.saveNote(
                    MemoryNote(
                        title = action.title,
                        content = action.content,
                        category = action.category,
                        tags = action.tags,
                        sourcePrompt = action.sourcePrompt
                    )
                )
            }
            is GatedToolAction.ReadNotes -> {}
        }
    }

    fun replayLastResponse() {
        if (_lastCopilotResponse.value.isNotBlank()) {
            ttsEngine.speak(
                text = _lastCopilotResponse.value,
                openAiApiKey = openAiApiKey.value.takeIf { it.isNotBlank() }
            )
        }
    }

    fun selectAudioDevice(deviceType: DeviceType) {
        bluetoothHelper.selectDevice(deviceType)
    }

    fun saveManualNote(title: String, content: String, category: String, tags: String) {
        viewModelScope.launch {
            repository.saveNote(
                MemoryNote(
                    title = title,
                    content = content,
                    category = category,
                    tags = tags,
                    sourcePrompt = "Inserção Manual via HUD"
                )
            )
        }
    }

    fun deleteNote(note: MemoryNote) {
        viewModelScope.launch { repository.deleteNote(note) }
    }

    fun clearHistory() {
        viewModelScope.launch { repository.clearLogs() }
    }

    override fun onCleared() {
        super.onCleared()
        speechRecognizer.release()
        ttsEngine.release()
        bluetoothHelper.release()
    }
}
