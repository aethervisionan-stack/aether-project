package com.aethervision.bridge

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

/**
 * Native OS Bridge entry — walks AccessibilityNodeInfo trees, collects visible text,
 * and dispatches gestures for agent-confirmed taps/swipes.
 */
class AetherAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        BridgeWebSocketClient.log("AetherAccessibilityService connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        when (event.eventType) {
            AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED -> {
                val title = event.text?.joinToString(" ") ?: ""
                val pkg = event.packageName?.toString() ?: "unknown"
                BridgeWebSocketClient.injectNotification(
                    packageName = pkg,
                    title = title,
                    body = event.parcelableData?.toString() ?: "",
                    sender = event.parcelableData?.let { null },
                )
            }
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                val root = rootInActiveWindow ?: return
                val snapshot = snapshotTree(root)
                BridgeWebSocketClient.pushUiSnapshot(snapshot)
            }
        }
    }

    override fun onInterrupt() {
        BridgeWebSocketClient.log("AetherAccessibilityService interrupted")
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    fun snapshotTree(root: AccessibilityNodeInfo, maxNodes: Int = 200): JSONObject {
        val visible = JSONArray()
        val summary = StringBuilder()
        var count = 0

        fun walk(node: AccessibilityNodeInfo?, depth: Int) {
            if (node == null || count >= maxNodes) return
            count += 1
            val text = sequenceOf(node.text, node.contentDescription)
                .mapNotNull { it?.toString()?.trim() }
                .firstOrNull { it.isNotEmpty() }
            if (!text.isNullOrEmpty() && node.isVisibleToUser) {
                visible.put(text)
                if (summary.length < 1500) {
                    if (summary.isNotEmpty()) summary.append(" | ")
                    summary.append(text)
                }
            }
            for (i in 0 until node.childCount) {
                walk(node.getChild(i), depth + 1)
            }
        }

        walk(root, 0)
        return JSONObject()
            .put("package", root.packageName?.toString() ?: "unknown")
            .put("visible_text", visible)
            .put("tree_summary", summary.toString())
            .put("node_count", count)
            .put("title", root.packageName?.toString() ?: "ui")
            .put("body", "UI snapshot (${visible.length()} texts)")
    }

    /** Agent-driven tap via dispatchGesture (requires canPerformGestures). */
    fun tap(x: Float, y: Float, durationMs: Long = 50L): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false
        val path = Path().apply { moveTo(x, y) }
        val stroke = GestureDescription.StrokeDescription(path, 0, durationMs)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        return dispatchGesture(gesture, null, null)
    }

    fun swipe(
        x1: Float,
        y1: Float,
        x2: Float,
        y2: Float,
        durationMs: Long = 300L,
    ): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false
        val path = Path().apply {
            moveTo(x1, y1)
            lineTo(x2, y2)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, durationMs)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        return dispatchGesture(gesture, null, null)
    }

    companion object {
        @Volatile
        var instance: AetherAccessibilityService? = null
            private set
    }
}
