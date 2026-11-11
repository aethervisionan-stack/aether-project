import AVFoundation
import Foundation

/// Orchestrates BG audio, wake word, continuous VAD, GPS, and vision sideband.
final class HandsFreeSession {
    static let shared = HandsFreeSession()

    private let audioSession = BackgroundAudioSession()
    private let wake = WakeWordEngine()
    private let vad = ContinuousVad()
    private let location = ContinuousLocationManager()
    private let vision = VisionSidebandCapture()
    private var armedForVad = false

    private init() {
        wake.onWake = { [weak self] in
            self?.armedForVad = true
            self?.vad.setEnabled(true)
            SidebandBus.log("wake armed VAD")
        }
        vad.onSpeechStart = {
            SidebandBus.emitVoiceSessionStart(MobileConfig.liveWsUrl)
        }
        vad.onSpeechEnd = {
            SidebandBus.emitVoiceSessionEnd()
        }
        location.onFix = { fix in
            SidebandBus.emitGeo(fix)
        }
        vision.onFrame = { frame in
            SidebandBus.emitVisionFrame(frame)
        }
    }

    func requestPermissionsAndStart() {
        audioSession.activate()
        location.requestAlways()
        vision.requestAccess()
        wake.start()
        if MobileConfig.picovoiceAccessKey.isEmpty {
            armedForVad = true
            vad.setEnabled(true)
        }
        audioSession.startCapture { [weak self] pcm in
            guard let self else { return }
            self.wake.processPcm(pcm)
            if self.armedForVad {
                _ = self.vad.pushPcm16(pcm)
            }
        }
        location.start()
        vision.start(intervalMs: MobileConfig.visionIntervalMs)
    }

    func stop() {
        audioSession.stopCapture()
        wake.stop()
        vad.setEnabled(false)
        location.stop()
        vision.stop()
        armedForVad = false
    }
}
