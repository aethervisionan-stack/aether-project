package com.example.data.model

data class LatencyMetrics(
    val sttMs: Long = 0L,
    val agentCognitiveMs: Long = 0L,
    val consensusMs: Long = 0L,
    val ttsMs: Long = 0L
) {
    val totalMs: Long
        get() = sttMs + agentCognitiveMs + consensusMs + ttsMs

    val isSlaMet: Boolean
        get() = totalMs in 1..1199
}
