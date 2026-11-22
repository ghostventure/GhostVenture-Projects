import AppKit
import SwiftUI

struct SettingsView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var selectedTab = "Workspace"
    @State private var showingRestore = false
    @State private var restoreData: Data?
    @State private var restoreName = ""
    @State private var restoreConfirmation = ""

    private let tabs = ["Workspace", "Privacy", "Reliability", "Plans", "About"]

    var body: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(tabs, id: \.self) { tab in
                    Button { selectedTab = tab } label: {
                        HStack(spacing: 9) { Image(systemName: icon(for: tab)).frame(width: 19); Text(tab); Spacer() }
                            .font(.system(size: 12, weight: selectedTab == tab ? .semibold : .regular))
                            .padding(.horizontal, 11).padding(.vertical, 9)
                            .background(selectedTab == tab ? OHStyle.blue.opacity(0.11) : .clear, in: RoundedRectangle(cornerRadius: 7))
                            .foregroundStyle(selectedTab == tab ? OHStyle.blue : .primary)
                    }.buttonStyle(.plain)
                }
                Spacer()
            }.frame(width: 175).padding(.horizontal, 15).padding(.top, 20)
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(selectedTab).font(.system(size: 22, weight: .bold, design: .rounded))
                        Text(subtitle).font(.system(size: 12)).foregroundStyle(.secondary)
                    }.frame(maxWidth: .infinity, alignment: .leading)
                    switch selectedTab {
                    case "Workspace": workspaceSettings
                    case "Privacy": privacySettings
                    case "Reliability": reliabilitySettings
                    case "Plans": planSettings
                    default: aboutSettings
                    }
                }.padding(25).frame(maxWidth: 900, alignment: .leading).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .fileImporter(isPresented: $showingRestore, allowedContentTypes: [.json, .data], allowsMultipleSelection: false) { result in
            do {
                guard let url = try result.get().first else { return }
                let accessed = url.startAccessingSecurityScopedResource()
                defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                restoreData = try Data(contentsOf: url)
                restoreName = url.lastPathComponent
                restoreConfirmation = ""
            } catch { store.errorMessage = error.localizedDescription }
        }
        .sheet(isPresented: Binding(get: { restoreData != nil }, set: { if !$0 { restoreData = nil } })) {
            restoreSheet.frame(width: 480, height: 270)
        }
    }

    private var workspaceSettings: some View {
        VStack(spacing: 0) {
            SettingsGroup(title: "Workspace profile", detail: "Account and current operating plan") {
                SettingsValue(label: "Business", value: store.businessName)
                SettingsValue(label: "Owner profile", value: store.displayName)
                SettingsValue(label: "Signed-in role", value: store.role.rawValue)
                SettingsValue(label: "Current plan", value: store.archive.activePlan.capitalized)
            }
            SettingsGroup(title: "Appearance", detail: "Choose an accessible workspace palette") {
                Picker("Theme", selection: settingBinding("theme", default: "system")) {
                    Text("System").tag("system"); Text("Clean Light").tag("light"); Text("Control Room").tag("dark"); Text("Ledger Green").tag("green"); Text("Graphite").tag("graphite"); Text("High Contrast").tag("contrast")
                }
                .pickerStyle(.menu)
            }
            SettingsGroup(title: "Notifications and work", detail: "Control reminders and owner review") {
                settingToggle("Enable reminders", key: "remindersEnabled", default: true)
                settingToggle("Desktop notifications", key: "notificationsEnabled", default: true)
                settingToggle("Require owner approval for protected actions", key: "requireOwnerApproval", default: true)
            }
        }
    }

    private var privacySettings: some View {
        VStack(spacing: 0) {
            SettingsGroup(title: "Privacy mode", detail: "Mask customer, account, and payment details in list views") {
                Toggle("Mask sensitive information", isOn: Binding(get: { store.privacyMode }, set: { store.setPrivacyMode($0) }))
                Text("When enabled, names and contact fields are hidden in workspace summaries. Open a record to review its full context.").font(.system(size: 11)).foregroundStyle(.secondary)
            }
            SettingsGroup(title: "Session protection", detail: "Lock the workspace after focus is lost") {
                Picker("Lock after", selection: settingBinding("inactivityMinutes", default: "30")) {
                    Text("Never").tag("0"); Text("5 minutes").tag("5"); Text("15 minutes").tag("15"); Text("30 minutes").tag("30"); Text("1 hour").tag("60")
                }.pickerStyle(.menu)
                SettingsValue(label: "Local encryption", value: "AES-GCM · Keychain-managed key")
                Button("Lock this session now", systemImage: "lock") { store.lockSession() }.buttonStyle(.bordered)
            }
            SettingsGroup(title: "Privacy requests", detail: "Track data export, deletion, and retention reviews") {
                Button("Create a privacy request", systemImage: "person.crop.circle.badge.questionmark") {
                    store.createDataRequest(type: "export", subjectEmail: store.profile?.email ?? "", notes: "Owner-requested data review")
                }.buttonStyle(.borderedProminent)
                Text("Requests are recorded for owner review. Confirm identity and legal retention requirements before acting on deletion requests.").font(.system(size: 11)).foregroundStyle(.secondary)
            }
        }
    }

    private var reliabilitySettings: some View {
        VStack(spacing: 0) {
            SettingsGroup(title: "Backup and recovery", detail: "Backups are encrypted with this Mac’s Keychain key") {
                Picker("Backup reminder", selection: settingBinding("backupFrequency", default: "weekly")) {
                    Text("Daily").tag("daily"); Text("Weekly").tag("weekly"); Text("Monthly").tag("monthly"); Text("Manual only").tag("manual")
                }.pickerStyle(.menu)
                HStack { Button("Create encrypted backup…", systemImage: "externaldrive.badge.timemachine") { WorkspaceFileActions.backup(store: store) }.buttonStyle(.borderedProminent); Button("Restore backup…", systemImage: "arrow.counterclockwise") { showingRestore = true }.buttonStyle(.bordered) }
                Button("Export workspace data…", systemImage: "square.and.arrow.up") { WorkspaceFileActions.export(store: store) }.buttonStyle(.bordered)
                SettingsValue(label: "Last backup", value: store.records("backupHistory").first?["title"].nonEmpty ?? "No backup recorded")
            }
            SettingsGroup(title: "Health monitor", detail: "Verify the hash-linked activity ledger") {
                SettingsValue(label: "Integrity status", value: store.lastIntegrityStatus)
                SettingsValue(label: "Activity entries", value: "\(store.records("auditEvents").count)")
                Button("Run integrity check", systemImage: "checkmark.shield") { store.runIntegrityCheck() }.buttonStyle(.bordered)
                Text("A changed or missing audit seal is reported for review. Checks do not repair or remove records.").font(.system(size: 11)).foregroundStyle(.secondary)
            }
            SettingsGroup(title: "Support bundle", detail: "Prepare a local diagnostics package for support") {
                Button("Create support bundle…", systemImage: "lifepreserver") { createSupportBundle() }.buttonStyle(.bordered)
                Text("The bundle contains app and workspace status, but excludes customer profile fields and credentials.").font(.system(size: 11)).foregroundStyle(.secondary)
            }
        }
    }

    private var planSettings: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 13) {
                ForEach(PlanCard.plans) { plan in
                    VStack(alignment: .leading, spacing: 11) {
                        HStack { Text(plan.name).font(.system(size: 16, weight: .bold)); Spacer(); if plan.id == store.archive.activePlan { StatusBadge(text: "CURRENT") } }
                        Text(plan.price).font(.system(size: 23, weight: .bold, design: .rounded))
                        Text(plan.summary).font(.system(size: 11)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                        ForEach(plan.features, id: \.self) { feature in Label(feature, systemImage: "checkmark").font(.system(size: 10)).foregroundStyle(.secondary) }
                        Button(plan.id == store.archive.activePlan ? "Current plan" : "Request plan change") {
                            store.requestApproval(title: "Change plan to \(plan.name)", details: "A billing owner must confirm pricing and recurring terms before a subscription change.", actionType: "billing_change")
                            if store.canManageWorkspace { store.notice = "Review the approval queue before changing billing. No charge was created." }
                        }.buttonStyle(.bordered).disabled(plan.id == store.archive.activePlan)
                    }
                    .padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(plan.id == store.archive.activePlan ? OHStyle.blue.opacity(0.5) : OHStyle.line, lineWidth: 1))
                }
            }
            SettingsGroup(title: "Billing profile", detail: "Details used for invoices and account records") {
                Button("Edit billing profile", systemImage: "pencil") { store.selectedSection = .plans }.buttonStyle(.bordered)
                Text("Payment processing is not enabled in this native Mac build. Plan changes remain pending until a secure billing connection is configured.").font(.system(size: 11)).foregroundStyle(.secondary)
            }
        }
    }

    private var aboutSettings: some View {
        VStack(spacing: 0) {
            SettingsGroup(title: "OverHead for Mac", detail: "Native SwiftUI workspace") {
                SettingsValue(label: "Version", value: "\(store.installedVersion) native Mac")
                SettingsValue(label: "Storage", value: "Encrypted local workspace")
                SettingsValue(label: "Workspace members", value: "\(store.archive.profiles.count)")
                SettingsValue(label: "Customer records", value: "\(store.customers.count)")
                SettingsValue(label: "Update status", value: store.updateCheckStatus)
                if !store.updateAvailableVersion.isEmpty {
                    Text(store.updateNotes).font(.system(size: 11)).foregroundStyle(.secondary)
                    if let url = store.updateDownloadURL { Link("Download OverHead \(store.updateAvailableVersion)", destination: url).buttonStyle(.borderedProminent) }
                }
                Button("Check for updates now", systemImage: "arrow.clockwise") { Task { await store.checkForUpdates() } }.buttonStyle(.bordered)
                if let lastUpdateCheck = store.lastUpdateCheck { Text("Last checked \(lastUpdateCheck.formatted(date: .abbreviated, time: .shortened))").font(.system(size: 10)).foregroundStyle(.secondary) }
            }
            SettingsGroup(title: "Support", detail: "Black Lion Media Studio") {
                Text("For account or data recovery questions, include the OverHead version, macOS version, the workflow that stopped, and a reviewed support bundle.").font(.system(size: 11)).foregroundStyle(.secondary)
                Link("Email OverHead Support", destination: URL(string: "mailto:solidartentertainment@gmail.com?subject=OverHead%20Mac%20Support")!)
            }
        }
    }

    private var restoreSheet: some View {
        VStack(alignment: .leading, spacing: 15) {
            Label("Restore workspace backup", systemImage: "arrow.counterclockwise.circle.fill").font(.system(size: 18, weight: .bold, design: .rounded))
            Text("Restoring replaces the current workspace on this Mac. Create a backup first if you need to keep current records.").font(.system(size: 12)).foregroundStyle(.secondary)
            LabeledContent("Backup file") { Text(restoreName).font(.system(size: 11, design: .monospaced)).lineLimit(1) }
            TextField("Type RESTORE to confirm", text: $restoreConfirmation).textFieldStyle(.roundedBorder)
            HStack { Spacer(); Button("Cancel") { restoreData = nil }; Button("Restore workspace", role: .destructive) { restore() }.buttonStyle(.borderedProminent).tint(OHStyle.orange).disabled(restoreConfirmation != "RESTORE") }
        }.padding(24)
    }

    private var subtitle: String {
        switch selectedTab { case "Workspace": "Set up your workspace and operational preferences."; case "Privacy": "Control data masking, session access, and privacy requests."; case "Reliability": "Protect workspace data and recover from local failures."; case "Plans": "Review product access and billing records."; default: "App details and the OverHead support path." }
    }

    private func icon(for tab: String) -> String {
        switch tab { case "Workspace": "building.2"; case "Privacy": "eye.slash"; case "Reliability": "externaldrive"; case "Plans": "creditcard"; default: "info.circle" }
    }

    private func settingBinding(_ key: String, default fallback: String) -> Binding<String> {
        Binding(get: { store.archive.settings[key] ?? fallback }, set: { store.setSetting(key, value: $0) })
    }

    private func settingToggle(_ title: String, key: String, default fallback: Bool) -> some View {
        Toggle(title, isOn: Binding(get: { store.archive.settings[key].map { $0 == "true" } ?? fallback }, set: { store.setSetting(key, value: String($0)) }))
            .disabled(!store.canManageWorkspace)
    }

    private func restore() {
        guard let data = restoreData else { return }
        do { try store.importArchive(data: data, sourceName: restoreName, confirmation: restoreConfirmation); restoreData = nil }
        catch { store.errorMessage = error.localizedDescription }
    }

    private func createSupportBundle() {
        let panel = NSSavePanel(); panel.nameFieldStringValue = "OverHead-Support-\(Date.now.formatted(.iso8601.year().month().day())).json"; panel.allowedContentTypes = [.json]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        let bundle: [String: String] = [
            "app": "OverHead Native Mac", "workspace": store.businessName, "role": store.role.rawValue,
            "customerCount": "\(store.customers.count)", "taskCount": "\(store.tasks.count)",
            "openTaskCount": "\(store.openTaskCount)", "auditEventCount": "\(store.records("auditEvents").count)",
            "integrityStatus": store.lastIntegrityStatus, "generatedAt": ISO8601DateFormatter().string(from: .now)
        ]
        do {
            try JSONSerialization.data(withJSONObject: bundle, options: [.prettyPrinted, .sortedKeys]).write(to: url, options: .atomic)
            _ = store.addRecord("supportBundles", fields: ["title": url.lastPathComponent, "status": "Created"])
            store.notice = "A sanitized support bundle was created. Review it before sharing."
        } catch { store.errorMessage = error.localizedDescription }
    }
}

