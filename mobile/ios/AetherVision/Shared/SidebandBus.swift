import Foundation
import os.log

enum SidebandBus {
    private static let logHandle = Logger(subsystem: "com.aethervision.mobile", category: "sideband")

    static func log(_ message: String) {
        logHandle.info("\(message, privacy: .public)")
    }

    static func emitGeo(_ fix: GeoFix) {
        log("geo lat=\(fix.lat) lon=\(fix.lon) acc=\(fix.accuracyM) spd=\(fix.speedMps)")
    }

    static func emitVisionFrame(_ frame: VisionFrame) {
        log("vision_frame mime=\(frame.mime) b64_len=\(frame.b64.count) facing=\(frame.facing)")
    }

    static func emitVoiceSessionStart(_ wsUrl: String) {
        log("voice_session_start ws=\(wsUrl)")
    }

    static func emitVoiceSessionEnd() {
        log("voice_session_end")
    }
}
