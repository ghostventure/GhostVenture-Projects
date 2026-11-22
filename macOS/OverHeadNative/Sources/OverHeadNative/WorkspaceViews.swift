import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct WorkspaceSectionView: View {
    @Environment(OverHeadStore.self) private var store
    let section: WorkspaceSection

    var body: some View {
        switch section {
        case .overview: DashboardView()
        case .customers: CustomerWorkspaceView()
        case .imports: MicrosoftImportView()
        case .payments: StripePaymentsView()
        case .square: SquareWorkspaceView()
        case .accounts: AccountsWorkspaceView()
        case .plans: PlansWorkspaceView()
        case .settings: SettingsView()
        default: WorkspaceDataView(section: section)
        }
    }
}

struct DashboardView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var showingTaskEditor = false
    @State private var showingNoteEditor = false
    @State private var filter = "Open"

    private var visibleTasks: [WorkspaceRecord] {
        let records = store.tasks
        return records.filter { task in
            filter == "All" || (filter == "Open" ? !["Complete", "Closed"].contains(task.status) : task.status == filter)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 23) {
                HStack {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(Date.now.formatted(.dateTime.weekday(.wide).month(.wide).day())).font(.system(size: 13, weight: .medium)).foregroundStyle(.secondary)
                        Text("A little less overhead.").font(.system(size: 30, weight: .bold, design: .rounded))
                        Text("Today’s work, customer context, and decisions in one place.").font(.system(size: 14)).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Menu {
                        Text(store.displayName)
                        Text(store.role.rawValue)
                        Text("\(store.businessName) · \(store.archive.activePlan.capitalized) plan")
                        Divider()
                        Button("Create workspace backup…", systemImage: "externaldrive.badge.timemachine") { WorkspaceFileActions.backup(store: store) }
                        Button("Lock workspace", systemImage: "lock") { store.lockSession() }
                    } label: { Image(systemName: "person.crop.circle.fill").font(.system(size: 29)).foregroundStyle(OHStyle.ink.opacity(0.8)) }
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 13) {
                    MetricCard(title: "Open tasks", value: "\(store.openTaskCount)", icon: "checklist", tint: OHStyle.blue, note: "Across your workspace")
                    MetricCard(title: "Overdue", value: "\(store.overdueTaskCount)", icon: "clock.badge.exclamationmark", tint: store.overdueTaskCount > 0 ? OHStyle.orange : OHStyle.green, note: "Need a next step")
                    MetricCard(title: "Customers", value: "\(store.customers.count)", icon: "person.2", tint: OHStyle.green, note: "Local workspace records")
                    MetricCard(title: "Approvals", value: "\(store.pendingApprovalCount)", icon: "checkmark.seal", tint: OHStyle.orange, note: "Awaiting owner review")
                }

                HStack(spacing: 14) {
                    Button { showingTaskEditor = true } label: { Label("Add a task", systemImage: "plus") }.buttonStyle(.borderedProminent)
                    Button { showingNoteEditor = true } label: { Label("Log an update", systemImage: "square.and.pencil") }.buttonStyle(.bordered)
                    Button { store.selectedSection = .customers } label: { Label("Open customers", systemImage: "person.2") }.buttonStyle(.bordered)
                    Spacer()
                    Label("\(store.businessName) · \(store.role.rawValue)", systemImage: "building.2").font(.system(size: 11, weight: .medium)).foregroundStyle(.secondary)
                }

                HStack(alignment: .top, spacing: 18) {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) { Text("Current work queue").font(.system(size: 17, weight: .bold, design: .rounded)); Text("Keep the next action visible.").font(.system(size: 11)).foregroundStyle(.secondary) }
                            Spacer()
                            Picker("Task filter", selection: $filter) { Text("Open").tag("Open"); Text("Complete").tag("Complete"); Text("All").tag("All") }.frame(width: 110)
                        }
                        if visibleTasks.isEmpty {
                            ContentUnavailableView("No tasks here", systemImage: "checkmark.circle", description: Text("Add work that needs a follow-up."))
                                .frame(minHeight: 190)
                        } else {
                            ForEach(visibleTasks.prefix(9)) { task in TaskRow(task: task) }
                        }
                    }
                    .padding(18).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(OHStyle.line))
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Office readiness").font(.system(size: 17, weight: .bold, design: .rounded))
                        ReadinessRow(title: "Owner profile", status: store.isConfigured ? "Ready" : "Needs review", good: store.isConfigured)
                        ReadinessRow(title: "Customer records", status: store.customers.isEmpty ? "Add the first customer" : "\(store.customers.count) on this Mac", good: !store.customers.isEmpty)
                        ReadinessRow(title: "Workspace backup", status: store.records("backupHistory").first?["created_at"].nonEmpty == nil ? "Not created" : "Available", good: !store.records("backupHistory").isEmpty)
                        ReadinessRow(title: "Audit integrity", status: store.lastIntegrityStatus, good: store.lastIntegrityStatus == "Clean")
                        Divider().padding(.vertical, 3)
                        Button("Run launch checklist", systemImage: "list.clipboard") { store.selectedSection = .settings; store.notice = "Review each setup and recovery control." }.buttonStyle(.bordered).frame(maxWidth: .infinity)
                    }
                    .padding(18).frame(width: 295, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(OHStyle.line))
                }
            }
            .padding(26)
        }
        .sheet(isPresented: $showingTaskEditor) { RecordEditorSheet(collection: "tasks", title: "New task") }
        .sheet(isPresented: $showingNoteEditor) { RecordEditorSheet(collection: "quickNotes", title: "Log an update") }
    }
}

