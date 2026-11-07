package com.example.service

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothHeadset
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.media.AudioManager
import android.os.Build
import android.util.Log
import com.example.data.model.AudioDeviceState
import com.example.data.model.DeviceType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class BluetoothAudioHelper(context: Context) {

    private val appContext = context.applicationContext
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val bluetoothAdapter: BluetoothAdapter? = resolveAdapter()

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
                Log.i(TAG, "HEADSET profile connected devices=${headsetProxy?.connectedDevices?.size ?: 0}")
                refreshScoState()
            }
        }

        override fun onServiceDisconnected(profile: Int) {
            if (profile == BluetoothProfile.HEADSET) {
                Log.w(TAG, "HEADSET profile disconnected")
                headsetProxy = null
                updateState(isSco = false)
            }
        }
    }

    init {
        runCatching {
            bluetoothAdapter?.getProfileProxy(appContext, profileListener, BluetoothProfile.HEADSET)
        }.onFailure { Log.w(TAG, "Bluetooth profile proxy unavailable: ${it.message}") }

        runCatching {
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            audioManager.startBluetoothSco()
            audioManager.isBluetoothScoOn = true
            Log.i(TAG, "Requested Bluetooth SCO start scoOn=${audioManager.isBluetoothScoOn}")
        }.onFailure {
            Log.w(TAG, "SCO start failed (emulator/no BT is OK): ${it.localizedMessage}")
        }
        refreshScoState()
    }

    fun selectDevice(deviceType: DeviceType) {
        Log.i(TAG, "selectDevice=$deviceType")
        when (deviceType) {
            DeviceType.BLUETOOTH_HEADSET_M100 -> {
                runCatching {
                    audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                    audioManager.startBluetoothSco()
                    audioManager.isBluetoothScoOn = true
                }.onFailure {
                    Log.e(TAG, "Failed enabling SCO: ${it.localizedMessage}", it)
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
        runCatching {
            bluetoothAdapter?.closeProfileProxy(BluetoothProfile.HEADSET, headsetProxy)
        }.onFailure { Log.w(TAG, "closeProfileProxy: ${it.localizedMessage}") }
        headsetProxy = null
        Log.i(TAG, "release()")
    }

    private fun refreshScoState() {
        val sco = audioManager.isBluetoothScoOn ||
            (headsetProxy?.connectedDevices?.isNotEmpty() == true)
        Log.d(TAG, "refreshScoState sco=$sco mode=${audioManager.mode}")
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
        return _deviceState.value.batteryPercent.coerceIn(1, 100)
    }

    private fun stopScoQuietly() {
        runCatching {
            audioManager.stopBluetoothSco()
            audioManager.isBluetoothScoOn = false
            audioManager.mode = AudioManager.MODE_NORMAL
        }.onFailure { Log.w(TAG, "stopScoQuietly: ${it.localizedMessage}") }
    }

    private fun resolveAdapter(): BluetoothAdapter? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val manager = appContext.getSystemService(BluetoothManager::class.java)
                manager?.adapter
            } else {
                @Suppress("DEPRECATION")
                BluetoothAdapter.getDefaultAdapter()
            }
        } catch (e: Exception) {
            Log.w(TAG, "resolveAdapter failed: ${e.localizedMessage}")
            null
        }
    }

    companion object {
        private const val TAG = "BluetoothAudioHelper"
    }
}