private struct SettingsGroup<Content: View>: View {
    let title: String; let detail: String; @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            VStack(alignment: .leading, spacing: 3) { Text(title).font(.system(size: 14, weight: .bold, design: .rounded)); Text(detail).font(.system(size: 10)).foregroundStyle(.secondary) }
            content
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 13)).overlay(RoundedRectangle(cornerRadius: 13).stroke(OHStyle.line)).padding(.bottom, 10)
    }
}

private struct SettingsValue: View {
    let label: String; let value: String
    var body: some View { HStack { Text(label).font(.system(size: 11, weight: .medium)); Spacer(); Text(value).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1) } }
}

private struct PlanCard: Identifiable {
    let id: String; let name: String; let price: String; let summary: String; let features: [String]
    static let plans = [
        PlanCard(id: "silver", name: "Silver", price: "$59 / month", summary: "Core office control for a solo owner or lean front desk.", features: ["1 owner profile", "250 customers", "Task queue", "Backups", "Support bundle"]),
        PlanCard(id: "gold", name: "Gold", price: "$129 / month", summary: "Workflow and role depth for a busy service office.", features: ["3 staff profiles", "1,500 customers", "Workflow automation", "Legal center", "Priority support"]),
        PlanCard(id: "black", name: "Black", price: "$299 / month", summary: "Higher-volume protection, recovery, and access controls.", features: ["10 staff profiles", "10,000 customers", "Encrypted local store", "Audit ledger", "Concierge setup"])
    ]
}
