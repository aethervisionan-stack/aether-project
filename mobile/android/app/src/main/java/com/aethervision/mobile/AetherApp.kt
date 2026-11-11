package com.aethervision.mobile

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.aethervision.mobile.push.FcmTokenRegistrar

class AetherApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ensureHandsFreeChannel()
        FcmTokenRegistrar.refreshAsync(this)
    }

    private fun ensureHandsFreeChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            getString(R.string.handsfree_channel_id),
            getString(R.string.handsfree_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Continuous wake word, VAD, GPS, and vision sideband"
            setShowBadge(false)
        }
        mgr.createNotificationChannel(channel)
    }
}
