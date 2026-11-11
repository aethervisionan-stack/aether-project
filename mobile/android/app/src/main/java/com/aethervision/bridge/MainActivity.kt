package com.aethervision.bridge

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val status = TextView(this).apply {
            text = "Enable Accessibility → Connect to Aether backend"
            textSize = 16f
            setPadding(32, 48, 32, 16)
        }
        val httpInput = EditText(this).apply { setText(BridgeWebSocketClient.httpBase) }
        val wsInput = EditText(this).apply { setText(BridgeWebSocketClient.wsUrl) }
        val tokenInput = EditText(this).apply { hint = "AETHER_OS_BRIDGE_TOKEN (optional)" }
        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 24, 24, 24)
            addView(status)
            addView(httpInput)
            addView(wsInput)
            addView(tokenInput)
            addView(Button(this@MainActivity).apply {
                text = "Open Accessibility settings"
                setOnClickListener { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
            })
            addView(Button(this@MainActivity).apply {
                text = "Connect bridge"
                setOnClickListener {
                    BridgeWebSocketClient.httpBase = httpInput.text.toString().trim()
                    BridgeWebSocketClient.wsUrl = wsInput.text.toString().trim()
                    BridgeWebSocketClient.bridgeToken = tokenInput.text.toString().trim()
                    BridgeWebSocketClient.connect()
                    status.text = "Connecting to ${BridgeWebSocketClient.wsUrl}"
                }
            })
            addView(Button(this@MainActivity).apply {
                text = "Disconnect"
                setOnClickListener {
                    BridgeWebSocketClient.disconnect()
                    status.text = "Disconnected"
                }
            })
        })
    }
}
