import SwiftUI

struct MacRootView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var searchText = ""
    @State private var showCommandCenter = false

    var body: some View {
        Group {
            if !store.isSignedIn {
                AuthenticationView()
            } else if store.isLocked {
                SessionLockView()
            } else if store.needsTermsAcceptance {
                TermsAcceptanceView()
            } else if store.role == .customer {
                CustomerPortalView()
            } else {
                workspace
            }
        }
        .tint(OHStyle.blue)
        .alert("OverHead", isPresented: Binding(get: { store.errorMessage != nil }, set: { if !$0 { store.errorMessage = nil } })) {
            Button("OK", role: .cancel) { store.errorMessage = nil }
        } message: { Text(store.errorMessage ?? "") }
        .overlay(alignment: .bottom) {
            if !store.notice.isEmpty && store.isSignedIn && !store.isLocked {
                HStack(spacing: 10) {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(OHStyle.green)
                    Text(store.notice).font(.system(size: 12, weight: .medium)).lineLimit(2)
                    Spacer()
                    Button { store.notice = "" } label: { Image(systemName: "xmark").font(.system(size: 10, weight: .bold)) }.buttonStyle(.plain)
                }
                .padding(.horizontal, 15).padding(.vertical, 11).frame(maxWidth: 600)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(OHStyle.line))
                .shadow(color: .black.opacity(0.12), radius: 15, y: 4)
                .padding(.bottom, 18)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .sheet(isPresented: $showCommandCenter) {
            CommandCenterView(searchText: $searchText) { section in
                store.selectedSection = section
                showCommandCenter = false
            }
            .frame(width: 650, height: 510)
        }
    }

    private var workspace: some View {
        @Bindable var bindableStore = store
        return NavigationSplitView {
            VStack(spacing: 0) {
                HStack(spacing: 11) {
                    OverHeadBrandMark()
                        .frame(width: 38, height: 38)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("OverHead").font(.system(size: 17, weight: .bold, design: .rounded))
                        Text("DESKTOP WORKSPACE").font(.system(size: 9, weight: .bold)).tracking(1.1).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16).padding(.top, 17).padding(.bottom, 15)

                List(selection: $bindableStore.selectedSection) {
                    Section("WORKSPACE") {
                    ForEach(visibleSections) { section in
                            NavigationLink(value: section) {
                                Label {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(section.title).font(.system(size: 13, weight: section == store.selectedSection ? .semibold : .medium))
                                        Text(section.subtitle).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
                                    }
                                    .padding(.vertical, 3)
                                } icon: {
                                    Image(systemName: section.symbol).frame(width: 18)
                                }
                                .badge(section == .overview && store.openTaskCount > 0 ? store.openTaskCount : 0)
                            }
                            .tag(section)
                        }
                    }
                }
                .listStyle(.sidebar)

                Divider()
                HStack(spacing: 10) {
                    Circle().fill(OHStyle.green).frame(width: 8, height: 8)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(store.businessName).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                        Text("\(store.displayName) · \(store.role.rawValue)").font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    Menu {
                        Button("Lock Session", systemImage: "lock") { store.lockSession() }
                        Button("Privacy Mode", systemImage: "eye.slash") { store.setPrivacyMode(!store.privacyMode) }
                        Divider()
                        Button("Sign Out", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) { store.signOut() }
                    } label: {
                        Image(systemName: "ellipsis.circle").font(.system(size: 17)).foregroundStyle(.secondary)
                    }
                    .menuStyle(.borderlessButton)
                }
                .padding(14)
            }
            .background(OHStyle.sidebar)
            .navigationSplitViewColumnWidth(min: 235, ideal: 260, max: 310)
        } detail: {
            VStack(spacing: 0) {
                HStack(alignment: .center, spacing: 14) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(store.selectedSection.title).font(.system(size: 21, weight: .bold, design: .rounded))
                        Text(store.selectedSection.subtitle).font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button { showCommandCenter = true } label: {
                        Label("Search", systemImage: "magnifyingglass").labelStyle(.titleAndIcon)
                    }
                    .keyboardShortcut("k", modifiers: .command)
                    .help("Search workspace (⌘K)")
                    Button {
                        store.setPrivacyMode(!store.privacyMode)
                    } label: {
                        Label(store.privacyMode ? "Private" : "Visible", systemImage: store.privacyMode ? "eye.slash" : "eye")
                    }
                    .help("Toggle privacy masking")
                    Button { store.runIntegrityCheck() } label: { Image(systemName: "arrow.clockwise") }
                        .help("Refresh workspace status")
                }
                .padding(.horizontal, 26).padding(.vertical, 17)
                .background(.regularMaterial)

                WorkspaceSectionView(section: store.selectedSection)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .background(OHStyle.canvas)
        }
        .navigationSplitViewStyle(.balanced)
    }

    private var visibleSections: [WorkspaceSection] {
        if store.role == .owner { return WorkspaceSection.allCases }
        if [.frontDesk, .bookkeeper].contains(store.role) {
            return [.overview, .work, .customers, .imports, .automations, .evidence, .support, .tools, .accounts, .licenses, .security]
        }
        return [.overview, .work, .customers, .support, .tools, .security]
    }
}

