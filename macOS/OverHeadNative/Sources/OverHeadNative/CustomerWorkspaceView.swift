import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct CustomerWorkspaceView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var search = ""
    @State private var selectedID = ""
    @State private var showingNew = false
    @State private var editingCustomer: WorkspaceRecord?
    @State private var editingWorkflow: WorkspaceRecord?
    @State private var showingCSV = false

    private var customers: [WorkspaceRecord] {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return store.customers }
        return store.customers.filter { record in
            record.fields.values.contains { $0.localizedCaseInsensitiveContains(query) }
        }
    }
    private var selected: WorkspaceRecord? { store.customers.first(where: { $0.id == selectedID }) ?? customers.first }
    private var customerID: String { selected?.id ?? "" }
    private var documents: [WorkspaceRecord] { store.records("customerDocuments").filter { $0["customer_id"] == customerID } }
    private var history: [WorkspaceRecord] { store.records("serviceHistory").filter { $0["customer_id"] == customerID } }
    private var workflow: WorkspaceRecord? { store.records("workflowPreferences").first { $0["customer_id"] == customerID } }

    var body: some View {
        HStack(spacing: 0) {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("Search customers", text: $search).textFieldStyle(.plain)
                }
                .padding(10).background(OHStyle.canvas, in: RoundedRectangle(cornerRadius: 8)).padding(12)
                List {
                    ForEach(customers) { customer in
                        Button { selectedID = customer.id } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(store.privacyMode ? "Private customer" : customer.title).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                                Text([customer["industry"], customer["service_area"]].filter { !$0.isEmpty }.joined(separator: " · ").nonEmpty ?? "Customer record")
                                    .font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
                            }.padding(.vertical, 4).frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                    }
                }.listStyle(.sidebar)
                HStack { Text("\(customers.count) customer\(customers.count == 1 ? "" : "s")").font(.system(size: 10)).foregroundStyle(.secondary); Spacer(); Button { showingCSV = true } label: { Image(systemName: "square.and.arrow.down") }.buttonStyle(.plain).help("Import customer CSV") }
                    .padding(.horizontal, 14).padding(.vertical, 10)
            }
            .frame(width: 265).background(OHStyle.sidebar)
            Divider()
            detailPane
        }
        .toolbar {
            ToolbarItem { Button { showingNew = true } label: { Label("New Customer", systemImage: "plus") }.buttonStyle(.borderedProminent) }
        }
        .sheet(isPresented: $showingNew) { RecordEditorSheet(collection: "customers", title: "New customer") }
        .sheet(item: $editingCustomer) { customer in RecordEditorSheet(collection: "customers", title: "Edit customer", record: customer) }
        .sheet(item: $editingWorkflow) { rule in RecordEditorSheet(collection: "workflowPreferences", title: "Edit customer workflow rules", record: rule) }
        .fileImporter(isPresented: $showingCSV, allowedContentTypes: [.commaSeparatedText, .plainText], allowsMultipleSelection: false) { result in
            do {
                guard let url = try result.get().first else { return }
                let accessed = url.startAccessingSecurityScopedResource()
                defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                let imported = try store.importCSV(Data(contentsOf: url), into: "customers")
                store.notice = "Imported \(imported) customer record\(imported == 1 ? "" : "s"). Review each record before outreach."
            } catch { store.errorMessage = error.localizedDescription }
        }
        .onAppear { if selectedID.isEmpty { selectedID = store.customers.first?.id ?? "" } }
        .onChange(of: store.customers.count) { _, _ in if selected == nil { selectedID = store.customers.first?.id ?? "" } }
    }

    @ViewBuilder private var detailPane: some View {
        if let customer = selected {
            ScrollView {
                VStack(alignment: .leading, spacing: 19) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(store.privacyMode ? "Private customer" : customer.title).font(.system(size: 27, weight: .bold, design: .rounded))
                            HStack(spacing: 8) { StatusBadge(text: customer.status); if let industry = customer["industry"].nonEmpty { Text(industry).font(.system(size: 11)).foregroundStyle(.secondary) } }
                        }
                        Spacer()
                        Menu {
                            Button("Apply Intake Control", systemImage: "list.clipboard") { store.applyCustomerPlaybook(customer, template: "intake-control") }
                            Button("Apply Quote Approval", systemImage: "checkmark.seal") { store.applyCustomerPlaybook(customer, template: "quote-approval") }
                            Button("Apply Payment Follow-up", systemImage: "creditcard") { store.applyCustomerPlaybook(customer, template: "payment-followup") }
                        } label: { Label("Apply playbook", systemImage: "point.3.connected.trianglepath.dotted") }.buttonStyle(.bordered)
                        Button { editingCustomer = customer } label: { Label("Edit", systemImage: "pencil") }.buttonStyle(.bordered)
                        Menu {
                            Button("Attach customer document…", systemImage: "paperclip") { attachDocument(customer) }
                            Button("Create customer portal invitation", systemImage: "person.badge.plus") { Task { await store.createCustomerPortalInvite(for: customer) } }
                        } label: { Image(systemName: "ellipsis.circle").font(.system(size: 16)) }.menuStyle(.borderlessButton)
                    }

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        CustomerInfoCard(label: "Owner", value: mask(customer["owner_name"]))
                        CustomerInfoCard(label: "Email", value: mask(customer["email"]))
                        CustomerInfoCard(label: "Phone", value: mask(customer["phone"]))
                        CustomerInfoCard(label: "Service area", value: customer["service_area"].nonEmpty ?? "Not set")
                        CustomerInfoCard(label: "Preferred contact", value: customer["preferred_contact"].nonEmpty ?? "Not set")
                        CustomerInfoCard(label: "Time zone", value: customer["timezone"].nonEmpty ?? "Not set")
                    }

                    if let workflow {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack { VStack(alignment: .leading, spacing: 3) { Text("Customer operating rules").font(.system(size: 16, weight: .bold, design: .rounded)); Text("Human review \(workflow["human_review_required"] == "No" ? "not required" : "required") · \(workflow["playbook"].replacingOccurrences(of: "-", with: " ").capitalized)").font(.system(size: 10)).foregroundStyle(.secondary) }; Spacer(); Button("Edit rules") { editingWorkflow = workflow }.buttonStyle(.bordered) }
                            RuleRow(label: "Scheduling", value: workflow["booking_rules"])
                            RuleRow(label: "Customer answers", value: workflow["answer_tone"])
                            RuleRow(label: "Quotes", value: workflow["quote_rules"])
                            RuleRow(label: "Invoices", value: workflow["invoice_rules"])
                            RuleRow(label: "Follow-up", value: workflow["followup_rules"])
                        }
                        .padding(17).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
                    }

                    HStack(alignment: .top, spacing: 15) {
                        RecordCollectionCard(title: "Service history", icon: "clock.arrow.circlepath", records: history, empty: "Service events will appear here.")
                        RecordCollectionCard(title: "Documents", icon: "doc.text", records: documents, empty: "Attach a customer document.") { record in store.openCustomerDocument(record) }
                    }
                }
                .padding(24)
            }
        } else {
            ContentUnavailableView("Select a customer", systemImage: "person.crop.circle", description: Text("Create or select a customer to review their profile and service rules."))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func mask(_ value: String) -> String {
        guard !store.privacyMode else { return value.isEmpty ? "Not set" : "Hidden in privacy mode" }
        return value.nonEmpty ?? "Not set"
    }

    private func attachDocument(_ customer: WorkspaceRecord) {
        let panel = NSOpenPanel(); panel.canChooseFiles = true; panel.canChooseDirectories = false; panel.allowsMultipleSelection = false
        panel.allowedContentTypes = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "png", "jpg", "jpeg"].compactMap { UTType(filenameExtension: $0) }
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do { try store.attachCustomerDocument(url, customer: customer) }
        catch { store.errorMessage = error.localizedDescription }
    }
}

