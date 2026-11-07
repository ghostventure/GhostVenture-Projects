import SwiftUI

struct AddTaskSheet: View {
    @Environment(OverHeadStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var customerId = ""
    @State private var kind: TaskKind = .task
    @State private var includesDueDate = false
    @State private var dueAt = Date.now

    var body: some View {
        NavigationStack {
            Form {
                Section("What needs doing?") {
                    TextField("Short task", text: $title)
                        .submitLabel(.done)
                        .onSubmit(save)
                    Picker("Type", selection: $kind) {
                        ForEach([TaskKind.task, .followUp, .appointment], id: \.rawValue) { item in
                            Text(item.title).tag(item)
                        }
                    }
                    if !store.customers.isEmpty {
                        Picker("Customer (optional)", selection: $customerId) {
                            Text("No customer").tag("")
                            ForEach(store.customers) { customer in
                                Text(customer.name).tag(customer.id)
                            }
                        }
                    }
                }
                Section("When") {
                    Toggle("Set a due date", isOn: $includesDueDate)
                    if includesDueDate {
                        DatePicker("Due", selection: $dueAt, in: Date.now..., displayedComponents: [.date, .hourAndMinute])
                    }
                }
                Section {
                    Label("This task will sync to your OverHead workspace.", systemImage: "icloud")
                        .font(.system(size: 12))
                        .foregroundStyle(OverHeadStyle.muted)
                }
            }
            .navigationTitle("Add a task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(store.isLoading ? "Saving…" : "Save", action: save)
                        .disabled(store.isLoading || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
            .presentationDetents([.medium, .large])
    }

    private func save() {
        Task {
            if await store.addTask(title, customerId: customerId.isEmpty ? nil : customerId, kind: kind, dueAt: includesDueDate ? dueAt : nil) { dismiss() }
        }
    }
}

struct QuickNoteSheet: View {
    @Environment(OverHeadStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var customerId = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Quick update") {
                    TextField("What happened?", text: $text, axis: .vertical)
                        .lineLimit(3...6)
                }
                if !store.customers.isEmpty {
                    Section("Customer (optional)") {
                        Picker("Link to", selection: $customerId) {
                            Text("No customer").tag("")
                            ForEach(store.customers) { customer in
                                Text(customer.name).tag(customer.id)
                            }
                        }
                    }
                }
                Section {
                    Label("This update will be added to your workspace activity.", systemImage: "icloud")
                        .font(.system(size: 12))
                        .foregroundStyle(OverHeadStyle.muted)
                }
            }
            .navigationTitle("Log an update")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(store.isLoading ? "Saving…" : "Save", action: save)
                        .disabled(store.isLoading || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func save() {
        Task {
            if await store.addNote(text, customerId: customerId.isEmpty ? nil : customerId) { dismiss() }
        }
    }
}

struct ApprovalsView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var showingRequest = false

    private var pendingCount: Int { store.approvals.filter { $0.status == "Pending" }.count }

    var body: some View {
        NavigationStack {
            Group {
                if store.approvals.isEmpty {
                    EmptyState(icon: "checkmark.seal", title: "No approval requests", detail: "Send a quick request when a decision needs a manager’s attention.")
                        .padding(.horizontal, 26)
                } else {
                    List {
                        Section {
                            ForEach(store.approvals) { approval in
                                VStack(alignment: .leading, spacing: 10) {
                                    HStack(alignment: .top) {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(approval.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(OverHeadStyle.ink)
                                            if let date = approval.createdAt {
                                                Text(date.formatted(date: .abbreviated, time: .shortened))
                                                    .font(.system(size: 11, weight: .medium)).foregroundStyle(OverHeadStyle.muted)
                                            }
                                        }
                                        Spacer()
                                        ApprovalStatus(status: approval.status)
                                    }
                                    if !approval.details.isEmpty {
                                        Text(approval.details).font(.system(size: 14)).foregroundStyle(OverHeadStyle.muted)
                                    }
                                    if store.canViewActivity && approval.status == "Pending" {
                                        HStack {
                                            Button("Approve") { Task { await store.decideApproval(approval, status: "Approved") } }
                                                .buttonStyle(.borderedProminent).tint(OverHeadStyle.green)
                                            Button("Decline", role: .destructive) { Task { await store.decideApproval(approval, status: "Declined") } }
                                                .buttonStyle(.bordered)
                                        }
                                        .padding(.top, 2)
                                    }
                                }
                                .padding(.vertical, 7)
                                .listRowBackground(Color.white)
                            }
                        } header: {
                            Text("\(pendingCount) pending")
                        }
                    }
                    .scrollContentBackground(.hidden)
                    .background(OverHeadStyle.canvas)
                }
            }
            .background(OverHeadStyle.canvas.ignoresSafeArea())
            .navigationTitle("Approvals")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingRequest = true } label: { Label("Request", systemImage: "plus") }
                }
            }
            .refreshable { await store.refresh() }
            .sheet(isPresented: $showingRequest) { ApprovalRequestSheet() }
        }
    }
}

private struct ApprovalStatus: View {
    let status: String
    private var color: Color { status == "Approved" ? OverHeadStyle.green : status == "Declined" ? .red : OverHeadStyle.orange }

    var body: some View {
        Text(status.uppercased())
            .font(.system(size: 9, weight: .bold, design: .rounded))
            .tracking(0.5)
            .foregroundStyle(color)
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(color.opacity(0.1), in: Capsule())
    }
}

private struct ApprovalRequestSheet: View {
    @Environment(OverHeadStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var details = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("What needs a decision?") {
                    TextField("Short title", text: $title)
                        .textInputAutocapitalization(.sentences)
                    TextField("Add context (optional)", text: $details, axis: .vertical)
                        .lineLimit(3...6)
                }
                Section {
                    Label("Managers can approve or decline this from mobile or web.", systemImage: "person.badge.clock")
                        .font(.system(size: 12)).foregroundStyle(OverHeadStyle.muted)
                }
            }
            .navigationTitle("Request approval")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(store.isLoading ? "Sending…" : "Send") { save() }
                        .disabled(store.isLoading || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func save() {
        Task {
            if await store.requestApproval(title: title, details: details) { dismiss() }
        }
    }
}

struct EmptyState: View {
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        VStack(spacing: 9) {
            Image(systemName: icon)
                .font(.system(size: 25, weight: .medium))
                .foregroundStyle(OverHeadStyle.blue)
                .frame(width: 58, height: 58)
                .background(OverHeadStyle.blue.opacity(0.1), in: Circle())
            Text(title).font(.system(size: 17, weight: .bold, design: .rounded)).foregroundStyle(OverHeadStyle.ink)
            Text(detail).font(.system(size: 13)).foregroundStyle(OverHeadStyle.muted).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(24)
    }
}