private struct TaskRow: View {
    @Environment(OverHeadStore.self) private var store
    let task: WorkspaceRecord
    var body: some View {
        HStack(spacing: 12) {
            Button { store.setTaskStatus(task, status: task.status == "Complete" ? "Open" : "Complete") } label: {
                Image(systemName: task.status == "Complete" ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 19)).foregroundStyle(task.status == "Complete" ? OHStyle.green : .secondary)
            }.buttonStyle(.plain).help(task.status == "Complete" ? "Reopen task" : "Complete task")
            VStack(alignment: .leading, spacing: 4) {
                Text(task.title).font(.system(size: 13, weight: .semibold)).strikethrough(task.status == "Complete")
                HStack(spacing: 7) {
                    if let area = task["area"].nonEmpty { Text(area) }
                    if let customer = task["customer_name"].nonEmpty { Text("· \(store.privacyMode ? "Hidden" : customer)") }
                    if let due = task["due_at"].nonEmpty { Text("· \(DateFormatter.shortDue(due))") }
                }.font(.system(size: 10)).foregroundStyle(.secondary)
            }
            Spacer()
            StatusBadge(text: task.status, prominent: task["priority"] == "High")
            Menu {
                ForEach(["Open", "Queued", "Blocked", "Complete"], id: \.self) { status in Button(status) { store.setTaskStatus(task, status: status) } }
            } label: { Image(systemName: "ellipsis").foregroundStyle(.secondary).frame(width: 24, height: 24) }.menuStyle(.borderlessButton)
        }
        .padding(.vertical, 9).padding(.horizontal, 11).background(OHStyle.canvas, in: RoundedRectangle(cornerRadius: 10))
    }
}

private struct ReadinessRow: View {
    let title: String; let status: String; let good: Bool
    var body: some View {
        HStack(alignment: .top, spacing: 9) {
            Image(systemName: good ? "checkmark.circle.fill" : "exclamationmark.circle.fill").foregroundStyle(good ? OHStyle.green : OHStyle.orange).font(.system(size: 14))
            VStack(alignment: .leading, spacing: 3) { Text(title).font(.system(size: 11, weight: .semibold)); Text(status).font(.system(size: 10)).foregroundStyle(.secondary) }
            Spacer(minLength: 0)
        }
    }
}

struct WorkspaceDataView: View {
    @Environment(OverHeadStore.self) private var store
    let section: WorkspaceSection
    @State private var selectedCollection = ""
    @State private var searchText = ""
    @State private var editingRecord: WorkspaceRecord?
    @State private var showingNew = false
    @State private var showImporter = false
    @State private var showCSVImporter = false
    @State private var showRestoreConfirmation = false
    @State private var pendingRestoreData: Data?
    @State private var pendingRestoreName = ""

    private var options: [(String, String)] { WorkspaceCollections.options(for: section) }
    private var currentKey: String { options.first(where: { $0.0 == selectedCollection })?.1 ?? options.first?.1 ?? "" }
    private var currentTitle: String { options.first(where: { $0.0 == selectedCollection })?.0 ?? "Records" }
    private var entries: [WorkspaceRecord] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        let results = store.records(currentKey)
        guard !query.isEmpty else { return results }
        return results.filter { record in
            record.fields.values.contains { $0.localizedCaseInsensitiveContains(query) } || record.title.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            sectionActions
            HStack(spacing: 9) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Search \(currentTitle.lowercased())", text: $searchText).textFieldStyle(.plain)
                Text("\(entries.count) records").font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 12).padding(.vertical, 9).background(OHStyle.canvas, in: RoundedRectangle(cornerRadius: 8)).padding(.horizontal, 24).padding(.top, 18)

