import SwiftUI

private enum SurferPalette {
    static let background = Color(red: 0.035, green: 0.055, blue: 0.085)
    static let panel = Color(red: 0.075, green: 0.105, blue: 0.15)
    static let raised = Color(red: 0.105, green: 0.14, blue: 0.19)
    static let cyan = Color(red: 0.22, green: 0.68, blue: 0.91)
    static let mint = Color(red: 0.39, green: 0.9, blue: 0.75)
    static let muted = Color(red: 0.56, green: 0.64, blue: 0.72)
}

struct BrowserRootView: View {
    @Environment(BrowserStore.self) private var browser
    @FocusState private var addressFocused: Bool
    @State private var showingTabs = false

    var body: some View {
        VStack(spacing: 0) {
            header
            addressBar
            if let message = browser.lastError {
                HStack(spacing: 8) {
                    Image(systemName: "info.circle.fill")
                    Text(message).lineLimit(2)
                    Spacer(minLength: 0)
                    Button { browser.lastError = nil } label: { Image(systemName: "xmark") }
                        .accessibilityLabel("Dismiss message")
                }
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.9))
                .padding(.horizontal, 14).padding(.vertical, 9)
                .background(SurferPalette.raised)
            }
            if let tab = browser.currentTab {
                if tab.displayedURL.isEmpty && !tab.isLoading {
                    homePage
                } else {
                    WebBrowserView(tab: tab)
                        .environment(browser)
                        .background(.white)
                        .accessibilityLabel("Web page")
                }
            }
            bottomBar
        }
        .background(SurferPalette.background.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .sheet(isPresented: Bindable(browser).showingGhostControl) { GhostControlSheet() }
        .sheet(isPresented: Bindable(browser).showingLibrary) { LibrarySheet() }
        .sheet(isPresented: $showingTabs) { TabSwitcherSheet() }
    }

    private var header: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(SurferPalette.cyan.opacity(0.15)).frame(width: 36, height: 36)
                Image(systemName: "water.waves").font(.system(size: 17, weight: .semibold)).foregroundStyle(SurferPalette.cyan)
            }
            VStack(alignment: .leading, spacing: 0) {
                Text("GHOST SURFER").font(.system(size: 13, weight: .heavy, design: .rounded)).tracking(1.3)
                Text("Browse with more control").font(.system(size: 11)).foregroundStyle(SurferPalette.muted)
            }
            Spacer()
            if browser.isPrivateMode {
                Label("Private", systemImage: "eye.slash.fill")
                    .font(.caption.weight(.semibold)).foregroundStyle(SurferPalette.mint)
                    .padding(.horizontal, 10).padding(.vertical, 7)
                    .background(SurferPalette.mint.opacity(0.12), in: Capsule())
            }
            Button { browser.showingGhostControl = true } label: {
                Image(systemName: "shield.lefthalf.filled")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(SurferPalette.mint)
                    .frame(width: 40, height: 40)
                    .background(SurferPalette.panel, in: Circle())
            }
            .accessibilityLabel("Open Ghost Control privacy settings")
        }
        .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 12)
    }

    private var addressBar: some View {
        HStack(spacing: 10) {
            Image(systemName: addressIcon)
                .foregroundStyle(addressColor).frame(width: 18)
                .accessibilityHidden(true)
            TextField("Search privately or enter address", text: Binding(
                get: { browser.addressText }, set: { browser.addressText = $0 }
            ))
            .font(.system(size: 15))
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .keyboardType(.URL)
            .submitLabel(.go)
            .focused($addressFocused)
            .onSubmit { browser.submitAddress(); addressFocused = false }
            .accessibilityLabel("Search or enter a web address")
            if addressFocused && !browser.addressText.isEmpty {
                Button { browser.addressText = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(SurferPalette.muted) }
                    .accessibilityLabel("Clear address")
            } else {
                Button {
                    if browser.currentTab?.isLoading == true {
                        browser.currentTab?.webView.stopLoading()
                    } else {
                        browser.currentTab?.webView.reload()
                    }
                } label: {
                    Image(systemName: browser.currentTab?.isLoading == true ? "xmark" : "arrow.clockwise")
                        .foregroundStyle(.white.opacity(0.82))
                }
                .accessibilityLabel(browser.currentTab?.isLoading == true ? "Stop loading" : "Reload page")
            }
        }
        .padding(.horizontal, 14).frame(height: 48)
        .background(SurferPalette.panel, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(.white.opacity(0.07), lineWidth: 1))
        .padding(.horizontal, 14)
        .padding(.bottom, 10)
        .overlay(alignment: .bottom) {
            if let tab = browser.currentTab, tab.isLoading {
                ProgressView(value: tab.progress).tint(SurferPalette.cyan)
                    .padding(.horizontal, 18).offset(y: 2)
            }
        }
    }

    private var addressIcon: String {
        guard let tab = browser.currentTab, let url = URL(string: tab.displayedURL) else { return "magnifyingglass" }
        return url.scheme == "https" ? "lock.fill" : "exclamationmark.triangle.fill"
    }

    private var addressColor: Color {
        addressIcon == "lock.fill" ? SurferPalette.mint : SurferPalette.muted
    }

    private var homePage: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 23) {
                Spacer(minLength: 14)
                HStack {
                    Spacer()
                    Image(systemName: "water.waves")
                        .font(.system(size: 34, weight: .medium))
                        .foregroundStyle(SurferPalette.cyan)
                        .frame(width: 82, height: 82)
                        .background(SurferPalette.cyan.opacity(0.1), in: Circle())
                    Spacer()
                }
                VStack(alignment: .leading, spacing: 9) {
                    Text("Find your\nquiet corner.")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .tracking(-0.8).lineSpacing(-1)
                    Text("Search with Startpage, or enter a site to get moving.")
                        .font(.subheadline).foregroundStyle(SurferPalette.muted).fixedSize(horizontal: false, vertical: true)
                }
                Button { browser.navigate("https://www.startpage.com/") } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                        Text("Search with Startpage")
                        Spacer()
                        Image(systemName: "arrow.up.right").font(.caption.weight(.bold))
                    }
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    .padding(16).background(SurferPalette.panel, in: RoundedRectangle(cornerRadius: 16))
                }
                VStack(alignment: .leading, spacing: 12) {
                    Label("GHOST CONTROL", systemImage: "shield.lefthalf.filled")
                        .font(.caption.weight(.bold)).tracking(1).foregroundStyle(SurferPalette.mint)
                    Text("Tracker blocking and HTTPS upgrades are on. Private tabs keep browsing data in a temporary WebKit store.")
                        .font(.subheadline).foregroundStyle(SurferPalette.muted).fixedSize(horizontal: false, vertical: true)
                    Button { browser.showingGhostControl = true } label: {
                        Text("Review privacy controls").font(.subheadline.weight(.semibold)).foregroundStyle(SurferPalette.cyan)
                    }
                }
                .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                .background(SurferPalette.panel, in: RoundedRectangle(cornerRadius: 18))
                if !browser.bookmarks.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("BOOKMARKS").font(.caption.weight(.bold)).tracking(1).foregroundStyle(SurferPalette.muted)
                            Spacer()
                            Button("See all") { browser.librarySelection = .bookmarks; browser.showingLibrary = true }
                                .font(.caption.weight(.semibold)).foregroundStyle(SurferPalette.cyan)
                        }
                        ForEach(browser.bookmarks.prefix(3)) { page in
                            Button { browser.navigate(page.url) } label: {
                                Label(page.title, systemImage: "bookmark.fill").font(.subheadline)
                                    .foregroundStyle(.white).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 22).padding(.bottom, 28)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var bottomBar: some View {
        HStack(spacing: 0) {
            barButton("chevron.backward", label: "Back", enabled: browser.currentTab?.canGoBack == true) { browser.currentTab?.webView.goBack() }
            barButton("chevron.forward", label: "Forward", enabled: browser.currentTab?.canGoForward == true) { browser.currentTab?.webView.goForward() }
            Spacer(minLength: 4)
            barButton("bookmark", label: "Bookmark") { browser.saveCurrentPage() }
            Button { showingTabs = true } label: {
                Text("\(browser.tabs.count)")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .frame(width: 29, height: 25)
                    .overlay(RoundedRectangle(cornerRadius: 7).stroke(.white.opacity(0.75), lineWidth: 1.5))
                    .foregroundStyle(.white).frame(maxWidth: .infinity)
            }.accessibilityLabel("\(browser.tabs.count) tabs")
            barButton("plus", label: "New tab") { browser.createTab() }
        }
        .padding(.horizontal, 12).padding(.top, 9).padding(.bottom, 5)
        .background(SurferPalette.background.opacity(0.98))
        .overlay(alignment: .top) { Rectangle().fill(.white.opacity(0.07)).frame(height: 1) }
    }

    private func barButton(_ icon: String, label: String, enabled: Bool = true, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 17, weight: .medium))
                .foregroundStyle(enabled ? .white : SurferPalette.muted.opacity(0.4))
                .frame(maxWidth: .infinity).frame(height: 38)
                .contentShape(Rectangle())
        }
        .disabled(!enabled)
        .accessibilityLabel(label)
    }
}

