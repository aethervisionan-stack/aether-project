package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lan
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.AetherViewModel
import com.example.ui.theme.AetherCyan
import com.example.ui.theme.SpaceSurfaceBorder

@Composable
fun SettingsDialog(
    viewModel: AetherViewModel,
    onDismiss: () -> Unit
) {
    var tempBackendUrl by remember { mutableStateOf(viewModel.backendUrl.value) }
    var tempGeminiKey by remember { mutableStateOf(viewModel.geminiApiKey.value) }
    var tempOpenAiKey by remember { mutableStateOf(viewModel.openAiApiKey.value) }
    var autoApprove by remember { mutableStateOf(viewModel.isAutoApproveGatedTools.value) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF0C1322),
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Settings, contentDescription = null, tint = AetherCyan)
                Text(
                    text = "Configuração do Aether Vision",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFF1F5F9)
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Ajuste os parâmetros do pipeline agêntico, endpoints e chaves cognitivas.",
                    fontSize = 12.sp,
                    color = Color(0xFF94A3B8)
                )

                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(Icons.Default.Lan, contentDescription = null, tint = AetherCyan, modifier = Modifier.padding(2.dp))
                        Text(text = "URL do Backend FastAPI (Host Emulador)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFCBD5E1))
                    }
                    OutlinedTextField(
                        value = tempBackendUrl,
                        onValueChange = { tempBackendUrl = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("http://10.0.2.2:8000/") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AetherCyan,
                            unfocusedBorderColor = SpaceSurfaceBorder,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color(0xFFE2E8F0)
                        )
                    )
                    Text(text = "Padrão para emulador Android: http://10.0.2.2:8000/", fontSize = 10.sp, color = Color(0xFF64748B))
                }

                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(Icons.Default.Key, contentDescription = null, tint = AetherCyan, modifier = Modifier.padding(2.dp))
                        Text(text = "OpenAI API Key (Opcional - TTS Nova HD)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFCBD5E1))
                    }
                    OutlinedTextField(
                        value = tempOpenAiKey,
                        onValueChange = { tempOpenAiKey = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("sk-proj-...") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AetherCyan,
                            unfocusedBorderColor = SpaceSurfaceBorder,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color(0xFFE2E8F0)
                        )
                    )
                    Text(text = "Para voz expressiva HD tts-1-hd 'nova'. Quando vazio, utiliza Android High-Fi TTS nativo.", fontSize = 10.sp, color = Color(0xFF64748B))
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF070B12))
                        .border(1.dp, SpaceSurfaceBorder, RoundedCornerShape(8.dp))
                        .padding(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = "Auto-Gravar Gated Tools", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF1F5F9))
                            Text(text = "Gravar no SQLite imediatamente sob comando de voz explícito (ex: 'salvar')", fontSize = 10.sp, color = Color(0xFF94A3B8))
                        }
                        Switch(
                            checked = autoApprove,
                            onCheckedChange = { autoApprove = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = AetherCyan, checkedTrackColor = Color(0xFF005234))
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    viewModel.backendUrl.value = tempBackendUrl.trim()
                    viewModel.openAiApiKey.value = tempOpenAiKey.trim()
                    viewModel.isAutoApproveGatedTools.value = autoApprove
                    onDismiss()
                },
                colors = ButtonDefaults.buttonColors(containerColor = AetherCyan, contentColor = Color(0xFF070B12))
            ) {
                Text("Salvar Parâmetros", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFF94A3B8))
            ) {
                Text("Fechar")
            }
        }
    )
}
