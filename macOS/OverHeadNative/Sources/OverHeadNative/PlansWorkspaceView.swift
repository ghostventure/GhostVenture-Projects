import SwiftUI

struct PlansWorkspaceView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var acceptedTrialPolicy = false

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
            Button(plan.id == store.archive.activePlan ? "Current plan" : "Request plan change") {
                store.requestApproval(title: "Change plan to \(plan.name)", details: "Review plan capacity, pricing, recurring billing terms, and owner authorization before changing access.", actionType: "billing_change")
                if store.canManageWorkspace { store.notice = "Plan change recorded for review. No charge or access change was created." }
            }.buttonStyle(.bordered).disabled(plan.id == store.archive.activePlan)
        }.padding(15).frame(maxWidth: .infinity, minHeight: 260, alignment: .topLeading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(plan.id == store.archive.activePlan ? OHStyle.blue.opacity(0.5) : OHStyle.line))
    }

    private var trialPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Free 30-day Gold trial").font(.system(size: 17, weight: .bold, design: .rounded))
            Text("One per workspace. No card is required and no charge is made. Trial access expires automatically.").font(.system(size: 12)).foregroundStyle(.secondary)
            Toggle("I have reviewed and accept the Free Trial Policy.", isOn: $acceptedTrialPolicy).toggleStyle(.checkbox)
            Button("Start free Gold trial") { Task { await store.createFreeTrial(acceptedPolicy: acceptedTrialPolicy) } }
                .buttonStyle(.borderedProminent).disabled(!acceptedTrialPolicy || !store.canManageWorkspace)
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
            HStack { Button("Open Stripe payments") { store.selectedSection = .payments }.buttonStyle(.bordered); Button("Edit billing profile") { store.selectedSection = .settings; store.notice = "Open Settings → Plans to review billing profile details." }.buttonStyle(.bordered) }
            Text("Paid checkout and subscription changes must be confirmed by the secure shared billing service. This native screen records requests and starts the no-card trial.").font(.system(size: 10)).foregroundStyle(.secondary)
        }.padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }
}
