import AppKit
import Foundation

enum BillingModuleLauncher {
    static func open() {
        let appURL = Bundle.main.bundleURL.appendingPathComponent("Contents/PlugIns/OverHeadBilling.app", isDirectory: true)
        NSWorkspace.shared.openApplication(at: appURL, configuration: NSWorkspace.OpenConfiguration())
    }

    static func syncEntitlements(idToken: String) async throws -> [String: Any] {
        let executable = Bundle.main.bundleURL
            .appendingPathComponent("Contents/PlugIns/OverHeadBilling.app/Contents/MacOS/OverHeadBillingSync")
        guard FileManager.default.isExecutableFile(atPath: executable.path) else {
            throw BillingModuleError.unavailable
        }
        return try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.global(qos: .utility).async {
                let process = Process()
                let input = Pipe()
                let output = Pipe()
                process.executableURL = executable
                process.standardInput = input
                process.standardOutput = output
                process.standardError = FileHandle.standardError
                do {
                    try process.run()
                    let request = try JSONSerialization.data(withJSONObject: ["idToken": idToken])
                    input.fileHandleForWriting.write(request)
                    try input.fileHandleForWriting.close()
                    let data = output.fileHandleForReading.readDataToEndOfFile()
                    process.waitUntilExit()
                    guard process.terminationStatus == 0,
                          let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                        throw BillingModuleError.failed
                    }
                    continuation.resume(returning: payload)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private enum BillingModuleError: LocalizedError {
        case unavailable
        case failed
        var errorDescription: String? {
            switch self {
            case .unavailable: "The OverHead Billing module is not installed with this app."
            case .failed: "The OverHead Billing module could not verify the plan."
            }
        }
    }
}
