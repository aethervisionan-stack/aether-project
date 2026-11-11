package com.aethervision.mobile.sensors

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.Lifecycle
import java.nio.ByteBuffer
import java.util.concurrent.Executors

data class VisionFrame(
    val mime: String,
    val b64: String,
    val ts: Long,
    val facing: String,
)

/**
 * Periodic still frames for the vision sideband (not a full preview UI).
 * Uses CameraX ImageCapture on a synthetic lifecycle owned by the FGS process.
 */
class VisionSidebandCapture(
    private val context: Context,
    private val intervalMs: Long,
    private val onFrame: (VisionFrame) -> Unit,
) {
    private val handler = Handler(Looper.getMainLooper())
    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private var imageCapture: ImageCapture? = null
    private var provider: ProcessCameraProvider? = null
    private val lifecycleOwner = object : LifecycleOwner {
        private val registry = LifecycleRegistry(this).apply {
            currentState = Lifecycle.State.CREATED
        }
        override val lifecycle: Lifecycle get() = registry
        fun start() {
            registry.currentState = Lifecycle.State.STARTED
            registry.currentState = Lifecycle.State.RESUMED
        }
        fun stop() {
            registry.currentState = Lifecycle.State.DESTROYED
        }
    }

    private val tick = object : Runnable {
        override fun run() {
            captureOnce()
            handler.postDelayed(this, intervalMs)
        }
    }

    fun start() {
        val future = ProcessCameraProvider.getInstance(context)
        future.addListener({
            try {
                provider = future.get()
                bindCamera()
                lifecycleOwner.start()
                handler.post(tick)
                Log.i(TAG, "Vision sideband every ${intervalMs}ms")
            } catch (t: Throwable) {
                Log.e(TAG, "CameraX bind failed (permissions / no camera?)", t)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    private fun bindCamera() {
        val p = provider ?: return
        p.unbindAll()
        imageCapture = ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .build()
        p.bindToLifecycle(
            lifecycleOwner,
            CameraSelector.DEFAULT_BACK_CAMERA,
            imageCapture,
        )
    }

    private fun captureOnce() {
        val capture = imageCapture ?: return
        capture.takePicture(cameraExecutor, object : ImageCapture.OnImageCapturedCallback() {
            override fun onCaptureSuccess(image: ImageProxy) {
                try {
                    val plane = image.planes.firstOrNull()?.buffer ?: return
                    val bytes = bufferToBytes(plane)
                    // Scaffold: send raw plane bytes tagged as octet-stream; swap to JPEG encoder next.
                    val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                    onFrame(
                        VisionFrame(
                            mime = "application/octet-stream",
                            b64 = b64,
                            ts = System.currentTimeMillis(),
                            facing = "back",
                        ),
                    )
                } finally {
                    image.close()
                }
            }

            override fun onError(exception: ImageCaptureException) {
                Log.w(TAG, "frame capture error: ${exception.message}")
            }
        })
    }

    fun stop() {
        handler.removeCallbacks(tick)
        try {
            provider?.unbindAll()
        } catch (_: Throwable) {
        }
        lifecycleOwner.stop()
        cameraExecutor.shutdownNow()
        imageCapture = null
        provider = null
    }

    private fun bufferToBytes(buf: ByteBuffer): ByteArray {
        val dup = buf.duplicate()
        val out = ByteArray(dup.remaining())
        dup.get(out)
        return out
    }

    companion object {
        private const val TAG = "VisionSideband"
    }
}
