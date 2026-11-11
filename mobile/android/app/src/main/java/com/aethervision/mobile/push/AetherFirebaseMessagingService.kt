package com.aethervision.mobile.push

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * FCM scaffolding — data pushes can nudge hands-free or surface OS Bridge confirms.
 * Requires google-services.json; without it the Google Services plugin is skipped at build time
 * but this class still compiles against firebase-messaging.
 */
class AetherFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        Log.i(TAG, "FCM token refreshed (len=${token.length})")
        FcmTokenRegistrar.register(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        Log.i(TAG, "FCM message from=${message.from} keys=${data.keys}")
        when (data["type"]) {
            "handsfree_ping" -> Log.i(TAG, "hands-free ping — keep FGS alive")
            "os_bridge_confirm" -> Log.i(TAG, "OS Bridge confirm nudge: ${data["tool"]}")
            else -> Log.d(TAG, "unhandled push type=${data["type"]}")
        }
    }

    companion object {
        private const val TAG = "AetherFcm"
    }
}
