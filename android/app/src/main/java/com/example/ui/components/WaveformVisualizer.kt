package com.example.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.unit.dp
import com.example.ui.theme.AetherCyan
import com.example.ui.theme.AetherEmerald
import com.example.ui.theme.AetherViolet
import kotlin.math.sin

@Composable
fun WaveformVisualizer(
    isListening: Boolean,
    isSpeaking: Boolean,
    amplitude: Float,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "wave_anim")
    val phase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 6.28318f,
        animationSpec = infiniteRepeatable(
            animation = tween(2400, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "phase"
    )

    val currentAmp = remember { Animatable(0.2f) }

    LaunchedEffect(amplitude, isListening, isSpeaking) {
        val target = when {
            isListening -> (0.35f + amplitude * 0.65f).coerceIn(0.2f, 1.0f)
            isSpeaking -> (0.4f + amplitude * 0.6f).coerceIn(0.25f, 1.0f)
            else -> 0.15f
        }
        currentAmp.animateTo(target, tween(80))
    }

    val glowColor = when {
        isListening -> AetherEmerald
        isSpeaking -> AetherCyan
        else -> AetherViolet
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(130.dp)
            .padding(horizontal = 8.dp)
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val width = size.width
            val height = size.height
            val midY = height / 2f
            val barsCount = 38
            val barSpacing = width / (barsCount + 1)
            val ampValue = currentAmp.value

            drawLine(
                color = Color(0x33233554),
                start = Offset(0f, midY),
                end = Offset(width, midY),
                strokeWidth = 1.5.dp.toPx()
            )

            for (i in 1..barsCount) {
                val x = i * barSpacing
                val normalizedX = (i.toFloat() / barsCount) * 3.14159f
                val envelope = sin(normalizedX)
                val waveOffset = sin(phase + (i * 0.35f))
                val barHeight = ((height * 0.42f) * ampValue * envelope * (0.6f + 0.4f * waveOffset)).coerceAtLeast(6f)

                val barColor = Brush.verticalGradient(
                    colors = listOf(
                        glowColor,
                        if (isListening) AetherEmerald else AetherViolet,
                        Color(0xFF0F172A)
                    ),
                    startY = midY - barHeight,
                    endY = midY + barHeight
                )

                drawLine(
                    brush = barColor,
                    start = Offset(x, midY - barHeight),
                    end = Offset(x, midY + barHeight),
                    strokeWidth = 4.dp.toPx(),
                    cap = StrokeCap.Round
                )

                drawLine(
                    color = glowColor.copy(alpha = 0.35f),
                    start = Offset(x, midY - barHeight * 1.25f),
                    end = Offset(x, midY + barHeight * 1.25f),
                    strokeWidth = 8.dp.toPx(),
                    cap = StrokeCap.Round
                )
            }
        }
    }
}
