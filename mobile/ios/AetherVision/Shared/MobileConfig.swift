import Foundation

enum MobileConfig {
    static var picovoiceAccessKey: String {
        string("PICOVOICE_ACCESS_KEY")
    }

    static var picovoiceSensitivity: Double {
        Double(string("PICOVOICE_SENSITIVITY", fallback: "0.65")) ?? 0.65
    }

    static var liveWsUrl: String {
        string("AETHER_LIVE_WS_URL", fallback: "ws://127.0.0.1:8000/ws/live")
    }

    static var pushRegisterUrl: String {
        string("AETHER_PUSH_REGISTER_URL", fallback: "http://127.0.0.1:8000/push/register")
    }

    static var visionIntervalMs: Int {
        Int(string("VISION_SIDEBAND_INTERVAL_MS", fallback: "2500")) ?? 2500
    }

    static var gpsMinDistanceM: CLLocationDistanceProxy {
        Double(string("GPS_MIN_DISTANCE_M", fallback: "3")) ?? 3
    }

    private static func string(_ key: String, fallback: String = "") -> String {
        if let v = Bundle.main.object(forInfoDictionaryKey: key) as? String, !v.isEmpty, !v.hasPrefix("$(") {
            return v
        }
        return ProcessInfo.processInfo.environment[key] ?? fallback
    }
}

typealias CLLocationDistanceProxy = Double
