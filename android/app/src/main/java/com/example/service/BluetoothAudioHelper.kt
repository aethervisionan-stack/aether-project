package com.example.service

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothHeadset
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.media.AudioManager
import android.util.Log
import com.example.data.model.AudioDeviceState
import com.example.data.model.DeviceType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class BluetoothAudioHelper(context: Context) {

    private val appContext = context.applicationContext
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val bluetoothAdapter: BluetoothAdapter? = BluetoothAdapter.getDefaultAdapter()

    private val _deviceState = MutableStateFlow(
        AudioDeviceState(
            currentDevice = DeviceType.BLUETOOTH_HEADSET_M100,
            deviceName = "Headset M100 (SCO)",
            isBluetoothScoConnected = false,
            sampleRateHz = 16_000,
            batteryPercent = 86
        )
    )
    val deviceState: StateFlow<AudioDeviceState> = _deviceState.asStateFlow()

    private var headsetProxy: BluetoothHeadset? = null

    private val profileListener = object : BluetoothProfile.ServiceListener {
        override fun onServiceConnected(profile: Int, proxy: BluetoothProfile?) {
            if (profile == BluetoothProfile.HEADSET) {
                headsetProxy = proxy as? BluetoothHeadset
                refreshScoState()
            }
        }

        override fun onServiceDisconnected(profile: Int) {
            if (profile == BluetoothProfile.HEADSET) {
                headsetProxy = null
                updateState(isSco = false)
            }
        }
    }

    init {
        runCatching {
            bluetoothAdapter?.getProfileProxy(appContext, profileListener, BluetoothProfile.HEADSET)
        }.onFailure { Log.w(TAG, "Bluetooth profile proxy unavailable: ${it.message}") }
        // Prefer SCO for M100 path when possible; safe no-op on emulator without BT.
        runCatching {
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            audioManager.startBluetoothSco()
            audioManager.isBluetoothScoOn = true
        }
        refreshScoState()
    }

    fun selectDevice(deviceType: DeviceType) {
        when (deviceType) {
            DeviceType.BLUETOOTH_HEADSET_M100 -> {
                runCatching {
                    audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                    audioManager.startBluetoothSco()
                    audioManager.isBluetoothScoOn = true
                }
                _deviceState.value = AudioDeviceState(
                    currentDevice = deviceType,
                    deviceName = "Headset M100 (SCO)",
                    isBluetoothScoConnected = audioManager.isBluetoothScoOn,
                    sampleRateHz = 16_000,
                    batteryPercent = estimateBattery()
                )
            }
            DeviceType.INTERNAL_MICROPHONE -> {
                stopScoQuietly()
                _deviceState.value = AudioDeviceState(
                    currentDevice = deviceType,
                    deviceName = "Microfone Interno",
                    isBluetoothScoConnected = false,
                    sampleRateHz = 48_000,
                    batteryPercent = 100
                )
            }
            DeviceType.WIRED_HEADSET -> {
                stopScoQuietly()
                _deviceState.value = AudioDeviceState(
                    currentDevice = deviceType,
                    deviceName = "Fone com Fio / P3",
                    isBluetoothScoConnected = false,
                    sampleRateHz = 44_100,
                    batteryPercent = 100
                )
            }
        }
    }

    fun release() {
        stopScoQuietly()
        bluetoothAdapter?.closeProfileProxy(BluetoothProfile.HEADSET, headsetProxy)
        headsetProxy = null
    }

    private fun refreshScoState() {
        val sco = audioManager.isBluetoothScoOn ||
            (headsetProxy?.connectedDevices?.isNotEmpty() == true)
        updateState(isSco = sco)
    }

    private fun updateState(isSco: Boolean) {
        val current = _deviceState.value
        if (current.currentDevice != DeviceType.BLUETOOTH_HEADSET_M100) return
        _deviceState.value = current.copy(
            isBluetoothScoConnected = isSco,
            batteryPercent = estimateBattery()
        )
    }

    private fun estimateBattery(): Int {
        // Android does not expose a stable generic headset battery API for all M100 clones.
        return _deviceState.value.batteryPercent.coerceIn(1, 100)
    }

    private fun stopScoQuietly() {
        runCatching {
            audioManager.stopBluetoothSco()
            audioManager.isBluetoothScoOn = false
            audioManager.mode = AudioManager.MODE_NORMAL
        }
    }

    companion object {
        private const val TAG = "BluetoothAudioHelper"
    }
}
