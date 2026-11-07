import SwiftUI
import FirebaseCore

@main
struct OverHeadApp: App {
    @State private var store: OverHeadStore

    init() {
        FirebaseApp.configure()
        _store = State(initialValue: OverHeadStore())
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .preferredColorScheme(.light)
        }
    }
}
