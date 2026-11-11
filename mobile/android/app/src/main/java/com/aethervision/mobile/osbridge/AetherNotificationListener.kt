package com.aethervision.mobile.osbridge

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.aethervision.bridge.BridgeWebSocketClient

/**
 * NotificationListener → same inject path as Accessibility notification events.
 * Complements com.aethervision.bridge.AetherAccessibilityService (do not duplicate that service).
 */
class AetherNotificationListener : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        val extras = sbn.notification.extras
        val title = extras?.getCharSequence("android.title")?.toString() ?: ""
        val body = extras?.getCharSequence("android.text")?.toString() ?: ""
        Log.d(TAG, "posted ${sbn.packageName}: $title")
        BridgeWebSocketClient.injectNotification(
            packageName = sbn.packageName ?: "unknown",
            title = title,
            body = body,
            sender = null,
        )
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        // no-op scaffold
    }

    companion object {
        private const val TAG = "AetherNotifListener"
    }
}
