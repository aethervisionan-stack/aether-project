package com.example.data.remote

import com.squareup.moshi.Json
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

/**
 * Mirrors FastAPI `POST /process-audio` multipart contract and JSON envelope.
 *
 * Form fields:
 * - **audio** (file, required) — UploadFile
 * - language, locale, query, client — optional text parts
 */
data class ConsensoResultDto(
    val approved: Boolean = false,
    @param:Json(name = "agreement_ratio") val agreementRatio: Double = 0.0,
    @param:Json(name = "final_text") val finalText: String? = null,
    @param:Json(name = "duration_ms") val durationMs: Long = 0L,
    val skipped: Boolean = false
)

data class LatencyBreakdownDto(
    @param:Json(name = "stt_ms") val sttMs: Long = 0L,
    @param:Json(name = "consenso_ms") val consensoMs: Long = 0L,
    @param:Json(name = "agent_ms") val agentMs: Long = 0L,
    @param:Json(name = "tts_ms") val ttsMs: Long = 0L,
    @param:Json(name = "total_ms") val totalMs: Long = 0L
)

data class ProcessAudioMetaDto(
    @param:Json(name = "request_id") val requestId: String? = null,
    @param:Json(name = "pipeline_mode") val pipelineMode: String? = null,
    @param:Json(name = "use_mock_audio") val useMockAudio: Boolean = true,
    @param:Json(name = "stt_provider") val sttProvider: String? = null,
    @param:Json(name = "tts_provider") val ttsProvider: String? = null,
    @param:Json(name = "consenso_enabled") val consensoEnabled: Boolean = true,
    @param:Json(name = "used_safe_fallback") val usedSafeFallback: Boolean = false
)

data class ProcessAudioResponseDto(
    val transcript: String? = null,
    @param:Json(name = "response_text") val responseText: String? = null,
    val consenso: ConsensoResultDto? = null,
    @param:Json(name = "audio_base64") val audioBase64: String? = null,
    @param:Json(name = "audio_mime_type") val audioMimeType: String? = null,
    val latency: LatencyBreakdownDto? = null,
    val meta: ProcessAudioMetaDto? = null
) {
    /** Spoken copiloto text for TTS / HUD. */
    fun spokenTextOrNull(): String? =
        responseText?.takeIf { it.isNotBlank() }
            ?: consenso?.finalText?.takeIf { it.isNotBlank() }
}

data class HealthResponseDto(
    val status: String? = null,
    val version: String? = null,
    @param:Json(name = "pipeline_mode") val pipelineMode: String? = null,
    @param:Json(name = "use_mock_audio") val useMockAudio: Boolean = true,
    @param:Json(name = "consenso_enabled") val consensoEnabled: Boolean = true,
    @param:Json(name = "depin_ready") val depinReady: Boolean = false,
    @param:Json(name = "web3_rpc_configured") val web3RpcConfigured: Boolean = false
)

interface AetherBackendApi {
    @Multipart
    @POST("process-audio")
    suspend fun processAudio(
        @Part audio: MultipartBody.Part,
        @Part("language") language: RequestBody? = null,
        @Part("locale") locale: RequestBody,
        @Part("query") query: RequestBody? = null,
        @Part("client") client: RequestBody? = null
    ): Response<ProcessAudioResponseDto>

    @GET("health")
    suspend fun health(): Response<HealthResponseDto>
}
