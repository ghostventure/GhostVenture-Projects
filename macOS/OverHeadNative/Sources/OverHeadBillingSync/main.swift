import Foundation
import Darwin
import CryptoKit
import Security

@main
enum OverHeadBillingSync {
    static let endpoint = URL(string: "https://us-central1-overhead-office.cloudfunctions.net/overheadTrialApi")!
    static let apiKey = "AIzaSyA2bxXMdNsXVgPaYv3jbWJXGlosVYtBd8U"

    static func main() async {
        do {
            let input = FileHandle.standardInput.readDataToEndOfFile()
            guard let request = try JSONSerialization.jsonObject(with: input) as? [String: String],
                  let token = request["idToken"], !token.isEmpty else {
                throw SyncError.message("The OverHead session was not provided to Billing.")
            }
            let entitlements = try await billing(action: "entitlements", token: token)
            let activity = try await billing(action: "billing_activity", token: token)
            let rawEntitlement = entitlements["entitlement"] as? [String: Any] ?? [:]
            let rawLicense = entitlements["license"] as? [String: Any] ?? [:]
            let entitlement: [String: Any] = [
                "tier": string(rawEntitlement["tier"]),
                "status": string(rawEntitlement["status"]),
                "stripe_customer_id": string(rawEntitlement["stripe_customer_id"]),
                "stripe_subscription_id": string(rawEntitlement["stripe_subscription_id"]),
                "trial_ends_at": timestamp(rawEntitlement["trial_ends_at"])
            ]
            let license: [String: Any] = [
                "tier": string(rawLicense["tier"]),
                "status": string(rawLicense["status"]),
                "license_number": string(rawLicense["license_number"]),
                "subscription_number": string(rawLicense["subscription_number"]),
                "issued_at": timestamp(rawLicense["issued_at"])
            ]
            let subscriberDefaults = [
                "name": "", "email": "", "phone": "", "businessName": "", "dba": "",
                "addressLine1": "", "addressLine2": "", "city": "", "region": "", "postalCode": "", "country": ""
            ]
            let subscriber = subscriberDefaults.merging(await fetchSubscriberProfile(token: token)) { _, new in new }
            let tier = string(rawEntitlement["tier"]).lowercased()
            let status = string(rawEntitlement["status"]).lowercased()
            let effectiveTier = ["active", "trialing", "past_due"].contains(status) && ["silver", "gold", "black"].contains(tier) ? tier : "silver"
            let plan = planMetadata(for: effectiveTier)
            let checkedAt = ISO8601DateFormatter().string(from: .now)
            let output: [String: Any] = [
                "metadataVersion": 1,
                "product": "OverHead",
                "entitlement": entitlement,
                "license": license,
                "events": activity["events"] as? [[String: Any]] ?? [],
                "tier": effectiveTier,
                "status": status.isEmpty ? "inactive" : status,
                "billingType": status == "trialing" ? "30-day trial" : (["active", "past_due"].contains(status) ? "Monthly subscription" : "No active subscription"),
                "customerID": string(rawEntitlement["stripe_customer_id"]),
                "subscriptionID": string(rawEntitlement["stripe_subscription_id"]),
                "trialEndsAt": timestamp(rawEntitlement["trial_ends_at"]),
                "checkedAt": checkedAt,
                "subscriber": subscriber,
                "plan": plan,
                "metadata": [
                    "schemaVersion": 1, "product": "OverHead", "checkedAt": checkedAt,
                    "plan": plan, "license": license, "subscriber": subscriber,
                    "stripe": ["customerID": string(rawEntitlement["stripe_customer_id"]), "subscriptionID": string(rawEntitlement["stripe_subscription_id"])]
                ]
            ]
            let data = try JSONSerialization.data(withJSONObject: output, options: [.sortedKeys])
            try saveAuthenticatedSnapshot(data)
            FileHandle.standardOutput.write(data)
        } catch {
            FileHandle.standardError.write(Data("\(error.localizedDescription)\n".utf8))
            Darwin.exit(EXIT_FAILURE)
        }
    }

