package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.GatedToolAction
import com.example.data.model.GatedToolEvent
import com.example.ui.theme.AetherCyan
import com.example.ui.theme.AetherEmerald
import com.example.ui.theme.SpaceSurfaceBorder

@Composable
fun GatedToolConfirmationDialog(
    event: GatedToolEvent,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF0F172A),
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = "Gated Tool",
                    tint = AetherCyan
                )
                Text(
                    text = "Gated Tool: ${event.toolName}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFF1F5F9)
                )
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Ação disparada estritamente por comando explícito do operador:",
                    fontSize = 13.sp,
                    color = Color(0xFF94A3B8)
                )

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF070B12))
                        .border(1.dp, SpaceSurfaceBorder, RoundedCornerShape(8.dp))
                        .padding(10.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = "Comando de Voz:",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = AetherCyan
                        )
                        Text(
                            text = "\"${event.triggerPhrase}\"",
                            fontSize = 13.sp,
                            fontFamily = FontFamily.Monospace,
                            color = Color(0xFFF1F5F9)
                        )

                        when (val action = event.action) {
                            is GatedToolAction.WriteNote -> {
                                Text(
                                    text = "Destino: aether_vision.db (SQLite local)",
                                    fontSize = 11.sp,
                                    color = AetherEmerald,
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                                Text(text = "Título: ${action.title}", fontSize = 12.sp, color = Color(0xFFCBD5E1))
                                Text(text = "Categoria: ${action.category}", fontSize = 12.sp, color = Color(0xFF94A3B8))
                            }
                            is GatedToolAction.ReadNotes -> {
                                Text(
                                    text = "Operação: Leitura e síntese de anotações",
                                    fontSize = 11.sp,
                                    color = AetherCyan
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = onConfirm,
                colors = ButtonDefaults.textButtonColors(contentColor = AetherCyan)
            ) {
                Text("Autorizar Persistência", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFF94A3B8))
            ) {
                Text("Cancelar")
            }
        }
    )
}
