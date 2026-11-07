package com.example.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface MemoryNoteDao {
    @Query("SELECT * FROM memory_notes ORDER BY createdAtEpochMs DESC")
    fun observeAll(): Flow<List<MemoryNote>>

    @Query("SELECT * FROM memory_notes ORDER BY createdAtEpochMs DESC LIMIT :limit")
    suspend fun getRecent(limit: Int): List<MemoryNote>

    @Query("SELECT COUNT(*) FROM memory_notes")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(note: MemoryNote): Long

    @Delete
    suspend fun delete(note: MemoryNote)
}
