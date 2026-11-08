import SwiftUI

@main
struct GhostSurferMacApp: App {
    @State private var browser = BrowserStore()

    var body: some Scene {
        WindowGroup("Ghost Surfer") {
            MacBrowserRootView()
                .environment(browser)
                .frame(minWidth: 920, minHeight: 620)
                .preferredColorScheme(.dark)
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
            }
        }
    }
}
