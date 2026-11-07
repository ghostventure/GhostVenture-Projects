import SwiftUI

struct CustomersView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var searchText = ""
    @State private var showingAddCustomer = false

    private var filteredCustomers: [Customer] {
        guard !searchText.isEmpty else { return store.customers }
        return store.customers.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
                || $0.email.localizedCaseInsensitiveContains(searchText)
                || $0.phone.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if store.customers.isEmpty && !store.isLoading {
                    EmptyState(icon: "person.2", title: "No customers yet", detail: "Add a customer to keep their contact details close while you work.")
                        .padding(.horizontal, 28)
                } else {
                    List {
                        if !filteredCustomers.isEmpty {
                            Section("\(filteredCustomers.count) customers") {
                                ForEach(filteredCustomers) { customer in
                                    NavigationLink(value: customer) {
                                        CustomerRow(customer: customer)
                                    }
                                    .listRowBackground(Color.white)
                                }
                            }
                        }
                    }
                    .scrollContentBackground(.hidden)
                    .background(OverHeadStyle.canvas)
                    .overlay {
                        if store.isLoading && store.customers.isEmpty {
                            ProgressView("Loading customers…")
                        } else if !searchText.isEmpty && filteredCustomers.isEmpty {
                            EmptyState(icon: "magnifyingglass", title: "No matches", detail: "Try a different name, email, or phone number.")
                                .padding(.horizontal, 34)
                        }
                    }
                }
            }
            .background(OverHeadStyle.canvas.ignoresSafeArea())
            .navigationTitle("Customers")
            .navigationDestination(for: Customer.self) { customer in
                CustomerDetailView(customer: customer)
            }
            .searchable(text: $searchText, prompt: "Find a customer")
            .refreshable { await store.refresh() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingAddCustomer = true } label: {
                        Label("Add customer", systemImage: "plus")
                    }
                    .accessibilityHint("Create a customer record in this OverHead workspace")
                }
            }
            .sheet(isPresented: $showingAddCustomer) { AddCustomerSheet() }
        }
    }
}

private struct CustomerRow: View {
    let customer: Customer

    var body: some View {
        HStack(spacing: 13) {
            Text(customer.initials.isEmpty ? "?" : customer.initials)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(OverHeadStyle.blue)
                .frame(width: 42, height: 42)
                .background(OverHeadStyle.blue.opacity(0.1), in: Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(customer.name).font(.system(size: 15, weight: .semibold)).foregroundStyle(OverHeadStyle.ink)
                if !customer.email.isEmpty || !customer.phone.isEmpty {
                    Text(customer.email.isEmpty ? customer.phone : customer.email)
                        .font(.system(size: 12)).foregroundStyle(OverHeadStyle.muted).lineLimit(1)
                } else {
                    Text("No contact details")
                        .font(.system(size: 12)).foregroundStyle(OverHeadStyle.muted)
                }
                Text(customer.detail).font(.system(size: 11, weight: .medium)).foregroundStyle(OverHeadStyle.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 5)
        .contentShape(Rectangle())
    }
}

private struct CustomerDetailView: View {
    let customer: Customer
    @State private var activeAction: CustomerAction?

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text(customer.name).font(.system(size: 24, weight: .bold, design: .rounded)).foregroundStyle(OverHeadStyle.ink)
                    Text(customer.detail.isEmpty ? "Customer" : customer.detail).font(.system(size: 14)).foregroundStyle(OverHeadStyle.muted)
                }
                .padding(.vertical, 8)
                .listRowBackground(Color.white)
            }
            Section("Contact") {
                if customer.email.isEmpty && customer.phone.isEmpty {
                    Label("No contact details yet", systemImage: "person.crop.circle.badge.questionmark")
                        .foregroundStyle(OverHeadStyle.muted)
                }
                if !customer.email.isEmpty, let url = URL(string: "mailto:\(customer.email)") {
                    Link(destination: url) { Label(customer.email, systemImage: "envelope") }
                }
                if !customer.phone.isEmpty, let url = URL(string: "tel:\(customer.phone.filter { $0.isNumber || $0 == "+" })") {
                    Link(destination: url) { Label("Call \(customer.phone)", systemImage: "phone") }
                    if let messageURL = URL(string: "sms:\(customer.phone.filter { $0.isNumber || $0 == "+" })") {
                        Link(destination: messageURL) { Label("Message \(customer.name)", systemImage: "message") }
                    }
                }
            }
            Section("Quick actions") {
                Button { activeAction = .task } label: { Label("Add a task for \(customer.name)", systemImage: "plus.circle") }
                Button { activeAction = .update } label: { Label("Log an update", systemImage: "square.and.pencil") }
            }
            Section {
                Label("Customer details are shared with your OverHead workspace.", systemImage: "person.2")
                    .font(.system(size: 12)).foregroundStyle(OverHeadStyle.muted)
            }
        }
        .scrollContentBackground(.hidden)
        .background(OverHeadStyle.canvas)
        .navigationTitle("Customer")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $activeAction) { action in
            switch action {
            case .task: AddTaskSheet(customerId: customer.id)
            case .update: QuickNoteSheet(customerId: customer.id)
            }
        }
    }
}

private enum CustomerAction: String, Identifiable {
    case task, update
    var id: String { rawValue }
}

private struct AddCustomerSheet: View {
    @Environment(OverHeadStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Customer details") {
                    TextField("Name", text: $name)
                        .textContentType(.name)
                        .textInputAutocapitalization(.words)
                    TextField("Email (optional)", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Phone (optional)", text: $phone)
                        .textContentType(.telephoneNumber)
                        .keyboardType(.phonePad)
                }
                Section {
                    Label("This record will be available to your workspace team.", systemImage: "icloud")
                        .font(.system(size: 12)).foregroundStyle(OverHeadStyle.muted)
                }
            }
            .navigationTitle("Add customer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(store.isLoading ? "Saving…" : "Save") { save() }
                        .disabled(store.isLoading || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func save() {
        Task {
            if await store.addCustomer(name: name, email: email, phone: phone) { dismiss() }
        }
    }
}
