package com.example

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.AetherViewModel
import com.example.ui.components.GatedToolConfirmationDialog
import com.example.ui.screens.ConsensusAuditScreen
import com.example.ui.screens.HudDashboardScreen
import com.example.ui.screens.MemoryNotesScreen
import com.example.ui.screens.ScenariosTestBenchScreen
import com.example.ui.screens.SettingsDialog
import com.example.ui.theme.AetherCyan
import com.example.ui.theme.AetherVisionTheme
import com.example.ui.theme.SpaceBackground

enum class AetherScreen(val title: String, val icon: ImageVector) {
    HUD("HUD M100", Icons.Default.GraphicEq),
    CONSENSO("Consenso Alfa", Icons.Default.VerifiedUser),
    MEMORIA("Memória", Icons.Default.Storage),
    CENARIOS("Cenários", Icons.Default.Science)
}

class MainActivity : ComponentActivity() {

    private val viewModel: AetherViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Configure App Check com o Intent de inicialização antes de qualquer operação Firebase
        com.example.util.configureAppCheck(this, intent)

        enableEdgeToEdge()

        setContent {
            AetherVisionTheme {
                AetherApp(viewModel = viewModel)
            }
        }
    }
}

@Composable
fun AetherApp(viewModel: AetherViewModel) {
    val context = LocalContext.current
    var currentScreen by remember { mutableStateOf(AetherScreen.HUD) }
    var showSettingsDialog by remember { mutableStateOf(false) }

    val pendingGatedEvent by viewModel.pendingGatedEvent.collectAsStateWithLifecycle()

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    LaunchedEffect(Unit) {
        val permissionsToRequest = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
        }
        if (permissionsToRequest.isNotEmpty()) {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    if (currentScreen != AetherScreen.HUD) {
        BackHandler { currentScreen = AetherScreen.HUD }
    }

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .background(SpaceBackground),
        containerColor = SpaceBackground,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            NavigationBar(
                containerColor = Color(0xFF09101C),
                tonalElevation = 8.dp,
                modifier = Modifier
                    .windowInsetsPadding(WindowInsets.navigationBars)
                    .testTag("main_navigation_bar")
            ) {
                AetherScreen.values().forEach { screen ->
                    val isSelected = currentScreen == screen
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { currentScreen = screen },
                        icon = {
                            Icon(
                                imageVector = screen.icon,
                                contentDescription = screen.title,
                                tint = if (isSelected) AetherCyan else Color(0xFF64748B)
                            )
                        },
                        label = {
                            Text(
                                text = screen.title,
                                fontSize = 10.sp,
                                color = if (isSelected) AetherCyan else Color(0xFF94A3B8)
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            indicatorColor = Color(0xFF0C2438),
                            selectedIconColor = AetherCyan,
                            unselectedIconColor = Color(0xFF64748B),
                            selectedTextColor = AetherCyan,
                            unselectedTextColor = Color(0xFF94A3B8)
                        )
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .windowInsetsPadding(WindowInsets.statusBars)
        ) {
            when (currentScreen) {
                AetherScreen.HUD -> {
                    HudDashboardScreen(
                        viewModel = viewModel,
                        onOpenSettings = { showSettingsDialog = true },
                        onNavigateToScenarios = { currentScreen = AetherScreen.CENARIOS }
                    )
                }
                AetherScreen.CONSENSO -> {
                    ConsensusAuditScreen(viewModel = viewModel)
                }
                AetherScreen.MEMORIA -> {
                    MemoryNotesScreen(viewModel = viewModel)
                }
                AetherScreen.CENARIOS -> {
                    ScenariosTestBenchScreen(
                        viewModel = viewModel,
                        onExecuteScenario = { prompt ->
                            currentScreen = AetherScreen.HUD
                            viewModel.processInput(prompt)
                        }
                    )
                }
            }

            pendingGatedEvent?.let { event ->
                GatedToolConfirmationDialog(
                    event = event,
                    onConfirm = { viewModel.confirmPendingGatedEvent() },
                    onDismiss = { viewModel.dismissPendingGatedEvent() }
                )
            }

            if (showSettingsDialog) {
                SettingsDialog(
                    viewModel = viewModel,
                    onDismiss = { showSettingsDialog = false }
                )
            }
        }
    }
}
