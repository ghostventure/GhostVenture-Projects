import CryptoKit
import AppKit
import Foundation
import Observation
import Security

@MainActor
@Observable
final class OverHeadStore {
    var archive = WorkspaceArchive()
    var errorMessage: String?
    var notice = ""
    var isSignedIn = false
    var isLocked = false
    var privacyMode = true
    var selectedSection: WorkspaceSection = .overview
    var lastIntegrityStatus = "Not checked"
    var microsoftProgress = ""
    var microsoftUserCode = ""
    var microsoftVerificationURL: URL?
    var isConnectingMicrosoft = false
    var microsoftPreviewContacts: [MicrosoftContact] = []
    var microsoftCompanies: [(id: String, name: String)] = []
    var microsoftPreviewConnectionID = ""
    var billingSyncMessage = "Not checked"
    var isSyncingBilling = false
    var updateCheckStatus = "Not checked"
    var updateAvailableVersion = ""
    var updateDownloadURL: URL?
    var updateNotes = ""
    var lastUpdateCheck: Date?

    private(set) var profile: LocalProfile?
    private let fileManager = FileManager.default
    private let service = "com.blacklion.overhead.native.local-store-v1"

    var displayName: String { profile?.ownerName ?? "" }
    var businessName: String { profile?.businessName ?? "" }
    var role: WorkspaceRole { profile?.role ?? .owner }
    var isConfigured: Bool { !archive.profiles.isEmpty }
    var customers: [WorkspaceRecord] { records("customers") }
    var tasks: [WorkspaceRecord] { records("tasks") }
    var openTaskCount: Int { tasks.filter { !["Complete", "Closed"].contains($0.status) }.count }
    var overdueTaskCount: Int {
        tasks.filter { task in
            guard let raw = task["due_at"].nonEmpty, let date = ISO8601DateFormatter().date(from: raw) else { return false }
            return date < .now && !["Complete", "Closed"].contains(task.status)
        }.count
    }
    var pendingApprovalCount: Int { records("approvalRequests").filter { $0.status == "Pending" }.count }
    var canManageWorkspace: Bool { role == .owner }

    init() { load() }