struct OverHeadBrandMark: View {
    var body: some View {
        GeometryReader { geometry in
            let size = geometry.size
            ZStack {
                RoundedRectangle(cornerRadius: size.width * 0.25)
                    .fill(LinearGradient(colors: [Color(red: 0.15, green: 0.23, blue: 0.35), Color(red: 0.07, green: 0.12, blue: 0.20)], startPoint: .topLeading, endPoint: .bottomTrailing))
                OverHeadArch().stroke(LinearGradient(colors: [Color(red: 0.72, green: 0.66, blue: 1), Color(red: 0.51, green: 0.44, blue: 1)], startPoint: .leading, endPoint: .trailing), style: StrokeStyle(lineWidth: size.width * 0.052, lineCap: .round))
                VStack(spacing: size.height * 0.075) {
                    Capsule().fill(Color(red: 0.97, green: 0.98, blue: 1)).frame(width: size.width * 0.68, height: size.height * 0.055)
                    HStack(spacing: size.width * 0.09) { Capsule().fill(Color(red: 0.85, green: 0.88, blue: 0.94)).frame(width: size.width * 0.22, height: size.height * 0.04); Circle().fill(Color(red: 0.33, green: 0.84, blue: 0.71)).frame(width: size.width * 0.09) }
                    HStack(spacing: size.width * 0.09) { Capsule().fill(Color(red: 0.85, green: 0.88, blue: 0.94)).frame(width: size.width * 0.30, height: size.height * 0.04); Circle().fill(Color(red: 0.51, green: 0.44, blue: 1)).frame(width: size.width * 0.09) }
                    HStack(spacing: size.width * 0.09) { Capsule().fill(Color(red: 0.85, green: 0.88, blue: 0.94)).frame(width: size.width * 0.19, height: size.height * 0.04); Circle().fill(Color(red: 0.33, green: 0.84, blue: 0.71)).frame(width: size.width * 0.09) }
                }
                .frame(maxHeight: .infinity, alignment: .center)
                .offset(y: size.height * 0.19)
            }
            .clipShape(RoundedRectangle(cornerRadius: size.width * 0.25))
        }
    }
}

struct OverHeadArch: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX + rect.width * 0.22, y: rect.minY + rect.height * 0.38))
        path.addCurve(to: CGPoint(x: rect.minX + rect.width * 0.78, y: rect.minY + rect.height * 0.38), control1: CGPoint(x: rect.minX + rect.width * 0.22, y: rect.minY + rect.height * 0.08), control2: CGPoint(x: rect.minX + rect.width * 0.78, y: rect.minY + rect.height * 0.08))
        return path
    }
}

struct SessionLockView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var password = ""

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "lock.fill").font(.system(size: 25)).foregroundStyle(.white).frame(width: 60, height: 60).background(OHStyle.blue, in: RoundedRectangle(cornerRadius: 18))
            Text("Workspace locked").font(.system(size: 28, weight: .bold, design: .rounded))
            Text("Enter your OverHead password to continue.").foregroundStyle(.secondary)
            SecureField("Password", text: $password).textFieldStyle(.roundedBorder).frame(width: 320).onSubmit(unlock)
            Button("Unlock OverHead", action: unlock).buttonStyle(.borderedProminent).disabled(password.isEmpty)
            Button("Sign Out", role: .destructive) { store.signOut() }.buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity).background(OHStyle.canvas)
    }

    private func unlock() { store.unlock(password: password); password = "" }
}

