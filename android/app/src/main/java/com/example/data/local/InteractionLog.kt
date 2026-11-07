package com.example.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "interaction_logs")
data class InteractionLog(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val userInputText: String,
    val copilotResponseText: String,
    val audioDevice: String = "",
    val sttLatencyMs: Long = 0L,
    val llmLatencyMs: Long = 0L,
    val consensusLatencyMs: Long = 0L,
    val ttsLatencyMs: Long = 0L,
    val totalLatencyMs: Long = 0L,
    val groundingScore: Int = 0,
    val safetyStatus: String = "PASSED",
    val consistencyScore: Int = 0,
    val toolInvoked: String? = null,
    val createdAtEpochMs: Long = System.currentTimeMillis()
)