    var installedVersion: String { Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0" }

    func checkForUpdates() async {
        guard let url = URL(string: "https://overhead-office.web.app/updates/mac/latest.json") else { return }
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        request.timeoutInterval = 12
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                updateCheckStatus = "Could not check for updates"
                lastUpdateCheck = .now
                return
            }
            let update = try JSONDecoder().decode(OverHeadUpdateManifest.self, from: data)
            lastUpdateCheck = .now
            updateNotes = update.notes
            updateDownloadURL = URL(string: update.downloadURL)
            updateAvailableVersion = Self.isVersion(update.version, newerThan: installedVersion) ? update.version : ""
            updateCheckStatus = updateAvailableVersion.isEmpty ? "You're up to date · \(installedVersion)" : "Update available · \(update.version)"
        } catch {
            updateCheckStatus = "Could not check for updates"
            lastUpdateCheck = .now
        }
    }

    private static func isVersion(_ candidate: String, newerThan installed: String) -> Bool {
        func parts(_ value: String) -> [Int] {
            value.split(separator: ".").map { component in
                Int(component.prefix(while: \.isNumber)) ?? 0
            }
        }
        let lhs = parts(candidate), rhs = parts(installed)
        for index in 0..<max(lhs.count, rhs.count) {
            let left = index < lhs.count ? lhs[index] : 0
            let right = index < rhs.count ? rhs[index] : 0
            if left != right { return left > right }
        }
        return false
    }

    func records(_ key: String) -> [WorkspaceRecord] { archive.records[key] ?? [] }
    func records(for section: WorkspaceSection) -> [(String, [WorkspaceRecord])] {
        let keys = section.dataKey.map { [$0] + section.extraDataKeys } ?? section.extraDataKeys
        var seen = Set<String>()
        return keys.filter { seen.insert($0).inserted }.map { ($0, records($0)) }
    }

    func signIn(email: String, password: String, accessLane: String = "team") async {
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        do {
            if let index = archive.profiles.firstIndex(where: { $0.email == normalized }), archive.profiles[index].firebaseUID.isEmpty {
                let account = archive.profiles[index]
                guard account.status == "Active" else { throw FirebaseWorkspaceError.message("This local account is not active. Ask the workspace owner to review its status.") }
                guard (accessLane == "customer") == (account.role == .customer) else { throw FirebaseWorkspaceError.message(accessLane == "customer" ? "This is a team account. Choose Team Access." : "This is a customer account. Choose Customer Access.") }
                guard constantTimeEqual(derive(password, salt: account.passwordSalt), account.passwordDigest) else {
                    throw FirebaseWorkspaceError.message("That email or password did not match an OverHead account.")
                }
                try activate(account)
            } else {
                let identity = try await FirebaseWorkspaceAPI.signIn(email: normalized, password: password, accessLane: accessLane)
                if let index = archive.profiles.firstIndex(where: { $0.email == normalized }) {
                    archive.profiles[index].firebaseUID = identity.uid
                    archive.profiles[index].workspaceID = identity.workspaceID
                    archive.profiles[index].firebaseIDToken = identity.idToken
                    archive.profiles[index].firebaseRefreshToken = identity.refreshToken
                    archive.profiles[index].firebaseTokenExpiry = Date.now.addingTimeInterval(identity.expiresIn)
                    archive.profiles[index].sharedRole = identity.sharedRole
                    archive.profiles[index].emailVerified = true
                    archive.profiles[index].ownerName = identity.ownerName
                    archive.profiles[index].businessName = identity.businessName
                    archive.profiles[index].role = identity.role
                    let salt = randomData(count: 16)
                    archive.profiles[index].passwordSalt = salt
                    archive.profiles[index].passwordDigest = derive(password, salt: salt)
                    try activate(archive.profiles[index])
                } else {
                    let salt = randomData(count: 16)
                    let account = LocalProfile(
                        id: UUID().uuidString, ownerName: identity.ownerName, businessName: identity.businessName,
                        email: normalized, role: identity.role, acceptedTerms: true,
                        passwordSalt: salt, passwordDigest: derive(password, salt: salt), recoveryDigest: Data(), createdAt: .now,
                        firebaseUID: identity.uid, workspaceID: identity.workspaceID, firebaseIDToken: identity.idToken,
                        firebaseRefreshToken: identity.refreshToken,
                        firebaseTokenExpiry: Date.now.addingTimeInterval(identity.expiresIn), sharedRole: identity.sharedRole, emailVerified: true, status: "Active"
                    )
                    archive.profiles.append(account)
                    try activate(account)
                }
                appendAudit("auth.shared_sign_in", "Shared OverHead account signed in", details: "\(normalized) · \(identity.workspaceID)")
                persist()
            }
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }

    func createAccount(ownerName: String, businessName: String, email: String, password: String, recoveryPhrase: String, role: WorkspaceRole, acceptedTerms: Bool, plan: String) async {
        let cleanName = ownerName.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanBusiness = businessName.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard cleanName.count >= 2, !cleanBusiness.isEmpty else { errorMessage = "Enter your name and business name."; return }
        guard cleanEmail.contains("@"), cleanEmail.split(separator: "@").last?.contains(".") == true else { errorMessage = "Enter a valid email address."; return }
        guard !password.isEmpty, password.count >= 12 else { errorMessage = "Use a password with at least 12 characters."; return }
        guard recoveryPhrase.trimmingCharacters(in: .whitespacesAndNewlines).count >= 8 else { errorMessage = "Create a recovery phrase with at least 8 characters."; return }
        guard acceptedTerms else { errorMessage = "Accept the Terms of Use and Privacy Notice to continue."; return }
        guard !archive.profiles.contains(where: { $0.email == cleanEmail }) else { errorMessage = "An account already exists for that email. Choose Sign in instead."; return }
        guard !archive.profiles.contains(where: { $0.email == cleanEmail }) else { errorMessage = "An account already exists for that email. Choose Sign in instead."; return }
        guard role == .owner else { errorMessage = "The first profile is the workspace owner. Invite other roles from Accounts after setup."; return }
        do {
            let identity = try await FirebaseWorkspaceAPI.register(ownerName: cleanName, businessName: cleanBusiness, email: cleanEmail, password: password)
            let salt = randomData(count: 16)
            let account = LocalProfile(
            id: UUID().uuidString,
            ownerName: cleanName,
            businessName: cleanBusiness,
            email: cleanEmail,
            role: role,
            acceptedTerms: true,
            passwordSalt: salt,
            passwordDigest: derive(password, salt: salt),
            recoveryDigest: SHA256.hash(data: Data(recoveryPhrase.lowercased().utf8)).data,
            createdAt: .now,
            firebaseUID: identity.uid,
            workspaceID: identity.workspaceID,
                firebaseIDToken: identity.idToken,
            firebaseRefreshToken: identity.refreshToken,
            firebaseTokenExpiry: Date.now.addingTimeInterval(identity.expiresIn),
            sharedRole: identity.sharedRole,
            emailVerified: false,
            status: "Pending verification"
            )
            archive.profiles.append(account)
            archive.activeProfileID = account.id
            archive.activePlan = plan
            profile = account
            seedWorkspace()
            appendAudit("auth.account_created", "Shared workspace created", details: cleanEmail)
            persist()
            profile = nil
            isSignedIn = false
            isLocked = false
            notice = "Verification email sent to \(cleanEmail). Verify the address, then sign in to use the workspace."
            errorMessage = nil
            notice = "Verification email sent to \(cleanEmail). Verify the address, then sign in to use the workspace."
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }

    func recoverAccount(email: String, recoveryPhrase: String, newPassword: String) async {
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard let index = archive.profiles.firstIndex(where: { $0.email == normalized }) else { errorMessage = "No local account matches that email."; return }
        if !archive.profiles[index].firebaseUID.isEmpty {
            do { try await FirebaseWorkspaceAPI.sendPasswordReset(email: normalized); notice = "Firebase sent a password reset link to \(normalized). After resetting it, sign in with the new password."; errorMessage = nil }
            catch { errorMessage = error.localizedDescription }
            return
        }
        guard newPassword.count >= 12 else { errorMessage = "Use a password with at least 12 characters."; return }
        let digest = SHA256.hash(data: Data(recoveryPhrase.lowercased().utf8)).data
        guard constantTimeEqual(digest, archive.profiles[index].recoveryDigest) else { errorMessage = "The recovery phrase did not match."; return }
        let salt = randomData(count: 16)
        archive.profiles[index].passwordSalt = salt
        archive.profiles[index].passwordDigest = derive(newPassword, salt: salt)
        persist()
        notice = "Password updated. Sign in with your new password."
    }

    func signOut() {
        if let profile { appendAudit("auth.sign_out", "Signed out", details: profile.email) }
        profile = nil
        isSignedIn = false
        isLocked = false
        privacyMode = true
        archive.activeProfileID = nil
        persist()
    }

    func createSupportRequest(subject: String, details: String) async {
        guard let profile, !profile.firebaseIDToken.isEmpty else {
            createSupportTicket(subject: subject, details: details, priority: "Normal")
            return
        }
        let clean = subject.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, !details.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Add a subject and short description before sending."; return
        }
        do {
            let token = try await refreshSharedTokenIfNeeded() ?? profile.firebaseIDToken
            let ticket = UUID().uuidString
            let timestamp = ISO8601DateFormatter().string(from: .now)
            try await FirebaseWorkspaceAPI.writeDocument("workspaces/\(profile.workspaceID)/support_tickets/\(ticket)", fields: [
                "workspace_id": profile.workspaceID, "created_by": profile.firebaseUID,
                "customer_id": "", "subject": clean, "priority": "Normal", "status": "Open",
                "details": details, "created_at": timestamp, "updated_at": timestamp
            ], token: token)
            _ = addRecord("supportTickets", fields: ["id": ticket, "subject": clean, "title": clean, "details": details, "priority": "Normal", "status": "Open", "created_at": timestamp])
            notice = "Your support request was sent to the OverHead Team."
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }

    func createCustomerPortalInvite(for customer: WorkspaceRecord) async {
        guard canManageWorkspace else { errorMessage = "Only an owner can create customer portal invitations."; return }
        guard let email = customer["email"].nonEmpty else { errorMessage = "Add an email address to the customer profile first."; return }
        guard let owner = profile, !owner.firebaseUID.isEmpty else { errorMessage = "Sign in with your shared OverHead owner account to invite customer access."; return }
        do {
            let token = try await refreshSharedTokenIfNeeded() ?? owner.firebaseIDToken
            let address = email.lowercased()
            try await FirebaseWorkspaceAPI.writeDocument("workspaces/\(owner.firebaseUID)/invites/\(address)", fields: [
                "email": address, "role": "Customer", "workspace_id": owner.firebaseUID,
                "customer_id": customer.id, "business_name": customer.title,
                "created_at": ISO8601DateFormatter().string(from: .now), "updated_at": ISO8601DateFormatter().string(from: .now)
            ], token: token)
            _ = addRecord("customerInvites", fields: ["title": "Customer access · \(customer.title)", "customer_name": customer.title, "email": address, "workspace_code": owner.firebaseUID, "status": "Invitation created"])
            notice = "Customer invitation is ready. Share workspace code \(owner.firebaseUID) with \(address) through a secure channel."
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }

    func attachCustomerDocument(_ source: URL, customer: WorkspaceRecord) throws {
        let allowed = Set(["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "png", "jpg", "jpeg"])
        let ext = source.pathExtension.lowercased()
        guard allowed.contains(ext) else { throw StoreError.unsupportedDocument }
        let attributes = try FileManager.default.attributesOfItem(atPath: source.path)
        guard ((attributes[.size] as? NSNumber)?.int64Value ?? 0) <= 25 * 1024 * 1024 else { throw StoreError.documentTooLarge }
        let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("Black Lion Media Studio/OverHead/CustomerDocuments", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let destination = root.appendingPathComponent("\(UUID().uuidString)-\(source.lastPathComponent)")
        let accessed = source.startAccessingSecurityScopedResource()
        defer { if accessed { source.stopAccessingSecurityScopedResource() } }
        try FileManager.default.copyItem(at: source, to: destination)
        _ = addRecord("customerDocuments", fields: ["title": source.lastPathComponent, "customer_name": customer.title, "customer_id": customer.id, "file_name": source.lastPathComponent, "file_path": destination.path, "document_type": ext.uppercased(), "status": "Stored locally"])
        notice = "\(source.lastPathComponent) attached to \(customer.title)."
    }

    func openCustomerDocument(_ record: WorkspaceRecord) {
        let path = record["file_path"]
        guard !path.isEmpty, FileManager.default.fileExists(atPath: path) else { errorMessage = "The customer document is missing from this Mac."; return }
        NSWorkspace.shared.open(URL(fileURLWithPath: path))
    }

    func registerCustomerAccess(email: String, password: String, workspaceID: String) async {
        do {
            try await FirebaseWorkspaceAPI.registerCustomer(email: email, password: password, workspaceID: workspaceID)
            notice = "A verification email was sent to \(email). Verify the address, then sign in using Customer Access."
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }

    func connectMicrosoft(clientID: String, tenantID: String, provider: String, environment: String) async {
        guard canManageWorkspace else { errorMessage = "Only an owner can connect a Microsoft account."; return }
        isConnectingMicrosoft = true
        microsoftProgress = "Requesting a Microsoft device sign-in code…"
        microsoftUserCode = ""
        microsoftVerificationURL = nil
        defer { isConnectingMicrosoft = false }
        do {
            let prompt = try await MicrosoftConnector.begin(clientID: clientID, tenantID: tenantID.isEmpty ? "organizations" : tenantID, provider: provider)
            microsoftUserCode = prompt.userCode
            microsoftVerificationURL = prompt.verificationURL
            microsoftProgress = prompt.message
            NSWorkspace.shared.open(prompt.verificationURL)
            let token = try await MicrosoftConnector.complete(clientID: clientID, tenantID: tenantID.isEmpty ? "organizations" : tenantID, prompt: prompt)
            _ = addRecord("microsoftConnections", fields: [
                "title": provider == "graph" ? "Microsoft 365" : "Business Central",
                "provider": provider, "client_id": clientID, "tenant_id": tenantID.isEmpty ? "organizations" : tenantID,
                "environment": environment, "refresh_token": token.refreshToken, "status": "Connected",
                "connected_at": ISO8601DateFormatter().string(from: .now), "account_username": "Microsoft account"
            ])
            microsoftProgress = "Microsoft connection authorized and saved in the encrypted workspace."
            microsoftUserCode = ""
            microsoftVerificationURL = nil
            notice = microsoftProgress
            errorMessage = nil
        } catch {
            microsoftProgress = "Microsoft sign-in was not completed."
            errorMessage = error.localizedDescription
        }
    }

    func previewMicrosoftImport(connection: WorkspaceRecord, companyID: String = "") async {
        guard canManageWorkspace else { errorMessage = "Only the owner can preview Microsoft imports."; return }
        do {
            let preview = try await MicrosoftConnector.preview(connection: connection, companyID: companyID)
            microsoftPreviewContacts = preview.contacts
            microsoftCompanies = preview.companies
            microsoftPreviewConnectionID = connection.id
            if connection["provider"] == "graph" || !companyID.isEmpty {
                _ = addRecord("importPreviews", fields: ["title": "\(connection.title) customer preview", "provider": connection["provider"], "record_count": "\(preview.contacts.count)", "status": "Review before importing", "created_at": ISO8601DateFormatter().string(from: .now)])
                notice = "Previewed \(preview.contacts.count) Microsoft record\(preview.contacts.count == 1 ? "" : "s"). No customer records were added yet."
            }
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }

    func importMicrosoftPreview(selectedIDs: Set<String>) {
        guard canManageWorkspace else { errorMessage = "Only the owner can import Microsoft customer records."; return }
        let maximum = archive.activePlan == "black" ? 10_000 : archive.activePlan == "gold" ? 1_500 : 250
        var imported = 0, skipped = 0
        for item in microsoftPreviewContacts where selectedIDs.contains(item.id) {
            let duplicate = customers.contains { existing in
                (!item.email.isEmpty && existing["email"].caseInsensitiveCompare(item.email) == .orderedSame)
                    || (existing["external_provider"] == "\(records("microsoftConnections").first(where: { $0.id == microsoftPreviewConnectionID })?["provider"] ?? "")" && existing["external_id"] == item.id)
            }
            if duplicate || customers.count >= maximum { skipped += 1; continue }
            let provider = records("microsoftConnections").first(where: { $0.id == microsoftPreviewConnectionID })?["provider"] ?? "microsoft"
            _ = addRecord("customers", fields: [
                "business_name": item.businessName, "owner_name": item.ownerName, "email": item.email,
                "industry": item.sourceLabel, "service_area": item.serviceArea.isEmpty ? "Imported from Microsoft" : item.serviceArea,
                "preferred_contact": "Email", "status": "Imported - review before outreach",
                "external_provider": provider, "external_connection_id": microsoftPreviewConnectionID, "external_id": item.id
            ])
            imported += 1
        }
        microsoftPreviewContacts = []
        appendAudit("microsoft.customers_imported", "Microsoft customer records imported", details: "Imported \(imported), skipped \(skipped)")
        notice = "Imported \(imported) Microsoft record\(imported == 1 ? "" : "s"); skipped \(skipped) duplicate or over-limit record\(skipped == 1 ? "" : "s"). Review each record before outreach."
    }

    func refreshSharedTokenIfNeeded() async throws -> String? {
        guard let index = archive.profiles.firstIndex(where: { $0.id == profile?.id }), !archive.profiles[index].firebaseUID.isEmpty else { return nil }
        if let expiry = archive.profiles[index].firebaseTokenExpiry, expiry.timeIntervalSinceNow > 120 { return archive.profiles[index].firebaseIDToken }
        let refreshed = try await FirebaseWorkspaceAPI.refreshToken(archive.profiles[index].firebaseRefreshToken)
        archive.profiles[index].firebaseIDToken = refreshed.idToken
        archive.profiles[index].firebaseRefreshToken = refreshed.refreshToken
        archive.profiles[index].firebaseTokenExpiry = Date.now.addingTimeInterval(refreshed.expiresIn)
        persist()
        return refreshed.idToken
    }

    private func activate(_ account: LocalProfile) throws {
        guard account.status == "Active" else { throw FirebaseWorkspaceError.message("This local account is not active. Ask the workspace owner to review its status.") }
        profile = account
        archive.activeProfileID = account.id
        isSignedIn = true
        isLocked = false
        privacyMode = archive.settings["privacyMode"] == "true"
        persist()
    }

    var needsTermsAcceptance: Bool { isSignedIn && profile?.acceptedTerms == false }

    func acceptWorkspaceTerms() {
        guard let id = profile?.id, let index = archive.profiles.firstIndex(where: { $0.id == id }) else { return }
        archive.profiles[index].acceptedTerms = true
        profile = archive.profiles[index]
        _ = addRecord("legalAcknowledgements", fields: ["title": "Terms of Use and Privacy Notice", "email": profile?.email ?? "", "status": "Acknowledged", "accepted_at": ISO8601DateFormatter().string(from: .now)])
        notice = "Workspace terms acknowledged."
    }

    func lockSession() { isLocked = true; privacyMode = true; persist() }

    func createStaffAccount(name: String, email: String, role: WorkspaceRole, temporaryPassword: String, recoveryPhrase: String) {
        guard canManageWorkspace else { errorMessage = "Only the workspace owner can invite staff."; return }
        guard [.frontDesk, .bookkeeper, .support].contains(role) else { errorMessage = "Choose Front Desk, Bookkeeper, or Support for a staff account."; return }
        let maximum = archive.activePlan == "black" ? 10 : archive.activePlan == "gold" ? 3 : 1
        guard archive.profiles.count < maximum else { errorMessage = "The \(archive.activePlan.capitalized) plan allows up to \(maximum) profile(s). Review Plans before adding staff."; return }
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty, normalized.contains("@"), !archive.profiles.contains(where: { $0.email == normalized }) else { errorMessage = "Enter a new, valid staff email address."; return }
        guard temporaryPassword.count >= 12, recoveryPhrase.count >= 8 else { errorMessage = "Use a temporary password with 12 characters and a recovery phrase with 8 characters."; return }
        let salt = randomData(count: 16)
        let staff = LocalProfile(id: UUID().uuidString, ownerName: name, businessName: businessName, email: normalized, role: role, acceptedTerms: false, passwordSalt: salt, passwordDigest: derive(temporaryPassword, salt: salt), recoveryDigest: SHA256.hash(data: Data(recoveryPhrase.lowercased().utf8)).data, createdAt: .now, firebaseUID: "", workspaceID: "", firebaseIDToken: "", firebaseRefreshToken: "", firebaseTokenExpiry: nil, sharedRole: role.rawValue, emailVerified: false, status: "Active")
        archive.profiles.append(staff)
        _ = addRecord("userProfiles", fields: ["id": staff.id, "name": name, "email": normalized, "role": role.rawValue, "status": "Active", "recovery_hint": "Recovery phrase issued at invitation", "workspace_access": "Local Mac workspace"])
        _ = addRecord("licenses", fields: ["title": "Workspace license · \(name)", "email": normalized, "tier": archive.activePlan, "status": "Active", "license_number": UUID().uuidString])
        _ = addRecord("approvalRequests", fields: ["title": "Staff access: \(name)", "details": "Owner-created local workspace profile.", "action_type": "staff_access", "status": "Approved", "requested_by": profile?.email ?? ""])
        appendAudit("staff.invited", "Workspace staff profile created", details: "\(normalized) · \(role.rawValue)")
        persist()
        errorMessage = nil
        notice = "Staff profile created. Share the temporary password and recovery phrase with \(name) through a secure channel."
    }

    func unlock(password: String) {
        guard let profile, constantTimeEqual(derive(password, salt: profile.passwordSalt), profile.passwordDigest) else {
            errorMessage = "That password did not unlock this session."; return
        }
        isLocked = false
        privacyMode = false
        appendAudit("security.session_unlocked", "Session unlocked", details: profile.email)
        persist()
    }

    @discardableResult
    func addRecord(_ key: String, fields: [String: String], auditTitle: String? = nil) -> WorkspaceRecord {
        var record = WorkspaceRecord(fields: fields)
        if let suppliedID = fields["id"]?.nonEmpty { record.id = suppliedID }
        record["created_at"] = ISO8601DateFormatter().string(from: record.createdAt)
        record["updated_at"] = record["created_at"]
        archive.records[key, default: []].insert(record, at: 0)
        appendAudit("record.created", auditTitle ?? "Created \(record.title)", details: key)
        persist()
        notice = "\(record.title) saved."
        switch key {
        case "customers":
            let customerID = record.id
            _ = addRecord("workflowPreferences", fields: [
                "customer_id": customerID, "customer_name": record.title,
                "booking_rules": "Capture the service request, address, timing window, contact preference, and deposit requirement before confirming a booking.",
                "answer_tone": "Friendly, direct, and short. Confirm details before promising price or availability.",
                "quote_rules": "Do not quote outside approved services. Send exceptions to the owner for review.",
                "invoice_rules": "Create the invoice only after the service details are confirmed.",
                "followup_rules": "Send a service confirmation after the request is reviewed.",
                "human_review_required": "Yes", "status": "Active"
            ])
            _ = addRecord("tasks", fields: ["title": "\(record.title): review customer setup", "customer_id": customerID, "customer_name": record.title, "area": "Customers", "status": "Open", "priority": "Normal", "due_at": ISO8601DateFormatter().string(from: .now)])
        case "appointments":
            _ = addRecord("workflowJobs", fields: ["title": "Appointment reminder: \(record.title)", "type": "office.reminder", "run_at": record["scheduled_for"].nonEmpty ?? ISO8601DateFormatter().string(from: .now), "status": "Queued", "attempts": "0", "appointment_id": record.id])
        case "quotes":
            _ = addRecord("approvalRequests", fields: ["title": "Review quote: \(record.title)", "details": "Review amount, line items, and customer-specific pricing before sending.", "action_type": "quote_send", "status": record["approval_required"] == "No" ? "Not required" : "Pending", "requested_by": profile?.email ?? ""])
            _ = addRecord("tasks", fields: ["title": "Follow up on quote: \(record.title)", "customer_name": record["customer_name"], "area": "Quotes", "status": "Open", "priority": "Normal", "due_at": record["expires_at"].nonEmpty ?? ISO8601DateFormatter().string(from: .now)])
        case "invoices":
            _ = addRecord("tasks", fields: ["title": "Review invoice payment: \(record.title)", "customer_name": record["customer_name"], "area": "Invoices", "status": "Open", "priority": "Normal", "due_at": record["due_at"].nonEmpty ?? ISO8601DateFormatter().string(from: .now)])
        case "quickNotes":
            _ = addRecord("tasks", fields: ["title": record.title, "details": record["details"], "customer_name": record["customer_name"], "area": "Notes", "status": "Open", "priority": "Normal", "due_at": ISO8601DateFormatter().string(from: .now)])
        case "paymentRecords":
            if ["paid", "trial"].contains(record["payment_status"].lowercased()) {
                let tier = record["tier"].lowercased()
                if ["silver", "gold", "black"].contains(tier) {
                    archive.activePlan = tier
                    _ = addRecord("subscriptions", fields: ["title": "\(tier.capitalized) subscription", "manager_email": record["manager_email"], "tier": tier, "payment_provider": record["provider"], "payment_status": record["payment_status"], "external_customer_id": record["external_customer_id"], "external_subscription_id": record["external_subscription_id"], "status": "Active"])
                    persist()
                }
            }
        default: break
        }
        return record
    }

    func updateRecord(_ key: String, record: WorkspaceRecord, fields: [String: String]) {
        guard let index = archive.records[key]?.firstIndex(where: { $0.id == record.id }) else { return }
        var changed = record
        changed.fields.merge(fields) { _, new in new }
        changed.updatedAt = .now
        changed["updated_at"] = ISO8601DateFormatter().string(from: .now)
        archive.records[key]?[index] = changed
        if key == "userProfiles", let profileIndex = archive.profiles.firstIndex(where: { $0.id == record.id }) {
            if let role = WorkspaceRole(rawValue: changed["role"]) { archive.profiles[profileIndex].role = role }
            if let status = changed["status"].nonEmpty { archive.profiles[profileIndex].status = status }
            if let name = changed["name"].nonEmpty { archive.profiles[profileIndex].ownerName = name }
        }
        appendAudit("record.updated", "Updated \(changed.title)", details: key)
        persist()
        notice = "Changes saved."
    }

    func deleteRecord(_ key: String, id: String) {
        archive.records[key]?.removeAll { $0.id == id }
        appendAudit("record.deleted", "Deleted record", details: key)
        persist()
        notice = "Record deleted."
    }

    func setTaskStatus(_ task: WorkspaceRecord, status: String) {
        updateRecord("tasks", record: task, fields: ["status": status])
    }

    func setSetting(_ key: String, value: String) {
        guard canManageWorkspace else { errorMessage = "Only the owner can change workspace settings."; return }
        archive.settings[key] = value
        appendAudit("settings.changed", "Updated \(key)", details: value)
        persist()
    }

    func setPrivacyMode(_ enabled: Bool) {
        privacyMode = enabled
        archive.settings["privacyMode"] = String(enabled)
        persist()
    }

    func createBackup(at destination: URL) throws {
        let clear = try JSONEncoder.pretty.encode(archive)
        let sealed = try AES.GCM.seal(clear, using: encryptionKey())
        guard let combined = sealed.combined else { throw StoreError.encryptionFailed }
        try (Data("OHENC1\n".utf8) + combined).write(to: destination, options: .atomic)
        appendAudit("backup.created", "Created workspace backup", details: destination.lastPathComponent)
        notice = "Backup created at \(destination.lastPathComponent)."
    }

    func exportArchive(to destination: URL) throws {
        let data = try JSONEncoder.pretty.encode(archive)
        try data.write(to: destination, options: .atomic)
        appendAudit("data.exported", "Exported workspace data", details: destination.lastPathComponent)
        notice = "Workspace export created."
    }

    func importArchive(data: Data, sourceName: String, confirmation: String) throws {
        guard confirmation == "RESTORE" else { throw StoreError.confirmationRequired }
        let prefix = Data("OHENC1\n".utf8)
        let clear: Data
        if data.starts(with: prefix) {
            let box = try AES.GCM.SealedBox(combined: data.dropFirst(prefix.count))
            clear = try AES.GCM.open(box, using: encryptionKey())
        } else {
            clear = data
        }
        let imported = try JSONDecoder.workspace.decode(WorkspaceArchive.self, from: clear)
        guard imported.version == 1 else { throw StoreError.unsupportedArchive }
        let old = archive
        archive = imported
        do { try persistOrThrow() } catch { archive = old; throw error }
        profile = archive.activeProfileID.flatMap { id in archive.profiles.first { $0.id == id } }
        isSignedIn = profile != nil
        appendAudit("data.restored", "Restored workspace backup", details: sourceName)
        notice = "Workspace restored. Verify the records before continuing."
    }

    func importCSV(_ data: Data, into key: String) throws -> Int {
        guard let text = String(data: data, encoding: .utf8) else { throw StoreError.invalidCSV }
        let lines = text.split(whereSeparator: \.isNewline).map(String.init)
        guard let first = lines.first else { throw StoreError.invalidCSV }
        let headers = parseCSVLine(first).map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().replacingOccurrences(of: " ", with: "_") }
        guard !headers.isEmpty else { throw StoreError.invalidCSV }
        var imported = 0
        for line in lines.dropFirst() {
            let values = parseCSVLine(line)
            guard values.contains(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) else { continue }
            let fields = Dictionary(uniqueKeysWithValues: headers.enumerated().map { index, header in
                (header, index < values.count ? values[index].trimmingCharacters(in: .whitespacesAndNewlines) : "")
            })
            _ = addRecord(key, fields: fields, auditTitle: "Imported \(key) record")
            imported += 1
        }
        return imported
    }

    func runIntegrityCheck() {
        var anchor = Data()
        let events = records("auditEvents").sorted { (Int($0["sequence"]) ?? 0) < (Int($1["sequence"]) ?? 0) }
        var valid = true
        for event in events {
            let content = Data("\(event["created_at"])|\(event["event_type"])|\(event.title)|\(event["details"])".utf8)
            anchor = Data(SHA256.hash(data: anchor + content))
            if anchor.base64EncodedString() != event["checksum"] { valid = false; break }
        }
        valid = valid && (events.isEmpty ? archive.auditAnchor.isEmpty : anchor == archive.auditAnchor)
        lastIntegrityStatus = valid ? "Clean" : "Review required"
        notice = valid ? "Workspace integrity check completed. No audit changes were detected." : "Workspace integrity review failed. The audit chain did not match the stored seal."
        addRecord("integritySnapshots", fields: ["title": "Integrity snapshot", "status": lastIntegrityStatus, "created_at": ISO8601DateFormatter().string(from: .now)])
    }

    func createSupportTicket(subject: String, details: String, priority: String) {
        let clean = subject.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { errorMessage = "Enter a support request subject."; return }
        _ = addRecord("supportTickets", fields: ["subject": clean, "title": clean, "details": details, "priority": priority, "status": "Open", "requester": profile?.email ?? ""])
    }

    func acknowledgeLegal(_ title: String) {
        _ = addRecord("legalAcknowledgements", fields: ["title": title, "email": profile?.email ?? "", "status": "Acknowledged", "accepted_at": ISO8601DateFormatter().string(from: .now)])
    }

    func requestApproval(title: String, details: String, actionType: String) {
        _ = addRecord("approvalRequests", fields: ["title": title, "details": details, "action_type": actionType, "status": "Pending", "requested_by": profile?.email ?? ""])
    }

    func decideApproval(_ record: WorkspaceRecord, decision: String, notes: String = "") {
        guard canManageWorkspace else { errorMessage = "Only an owner can decide protected workspace approvals."; return }
        updateRecord("approvalRequests", record: record, fields: ["status": decision, "decision_notes": notes, "decided_by": profile?.email ?? ""])
    }

    func applyCustomerPlaybook(_ customer: WorkspaceRecord, template: String) {
        guard canManageWorkspace || role == .frontDesk else { errorMessage = "Your workspace role cannot change customer playbooks."; return }
        let rules: (String, String, String, String, String, [String])
        switch template {
        case "quote-approval": rules = ("Capture the request before offering an appointment or price.", "Clear and helpful. Do not promise discounts, exceptions, or unavailable service.", "Owner approval is required before any quote outside the standard package is sent.", "Invoice after the approved quote is accepted or service is complete.", "Follow up on unanswered quotes before expiration.", ["Review quote exceptions and customer notes", "Confirm owner approval before sending a nonstandard quote"])
        case "payment-followup": rules = ("Confirm service details and payment expectations before booking.", "Polite and factual. Verify the customer before discussing account details.", "Use approved service and payment terms in every quote.", "Review unpaid invoices at day 3 and day 7 before escalating.", "Request a review after payment; create an owner task before escalation.", ["Review unpaid invoice", "Owner review before final payment escalation"])
        default: rules = ("Capture service request, address, timing, contact preference, and deposit before booking.", "Friendly, direct, and short. Confirm details before promising price or availability.", "Do not quote outside approved services. Send exceptions to the owner for review.", "Create an invoice only after service details are confirmed.", "Send a service confirmation after request review.", ["Review intake details before booking", "Confirm the service scope and timing window"])
        }
        let existing = records("workflowPreferences").first { $0["customer_id"] == customer.id }
        let fields: [String: String] = ["customer_id": customer.id, "customer_name": customer.title, "booking_rules": rules.0, "answer_tone": rules.1, "quote_rules": rules.2, "invoice_rules": rules.3, "followup_rules": rules.4, "human_review_required": "Yes", "playbook": template, "status": "Active"]
        if let existing { updateRecord("workflowPreferences", record: existing, fields: fields) }
        else { _ = addRecord("workflowPreferences", fields: fields) }
        for title in rules.5 { _ = addRecord("tasks", fields: ["title": "\(customer.title): \(title)", "customer_id": customer.id, "customer_name": customer.title, "area": "Workflows", "status": "Open", "priority": "High", "due_at": ISO8601DateFormatter().string(from: .now)]) }
        updateRecord("customers", record: customer, fields: ["status": "Playbook active"])
        appendAudit("playbook.applied", "Customer playbook applied", details: "\(customer.id) · \(template)")
        persist()
        notice = "\(template.replacingOccurrences(of: "-", with: " ").capitalized) playbook applied to \(customer.title)."
    }

    func queueWorkflowJob(type: String, title: String, runAt: Date = .now) {
        guard [.owner, .frontDesk, .support].contains(role) else { errorMessage = "Your role cannot queue workflow jobs."; return }
        _ = addRecord("workflowJobs", fields: ["type": type, "title": title, "run_at": ISO8601DateFormatter().string(from: runAt), "status": "Queued", "attempts": "0", "last_error": ""])
    }

    func processDueJobs() {
        let now = ISO8601DateFormatter().string(from: .now)
        let due = Array(records("workflowJobs").filter { $0.status == "Queued" && ($0["run_at"].isEmpty || $0["run_at"] <= now) }.prefix(10))
        for var job in due {
            let attempts = (Int(job["attempts"]) ?? 0) + 1
            job["attempts"] = "\(attempts)"
            let supported = job["type"] == "office.reminder" || job["type"] == "owner.digest" || job["type"].hasPrefix("workflow.")
            if supported {
                _ = addRecord("tasks", fields: ["title": job.title, "area": job["type"] == "owner.digest" ? "Owner Digest" : "Automation", "status": "Open", "priority": "Normal", "due_at": now, "workflow_job_id": job.id])
                updateRecord("workflowJobs", record: job, fields: ["status": "Complete", "attempts": "\(attempts)", "last_error": "", "updated_at": now])
                appendAudit("workflow.job_completed", "Workflow job completed", details: job.id)
            } else {
                let status = attempts >= 3 ? "Dead Letter" : "Queued"
                let retryDate = Date.now.addingTimeInterval(pow(2.0, Double(attempts)) * 60)
                updateRecord("workflowJobs", record: job, fields: ["status": status, "attempts": "\(attempts)", "last_error": "No local worker is registered for \(job["type"]).", "run_at": status == "Queued" ? ISO8601DateFormatter().string(from: retryDate) : job["run_at"]])
                appendAudit(attempts >= 3 ? "workflow.job_dead_lettered" : "workflow.job_retry_scheduled", "Workflow job needs review", details: job.id)
            }
        }
        notice = due.isEmpty ? "No due workflow jobs were waiting." : "Reviewed \(due.count) due workflow job\(due.count == 1 ? "" : "s")."
    }

    func createFreeTrial(acceptedPolicy: Bool) async {
        guard canManageWorkspace else { errorMessage = "Only the workspace owner can start a trial."; return }
        guard acceptedPolicy else { errorMessage = "Review and accept the Free Trial Policy before starting the trial."; return }
        guard records("subscriptions").isEmpty else { errorMessage = "This workspace already has a subscription or trial record."; return }
        guard let token = try? await refreshSharedTokenIfNeeded() else { errorMessage = "Sign in again with your shared OverHead account before starting billing."; return }
        do {
            let result = try await FirebaseWorkspaceAPI.billing(action: "start_free_gold_trial", payload: ["acceptTrialPolicy": true], idToken: token)
            archive.activePlan = "gold"
            _ = addRecord("subscriptions", fields: ["title": "Gold free trial", "tier": "gold", "payment_provider": "manual", "payment_status": "trial", "status": "Active", "trial_ends_at": result["trialEndsAt"] as? String ?? ""])
            notice = "Gold trial access refreshed from your OverHead account."
        } catch { errorMessage = error.localizedDescription }
    }

    func syncSharedBilling() async {
        guard canManageWorkspace else { errorMessage = "Only the owner can sync shared billing."; return }
        guard let token = try? await refreshSharedTokenIfNeeded() else { errorMessage = "Sign in again with your shared OverHead account before opening billing."; return }
        isSyncingBilling = true
        defer { isSyncingBilling = false }
        do {
            let result = try await FirebaseWorkspaceAPI.billing(action: "entitlements", payload: [:], idToken: token)
            let entitlement = result["entitlement"] as? [String: Any] ?? [:]
            let tier = entitlement["tier"] as? String ?? ""
            let status = entitlement["status"] as? String ?? "No shared plan"
            if !tier.isEmpty { archive.activePlan = tier.lowercased() }
            billingSyncMessage = tier.isEmpty ? "No shared billing record exists yet. No paid plan was activated." : "Shared plan and license refreshed from the same records used by the website."
            _ = addRecord("billingProfiles", fields: ["title": "Shared billing status", "tier": tier, "status": status, "last_synced_at": ISO8601DateFormatter().string(from: .now)])
            let activity = try await FirebaseWorkspaceAPI.billing(action: "billing_activity", payload: [:], idToken: token)
            for event in activity["events"] as? [[String: Any]] ?? [] {
                _ = addRecord("billingActivity", fields: ["title": event["label"] as? String ?? "Billing activity", "occurred_at": event["at"] as? String ?? "", "details": event["detail"] as? String ?? "", "status": "Synced"])
            }
            appendAudit("billing.shared_synced", "Shared billing records refreshed", details: "\(tier) · \(status)")
            notice = billingSyncMessage
            errorMessage = nil
        } catch { billingSyncMessage = error.localizedDescription; errorMessage = error.localizedDescription }
    }

    func saveStripeTestConnection(clientID: String, accountID: String, publishableKey: String) {
        guard canManageWorkspace else { errorMessage = "Only the owner can configure Stripe details."; return }
        let client = clientID.trimmingCharacters(in: .whitespacesAndNewlines)
        let account = accountID.trimmingCharacters(in: .whitespacesAndNewlines)
        let key = publishableKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard key.isEmpty || key.hasPrefix("pk_test_") else { errorMessage = "Only a Stripe test publishable key can be saved here."; return }
        let fields = ["title": "Stripe test connection", "mode": "test", "client_id": client, "account_id": account, "publishable_key": key, "status": "Setup required", "notes": "Test-only setup. No merchant charges are enabled."]
        if let existing = records("stripeConnections").first { updateRecord("stripeConnections", record: existing, fields: fields) }
        else { _ = addRecord("stripeConnections", fields: fields) }
        appendAudit("stripe.test_details_saved", "Stripe test details saved", details: account)
        notice = "Stripe test details saved. This does not connect a live merchant or charge a card."
        errorMessage = nil
    }

    func importStripeReference(fields: [String: String]) {
        guard canManageWorkspace else { errorMessage = "Only the owner can import Stripe reference data."; return }
        _ = addRecord("stripeImports", fields: fields.merging(["status": "Reference only", "imported_at": ISO8601DateFormatter().string(from: .now)]) { _, new in new })
        appendAudit("stripe.reference_imported", "Stripe reference data imported", details: fields["business_name"] ?? fields["account_id"] ?? "")
        notice = "Stripe reference data saved. It does not grant access or change a subscription."
        errorMessage = nil
    }

    func openSquareAuthorization(applicationID: String, environment: String) {
        guard canManageWorkspace else { errorMessage = "Only the owner can start Square verification."; return }
        var components = URLComponents(string: environment == "production" ? "https://connect.squareup.com/oauth2/authorize" : "https://connect.squareupsandbox.com/oauth2/authorize")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: applicationID),
            URLQueryItem(name: "scope", value: "MERCHANT_PROFILE_READ PAYMENTS_READ CUSTOMERS_READ ITEMS_READ ORDERS_READ"),
            URLQueryItem(name: "session", value: "false"),
            URLQueryItem(name: "state", value: UUID().uuidString),
            URLQueryItem(name: "redirect_uri", value: "https://developer.squareup.com/apps")
        ]
        if let url = components.url { NSWorkspace.shared.open(url) }
        appendAudit("square.oauth_opened", "Square browser verification started", details: environment)
        notice = applicationID.isEmpty ? "Square opened. Add an application ID before using the OAuth flow." : "Square opened in your browser. Finish authorization there, then save the connection details."
    }

    func saveSquareConnection(environment: String, applicationID: String, merchantID: String, locationID: String, accessToken: String, refreshToken: String) {
        guard canManageWorkspace else { errorMessage = "Only the owner can configure Square."; return }
        let environment = environment == "production" ? "production" : "sandbox"
        let existing = records("squareConnections").first { $0["environment"] == environment }
        let fields: [String: String] = [
            "title": "Square · \(environment.capitalized)", "environment": environment,
            "application_id_hint": String(applicationID.prefix(10)) + (applicationID.count > 10 ? "…" : ""),
            "merchant_id": merchantID, "location_id": locationID,
            "access_token_hash": accessToken.isEmpty ? "" : SHA256.hash(data: Data(accessToken.utf8)).map { String(format: "%02x", $0) }.joined(),
            "refresh_token_hash": refreshToken.isEmpty ? "" : SHA256.hash(data: Data(refreshToken.utf8)).map { String(format: "%02x", $0) }.joined(),
            "status": accessToken.isEmpty ? "Needs browser verification" : "Connected",
            "updated_at": ISO8601DateFormatter().string(from: .now)
        ]
        if let existing { updateRecord("squareConnections", record: existing, fields: fields) }
        else { _ = addRecord("squareConnections", fields: fields) }
        appendAudit("square.connected", "Square connection saved", details: "\(merchantID) · \(environment)")
        notice = "Square connection details saved. Access and refresh tokens were hashed before storage."
        errorMessage = nil
    }

    func importSquareReference(fields: [String: String]) {
        guard canManageWorkspace else { errorMessage = "Only the owner can import Square summary data."; return }
        _ = addRecord("squareImports", fields: fields.merging(["imported_at": ISO8601DateFormatter().string(from: .now)]) { _, new in new })
        appendAudit("square.imported", "Square data summary imported", details: fields["business_name"] ?? fields["merchant_id"] ?? "")
        notice = "Square summary imported. No payment or customer record was created."
        errorMessage = nil
    }

    func createDataRequest(type: String, subjectEmail: String, notes: String) {
        _ = addRecord("dataRequests", fields: ["title": "\(type.capitalized) request", "request_type": type, "subject_email": subjectEmail, "notes": notes, "status": "Pending review"])
    }

    func seedWorkspace() {
        guard customers.isEmpty else { return }
        for key in ["customers", "tasks", "workflows", "answerLibrary", "legalDocuments"] { archive.records[key] = [] }
        let legal: [(String, String, String)] = [
            ("Terms of Use", "Draft included", "OverHead provides operational tools for authorized users. The business remains responsible for account access, accurate records, lawful customer communication, staff supervision, and professional decisions."),
            ("Privacy Notice", "Draft included", "Workspace records are encrypted and stored on this Mac. Shared account identity and supported invitations use OverHead Firebase services. Exports and attached documents are stored locally; review and protect each copy."),
            ("Acceptable Use Policy", "Draft included", "Do not use OverHead for fraud, unlawful messaging, deceptive billing, credential sharing, unauthorized access, or unreviewed regulated decisions."),
            ("AI Use Disclosure", "Draft included", "AI-assisted content is a suggestion. The business owner reviews and approves prices, customer-facing language, legal content, and consequential decisions."),
            ("Data Retention Policy", "Draft included", "Retain customer records only as long as needed for service, support, legal obligations, and business records. Use export and deletion request workflows to document decisions."),
            ("Data Responsibility Disclaimer", "Draft included", "OverHead provides controls, exports, backups, and recovery guidance as available. Customers remain responsible for device security, backup verification, staff actions, lawful handling, and records changed by authorized users or outside parties."),
            ("Support Policy", "Draft included", "Support requests should include the affected workflow, last successful step, exact error, app version, and a reviewed support bundle. Never share passwords, recovery phrases, card numbers, or tax identifiers."),
            ("Subscription Billing & Authorization Policy", "Draft - legal review required", "Before a subscription charge, the authorized owner must review the plan, price, billing interval, and recurring authorization. Stripe controls payment processing and refund settlement."),
            ("Free Trial Policy", "Draft - legal review required", "A workspace may receive one 30-day no-card Gold-equivalent trial. The trial ends automatically; no payment is created by the trial."),
            ("Cancellation & Prorated Refund Policy", "Draft - legal review required", "Eligible unused paid time may be refunded proportionally to the original payment method. Trials, fully used periods, unpaid amounts, and ineligible requests are not refundable."),
            ("Workspace License & Access Policy", "Draft - legal review required", "Licenses follow active workspace membership and plan access. Owners must remove inactive staff and protect credentials. Access may be suspended for expired trials, cancellation, nonpayment, or misuse.")
        ]
        for (title, status, body) in legal { _ = addRecord("legalDocuments", fields: ["title": title, "version": "0.1", "status": status, "body": body]) }
        let workflows: [(String, String, String, String)] = [
            ("Scheduling", "schedule", "Front Desk", "Create scheduling work and reminders from the live work queue."),
            ("Customer Answers", "answers", "Support", "Use approved responses for common customer questions and handoffs."),
            ("Quotes", "quotes", "Owner", "Create reviewable quotes with an owner approval step for exceptions."),
            ("Invoices", "invoices", "Bookkeeper", "Track due dates, payment status, and polite reminder tasks."),
            ("Follow-up", "followup", "Owner", "Assign customer follow-ups and retention reminders with a clear next action.")
        ]
        for (title, type, owner, summary) in workflows { _ = addRecord("workflows", fields: ["title": title, "category": type, "status": "Template", "owner": owner, "summary": summary, "steps": "Capture the minimum needed context; assign a responsible role; review material changes; record the outcome."]) }
        _ = addRecord("answerLibrary", fields: ["title": "Approved customer response", "category": "Support", "status": "Draft", "body": "Add an owner-approved answer before using it with customers.", "escalation_rule": "Escalate pricing, access, and policy exceptions to the owner."])
        _ = addRecord("tasks", fields: ["title": "Complete your OverHead launch checklist", "area": "Overview", "status": "Open", "priority": "High", "due_at": ISO8601DateFormatter().string(from: .now)])
        if let profile {
            _ = addRecord("userProfiles", fields: ["id": profile.id, "name": profile.ownerName, "business_name": profile.businessName, "email": profile.email, "role": profile.role.rawValue, "status": "Active"])
            _ = addRecord("managerProfiles", fields: ["name": profile.ownerName, "email": profile.email, "role": profile.role.rawValue, "status": "Active"])
            _ = addRecord("licenses", fields: ["title": "Workspace license · \(profile.ownerName)", "email": profile.email, "tier": archive.activePlan, "status": "Active", "license_number": UUID().uuidString])
        }
    }

    private func appendAudit(_ type: String, _ title: String, details: String) {
        let prior = archive.auditAnchor
        let content = Data("\(ISO8601DateFormatter().string(from: .now))|\(type)|\(title)|\(details)".utf8)
        archive.auditAnchor = Data(SHA256.hash(data: prior + content))
        var event = WorkspaceRecord(fields: ["title": title, "event_type": type, "details": details, "status": "Recorded", "checksum": archive.auditAnchor.base64EncodedString(), "sequence": "\(records("auditEvents").count)"])
        event["created_at"] = ISO8601DateFormatter().string(from: event.createdAt)
        archive.records["auditEvents", default: []].insert(event, at: 0)
    }

    private func load() {
        do {
            let url = try storeURL()
            guard fileManager.fileExists(atPath: url.path) else { return }
            let boxData = try Data(contentsOf: url)
            let box = try AES.GCM.SealedBox(combined: boxData)
            let clear = try AES.GCM.open(box, using: encryptionKey())
            archive = try JSONDecoder.workspace.decode(WorkspaceArchive.self, from: clear)
            if let id = archive.activeProfileID { profile = archive.profiles.first { $0.id == id } }
        } catch {
            errorMessage = "OverHead could not open its encrypted workspace: \(error.localizedDescription)"
        }
    }

    private func persist() { do { try persistOrThrow() } catch { errorMessage = "Could not save the encrypted workspace: \(error.localizedDescription)" } }

    private func persistOrThrow() throws {
        archive.updatedAt = .now
        let clear = try JSONEncoder.pretty.encode(archive)
        let sealed = try AES.GCM.seal(clear, using: encryptionKey())
        guard let data = sealed.combined else { throw StoreError.encryptionFailed }
        let url = try storeURL()
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: url, options: .atomic)
    }

    private func storeURL() throws -> URL {
        let base = try fileManager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        return base.appendingPathComponent("Black Lion Media Studio/OverHead", isDirectory: true).appendingPathComponent("workspace.aesgcm")
    }

    private func encryptionKey() throws -> SymmetricKey {
        if let stored = keychainRead(), stored.count == 32 { return SymmetricKey(data: stored) }
        let key = randomData(count: 32)
        guard keychainWrite(key) else { throw StoreError.keychainUnavailable }
        return SymmetricKey(data: key)
    }

    private func keychainRead() -> Data? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "workspace-key", kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess else { return nil }
        return item as? Data
    }

    private func keychainWrite(_ data: Data) -> Bool {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "workspace-key"]
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
    }

    private func derive(_ password: String, salt: Data) -> Data {
        let rounds = 120_000
        let key = SymmetricKey(data: Data(password.utf8))
        var block = salt + Data([0, 0, 0, 1])
        var u = Data(HMAC<SHA256>.authenticationCode(for: block, using: key))
        var result = u
        if rounds > 1 {
            for _ in 2...rounds {
                block = u
                u = Data(HMAC<SHA256>.authenticationCode(for: block, using: key))
                for index in result.indices { result[index] ^= u[index] }
            }
        }
        return result
    }

    private func randomData(count: Int) -> Data {
        var bytes = [UInt8](repeating: 0, count: count)
        _ = SecRandomCopyBytes(kSecRandomDefault, count, &bytes)
        return Data(bytes)
    }

    private func constantTimeEqual(_ lhs: Data, _ rhs: Data) -> Bool {
        guard lhs.count == rhs.count else { return false }
        return zip(lhs, rhs).reduce(UInt8(0)) { $0 | ($1.0 ^ $1.1) } == 0
    }

    private func parseCSVLine(_ line: String) -> [String] {
        var fields: [String] = [], current = "", quoted = false
        var index = line.startIndex
        while index < line.endIndex {
            let character = line[index]
            if character == "\"" {
                let next = line.index(after: index)
                if quoted, next < line.endIndex, line[next] == "\"" { current.append("\""); index = next }
                else { quoted.toggle() }
            } else if character == ",", !quoted { fields.append(current); current = "" }
            else { current.append(character) }
            index = line.index(after: index)
        }
        fields.append(current)
        return fields
    }
}

enum StoreError: LocalizedError {
    case keychainUnavailable, encryptionFailed, confirmationRequired, unsupportedArchive, invalidCSV, unsupportedDocument, documentTooLarge
    var errorDescription: String? {
        switch self {
        case .keychainUnavailable: "The OverHead encryption key could not be saved to Keychain."
        case .encryptionFailed: "The workspace could not be encrypted."
        case .confirmationRequired: "Type RESTORE to confirm replacing workspace data."
        case .unsupportedArchive: "This backup was created by an unsupported OverHead version."
        case .invalidCSV: "The selected CSV file could not be read."
        case .unsupportedDocument: "This file type cannot be attached to a customer record."
        case .documentTooLarge: "Customer documents must be 25 MB or smaller."
        }
    }
}

private extension Digest { var data: Data { withUnsafeBytes { Data($0) } } }
private extension JSONEncoder {
    static var pretty: JSONEncoder { let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]; encoder.dateEncodingStrategy = .iso8601; return encoder }
}
private extension JSONDecoder {
    static var workspace: JSONDecoder { let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601; return decoder }
}
