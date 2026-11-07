package com.example.data.local

import android.content.Context
import android.util.Log
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
        private const val TAG = "AetherDatabase"

        @Volatile
        private var instance: AetherDatabase? = null

        fun getInstance(context: Context): AetherDatabase {
            return instance ?: synchronized(this) {
                instance ?: try {
                    Room.databaseBuilder(
                        context.applicationContext,
                        AetherDatabase::class.java,
                        DATABASE_NAME
                    )
                        .fallbackToDestructiveMigration(dropAllTables = true)
                        .build()
                        .also {
                            instance = it
                            Log.i(TAG, "Opened $DATABASE_NAME")
                        }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to open $DATABASE_NAME: ${e.localizedMessage}", e)
                    throw e
                }
            }
        }
    }
}
