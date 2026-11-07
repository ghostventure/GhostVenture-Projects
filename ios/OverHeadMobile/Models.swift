import FirebaseFirestore
import Foundation

struct QuickTask: Identifiable {
    let id: String
    var title: String
    var customerId: String?
    var customerName: String?
    var dueLabel: String
    var done: Bool
    var kind: TaskKind

    init(id: String, title: String, customerId: String? = nil, customerName: String? = nil, dueLabel: String = "", done: Bool = false, kind: TaskKind = .task) {
        self.id = id
        self.title = title
        self.customerId = customerId
        self.customerName = customerName
        self.dueLabel = dueLabel
        self.done = done
        self.kind = kind
    }

    init(document: QueryDocumentSnapshot, customersById: [String: Customer]) {
        let data = document.data()
        id = document.documentID
        title = data["title"] as? String ?? "Untitled task"
        customerId = data["customer_id"] as? String
        customerName = customerId.flatMap { customersById[$0]?.name }
        dueLabel = Self.dueLabel(from: data["due_at"])
        done = data["done"] as? Bool ?? (data["status"] as? String == "Complete")
        kind = TaskKind.from(data["kind"] as? String ?? "")
    }

    private static func dueLabel(from value: Any?) -> String {
        if let timestamp = value as? Timestamp {
            return timestamp.dateValue().formatted(date: .abbreviated, time: .shortened)
        }
        return value as? String ?? ""
    }
}

enum TaskKind: String, Hashable {
    case appointment
    case followUp
    case task

    static func from(_ value: String) -> TaskKind {
        switch value.lowercased().replacingOccurrences(of: "-", with: "").replacingOccurrences(of: "_", with: "") {
        case "appointment": .appointment
        case "followup": .followUp
        default: .task
        }
    }

    var title: String {
        switch self {
        case .appointment: "Appointment"
        case .followUp: "Follow-up"
        case .task: "Task"
        }
    }

    var storageValue: String {
        switch self {
        case .appointment: "appointment"
        case .followUp: "follow_up"
        case .task: "task"
        }
    }
}

struct Customer: Identifiable, Hashable {
    let id: String
    let name: String
    let email: String
    let phone: String
    let detail: String

    var initials: String {
        name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined()
    }

    init(document: QueryDocumentSnapshot) {
        let data = document.data()
        id = document.documentID
        name = data["name"] as? String ?? data["business_name"] as? String ?? data["owner_name"] as? String ?? "Customer"
        email = data["email"] as? String ?? ""
        phone = data["phone"] as? String ?? ""
        let area = data["service_area"] as? String ?? ""
        let status = data["status"] as? String ?? "Active"
        detail = [area, status].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    init(id: String, name: String, email: String, phone: String, detail: String) {
        self.id = id
        self.name = name
        self.email = email
        self.phone = phone
        self.detail = detail
    }
}

struct QuickNote: Identifiable, Codable {
    var id: String
    var text: String
    var customer: String?
    var createdAt: Date
}

struct Approval: Identifiable {
    let id: String
    let title: String
    let details: String
    let status: String
    let createdAt: Date?

    init(document: QueryDocumentSnapshot) {
        let data = document.data()
        id = document.documentID
        title = data["title"] as? String ?? "Approval request"
        details = data["details"] as? String ?? ""
        status = data["status"] as? String ?? "Pending"
        createdAt = (data["created_at"] as? Timestamp)?.dateValue()
    }
}
