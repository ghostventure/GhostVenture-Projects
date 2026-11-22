import AppKit
import Darwin
import Foundation

@MainActor
final class OverHeadAppDelegate: NSObject, NSApplicationDelegate {
    private var instanceLockFD: Int32 = -1

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        guard acquireInstanceLock() else {
            NSApp.terminate(nil)
            return
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        if instanceLockFD >= 0 {
            var lock = makeLock(type: F_UNLCK)
            _ = Darwin.fcntl(instanceLockFD, F_SETLK, &lock)
            Darwin.close(instanceLockFD)
            instanceLockFD = -1
        }
    }

    private func acquireInstanceLock() -> Bool {
        do {
            let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
                .appendingPathComponent("Black Lion Media Studio/OverHead", isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let url = directory.appendingPathComponent("instance.lock")
            let fd = Darwin.open(url.path, O_CREAT | O_RDWR, mode_t(S_IRUSR | S_IWUSR))
            guard fd >= 0 else { return false }
            var lock = makeLock(type: F_WRLCK)
            guard Darwin.fcntl(fd, F_SETLK, &lock) == 0 else {
                var bytes = [CChar](repeating: 0, count: 32)
                let length = Darwin.pread(fd, &bytes, bytes.count - 1, 0)
                let pidText = length > 0 ? String(cString: bytes) : ""
                if let pid = Int32(pidText), let runningApp = NSRunningApplication(processIdentifier: pid) {
                    runningApp.activate(options: [.activateAllWindows])
                }
                Darwin.close(fd)
                return false
            }
            instanceLockFD = fd
            _ = Darwin.ftruncate(fd, 0)
            _ = Darwin.lseek(fd, 0, SEEK_SET)
            let pid = Array(String(getpid()).utf8)
            _ = pid.withUnsafeBytes { Darwin.write(fd, $0.baseAddress, $0.count) }
            return true
        } catch {
            return false
        }
    }

    private func makeLock(type: Int32) -> Darwin.flock {
        var lock = Darwin.flock()
        lock.l_type = Int16(type)
        lock.l_whence = Int16(SEEK_SET)
        lock.l_start = 0
        lock.l_len = 0
        return lock
    }
}
