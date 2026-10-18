import SwiftUI
import FirebaseCore

@main
struct OverHeadIOSApp: App {
    @State private var session = AppSession()

    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
        }
    }
}
