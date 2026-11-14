import Foundation

struct MicrosoftDevicePrompt {
    var deviceCode: String
    var userCode: String
    var verificationURL: URL
    var message: String
    var interval: TimeInterval
    var expiresIn: TimeInterval
    var scopes: [String]
}

struct MicrosoftAccessToken {
    var accessToken: String
    var refreshToken: String
    var expiresIn: TimeInterval
}

struct MicrosoftContact: Codable, Identifiable, Hashable {
    var id: String
    var businessName: String
    var ownerName: String
    var email: String
    var serviceArea: String
    var sourceLabel: String
}

enum MicrosoftConnector {
    static func scopes(provider: String) -> [String] {
        provider == "graph" ? ["User.Read", "Contacts.Read", "offline_access"] : ["https://api.businesscentral.dynamics.com/user_impersonation", "offline_access"]
    }

    static func begin(clientID: String, tenantID: String, provider: String) async throws -> MicrosoftDevicePrompt {
        guard clientID.count >= 10 else { throw FirebaseWorkspaceError.message("Enter the Microsoft application client ID before connecting.") }
        let scopes = self.scopes(provider: provider)
        let endpoint = URL(string: "https://login.microsoftonline.com/\(tenantID)/oauth2/v2.0/devicecode")!
        let payload = try await formRequest(endpoint, values: ["client_id": clientID, "scope": scopes.joined(separator: " ")])
        guard let verification = URL(string: payload["verification_uri"] as? String ?? "") else { throw FirebaseWorkspaceError.message("Microsoft did not return a valid verification page.") }
        return MicrosoftDevicePrompt(
            deviceCode: payload["device_code"] as? String ?? "",
            userCode: payload["user_code"] as? String ?? "",
            verificationURL: verification,
            message: payload["message"] as? String ?? "Open the verification page and enter the code shown here.",
            interval: Double(payload["interval"] as? String ?? "5") ?? 5,
            expiresIn: Double(payload["expires_in"] as? String ?? "900") ?? 900,
            scopes: scopes
        )
    }

    static func complete(clientID: String, tenantID: String, prompt: MicrosoftDevicePrompt) async throws -> MicrosoftAccessToken {
        let endpoint = URL(string: "https://login.microsoftonline.com/\(tenantID)/oauth2/v2.0/token")!
        let deadline = Date.now.addingTimeInterval(prompt.expiresIn)
        var interval = prompt.interval
        while Date.now < deadline {
            try await Task.sleep(for: .seconds(interval))
            do {
                let payload = try await formRequest(endpoint, values: [
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                    "client_id": clientID,
                    "device_code": prompt.deviceCode
                ])
                return MicrosoftAccessToken(accessToken: payload["access_token"] as? String ?? "", refreshToken: payload["refresh_token"] as? String ?? "", expiresIn: Double(payload["expires_in"] as? String ?? "3600") ?? 3600)
            } catch MicrosoftConnectorError.pending { continue }
            catch MicrosoftConnectorError.slowDown { interval += 5; continue }
        }
        throw FirebaseWorkspaceError.message("The Microsoft sign-in code expired. Start the connection again.")
    }

    static func preview(connection: WorkspaceRecord, companyID: String = "") async throws -> (contacts: [MicrosoftContact], companies: [(id: String, name: String)]) {
        let token = try await accessToken(connection)
        if connection["provider"] == "graph" {
            let result = try await getJSON(URL(string: "https://graph.microsoft.com/v1.0/me/contacts?$top=50&$select=id,displayName,givenName,surname,companyName,emailAddresses,businessAddress")!, token: token)
            let rows = result["value"] as? [[String: Any]] ?? []
            let contacts = rows.map { row -> MicrosoftContact in
                let email = ((row["emailAddresses"] as? [[String: Any]])?.first?["address"] as? String) ?? ""
                let address = row["businessAddress"] as? [String: Any] ?? [:]
                let location = [address["city"] as? String, address["state"] as? String, address["countryOrRegion"] as? String].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
                let name = row["displayName"] as? String ?? ""
                let business = row["companyName"] as? String ?? name.nonEmpty ?? "Microsoft 365 contact"
                return MicrosoftContact(id: row["id"] as? String ?? UUID().uuidString, businessName: business, ownerName: name, email: email, serviceArea: location, sourceLabel: "Microsoft 365 contact")
            }
            return (contacts, [])
        }
        let environment = connection["environment"].nonEmpty ?? "Production"
        let base = "https://api.businesscentral.dynamics.com/v2.0/\(environment)/api/v2.0"
        let companyResponse = try await getJSON(URL(string: "\(base)/companies?$top=100")!, token: token)
        let companies = (companyResponse["value"] as? [[String: Any]] ?? []).map { (id: $0["id"] as? String ?? "", name: $0["name"] as? String ?? "") }
        guard !companyID.isEmpty else { return ([], companies) }
        let customers = try await getJSON(URL(string: "\(base)/companies(\(companyID))/customers?$top=50")!, token: token)
        let contacts = (customers["value"] as? [[String: Any]] ?? []).map { row -> MicrosoftContact in
            let name = row["displayName"] as? String ?? row["number"] as? String ?? "Business Central customer"
            let location = [row["address"] as? String, row["city"] as? String, row["state"] as? String].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
            return MicrosoftContact(id: row["id"] as? String ?? UUID().uuidString, businessName: name, ownerName: row["contact"] as? String ?? "", email: row["email"] as? String ?? "", serviceArea: location, sourceLabel: "Business Central customer")
        }
        return (contacts, companies)
    }

    private static func accessToken(_ connection: WorkspaceRecord) async throws -> String {
        let refreshToken = connection["refresh_token"]
        guard !refreshToken.isEmpty else { throw FirebaseWorkspaceError.message("Reconnect Microsoft to restore access to this connection.") }
        let tenant = connection["tenant_id"].nonEmpty ?? "organizations"
        let endpoint = URL(string: "https://login.microsoftonline.com/\(tenant)/oauth2/v2.0/token")!
        let payload = try await formRequest(endpoint, values: ["client_id": connection["client_id"], "grant_type": "refresh_token", "refresh_token": refreshToken, "scope": scopes(provider: connection["provider"]).joined(separator: " ")])
        return payload["access_token"] as? String ?? ""
    }

    private static func getJSON(_ url: URL, token: String) async throws -> [String: Any] {
        var request = URLRequest(url: url); request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await send(request)
    }

    private static func formRequest(_ url: URL, values: [String: String]) async throws -> [String: Any] {
        var request = URLRequest(url: url); request.httpMethod = "POST"; request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data(values.map { key, value in "\(key)=\(formEscape(value))" }.joined(separator: "&").utf8)
        do { return try await send(request) }
        catch let error as MicrosoftConnectorError { throw error }
        catch { throw error }
    }

    private static func send(_ request: URLRequest) async throws -> [String: Any] {
        var request = request; request.timeoutInterval = 25
        let (data, response) = try await URLSession.shared.data(for: request)
        let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let code = payload["error"] as? String ?? ""
            if code == "authorization_pending" { throw MicrosoftConnectorError.pending }
            if code == "slow_down" { throw MicrosoftConnectorError.slowDown }
            let message = payload["error_description"] as? String ?? payload["message"] as? String ?? "Microsoft request failed."
            throw FirebaseWorkspaceError.message(message)
        }
        return payload
    }

    private static func formEscape(_ string: String) -> String {
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._*")
        return string.addingPercentEncoding(withAllowedCharacters: allowed)?.replacingOccurrences(of: "%20", with: "+") ?? string
    }
}

private enum MicrosoftConnectorError: Error { case pending, slowDown }
