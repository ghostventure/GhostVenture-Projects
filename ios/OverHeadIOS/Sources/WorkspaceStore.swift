import Foundation
import Observation
import FirebaseFirestore

@Observable
@MainActor
final class WorkspaceStore {
    var tasks: [OfficeTask] = []
    var customers: [Customer] = []
    var approvals: [Approval] = []
    var notice = ""
    private var profile: WorkspaceProfile?
    private var actorID = ""
    private var listeners: [ListenerRegistration] = []

    var openTasks: Int { tasks.filter { !$0.done }.count }
    var pendingApprovals: Int { approvals.filter { $0.status == "Pending" }.count }

    func start(profile: WorkspaceProfile, actorID: String) {
        guard self.profile?.workspaceID != profile.workspaceID || listeners.isEmpty else { return }
        stop()
        self.profile = profile
        self.actorID = actorID
        let root = Firestore.firestore().collection("workspaces").document(profile.workspaceID)
        listeners = [
            root.collection("tasks").addSnapshotListener { [weak self] snapshot, error in
                Task { @MainActor in self?.receiveTasks(snapshot, error) }
            },
            root.collection("customers").addSnapshotListener { [weak self] snapshot, error in
                Task { @MainActor in self?.receiveCustomers(snapshot, error) }
            },
            root.collection("approvals").addSnapshotListener { [weak self] snapshot, error in
                Task { @MainActor in self?.receiveApprovals(snapshot, error) }
            }
        ]
    }

    func stop() {
        listeners.forEach { $0.remove() }
        listeners = []
        tasks = []; customers = []; approvals = []; profile = nil
    }

    func addTask(_ title: String) async {
        guard let profile, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        await write { root in
            try await root.collection("tasks").addDocument(data: ["workspace_id": profile.workspaceID, "title": title.trimmingCharacters(in: .whitespacesAndNewlines), "done": false, "created_by": self.actorID, "created_at": FieldValue.serverTimestamp(), "updated_at": FieldValue.serverTimestamp()])
        }
    }

    func toggle(_ task: OfficeTask) async {
        await write { root in
            try await root.collection("tasks").document(task.id).updateData(["done": !task.done, "updated_at": FieldValue.serverTimestamp()])
        }
    }

    func addCustomer(name: String, email: String, phone: String) async {
        guard let profile, !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        await write { root in
            try await root.collection("customers").addDocument(data: ["workspace_id": profile.workspaceID, "name": name.trimmingCharacters(in: .whitespacesAndNewlines), "email": email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), "phone": phone.trimmingCharacters(in: .whitespacesAndNewlines), "status": "Active", "created_by": self.actorID, "created_at": FieldValue.serverTimestamp(), "updated_at": FieldValue.serverTimestamp()])
        }
    }

    func requestApproval(title: String, details: String) async {
        guard let profile, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        await write { root in
            try await root.collection("approvals").addDocument(data: ["workspace_id": profile.workspaceID, "title": title.trimmingCharacters(in: .whitespacesAndNewlines), "details": details.trimmingCharacters(in: .whitespacesAndNewlines), "status": "Pending", "created_by": self.actorID, "created_at": FieldValue.serverTimestamp(), "updated_at": FieldValue.serverTimestamp()])
        }
    }

    func decide(_ approval: Approval, status: String) async {
        guard profile?.role.canApprove == true else { return }
        await write { root in
            try await root.collection("approvals").document(approval.id).updateData(["status": status, "decided_by": self.actorID, "decided_at": FieldValue.serverTimestamp(), "updated_at": FieldValue.serverTimestamp()])
        }
    }

    private func write(_ operation: (DocumentReference) async throws -> Void) async {
        guard let profile else { return }
        do { try await operation(Firestore.firestore().collection("workspaces").document(profile.workspaceID)) }
        catch { notice = "That workspace change could not be saved. Check your connection and permissions, then try again." }
    }

    private func receiveTasks(_ snapshot: QuerySnapshot?, _ error: Error?) {
        if let error { notice = workspaceMessage(for: error); return }
        tasks = (snapshot?.documents ?? []).compactMap { OfficeTask(id: $0.documentID, data: $0.data()) }.sorted { !$0.done && $1.done }
    }
    private func receiveCustomers(_ snapshot: QuerySnapshot?, _ error: Error?) {
        if let error { notice = workspaceMessage(for: error); return }
        customers = (snapshot?.documents ?? []).compactMap { Customer(id: $0.documentID, data: $0.data()) }.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
    private func receiveApprovals(_ snapshot: QuerySnapshot?, _ error: Error?) {
        if let error { notice = workspaceMessage(for: error); return }
        approvals = (snapshot?.documents ?? []).compactMap { Approval(id: $0.documentID, data: $0.data()) }.sorted { $0.status == "Pending" && $1.status != "Pending" }
    }

    private func workspaceMessage(for error: Error) -> String {
        let detail = error.localizedDescription.lowercased()
        if detail.contains("permission") || detail.contains("denied") {
            return "Your account does not have permission for this workspace. Ask your OverHead administrator to review your role."
        }
        if detail.contains("network") || detail.contains("unavailable") {
            return "OverHead cannot reach the workspace right now. Check your connection; saved data will synchronize when service returns."
        }
        return "The workspace could not synchronize right now. Your changes will retry when a connection is available."
    }
}
