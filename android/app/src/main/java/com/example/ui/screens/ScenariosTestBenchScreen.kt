package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Science
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.AetherViewModel
import com.example.ui.theme.AetherCyan
import com.example.ui.theme.AetherViolet
import com.example.ui.theme.SpaceCardBg
import com.example.ui.theme.SpaceSurfaceBorder

private data class ScenarioCase(
    val title: String,
    val description: String,
    val prompt: String,
    val tag: String
)

private val SCENARIOS = listOf(
    ScenarioCase(
        title = "Diagnóstico 504 K8s",
        description = "Pipeline cognitivo + Consenso Alfa sobre timeout de gateway.",
        prompt = "Qual o procedimento para diagnóstico do erro 504 no cluster K8s?",
        tag = "diagnostics"
    ),
    ScenarioCase(
        title = "Anotar na Memória",
        description = "Dispara gated tool memory_write_note com auto-approve configurável.",
        prompt = "Anotar na memória: revisar o pipeline de áudio M100 antes da release",
        tag = "gated-tool"
    ),
    ScenarioCase(
        title = "Checklist de Deploy",
        description = "Resposta operacional curta para escuta TTS.",
        prompt = "Passar o checklist de deploy em produção",
        tag = "ops"
    ),
    ScenarioCase(
        title = "KSP vs KAPT",
        description = "Comparativo de arquitetura Android para o copiloto.",
        prompt = "Comparar KSP versus KAPT na arquitetura do aplicativo",
        tag = "architecture"
    ),
    ScenarioCase(
        title = "Status Headset M100",
        description = "Consulta do canal SCO Bluetooth e latência de áudio.",
        prompt = "Qual o status do headset M100 e do canal de áudio Bluetooth?",
        tag = "audio"
    ),
    ScenarioCase(
        title = "Consultar Memória",
        description = "Gated tool de leitura / síntese das notas SQLite.",
        prompt = "Consultar memória local e listar anotações recentes",
        tag = "memory-read"
    )
)

@Composable
fun ScenariosTestBenchScreen(
    @Suppress("UNUSED_PARAMETER") viewModel: AetherViewModel,
    onExecuteScenario: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(Icons.Default.Science, contentDescription = null, tint = AetherViolet)
            Text(
                text = "Bancada de Cenários",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFF1F5F9)
            )
        }
        Text(
            text = "Dispare prompts de regressão do Visão do Éter. A execução retorna ao HUD M100 e percorre STT→Agente→Consenso→TTS.",
            fontSize = 12.sp,
            color = Color(0xFF94A3B8)
        )

        SCENARIOS.forEach { scenario ->
            ScenarioCard(scenario = scenario, onRun = { onExecuteScenario(scenario.prompt) })
        }
    }
}

@Composable
private fun ScenarioCard(scenario: ScenarioCase, onRun: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SpaceCardBg)
            .border(1.dp, SpaceSurfaceBorder, RoundedCornerShape(12.dp))
            .clickable(onClick = onRun)
            .padding(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(text = scenario.title, fontWeight = FontWeight.Bold, color = Color(0xFFF1F5F9), fontSize = 14.sp)
                Text(text = scenario.description, fontSize = 12.sp, color = Color(0xFF94A3B8), lineHeight = 16.sp)
                Text(text = scenario.tag.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = AetherCyan)
            }
            Icon(Icons.Default.PlayArrow, contentDescription = "Executar", tint = AetherCyan)
        }
    }
}
