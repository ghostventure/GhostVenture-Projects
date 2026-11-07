import FirebaseAuth
import FirebaseFirestore
import Foundation
import Observation

@MainActor
@Observable
final class OverHeadStore {
    private let database = Firestore.firestore()
    private var hasRestoredSession = false
    private var taskListener: ListenerRegistration?
    private var customerListener: ListenerRegistration?
    private var activityListener: ListenerRegistration?
    private var approvalListener: ListenerRegistration?

    var isRestoring = true
    var isLoading = false
    var isSignedIn = false
    var email = ""
    var displayName = ""
    var businessName = ""
    var role = ""
    var workspaceId = ""
    var userId = ""
    var tasks: [QuickTask] = []
    var updatingTaskIds: Set<String> = []
    var customers: [Customer] = []
    var notes: [QuickNote] = []
    var approvals: [Approval] = []
    var errorMessage: String?

    var openTaskCount: Int { tasks.filter { !$0.done }.count }
    var followUpCount: Int { tasks.filter { !$0.done && $0.kind == .followUp }.count }
    var pendingApprovalCount: Int { approvals.filter { $0.status == "Pending" }.count }
    var canViewActivity: Bool { ["Administrator", "Manager"].contains(role) }

    func restoreSession() async {
        guard !hasRestoredSession else { return }
        hasRestoredSession = true
        guard let user = Auth.auth().currentUser else {
            isRestoring = false
            return
        }

        do {
            try await loadProfile(for: user)
            try await loadWorkspaceData()
        } catch {
            try? Auth.auth().signOut()
            clearSession()
            errorMessage = readable(error)
        }
        isRestoring = false
    }

