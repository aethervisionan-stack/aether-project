package com.example.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface InteractionLogDao {
    @Query("SELECT * FROM interaction_logs ORDER BY createdAtEpochMs DESC LIMIT :limit")
    fun observeRecent(limit: Int = 50): Flow<List<InteractionLog>>

    @Query("SELECT COUNT(*) FROM interaction_logs")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(log: InteractionLog): Long

    @Query("DELETE FROM interaction_logs")
    suspend fun clearAll()
}
