package com.aethervision.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.aethervision.bridge.BridgeWebSocketClient
import com.aethervision.mobile.handsfree.HandsFreeForegroundService

/**
 * Unified launcher: hands-free FGS + OS Bridge connect / Accessibility enable.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var statusView: TextView

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
            statusView.text = if (grants.values.all { it }) {
                startHandsFree()
                "Hands-free service started"
            } else {
                "Grant mic / location / camera to enable hands-free"
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        statusView = TextView(this).apply {
            text = "Aether Vision — hands-free + OS Bridge"
            textSize = 18f
            setTextColor(0xFFE8F4F8.toInt())
            setPadding(0, 0, 0, 24)
        }

        val httpInput = EditText(this).apply {
            setText(BridgeWebSocketClient.httpBase)
            hint = "HTTP base (emulator: http://10.0.2.2:8000)"
            setTextColor(0xFFE8F4F8.toInt())
            setHintTextColor(0xFF8AA0AA.toInt())
        }
        val wsInput = EditText(this).apply {
            setText(BridgeWebSocketClient.wsUrl)
            hint = "WS URL"
            setTextColor(0xFFE8F4F8.toInt())
            setHintTextColor(0xFF8AA0AA.toInt())
        }
        val tokenInput = EditText(this).apply {
            hint = "AETHER_OS_BRIDGE_TOKEN (optional)"
            setTextColor(0xFFE8F4F8.toInt())
            setHintTextColor(0xFF8AA0AA.toInt())
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 72, 48, 48)
            addView(statusView)
            addView(Button(this@MainActivity).apply {
                text = "Start hands-free"
                setOnClickListener { ensurePermissionsAndStart() }
            })
            addView(Button(this@MainActivity).apply {
                text = "Stop hands-free"
                setOnClickListener {
                    stopService(Intent(this@MainActivity, HandsFreeForegroundService::class.java))
                    statusView.text = "Hands-free stopped"
                }
            })
            addView(httpInput)
            addView(wsInput)
            addView(tokenInput)
            addView(Button(this@MainActivity).apply {
                text = "Open Accessibility settings"
                setOnClickListener {
                    startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                }
            })
            addView(Button(this@MainActivity).apply {
                text = "Connect OS Bridge"
                setOnClickListener {
                    BridgeWebSocketClient.httpBase = httpInput.text.toString().trim()
                    BridgeWebSocketClient.wsUrl = wsInput.text.toString().trim()
                    BridgeWebSocketClient.bridgeToken = tokenInput.text.toString().trim()
                    BridgeWebSocketClient.connect()
                    statusView.text = "OS Bridge → ${BridgeWebSocketClient.wsUrl}"
                }
            })
            addView(Button(this@MainActivity).apply {
                text = "Disconnect OS Bridge"
                setOnClickListener {
                    BridgeWebSocketClient.disconnect()
                    statusView.text = "OS Bridge disconnected"
                }
            })
        }

        setContentView(ScrollView(this).apply { addView(root) })
    }

    private fun ensurePermissionsAndStart() {
        val needed = mutableListOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CAMERA,
        )
        if (Build.VERSION.SDK_INT >= 33) {
            needed += Manifest.permission.POST_NOTIFICATIONS
        }
        val missing = needed.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            startHandsFree()
            statusView.text = "Hands-free service started"
        } else {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    private fun startHandsFree() {
        ContextCompat.startForegroundService(
            this,
            Intent(this, HandsFreeForegroundService::class.java),
        )
    }
}
