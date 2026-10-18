import Foundation
import FirebaseFirestore

enum WorkspaceRole: String, Codable, CaseIterable {
    case administrator = "Administrator"
    case manager = "Manager"
    case staff = "Staff"

    var canApprove: Bool { self == .administrator || self == .manager }
    var canManagePeople: Bool { self == .administrator }
}

struct WorkspaceProfile: Identifiable, Equatable {
    let id: String
    let workspaceID: String
    let ownerName: String
    let businessName: String
    let email: String
    let role: WorkspaceRole
    let status: String

    init?(id: String, data: [String: Any]) {
        guard let workspaceID = data["workspace_id"] as? String,
              let email = data["email"] as? String,
              let roleValue = data["role"] as? String,
              let role = WorkspaceRole(rawValue: roleValue) else { return nil }
        self.id = id
        self.workspaceID = workspaceID
        self.ownerName = data["owner_name"] as? String ?? email
        self.businessName = data["business_name"] as? String ?? "OverHead workspace"
        self.email = email
        self.role = role
        self.status = data["status"] as? String ?? "Active"
    }
}

struct OfficeTask: Identifiable, Equatable {
    let id: String
    let title: String
    let done: Bool

    init?(id: String, data: [String: Any]) {
        guard let title = data["title"] as? String else { return nil }
        self.id = id
        self.title = title
        self.done = data["done"] as? Bool ?? false
    }
}

struct Customer: Identifiable, Equatable {
    let id: String
    let name: String
    let email: String
    let phone: String
    let status: String

    init?(id: String, data: [String: Any]) {
        guard let name = data["name"] as? String else { return nil }
        self.id = id
        self.name = name
        self.email = data["email"] as? String ?? ""
        self.phone = data["phone"] as? String ?? ""
        self.status = data["status"] as? String ?? "Active"
    }
}

struct Approval: Identifiable, Equatable {
    let id: String
    let title: String
    let details: String
    let status: String

    init?(id: String, data: [String: Any]) {
        guard let title = data["title"] as? String else { return nil }
        self.id = id
        self.title = title
        self.details = data["details"] as? String ?? ""
        self.status = data["status"] as? String ?? "Pending"
    }
}

enum AppIssue: LocalizedError {
    case message(String)

    var errorDescription: String? {
        switch self { case .message(let value): return value }
    }
}
