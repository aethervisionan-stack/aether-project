package com.example.data.remote

import android.util.Log
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

object AetherApiClient {

    private const val TAG = "AetherApiClient"

    // Endereço de loopback do emulador para o host
    const val DEFAULT_BASE_URL = "http://10.0.2.2:8000/"

    private val moshi: Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    private val loggingInterceptor = HttpLoggingInterceptor { message ->
        Log.d(TAG, "HTTP: $message")
    }.apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .addInterceptor(loggingInterceptor)
        .addInterceptor { chain ->
            val request = chain.request()
            try {
                chain.proceed(request)
            } catch (e: Exception) {
                Log.e(TAG, "Falha de conexão com ${request.url}: ${e.localizedMessage}", e)
                throw e
            }
        }
        .build()

    fun createApi(baseUrl: String = DEFAULT_BASE_URL): AetherBackendApi {
        val normalizedUrl = when {
            baseUrl.isBlank() -> DEFAULT_BASE_URL
            !baseUrl.endsWith("/") -> "$baseUrl/"
            else -> baseUrl
        }

        Log.i(TAG, "Inicializando Retrofit client para base URL: $normalizedUrl")

        return try {
            Retrofit.Builder()
                .baseUrl(normalizedUrl)
                .client(okHttpClient)
                .addConverterFactory(MoshiConverterFactory.create(moshi))
                .build()
                .create(AetherBackendApi::class.java)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao instanciar Retrofit com base URL '$normalizedUrl': ${e.message}", e)
            Retrofit.Builder()
                .baseUrl(DEFAULT_BASE_URL)
                .client(okHttpClient)
                .addConverterFactory(MoshiConverterFactory.create(moshi))
                .build()
                .create(AetherBackendApi::class.java)
        }
    }
}
