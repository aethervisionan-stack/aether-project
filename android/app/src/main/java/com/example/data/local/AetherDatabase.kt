package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [MemoryNote::class, InteractionLog::class],
    version = 1,
    exportSchema = false
)
abstract class AetherDatabase : RoomDatabase() {

    abstract fun aetherDao(): AetherDao
    abstract fun memoryNoteDao(): MemoryNoteDao
    abstract fun interactionLogDao(): InteractionLogDao

    companion object {
        const val DATABASE_NAME = "aether_vision.db"

        @Volatile
        private var instance: AetherDatabase? = null

        fun getInstance(context: Context): AetherDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AetherDatabase::class.java,
                    DATABASE_NAME
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { instance = it }
            }
        }
    }
}