            if entries.isEmpty {
                ContentUnavailableView {
                    Label("No \(currentTitle.lowercased()) yet", systemImage: section.symbol)
                } description: {
                    Text("Add a record to start tracking \(currentTitle.lowercased()) in this workspace.")
                } actions: {
                    Button("Add \(singular(currentTitle))") { showingNew = true }.buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(entries) { record in
                        WorkspaceRecordRow(record: record, collection: currentKey, section: section) {
                            editingRecord = record
                        }
                    }
                }
                .listStyle(.inset)
                .padding(.horizontal, 14).padding(.top, 10)
            }
        }
        .onAppear { if selectedCollection.isEmpty { selectedCollection = options.first?.0 ?? "" } }
        .onChange(of: section) { _, newValue in selectedCollection = WorkspaceCollections.options(for: newValue).first?.0 ?? ""; searchText = "" }
        .sheet(isPresented: $showingNew) { RecordEditorSheet(collection: currentKey, title: "New \(singular(currentTitle))") }
        .sheet(item: $editingRecord) { record in RecordEditorSheet(collection: currentKey, title: "Edit \(singular(currentTitle))", record: record) }
        .fileImporter(isPresented: $showCSVImporter, allowedContentTypes: [.commaSeparatedText, .plainText], allowsMultipleSelection: false) { result in
            do {
                guard let url = try result.get().first, url.startAccessingSecurityScopedResource() else { return }
                defer { url.stopAccessingSecurityScopedResource() }
                let count = try store.importCSV(Data(contentsOf: url), into: currentKey)
                store.notice = "Imported \(count) record\(count == 1 ? "" : "s") from \(url.lastPathComponent)."
            } catch { store.errorMessage = error.localizedDescription }
        }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.json, .data], allowsMultipleSelection: false) { result in
            do {
                guard let url = try result.get().first else { return }
                let accessed = url.startAccessingSecurityScopedResource()
                defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                pendingRestoreData = try Data(contentsOf: url)
                pendingRestoreName = url.lastPathComponent
                showRestoreConfirmation = true
            } catch { store.errorMessage = error.localizedDescription }
        }
        .sheet(isPresented: $showRestoreConfirmation) {
            if let pendingRestoreData {
                RestoreConfirmationView(data: pendingRestoreData, sourceName: pendingRestoreName)
                    .frame(width: 480, height: 270)
            }
        }
    }

    @ViewBuilder private var sectionActions: some View {
        HStack(spacing: 10) {
            Menu {
                ForEach(options, id: \.1) { option in Button(option.0) { selectedCollection = option.0; searchText = "" } }
            } label: {
                Label(currentTitle, systemImage: "square.stack.3d.up").font(.system(size: 12, weight: .semibold))
            }
            .menuStyle(.borderlessButton)
            Spacer()

            if section == .evidence {
                Button { store.runIntegrityCheck() } label: { Label("Run integrity check", systemImage: "checkmark.shield") }.buttonStyle(.bordered)
            }
            if section == .automations {
                Button { processJobs() } label: { Label("Process due jobs", systemImage: "play.fill") }.buttonStyle(.bordered)
            }
            if section == .imports || section == .customers || section == .payments || section == .square {
                Button { showCSVImporter = true } label: { Label("Import CSV", systemImage: "square.and.arrow.down") }.buttonStyle(.bordered)
            }
            if section == .tools {
                Button { WorkspaceFileActions.backup(store: store) } label: { Label("Backup", systemImage: "externaldrive.badge.timemachine") }.buttonStyle(.bordered)
                Button { WorkspaceFileActions.export(store: store) } label: { Label("Export", systemImage: "square.and.arrow.up") }.buttonStyle(.bordered)
                Button { showImporter = true } label: { Label("Restore", systemImage: "arrow.counterclockwise") }.buttonStyle(.bordered)
            }
            Button { showingNew = true } label: { Label("Add", systemImage: "plus") }.buttonStyle(.borderedProminent)
                .disabled(!store.canManageWorkspace && [WorkspaceSection.accounts, .plans, .licenses, .settings].contains(section))
        }
        .padding(.horizontal, 26).padding(.top, 18)
    }

    private func processJobs() {
        store.processDueJobs()
    }

    private func singular(_ value: String) -> String {
        switch value { case "Customers": "customer"; case "Tasks": "task"; case "Appointments": "appointment"; case "Quotes": "quote"; case "Invoices": "invoice"; default: value.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "s$", with: "", options: .regularExpression).lowercased() }
    }
}

