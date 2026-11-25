import SwiftUI
import UniformTypeIdentifiers

struct BillingHomeView: View {
    @Environment(BillingModel.self) private var model
    @State private var showingExporter = false
    @State private var exportData = Data()
    @State private var exportName = "OverHead-License.json"

    private let plans: [BillingPlanDetails] = [
        .init(tier: "silver", price: "$59 / month", description: "Core office control for a solo owner or lean front desk.", inclusions: ["1 owner profile", "250 customers", "Task queue", "Backups", "Support bundle"]),
        .init(tier: "gold", price: "$129 / month", description: "Workflow and role depth for a busy service office.", inclusions: ["3 staff profiles", "1,500 customers", "Workflow automation", "Legal center", "Priority support"]),
        .init(tier: "black", price: "$299 / month", description: "Higher-volume protection, recovery, and access controls.", inclusions: ["10 staff profiles", "10,000 customers", "Encrypted local store", "Audit ledger", "Concierge setup"])
    ]

    var body: some View {
        @Bindable var bindableModel = model
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "creditcard.and.123").font(.system(size: 22, weight: .semibold)).foregroundStyle(Color(red: 0.57, green: 0.52, blue: 1))
                VStack(alignment: .leading, spacing: 2) {
                    Text("OverHead Billing").font(.system(size: 21, weight: .bold, design: .rounded))
                    Text("SUBSCRIBER PLANS · BILLING · LICENSING").font(.system(size: 9, weight: .bold)).tracking(1.2).foregroundStyle(.secondary)
                }
                Spacer()
                Label(model.integrityFailure ? "Integrity check failed" : "Encrypted · authenticated", systemImage: model.integrityFailure ? "exclamationmark.shield.fill" : "checkmark.shield.fill")
                    .foregroundStyle(model.integrityFailure ? .red : .green).font(.system(size: 11, weight: .medium))
                Button { model.refresh() } label: { Image(systemName: "arrow.clockwise") }.help("Refresh saved records")
            }.padding(20).background(.ultraThinMaterial)

            if !model.storageMessage.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: model.integrityFailure ? "exclamationmark.triangle.fill" : "lock.fill")
                    Text(model.storageMessage).font(.system(size: 11))
                    Spacer()
                }.foregroundStyle(model.integrityFailure ? .red : .secondary).padding(.horizontal, 22).padding(.top, 10)
            }

            HStack(alignment: .top, spacing: 18) {
                VStack(alignment: .leading, spacing: 16) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Subscriber details").font(.system(size: 17, weight: .bold, design: .rounded))
                            field("Customer / workspace", text: $bindableModel.customer, placeholder: "Workspace identifier or name")
                            field("Subscriber name", text: $bindableModel.archive.subscriber.name, placeholder: "Account owner")
                            field("Company or business name", text: $bindableModel.archive.subscriber.businessName, placeholder: "Registered business")
                            field("DBA", text: $bindableModel.archive.subscriber.dba, placeholder: "Doing business as")
                            field("Email", text: $bindableModel.archive.subscriber.email, placeholder: "billing@example.com")
                            field("Phone", text: $bindableModel.archive.subscriber.phone, placeholder: "+1 555 555 0100")
                            field("Address", text: $bindableModel.archive.subscriber.addressLine1, placeholder: "Street address")
                            field("Address line 2", text: $bindableModel.archive.subscriber.addressLine2, placeholder: "Suite, unit, etc.")
                            HStack(spacing: 8) {
                                field("City", text: $bindableModel.archive.subscriber.city, placeholder: "City")
                                field("State / region", text: $bindableModel.archive.subscriber.region, placeholder: "State")
                            }
                            HStack(spacing: 8) {
                                field("Postal code", text: $bindableModel.archive.subscriber.postalCode, placeholder: "ZIP")
                                field("Country", text: $bindableModel.archive.subscriber.country, placeholder: "Country")
                            }
                            Divider().padding(.vertical, 3)
                            Text("Plan billing record").font(.system(size: 15, weight: .bold, design: .rounded))
                            VStack(alignment: .leading, spacing: 5) {
                                caption("TIER")
                                Picker("Tier", selection: $bindableModel.selectedTier) { ForEach(plans) { Text($0.tier.capitalized).tag($0.tier) } }.labelsHidden()
                            }
                            field("Amount (USD)", text: $bindableModel.amount, placeholder: "e.g. 129.00")
                            field("License key (optional)", text: $bindableModel.licenseKey, placeholder: "Auto-generate if empty")
                            HStack {
                                Button("Record plan billing") { model.add("Plan billing") }.buttonStyle(.borderedProminent).disabled(model.customer.trimmingCharacters(in: .whitespaces).isEmpty)
                                Button("Issue auto-license") { issueLicense() }.buttonStyle(.bordered).disabled(model.customer.trimmingCharacters(in: .whitespaces).isEmpty)
                            }
                            if !model.formMessage.isEmpty {
                                Text(model.formMessage).font(.system(size: 10)).foregroundStyle(model.formMessage.hasPrefix("Enter") || model.formMessage.contains("already") ? .orange : .secondary)
                            }
                            Text("This module is only for OverHead subscriber plans. Subscriber customer invoices and payments remain outside this module. PII is saved in the encrypted billing archive.")
                                .font(.system(size: 10)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(16).frame(width: 340).frame(maxHeight: .infinity, alignment: .topLeading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.primary.opacity(0.1)))

                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Plan & subscription").font(.system(size: 17, weight: .bold, design: .rounded))
                        Spacer()
                        Button { model.refresh() } label: { Image(systemName: "arrow.clockwise") }.help("Refresh billing details")
                    }
                    currentPlanCard
                    subscriberSummary
                    Text("Billing history & licenses").font(.system(size: 16, weight: .bold, design: .rounded))
                    if model.archive.entries.isEmpty {
                        ContentUnavailableView("No records yet", systemImage: "tray", description: Text("Subscriber plan activity and licenses will appear here."))
                            .frame(maxWidth: .infinity, minHeight: 100)
                    } else {
                        List {
                            ForEach(model.archive.entries) { entry in
                                HStack(spacing: 12) {
                                    Image(systemName: entry.category == "License" ? "checkmark.seal.fill" : "arrow.left.arrow.right.circle.fill").foregroundStyle(entry.category == "License" ? .purple : .blue)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(entry.customer).font(.system(size: 12, weight: .semibold))
                                        Text("\(entry.category) · \(entry.tier.capitalized) · \(entry.billingType) · \(entry.status)").font(.system(size: 10)).foregroundStyle(.secondary)
                                        if !entry.licenseKey.isEmpty { Text(entry.licenseKey).font(.system(size: 9, design: .monospaced)).foregroundStyle(.secondary).textSelection(.enabled) }
                                    }
                                    Spacer()
                                    if !entry.amount.isEmpty { Text(entry.amount).font(.system(size: 11, weight: .medium)) }
                                    if entry.category == "License" {
                                        Button("Export") { export(entry) }.buttonStyle(.bordered).controlSize(.small)
                                    }
                                }.padding(.vertical, 4)
                            }
                        }.listStyle(.inset)
                    }
                    Text("Last checked by Billing module \(model.entitlement.checkedAt.isEmpty ? "Never" : model.entitlement.checkedAt)")
                        .font(.system(size: 10)).foregroundStyle(.secondary)
                }.padding(18).frame(maxWidth: .infinity, maxHeight: .infinity).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.primary.opacity(0.1)))
            }.padding(18).frame(maxWidth: .infinity, maxHeight: .infinity).disabled(model.integrityFailure)
        }
        .background(Color(nsColor: .underPageBackgroundColor))
        .onChange(of: model.archive.subscriber) { _, _ in model.save() }
        .fileExporter(isPresented: $showingExporter, document: LicenseDocument(data: exportData), contentType: .json, defaultFilename: exportName) { _ in }
    }

    private var currentPlanCard: some View {
        let plan = plans.first(where: { $0.tier == model.entitlement.tier }) ?? plans[0]
        let verifiedPlan = model.entitlement.plan
        let displayedPrice = verifiedPlan?.formattedPrice ?? plan.price
        let description = verifiedPlan.map { $0.description.isEmpty ? plan.description : $0.description } ?? plan.description
        let inclusions = verifiedPlan.map { $0.inclusions.isEmpty ? plan.inclusions : $0.inclusions } ?? plan.inclusions
        let isEntitled = ["active", "trialing", "past_due"].contains(model.entitlement.status.lowercased())
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(plan.tier.capitalized).font(.system(size: 20, weight: .bold, design: .rounded))
                Text(displayedPrice).font(.system(size: 13, weight: .semibold)).foregroundStyle(.secondary)
                Spacer()
                Text(model.entitlement.status.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.system(size: 10, weight: .bold)).padding(.horizontal, 9).padding(.vertical, 5)
                    .foregroundStyle(isEntitled ? .green : .orange)
                    .background((isEntitled ? Color.green : Color.orange).opacity(0.12), in: Capsule())
            }
            Text(description).font(.system(size: 11)).foregroundStyle(.secondary)
            HStack(alignment: .top, spacing: 8) {
                Text("INCLUDES").font(.system(size: 9, weight: .bold)).tracking(0.7).foregroundStyle(.secondary).padding(.top, 2)
                Text(inclusions.joined(separator: " · ")).font(.system(size: 10)).foregroundStyle(.secondary)
            }
            HStack(spacing: 16) {
                Label(model.entitlement.billingType, systemImage: "calendar")
                if !model.entitlement.customerID.isEmpty { Text("Stripe customer: \(model.entitlement.customerID)").textSelection(.enabled) }
                if !model.entitlement.subscriptionID.isEmpty { Text("Subscription: \(model.entitlement.subscriptionID)").textSelection(.enabled) }
            }.font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
            if !model.entitlement.trialEndsAt.isEmpty {
                Text("Trial ends \(model.entitlement.trialEndsAt)").font(.system(size: 10)).foregroundStyle(.secondary)
            }
        }.padding(14).frame(maxWidth: .infinity, alignment: .leading).background(Color.primary.opacity(0.035), in: RoundedRectangle(cornerRadius: 12))
    }

    private var subscriberSummary: some View {
        let person = model.archive.subscriber
        let address = [person.addressLine1, person.addressLine2, person.city, person.region, person.postalCode, person.country].filter { !$0.isEmpty }.joined(separator: ", ")
        return VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text(person.name.isEmpty ? "Subscriber name not added" : person.name).font(.system(size: 12, weight: .semibold))
                if !person.businessName.isEmpty { Text("· \(person.businessName)").font(.system(size: 11)).foregroundStyle(.secondary) }
                if !person.dba.isEmpty { Text("DBA \(person.dba)").font(.system(size: 10)).foregroundStyle(.secondary) }
            }
            Text([person.email, person.phone, address].filter { !$0.isEmpty }.joined(separator: "  ·  "))
                .font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(2)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 2)
    }

    private func issueLicense() {
        if model.licenseKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            model.licenseKey = "OH-\(UUID().uuidString.uppercased())"
        }
        model.add("License")
    }

    private func export(_ entry: BillingEntry) {
        let payload: [String: Any] = ["product": "OverHead", "customer": entry.customer, "tier": entry.tier, "licenseKey": entry.licenseKey, "issuedAt": ISO8601DateFormatter().string(from: entry.date), "formatVersion": 1]
        exportData = (try? JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])) ?? Data()
        exportName = "OverHead-License-\(entry.tier.capitalized).json"
        showingExporter = true
    }

    private func caption(_ text: String) -> some View { Text(text).font(.system(size: 9, weight: .bold)).tracking(0.8).foregroundStyle(.secondary) }
    private func field(_ label: String, text: Binding<String>, placeholder: String, secure: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 5) { caption(label.uppercased()); TextField(placeholder, text: text).textFieldStyle(.roundedBorder) }
    }
}

private struct BillingPlanDetails: Identifiable {
    var tier: String
    var price: String
    var description: String
    var inclusions: [String]
    var id: String { tier }
}

struct LicenseDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}