private struct CustomerInfoCard: View {
    let label: String; let value: String
    var body: some View { VStack(alignment: .leading, spacing: 6) { Text(label.uppercased()).font(.system(size: 9, weight: .bold)).tracking(0.6).foregroundStyle(.secondary); Text(value).font(.system(size: 12, weight: .medium)).lineLimit(2) }.frame(maxWidth: .infinity, alignment: .leading).padding(13).background(.background, in: RoundedRectangle(cornerRadius: 10)).overlay(RoundedRectangle(cornerRadius: 10).stroke(OHStyle.line)) }
}

private struct RuleRow: View {
    let label: String; let value: String
    var body: some View { HStack(alignment: .top, spacing: 12) { Text(label).font(.system(size: 10, weight: .semibold)).frame(width: 115, alignment: .leading); Text(value.isEmpty ? "No rule set." : value).font(.system(size: 11)).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading) } }
}

private struct RecordCollectionCard: View {
    let title: String; let icon: String; let records: [WorkspaceRecord]; let empty: String; var open: ((WorkspaceRecord) -> Void)? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(title, systemImage: icon).font(.system(size: 13, weight: .bold))
            if records.isEmpty { Text(empty).font(.system(size: 10)).foregroundStyle(.secondary).frame(maxWidth: .infinity, minHeight: 54, alignment: .leading) }
            ForEach(records.prefix(4)) { record in
                Button { open?(record) } label: { HStack { VStack(alignment: .leading, spacing: 3) { Text(record.title).font(.system(size: 11, weight: .semibold)); Text(record["details"].nonEmpty ?? record["document_type"]).font(.system(size: 9)).foregroundStyle(.secondary).lineLimit(1) }; Spacer(); StatusBadge(text: record.status) } }.buttonStyle(.plain)
            }
        }
        .padding(15).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(OHStyle.line))
    }
}
