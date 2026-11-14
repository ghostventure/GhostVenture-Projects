import SwiftUI

struct MicrosoftImportView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var provider = "graph"
    @State private var clientID = ""
    @State private var tenantID = "organizations"
    @State private var environment = "Production"
    @State private var companyID = ""
    @State private var selectedIDs = Set<String>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Import from Microsoft").font(.system(size: 28, weight: .bold, design: .rounded))
                Text("Connect Microsoft 365 contacts or Business Central customers. Preview first, then choose which records to save locally.")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
                connectPanel
                if !store.records("microsoftConnections").isEmpty { connectionsPanel }
                if !store.microsoftCompanies.isEmpty { companyPicker }
                if !store.microsoftPreviewContacts.isEmpty { contactsPanel }
            }.padding(26)
        }
    }

    private var connectPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Connect an account").font(.system(size: 17, weight: .bold, design: .rounded))
            HStack {
                Picker("Source", selection: $provider) {
                    Text("Microsoft 365 contacts").tag("graph")
                    Text("Business Central customers").tag("business_central")
                }
                Picker("Environment", selection: $environment) {
                    Text("Production").tag("Production")
                    Text("Sandbox").tag("Sandbox")
                }.disabled(provider != "business_central")
            }
            TextField("Application (client) ID", text: $clientID).textFieldStyle(.roundedBorder)
            TextField("Tenant ID or domain", text: $tenantID).textFieldStyle(.roundedBorder)
            Button {
                Task { await store.connectMicrosoft(clientID: clientID.trimmingCharacters(in: .whitespacesAndNewlines), tenantID: tenantID.trimmingCharacters(in: .whitespacesAndNewlines), provider: provider, environment: environment) }
            } label: {
                if store.isConnectingMicrosoft { Label("Waiting for Microsoft…", systemImage: "hourglass") }
                else { Label("Connect Microsoft", systemImage: "person.badge.key") }
            }.buttonStyle(.borderedProminent).disabled(store.isConnectingMicrosoft || clientID.isEmpty)
            if !store.microsoftUserCode.isEmpty {
                HStack(spacing: 14) {
                    Text(store.microsoftUserCode).font(.system(size: 24, weight: .bold, design: .monospaced)).textSelection(.enabled)
                    if let url = store.microsoftVerificationURL { Link("Open sign-in page", destination: url) }
                }
            }
            if !store.microsoftProgress.isEmpty { Text(store.microsoftProgress).font(.system(size: 11)).foregroundStyle(.secondary) }
            Text("Microsoft may require administrator approval for read-only access.").font(.system(size: 10)).foregroundStyle(.secondary)
        }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }

    private var connectionsPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Connections").font(.system(size: 17, weight: .bold, design: .rounded))
            ForEach(store.records("microsoftConnections")) { connection in
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(connection.title).font(.system(size: 13, weight: .semibold))
                        Text("\(connection["environment"]) · \(connection["tenant_id"]) · \(connection["status"])").font(.system(size: 10)).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Preview") { Task { await store.previewMicrosoftImport(connection: connection) } }.buttonStyle(.bordered)
                }.padding(10).background(.background, in: RoundedRectangle(cornerRadius: 9))
            }
        }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }

    private var companyPicker: some View {
        HStack {
            Picker("Business Central company", selection: $companyID) {
                Text("Choose a company").tag("")
                ForEach(store.microsoftCompanies, id: \.id) { Text($0.name).tag($0.id) }
            }.frame(maxWidth: 360)
            Button("Preview customers") {
                guard let connection = store.records("microsoftConnections").first(where: { $0.id == store.microsoftPreviewConnectionID }) else { return }
                Task { await store.previewMicrosoftImport(connection: connection, companyID: companyID) }
            }.disabled(companyID.isEmpty)
        }.padding(14).background(.background, in: RoundedRectangle(cornerRadius: 12))
    }

    private var contactsPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Preview · \(store.microsoftPreviewContacts.count) records").font(.system(size: 17, weight: .bold, design: .rounded))
                Spacer()
                Button("Select all") { selectedIDs = Set(store.microsoftPreviewContacts.map(\.id)) }
                Button("Import selected (\(selectedIDs.count))") {
                    store.importMicrosoftPreview(selectedIDs: selectedIDs)
                    selectedIDs.removeAll()
                }.buttonStyle(.borderedProminent).disabled(selectedIDs.isEmpty)
            }
            Text("Imports create local customer records. No outreach is sent.").font(.system(size: 11)).foregroundStyle(.secondary)
            ForEach(store.microsoftPreviewContacts) { contact in contactRow(contact) }
        }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }

    private func contactRow(_ contact: MicrosoftContact) -> some View {
        Toggle(isOn: Binding(get: { selectedIDs.contains(contact.id) }, set: { if $0 { selectedIDs.insert(contact.id) } else { selectedIDs.remove(contact.id) } })) {
            VStack(alignment: .leading, spacing: 3) {
                Text(contact.businessName).font(.system(size: 13, weight: .semibold))
                Text([contact.ownerName, contact.email, contact.serviceArea].filter { !$0.isEmpty }.joined(separator: " · ")).font(.system(size: 11)).foregroundStyle(.secondary)
            }
        }.toggleStyle(.checkbox).padding(8)
    }
}
