import SwiftUI

struct AuthenticationView: View {
    @Environment(AppSession.self) private var session
    @State private var mode: Mode = .signIn
    @State private var email = KeychainStore.lastSuccessfulEmail()
    @State private var password = ""
    @State private var ownerName = ""
    @State private var businessName = ""
    @State private var confirmation = ""
    @State private var notice = ""
    @State private var working = false
    enum Mode: String, CaseIterable { case signIn = "Sign in", create = "Create" }

    var body: some View {
        NavigationStack {
            Form {
                Section { Text("One verified account works across OverHead web, desktop, and iPhone.").foregroundStyle(.secondary) }
                Section { Picker("", selection: $mode) { ForEach(Mode.allCases, id: \.self) { Text($0.rawValue) } }.pickerStyle(.segmented) }
                if mode == .create {
                    Section("New workspace") {
                        TextField("Your name", text: $ownerName).textContentType(.name)
                        TextField("Business name", text: $businessName).textContentType(.organizationName)
                    }
                }
                Section(mode == .signIn ? "Sign in" : "Account") {
                    TextField("Email address", text: $email).textInputAutocapitalization(.never).keyboardType(.emailAddress).textContentType(.emailAddress)
                    SecureField("Password", text: $password).textContentType(mode == .signIn ? .password : .newPassword)
                    if mode == .create { SecureField("Confirm password", text: $confirmation).textContentType(.newPassword) }
                }
                Section {
                    Button(working ? "Please wait..." : mode == .signIn ? "Sign in securely" : "Create secure workspace") { Task { await submit() } }.disabled(working)
                    if mode == .signIn { Button("Send password reset") { Task { await resetPassword() } } }
                }
                if !notice.isEmpty { Section { Text(notice).font(.footnote).foregroundStyle(.secondary) } }
                Section { Text("Passwords are handled by Firebase Authentication. OverHead does not save raw passwords on this device.").font(.footnote).foregroundStyle(.secondary) }
            }
            .navigationTitle("OverHead")
        }
    }

    private func submit() async {
        guard email.contains("@"), password.count >= 12 else { notice = "Enter a valid email address and a password of at least 12 characters."; return }
        if mode == .create && (ownerName.trimmingCharacters(in: .whitespaces).isEmpty || businessName.trimmingCharacters(in: .whitespaces).isEmpty || password != confirmation) { notice = "Add your name, business name, and matching passwords."; return }
        working = true; defer { working = false }
        do {
            if mode == .signIn { try await session.signIn(email: email, password: password) }
            else { try await session.createWorkspace(ownerName: ownerName, businessName: businessName, email: email, password: password); notice = "Your workspace was created. Verify the link sent to your email before opening it." }
            password = ""; confirmation = ""
        } catch { notice = ErrorPresenter.message(for: error) }
    }
    private func resetPassword() async {
        guard email.contains("@") else { notice = "Enter your OverHead account email address first."; return }
        do { try await session.resetPassword(for: email); notice = "If that email belongs to an OverHead account, a password-reset link is on its way." } catch { notice = ErrorPresenter.message(for: error) }
    }
}

struct VerificationView: View {
    @Environment(AppSession.self) private var session
    @State private var notice = "Verify the link in your inbox, then return here."
    var body: some View {
        ContentUnavailableView("Verify your email", systemImage: "envelope.badge", description: Text(notice))
            .overlay(alignment: .bottom) {
                HStack { Button("Send new link") { Task { do { try await session.sendVerification(); notice = "A new verification link is on its way." } catch { notice = ErrorPresenter.message(for: error) } } }; Button("I verified my email") { Task { await session.reloadVerification() } }.buttonStyle(.borderedProminent) }.padding()
            }
    }
}
