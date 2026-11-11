import Foundation

#if canImport(Porcupine)
import Porcupine
#endif

/// Porcupine wake-word hook. Compiles without the SDK via stub mode.
final class WakeWordEngine {
    var onWake: (() -> Void)?

#if canImport(Porcupine)
    private var porcupine: Porcupine?
#endif

    private var stubMode = false

    func start() {
        let key = MobileConfig.picovoiceAccessKey
        guard !key.isEmpty else {
            SidebandBus.log("PICOVOICE_ACCESS_KEY empty — wake stub")
            stubMode = true
            return
        }
#if canImport(Porcupine)
        do {
            porcupine = try Porcupine(
                accessKey: key,
                keyword: .computer,
                sensitivity: Float(MobileConfig.picovoiceSensitivity)
            )
            SidebandBus.log("Porcupine ready")
        } catch {
            SidebandBus.log("Porcupine init failed: \(error)")
            stubMode = true
        }
#else
        SidebandBus.log("Porcupine SDK not linked — stub mode (key present)")
        stubMode = true
#endif
    }

    func processPcm(_ frame: [Int16]) {
#if canImport(Porcupine)
        guard let porcupine else { return }
        // Scaffold: real integration should chunk to porcupine.frameLength.
        // Detection callback fires onWake when keyword index >= 0.
        _ = frame
        _ = porcupine
#else
        _ = frame
#endif
    }

    func debugArm() {
        if stubMode { onWake?() }
    }

    func stop() {
#if canImport(Porcupine)
        porcupine = nil
#endif
        stubMode = false
    }
}
