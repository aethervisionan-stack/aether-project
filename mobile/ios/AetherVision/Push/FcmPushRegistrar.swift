import Foundation

#if canImport(FirebaseMessaging)
import FirebaseMessaging
#endif

final class FcmPushRegistrar: NSObject {
    static let shared = FcmPushRegistrar()

    func registerApnsToken(_ token: Data) {
        let hex = token.map { String(format: "%02.2hhx", $0) }.joined()
        SidebandBus.log("APNs token len=\(hex.count)")
        postToken(hex, platform: "ios-apns")
    }

    func registerFcmToken(_ token: String) {
        SidebandBus.log("FCM token len=\(token.count)")
        postToken(token, platform: "ios-fcm")
    }

    private func postToken(_ token: String, platform: String) {
        let urlString = MobileConfig.pushRegisterUrl
        guard let url = URL(string: urlString), !urlString.isEmpty else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = [
            "platform": platform,
            "token": token,
            "app": "com.aethervision.mobile",
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: req) { _, resp, err in
            if let err {
                SidebandBus.log("push register failed: \(err.localizedDescription)")
                return
            }
            let code = (resp as? HTTPURLResponse)?.statusCode ?? -1
            SidebandBus.log("push register → \(code)")
        }.resume()
    }
}

#if canImport(FirebaseMessaging)
extension FcmPushRegistrar: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken else { return }
        registerFcmToken(fcmToken)
    }
}
#endif