private enum WorkspaceCollections {
    static func options(for section: WorkspaceSection) -> [(String, String)] {
        switch section {
        case .work: [("Scheduling", "appointments"), ("Customer Answers", "answerLibrary"), ("Quotes", "quotes"), ("Invoices", "invoices"), ("Follow-up Tasks", "tasks"), ("Workflow Templates", "workflows")]
        case .customers: [("Customers", "customers"), ("Workflow Rules", "workflowPreferences"), ("Service History", "serviceHistory"), ("Customer Documents", "customerDocuments")]
        case .imports: [("Microsoft Connections", "microsoftConnections"), ("Import Previews", "importPreviews")]
        case .automations: [("Workflow Jobs", "workflowJobs"), ("Task Queue", "tasks"), ("Operational Toggles", "appToggles")]
        case .evidence: [("Audit Trail", "auditEvents"), ("Integrity Snapshots", "integritySnapshots"), ("Tamper Events", "tamperEvents")]
        case .support: [("Support Tickets", "supportTickets"), ("Legal Documents", "legalDocuments"), ("Acknowledgements", "legalAcknowledgements")]
        case .tools: [("Documents", "documents"), ("Backups", "backupHistory"), ("Data Exports", "dataExports"), ("Support Bundles", "supportBundles")]
        case .accounts: [("Workspace Users", "userProfiles"), ("Manager Profiles", "managerProfiles"), ("Approval Queue", "approvalRequests")]
        case .licenses: [("Workspace Licenses", "licenses"), ("OverHead Team Register", "employeeLicenses")]
        case .plans: [("Subscriptions", "subscriptions"), ("Billing Profiles", "billingProfiles"), ("Entitlements", "entitlements")]
        case .payments: [("Stripe Connections", "stripeConnections"), ("Stripe Imports", "stripeImports"), ("Payment Records", "paymentRecords")]
        case .square: [("Square Connections", "squareConnections"), ("Square Imports", "squareImports")]
        case .security: [("Data Requests", "dataRequests"), ("Fraud Signals", "fraudSignals"), ("Compliance Events", "complianceEvents")]
        case .settings: [("Operational Settings", "settings"), ("Feature Toggles", "appToggles"), ("Backup History", "backupHistory")]
        case .overview: [("Tasks", "tasks")]
        }
    }
}

private struct RestoreConfirmationView: View {
    @Environment(OverHeadStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let data: Data
    let sourceName: String
    @State private var confirmation = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Restore workspace backup", systemImage: "arrow.counterclockwise.circle.fill")
                .font(.system(size: 18, weight: .bold, design: .rounded))
            Text("Restoring replaces the current workspace on this Mac. Create a fresh backup first if you need to keep the current records.")
                .font(.system(size: 12)).foregroundStyle(.secondary)
            LabeledContent("Backup file") { Text(sourceName).font(.system(size: 11, design: .monospaced)).lineLimit(1) }
            TextField("Type RESTORE to confirm", text: $confirmation).textFieldStyle(.roundedBorder)
            HStack {
                Spacer()
                Button("Cancel") { dismiss() }
                Button("Restore workspace", role: .destructive) {
                    do { try store.importArchive(data: data, sourceName: sourceName, confirmation: confirmation); dismiss() }
                    catch { store.errorMessage = error.localizedDescription }
                }
                .buttonStyle(.borderedProminent).tint(OHStyle.orange).disabled(confirmation != "RESTORE")
            }
        }
        .padding(24)
    }
}

private struct WorkspaceRecordRow: View {
    @Environment(OverHeadStore.self) private var store
    let record: WorkspaceRecord
    let collection: String
    let section: WorkspaceSection
    let edit: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 15, weight: .semibold)).foregroundStyle(tint).frame(width: 34, height: 34).background(tint.opacity(0.11), in: RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 7) {
                    Text(maskedTitle).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                    if let priority = record["priority"].nonEmpty { StatusBadge(text: priority, prominent: priority == "High") }
                }
                Text(detail).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(2)
            }
            Spacer(minLength: 8)
            if let email = record["email"].nonEmpty { Text(store.privacyMode ? "••••••" : email).font(.system(size: 10, design: .monospaced)).foregroundStyle(.secondary).lineLimit(1) }
            StatusBadge(text: record.status, prominent: ["Blocked", "Suspended", "High"].contains(record.status))
            Menu {
                Button("Edit", systemImage: "pencil", action: edit)
                if collection == "tasks" || collection == "workflowJobs" || collection == "appointments" || collection == "quotes" || collection == "invoices" {
                    Divider()
                    ForEach(availableStatuses, id: \.self) { status in Button(status) { store.updateRecord(collection, record: record, fields: ["status": status]) } }
                }
                if collection == "approvalRequests", record.status == "Pending" {
                    Divider()
                    Button("Approve", systemImage: "checkmark.seal") { store.decideApproval(record, decision: "Approved") }
                    Button("Decline", systemImage: "xmark.seal", role: .destructive) { store.decideApproval(record, decision: "Rejected") }
                }
                if collection == "quotes" || collection == "invoices" {
                    Divider()
                    Button("Create PDF", systemImage: "doc.richtext") { WorkspaceFileActions.createDocumentPDF(record: record, kind: collection, store: store) }
                }
                if collection == "legalDocuments" { Divider(); Button("Acknowledge", systemImage: "checkmark") { store.acknowledgeLegal(record.title) } }
                Divider()
                Button("Delete", systemImage: "trash", role: .destructive) { store.deleteRecord(collection, id: record.id) }
            } label: { Image(systemName: "ellipsis").foregroundStyle(.secondary).frame(width: 22, height: 27) }.menuStyle(.borderlessButton)
        }
        .padding(.vertical, 7).padding(.horizontal, 9)
        .contentShape(Rectangle()).onTapGesture(count: 2, perform: edit)
    }

    private var maskedTitle: String {
        guard store.privacyMode, ["customers", "userProfiles", "managerProfiles", "paymentRecords"].contains(collection) else { return record.title }
        return "Private record"
    }
    private var detail: String {
        let hiddenFields: Set<String> = store.privacyMode ? ["email", "phone", "details", "address", "account_id"] : []
        let fields = ["business_name", "customer_name", "category", "area", "industry", "summary", "details", "type", "email", "role", "action_type", "event_type", "created_at"]
        return fields.compactMap { field -> String? in
            guard !hiddenFields.contains(field), let value = record[field].nonEmpty else { return nil }
            return field == "created_at" ? DateFormatter.shortDue(value) : value
        }.joined(separator: " · ").nonEmpty ?? "Added \(record.createdAt.formatted(date: .abbreviated, time: .shortened))"
    }
    private var icon: String { collection == "customers" ? "person.crop.circle" : collection == "tasks" ? "checklist" : collection == "auditEvents" ? "clock.arrow.circlepath" : collection == "invoices" || collection == "paymentRecords" ? "dollarsign.circle" : "doc.text" }
    private var tint: Color { record.status == "Blocked" || record.status == "Suspended" ? OHStyle.orange : OHStyle.blue }
    private var availableStatuses: [String] { collection == "tasks" ? ["Open", "Queued", "Blocked", "Complete"] : ["Open", "Pending", "In Progress", "Complete", "Canceled"] }
}

