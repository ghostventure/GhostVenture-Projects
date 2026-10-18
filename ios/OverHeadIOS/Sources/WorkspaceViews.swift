import SwiftUI

struct DashboardView: View {
    @Environment(AppSession.self) private var session
    var body: some View {
        NavigationStack {
            List {
                Section { Text("Good to see you, \(session.profile?.ownerName.split(separator: " ").first ?? "there").").font(.title2.bold()); Text("\(session.profile?.businessName ?? "") • \(session.profile?.role.rawValue ?? "") workspace").foregroundStyle(.secondary) }
                Section("Office Revenue Leak Check") {
                    MetricRow(title: "Priority tasks", value: "\(session.workspace.openTasks)", detail: "Work waiting for a clear next step")
                    MetricRow(title: "Pending approvals", value: "\(session.workspace.pendingApprovals)", detail: "Items needing manager review")
                    MetricRow(title: "Customer records", value: "\(session.workspace.customers.count)", detail: "Shared workspace customer context")
                }
                Section("Next actions") {
                    ForEach(session.workspace.tasks.filter { !$0.done }.prefix(5)) { task in HStack { Image(systemName: "circle"); Text(task.title) } }
                    if session.workspace.openTasks == 0 { Text("No open tasks. Add one concrete next action.").foregroundStyle(.secondary) }
                }
                if !session.workspace.notice.isEmpty { Section { Text(session.workspace.notice).font(.footnote).foregroundStyle(.secondary) } }
            }.navigationTitle("Today")
        }
    }
}

struct MetricRow: View { let title: String; let value: String; let detail: String; var body: some View { HStack { VStack(alignment: .leading) { Text(title); Text(detail).font(.footnote).foregroundStyle(.secondary) }; Spacer(); Text(value).font(.title3.bold()).foregroundStyle(.orange) } } }

struct TasksView: View {
    @Environment(AppSession.self) private var session
    @State private var draft = ""
    var body: some View {
        NavigationStack { List { Section { HStack { TextField("Add the next action that matters", text: $draft); Button("Add") { Task { await session.workspace.addTask(draft); draft = "" } }.disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty) } }; Section("Priority queue") { ForEach(session.workspace.tasks) { task in Button { Task { await session.workspace.toggle(task) } } label: { HStack { Image(systemName: task.done ? "checkmark.circle.fill" : "circle").foregroundStyle(task.done ? .green : .secondary); Text(task.title).strikethrough(task.done); Spacer() } }.buttonStyle(.plain) } } }.navigationTitle("Tasks") }
    }
}

struct CustomersView: View {
    @Environment(AppSession.self) private var session
    @State private var showingAdd = false
    var body: some View {
        NavigationStack { List(session.workspace.customers) { customer in VStack(alignment: .leading, spacing: 4) { Text(customer.name).font(.headline); if !customer.email.isEmpty { Text(customer.email).font(.subheadline).foregroundStyle(.secondary) }; if !customer.phone.isEmpty { Text(customer.phone).font(.subheadline).foregroundStyle(.secondary) } } }.navigationTitle("Customers").toolbar { Button { showingAdd = true } label: { Image(systemName: "plus") } }.sheet(isPresented: $showingAdd) { AddCustomerView(isPresented: $showingAdd) } }
    }
}

struct AddCustomerView: View {
    @Environment(AppSession.self) private var session
    @Binding var isPresented: Bool
    @State private var name = ""; @State private var email = ""; @State private var phone = ""
    var body: some View { NavigationStack { Form { TextField("Customer name", text: $name).textContentType(.name); TextField("Email (optional)", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never); TextField("Phone (optional)", text: $phone).keyboardType(.phonePad) }.navigationTitle("Add customer").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }; ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { await session.workspace.addCustomer(name: name, email: email, phone: phone); isPresented = false } }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty) } } } }
}

struct ApprovalsView: View {
    @Environment(AppSession.self) private var session
    @State private var showingAdd = false
    var body: some View { NavigationStack { List { ForEach(session.workspace.approvals) { item in VStack(alignment: .leading, spacing: 8) { HStack { Text(item.title).font(.headline); Spacer(); Text(item.status).font(.caption.weight(.semibold)).padding(6).background(item.status == "Pending" ? Color.orange.opacity(0.15) : Color.secondary.opacity(0.12), in: Capsule()) }; if !item.details.isEmpty { Text(item.details).foregroundStyle(.secondary) }; if session.profile?.role.canApprove == true && item.status == "Pending" { HStack { Button("Approve") { Task { await session.workspace.decide(item, status: "Approved") } }.buttonStyle(.borderedProminent); Button("Decline") { Task { await session.workspace.decide(item, status: "Declined") } }.buttonStyle(.bordered) } } } } }.navigationTitle("Approvals").toolbar { Button { showingAdd = true } label: { Image(systemName: "plus") } }.sheet(isPresented: $showingAdd) { RequestApprovalView(isPresented: $showingAdd) } } }
}

struct RequestApprovalView: View {
    @Environment(AppSession.self) private var session
    @Binding var isPresented: Bool
    @State private var title = ""; @State private var details = ""
    var body: some View { NavigationStack { Form { TextField("Approval needed", text: $title); TextField("What needs review?", text: $details, axis: .vertical).lineLimit(3...6) }.navigationTitle("Request approval").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }; ToolbarItem(placement: .confirmationAction) { Button("Send") { Task { await session.workspace.requestApproval(title: title, details: details); isPresented = false } }.disabled(title.trimmingCharacters(in: .whitespaces).isEmpty) } } } }
}

struct AccountView: View {
    @Environment(AppSession.self) private var session
    var body: some View { NavigationStack { List { Section("Workspace") { LabeledContent("Business", value: session.profile?.businessName ?? ""); LabeledContent("Role", value: session.profile?.role.rawValue ?? ""); LabeledContent("Email", value: session.profile?.email ?? "") }; Section("Device sync status") { ForEach(["tasks", "customers", "approvals"], id: \.self) { key in LabeledContent(key.capitalized, value: session.workspace.syncStates[key]?.label ?? "Waiting for first sync") }; Text("Status reflects this device Firestore cache and pending writes. It does not report other devices.").font(.footnote).foregroundStyle(.secondary) }; Section("Security") { Text("The app locks when it enters the background and requires device authentication before workspace data is shown again.").font(.footnote).foregroundStyle(.secondary); Button("Lock now") { session.deviceLock.lock() } }; Section("Need help?") { Link("Open OverHead support", destination: URL(string: "https://overhead-office.web.app/support/")!); Text("If something does not work, support should see a plain-language error and the time it occurredâ€”never your password.").font(.footnote).foregroundStyle(.secondary) }; Section { Button("Sign out", role: .destructive) { session.signOut() } } }.navigationTitle("Account") } }
}
