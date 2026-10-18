import Foundation
import Observation
import FirebaseAuth
import FirebaseFirestore

@Observable
@MainActor
final class AppSession {
    var profile: WorkspaceProfile?
    var isLoading = true
    var notice = ""
    var deviceLock = DeviceLock()
    let workspace = WorkspaceStore()
    private var authHandle: AuthStateDidChangeListenerHandle?

    init() {
        authHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in await self?.load(user: user) }
        }
    }

    deinit {
        if let authHandle { Auth.auth().removeStateDidChangeListener(authHandle) }
    }

    var requiresEmailVerification: Bool {
        Auth.auth().currentUser != nil && !(Auth.auth().currentUser?.isEmailVerified ?? false)
    }

    func load(user: User?) async {
        isLoading = true
        defer { isLoading = false }
        guard let user else {
            profile = nil
            workspace.stop()
            return
        }
        do {
            try await user.reload()
            guard user.isEmailVerified else {
                profile = nil
                workspace.stop()
                return
            }
            let snapshot = try await Firestore.firestore().collection("profiles").document(user.uid).getDocument()
            guard let data = snapshot.data(), let profile = WorkspaceProfile(id: snapshot.documentID, data: data), profile.status == "Active" else {
                try? Auth.auth().signOut()
                notice = "This account is not connected to an active OverHead workspace."
                return
            }
            self.profile = profile
            KeychainStore.saveLastSuccessfulEmail(profile.email)
            workspace.start(profile: profile, actorID: user.uid)
        } catch {
            notice = ErrorPresenter.message(for: error)
        }
    }

    func signIn(email: String, password: String) async throws {
        _ = try await Auth.auth().signIn(withEmail: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), password: password)
    }

    func createWorkspace(ownerName: String, businessName: String, email: String, password: String) async throws {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let result = try await Auth.auth().createUser(withEmail: normalizedEmail, password: password)
        let db = Firestore.firestore()
        let batch = db.batch()
        let workspaceRef = db.collection("workspaces").document(result.user.uid)
        let profileRef = db.collection("profiles").document(result.user.uid)
        batch.setData(["owner_uid": result.user.uid, "business_name": businessName.trimmingCharacters(in: .whitespacesAndNewlines), "created_at": FieldValue.serverTimestamp(), "updated_at": FieldValue.serverTimestamp()], forDocument: workspaceRef)
        batch.setData(["uid": result.user.uid, "owner_name": ownerName.trimmingCharacters(in: .whitespacesAndNewlines), "business_name": businessName.trimmingCharacters(in: .whitespacesAndNewlines), "email": normalizedEmail, "workspace_id": result.user.uid, "role": WorkspaceRole.administrator.rawValue, "status": "Active", "email_verified": false, "terms_accepted_at": FieldValue.serverTimestamp(), "last_sign_in": FieldValue.serverTimestamp(), "created_at": FieldValue.serverTimestamp(), "updated_at": FieldValue.serverTimestamp()], forDocument: profileRef)
        try await batch.commit()
        let request = Auth.auth().currentUser?.createProfileChangeRequest()
        request?.displayName = ownerName.trimmingCharacters(in: .whitespacesAndNewlines)
        if let request { try await request.commitChanges() }
        try await result.user.sendEmailVerification()
    }

    func sendVerification() async throws {
        guard let user = Auth.auth().currentUser else { throw AppIssue.message("Your sign-in session ended. Please sign in again.") }
        try await user.sendEmailVerification()
    }

    func reloadVerification() async {
        guard let user = Auth.auth().currentUser else { return }
        do { try await user.reload(); await load(user: user) } catch { notice = ErrorPresenter.message(for: error) }
    }

    func resetPassword(for email: String) async throws {
        try await Auth.auth().sendPasswordReset(withEmail: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
    }

    func signOut() {
        workspace.stop()
        try? Auth.auth().signOut()
        profile = nil
    }
}

enum ErrorPresenter {
    static func message(for error: Error) -> String {
        let value = (error as NSError).code
        let domain = (error as NSError).domain
        guard domain == AuthErrorDomain else { return "OverHead could not complete that action. Check your connection and try again." }
        switch value {
        case AuthErrorCode.wrongPassword.rawValue, AuthErrorCode.userNotFound.rawValue, AuthErrorCode.invalidCredential.rawValue: return "The email or password is not correct. Try again or reset your password."
        case AuthErrorCode.emailAlreadyInUse.rawValue: return "An account already exists for that email. Sign in or reset its password."
        case AuthErrorCode.weakPassword.rawValue: return "Use a password of at least 12 characters."
        case AuthErrorCode.networkError.rawValue: return "OverHead could not reach the sign-in service. Check your connection and try again."
        case AuthErrorCode.tooManyRequests.rawValue: return "Too many attempts were made. Wait a few minutes, then try again."
        case AuthErrorCode.invalidEmail.rawValue: return "Enter a valid email address."
        default: return "OverHead could not complete that request. Please try again."
        }
    }
}
