package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val AetherColorScheme = darkColorScheme(
    primary = AetherCyan,
    onPrimary = Color(0xFF041E26),
    primaryContainer = Color(0xFF063344),
    onPrimaryContainer = Color(0xFFB8F4FF),

    secondary = AetherViolet,
    onSecondary = Color(0xFF250E4C),
    secondaryContainer = Color(0xFF3B1D73),
    onSecondaryContainer = Color(0xFFE9DCFF),

    tertiary = AetherEmerald,
    onTertiary = Color(0xFF003822),
    tertiaryContainer = Color(0xFF005234),
    onTertiaryContainer = Color(0xFFA6F5D0),

    background = SpaceBackground,
    onBackground = TextPrimary,
    surface = SpaceSurface,
    onSurface = TextPrimary,
    surfaceVariant = SpaceSurfaceElevated,
    onSurfaceVariant = TextSecondary,
    outline = SpaceSurfaceBorder,
    error = AetherCoral,
    onError = Color(0xFF370001)
)

@Composable
fun AetherVisionTheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = AetherColorScheme,
        typography = Typography,
        content = content
    )
}