struct RecordEditorSheet: View {
    @Environment(OverHeadStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let collection: String
    let title: String
    var record: WorkspaceRecord? = nil
    @State private var values: [String: String] = [:]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 3) { Text(title).font(.system(size: 18, weight: .bold, design: .rounded)); Text(RecordFields.subtitle(for: collection)).font(.system(size: 11)).foregroundStyle(.secondary) }
                Spacer()
                Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
                Button("Save") { save() }.keyboardShortcut(.defaultAction).buttonStyle(.borderedProminent)
            }.padding(18)
            Divider()
            Form {
                ForEach(RecordFields.fields(for: collection), id: \.key) { field in
                    if field.multiline {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(field.label).font(.system(size: 11, weight: .semibold))
                            TextEditor(text: binding(field.key)).frame(minHeight: 80)
                        }
                    } else if !field.options.isEmpty {
                        Picker(field.label, selection: binding(field.key)) {
                            ForEach(field.options, id: \.self) { Text($0).tag($0) }
                        }
                    } else {
                        TextField(field.label, text: binding(field.key), prompt: Text(field.placeholder))
                    }
                }
            }
            .formStyle(.grouped)
            .padding(.horizontal, 10)
        }
        .frame(width: 600, height: 620)
        .onAppear { values = record?.fields ?? RecordFields.defaults(for: collection) }
    }

    private func binding(_ key: String) -> Binding<String> { Binding(get: { values[key] ?? "" }, set: { values[key] = $0 }) }
    private func save() {
        if let record { store.updateRecord(collection, record: record, fields: values) }
        else { _ = store.addRecord(collection, fields: values) }
        dismiss()
    }
}

private struct FieldSpec {
    var key: String; var label: String; var placeholder = ""; var multiline = false; var options: [String] = []
}

private enum RecordFields {
    static func subtitle(for key: String) -> String {
        switch key {
        case "customers": "Customer profile and service context"
        case "tasks": "Assign the next action and due date"
        case "appointments": "Scheduling record and deposit context"
        case "quotes": "Pricing, approval, and expiration tracking"
        case "invoices": "Invoice follow-through and payment status"
        case "answerLibrary": "Approved responses for customer questions"
        case "workflows": "Repeatable service workflows and owner rules"
        case "workflowPreferences": "Customer-specific workflow rules"
        case "supportTickets": "Support request and follow-up"
        case "userProfiles": "Workspace account and role details"
        case "employeeLicenses": "OverHead team employee access record"
        case "subscriptions": "Plan and access record"
        case "billingProfiles": "Business billing and invoice details"
        case "stripeConnections": "Test-mode Stripe connection metadata"
        case "squareConnections": "Square environment and merchant details"
        case "dataRequests": "Privacy, export, and retention request"
        case "workflowJobs": "Scheduled automation job"
        default: "Workspace record"
        }
    }

    static func defaults(for key: String) -> [String: String] {
        ["status": key == "answerLibrary" || key == "workflows" ? "Draft" : "Open", "priority": "Normal", "created_at": ISO8601DateFormatter().string(from: .now)]
    }

