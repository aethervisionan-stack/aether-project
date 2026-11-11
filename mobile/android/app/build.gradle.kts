import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val googleServicesJson = file("google-services.json")
if (googleServicesJson.exists()) {
    apply(plugin = "com.google.gms.google-services")
}

val secretsFile = rootProject.file("secrets.properties")
val secrets = Properties().apply {
    if (secretsFile.exists()) {
        secretsFile.inputStream().use { load(it) }
    }
}

fun secret(name: String, default: String = ""): String =
    (secrets.getProperty(name) ?: default).replace("\"", "\\\"")

android {
    namespace = "com.aethervision.mobile"
    compileSdk = 35

    defaultConfig {
        // Product id for hands-free + FCM; OS Bridge Kotlin stays in com.aethervision.bridge
        applicationId = "com.aethervision.mobile"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-handsfree"

        buildConfigField("String", "PICOVOICE_ACCESS_KEY", "\"${secret("PICOVOICE_ACCESS_KEY")}\"")
        buildConfigField(
            "String",
            "AETHER_LIVE_WS_URL",
            "\"${secret("AETHER_LIVE_WS_URL", "ws://10.0.2.2:8000/ws/live")}\"",
        )
        buildConfigField(
            "String",
            "AETHER_OS_BRIDGE_BASE_URL",
            "\"${secret("AETHER_OS_BRIDGE_BASE_URL", "http://10.0.2.2:8000")}\"",
        )
        buildConfigField(
            "String",
            "AETHER_PUSH_REGISTER_URL",
            "\"${secret("AETHER_PUSH_REGISTER_URL", "http://10.0.2.2:8000/push/register")}\"",
        )
        // Aliases consumed by existing OS Bridge IPC client
        buildConfigField(
            "String",
            "BRIDGE_HTTP_BASE",
            "\"${secret("AETHER_OS_BRIDGE_BASE_URL", "http://10.0.2.2:8000")}\"",
        )
        buildConfigField(
            "String",
            "BRIDGE_WS_URL",
            "\"${secret("AETHER_LIVE_WS_URL", "ws://10.0.2.2:8000/ws/live")}\"",
        )
        buildConfigField("double", "PICOVOICE_SENSITIVITY", secret("PICOVOICE_SENSITIVITY", "0.65"))
        buildConfigField("long", "VISION_SIDEBAND_INTERVAL_MS", secret("VISION_SIDEBAND_INTERVAL_MS", "2500") + "L")
        buildConfigField("long", "GPS_MIN_INTERVAL_MS", secret("GPS_MIN_INTERVAL_MS", "2000") + "L")
        buildConfigField("float", "GPS_MIN_DISTANCE_M", secret("GPS_MIN_DISTANCE_M", "3") + "f")
        buildConfigField("boolean", "HAS_GOOGLE_SERVICES", googleServicesJson.exists().toString())
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-service:2.8.7")

    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("androidx.camera:camera-camera2:1.4.0")
    implementation("androidx.camera:camera-lifecycle:1.4.0")
    implementation("androidx.camera:camera-core:1.4.0")

    implementation("ai.picovoice:porcupine-android:3.0.2")

    implementation(platform("com.google.firebase:firebase-bom:33.5.1"))
    implementation("com.google.firebase:firebase-messaging-ktx")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
