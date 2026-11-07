package com.example.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "memory_notes")
data class MemoryNote(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val title: String,
    val content: String,
    val category: String = "general",
    val tags: String = "",
    val sourcePrompt: String = "",
    val createdAtEpochMs: Long = System.currentTimeMillis()
)
