import SwiftUI

struct RootView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if session.isLoading { ProgressView("Checking secure workspace access...") }
            else if session.deviceLock.isLocked && session.profile != nil { DeviceLockView() }
            else if session.requiresEmailVerification { VerificationView() }
            else if session.profile == nil { AuthenticationView() }
            else { WorkspaceTabView() }
        }
        .tint(.orange)
        .onChange(of: scenePhase) { _, phase in
            if phase == .background && session.profile != nil { session.deviceLock.lock() }
        }
    }
}

struct WorkspaceTabView: View {
    @Environment(AppSession.self) private var session
    var body: some View {
        TabView {
            DashboardView().tabItem { Label("Today", systemImage: "rectangle.3.group.fill") }
            CustomersView().tabItem { Label("Customers", systemImage: "person.2.fill") }
            TasksView().tabItem { Label("Tasks", systemImage: "checklist") }
            ApprovalsView().tabItem { Label("Approvals", systemImage: "checkmark.seal.fill") }
            AccountView().tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
        .modifier(PlatformAdaptiveTabs())
        .task { await session.reloadVerification() }
    }
}

/// iPhone retains the familiar compact tab bar. On current iPads this becomes
/// Apple's adaptive tab/sidebar treatment, which remains usable in Split View
/// and Stage Manager without maintaining a separate iPad-only navigation tree.
private struct PlatformAdaptiveTabs: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.tabViewStyle(.sidebarAdaptable)
        } else {
            content
        }
    }
}

struct DeviceLockView: View {
    @Environment(AppSession.self) private var session
    var body: some View {
        ContentUnavailableView("OverHead is locked", systemImage: "lock.fill", description: Text("Authenticate with your device passcode, Face ID, or Touch ID before showing workspace data."))
            .overlay(alignment: .bottom) {
                VStack(spacing: 12) {
                    if !session.deviceLock.unavailableReason.isEmpty { Text(session.deviceLock.unavailableReason).font(.footnote).multilineTextAlignment(.center) }
                    Button("Unlock workspace") { Task { await session.deviceLock.unlock() } }.buttonStyle(.borderedProminent)
                }.padding()
            }
    }
}
