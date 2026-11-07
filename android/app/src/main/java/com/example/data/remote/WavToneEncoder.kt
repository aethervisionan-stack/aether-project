package com.example.data.remote

import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.sin

/**
 * Builds a short mono PCM WAV so Retrofit can always attach
 * `MultipartBody.Part` field **audio** for FastAPI `UploadFile`.
 *
 * When Android already has an on-device transcript, the backend accepts
 * form field `query` and skips STT; the WAV still satisfies the required file part.
 */
object WavToneEncoder {

    fun encodeToneWav(
        durationMs: Int = 220,
        sampleRateHz: Int = 16_000,
        frequencyHz: Double = 440.0,
        amplitude: Int = 6_000
    ): ByteArray {
        val frameCount = (sampleRateHz * durationMs) / 1000
        val dataSize = frameCount * 2
        val buffer = ByteBuffer.allocate(44 + dataSize).order(ByteOrder.LITTLE_ENDIAN)

        // RIFF header
        buffer.put("RIFF".toByteArray(Charsets.US_ASCII))
        buffer.putInt(36 + dataSize)
        buffer.put("WAVE".toByteArray(Charsets.US_ASCII))
        buffer.put("fmt ".toByteArray(Charsets.US_ASCII))
        buffer.putInt(16) // PCM chunk size
        buffer.putShort(1) // audio format PCM
        buffer.putShort(1) // mono
        buffer.putInt(sampleRateHz)
        buffer.putInt(sampleRateHz * 2) // byte rate
        buffer.putShort(2) // block align
        buffer.putShort(16) // bits per sample
        buffer.put("data".toByteArray(Charsets.US_ASCII))
        buffer.putInt(dataSize)

        for (i in 0 until frameCount) {
            val sample = (amplitude * sin(2.0 * Math.PI * frequencyHz * i / sampleRateHz)).toInt()
                .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt())
            buffer.putShort(sample.toShort())
        }
        return buffer.array()
    }

    fun encodeSilenceWav(durationMs: Int = 220, sampleRateHz: Int = 16_000): ByteArray {
        // Still >256 bytes so mock STT (without query override) produces text if needed.
        return encodeToneWav(durationMs = durationMs, sampleRateHz = sampleRateHz, amplitude = 0)
            .let { tone ->
                // Replace PCM with near-silence while keeping header; ensure size floor.
                if (tone.size >= 512) tone else {
                    val out = ByteArrayOutputStream()
                    out.write(tone)
                    while (out.size() < 512) out.write(0)
                    out.toByteArray()
                }
            }
    }
}
