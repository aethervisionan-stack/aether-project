import Foundation

/// Energy VAD aligned with client/src/voice/VadController.ts.
final class ContinuousVad {
    enum Phase { case silence, speech, hangover }

    var onSpeechStart: (() -> Void)?
    var onSpeechEnd: (() -> Void)?

    private let startThreshold: Float
    private let endThreshold: Float
    private let hangoverMs: Double
    private var phase: Phase = .silence
    private var quietSince: TimeInterval = 0
    private var enabled = false

    init(
        startThreshold: Float = 0.025,
        endThreshold: Float = 0.015,
        hangoverMs: Double = 420
    ) {
        self.startThreshold = startThreshold
        self.endThreshold = endThreshold
        self.hangoverMs = hangoverMs
    }

    func setEnabled(_ value: Bool) {
        enabled = value
        if !value {
            phase = .silence
            quietSince = 0
        }
    }

    @discardableResult
    func pushPcm16(_ pcm: [Int16], now: TimeInterval = Date().timeIntervalSince1970 * 1000) -> Bool {
        guard enabled else { return false }
        let level = rms(pcm)
        switch phase {
        case .silence:
            if level >= startThreshold {
                phase = .speech
                quietSince = 0
                onSpeechStart?()
            }
        case .speech:
            if level < endThreshold {
                phase = .hangover
                quietSince = now
            }
        case .hangover:
            if level >= startThreshold {
                phase = .speech
                quietSince = 0
            } else if now - quietSince >= hangoverMs {
                phase = .silence
                onSpeechEnd?()
                return false
            }
        }
        return phase != .silence
    }

    private func rms(_ pcm: [Int16]) -> Float {
        guard !pcm.isEmpty else { return 0 }
        var sum: Double = 0
        for s in pcm {
            let n = Double(s) / 32768.0
            sum += n * n
        }
        return Float(sqrt(sum / Double(pcm.count)))
    }
}
