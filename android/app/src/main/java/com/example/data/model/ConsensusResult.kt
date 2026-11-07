package com.example.data.model

data class ConsensusResult(
    val groundingScore: Int = 0,
    val toneScore: Int = 0,
    val consistencyScore: Int = 0,
    val safetyPassed: Boolean = true,
    val latencyMs: Long = 0L,
    val auditNotes: List<String> = emptyList(),
    val approved: Boolean = true
)
