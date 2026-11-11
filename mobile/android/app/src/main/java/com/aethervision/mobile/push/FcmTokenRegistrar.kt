package com.aethervision.mobile.push

import android.content.Context
import android.util.Log
import com.aethervision.mobile.BuildConfig
import com.google.firebase.messaging.FirebaseMessaging
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.Executors

object FcmTokenRegistrar {
    private const val TAG = "FcmTokenRegistrar"
    private val http = OkHttpClient()
    private val io = Executors.newSingleThreadExecutor()

    fun refreshAsync(context: Context) {
        if (!BuildConfig.HAS_GOOGLE_SERVICES) {
            Log.w(TAG, "google-services.json missing — skip FCM token refresh")
            return
        }
        try {
            FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token -> register(context, token) }
                .addOnFailureListener { t -> Log.w(TAG, "token fetch failed", t) }
        } catch (t: Throwable) {
            Log.w(TAG, "FirebaseMessaging unavailable", t)
        }
    }

    fun register(context: Context, token: String) {
        val url = BuildConfig.AETHER_PUSH_REGISTER_URL
        if (url.isBlank()) return
        io.execute {
            try {
                val body = JSONObject()
                    .put("platform", "android")
                    .put("token", token)
                    .put("app", context.packageName)
                    .toString()
                    .toRequestBody("application/json".toMediaType())
                val req = Request.Builder().url(url).post(body).build()
                http.newCall(req).execute().use { resp ->
                    Log.i(TAG, "register → ${resp.code}")
                }
            } catch (t: Throwable) {
                Log.w(TAG, "register failed (backend may be down)", t)
            }
        }
    }
}
