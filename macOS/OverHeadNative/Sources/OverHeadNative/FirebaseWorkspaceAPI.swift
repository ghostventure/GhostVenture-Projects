import Foundation

struct SharedIdentity {
    var uid: String
    var workspaceID: String
    var email: String
    var ownerName: String
    var businessName: String
    var sharedRole: String
    var role: WorkspaceRole
    var idToken: String
    var refreshToken: String
    var expiresIn: TimeInterval
}

enum FirebaseWorkspaceAPI {
    static let apiKey = "AIzaSyA2bxXMdNsXVgPaYv3jbWJXGlosVYtBd8U"
    static let projectID = "overhead-office"
    private static let identityRoot = "https://identitytoolkit.googleapis.com/v1"
    private static let firestoreRoot = "https://firestore.googleapis.com/v1/projects/\(projectID)/databases/(default)/documents"
    private static let billingRoot = "https://us-central1-overhead-office.cloudfunctions.net/billingApi"

    static func signIn(email: String, password: String, accessLane: String) async throws -> SharedIdentity {
        let response = try await identityPost("accounts:signInWithPassword", body: ["email": email.lowercased(), "password": password, "returnSecureToken": true])
        let uid = string(response["localId"])
        let token = string(response["idToken"])
        let refresh = string(response["refreshToken"])
        let lookup = try await identityPost("accounts:lookup", body: ["idToken": token])
        let account = (lookup["users"] as? [[String: Any]])?.first ?? [:]
        guard account["emailVerified"] as? Bool == true else {
            _ = try? await identityPost("accounts:sendOobCode", body: ["requestType": "VERIFY_EMAIL", "idToken": token])
            throw FirebaseWorkspaceError.emailVerificationRequired(email.lowercased())
        }
        let profile = try await readDocument("profiles/\(uid)", token: token)
        guard string(profile["uid"]) == uid, string(profile["status"]) == "Active" else {
            throw FirebaseWorkspaceError.message("This shared account is not active for an OverHead workspace.")
        }
        let sharedRole = string(profile["role"])
        if accessLane == "team", !["Administrator", "Manager", "Staff"].contains(sharedRole) {
            throw FirebaseWorkspaceError.message("This is a customer account. Choose Customer Access.")
        }
        if accessLane == "customer", sharedRole != "Customer" {
            throw FirebaseWorkspaceError.message("This is a team account. Choose Team Access.")
        }
        let role: WorkspaceRole
        switch sharedRole {
        case "Administrator": role = .owner
        case "Manager": role = .frontDesk
        case "Staff": role = .support
        case "Customer": role = .customer
        default: throw FirebaseWorkspaceError.message("The shared account has an unsupported role.")
        }
        return SharedIdentity(
            uid: uid,
            workspaceID: string(profile["workspace_id"]),
            email: email.lowercased(),
            ownerName: string(profile["owner_name"]),
            businessName: string(profile["business_name"]),
            sharedRole: sharedRole,
            role: role,
            idToken: token,
            refreshToken: refresh,
            expiresIn: Double(string(response["expiresIn"])) ?? 3600
        )
    }

    static func register(ownerName: String, businessName: String, email: String, password: String) async throws -> SharedIdentity {
        let auth = try await identityPost("accounts:signUp", body: ["email": email.lowercased(), "password": password, "returnSecureToken": true])
        let uid = string(auth["localId"])
        let token = string(auth["idToken"])
        let createdAt = ISO8601DateFormatter().string(from: .now)
        try await writeDocument("workspaces/\(uid)", fields: [
            "owner_uid": uid, "business_name": businessName,
            "deployment_mode": "desktop", "created_at": createdAt, "updated_at": createdAt
        ], token: token)
        try await writeDocument("profiles/\(uid)", fields: [
            "uid": uid, "owner_name": ownerName, "business_name": businessName,
            "email": email.lowercased(), "workspace_id": uid, "role": "Administrator",
            "status": "Active", "email_verified": false, "terms_accepted_at": createdAt,
            "last_sign_in": createdAt, "created_at": createdAt, "updated_at": createdAt
        ], token: token)
        _ = try await identityPost("accounts:sendOobCode", body: ["requestType": "VERIFY_EMAIL", "idToken": token])
        return SharedIdentity(uid: uid, workspaceID: uid, email: email.lowercased(), ownerName: ownerName, businessName: businessName, sharedRole: "Administrator", role: .owner, idToken: token, refreshToken: string(auth["refreshToken"]), expiresIn: Double(string(auth["expiresIn"])) ?? 3600)
    }

