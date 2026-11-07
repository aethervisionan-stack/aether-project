package com.example.data.repository

import android.util.Log
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
        try {
            if (dao.noteCount() > 0) return
            Log.i(TAG, "Seeding initial Visão do Éter memory notes")
            dao.insertNotes(
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
        } catch (e: Exception) {
            Log.e(TAG, "Failed to seed Room database: ${e.localizedMessage}", e)
        }
    }

    suspend fun getRecentNotesOnce(limit: Int): List<MemoryNote> = try {
        dao.getRecentNotes(limit)
    } catch (e: Exception) {
        Log.e(TAG, "getRecentNotesOnce failed: ${e.localizedMessage}", e)
        emptyList()
    }

    suspend fun saveNote(note: MemoryNote) {
        try {
            dao.insertNote(note)
            Log.i(TAG, "Saved note id-bound title='${note.title}' category=${note.category}")
        } catch (e: Exception) {
            Log.e(TAG, "saveNote failed: ${e.localizedMessage}", e)
            throw e
        }
    }

    suspend fun deleteNote(note: MemoryNote) {
        try {
            dao.deleteNote(note)
        } catch (e: Exception) {
            Log.e(TAG, "deleteNote failed: ${e.localizedMessage}", e)
            throw e
        }
    }

    suspend fun logInteraction(log: InteractionLog) {
        try {
            dao.insertLog(log)
            Log.d(
                TAG,
                "Logged interaction total=${log.totalLatencyMs}ms grounding=${log.groundingScore} tool=${log.toolInvoked}"
            )
        } catch (e: Exception) {
            Log.e(TAG, "logInteraction failed: ${e.localizedMessage}", e)
        }
    }

    suspend fun clearLogs() {
        try {
            dao.clearLogs()
            Log.i(TAG, "Cleared interaction logs")
        } catch (e: Exception) {
            Log.e(TAG, "clearLogs failed: ${e.localizedMessage}", e)
            throw e
        }
    }

    companion object {
        private const val TAG = "AetherRepository"
    }
}
