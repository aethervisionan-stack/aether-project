package com.example.data.repository

import com.example.data.local.AetherDao
import com.example.data.local.InteractionLog
import com.example.data.local.MemoryNote
import kotlinx.coroutines.flow.Flow

class AetherRepository(
    private val dao: AetherDao
) {
    val allNotes: Flow<List<MemoryNote>> = dao.observeNotes()
    val recentInteractionLogs: Flow<List<InteractionLog>> = dao.observeLogs(limit = 40)

    suspend fun seedInitialDataIfEmpty() {
        dao.seedIfEmpty(
            listOf(
                MemoryNote(
                    title = "Procedimento 504 K8s",
                    content = "Inspecionar Ingress proxy-read-timeout, logs do pod e latência do microserviço de STT.",
                    category = "diagnostics",
                    tags = "diagnostics,k8s",
                    sourcePrompt = "Seed inicial Visão do Éter"
                ),
                MemoryNote(
                    title = "Pipeline M100",
                    content = "Captura SCO 16kHz → STT → Gemini → Consenso Alfa → TTS Nova HD.",
                    category = "architecture",
                    tags = "architecture,audio",
                    sourcePrompt = "Seed inicial Visão do Éter"
                ),
                MemoryNote(
                    title = "Checklist de Deploy",
                    content = "Validar schemas Room, testes locais, segredos de API e bundle assinado.",
                    category = "ops",
                    tags = "ops,deploy",
                    sourcePrompt = "Seed inicial Visão do Éter"
                )
            )
        )
    }

    suspend fun getRecentNotesOnce(limit: Int): List<MemoryNote> = dao.getRecentNotes(limit)

    suspend fun saveNote(note: MemoryNote) {
        dao.insertNote(note)
    }

    suspend fun deleteNote(note: MemoryNote) {
        dao.deleteNote(note)
    }

    suspend fun logInteraction(log: InteractionLog) {
        dao.insertLog(log)
    }

    suspend fun clearLogs() {
        dao.clearLogs()
    }
}