struct GhostControlSheet: View {
    @Environment(BrowserStore.self) private var browser
    @Environment(\.dismiss) private var dismiss
    @State private var confirmClear = false

    var body: some View {
        NavigationStack {
            List {
                Section("Protection") {
                    Label {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Tracker blocking").font(.body.weight(.semibold))
                            Text("Known ad and analytics hosts are blocked in page content.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    } icon: { Image(systemName: "shield.lefthalf.filled").foregroundStyle(SurferPalette.mint) }
                    Label {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("HTTPS upgrades").font(.body.weight(.semibold))
                            Text("Top-level HTTP links are upgraded to HTTPS when available.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    } icon: { Image(systemName: "lock.fill").foregroundStyle(SurferPalette.cyan) }
                    Label {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("WebKit privacy protections").font(.body.weight(.semibold))
                            Text("Cookie storage and tracking prevention use Apple WebKit defaults.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    } icon: { Image(systemName: "hand.raised.fill").foregroundStyle(.orange) }
                }
                Section("Private browsing") {
                    Button {
                        browser.togglePrivateMode()
                        dismiss()
                    } label: {
                        Label(browser.isPrivateMode ? "Open a regular tab" : "Open a private tab",
                              systemImage: browser.isPrivateMode ? "safari" : "eye.slash")
                    }
                    Text("Private tabs use a temporary website store and are not added to Ghost Surfer history. Network operators and websites may still see your connection.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section("Your library") {
                    Button { browser.librarySelection = .bookmarks; browser.showingLibrary = true; dismiss() } label: {
                        Label("Bookmarks", systemImage: "bookmark")
                    }
                    Button { browser.librarySelection = .history; browser.showingLibrary = true; dismiss() } label: {
                        Label("History", systemImage: "clock")
                    }
                    Button(role: .destructive) { confirmClear = true } label: {
                        Label("Clear cookies, cache, and history", systemImage: "trash")
                    }
                }
                Section {
                    Text("Ghost Surfer does not promise anonymity. Sites can still recognize activity through accounts, page content, and network-level signals. Tor routing from the desktop app is not available in this iOS build.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            .scrollContentBackground(.hidden)
            .background(SurferPalette.background)
            .navigationTitle("Ghost Control")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
            .confirmationDialog("Clear browsing data?", isPresented: $confirmClear, titleVisibility: .visible) {
                Button("Clear data", role: .destructive) { browser.clearBrowsingData() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This clears cookies, cached files, and history. Bookmarks stay saved.")
            }
        }
        .tint(SurferPalette.cyan)
        .preferredColorScheme(.dark)
    }
}

struct LibrarySheet: View {
    @Environment(BrowserStore.self) private var browser
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                let pages = browser.librarySelection == .bookmarks ? browser.bookmarks : browser.history
                if pages.isEmpty {
                    ContentUnavailableView(
                        browser.librarySelection.rawValue,
                        systemImage: browser.librarySelection == .bookmarks ? "bookmark" : "clock",
                        description: Text(browser.librarySelection == .bookmarks ? "Pages you save will appear here." : "Visited pages will appear here.")
                    )
                } else {
                    List(pages) { page in
                        Button { browser.navigate(page.url); dismiss() } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(page.title).font(.body.weight(.medium)).foregroundStyle(.primary).lineLimit(1)
                                Text(page.url).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle(browser.librarySelection.rawValue)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        ForEach(LibrarySelection.allCases) { item in
                            Button(item.rawValue) { browser.librarySelection = item }
                        }
                    } label: { Image(systemName: "line.3.horizontal.decrease.circle") }
                    .accessibilityLabel("Choose bookmarks or history")
                }
                ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } }
            }
        }
        .tint(SurferPalette.cyan)
        .preferredColorScheme(.dark)
    }
}

struct TabSwitcherSheet: View {
    @Environment(BrowserStore.self) private var browser
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(browser.tabs) { tab in
                        Button { browser.selectTab(tab.id); dismiss() } label: {
                            VStack(alignment: .leading, spacing: 10) {
                                HStack {
                                    Image(systemName: tab.isPrivate ? "eye.slash" : "globe")
                                        .foregroundStyle(SurferPalette.cyan)
                                    Text(tab.title).font(.subheadline.weight(.semibold)).lineLimit(1)
                                    Spacer()
                                    Button { browser.closeTab(tab.id) } label: {
                                        Image(systemName: "xmark").font(.caption.weight(.bold)).foregroundStyle(SurferPalette.muted)
                                            .frame(width: 30, height: 30).contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel("Close tab")
                                }
                                Text(tab.displayedURL.isEmpty ? "New tab" : tab.displayedURL)
                                    .font(.caption).foregroundStyle(SurferPalette.muted).lineLimit(1)
                            }
                            .padding(14)
                            .background(tab.id == browser.selectedTabID ? SurferPalette.cyan.opacity(0.14) : SurferPalette.panel,
                                        in: RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(tab.id == browser.selectedTabID ? SurferPalette.cyan.opacity(0.55) : .clear, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                    Button { browser.createTab(); dismiss() } label: {
                        Label("New tab", systemImage: "plus")
                            .font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity).padding(15)
                            .background(SurferPalette.raised, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                }
                .padding(16)
            }
            .background(SurferPalette.background)
            .navigationTitle("\(browser.tabs.count) Tabs")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
        .tint(SurferPalette.cyan)
        .preferredColorScheme(.dark)
    }
}
