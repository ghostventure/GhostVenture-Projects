import SwiftUI

@main
struct OverHeadNativeApp: App {
    @NSApplicationDelegateAdaptor(OverHeadAppDelegate.self) private var appDelegate
    @State private var store = OverHeadStore()
    @Environment(\.scenePhase) private var scenePhase
    @State private var inactivityTask: Task<Void, Never>?

    var body: some Scene {
        WindowGroup("OverHead") {
            MacRootView()
                .environment(store)
                .task { await store.checkForUpdates() }
                .frame(minWidth: 1080, minHeight: 700)
                .preferredColorScheme(store.archive.settings["theme"] == "dark" ? .dark : store.archive.settings["theme"] == "light" ? .light : nil)
                .onChange(of: scenePhase) { _, phase in
                    inactivityTask?.cancel()
                    guard phase == .inactive, store.isSignedIn, let minutes = Int(store.archive.settings["inactivityMinutes"] ?? "30"), minutes > 0 else { return }
                    inactivityTask = Task { @MainActor in
                        try? await Task.sleep(for: .seconds(minutes * 60))
                        if !Task.isCancelled, scenePhase != .active, store.isSignedIn { store.lockSession() }
                    }
                }
        }
        .defaultSize(width: 1440, height: 920)
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandMenu("Workspace") {
                Button("Team Dashboard") { store.selectedSection = .overview }.keyboardShortcut("1", modifiers: .command)
                Button("Customers") { store.selectedSection = .customers }.keyboardShortcut("2", modifiers: .command)
                Button("Workflows") { store.selectedSection = .work }.keyboardShortcut("3", modifiers: .command)
                Divider()
                Button("Lock Session") { store.lockSession() }.keyboardShortcut("L", modifiers: [.command, .option])
                Button("Sign Out") { store.signOut() }
            }
        }
    }
}
