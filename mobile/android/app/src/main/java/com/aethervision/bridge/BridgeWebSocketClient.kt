package com.aethervision.bridge

import android.util.Log
import com.aethervision.mobile.BuildConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * IPC bridge from AccessibilityService → Aether FastAPI agent engine.
 *
 * - HTTP POST `/tools/os-bridge/mobile/inject` for notifications / UI snapshots
 * - Optional WebSocket to `/ws/live` for keepalive / agent events
 *
 * Lives in the same APK as hands-free (`com.aethervision.mobile`) — do not split trees.
 */
object BridgeWebSocketClient {
    private const val TAG = "AetherBridge"

    @Volatile
    var httpBase: String = BuildConfig.BRIDGE_HTTP_BASE

    @Volatile
    var wsUrl: String = BuildConfig.BRIDGE_WS_URL

    /** Optional Bearer matching backend AETHER_OS_BRIDGE_TOKEN (never hardcode secrets). */
    @Volatile
    var bridgeToken: String = ""

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS)
        .build()

    private var socket: WebSocket? = null

    fun log(message: String) {
        Log.i(TAG, message)
    }

    fun connect() {
        disconnect()
        val req = Request.Builder().url(wsUrl).build()
        socket = client.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                log("WS open ${response.code}")
                webSocket.send(
                    JSONObject()
                        .put("type", "client_hello")
                        .put("source", "android_accessibility")
                        .toString(),
                )
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                log("WS message ${text.take(200)}")
                // Gesture commands from agent (already confirmed server-side):
                // {"type":"os_gesture","mode":"tap","x":100,"y":200}
                try {
                    val msg = JSONObject(text)
                    if (msg.optString("type") == "os_gesture") {
                        val svc = AetherAccessibilityService.instance ?: return
                        when (msg.optString("mode")) {
                            "tap" -> svc.tap(
                                msg.optDouble("x").toFloat(),
                                msg.optDouble("y").toFloat(),
                            )
                            "swipe" -> svc.swipe(
                                msg.optDouble("x1").toFloat(),
                                msg.optDouble("y1").toFloat(),
                                msg.optDouble("x2").toFloat(),
                                msg.optDouble("y2").toFloat(),
                            )
                        }
                    }
                } catch (e: Exception) {
                    log("WS parse error: ${e.message}")
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                log("WS failure: ${t.message}")
            }
        })
    }

    fun disconnect() {
        socket?.close(1000, "bye")
        socket = null
    }

    fun injectNotification(
        packageName: String,
        title: String,
        body: String,
        sender: String?,
    ) {
        val payload = JSONObject()
            .put("package", packageName)
            .put("title", title)
            .put("body", body)
            .put("sender", sender)
            .put("app", packageName)
            .put("screen_lit", false)
            .put("priority_hint", "medium")
        postInject(payload)
    }

    fun pushUiSnapshot(snapshot: JSONObject) {
        val payload = JSONObject()
            .put("package", snapshot.optString("package", "unknown"))
            .put("title", snapshot.optString("title", "ui"))
            .put("body", snapshot.optString("body", ""))
            .put("app", "accessibility")
            .put("screen_lit", false)
            .put("priority_hint", "low")
            .put("visible_text", snapshot.optJSONArray("visible_text"))
            .put("tree_summary", snapshot.optString("tree_summary"))
        postInject(payload)
    }

    private fun postInject(payload: JSONObject) {
        Thread {
            try {
                val url = httpBase.trimEnd('/') + "/tools/os-bridge/mobile/inject"
                val body = payload.toString()
                    .toRequestBody("application/json; charset=utf-8".toMediaType())
                val builder = Request.Builder().url(url).post(body)
                val token = bridgeToken.trim()
                if (token.isNotEmpty()) {
                    builder.header("Authorization", "Bearer $token")
                }
                client.newCall(builder.build()).execute().use { resp ->
                    log("inject HTTP ${resp.code}")
                }
            } catch (e: Exception) {
                log("inject failed: ${e.message}")
            }
        }.start()
    }
}
