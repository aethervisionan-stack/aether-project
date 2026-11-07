package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.local.InteractionLog
import com.example.ui.AetherViewModel
import com.example.ui.components.ConsensusAlfaCard
import com.example.ui.theme.AetherCyan
import com.example.ui.theme.AetherEmerald
import com.example.ui.theme.SpaceCardBg
import com.example.ui.theme.SpaceSurfaceBorder

@Composable
fun ConsensusAuditScreen(
    viewModel: AetherViewModel,
    modifier: Modifier = Modifier
) {
    val consensus by viewModel.consensusResult.collectAsStateWithLifecycle()
    val logs by viewModel.recentLogs.collectAsStateWithLifecycle()

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Shield, contentDescription = null, tint = AetherEmerald)
                Text(
                    text = "Auditoria Consenso Alfa",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFF1F5F9)
                )
            }
            IconButton(onClick = { viewModel.clearHistory() }) {
                Icon(Icons.Default.DeleteSweep, contentDescription = "Limpar histórico", tint = Color(0xFF94A3B8))
            }
        }

        ConsensusAlfaCard(consensus = consensus)

        Text(
            text = "TRILHA DE INTERAÇÕES VALIDADAS",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF94A3B8),
            letterSpacing = 1.1.sp
        )

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            if (logs.isEmpty()) {
                item {
                    Text(
                        text = "Nenhuma interação auditada ainda. Use o HUD M100 para disparar o pipeline.",
                        color = Color(0xFF64748B),
                        fontSize = 13.sp
                    )
                }
            }
            items(logs, key = { it.id }) { log ->
                InteractionAuditCard(log)
            }
        }
    }
}

@Composable
private fun InteractionAuditCard(log: InteractionLog) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SpaceCardBg)
            .border(1.dp, SpaceSurfaceBorder, RoundedCornerShape(12.dp))
            .padding(12.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = "Operador: ${log.userInputText}",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFFF1F5F9)
            )
            Text(
                text = "Copiloto: ${log.copilotResponseText}",
                fontSize = 12.sp,
                color = Color(0xFFCBD5E1),
                lineHeight = 18.sp
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                MetricChip("Gnd ${log.groundingScore}%", AetherEmerald)
                MetricChip(log.safetyStatus, if (log.safetyStatus == "PASSED") AetherEmerald else Color(0xFFEF4444))
                MetricChip("Cst ${log.consistencyScore}%", AetherCyan)
                MetricChip("${log.totalLatencyMs}ms", Color(0xFF94A3B8))
            }
            if (!log.toolInvoked.isNullOrBlank()) {
                Text(
                    text = "Gated tool: ${log.toolInvoked}",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = AetherCyan
                )
            }
        }
    }
}

@Composable
private fun MetricChip(label: String, color: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(text = label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = color)
    }
}
