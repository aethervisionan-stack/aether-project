import SwiftUI
import UIKit

@main
struct AetherVisionApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onAppear {
                    HandsFreeSession.shared.requestPermissionsAndStart()
                }
        }
    }
}

struct ContentView: View {
    @State private var status = "Aether Vision — hands-free"

    var body: some View {
        VStack(spacing: 16) {
            Text(status)
                .font(.title2)
                .multilineTextAlignment(.center)
            Button("Start hands-free") {
                HandsFreeSession.shared.requestPermissionsAndStart()
                status = "Background audio + location session starting"
            }
            Button("Stop") {
                HandsFreeSession.shared.stop()
                status = "Stopped"
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.03, green: 0.08, blue: 0.11))
        .foregroundStyle(Color(red: 0.91, green: 0.96, blue: 0.97))
    }
}
