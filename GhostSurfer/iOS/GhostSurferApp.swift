import SwiftUI

@main
struct GhostSurferApp: App {
    @State private var browser = BrowserStore()

    var body: some Scene {
        WindowGroup {
            BrowserRootView()
                .environment(browser)
                .preferredColorScheme(.dark)
        }
    }
}
