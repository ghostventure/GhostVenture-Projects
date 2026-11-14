import SwiftUI

struct AccountsWorkspaceView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var name = ""
    @State private var email = ""
    @State private var role: WorkspaceRole = .frontDesk
    @State private var temporaryPassword = ""
    @State private var recoveryPhrase = ""

    private var staff: [LocalProfile] { store.archive.profiles.filter { $0.role != .customer } }
    private var approvals: [WorkspaceRecord] { store.records("approvalRequests").filter { $0.status == "Pending" } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Accounts and access").font(.system(size: 28, weight: .bold, design: .rounded))
                Text("Assign each staff member the smallest role they need. Staff profiles and credentials in this native preview are local to this encrypted Mac workspace.")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
                HStack(alignment: .top, spacing: 16) {
                    invitePanel.frame(maxWidth: 360)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Workspace profiles").font(.system(size: 17, weight: .bold, design: .rounded))
                        ForEach(staff) { profile in profileRow(profile) }
                    }.padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
                }
                approvalsPanel
            }.padding(26)
        }
    }

    private var invitePanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Create a staff profile").font(.system(size: 16, weight: .bold, design: .rounded))
            LabeledField(title: "Name", value: $name)
            LabeledField(title: "Email", value: $email, placeholder: "staff@example.com")
            Picker("Role", selection: $role) {
                Text("Front Desk").tag(WorkspaceRole.frontDesk)
                Text("Bookkeeper").tag(WorkspaceRole.bookkeeper)
                Text("Support").tag(WorkspaceRole.support)
            }
            SecureField("Temporary password (12+ characters)", text: $temporaryPassword).textFieldStyle(.roundedBorder)
            SecureField("Recovery phrase (8+ characters)", text: $recoveryPhrase).textFieldStyle(.roundedBorder)
            Button("Create staff profile") {
                store.createStaffAccount(name: name, email: email, role: role, temporaryPassword: temporaryPassword, recoveryPhrase: recoveryPhrase)
                if store.errorMessage == nil { name = ""; email = ""; temporaryPassword = ""; recoveryPhrase = "" }
            }.buttonStyle(.borderedProminent)
                .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || email.isEmpty || temporaryPassword.count < 12 || recoveryPhrase.count < 8)
            Text("Share credentials through a secure channel. The staff member must accept workspace terms and replace the temporary password after first sign-in.")
                .font(.system(size: 10)).foregroundStyle(.secondary)
        }.padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }

    private func profileRow(_ profile: LocalProfile) -> some View {
        HStack(spacing: 10) {
            Image(systemName: profile.role == .owner ? "person.crop.circle.badge.checkmark" : "person.crop.circle").foregroundStyle(OHStyle.blue)
            VStack(alignment: .leading, spacing: 3) {
                Text(profile.ownerName.isEmpty ? profile.email : profile.ownerName).font(.system(size: 12, weight: .semibold))
                Text("\(profile.email) · \(profile.role.rawValue)").font(.system(size: 10)).foregroundStyle(.secondary)
            }
            Spacer()
            StatusBadge(text: profile.status, prominent: profile.status != "Active")
        }.padding(9).background(OHStyle.line.opacity(0.3), in: RoundedRectangle(cornerRadius: 9))
    }

    private var approvalsPanel: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Owner approval queue").font(.system(size: 17, weight: .bold, design: .rounded))
            if approvals.isEmpty {
                Text("No approval requests are waiting.").font(.system(size: 12)).foregroundStyle(.secondary)
            } else {
                ForEach(approvals) { request in
                    HStack(alignment: .top, spacing: 10) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(request.title).font(.system(size: 12, weight: .semibold))
                            Text(request["details"]).font(.system(size: 10)).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("Approve") { store.decideApproval(request, decision: "Approved") }.buttonStyle(.bordered)
                        Button("Decline", role: .destructive) { store.decideApproval(request, decision: "Rejected") }.buttonStyle(.bordered)
                    }.padding(10).background(.background, in: RoundedRectangle(cornerRadius: 9))
                }
            }
        }.padding(17).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(OHStyle.line))
    }
}
