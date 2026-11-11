import CoreLocation
import Foundation

struct GeoFix {
    let lat: Double
    let lon: Double
    let accuracyM: Double
    let speedMps: Double
    let ts: TimeInterval
}

final class ContinuousLocationManager: NSObject, CLLocationManagerDelegate {
    var onFix: ((GeoFix) -> Void)?
    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = MobileConfig.gpsMinDistanceM
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
    }

    func requestAlways() {
        manager.requestAlwaysAuthorization()
    }

    func start() {
        manager.startUpdatingLocation()
    }

    func stop() {
        manager.stopUpdatingLocation()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        onFix?(
            GeoFix(
                lat: loc.coordinate.latitude,
                lon: loc.coordinate.longitude,
                accuracyM: loc.horizontalAccuracy,
                speedMps: max(0, loc.speed),
                ts: loc.timestamp.timeIntervalSince1970 * 1000
            )
        )
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        SidebandBus.log("GPS error: \(error.localizedDescription)")
    }
}
