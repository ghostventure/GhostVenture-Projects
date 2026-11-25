import SwiftUI

struct PlansWorkspaceView: View {
    @Environment(OverHeadStore.self) private var store

    private let plans: [(id: String, name: String, price: String, summary: String, features: [String])] = [
        ("silver", "Silver", "$59 / month", "Core office control for a solo owner or lean front desk.", ["1 owner profile", "250 customers", "Task queue", "Backups", "Support bundle"]),
        ("gold", "Gold", "$129 / month", "Workflow and role depth for a busy service office.", ["3 staff profiles", "1,500 customers", "Workflow automation", "Legal center", "Priority support"]),
        ("black", "Black", "$299 / month", "Higher-volume protection, recovery, and access controls.", ["10 staff profiles", "10,000 customers", "Encrypted local store", "Audit ledger", "Concierge setup"])
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Plans and access").font(.system(size: 28, weight: .bold, design: .rounded))
                HStack(alignment: .top, spacing: 12) {
                    ForEach(plans, id: \.id) { plan in planCard(plan) }
                }
                trialPanel
                billingPanel
            }.padding(26)
        }
    }

    private func planCard(_ plan: (id: String, name: String, price: String, summary: String, features: [String])) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack { Text(plan.name).font(.system(size: 16, weight: .bold)); Spacer(); if plan.id == store.archive.activePlan { StatusBadge(text: "CURRENT") } }
            Text(plan.price).font(.system(size: 22, weight: .bold, design: .rounded))
            Text(plan.summary).font(.system(size: 11)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            ForEach(plan.features, id: \.self) { feature in Label(feature, systemImage: "checkmark").font(.system(size: 10)).foregroundStyle(.secondary) }
            Button(plan.id == store.archive.activePlan ? "Current plan · Manage" : "Manage in Billing") {
                BillingModuleLauncher.open()
            }.buttonStyle(.borderedProminent).disabled(!store.canManageWorkspace)
        }.padding(15).frame(maxWidth: .infinity, minHeight: 260, alignment: .topLeading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(plan.id == store.archive.activePlan ? OHStyle.blue.opacity(0.5) : OHStyle.line))
    }

    private var trialPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Trial and subscription management").font(.system(size: 17, weight: .bold, design: .rounded))
            Text("Manage plan changes, billing activity, and license issuance in the separate OverHead Billing module.").font(.system(size: 12)).foregroundStyle(.secondary)
            Button("Open Billing & Licensing") { BillingModuleLauncher.open() }.buttonStyle(.borderedProminent).disabled(!store.canManageWorkspace)
            if let policy = store.records("legalDocuments").first(where: { $0.title == "Free Trial Policy" }) {
                Text(policy["body"]).font(.system(size: 10)).foregroundStyle(.secondary).textSelection(.enabled)
            }
        }.padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }

    private var billingPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Billing records").font(.system(size: 17, weight: .bold, design: .rounded))
            ForEach(store.records("subscriptions")) { subscription in
                HStack { Text(subscription.title); Spacer(); Text("\(subscription["tier"].uppercased()) · \(subscription["payment_status"])").foregroundStyle(.secondary) }.font(.system(size: 11))
            }
            Button("Open Billing module") { BillingModuleLauncher.open() }.buttonStyle(.bordered)
            Text("This screen is read-only. Plan transactions and payment records are handled in the billing module.").font(.system(size: 10)).foregroundStyle(.secondary)
        }.padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }
}
