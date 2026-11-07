package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.local.MemoryNote
import com.example.ui.AetherViewModel
import com.example.ui.theme.AetherCyan
import com.example.ui.theme.AetherEmerald
import com.example.ui.theme.SpaceCardBg
import com.example.ui.theme.SpaceSurfaceBorder

@Composable
fun MemoryNotesScreen(
    viewModel: AetherViewModel,
    modifier: Modifier = Modifier
) {
    val notes by viewModel.allNotes.collectAsStateWithLifecycle()
    var showComposer by remember { mutableStateOf(false) }
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("general") }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Storage, contentDescription = null, tint = AetherCyan)
                Text(
                    text = "Memória Local (SQLite)",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFF1F5F9)
                )
            }
            IconButton(onClick = { showComposer = !showComposer }) {
                Icon(Icons.Default.Add, contentDescription = "Nova nota", tint = AetherCyan)
            }
        }

        if (showComposer) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(SpaceCardBg)
                    .border(1.dp, SpaceSurfaceBorder, RoundedCornerShape(12.dp))
                    .padding(12.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Título") },
                        singleLine = true,
                        colors = fieldColors()
                    )
                    OutlinedTextField(
                        value = content,
                        onValueChange = { content = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Conteúdo da anotação") },
                        minLines = 3,
                        colors = fieldColors()
                    )
                    OutlinedTextField(
                        value = category,
                        onValueChange = { category = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Categoria (diagnostics/architecture/ops)") },
                        singleLine = true,
                        colors = fieldColors()
                    )
                    TextButton(
                        onClick = {
                            if (title.isNotBlank() && content.isNotBlank()) {
                                viewModel.saveManualNote(title.trim(), content.trim(), category.trim().ifBlank { "general" }, category.trim())
                                title = ""
                                content = ""
                                category = "general"
                                showComposer = false
                            }
                        }
                    ) {
                        Text("Salvar na aether_vision.db", color = AetherCyan, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            if (notes.isEmpty()) {
                item {
                    Text(
                        text = "Nenhuma nota na memória. Use um comando de voz 'anotar…' ou adicione manualmente.",
                        color = Color(0xFF64748B),
                        fontSize = 13.sp
                    )
                }
            }
            items(notes, key = { it.id }) { note ->
                MemoryNoteCard(note = note, onDelete = { viewModel.deleteNote(note) })
            }
        }
    }
}

@Composable
private fun MemoryNoteCard(note: MemoryNote, onDelete: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SpaceCardBg)
            .border(1.dp, SpaceSurfaceBorder, RoundedCornerShape(12.dp))
            .padding(12.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = note.title,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFF1F5F9),
                    fontSize = 14.sp,
                    modifier = Modifier.weight(1f)
                )
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Excluir", tint = Color(0xFF94A3B8))
                }
            }
            Text(text = note.content, fontSize = 13.sp, color = Color(0xFFCBD5E1), lineHeight = 18.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(AetherEmerald.copy(alpha = 0.15f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(text = note.category, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = AetherEmerald)
                }
                if (note.tags.isNotBlank()) {
                    Text(text = note.tags, fontSize = 10.sp, color = Color(0xFF64748B))
                }
            }
        }
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = AetherCyan,
    unfocusedBorderColor = SpaceSurfaceBorder,
    focusedTextColor = Color.White,
    unfocusedTextColor = Color(0xFFE2E8F0)
)
