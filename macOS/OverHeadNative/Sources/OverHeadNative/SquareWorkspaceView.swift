import SwiftUI

struct SquareWorkspaceView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var environment = "sandbox"
    @State private var applicationID = ""
    @State private var merchantID = ""
    @State private var locationID = ""
    @State private var accessToken = ""
    @State private var refreshToken = ""
    @State private var businessName = ""
    @State private var locationName = ""
    @State private var customerCount = "0"
    @State private var catalogItemCount = "0"
    @State private var orderCount = "0"
    @State private var paymentCount = "0"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Square Connection").font(.system(size: 28, weight: .bold, design: .rounded))
                HStack(alignment: .top, spacing: 16) {
                    connectionPanel.frame(maxWidth: .infinity)
                    summaryPanel.frame(maxWidth: .infinity)
                }
                savedPanel
            }.padding(26)
        }
    }

    private var connectionPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Verify and save Square").font(.system(size: 16, weight: .bold, design: .rounded))
            Text("Complete verification in the browser, then save the merchant and location reference. Token values are hashed locally and discarded.")
                .font(.system(size: 11)).foregroundStyle(.secondary)
            Picker("Environment", selection: $environment) { Text("Sandbox").tag("sandbox"); Text("Production").tag("production") }
            LabeledField(title: "Application ID", value: $applicationID, placeholder: "sq0idp-…")
            LabeledField(title: "Merchant ID", value: $merchantID)
            LabeledField(title: "Location ID", value: $locationID)
            SecureField("Access token", text: $accessToken).textFieldStyle(.roundedBorder)
            SecureField("Refresh token", text: $refreshToken).textFieldStyle(.roundedBorder)
            HStack {
                Button("Open Square", systemImage: "arrow.up.right.square") { store.openSquareAuthorization(applicationID: applicationID, environment: environment) }.buttonStyle(.bordered)
                Button("Save Square") {
                    store.saveSquareConnection(environment: environment, applicationID: applicationID, merchantID: merchantID, locationID: locationID, accessToken: accessToken, refreshToken: refreshToken)
                    accessToken = ""
                    refreshToken = ""
                }.buttonStyle(.borderedProminent)
            }
        }.padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }

    private var summaryPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Import Square summary").font(.system(size: 16, weight: .bold, design: .rounded))
            Text("Import a reviewed count summary. This does not transfer transactions or create customer records.").font(.system(size: 11)).foregroundStyle(.secondary)
            LabeledField(title: "Business name", value: $businessName)
            LabeledField(title: "Merchant ID", value: $merchantID)
            LabeledField(title: "Location name", value: $locationName)
            LabeledField(title: "Location ID", value: $locationID)
            HStack { LabeledField(title: "Customers", value: $customerCount); LabeledField(title: "Catalog items", value: $catalogItemCount) }
            HStack { LabeledField(title: "Orders", value: $orderCount); LabeledField(title: "Payments", value: $paymentCount) }
            Button("Import Square summary") {
                store.importSquareReference(fields: [
                    "business_name": businessName, "merchant_id": merchantID, "location_name": locationName,
                    "location_id": locationID, "customer_count": customerCount, "catalog_item_count": catalogItemCount,
                    "order_count": orderCount, "payment_count": paymentCount
                ])
            }.buttonStyle(.borderedProminent)
        }.padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }

    private var savedPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Saved Square data").font(.system(size: 16, weight: .bold, design: .rounded))
            Text("\(store.records("squareConnections").count) connections · \(store.records("squareImports").count) summaries").font(.system(size: 11)).foregroundStyle(.secondary)
            ForEach(store.records("squareConnections")) { record in
                HStack { Text(record.title); Spacer(); Text("\(record["merchant_id"]) · \(record.status)").foregroundStyle(.secondary) }.font(.system(size: 11))
            }
            ForEach(store.records("squareImports").prefix(5)) { record in
                HStack { Text(record["business_name"].nonEmpty ?? record["merchant_id"]); Spacer(); Text("\(record["payment_count"]) payments").foregroundStyle(.secondary) }.font(.system(size: 11))
            }
        }.padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }
}
