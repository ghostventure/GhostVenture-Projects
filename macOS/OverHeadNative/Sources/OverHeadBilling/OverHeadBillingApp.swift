import AppKit
import SwiftUI
import Observation
import Darwin
import CryptoKit
import Security

@main
struct OverHeadBillingApp: App {
    @NSApplicationDelegateAdaptor(BillingAppDelegate.self) private var delegate
    @State private var model = BillingModel()

    var body: some Scene {
        WindowGroup("OverHead Billing & Licensing") {
            BillingHomeView()
                .environment(model)
                .frame(minWidth: 720, minHeight: 500)
                .preferredColorScheme(.dark)
                .task { model.startRefreshLoop() }
        }
        .defaultSize(width: 860, height: 580)
        .commands { CommandGroup(replacing: .newItem) {} }
    }
}

@MainActor
final class BillingAppDelegate: NSObject, NSApplicationDelegate {
    private var lockFD: Int32 = -1

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        guard NSRunningApplication.runningApplications(withBundleIdentifier: "com.blacklion.overhead").contains(where: { !$0.isTerminated }), acquireLock() else {
            NSApp.terminate(nil)
            return
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        if lockFD >= 0 { Darwin.close(lockFD); lockFD = -1 }
    }

    private func acquireLock() -> Bool {
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Black Lion Media Studio/OverHead", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
            let fd = Darwin.open(root.appendingPathComponent("billing-module.lock").path, O_CREAT | O_RDWR, mode_t(S_IRUSR | S_IWUSR))
            guard fd >= 0 else { return false }
            var lock = flock(l_start: 0, l_len: 0, l_pid: 0, l_type: Int16(F_WRLCK), l_whence: Int16(SEEK_SET))
            guard Darwin.fcntl(fd, F_SETLK, &lock) == 0 else { Darwin.close(fd); return false }
            lockFD = fd
            return true
        } catch { return false }
    }
}

struct BillingEntry: Codable, Identifiable {
    var id = UUID()
    var date = Date()
    var customer = ""
    var category = "Transaction"
    var tier = "silver"
    var billingType = "Monthly subscription"
    var amount = ""
    var status = "Recorded"
    var licenseKey = ""

    private enum CodingKeys: String, CodingKey { case id, date, customer, category, tier, billingType, amount, status, licenseKey }

    init(id: UUID = UUID(), date: Date = .now, customer: String = "", category: String = "Transaction", tier: String = "silver", billingType: String = "Monthly subscription", amount: String = "", status: String = "Recorded", licenseKey: String = "") {
        self.id = id; self.date = date; self.customer = customer; self.category = category
        self.tier = tier; self.billingType = billingType; self.amount = amount
        self.status = status; self.licenseKey = licenseKey
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        date = try values.decodeIfPresent(Date.self, forKey: .date) ?? .now
        customer = try values.decodeIfPresent(String.self, forKey: .customer) ?? ""
        category = try values.decodeIfPresent(String.self, forKey: .category) ?? "Transaction"
        tier = try values.decodeIfPresent(String.self, forKey: .tier) ?? "silver"
        billingType = try values.decodeIfPresent(String.self, forKey: .billingType) ?? "Monthly subscription"
        amount = try values.decodeIfPresent(String.self, forKey: .amount) ?? ""
        status = try values.decodeIfPresent(String.self, forKey: .status) ?? "Recorded"
        licenseKey = try values.decodeIfPresent(String.self, forKey: .licenseKey) ?? ""
    }
}

struct BillingArchive: Codable {
    var tiers = ["silver", "gold", "black"]
    var entries: [BillingEntry] = []
    var subscriber = BillingSubscriber()
    var refreshedAt = Date()

    private enum CodingKeys: String, CodingKey { case tiers, entries, subscriber, refreshedAt }

    init(tiers: [String] = ["silver", "gold", "black"], entries: [BillingEntry] = [], subscriber: BillingSubscriber = BillingSubscriber(), refreshedAt: Date = .now) {
        self.tiers = tiers; self.entries = entries; self.subscriber = subscriber; self.refreshedAt = refreshedAt
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        _ = try values.decodeIfPresent([String].self, forKey: .tiers)
        tiers = ["silver", "gold", "black"]
        entries = try values.decodeIfPresent([BillingEntry].self, forKey: .entries) ?? []
        subscriber = try values.decodeIfPresent(BillingSubscriber.self, forKey: .subscriber) ?? BillingSubscriber()
        refreshedAt = try values.decodeIfPresent(Date.self, forKey: .refreshedAt) ?? .now
    }
}