    static func fields(for key: String) -> [FieldSpec] {
        let status = FieldSpec(key: "status", label: "Status", options: ["Open", "Queued", "In Progress", "Pending", "Complete", "Blocked", "Canceled", "Active", "Suspended", "Draft", "Approved", "Rejected"])
        let priority = FieldSpec(key: "priority", label: "Priority", options: ["Normal", "High", "Low"])
        switch key {
        case "customers": return [f("business_name", "Business name"), f("owner_name", "Owner name"), f("email", "Email"), f("phone", "Phone"), f("website", "Website"), f("industry", "Industry"), f("timezone", "Time zone", placeholder: "America/New_York"), f("service_area", "Service area"), f("preferred_contact", "Preferred contact", options: ["Email", "Phone", "Text"]), status, f("notes", "Service notes", multiline: true)]
        case "tasks": return [f("title", "Task"), f("area", "Workflow area"), f("customer_name", "Customer"), f("owner", "Owner"), f("due_at", "Due date", placeholder: "YYYY-MM-DD"), priority, status, f("details", "Details", multiline: true)]
        case "appointments": return [f("title", "Appointment"), f("customer_name", "Customer"), f("service_type", "Service type"), f("scheduled_for", "Date and time", placeholder: "YYYY-MM-DD HH:MM"), f("address", "Service address"), f("deposit_status", "Deposit status", options: ["Not required", "Required", "Paid", "Unpaid"]), priority, status, f("details", "Notes", multiline: true)]
        case "quotes": return [f("title", "Quote"), f("customer_name", "Customer"), f("amount", "Amount"), f("currency", "Currency", placeholder: "USD"), f("expires_at", "Expires"), f("approval_required", "Owner review", options: ["Yes", "No"]), status, f("line_items", "Line items", multiline: true), f("notes", "Notes", multiline: true)]
        case "invoices": return [f("title", "Invoice"), f("customer_name", "Customer"), f("amount", "Amount"), f("due_at", "Due date"), f("payment_status", "Payment status", options: ["Unpaid", "Pending", "Paid", "Past due", "Disputed"]), status, f("line_items", "Line items", multiline: true), f("notes", "Notes", multiline: true)]
        case "answerLibrary": return [f("title", "Question or response name"), f("category", "Category"), status, f("trigger", "Question or trigger", multiline: true), f("body", "Approved response", multiline: true), f("escalation_rule", "When to escalate", multiline: true)]
        case "workflows": return [f("title", "Workflow name"), f("category", "Category", options: ["Scheduling", "Customer Answers", "Quotes", "Invoices", "Follow-up"]), f("owner", "Responsible role", options: WorkspaceRole.allCases.map(\.rawValue)), status, f("summary", "Purpose", multiline: true), f("steps", "Workflow steps", multiline: true), f("approval_rules", "Owner approval rules", multiline: true)]
        case "workflowPreferences": return [f("customer_name", "Customer"), f("booking_rules", "Booking rules", multiline: true), f("answer_tone", "Answer tone", multiline: true), f("quote_rules", "Quote rules", multiline: true), f("invoice_rules", "Invoice rules", multiline: true), f("followup_rules", "Follow-up rules", multiline: true), f("human_review_required", "Human review required", options: ["Yes", "No"])]
        case "workflowJobs": return [f("title", "Job title"), f("type", "Job type", options: ["reminder", "owner_digest", "follow_up", "invoice_nudge"]), f("run_at", "Run at", placeholder: "YYYY-MM-DD HH:MM"), status, f("payload", "Job details", multiline: true)]
        case "supportTickets": return [f("subject", "Subject"), f("requester", "Requester email"), priority, status, f("details", "Support request", multiline: true)]
        case "legalDocuments": return [f("title", "Document title"), f("version", "Version"), status, f("effective_at", "Effective date"), f("body", "Document text", multiline: true)]
        case "userProfiles", "managerProfiles": return [f("name", "Name"), f("email", "Email"), f("role", "Role", options: WorkspaceRole.allCases.map(\.rawValue)), f("status", "Account status", options: ["Active", "Suspended", "Inactive"]), f("recovery_hint", "Recovery hint"), f("notes", "Notes", multiline: true)]
        case "employeeLicenses": return [f("employee_name", "Employee name"), f("email", "Email"), f("job_title", "Job title"), f("access_level", "Access level", options: ["Support", "Operations", "Management", "Administrator"]), f("expires_at", "Expires"), f("status", "Status", options: ["Active", "Suspended", "Inactive"])]
        case "subscriptions": return [f("manager_email", "Manager email"), f("tier", "Plan", options: ["silver", "gold", "black"]), f("payment_provider", "Provider", options: ["manual", "stripe"]), f("payment_status", "Payment status", options: ["trial", "paid", "past_due", "canceled"]), f("trial_ends_at", "Trial ends"), f("external_subscription_id", "Provider subscription ID")]
        case "billingProfiles": return [f("legal_name", "Legal business name"), f("billing_email", "Billing email"), f("phone", "Phone"), f("address_line_1", "Address"), f("address_line_2", "Address line 2"), f("city", "City"), f("region", "State / region"), f("postal_code", "Postal code"), f("country", "Country"), f("invoice_terms", "Invoice terms"), f("invoice_footer", "Invoice footer", multiline: true)]
        case "stripeConnections": return [f("mode", "Mode", options: ["test"]), f("client_id", "Stripe client ID"), f("account_id", "Connected account ID"), f("publishable_key", "Test publishable key"), f("status", "Connection status", options: ["Setup required", "Connected", "Needs review"]), f("notes", "Connection notes", multiline: true)]
        case "stripeImports": return [f("business_name", "Business"), f("manager_email", "Manager email"), f("tier", "Plan", options: ["silver", "gold", "black"]), f("payment_status", "Payment status", options: ["paid", "trial", "past_due", "canceled"]), f("customer_count", "Customers"), f("invoice_count", "Invoices"), f("payment_count", "Payments"), f("external_customer_id", "Provider customer ID"), f("external_subscription_id", "Subscription ID")]
        case "paymentRecords": return [f("provider", "Provider", options: ["stripe", "square"]), f("manager_email", "Manager email"), f("tier", "Plan", options: ["silver", "gold", "black"]), f("payment_status", "Payment status", options: ["paid", "trial", "past_due", "canceled"]), f("amount", "Amount"), f("currency", "Currency", placeholder: "USD"), f("external_customer_id", "Customer ID"), f("external_subscription_id", "Subscription ID")]
        case "squareConnections": return [f("environment", "Environment", options: ["sandbox", "production"]), f("application_id", "Application ID"), f("merchant_id", "Merchant ID"), f("location_id", "Location ID"), f("access_token", "Access token"), f("status", "Status", options: ["Setup required", "Connected", "Needs review"])]
        case "squareImports": return [f("business_name", "Business"), f("merchant_id", "Merchant ID"), f("location_name", "Location"), f("location_id", "Location ID"), f("customer_count", "Customers"), f("catalog_item_count", "Catalog items"), f("order_count", "Orders"), f("payment_count", "Payments")]
        case "dataRequests": return [f("title", "Request title"), f("request_type", "Request type", options: ["export", "delete", "retention_review"]), f("subject_email", "Subject email"), status, f("notes", "Request details", multiline: true)]
        case "fraudSignals": return [f("title", "Signal"), f("severity", "Severity", options: ["Low", "Medium", "High"]), status, f("details", "Evidence", multiline: true)]
        case "importPreviews": return [f("title", "Preview name"), f("provider", "Provider"), f("record_count", "Records detected"), status, f("notes", "Preview notes", multiline: true)]
        case "customerDocuments", "documents": return [f("title", "Document name"), f("customer_name", "Customer"), f("file_name", "File name"), f("document_type", "Document type"), status, f("notes", "Description", multiline: true)]
        case "serviceHistory": return [f("title", "Service event"), f("customer_name", "Customer"), f("service_type", "Service type"), f("occurred_at", "Date"), status, f("details", "Details", multiline: true)]
        default: return [f("title", "Name"), f("category", "Category"), priority, status, f("details", "Details", multiline: true)]
        }
    }

