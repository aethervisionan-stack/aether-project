package com.example.data.repository

import android.util.Log
import com.example.data.remote.AetherApiClient
import com.example.data.remote.AetherBackendApi
import com.example.data.remote.HealthResponseDto
import com.example.data.remote.ProcessAudioResponseDto
import com.example.data.remote.WavToneEncoder
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Network façade for FastAPI multipart `/process-audio`.
 * Room persistence stays in [AetherRepository].
 */
class AetherRemoteRepository(
    private val apiFactory: (baseUrl: String) -> AetherBackendApi = AetherApiClient::createApi
) {
    suspend fun health(baseUrl: String): HealthResponseDto? {
        return try {
            val res = apiFactory(baseUrl).health()
            if (res.isSuccessful) res.body() else {
                Log.e(TAG, "health HTTP ${res.code()}: ${res.errorBody()?.string()}")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "health failed: ${e.localizedMessage}", e)
            null
        }
    }

    /**
     * Uploads required multipart **audio** plus optional on-device transcript as **query**.
     */
    suspend fun processAudioMultipart(
        baseUrl: String,
        query: String,
        locale: String = "pt-BR",
        language: String? = "pt",
        clientId: String = "aether_m100_android",
        audioBytes: ByteArray = WavToneEncoder.encodeToneWav()
    ): ProcessAudioResponseDto? {
        val started = System.currentTimeMillis()
        return try {
            val api = apiFactory(baseUrl)
            val audioBody = audioBytes.toRequestBody("audio/wav".toMediaType())
            val audioPart = MultipartBody.Part.createFormData(
                "audio",
                "headset-m100.wav",
                audioBody
            )
            val localeBody = locale.toRequestBody("text/plain".toMediaType())
            val queryBody = query.takeIf { it.isNotBlank() }
                ?.toRequestBody("text/plain".toMediaType())
            val languageBody = language?.takeIf { it.isNotBlank() }
                ?.toRequestBody("text/plain".toMediaType())
            val clientBody = clientId.toRequestBody("text/plain".toMediaType())

            Log.i(
                TAG,
                "POST process-audio multipart bytes=${audioBytes.size} queryChars=${query.length} base=$baseUrl"
            )
            val res = api.processAudio(
                audio = audioPart,
                language = languageBody,
                locale = localeBody,
                query = queryBody,
                client = clientBody
            )
            if (!res.isSuccessful) {
                Log.e(
                    TAG,
                    "process-audio HTTP ${res.code()} in ${System.currentTimeMillis() - started}ms: ${res.errorBody()?.string()}"
                )
                return null
            }
            val body = res.body()
            Log.i(
                TAG,
                "process-audio OK in ${System.currentTimeMillis() - started}ms " +
                    "requestId=${body?.meta?.requestId} responseChars=${body?.responseText?.length ?: 0} " +
                    "consensoMs=${body?.latency?.consensoMs}"
            )
            body
        } catch (e: Exception) {
            Log.e(TAG, "process-audio multipart failed: ${e.localizedMessage}", e)
            null
        }
    }

    companion object {
        private const val TAG = "AetherRemoteRepository"
    }
}
