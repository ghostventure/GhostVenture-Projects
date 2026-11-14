import Foundation

struct OverHeadUpdateManifest: Decodable {
    var version: String
    var minimumSystemVersion: String
    var downloadURL: String
    var notes: String
}

enum WorkspaceRole: String, CaseIterable, Codable, Identifiable {
    case owner = "Owner"
    case frontDesk = "Front Desk"
    case bookkeeper = "Bookkeeper"
    case support = "Support"
    case customer = "Customer"
    var id: String { rawValue }
}

struct LocalProfile: Codable, Identifiable {
    var id: String
    var ownerName: String
    var businessName: String
    var email: String
    var role: WorkspaceRole
    var acceptedTerms: Bool
    var passwordSalt: Data
    var passwordDigest: Data
    var recoveryDigest: Data
    var createdAt: Date
    var firebaseUID: String
    var workspaceID: String
    var firebaseIDToken: String
    var firebaseRefreshToken: String
    var firebaseTokenExpiry: Date?
    var sharedRole: String
    var emailVerified: Bool
    var status: String
}

struct WorkspaceRecord: Codable, Identifiable, Hashable {
    var id: String = UUID().uuidString
    var fields: [String: String] = [:]
    var createdAt: Date = .now
    var updatedAt: Date = .now

    subscript(_ key: String) -> String {
        get { fields[key] ?? "" }
        set { fields[key] = newValue }
    }

    var title: String {
        self["title"].nonEmpty ?? self["business_name"].nonEmpty ?? self["name"].nonEmpty ?? self["subject"].nonEmpty ?? self["label"].nonEmpty ?? "Untitled record"
    }
    var status: String { self["status"].nonEmpty ?? "Open" }
}

struct WorkspaceArchive: Codable {
    var version = 1
    var profiles: [LocalProfile] = []
    var activeProfileID: String?
    var activePlan = "gold"
    var records: [String: [WorkspaceRecord]] = [:]
    var settings: [String: String] = [
        "theme": "system", "privacyMode": "true", "inactivityMinutes": "30",
        "remindersEnabled": "true", "requireOwnerApproval": "true",
        "backupFrequency": "weekly", "notificationsEnabled": "true"
    ]
    var auditAnchor = Data()
    var updatedAt = Date.now
}

extension String {
    var nonEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

enum WorkspaceSection: String, CaseIterable, Identifiable {
    case overview, work, customers, imports, automations, evidence, support, tools
    case accounts, licenses, plans, payments, square, security, settings

    var id: String { rawValue }
    var title: String {
        switch self {
        case .overview: "Team Dashboard"
        case .work: "Workflows"
        case .customers: "Customers"
        case .imports: "Import"
        case .automations: "Automations"
        case .evidence: "Evidence"
        case .support: "Support"
        case .tools: "Tools"
        case .accounts: "Accounts"
        case .licenses: "Licenses"
        case .plans: "Plans"
        case .payments: "Payments"
        case .square: "Square"
        case .security: "Security"
        case .settings: "Settings"
        }
    }
    var subtitle: String {
        switch self {
        case .overview: "Priorities, ownership, readiness"
        case .work: "Scheduling, answers, quotes"
        case .customers: "Profiles, rules, service history"
        case .imports: "Microsoft 365 and Business Central"
        case .automations: "Jobs, reminders, queues"
        case .evidence: "Integrity, logs, audit trail"
        case .support: "Legal, tickets, help paths"
        case .tools: "PDFs, exports, utilities"
        case .accounts: "Users, roles, manager profiles"
        case .licenses: "User subscriptions and team access"
        case .plans: "Price, billing, access"
        case .payments: "Stripe verify, import data"
        case .square: "Browser verify, import data"
        case .security: "Recovery, privacy, compliance"
        case .settings: "Themes, toggles, backup"
        }
    }
    var symbol: String {
        switch self {
        case .overview: "gauge.with.dots.needle.67percent"
        case .work: "point.3.connected.trianglepath.dotted"
        case .customers: "person.2"
        case .imports: "square.and.arrow.down"
        case .automations: "sparkles"
        case .evidence: "checkmark.shield"
        case .support: "lifepreserver"
        case .tools: "wrench.and.screwdriver"
        case .accounts: "person.crop.circle.badge.gearshape"
        case .licenses: "checkmark.seal"
        case .plans: "creditcard"
        case .payments: "dollarsign.arrow.circlepath"
        case .square: "square.grid.2x2"
        case .security: "lock.shield"
        case .settings: "gearshape"
        }
    }
    var dataKey: String? {
        switch self {
        case .overview: nil
        case .work: "workflows"
        case .customers: "customers"
        case .imports: "imports"
        case .automations: "workflowJobs"
        case .evidence: "auditEvents"
        case .support: "supportTickets"
        case .tools: "documents"
        case .accounts: "userProfiles"
        case .licenses: "employeeLicenses"
        case .plans: "subscriptions"
        case .payments: "paymentRecords"
        case .square: "squareImports"
        case .security: "dataRequests"
        case .settings: "settings"
        }
    }
    var extraDataKeys: [String] {
        switch self {
        case .work: ["appointments", "quotes", "invoices", "tasks", "answerLibrary"]
        case .customers: ["workflowPreferences", "customerDocuments"]
        case .imports: ["microsoftConnections", "importPreviews"]
        case .automations: ["tasks", "workflowJobs", "appToggles"]
        case .evidence: ["tamperEvents", "integritySnapshots", "auditEvents"]
        case .support: ["legalDocuments", "legalAcknowledgements", "supportTickets"]
        case .tools: ["backupHistory", "dataExports", "dataRequests"]
        case .accounts: ["userProfiles", "managerProfiles", "approvalRequests"]
        case .licenses: ["licenses", "employeeLicenses"]
        case .plans: ["subscriptions", "billingProfiles", "entitlements"]
        case .payments: ["stripeConnections", "stripeImports", "paymentRecords"]
        case .square: ["squareConnections", "squareImports"]
        case .security: ["fraudSignals", "dataRequests", "complianceEvents"]
        case .settings: ["settings", "appToggles", "backupHistory"]
        case .overview: []
        }
    }
}