    private static func f(_ key: String, _ label: String, placeholder: String = "", multiline: Bool = false, options: [String] = []) -> FieldSpec {
        FieldSpec(key: key, label: label, placeholder: placeholder, multiline: multiline, options: options)
    }
}

struct MetricCard: View {
    let title: String; let value: String; let icon: String; let tint: Color; let note: String
    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack { Image(systemName: icon).font(.system(size: 14, weight: .semibold)).foregroundStyle(tint).frame(width: 31, height: 31).background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 9)); Spacer(); Image(systemName: "arrow.up.right").font(.system(size: 10)).foregroundStyle(.tertiary) }
            Text(value).font(.system(size: 28, weight: .bold, design: .rounded)).foregroundStyle(OHStyle.ink)
            VStack(alignment: .leading, spacing: 2) { Text(title).font(.system(size: 12, weight: .semibold)); Text(note).font(.system(size: 10)).foregroundStyle(.secondary) }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }
}

struct StatusBadge: View {
    let text: String; var prominent = false
    var body: some View {
        Text(text).font(.system(size: 9, weight: .bold)).padding(.horizontal, 8).padding(.vertical, 4)
            .foregroundStyle(prominent ? OHStyle.orange : OHStyle.muted)
            .background((prominent ? OHStyle.orange : OHStyle.muted).opacity(0.11), in: Capsule())
    }
}

