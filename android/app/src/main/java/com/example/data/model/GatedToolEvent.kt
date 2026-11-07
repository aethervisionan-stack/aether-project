package com.example.data.model

sealed class GatedToolAction {
    data class WriteNote(
        val title: String,
        val content: String,
        val category: String,
        val tags: String,
        val sourcePrompt: String
    ) : GatedToolAction()

    data class ReadNotes(
        val categoryFilter: String? = null,
        val query: String? = null
    ) : GatedToolAction()
}

data class GatedToolEvent(
    val toolName: String,
    val action: GatedToolAction,
    val triggerPhrase: String
)
