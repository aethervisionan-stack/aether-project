package com.aethervision.mobile.handsfree

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/** Optional sticky restart after reboot — user must have granted runtime permissions previously. */
class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        val service = Intent(context, HandsFreeForegroundService::class.java)
        ContextCompat.startForegroundService(context, service)
    }
}
