package com.example.data.model

enum class DeviceType {
    BLUETOOTH_HEADSET_M100,
    INTERNAL_MICROPHONE,
    WIRED_HEADSET
}

data class AudioDeviceState(
    val currentDevice: DeviceType = DeviceType.BLUETOOTH_HEADSET_M100,
    val deviceName: String = "Headset M100 (SCO)",
    val isBluetoothScoConnected: Boolean = false,
    val sampleRateHz: Int = 16_000,
    val batteryPercent: Int = 86
)
