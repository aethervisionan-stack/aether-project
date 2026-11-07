package com.example.ui.screens

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Hearing
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.AetherViewModel
import com.example.ui.AudioSessionState
import com.example.ui.components.ConsensusAlfaCard
import com.example.ui.components.DeviceStatusHeader
import com.example.ui.components.LatencyHudBadge
import com.example.ui.components.WaveformVisualizer
import com.example.ui.theme.AetherCyan
import com.example.ui.theme.AetherEmerald
import com.example.ui.theme.AetherViolet
import com.example.ui.theme.SpaceCardBg
import com.example.ui.theme.SpaceSurfaceBorder

@Composable
fun HudDashboardScreen(
    viewModel: AetherViewModel,
    onOpenSettings: () -> Unit,
    onNavigateToScenarios: () -> Unit,
    modifier: Modifier = Modifier
) {
    val deviceState by viewModel.deviceState.collectAsStateWithLifecycle()
    val sessionState by viewModel.sessionState.collectAsStateWithLifecycle()
    val userTranscript by viewModel.lastUserTranscript.collectAsStateWithLifecycle()
    val copilotResponse by viewModel.lastCopilotResponse.collectAsStateWithLifecycle()
    val latencyMetrics by viewModel.latencyMetrics.collectAsStateWithLifecycle()
    val consensusResult by viewModel.consensusResult.collectAsStateWithLifecycle()
    val amplitude by viewModel.visualizerAmplitude.collectAsStateWithLifecycle()
    val isContinuousListening by viewModel.isContinuousListening.collectAsStateWithLifecycle()

    val infiniteTransition = rememberInfiniteTransition(label = "pulse_halo")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable(animation = tween(1200), repeatMode = RepeatMode.Reverse),
        label = "pulse"
    )

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        DeviceStatusHeader(
            deviceState = deviceState,
            onSelectDevice = { viewModel.selectAudioDevice(it) },
            onOpenSettings = onOpenSettings
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Brush.verticalGradient(listOf(Color(0xFF091222), Color(0xFF060A14))))
                .border(1.2.dp, SpaceSurfaceBorder, RoundedCornerShape(16.dp))
                .padding(14.dp)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(
                            when (sessionState) {
                                is AudioSessionState.Listening -> Color(0x3310B981)
                                is AudioSessionState.Thinking -> Color(0x338B5CF6)
                                is AudioSessionState.ValidatingConsensus -> Color(0x3300E5FF)
                                is AudioSessionState.Speaking -> Color(0x3300E5FF)
                                else -> Color(0x2264748B)
                            }
                        )
                        .border(
                            1.dp,
                            when (sessionState) {
                                is AudioSessionState.Listening -> AetherEmerald
                                is AudioSessionState.Thinking -> AetherViolet
                                is AudioSessionState.ValidatingConsensus -> AetherCyan
                                is AudioSessionState.Speaking -> AetherCyan
                                else -> Color(0xFF334155)
                            },
                            RoundedCornerShape(20.dp)
                        )
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = when (sessionState) {
                            is AudioSessionState.Listening -> "● GRAVANDO HEADSET M100..."
                            is AudioSessionState.Thinking -> "● CÉREBRO COGNITIVO GEMINI..."
                            is AudioSessionState.ValidatingConsensus -> "● AUDITORIA CONSENSO ALFA..."
                            is AudioSessionState.Speaking -> "● SINTETIZANDO VOZ NOVA HD..."
                            else -> "○ COPILOTO STANDBY (HANDS-FREE)"
                        },
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = when (sessionState) {
                            is AudioSessionState.Listening -> AetherEmerald
                            is AudioSessionState.Thinking -> AetherViolet
                            is AudioSessionState.ValidatingConsensus -> AetherCyan
                            is AudioSessionState.Speaking -> AetherCyan
                            else -> Color(0xFF94A3B8)
                        }
                    )
                }

                WaveformVisualizer(
                    isListening = sessionState is AudioSessionState.Listening,
                    isSpeaking = sessionState is AudioSessionState.Speaking,
                    amplitude = amplitude
                )

                Box(contentAlignment = Alignment.Center) {
                    if (sessionState is AudioSessionState.Listening) {
                        Box(
                            modifier = Modifier
                                .size(88.dp)
                                .scale(pulseScale)
                                .clip(CircleShape)
                                .background(AetherEmerald.copy(alpha = 0.25f))
                        )
                    }

                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.radialGradient(
                                    colors = if (sessionState is AudioSessionState.Listening) {
                                        listOf(AetherEmerald, Color(0xFF047857))
                                    } else {
                                        listOf(AetherCyan, Color(0xFF0284C7))
                                    }
                                )
                            )
                            .clickable {
                                if (sessionState is AudioSessionState.Listening) {
                                    viewModel.stopListening()
                                } else {
                                    viewModel.startListening()
                                }
                            }
                            .testTag("push_to_talk_button"),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (sessionState is AudioSessionState.Listening) Icons.Default.Stop else Icons.Default.Mic,
                            contentDescription = "Push To Talk",
                            tint = Color(0xFF070B12),
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }

                Text(
                    text = if (sessionState is AudioSessionState.Listening) "Pressione para enviar" else "Pressione para falar via Headset M100",
                    fontSize = 11.sp,
                    color = Color(0xFF94A3B8)
                )

                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF070B12))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Hearing,
                        contentDescription = null,
                        tint = if (isContinuousListening) AetherEmerald else Color(0xFF64748B),
                        modifier = Modifier.size(16.dp)
                    )
                    Text(text = "Modo Contínuo Hands-Free (VAD)", fontSize = 11.sp, color = Color(0xFFCBD5E1))
                    Switch(
                        checked = isContinuousListening,
                        onCheckedChange = { viewModel.toggleContinuousListening(it) },
                        colors = SwitchDefaults.colors(checkedThumbColor = AetherCyan, checkedTrackColor = Color(0xFF064E3B)),
                        modifier = Modifier.scale(0.8f)
                    )
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(SpaceCardBg)
                    .border(1.dp, SpaceSurfaceBorder, RoundedCornerShape(12.dp))
                    .padding(12.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(Icons.Default.RecordVoiceOver, contentDescription = null, tint = AetherCyan, modifier = Modifier.size(16.dp))
                        Text(
                            text = "ENTRADA DE VOZ DO OPERADOR (M100)",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF94A3B8),
                            letterSpacing = 1.1.sp
                        )
                    }
                    Text(text = userTranscript, style = MaterialTheme.typography.bodyMedium, color = Color(0xFFF1F5F9), lineHeight = 20.sp)
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(SpaceCardBg)
                    .border(1.2.dp, AetherCyan.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                    .padding(12.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(Icons.Default.VolumeUp, contentDescription = null, tint = AetherCyan, modifier = Modifier.size(16.dp))
                            Text(
                                text = "RESPOSTA DE ÁUDIO DO COPILOTO",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = AetherCyan,
                                letterSpacing = 1.1.sp
                            )
                        }

                        IconButton(onClick = { viewModel.replayLastResponse() }, modifier = Modifier.size(28.dp)) {
                            Icon(imageVector = Icons.Default.Replay, contentDescription = "Reouvir áudio", tint = AetherCyan, modifier = Modifier.size(18.dp))
                        }
                    }

                    Text(text = copilotResponse, style = MaterialTheme.typography.bodyMedium, color = Color(0xFFE2E8F0), lineHeight = 22.sp)
                }
            }
        }

        LatencyHudBadge(metrics = latencyMetrics)
        ConsensusAlfaCard(consensus = consensusResult)

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = "AÇÕES RÁPIDAS DE VOZ", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = Color(0xFF94A3B8), letterSpacing = 1.1.sp)
                Text(text = "Ver Cenários →", fontSize = 11.sp, color = AetherCyan, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { onNavigateToScenarios() })
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                QuickActionChip("Diagnóstico K8s 504", { viewModel.processInput("Qual o procedimento para diagnóstico do erro 504 no cluster K8s?") }, Modifier.weight(1f))
                QuickActionChip("Anotar na Memória", { viewModel.processInput("Anotar na memória: revisar o pipeline de áudio M100 antes da release") }, Modifier.weight(1f))
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                QuickActionChip("Checklist de Deploy", { viewModel.processInput("Passar o checklist de deploy em produção") }, Modifier.weight(1f))
                QuickActionChip("KSP vs KAPT", { viewModel.processInput("Comparar KSP versus KAPT na arquitetura do aplicativo") }, Modifier.weight(1f))
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun QuickActionChip(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF0F172A))
            .border(1.dp, SpaceSurfaceBorder, RoundedCornerShape(8.dp))
            .clickable { onClick() }
            .padding(vertical = 8.dp, horizontal = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text = label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFCBD5E1), maxLines = 1)
    }
}
