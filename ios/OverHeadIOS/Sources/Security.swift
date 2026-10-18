import Foundation
import Observation
import LocalAuthentication
import Security

enum KeychainStore {
    private static let service = "com.blacklion.overhead"
    private static let account = "last-successful-email"

    static func saveLastSuccessfulEmail(_ email: String) {
        let data = Data(email.utf8)
        SecItemDelete([kSecClass: kSecClassGenericPassword, kSecAttrService: service, kSecAttrAccount: account] as CFDictionary)
        SecItemAdd([kSecClass: kSecClassGenericPassword, kSecAttrService: service, kSecAttrAccount: account, kSecValueData: data, kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly] as CFDictionary, nil)
    }

    static func lastSuccessfulEmail() -> String {
        var result: CFTypeRef?
        let status = SecItemCopyMatching([kSecClass: kSecClassGenericPassword, kSecAttrService: service, kSecAttrAccount: account, kSecReturnData: true] as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return "" }
        return String(decoding: data, as: UTF8.self)
    }
}

@Observable
@MainActor
final class DeviceLock {
    private(set) var isLocked = false
    private(set) var unavailableReason = ""

    func lock() { isLocked = true }

    func unlock() async {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            unavailableReason = "Device authentication is not available. Set a device passcode, Face ID, or Touch ID, then try again."
            return
        }
        do {
            try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Unlock OverHead workspace data")
            isLocked = false
            unavailableReason = ""
        } catch {
            unavailableReason = "OverHead stays locked until device authentication succeeds."
        }
    }
}
