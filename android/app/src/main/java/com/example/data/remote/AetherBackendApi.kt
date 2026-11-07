package com.example.data.remote

import com.squareup.moshi.Json
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

data class AudioProcessRequestDto(
    val query: String,
    val client: String = "aether_m100_android"
)

data class AudioProcessResponseDto(
    @Json(name = "spoken_response") val spokenResponse: String? = null,
    val response: String? = null,
    @Json(name = "response_text") val responseText: String? = null,
    val text: String? = null,
    val transcript: String? = null
)

data class HealthResponseDto(
    val status: String? = null,
    val version: String? = null,
    @Json(name = "pipeline_mode") val pipelineMode: String? = null
)

interface AetherBackendApi {
    @POST("process-audio")
    suspend fun processAudio(@Body body: AudioProcessRequestDto): Response<AudioProcessResponseDto>

    @GET("health")
    suspend fun health(): Response<HealthResponseDto>
}
