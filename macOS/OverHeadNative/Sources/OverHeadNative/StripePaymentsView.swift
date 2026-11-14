import AppKit
import SwiftUI

struct StripePaymentsView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var clientID = ""
    @State private var accountID = ""
    @State private var publishableKey = ""
    @State private var businessName = ""
    @State private var managerEmail = ""
    @State private var tier = "silver"
    @State private var paymentStatus = "trial"
    @State private var externalCustomerID = ""
    @State private var externalSubscriptionID = ""
    @State private var customerCount = "0"
    @State private var subscriptionCount = "0"
    @State private var invoiceCount = "0"
    @State private var paymentCount = "0"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Stripe Payments").font(.system(size: 28, weight: .bold, design: .rounded))
                billingCard
                HStack(alignment: .top, spacing: 16) {
                    connectionCard.frame(maxWidth: .infinity)
                    referenceCard.frame(maxWidth: .infinity)
                }
                savedDataCard
            }.padding(26)
        }
    }

    private var billingCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Shared OverHead billing").font(.system(size: 17, weight: .bold, design: .rounded))
            Text(store.billingSyncMessage).font(.system(size: 12)).foregroundStyle(.secondary)
            HStack {
                Label("Current plan: \(store.archive.activePlan.capitalized)", systemImage: "checkmark.seal").font(.system(size: 12, weight: .semibold))
                Spacer()
                Button {
                    Task { await store.syncSharedBilling() }
                } label: {
                    if store.isSyncingBilling { ProgressView().controlSize(.small) }
                    else { Label("Sync plan and license", systemImage: "arrow.clockwise") }
                }.buttonStyle(.borderedProminent).disabled(store.isSyncingBilling)
            }
            Text("This reads the same account entitlement used on the website. It does not authorize a merchant account or charge a card.").font(.system(size: 10)).foregroundStyle(.secondary)
        }.padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }

    private var connectionCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Test mode setup").font(.system(size: 16, weight: .bold, design: .rounded))
            Text("Stripe merchant charges stay disabled. Never enter secret keys or webhook secrets here.").font(.system(size: 11)).foregroundStyle(.secondary)
            LabeledField(title: "Client ID", value: $clientID, placeholder: "ca_…")
            LabeledField(title: "Account ID", value: $accountID, placeholder: "acct_…")
            LabeledField(title: "Test publishable key", value: $publishableKey, placeholder: "pk_test_…")
            HStack {
                Button("Open Stripe test dashboard", systemImage: "arrow.up.right.square") {
                    NSWorkspace.shared.open(URL(string: "https://dashboard.stripe.com/test/apikeys")!)
                }.buttonStyle(.bordered)
                Button("Save test details") { store.saveStripeTestConnection(clientID: clientID, accountID: accountID, publishableKey: publishableKey) }.buttonStyle(.borderedProminent)
            }
        }.padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }

    private var referenceCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Record Stripe reference data").font(.system(size: 16, weight: .bold, design: .rounded))
            Text("Imported values are review notes only. Verified server events control access.").font(.system(size: 11)).foregroundStyle(.secondary)
            LabeledField(title: "Business name", value: $businessName)
            LabeledField(title: "Manager email", value: $managerEmail)
            LabeledField(title: "Stripe customer ID", value: $externalCustomerID, placeholder: "cus_…")
            LabeledField(title: "Stripe subscription ID", value: $externalSubscriptionID, placeholder: "sub_…")
            HStack {
                Picker("Tier", selection: $tier) { Text("Silver").tag("silver"); Text("Gold").tag("gold"); Text("Black").tag("black") }
                Picker("Status", selection: $paymentStatus) { Text("Paid").tag("paid"); Text("Trial").tag("trial"); Text("Past due").tag("past_due"); Text("Canceled").tag("canceled") }
            }
            HStack {
                LabeledField(title: "Customers", value: $customerCount)
                LabeledField(title: "Subscriptions", value: $subscriptionCount)
            }
            HStack {
                LabeledField(title: "Invoices", value: $invoiceCount)
                LabeledField(title: "Payments", value: $paymentCount)
            }
            Button("Save reference") {
                store.importStripeReference(fields: [
                    "business_name": businessName, "account_id": accountID, "manager_email": managerEmail,
                    "tier": tier, "payment_status": paymentStatus, "external_customer_id": externalCustomerID,
                    "external_subscription_id": externalSubscriptionID, "customer_count": customerCount,
                    "subscription_count": subscriptionCount, "invoice_count": invoiceCount, "payment_count": paymentCount
                ])
            }.buttonStyle(.borderedProminent)
        }.padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }

    private var savedDataCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Saved Stripe data").font(.system(size: 16, weight: .bold, design: .rounded))
            Text("\(store.records("stripeConnections").count) connection · \(store.records("stripeImports").count) imported references · \(store.records("paymentRecords").count) payment records")
                .font(.system(size: 12)).foregroundStyle(.secondary)
            ForEach(store.records("stripeImports").prefix(5)) { record in
                HStack { Text(record["business_name"].nonEmpty ?? record["account_id"].nonEmpty ?? record.title); Spacer(); Text("\(record["payment_count"]) payments · \(record.status)").foregroundStyle(.secondary) }.font(.system(size: 11)).padding(.vertical, 4)
            }
            ForEach(store.records("billingActivity").prefix(5)) { event in
                HStack { Text(event.title); Spacer(); Text(event["details"]).foregroundStyle(.secondary) }.font(.system(size: 11)).padding(.vertical, 4)
            }
        }.padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }
}

struct LabeledField: View {
    let title: String
    @Binding var value: String
    var placeholder = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
            TextField(placeholder, text: $value).textFieldStyle(.roundedBorder)
        }
    }
}