struct BillingSubscriber: Codable, Equatable {
    var name = ""
    var email = ""
    var phone = ""
    var businessName = ""
    var dba = ""
    var addressLine1 = ""
    var addressLine2 = ""
    var city = ""
    var region = ""
    var postalCode = ""
    var country = ""
}

struct BillingEntitlementSnapshot: Decodable {
    var metadataVersion: Int?
    var product: String?
    var tier = "silver"
    var status = "Not checked"
    var billingType = "Monthly subscription"
    var customerID = ""
    var subscriptionID = ""
    var trialEndsAt = ""
    var checkedAt = ""
    var subscriber: BillingSubscriber?
    var plan: BillingPlanMetadata?
    var metadata: BillingMetadataDocument?
}

struct BillingMetadataDocument: Decodable {
    var schemaVersion: Int
    var product: String
    var checkedAt: String
    var plan: BillingPlanMetadata
}

struct BillingPlanMetadata: Decodable {
    var tier = "silver"
    var amountCents = 5900
    var currency = "USD"
    var interval = "month"
    var description = ""
    var inclusions: [String] = []
    var limits: [String: Int] = [:]
    var features: [String: Bool] = [:]

    var formattedPrice: String {
        let amount = Double(amountCents) / 100
        let price = amount.rounded(.towardZero) == amount
            ? String(format: "$%.0f", amount)
            : String(format: "$%.2f", amount)
        return "\(price) / \(interval)"
    }
}

