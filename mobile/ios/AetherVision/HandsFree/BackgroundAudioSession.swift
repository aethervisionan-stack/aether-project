import AVFoundation
import Foundation

/// Keeps the app eligible for background audio while capturing PCM for wake + VAD.
final class BackgroundAudioSession {
    private var engine: AVAudioEngine?
    private var onFrame: (([Int16]) -> Void)?

    func activate() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.defaultToSpeaker, .allowBluetooth, .mixWithOthers]
            )
            try session.setActive(true, options: [])
        } catch {
            SidebandBus.log("AVAudioSession activate failed: \(error)")
        }
    }

    func startCapture(onFrame: @escaping ([Int16]) -> Void) {
        self.onFrame = onFrame
        let eng = AVAudioEngine()
        let input = eng.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            guard let self, let channel = buffer.floatChannelData?[0] else { return }
            let count = Int(buffer.frameLength)
            var pcm = [Int16](repeating: 0, count: count)
            for i in 0..<count {
                let s = max(-1, min(1, channel[i]))
                pcm[i] = Int16(s * Float(Int16.max))
            }
            self.onFrame?(pcm)
        }
        do {
            try eng.start()
            engine = eng
        } catch {
            SidebandBus.log("AVAudioEngine start failed: \(error)")
        }
    }

    func stopCapture() {
        engine?.inputNode.removeTap(onBus: 0)
        engine?.stop()
        engine = nil
        onFrame = nil
    }
}
