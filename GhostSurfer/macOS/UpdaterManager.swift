import AppKit
import Observation
import Sparkle

@MainActor
@Observable
final class UpdaterManager: NSObject, SPUUpdaterDelegate {
    static let consentKey = "automaticUpdatesConsentDate"

    @ObservationIgnored private let controller: SPUStandardUpdaterController
    @ObservationIgnored private let delegateProxy: UpdaterDelegateProxy
    var updateFailureMessage: String?
    private var foundUpdateVersion: String?

    override init() {
        let proxy = UpdaterDelegateProxy()
        delegateProxy = proxy
        controller = SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: proxy, userDriverDelegate: nil)
        super.init()
        proxy.manager = self

        if UserDefaults.standard.object(forKey: Self.consentKey) != nil {
            controller.startUpdater()
        }
    }

    var hasAnsweredConsent: Bool {
        UserDefaults.standard.object(forKey: Self.consentKey) != nil
    }

    var automaticUpdatesEnabled: Bool {
        UserDefaults.standard.bool(forKey: Self.consentKey)
    }

    func enableAutomaticUpdates() {
        UserDefaults.standard.set(true, forKey: Self.consentKey)
        UserDefaults.standard.set(Date(), forKey: "automaticUpdatesConsentDateValue")
        controller.updater.automaticallyChecksForUpdates = true
        controller.updater.automaticallyDownloadsUpdates = true
        controller.startUpdater()
    }

    func declineAutomaticUpdates() {
        UserDefaults.standard.set(false, forKey: Self.consentKey)
        UserDefaults.standard.set(Date(), forKey: "automaticUpdatesConsentDateValue")
    }

    func disableAutomaticUpdates() {
        UserDefaults.standard.set(false, forKey: Self.consentKey)
        controller.updater.automaticallyChecksForUpdates = false
        controller.updater.automaticallyDownloadsUpdates = false
    }

    func checkManually() {
        controller.startUpdater()
        controller.checkForUpdates(nil)
    }

    func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        foundUpdateVersion = item.displayVersionString
    }

    func updater(_ updater: SPUUpdater, didAbortWithError error: any Error) {
        guard let version = foundUpdateVersion else { return }
        foundUpdateVersion = nil
        updateFailureMessage = "Ghost Surfer found version \(version), but macOS could not finish installing it. You can download the installer and update manually."
    }
}

@MainActor
private final class UpdaterDelegateProxy: NSObject, SPUUpdaterDelegate {
    weak var manager: UpdaterManager?

    func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        manager?.updater(updater, didFindValidUpdate: item)
    }

    func updater(_ updater: SPUUpdater, didAbortWithError error: any Error) {
        manager?.updater(updater, didAbortWithError: error)
    }
}
