import SwiftUI

@main
struct GhostSurferMacApp: App {
    @State private var browser = BrowserStore()
    @State private var updater = UpdaterManager()
    @State private var showingUpdateConsent = false

    var body: some Scene {
        WindowGroup("Ghost Surfer") {
            MacBrowserRootView()
                .environment(browser)
                .frame(minWidth: 920, minHeight: 620)
                .preferredColorScheme(.dark)
                .task { showingUpdateConsent = !updater.hasAnsweredConsent }
                .sheet(isPresented: $showingUpdateConsent) {
                    UpdateConsentView(
                        enable: { updater.enableAutomaticUpdates(); showingUpdateConsent = false },
                        decline: { updater.declineAutomaticUpdates(); showingUpdateConsent = false }
                    )
                    .preferredColorScheme(.dark)
                }
                .alert("Update could not be installed", isPresented: Binding(
                    get: { updater.updateFailureMessage != nil },
                    set: { if !$0 { updater.updateFailureMessage = nil } }
                )) {
                    Button("Download Installer") {
                        if let url = URL(string: "https://ghost-surfer-browser.web.app/#download") {
                            NSWorkspace.shared.open(url)
                        }
                    }
                    Button("Later", role: .cancel) { updater.updateFailureMessage = nil }
                } message: {
                    Text(updater.updateFailureMessage ?? "")
                }
        }
        .commands {
            CommandGroup(after: .newItem) {
                Button("New Tab") { browser.createTab() }
                    .keyboardShortcut("t", modifiers: .command)
            }
            CommandMenu("Ghost Surfer") {
                Button("Focus Address Bar") { browser.addressFocusRequest += 1 }
                    .keyboardShortcut("l", modifiers: .command)
                Button("New Private Tab") { browser.togglePrivateMode() }
                    .keyboardShortcut("n", modifiers: [.command, .shift])
                Divider()
                Button("Check for Updates…") { updater.checkManually() }
                Button(updater.automaticUpdatesEnabled ? "Disable Automatic Updates" : "Enable Automatic Updates…") {
                    if updater.automaticUpdatesEnabled {
                        updater.disableAutomaticUpdates()
                    } else {
                        showingUpdateConsent = true
                    }
                }
            }
        }
    }
}

private struct UpdateConsentView: View {
    let enable: () -> Void
    let decline: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Automatic updates", systemImage: "arrow.down.circle.fill")
                .font(.title2.weight(.semibold))
                .foregroundStyle(Color(red: 0.39, green: 0.9, blue: 0.75))
            Text("Ghost Surfer can check for updates about once a day, download signed updates in the background, and install them when macOS allows. You may be asked to quit the app or enter your Mac password.")
            Text("When checking, the update service receives your IP address and standard connection details. The request user-agent includes Ghost Surfer and Sparkle version information; anonymous system profiling is disabled. Your browsing history, bookmarks, and page contents are not included.")
            HStack(spacing: 5) {
                Text("Review the")
                Link("Privacy Policy", destination: URL(string: "https://ghost-surfer-browser.web.app/privacy.html")!)
                Text("and")
                Link("Terms", destination: URL(string: "https://ghost-surfer-browser.web.app/terms.html")!)
                Text("before choosing.")
            }
            .font(.callout)
            HStack {
                Button("Not Now", action: decline).keyboardShortcut(.cancelAction)
                Spacer()
                Button("Agree and Enable", action: enable).keyboardShortcut(.defaultAction)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(width: 470)
    }
}