@MainActor @Observable
final class BillingModel {
    var archive = BillingArchive()
    var customer = ""
    var amount = ""
    var selectedTier = "silver"
    var licenseKey = ""
    var lastRefresh = Date()
    var entitlement = BillingEntitlementSnapshot()
    var formMessage = ""
    var storageMessage = ""
    var integrityFailure = false
    private let envelopePrefix = Data("OHBILL1".utf8)
    private let keychainService = "com.blacklion.overhead.billing"
    private let keychainAccount = "archive-encryption-key-v1"
    private let entitlementPrefix = Data("OHENT1".utf8)
    private var hasLoadedRemoteSnapshot = false
    private let fileURL: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Black Lion Media Studio/OverHead", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("billing-records.enc")
    }()
    private let entitlementURL: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Black Lion Media Studio/OverHead", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("billing-entitlement.enc")
    }()

    init() { refresh() }

    func startRefreshLoop() {
        Task { @MainActor in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(300))
                guard !Task.isCancelled else { return }
                refresh()
            }
        }
    }

    func refresh() {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            refreshEntitlementSnapshot()
            lastRefresh = .now
            return
        }
        do {
            let encrypted = try Data(contentsOf: fileURL)
            guard encrypted.starts(with: envelopePrefix) else { throw BillingStorageError.invalidEnvelope }
            let box = try AES.GCM.SealedBox(combined: encrypted.dropFirst(envelopePrefix.count))
            let clear = try AES.GCM.open(box, using: storageKey())
            archive = try JSONDecoder().decode(BillingArchive.self, from: clear)
            integrityFailure = false
            storageMessage = "Encrypted billing records verified."
            refreshEntitlementSnapshot()
            lastRefresh = .now
        } catch {
            integrityFailure = true
            storageMessage = "Billing records failed encryption or integrity verification and were not loaded. No saved data was changed."
        }
    }

    private func refreshEntitlementSnapshot() {
        guard let encrypted = try? Data(contentsOf: entitlementURL), encrypted.starts(with: entitlementPrefix) else { return }
        do {
            let box = try AES.GCM.SealedBox(combined: encrypted.dropFirst(entitlementPrefix.count))
            let clear = try AES.GCM.open(box, using: storageKey())
            let snapshot = try JSONDecoder().decode(BillingEntitlementSnapshot.self, from: clear)
            if let version = snapshot.metadataVersion, version != 1 { throw BillingStorageError.unsupportedMetadata }
            if let product = snapshot.product, product != "OverHead" { throw BillingStorageError.unsupportedMetadata }
            if let metadata = snapshot.metadata, (metadata.schemaVersion != 1 || metadata.product != "OverHead") {
                throw BillingStorageError.unsupportedMetadata
            }
            entitlement = snapshot
            if !hasLoadedRemoteSnapshot, archive.tiers.contains(snapshot.tier) {
                selectedTier = snapshot.tier
                hasLoadedRemoteSnapshot = true
            }
            if let remote = snapshot.subscriber {
                if archive.subscriber.name.isEmpty { archive.subscriber.name = remote.name }
                if archive.subscriber.email.isEmpty { archive.subscriber.email = remote.email }
                if archive.subscriber.businessName.isEmpty { archive.subscriber.businessName = remote.businessName }
                if archive.subscriber.phone.isEmpty { archive.subscriber.phone = remote.phone }
            }
        } catch { storageMessage = "The saved billing entitlement could not be authenticated."; integrityFailure = true }
    }

    func save() {
        guard !integrityFailure else { return }
        archive.refreshedAt = .now
        lastRefresh = archive.refreshedAt
        do {
            let clear = try JSONEncoder().encode(archive)
            let sealed = try AES.GCM.seal(clear, using: storageKey())
            guard let combined = sealed.combined else { throw BillingStorageError.encryptionFailed }
            try (envelopePrefix + combined).write(to: fileURL, options: .atomic)
            storageMessage = "Encrypted billing records saved and authenticated."
        } catch { storageMessage = "Could not securely save billing records: \(error.localizedDescription)" }
    }

    func add(_ category: String) {
        guard !integrityFailure else { return }
        let cleanCustomer = customer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanCustomer.isEmpty else { formMessage = "Enter the subscriber workspace first."; return }
        guard archive.tiers.contains(selectedTier) else { formMessage = "Choose a supported OverHead plan."; return }
        if category == "Plan billing" {
            if amount.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                amount = String(format: "%.2f", Double(defaultPriceCents(for: selectedTier)) / 100)
            }
            let normalizedAmount = amount.replacingOccurrences(of: "$", with: "").replacingOccurrences(of: ",", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard let value = Decimal(string: normalizedAmount), value > 0 else {
                formMessage = "Enter a positive plan amount, such as 129.00. No payment is sent from this form."
                return
            }
        }
        let cleanKey = licenseKey.trimmingCharacters(in: .whitespacesAndNewlines)
        if category == "License", !cleanKey.isEmpty, archive.entries.contains(where: { $0.licenseKey == cleanKey }) {
            formMessage = "That license key is already in this module."
            return
        }
        archive.entries.insert(BillingEntry(customer: cleanCustomer, category: category, tier: selectedTier, billingType: entitlement.billingType, amount: amount, status: "Local reference · no charge", licenseKey: cleanKey), at: 0)
        save()
        customer = ""; amount = ""; licenseKey = ""
        formMessage = storageMessage
    }

    private func defaultPriceCents(for tier: String) -> Int {
        switch tier { case "black": 29_900; case "gold": 12_900; default: 5_900 }
    }

    private func storageKey() throws -> SymmetricKey {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess, let data = result as? Data { return SymmetricKey(data: data) }
        guard status == errSecItemNotFound else { throw BillingStorageError.keychain(status) }
        let keyData = Data((0..<32).map { _ in UInt8.random(in: .min ... .max) })
        var add = query
        add.removeValue(forKey: kSecReturnData as String)
        add.removeValue(forKey: kSecMatchLimit as String)
        add[kSecValueData as String] = keyData
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let addStatus = SecItemAdd(add as CFDictionary, nil)
        guard addStatus == errSecSuccess else { throw BillingStorageError.keychain(addStatus) }
        return SymmetricKey(data: keyData)
    }
}

private enum BillingStorageError: LocalizedError {
    case invalidEnvelope
    case encryptionFailed
    case unsupportedMetadata
    case keychain(OSStatus)
    var errorDescription: String? {
        switch self {
        case .invalidEnvelope: "The encrypted billing archive has an invalid format."
        case .encryptionFailed: "The encrypted billing archive could not be sealed."
        case .unsupportedMetadata: "The Billing module returned metadata from an unsupported product or schema version."
        case .keychain(let status): "Keychain could not provide the billing encryption key (\(status))."
        }
    }
}
