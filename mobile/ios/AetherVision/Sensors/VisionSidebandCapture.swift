import AVFoundation
import Foundation
import UIKit

struct VisionFrame {
    let mime: String
    let b64: String
    let ts: TimeInterval
    let facing: String
}

/// Periodic still frames for vision sideband (scaffold — JPEG via AVCapturePhoto).
final class VisionSidebandCapture: NSObject {
    var onFrame: ((VisionFrame) -> Void)?

    private let session = AVCaptureSession()
    private let output = AVCapturePhotoOutput()
    private var timer: Timer?
    private let queue = DispatchQueue(label: "aether.vision.sideband")

    func requestAccess() {
        AVCaptureDevice.requestAccess(for: .video) { _ in }
    }

    func start(intervalMs: Int) {
        queue.async { [weak self] in
            self?.configureSession()
            self?.session.startRunning()
        }
        let interval = max(0.5, Double(intervalMs) / 1000.0)
        DispatchQueue.main.async {
            self.timer?.invalidate()
            self.timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
                self?.captureOnce()
            }
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        queue.async { [weak self] in
            self?.session.stopRunning()
        }
    }

    private func configureSession() {
        session.beginConfiguration()
        session.sessionPreset = .vga640x480
        guard
            let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
            let input = try? AVCaptureDeviceInput(device: device),
            session.canAddInput(input),
            session.canAddOutput(output)
        else {
            SidebandBus.log("Vision camera configure failed")
            session.commitConfiguration()
            return
        }
        if session.inputs.isEmpty {
            session.addInput(input)
        }
        if session.outputs.isEmpty {
            session.addOutput(output)
        }
        session.commitConfiguration()
    }

    private func captureOnce() {
        let settings = AVCapturePhotoSettings()
        output.capturePhoto(with: settings, delegate: self)
    }
}

extension VisionSidebandCapture: AVCapturePhotoCaptureDelegate {
    func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        if let error {
            SidebandBus.log("vision frame error: \(error.localizedDescription)")
            return
        }
        guard let data = photo.fileDataRepresentation() else { return }
        let b64 = data.base64EncodedString()
        onFrame?(
            VisionFrame(
                mime: "image/jpeg",
                b64: b64,
                ts: Date().timeIntervalSince1970 * 1000,
                facing: "back"
            )
        )
    }
}