    static func registerCustomer(email: String, password: String, workspaceID: String) async throws {
        let auth = try await identityPost("accounts:signUp", body: ["email": email.lowercased(), "password": password, "returnSecureToken": true])
        let token = string(auth["idToken"])
        let uid = string(auth["localId"])
        let invitePath = "workspaces/\(workspaceID)/invites/\(email.lowercased())"
        let invite = try await readDocument(invitePath, token: token)
        guard string(invite["email"]).lowercased() == email.lowercased(), string(invite["role"]) == "Customer" else {
            throw FirebaseWorkspaceError.message("This customer invitation is not valid for the email and workspace code entered.")
        }
        let now = ISO8601DateFormatter().string(from: .now)
        try await writeDocument("profiles/\(uid)", fields: [
            "uid": uid, "owner_name": string(invite["business_name"]).nonEmpty ?? email,
            "business_name": string(invite["business_name"]).nonEmpty ?? "Customer account",
            "email": email.lowercased(), "workspace_id": workspaceID, "role": "Customer",
            "status": "Active", "email_verified": false, "terms_accepted_at": now,
            "last_sign_in": now, "created_at": now, "updated_at": now
        ], token: token)
        _ = try await identityPost("accounts:sendOobCode", body: ["requestType": "VERIFY_EMAIL", "idToken": token])
    }

    static func sendPasswordReset(email: String) async throws {
        _ = try await identityPost("accounts:sendOobCode", body: ["requestType": "PASSWORD_RESET", "email": email.lowercased()])
    }

    static func billing(action: String, payload: [String: Any], idToken: String) async throws -> [String: Any] {
        var request = URLRequest(url: URL(string: billingRoot)!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        var body = payload
        body["action"] = action
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await send(request)
    }

    static func refreshToken(_ refreshToken: String) async throws -> (idToken: String, refreshToken: String, expiresIn: TimeInterval) {
        var request = URLRequest(url: URL(string: "https://securetoken.googleapis.com/v1/token?key=\(apiKey)")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = formBody(["grant_type": "refresh_token", "refresh_token": refreshToken])
        let payload = try await send(request)
        return (string(payload["id_token"]), string(payload["refresh_token"]), Double(string(payload["expires_in"])) ?? 3600)
    }

    static func readDocument(_ path: String, token: String) async throws -> [String: Any] {
        var request = URLRequest(url: URL(string: "\(firestoreRoot)/\(path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? path)")!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let payload = try await send(request)
        let fields = payload["fields"] as? [String: [String: Any]] ?? [:]
        return fields.mapValues { value in
            value["stringValue"] ?? value["booleanValue"] ?? value["integerValue"] ?? value["doubleValue"] ?? ""
        }
    }

    static func writeDocument(_ path: String, fields: [String: Any], token: String) async throws {
        let firestoreFields = Dictionary(uniqueKeysWithValues: fields.map { key, value -> (String, [String: Any]) in
            if let boolean = value as? Bool { return (key, ["booleanValue": boolean]) }
            return (key, ["stringValue": String(describing: value)])
        })
        var request = URLRequest(url: URL(string: "\(firestoreRoot)/\(path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? path)")!)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["fields": firestoreFields])
        _ = try await send(request)
    }

    private static func identityPost(_ method: String, body: [String: Any]) async throws -> [String: Any] {
        var request = URLRequest(url: URL(string: "\(identityRoot)/\(method)?key=\(apiKey)")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await send(request)
    }

    private static func send(_ request: URLRequest) async throws -> [String: Any] {
        var timed = request
        timed.timeoutInterval = 20
        let (data, response) = try await URLSession.shared.data(for: timed)
        let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = ((payload["error"] as? [String: Any])?["message"] as? String) ?? "Firebase request failed."
            throw FirebaseWorkspaceError.message(friendlyFirebaseMessage(message))
        }
        return payload
    }

    private static func formBody(_ values: [String: String]) -> Data {
        let body = values.map { key, value in
            let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._*")
            let escaped = value.addingPercentEncoding(withAllowedCharacters: allowed)?.replacingOccurrences(of: "%20", with: "+") ?? value
            return "\(key)=\(escaped)"
        }.joined(separator: "&")
        return Data(body.utf8)
    }

    private static func string(_ value: Any?) -> String {
        guard let value, !(value is NSNull) else { return "" }
        return String(describing: value)
    }

    private static func friendlyFirebaseMessage(_ message: String) -> String {
        switch message {
        case "EMAIL_NOT_FOUND", "INVALID_PASSWORD", "INVALID_LOGIN_CREDENTIALS": "That email or password did not match an OverHead account."
        case "EMAIL_EXISTS": "An account already exists for that email. Choose Sign in instead."
        case "OPERATION_NOT_ALLOWED": "Email and password sign-in is not enabled for this OverHead account."
        case "TOO_MANY_ATTEMPTS_TRY_LATER": "Too many sign-in attempts. Wait a while, then try again."
        default: message.replacingOccurrences(of: "Firebase: ", with: "")
        }
    }
}

enum FirebaseWorkspaceError: LocalizedError {
    case message(String)
    case emailVerificationRequired(String)
    var errorDescription: String? {
        switch self {
        case .message(let text): text
        case .emailVerificationRequired(let email): "Verify the email address for \(email) using the Firebase message, then sign in again."
        }
    }
}