enum OHStyle {
    static let blue = Color(red: 0.16, green: 0.38, blue: 0.62)
    static let ink = Color(red: 0.12, green: 0.17, blue: 0.22)
    static let muted = Color(red: 0.42, green: 0.48, blue: 0.54)
    static let green = Color(red: 0.18, green: 0.53, blue: 0.38)
    static let orange = Color(red: 0.79, green: 0.39, blue: 0.15)
    static let line = Color.primary.opacity(0.11)
    static let canvas = Color(nsColor: .windowBackgroundColor)
    static let sidebar = Color(nsColor: .underPageBackgroundColor)
}

private struct CustomerPortalView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var subject = ""
    @State private var details = ""
    @State private var sending = false

    var body: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 18) {
                OverHeadBrandMark().frame(width: 52, height: 52)
                Text("OverHead Customer Support").font(.system(size: 30, weight: .bold, design: .rounded))
                Text("A separate customer page for support requests and account help.").font(.system(size: 15)).foregroundStyle(.secondary)
                Spacer()
                Label("Staff records and billing controls stay private.", systemImage: "lock.shield").font(.system(size: 12)).foregroundStyle(.secondary)
            }
            .padding(46).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading).background(Color(red: 0.94, green: 0.96, blue: 0.97))
            VStack(alignment: .leading, spacing: 17) {
                HStack { VStack(alignment: .leading, spacing: 3) { Text("Send a support request").font(.system(size: 21, weight: .bold, design: .rounded)); Text("Welcome, \(store.displayName.isEmpty ? store.profile?.email ?? "OverHead customer" : store.displayName).") .font(.system(size: 12)).foregroundStyle(.secondary) }; Spacer(); Button("Sign Out", role: .destructive) { store.signOut() } }
                TextField("What do you need help with?", text: $subject).textFieldStyle(.roundedBorder)
                VStack(alignment: .leading, spacing: 5) { Text("Details").font(.system(size: 11, weight: .semibold)); TextEditor(text: $details).frame(minHeight: 150).overlay(RoundedRectangle(cornerRadius: 6).stroke(OHStyle.line)) }
                Text("Do not include passwords, card numbers, recovery codes, or tax identifiers.").font(.system(size: 10)).foregroundStyle(.secondary)
                Button { send() } label: { HStack { Spacer(); if sending { ProgressView().controlSize(.small) }; Text("Send Support Request").fontWeight(.semibold); Spacer() } }.buttonStyle(.borderedProminent).controlSize(.large).disabled(sending)
                Spacer()
            }
            .padding(36).frame(width: 530).frame(maxHeight: .infinity, alignment: .topLeading).background(OHStyle.canvas)
        }
    }

    private func send() {
        sending = true
        Task { await store.createSupportRequest(subject: subject, details: details); subject = ""; details = ""; sending = false }
    }
}

private struct TermsAcceptanceView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var accepted = false
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Image(systemName: "doc.text.magnifyingglass").font(.system(size: 27)).foregroundStyle(OHStyle.blue)
            Text("Review workspace terms").font(.system(size: 27, weight: .bold, design: .rounded))
            Text("Before opening this workspace, review the OverHead Terms of Use, Privacy Notice, and your business’s data responsibilities.").font(.system(size: 14)).foregroundStyle(.secondary)
            ForEach(["Terms of Use", "Privacy Notice", "Data Responsibility Disclaimer"], id: \.self) { title in
                DisclosureGroup(title) {
                    Text(store.records("legalDocuments").first(where: { $0.title == title })?["body"].nonEmpty ?? "Review the workspace policy with the owner.")
                        .font(.system(size: 11)).foregroundStyle(.secondary).padding(.vertical, 7)
                }
            }
            Toggle("I have reviewed and acknowledge these workspace terms.", isOn: $accepted)
            HStack { Button("Sign Out", role: .destructive) { store.signOut() }; Spacer(); Button("Continue", action: store.acceptWorkspaceTerms).buttonStyle(.borderedProminent).disabled(!accepted) }
        }
        .padding(35).frame(width: 650).background(OHStyle.canvas, in: RoundedRectangle(cornerRadius: 20)).overlay(RoundedRectangle(cornerRadius: 20).stroke(OHStyle.line))
        .frame(maxWidth: .infinity, maxHeight: .infinity).background(OHStyle.sidebar)
    }
}
