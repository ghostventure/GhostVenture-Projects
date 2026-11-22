import SwiftUI

struct AuthenticationView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var mode = AuthMode.signIn
    @State private var email = ""
    @State private var password = ""
    @State private var ownerName = ""
    @State private var business = ""
    @State private var recoveryPhrase = ""
    @State private var newPassword = ""
    @State private var accessLane = "team"
    @State private var workspaceCode = ""
    @State private var role: WorkspaceRole = .owner
    @State private var plan = "gold"
    @State private var acceptedTerms = false
    @State private var confirmedSeparateWorkspace = false
    @State private var showingSeparateWorkspaceConfirmation = false
    @State private var checkingWorkspaceDuplicates = false
    @State private var possibleRemoteDuplicate = false

    var body: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 27) {
                HStack(spacing: 12) {
                    OverHeadBrandMark().frame(width: 52, height: 52)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("OverHead").font(.system(size: 24, weight: .bold, design: .rounded))
                        Text("DESKTOP WORKSPACE").font(.system(size: 10, weight: .bold)).tracking(1.4).foregroundStyle(OHStyle.muted)
                    }
                }
                VStack(alignment: .leading, spacing: 11) {
                    Text(mode == .create ? "Set up your workspace." : mode == .recover ? "Recover your account." : "A little less overhead.")
                        .font(.system(size: 37, weight: .bold, design: .rounded)).foregroundStyle(OHStyle.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(mode == .create ? "Bring customer work, owner decisions, and follow-through into one desktop workspace." : mode == .recover ? "Use your recovery phrase to reset the password for this Mac workspace." : "Sign in to your OverHead workspace and keep the next steps visible.")
                        .font(.system(size: 16)).foregroundStyle(OHStyle.muted).lineSpacing(4)
                }
                VStack(alignment: .leading, spacing: 13) {
                    AuthValueRow(icon: "person.2", title: "Customer context", detail: "Profiles, service rules, and history")
                    AuthValueRow(icon: "point.3.connected.trianglepath.dotted", title: "Operational workflows", detail: "Scheduling, quotes, invoices, and follow-up")
                    AuthValueRow(icon: "lock.shield", title: "Private local workspace", detail: "Encrypted records protected by Keychain")
                }
                Spacer()
                Text("Records are stored on this Mac. Create a protected backup before moving to another computer.")
                    .font(.system(size: 11)).foregroundStyle(OHStyle.muted).fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 55).padding(.vertical, 48).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .background(Color(red: 0.94, green: 0.96, blue: 0.97))

            VStack(alignment: .leading, spacing: 20) {
                Picker("Access mode", selection: $mode) {
                    ForEach(accessLane == "customer" ? [AuthMode.signIn, .customerJoin, .recover] : [.signIn, .create, .recover]) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
                .disabled(store.isConfigured && mode == .create)
                .onChange(of: accessLane) { _, _ in mode = .signIn }

                if mode == .signIn { signInForm }
                else if mode == .create { createForm }
                else if mode == .customerJoin { customerJoinForm }
                else { recoveryForm }

                if !store.isConfigured && mode == .signIn {
                    Text("This Mac doesn’t have an OverHead profile yet. Choose Create workspace to start, or restore an existing workspace backup from Tools after setup.")
                        .font(.system(size: 12)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                }
                if !store.notice.isEmpty {
                    Label(store.notice, systemImage: "checkmark.circle.fill")
                        .font(.system(size: 11, weight: .medium)).foregroundStyle(OHStyle.green)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(34).frame(width: 470).frame(maxHeight: .infinity, alignment: .topLeading)
            .background(OHStyle.canvas)
        }
        .alert("Create a separate OverHead workspace?", isPresented: $showingSeparateWorkspaceConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Create Separate Workspace", role: .destructive) { submitNewWorkspace() }
        } message: {
            Text(possibleRemoteDuplicate
                ? "A possible workspace match was found for this business. Sign in with the existing account or ask its administrator for an invitation to keep users and records together. Creating this separate workspace can lead to duplicate subscriptions. Continue only if you have confirmed that a separate workspace is intended."
                : "No similar business was found in the current workspace records. This creates a separate account and workspace; existing users, records, and trial history will not be carried over.")
        }
    }

    private var signInForm: some View {
        VStack(alignment: .leading, spacing: 17) {
            Text("Welcome back").font(.system(size: 23, weight: .bold, design: .rounded))
            Group {
                Picker("Access lane", selection: $accessLane) { Text("Team Access").tag("team"); Text("Customer Access").tag("customer") }.pickerStyle(.segmented)
                LabeledContent("Email address") { TextField("you@business.com", text: $email).textFieldStyle(.roundedBorder).textContentType(.emailAddress) }
                LabeledContent("Password") { SecureField("OverHead password", text: $password).textFieldStyle(.roundedBorder).onSubmit(signIn) }
            }.font(.system(size: 13, weight: .medium))
            Button(action: signIn) {
                HStack { Spacer(); Text(accessLane == "customer" ? "Sign in to customer support" : "Sign in to workspace").fontWeight(.semibold); Spacer() }
            }.buttonStyle(.borderedProminent).controlSize(.large).disabled(email.isEmpty || password.isEmpty)
            HStack {
                Button("Need account recovery?") { mode = .recover }.buttonStyle(.link)
                Spacer()
                if store.isConfigured { Button("Use another account") { email = ""; password = "" }.buttonStyle(.link) }
            }
            if store.isConfigured {
                Button("Create a separate workspace") { mode = .create }.buttonStyle(.link)
            } else {
                Button("Create workspace") { mode = .create }.buttonStyle(.bordered).controlSize(.large).frame(maxWidth: .infinity)
            }
        }
    }

    private var createForm: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 13) {
                Text("Create a workspace account").font(.system(size: 23, weight: .bold, design: .rounded))
                Text("Use your existing OverHead account to keep using its users and workspace information. A new account starts separately.").font(.system(size: 12)).foregroundStyle(.secondary)
                if let prior = priorWorkspaceMatch {
                    VStack(alignment: .leading, spacing: 7) {
                        Label("Similar account information was used on this Mac", systemImage: "person.crop.circle.badge.exclamationmark").font(.system(size: 12, weight: .semibold))
                        Text("\(prior.businessName) · \(prior.email). Sign in with this account to continue the existing workspace. Creating a new account keeps its users and records separate.").font(.system(size: 11)).foregroundStyle(.secondary)
                        Button("Use this existing account") {
                            email = prior.email
                            password = ""
                            accessLane = "team"
                            confirmedSeparateWorkspace = false
                            mode = .signIn
                        }.buttonStyle(.bordered)
                    }.padding(11).frame(maxWidth: .infinity, alignment: .leading).background(OHStyle.blue.opacity(0.07), in: RoundedRectangle(cornerRadius: 9))
                }
                AuthField(title: "Your name", prompt: "Owner name", text: $ownerName)
                AuthField(title: "Business name", prompt: "Your business", text: $business)
                AuthField(title: "Email address", prompt: "owner@business.com", text: $email)
                VStack(alignment: .leading, spacing: 5) { Text("PASSWORD · 12 CHARACTERS MINIMUM").font(.system(size: 10, weight: .bold)).tracking(0.6).foregroundStyle(.secondary); SecureField("Create a password", text: $password).textFieldStyle(.roundedBorder) }
                VStack(alignment: .leading, spacing: 5) { Text("RECOVERY PHRASE").font(.system(size: 10, weight: .bold)).tracking(0.6).foregroundStyle(.secondary); SecureField("At least 8 characters", text: $recoveryPhrase).textFieldStyle(.roundedBorder) }
                Picker("Access role", selection: $role) { ForEach(WorkspaceRole.allCases) { Text($0.rawValue).tag($0) } }
                Picker("Starting plan", selection: $plan) { Text("Silver").tag("silver"); Text("Gold").tag("gold"); Text("Black").tag("black") }
                Toggle("I acknowledge the Terms of Use and Privacy Notice.", isOn: $acceptedTerms).font(.system(size: 12))
                Toggle("I confirm this should be a separate workspace with separate users and records.", isOn: $confirmedSeparateWorkspace).font(.system(size: 12))
                Button(checkingWorkspaceDuplicates ? "Checking existing workspaces…" : "Check for duplicates and continue") { checkForDuplicateWorkspaces() }.buttonStyle(.borderedProminent).controlSize(.large).frame(maxWidth: .infinity).disabled(!acceptedTerms || !confirmedSeparateWorkspace || checkingWorkspaceDuplicates)
                Button("Return to sign in") { mode = .signIn }.buttonStyle(.link).frame(maxWidth: .infinity)
            }
            .padding(.trailing, 8)
        }
    }

    private var recoveryForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Recover access").font(.system(size: 23, weight: .bold, design: .rounded))
            Text("Enter the email and recovery phrase saved when the workspace was created.").font(.system(size: 12)).foregroundStyle(.secondary)
            AuthField(title: "EMAIL ADDRESS", prompt: "owner@business.com", text: $email)
            VStack(alignment: .leading, spacing: 5) { Text("RECOVERY PHRASE").font(.system(size: 10, weight: .bold)).tracking(0.6).foregroundStyle(.secondary); SecureField("Recovery phrase", text: $recoveryPhrase).textFieldStyle(.roundedBorder) }
            VStack(alignment: .leading, spacing: 5) { Text("NEW PASSWORD").font(.system(size: 10, weight: .bold)).tracking(0.6).foregroundStyle(.secondary); SecureField("At least 12 characters", text: $newPassword).textFieldStyle(.roundedBorder) }
            Button("Reset password") { Task { await store.recoverAccount(email: email, recoveryPhrase: recoveryPhrase, newPassword: newPassword) } }.buttonStyle(.borderedProminent).controlSize(.large).frame(maxWidth: .infinity)
            Button("Return to sign in") { mode = .signIn }.buttonStyle(.link).frame(maxWidth: .infinity)
        }
    }

    private var customerJoinForm: some View {
        VStack(alignment: .leading, spacing: 15) {
            Text("Join customer support").font(.system(size: 23, weight: .bold, design: .rounded))
            Text("Use the invitation email and workspace code provided by the business.").font(.system(size: 12)).foregroundStyle(.secondary)
            AuthField(title: "Workspace code", prompt: "Invitation workspace code", text: $workspaceCode)
            AuthField(title: "Invitation email", prompt: "you@example.com", text: $email)
            VStack(alignment: .leading, spacing: 5) { Text("PASSWORD · 12 CHARACTERS MINIMUM").font(.system(size: 10, weight: .bold)).tracking(0.6).foregroundStyle(.secondary); SecureField("Create a password", text: $password).textFieldStyle(.roundedBorder) }
            Button("Create customer account") { Task { await store.registerCustomerAccess(email: email, password: password, workspaceID: workspaceCode) } }.buttonStyle(.borderedProminent).controlSize(.large).frame(maxWidth: .infinity)
            Button("Return to Customer Access") { mode = .signIn }.buttonStyle(.link).frame(maxWidth: .infinity)
        }
    }

    private func signIn() { Task { await store.signIn(email: email, password: password, accessLane: accessLane) } }
    private func checkForDuplicateWorkspaces() {
        guard !checkingWorkspaceDuplicates else { return }
        checkingWorkspaceDuplicates = true
        Task {
            do {
                possibleRemoteDuplicate = try await FirebaseWorkspaceAPI.checkWorkspaceDuplicate(ownerName: ownerName, businessName: business)
                showingSeparateWorkspaceConfirmation = true
            } catch {
                store.errorMessage = "OverHead could not check for a duplicate workspace, so no account was created. Try again when the connection is available. \(error.localizedDescription)"
            }
            checkingWorkspaceDuplicates = false
        }
    }

    private func submitNewWorkspace() {
        confirmedSeparateWorkspace = false
        Task { await store.createAccount(ownerName: ownerName, businessName: business, email: email, password: password, recoveryPhrase: recoveryPhrase, role: role, acceptedTerms: acceptedTerms, plan: plan) }
    }

    private var priorWorkspaceMatch: LocalProfile? {
        let enteredEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !enteredEmail.isEmpty, let exact = store.archive.profiles.first(where: { $0.email.lowercased() == enteredEmail }) { return exact }
        let enteredTokens = businessTokens(business)
        guard !enteredTokens.isEmpty else { return nil }
        return store.archive.profiles.first { profile in
            let priorTokens = businessTokens(profile.businessName)
            guard !priorTokens.isEmpty else { return false }
            let shared = enteredTokens.intersection(priorTokens).count
            let total = enteredTokens.union(priorTokens).count
            return total > 0 && Double(shared) / Double(total) >= 0.6
        }
    }

    private func businessTokens(_ value: String) -> Set<String> {
        let folded = value.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        let ignored: Set<String> = ["and", "the", "llc", "inc", "incorporated", "company", "co", "limited", "ltd", "corp", "corporation"]
        return Set(folded.split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init).filter { $0.count > 1 && !ignored.contains($0) })
    }
}

private enum AuthMode: String, CaseIterable, Identifiable {
    case signIn, create, customerJoin, recover
    var id: String { rawValue }
    var title: String { switch self { case .signIn: "Sign In"; case .create: "Create"; case .customerJoin: "Join"; case .recover: "Recover" } }
}

private struct AuthValueRow: View {
    let icon: String; let title: String; let detail: String
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(OHStyle.blue).frame(width: 32, height: 32).background(.white.opacity(0.7), in: RoundedRectangle(cornerRadius: 9))
            VStack(alignment: .leading, spacing: 2) { Text(title).font(.system(size: 13, weight: .semibold)); Text(detail).font(.system(size: 11)).foregroundStyle(OHStyle.muted) }
        }
    }
}

private struct AuthField: View {
    let title: String; let prompt: String; @Binding var text: String
    var body: some View {
        VStack(alignment: .leading, spacing: 5) { Text(title.uppercased()).font(.system(size: 10, weight: .bold)).tracking(0.6).foregroundStyle(.secondary); TextField(prompt, text: $text).textFieldStyle(.roundedBorder) }
    }
}
