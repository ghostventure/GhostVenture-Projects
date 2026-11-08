import Foundation
import Observation
import WebKit

struct SavedPage: Identifiable, Codable, Hashable {
    var id: String { url }
    var title: String
    var url: String
}

@MainActor
@Observable
final class BrowserTab: Identifiable {
    let id = UUID()
    let isPrivate: Bool
    let webView: WKWebView
    var title = "New Tab"
    var displayedURL = ""
    var isLoading = false
    var progress = 0.0
    var canGoBack = false
    var canGoForward = false

    init(privateMode: Bool) {
        isPrivate = privateMode
        let configuration = WKWebViewConfiguration()
        if privateMode {
            configuration.websiteDataStore = .nonPersistent()
        }
        #if os(iOS)
        configuration.allowsInlineMediaPlayback = true
        #endif
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.isInspectable = false
    }
}

@MainActor
@Observable
final class BrowserStore {
    private(set) var tabs: [BrowserTab] = []
    var selectedTabID: UUID?
    var addressText = ""
    var isPrivateMode = false
    var showingGhostControl = false
    var showingLibrary = false
    var librarySelection: LibrarySelection = .bookmarks
    var bookmarks: [SavedPage] = []
    var history: [SavedPage] = []
    var blockedTrackerCount = 0
    var lastError: String?
    var addressFocusRequest = 0

    @ObservationIgnored private var trackerRules: WKContentRuleList?
    @ObservationIgnored private let userDefaults = UserDefaults.standard
    @ObservationIgnored private let bookmarksKey = "ghostSurfer.bookmarks.v1"
    @ObservationIgnored private let historyKey = "ghostSurfer.history.v1"

    var currentTab: BrowserTab? {
        tabs.first { $0.id == selectedTabID }
    }

    init() {
        bookmarks = decode([SavedPage].self, key: bookmarksKey) ?? []
        history = decode([SavedPage].self, key: historyKey) ?? []
        createTab(loadHome: false)
        compileTrackerRules()
    }

    func createTab(loadHome: Bool = false) {
        let tab = BrowserTab(privateMode: isPrivateMode)
        tabs.append(tab)
        selectedTabID = tab.id
        addressText = ""
        if let trackerRules {
            tab.webView.configuration.userContentController.add(trackerRules)
        }
        if loadHome { tab.webView.load(URLRequest(url: Self.homeURL)) }
    }

    func selectTab(_ id: UUID) {
        guard let tab = tabs.first(where: { $0.id == id }) else { return }
        selectedTabID = id
        isPrivateMode = tab.isPrivate
        addressText = tab.displayedURL
    }

    func closeTab(_ id: UUID) {
        guard let index = tabs.firstIndex(where: { $0.id == id }) else { return }
        tabs[index].webView.stopLoading()
        tabs.remove(at: index)
        if tabs.isEmpty {
            createTab(loadHome: false)
        } else if selectedTabID == id {
            let next = tabs[min(index, tabs.count - 1)]
            selectTab(next.id)
        }
    }

    func submitAddress() {
        guard let tab = currentTab else { return }
        let input = addressText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !input.isEmpty else { return }
        lastError = nil
        var destination: URL
        if input.contains(" ") || (!input.contains(".") && !input.hasPrefix("http")) {
            let query = input.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? input
            destination = URL(string: "https://www.startpage.com/sp/search?query=\(query)")!
        } else {
            let value = input.contains("://") ? input : "https://\(input)"
            guard let url = URL(string: value), ["http", "https"].contains(url.scheme?.lowercased() ?? ""), url.host != nil else {
                lastError = "Enter a web address or search phrase."
                return
            }
            destination = url
        }
        if destination.scheme?.lowercased() == "http", var components = URLComponents(url: destination, resolvingAgainstBaseURL: false) {
            components.scheme = "https"
            if let secureURL = components.url { destination = secureURL }
        }
        tab.displayedURL = destination.absoluteString
        tab.isLoading = true
        tab.progress = 0
        tab.webView.load(URLRequest(url: destination))
    }

    func navigate(_ url: String) {
        addressText = url
        submitAddress()
        showingLibrary = false
    }

    func togglePrivateMode() {
        isPrivateMode.toggle()
        createTab(loadHome: false)
    }

    func saveCurrentPage() {
        guard let tab = currentTab, let url = tab.webView.url?.absoluteString, url.hasPrefix("http") else { return }
        let page = SavedPage(title: tab.title.isEmpty ? url : tab.title, url: url)
        if !bookmarks.contains(where: { $0.url == page.url }) { bookmarks.insert(page, at: 0) }
        persist(bookmarks, key: bookmarksKey)
    }

    func recordHistory(_ tab: BrowserTab) {
        guard !tab.isPrivate, let url = tab.webView.url?.absoluteString, url.hasPrefix("http") else { return }
        let page = SavedPage(title: tab.title.isEmpty ? url : tab.title, url: url)
        history.removeAll { $0.url == url }
        history.insert(page, at: 0)
        history = Array(history.prefix(100))
        persist(history, key: historyKey)
    }

    func clearBrowsingData() {
        let allWebsiteDataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
        WKWebsiteDataStore.default().removeData(ofTypes: allWebsiteDataTypes, modifiedSince: .distantPast) { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                self.history = []
                self.persist([SavedPage](), key: self.historyKey)
                self.lastError = "Cookies, cache, and history cleared. Bookmarks were kept."
            }
        }
    }

    func update(_ tab: BrowserTab) {
        tab.displayedURL = tab.webView.url?.absoluteString ?? ""
        tab.title = tab.webView.title?.isEmpty == false ? (tab.webView.title ?? "New Tab") : "New Tab"
        tab.isLoading = tab.webView.isLoading
        tab.canGoBack = tab.webView.canGoBack
        tab.canGoForward = tab.webView.canGoForward
        tab.progress = tab.webView.estimatedProgress
        if tab.id == selectedTabID { addressText = tab.displayedURL }
    }

    private func compileTrackerRules() {
        let hosts = [
            "doubleclick\\.net", "googlesyndication\\.com", "google-analytics\\.com",
            "googletagmanager\\.com", "facebook\\.net", "connect\\.facebook\\.net",
            "hotjar\\.com", "segment\\.io", "mixpanel\\.com", "scorecardresearch\\.com",
            "criteo\\.com", "taboola\\.com", "outbrain\\.com", "appsflyer\\.com"
        ].joined(separator: "|")
        let rules: [[String: Any]] = [[
            "trigger": ["url-filter": "^https?://([^/]+\\.)?(" + hosts + ")/"],
            "action": ["type": "block"]
        ]]
        guard let data = try? JSONSerialization.data(withJSONObject: rules),
              let encoded = String(data: data, encoding: .utf8) else { return }
        WKContentRuleListStore.default().compileContentRuleList(
            forIdentifier: "GhostSurferTrackerProtection",
            encodedContentRuleList: encoded
        ) { [weak self] list, _ in
            Task { @MainActor in
                guard let self, let list else { return }
                self.trackerRules = list
                self.tabs.forEach { $0.webView.configuration.userContentController.add(list) }
            }
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = userDefaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private func persist<T: Encodable>(_ value: T, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        userDefaults.set(data, forKey: key)
    }

    static let homeURL = URL(string: "https://www.startpage.com/")!
}

enum LibrarySelection: String, CaseIterable, Identifiable {
    case bookmarks = "Bookmarks"
    case history = "History"
    var id: String { rawValue }
}