struct CommandCenterView: View {
    @Binding var searchText: String
    let select: (WorkspaceSection) -> Void
    @Environment(\.dismiss) private var dismiss
    private var matches: [WorkspaceSection] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return WorkspaceSection.allCases.filter { query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) || $0.subtitle.localizedCaseInsensitiveContains(query) }
    }
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) { Image(systemName: "magnifyingglass").foregroundStyle(.secondary); TextField("Search commands and workspace", text: $searchText).textFieldStyle(.plain).font(.system(size: 16)); Text("ESC").font(.system(size: 9, weight: .bold, design: .monospaced)).foregroundStyle(.secondary).padding(5).background(OHStyle.canvas, in: RoundedRectangle(cornerRadius: 4)) }.padding(18)
            Divider()
            List(matches) { section in
                Button { select(section) } label: {
                    HStack(spacing: 12) { Image(systemName: section.symbol).frame(width: 24); VStack(alignment: .leading, spacing: 2) { Text(section.title).fontWeight(.semibold); Text(section.subtitle).font(.system(size: 10)).foregroundStyle(.secondary) }; Spacer(); Image(systemName: "return").foregroundStyle(.tertiary) }.padding(.vertical, 3)
                }.buttonStyle(.plain)
            }.listStyle(.plain)
        }
        .onExitCommand { dismiss() }
        .onAppear { searchText = "" }
    }
}

@MainActor
enum WorkspaceFileActions {
    static func backup(store: OverHeadStore) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = "OverHead-Backup-\(Date.now.formatted(.iso8601.year().month().day())).ohbackup"; panel.allowedContentTypes = [.data]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do { try store.createBackup(at: url); _ = store.addRecord("backupHistory", fields: ["title": url.lastPathComponent, "status": "Encrypted", "created_at": ISO8601DateFormatter().string(from: .now)]) }
        catch { store.errorMessage = error.localizedDescription }
    }
    static func export(store: OverHeadStore) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = "OverHead-Export-\(Date.now.formatted(.iso8601.year().month().day())).json"; panel.allowedContentTypes = [.json]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do { try store.exportArchive(to: url); _ = store.addRecord("dataExports", fields: ["title": url.lastPathComponent, "status": "Created", "created_at": ISO8601DateFormatter().string(from: .now)]) }
        catch { store.errorMessage = error.localizedDescription }
    }
    static func createDocumentPDF(record: WorkspaceRecord, kind: String, store: OverHeadStore) {
        let label = kind == "quotes" ? "Quote" : "Invoice"
        let safeName = record.title.replacingOccurrences(of: "[^A-Za-z0-9-]+", with: "-", options: .regularExpression)
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "OverHead-\(label)-\(safeName).pdf"
        panel.allowedContentTypes = [.pdf]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        let lines = [
            "OVERHEAD · \(label.uppercased())", "", record.title,
            "Customer: \(record["customer_name"].nonEmpty ?? "—")",
            "Date: \(Date.now.formatted(date: .long, time: .omitted))",
            "Due / expiry: \(record["due_at"].nonEmpty ?? record["expires_at"].nonEmpty ?? "—")",
            "Amount: \(record["currency"].nonEmpty ?? "USD") \(record["amount"].nonEmpty ?? "—")",
            "Status: \(record["payment_status"].nonEmpty ?? record.status)", "",
            "Line items", record["line_items"].nonEmpty ?? "No line items were provided.", "",
            "Notes", record["notes"].nonEmpty ?? "—", "",
            "Prepared with OverHead for Mac. Review all details before sending."
        ]
        let textView = NSTextView(frame: NSRect(x: 0, y: 0, width: 612, height: 792))
        textView.isEditable = false
        textView.isSelectable = true
        textView.textContainerInset = NSSize(width: 52, height: 48)
        textView.font = .systemFont(ofSize: 12)
        textView.string = lines.joined(separator: "\n")
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = 5
        let range = NSRange(location: 0, length: (textView.string as NSString).length)
        textView.textStorage?.addAttribute(.paragraphStyle, value: paragraph, range: range)
        let titleRange = (textView.string as NSString).range(of: label.uppercased())
        if titleRange.location != NSNotFound { textView.textStorage?.addAttribute(.font, value: NSFont.boldSystemFont(ofSize: 20), range: titleRange) }
        do {
            try textView.dataWithPDF(inside: textView.bounds).write(to: url, options: .atomic)
            _ = store.addRecord("documents", fields: ["title": url.lastPathComponent, "source_record_id": record.id, "document_type": label, "status": "Created", "created_at": ISO8601DateFormatter().string(from: .now)])
            store.notice = "\(label) PDF created. Review it before sending."
        } catch { store.errorMessage = error.localizedDescription }
    }
}

private extension DateFormatter {
    static func shortDue(_ raw: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: raw) else { return raw }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}
