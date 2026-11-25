import SwiftUI

struct StripePaymentsView: View {
    @Environment(OverHeadStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Billing & licensing").font(.system(size: 28, weight: .bold, design: .rounded))
            Text("Plan billing, Stripe payment references, and license issuance are managed in the separate OverHead Billing module.")
                .font(.system(size: 13)).foregroundStyle(.secondary)
            Button("Open OverHead Billing") { BillingModuleLauncher.open() }
                .buttonStyle(.borderedProminent)
                .disabled(!store.isSignedIn || store.isLocked || store.role != .owner)
            Text("Paid checkout is not active in this build. The module keeps local billing records and exports portable licenses; imported licenses remain pending verification.")
                .font(.system(size: 11)).foregroundStyle(.secondary)
        }
        .padding(28).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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
