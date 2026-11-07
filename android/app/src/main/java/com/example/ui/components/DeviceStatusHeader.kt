package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BluetoothAudio
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.AudioDeviceState
import com.example.data.model.DeviceType
import com.example.ui.theme.AetherCyan
import com.example.ui.theme.AetherCyanGlow
import com.example.ui.theme.AetherEmerald
import com.example.ui.theme.SpaceCardBg
import com.example.ui.theme.SpaceSurfaceBorder

@Composable
fun DeviceStatusHeader(
    deviceState: AudioDeviceState,
    onSelectDevice: (DeviceType) -> Unit,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showDeviceMenu by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SpaceCardBg)
            .border(1.dp, SpaceSurfaceBorder, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.clickable { showDeviceMenu = true }
            ) {
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(if (deviceState.isBluetoothScoConnected) AetherCyanGlow else Color(0x3364748B)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (deviceState.currentDevice == DeviceType.BLUETOOTH_HEADSET_M100) {
                            Icons.Default.BluetoothAudio
                        } else {
                            Icons.Default.Mic
                        },
                        contentDescription = "Dispositivo de Áudio",
                        tint = if (deviceState.isBluetoothScoConnected) AetherCyan else Color(0xFF94A3B8),
                        modifier = Modifier.size(20.dp)
                    )
                }

                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = deviceState.deviceName,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFF1F5F9)
                        )
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(if (deviceState.isBluetoothScoConnected) AetherEmerald else Color(0xFFEF4444))
                        )
                    }

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "SCO ${deviceState.sampleRateHz / 1000}kHz • Bateria ${deviceState.batteryPercent}%",
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            color = Color(0xFF94A3B8)
                        )
                        Text(
                            text = "• Trocar",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = AetherCyan
                        )
                    }
                }
            }

            IconButton(onClick = onOpenSettings) {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = "Configurações da API",
                    tint = Color(0xFFCBD5E1)
                )
            }
        }

        DropdownMenu(
            expanded = showDeviceMenu,
            onDismissRequest = { showDeviceMenu = false }
        ) {
            DropdownMenuItem(
                text = { Text("Headset M100 (Bluetooth SCO 16kHz)") },
                onClick = {
                    onSelectDevice(DeviceType.BLUETOOTH_HEADSET_M100)
                    showDeviceMenu = false
                },
                leadingIcon = {
                    Icon(Icons.Default.BluetoothAudio, contentDescription = null, tint = AetherCyan)
                }
            )
            DropdownMenuItem(
                text = { Text("Microfone Interno do Aparelho (48kHz)") },
                onClick = {
                    onSelectDevice(DeviceType.INTERNAL_MICROPHONE)
                    showDeviceMenu = false
                },
                leadingIcon = {
                    Icon(Icons.Default.Mic, contentDescription = null)
                }
            )
            DropdownMenuItem(
                text = { Text("Fone com Fio / P3 (44.1kHz)") },
                onClick = {
                    onSelectDevice(DeviceType.WIRED_HEADSET)
                    showDeviceMenu = false
                }
            )
        }
    }
}
