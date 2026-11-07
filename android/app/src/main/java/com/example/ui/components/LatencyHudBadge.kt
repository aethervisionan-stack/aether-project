package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.LatencyMetrics
import com.example.ui.theme.AetherAmber
import com.example.ui.theme.AetherCyan
import com.example.ui.theme.AetherEmerald
import com.example.ui.theme.AetherViolet
import com.example.ui.theme.SpaceCardBg
import com.example.ui.theme.SpaceSurfaceBorder

@Composable
fun LatencyHudBadge(
    metrics: LatencyMetrics,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SpaceCardBg)
            .border(1.dp, SpaceSurfaceBorder, RoundedCornerShape(12.dp))
            .padding(12.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Bolt,
                        contentDescription = "Latência",
                        tint = AetherCyan,
                        modifier = Modifier.padding(end = 2.dp)
                    )
                    Text(
                        text = "LATÊNCIA DO PIPELINE",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF94A3B8),
                        letterSpacing = 1.2.sp
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "${metrics.totalMs}ms",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace,
                        color = if (metrics.isSlaMet) AetherEmerald else AetherAmber
                    )
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(if (metrics.isSlaMet) Color(0x3310B981) else Color(0x33F59E0B))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = if (metrics.isSlaMet) "SLA OK (<1.2s)" else "ELEVADA",
                            style = MaterialTheme.typography.labelSmall,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (metrics.isSlaMet) AetherEmerald else AetherAmber
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                LatencyStageItem("1. STT", "Whisper", "${metrics.sttMs}ms", AetherCyan, Modifier.weight(1f))
                LatencyStageItem("2. AGENTE", "Gemini", "${metrics.agentCognitiveMs}ms", AetherViolet, Modifier.weight(1f))
                LatencyStageItem("3. ALFA", "Consenso", "${metrics.consensusMs}ms", AetherEmerald, Modifier.weight(1f))
                LatencyStageItem("4. TTS", "Nova HD", "${metrics.ttsMs}ms", Color(0xFF38BDF8), Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun LatencyStageItem(
    title: String,
    subtitle: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF09111F))
            .border(0.8.dp, color.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
            .padding(vertical = 6.dp, horizontal = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = title, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = color)
            Text(text = subtitle, fontSize = 9.sp, color = Color(0xFF64748B))
            Text(text = value, fontSize = 12.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, color = Color(0xFFF1F5F9), modifier = Modifier.padding(top = 2.dp))
        }
    }
}