    func signIn(email: String, password: String) async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }

        do {
            let result = try await Auth.auth().signIn(withEmail: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            try await loadProfile(for: result.user)
            try await loadWorkspaceData()
        } catch {
            try? Auth.auth().signOut()
            clearSession()
            errorMessage = readable(error)
        }
    }

    func sendPasswordReset(to email: String) async {
        errorMessage = nil
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanEmail.isEmpty else {
            errorMessage = "Enter your email address first."
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            try await Auth.auth().sendPasswordReset(withEmail: cleanEmail)
            errorMessage = "Password reset email sent to \(cleanEmail)."
        } catch {
            errorMessage = readable(error)
        }
    }

    func signOut() {
        do {
            try Auth.auth().signOut()
            clearSession()
        } catch {
            errorMessage = readable(error)
        }
    }

    func refresh() async {
        guard isSignedIn else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            try await loadWorkspaceData()
        } catch {
            errorMessage = readable(error)
        }
    }

    func addTask(_ title: String, customerId: String?, kind: TaskKind, dueAt: Date?) async -> Bool {
        guard let user = Auth.auth().currentUser else { errorMessage = "Sign in again to add a task."; return false }
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTitle.isEmpty else { return false }
        isLoading = true
        defer { isLoading = false }

        var data: [String: Any] = [
            "workspace_id": workspaceId,
            "created_by": user.uid,
            "title": cleanTitle,
            "kind": kind.storageValue,
            "done": false,
            "created_at": FieldValue.serverTimestamp(),
            "updated_at": FieldValue.serverTimestamp()
        ]
        if let customerId, !customerId.isEmpty { data["customer_id"] = customerId }
        if let dueAt { data["due_at"] = Timestamp(date: dueAt) }

        do {
            let document = try await database.collection("workspaces").document(workspaceId).collection("tasks").addDocument(data: data)
            let customer = customerId.flatMap { id in customers.first(where: { $0.id == id }) }
            tasks.insert(QuickTask(id: document.documentID, title: cleanTitle, customerId: customerId, customerName: customer?.name, dueLabel: dueAt?.formatted(date: .abbreviated, time: .shortened) ?? "", kind: kind), at: 0)
            return true
        } catch {
            errorMessage = readable(error)
            return false
        }
    }

    func addCustomer(name: String, email: String, phone: String) async -> Bool {
        guard let user = Auth.auth().currentUser else { errorMessage = "Sign in again to add a customer."; return false }
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let cleanPhone = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanName.isEmpty else { errorMessage = "Add the customer’s name before saving."; return false }
        let emailParts = cleanEmail.split(separator: "@", omittingEmptySubsequences: false)
        if !cleanEmail.isEmpty && (emailParts.count != 2 || !emailParts[1].contains(".") || emailParts[0].isEmpty) {
            errorMessage = "Enter a valid email address or leave it blank."
            return false
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let document = try await database.collection("workspaces").document(workspaceId).collection("customers").addDocument(data: [
                "workspace_id": workspaceId,
                "created_by": user.uid,
                "name": cleanName,
                "email": cleanEmail,
                "phone": cleanPhone,
                "status": "Active",
                "created_at": FieldValue.serverTimestamp(),
                "updated_at": FieldValue.serverTimestamp()
            ])
            customers.append(Customer(id: document.documentID, name: cleanName, email: cleanEmail, phone: cleanPhone, detail: "Active"))
            customers.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            return true
        } catch {
            errorMessage = readable(error)
            return false
        }
    }

    func requestApproval(title: String, details: String) async -> Bool {
        guard let user = Auth.auth().currentUser else { errorMessage = "Sign in again to request approval."; return false }
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTitle.isEmpty else { errorMessage = "Add a short title for the approval request."; return false }
        isLoading = true
        defer { isLoading = false }
        do {
            try await database.collection("workspaces").document(workspaceId).collection("approvals").addDocument(data: [
                "workspace_id": workspaceId,
                "created_by": user.uid,
                "title": cleanTitle,
                "details": details.trimmingCharacters(in: .whitespacesAndNewlines),
                "status": "Pending",
                "created_at": FieldValue.serverTimestamp(),
                "updated_at": FieldValue.serverTimestamp()
            ])
            return true
        } catch {
            errorMessage = readable(error)
            return false
        }
    }

    func decideApproval(_ approval: Approval, status: String) async {
        guard canViewActivity, ["Approved", "Declined"].contains(status), let user = Auth.auth().currentUser else { return }
        do {
            try await database.collection("workspaces").document(workspaceId).collection("approvals").document(approval.id).updateData([
                "status": status,
                "decided_by": user.uid,
                "decided_at": FieldValue.serverTimestamp(),
                "updated_at": FieldValue.serverTimestamp()
            ])
        } catch {
            errorMessage = readable(error)
        }
    }

    func toggle(_ task: QuickTask) async {
        guard !updatingTaskIds.contains(task.id) else { return }
        let newDoneState = !task.done
        updatingTaskIds.insert(task.id)
        defer { updatingTaskIds.remove(task.id) }
        do {
            try await database.collection("workspaces").document(workspaceId).collection("tasks").document(task.id).updateData([
                "done": newDoneState,
                "updated_at": FieldValue.serverTimestamp()
            ])
            guard let index = tasks.firstIndex(where: { $0.id == task.id }) else { return }
            tasks[index].done = newDoneState
        } catch {
            errorMessage = readable(error)
        }
    }

    func addNote(_ text: String, customerId: String?) async -> Bool {
        guard let user = Auth.auth().currentUser else { errorMessage = "Sign in again to log an update."; return false }
        let cleanText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanText.isEmpty else { return false }
        isLoading = true
        defer { isLoading = false }

        let customer = customerId.flatMap { id in customers.first(where: { $0.id == id }) }
        var data: [String: Any] = [
            "workspace_id": workspaceId,
            "actor_uid": user.uid,
            "event_type": "mobile.update_logged",
            "summary": cleanText,
            "created_at": FieldValue.serverTimestamp()
        ]
        if let customerId, !customerId.isEmpty { data["customer_id"] = customerId }

        do {
            let document = try await database.collection("workspaces").document(workspaceId).collection("audit_events").addDocument(data: data)
            let note = QuickNote(id: document.documentID, text: cleanText, customer: customer?.name, createdAt: .now)
            notes.insert(note, at: 0)
            saveNotes()
            return true
        } catch {
            errorMessage = readable(error)
            return false
        }
    }

    private func loadProfile(for user: FirebaseAuth.User) async throws {
        let snapshot = try await database.collection("profiles").document(user.uid).getDocument()
        guard let profile = snapshot.data() else {
            throw AppError.message("This account doesn’t have an OverHead workspace profile yet.")
        }
        let status = profile["status"] as? String ?? ""
        let role = profile["role"] as? String ?? ""
        guard status == "Active" else {
            throw AppError.message("This OverHead account is not active. Ask your workspace administrator for help.")
        }
        guard ["Administrator", "Manager", "Staff"].contains(role) else {
            throw AppError.message("This mobile app is for OverHead workspace team members.")
        }
        guard let workspaceId = profile["workspace_id"] as? String, !workspaceId.isEmpty else {
            throw AppError.message("Your account doesn’t have a workspace assigned yet.")
        }

        userId = user.uid
        self.workspaceId = workspaceId
        self.role = role
        email = user.email ?? (profile["email"] as? String ?? "")
        displayName = profile["owner_name"] as? String ?? email
        businessName = profile["business_name"] as? String ?? "OverHead workspace"
        isSignedIn = true
        notes = Self.loadNotes(for: user.uid)
    }

    private func loadWorkspaceData() async throws {
        async let taskSnapshot = database.collection("workspaces").document(workspaceId).collection("tasks").limit(to: 200).getDocuments()
        async let customerSnapshot = database.collection("workspaces").document(workspaceId).collection("customers").limit(to: 500).getDocuments()
        let (taskResult, customerResult) = try await (taskSnapshot, customerSnapshot)
        customers = customerResult.documents.map(Customer.init(document:)).sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        let customersById = Dictionary(uniqueKeysWithValues: customers.map { ($0.id, $0) })
        tasks = taskResult.documents
            .map { QuickTask(document: $0, customersById: customersById) }
            .sorted { lhs, rhs in
                if lhs.done != rhs.done { return !lhs.done }
                return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
            }

        // Firestore rules intentionally limit audit feed reads to managers.
        // Staff can still add updates; those are visible here to workspace managers.
        if canViewActivity {
            let activity = try await database.collection("workspaces").document(workspaceId)
                .collection("audit_events")
                .order(by: "created_at", descending: true)
                .limit(to: 100)
                .getDocuments()
            notes = activity.documents.compactMap { document in
                let data = document.data()
                guard let summary = data["summary"] as? String else { return nil }
                let customerId = data["customer_id"] as? String
                let timestamp = data["created_at"] as? Timestamp
                return QuickNote(
                    id: document.documentID,
                    text: summary,
                    customer: customerId.flatMap { customersById[$0]?.name },
                    createdAt: timestamp?.dateValue() ?? .now
                )
            }
        }
        let approvalResult = try await database.collection("workspaces").document(workspaceId).collection("approvals").limit(to: 100).getDocuments()
        approvals = approvalResult.documents.map(Approval.init(document:)).sorted { lhs, rhs in
            if (lhs.status == "Pending") != (rhs.status == "Pending") { return lhs.status == "Pending" }
            return (lhs.createdAt ?? .distantPast) > (rhs.createdAt ?? .distantPast)
        }
        startRealtimeUpdates()
    }

    private func startRealtimeUpdates() {
        stopRealtimeUpdates()
        let workspace = database.collection("workspaces").document(workspaceId)
        taskListener = workspace.collection("tasks").addSnapshotListener { [weak self] snapshot, error in
            guard let snapshot else {
                if let error { Task { @MainActor [weak self] in self?.errorMessage = error.localizedDescription } }
                return
            }
            Task { @MainActor [weak self] in
                guard let self else { return }
                let customersById = Dictionary(uniqueKeysWithValues: self.customers.map { ($0.id, $0) })
                self.tasks = snapshot.documents
                    .map { QuickTask(document: $0, customersById: customersById) }
                    .sorted { lhs, rhs in
                        if lhs.done != rhs.done { return !lhs.done }
                        return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
                    }
            }
        }
        customerListener = workspace.collection("customers").addSnapshotListener { [weak self] snapshot, error in
            guard let snapshot else {
                if let error { Task { @MainActor [weak self] in self?.errorMessage = error.localizedDescription } }
                return
            }
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.customers = snapshot.documents.map(Customer.init(document:)).sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
                let customersById = Dictionary(uniqueKeysWithValues: self.customers.map { ($0.id, $0) })
                self.tasks = self.tasks.map { task in
                    var updated = task
                    updated.customerName = task.customerId.flatMap { customersById[$0]?.name }
                    return updated
                }
            }
        }
        if canViewActivity {
            activityListener = workspace.collection("audit_events")
                .order(by: "created_at", descending: true)
                .limit(to: 100)
                .addSnapshotListener { [weak self] snapshot, error in
                    guard let snapshot else {
                        if let error { Task { @MainActor [weak self] in self?.errorMessage = error.localizedDescription } }
                        return
                    }
                    Task { @MainActor [weak self] in
                        guard let self else { return }
                        let customersById = Dictionary(uniqueKeysWithValues: self.customers.map { ($0.id, $0) })
                        self.notes = snapshot.documents.compactMap { document in
                            let data = document.data()
                            guard let summary = data["summary"] as? String else { return nil }
                            let customerId = data["customer_id"] as? String
                            return QuickNote(id: document.documentID, text: summary, customer: customerId.flatMap { customersById[$0]?.name }, createdAt: (data["created_at"] as? Timestamp)?.dateValue() ?? .now)
                        }
                    }
                }
        }
        approvalListener = workspace.collection("approvals").addSnapshotListener { [weak self] snapshot, error in
            guard let snapshot else {
                if let error { Task { @MainActor [weak self] in self?.errorMessage = error.localizedDescription } }
                return
            }
            Task { @MainActor [weak self] in
                self?.approvals = snapshot.documents.map(Approval.init(document:)).sorted { lhs, rhs in
                    if (lhs.status == "Pending") != (rhs.status == "Pending") { return lhs.status == "Pending" }
                    return (lhs.createdAt ?? .distantPast) > (rhs.createdAt ?? .distantPast)
                }
            }
        }
    }

    private func stopRealtimeUpdates() {
        taskListener?.remove()
        customerListener?.remove()
        activityListener?.remove()
        approvalListener?.remove()
        taskListener = nil
        customerListener = nil
        activityListener = nil
        approvalListener = nil
    }

    private func clearSession() {
        stopRealtimeUpdates()
        userId = ""
        workspaceId = ""
        email = ""
        displayName = ""
        businessName = ""
        role = ""
        tasks = []
        updatingTaskIds = []
        customers = []
        notes = []
        approvals = []
        isSignedIn = false
    }

    private var notesKey: String { "overhead.mobile.notes.\(userId)" }

    private func saveNotes() {
        guard let data = try? JSONEncoder().encode(notes) else { return }
        UserDefaults.standard.set(data, forKey: notesKey)
    }

    private static func loadNotes(for userId: String) -> [QuickNote] {
        guard let data = UserDefaults.standard.data(forKey: "overhead.mobile.notes.\(userId)") else { return [] }
        return (try? JSONDecoder().decode([QuickNote].self, from: data)) ?? []
    }

    private func readable(_ error: Error) -> String {
        if let appError = error as? AppError { return appError.localizedDescription }
        let authError = error as NSError
        if authError.domain == AuthErrorDomain {
            switch AuthErrorCode(rawValue: authError.code) {
            case .wrongPassword, .invalidCredential, .userNotFound: return "Email or password wasn’t recognized. Check it and try again."
            case .networkError: return "Can’t reach OverHead right now. Check your internet connection and try again."
            case .tooManyRequests: return "There have been too many attempts. Wait a little and try again."
            default: break
            }
        }
        return error.localizedDescription
    }
}

private enum AppError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        if case let .message(message) = self { return message }
        return nil
    }
}
