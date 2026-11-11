import Foundation

/// iOS stub for backend/app/os_bridge/contracts.py AccessibilityBridge.
/// Real AX / Notification Service Extension hooks land here later —
/// keep payloads JSON-serializable and aligned with Android osbridge/.
protocol AccessibilityBridge {
    func pollNotifications(sinceId: String?) -> [[String: Any]]
    func dismissNotification(id: String) -> [String: Any]
    func platform() -> String
}

final class AccessibilityBridgeStub: AccessibilityBridge {
    private var events: [[String: Any]] = []

    func enqueueMock(title: String, body: String, package: String = "ios") {
        let event: [String: Any] = [
            "id": UUID().uuidString,
            "package": package,
            "title": title,
            "body": body,
            "screen_lit": false,
            "created_at": Date().timeIntervalSince1970,
        ]
        events.append(event)
    }

    func pollNotifications(sinceId: String?) -> [[String: Any]] {
        if let sinceId {
            if let idx = events.firstIndex(where: { ($0["id"] as? String) == sinceId }) {
                return Array(events.suffix(from: idx + 1))
            }
        }
        return events
    }

    func dismissNotification(id: String) -> [String: Any] {
        events.removeAll { ($0["id"] as? String) == id }
        return ["ok": true, "action": "dismiss", "mock": true]
    }

    func platform() -> String { "ios-stub" }
}
