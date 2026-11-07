package com.example.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

/**
 * Facade DAO used by [com.example.data.repository.AetherRepository].
 * Room exposes separate entity DAOs as well via [AetherDatabase].
 */
@Dao
interface AetherDao {
    @Query("SELECT * FROM memory_notes ORDER BY createdAtEpochMs DESC")
    fun observeNotes(): Flow<List<MemoryNote>>

    @Query("SELECT * FROM memory_notes ORDER BY createdAtEpochMs DESC LIMIT :limit")
    suspend fun getRecentNotes(limit: Int): List<MemoryNote>

    @Query("SELECT COUNT(*) FROM memory_notes")
    suspend fun noteCount(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNote(note: MemoryNote): Long

    @Delete
    suspend fun deleteNote(note: MemoryNote)

    @Query("SELECT * FROM interaction_logs ORDER BY createdAtEpochMs DESC LIMIT :limit")
    fun observeLogs(limit: Int = 50): Flow<List<InteractionLog>>

    @Query("SELECT COUNT(*) FROM interaction_logs")
    suspend fun logCount(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLog(log: InteractionLog): Long

    @Query("DELETE FROM interaction_logs")
    suspend fun clearLogs()

    @Transaction
    suspend fun seedIfEmpty(seedNotes: List<MemoryNote>) {
        if (noteCount() == 0) {
            seedNotes.forEach { insertNote(it) }
        }
    }
}