    private static func planMetadata(for tier: String) -> [String: Any] {
        switch tier {
        case "black": [
            "tier": "black", "amountCents": 29900, "currency": "USD", "interval": "month",
            "description": "Higher-volume protection, recovery, and access controls.",
            "inclusions": ["10 staff profiles", "10,000 customers", "Encrypted local store", "Audit ledger", "Concierge setup"],
            "limits": ["staffProfiles": 10, "customers": 10000],
            "features": ["workflowAutomation": true, "legalCenter": true, "auditLedger": true]
        ]
        case "gold": [
            "tier": "gold", "amountCents": 12900, "currency": "USD", "interval": "month",
            "description": "Workflow and role depth for a busy service office.",
            "inclusions": ["3 staff profiles", "1,500 customers", "Workflow automation", "Legal center", "Priority support"],
            "limits": ["staffProfiles": 3, "customers": 1500],
            "features": ["workflowAutomation": true, "legalCenter": true, "auditLedger": false]
        ]
        default: [
            "tier": "silver", "amountCents": 5900, "currency": "USD", "interval": "month",
            "description": "Core office control for a solo owner or lean front desk.",
            "inclusions": ["1 owner profile", "250 customers", "Task queue", "Backups", "Support bundle"],
            "limits": ["staffProfiles": 1, "customers": 250],
            "features": ["workflowAutomation": false, "legalCenter": false, "auditLedger": false]
        ]
        }
    }

    private static func fetchSubscriberProfile(token: String) async -> [String: String] {
        do {
            var lookup = URLRequest(url: URL(string: "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=\(apiKey)")!)
            lookup.httpMethod = "POST"
            lookup.setValue("application/json", forHTTPHeaderField: "Content-Type")
            lookup.httpBody = try JSONSerialization.data(withJSONObject: ["idToken": token])
            let (identityData, _) = try await URLSession.shared.data(for: lookup)
            guard let identity = try JSONSerialization.jsonObject(with: identityData) as? [String: Any],
                  let uid = (identity["users"] as? [[String: Any]])?.first?["localId"] as? String else { return [:] }
            let path = "https://firestore.googleapis.com/v1/projects/overhead-office/databases/(default)/documents/profiles/\(uid)"
            var profileRequest = URLRequest(url: URL(string: path)!)
            profileRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            let (profileData, _) = try await URLSession.shared.data(for: profileRequest)
            let document = try JSONSerialization.jsonObject(with: profileData) as? [String: Any] ?? [:]
            let fields = document["fields"] as? [String: [String: Any]] ?? [:]
            func field(_ key: String) -> String { fields[key]?["stringValue"] as? String ?? "" }
            return [
                "name": field("owner_name"), "email": field("email"), "phone": field("phone"),
                "businessName": field("business_name"), "dba": field("dba"),
                "addressLine1": field("address_line_1"), "addressLine2": field("address_line_2"),
                "city": field("city"), "region": field("region"),
                "postalCode": field("postal_code"), "country": field("country")
            ]
        } catch { return [:] }
    }

    private static func saveAuthenticatedSnapshot(_ data: Data) throws {
        let service = "com.blacklion.overhead.billing"
        let account = "archive-encryption-key-v1"
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var found: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &found)
        let keyData: Data
        if status == errSecSuccess, let stored = found as? Data { keyData = stored }
        else if status == errSecItemNotFound {
            keyData = Data((0..<32).map { _ in UInt8.random(in: .min ... .max) })
            var add = query
            add.removeValue(forKey: kSecReturnData as String)
            add.removeValue(forKey: kSecMatchLimit as String)
            add[kSecValueData as String] = keyData
            add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            guard SecItemAdd(add as CFDictionary, nil) == errSecSuccess else { throw SyncError.message("Billing could not create its protected encryption key.") }
        } else { throw SyncError.message("Billing could not access its protected encryption key.") }

        let sealed = try AES.GCM.seal(data, using: SymmetricKey(data: keyData))
        guard let combined = sealed.combined else { throw SyncError.message("Billing could not authenticate the saved entitlement.") }
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Black Lion Media Studio/OverHead", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try (Data("OHENT1".utf8) + combined).write(to: directory.appendingPathComponent("billing-entitlement.enc"), options: .atomic)
    }

    private static func billing(action: String, token: String) async throws -> [String: Any] {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["action": action])
        request.timeoutInterval = 20
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw SyncError.message("Billing returned an invalid response.") }
        guard (200..<300).contains(http.statusCode) else {
            let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            throw SyncError.message(payload?["error"] as? String ?? "Billing check failed (HTTP \(http.statusCode)).")
        }
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }

    private static func string(_ value: Any?) -> String {
        guard let value, !(value is NSNull) else { return "" }
        return String(describing: value)
    }

    private static func timestamp(_ value: Any?) -> String {
        if let string = value as? String { return string }
        guard let object = value as? [String: Any], let seconds = object["_seconds"] as? Double else { return "" }
        return ISO8601DateFormatter().string(from: Date(timeIntervalSince1970: seconds))
    }

    private enum SyncError: LocalizedError {
        case message(String)
        var errorDescription: String? { if case let .message(value) = self { value } else { nil } }
    }
}
