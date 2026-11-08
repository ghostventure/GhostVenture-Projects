import SwiftUI

private enum MacPalette {
    static let background = Color(red: 0.035, green: 0.055, blue: 0.085)
    static let sidebar = Color(red: 0.06, green: 0.085, blue: 0.12)
    static let panel = Color(red: 0.08, green: 0.115, blue: 0.16)
    static let cyan = Color(red: 0.22, green: 0.68, blue: 0.91)
    static let mint = Color(red: 0.39, green: 0.9, blue: 0.75)
    static let muted = Color(red: 0.56, green: 0.64, blue: 0.72)
}

struct MacBrowserRootView: View {
    @Environment(BrowserStore.self) private var browser
    @FocusState private var addressFocused: Bool
    @State private var showingControls = false
    @State private var confirmsClear = false

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider().overlay(.white.opacity(0.08))
            HStack(spacing: 0) {
                tabSidebar
                Divider().overlay(.white.opacity(0.08))
                pageArea
                if showingControls {
                    Divider().overlay(.white.opacity(0.08))
                    ghostControlSidebar
                }
            }
        }
        .background(MacPalette.background)
        .foregroundStyle(.white)
        .alert("Clear browsing data?", isPresented: $confirmsClear) {
            Button("Clear Data", role: .destructive) { browser.clearBrowsingData() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Cookies, cached files, and history will be removed. Bookmarks will stay saved.")
        }
        .onChange(of: browser.addressFocusRequest) { addressFocused = true }
    }

    private var toolbar: some View {
        HStack(spacing: 10) {
            Button { browser.currentTab?.webView.goBack() } label: {
                Image(systemName: "chevron.backward").frame(width: 28, height: 30)
            }
            .disabled(browser.currentTab?.canGoBack != true)
            .help("Back")
            .keyboardShortcut("[", modifiers: .command)

            Button { browser.currentTab?.webView.goForward() } label: {
                Image(systemName: "chevron.forward").frame(width: 28, height: 30)
            }
            .disabled(browser.currentTab?.canGoForward != true)
            .help("Forward")
            .keyboardShortcut("]", modifiers: .command)

            Button {
                if browser.currentTab?.isLoading == true { browser.currentTab?.webView.stopLoading() }
                else { browser.currentTab?.webView.reload() }
            } label: {
                Image(systemName: browser.currentTab?.isLoading == true ? "xmark" : "arrow.clockwise")
                    .frame(width: 28, height: 30)
            }
            .help(browser.currentTab?.isLoading == true ? "Stop loading" : "Reload")

            HStack(spacing: 9) {
                Image(systemName: addressIcon).foregroundStyle(addressColor)
                TextField("Search or enter a web address", text: Binding(
                    get: { browser.addressText }, set: { browser.addressText = $0 }
                ))
                .textFieldStyle(.plain)
                .focused($addressFocused)
                .onSubmit { browser.submitAddress(); addressFocused = false }
                .accessibilityLabel("Search or enter a web address")
                if !browser.addressText.isEmpty {
                    Button { browser.addressText = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(MacPalette.muted) }
                        .buttonStyle(.plain).help("Clear address")
                }
            }
            .padding(.horizontal, 11).frame(height: 34)
            .background(MacPalette.panel, in: RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).stroke(.white.opacity(0.09), lineWidth: 1))
            .frame(maxWidth: 720)

            Button { browser.saveCurrentPage() } label: { Image(systemName: "bookmark").frame(width: 30, height: 30) }
                .help("Bookmark this page")
                .keyboardShortcut("d", modifiers: .command)

            if browser.currentTab?.isPrivate == true {
                Label("Private", systemImage: "eye.slash.fill")
                    .font(.caption.weight(.semibold)).foregroundStyle(MacPalette.mint)
                    .padding(.horizontal, 9).padding(.vertical, 6)
                    .background(MacPalette.mint.opacity(0.12), in: Capsule())
            }

            Button { showingControls.toggle() } label: {
                Image(systemName: "shield.lefthalf.filled").foregroundStyle(MacPalette.mint)
                    .frame(width: 32, height: 30)
            }
            .help("Ghost Control")
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(MacPalette.background)
    }

    private var addressIcon: String {
        guard let url = URL(string: browser.currentTab?.displayedURL ?? "") else { return "magnifyingglass" }
        return url.scheme == "https" ? "lock.fill" : "exclamationmark.triangle.fill"
    }

    private var addressColor: Color { addressIcon == "lock.fill" ? MacPalette.mint : MacPalette.muted }

    private var tabSidebar: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 9) {
                    Image(systemName: "water.waves").foregroundStyle(MacPalette.cyan)
                    Text("GHOST SURFER").font(.caption.weight(.heavy)).tracking(1.1)
                    Spacer()
                }
                .padding(.horizontal, 11).padding(.top, 15)

                VStack(alignment: .leading, spacing: 6) {
                    sectionHeader("TABS")
                    ForEach(browser.tabs) { tab in
                        HStack(spacing: 2) {
                            Button { browser.selectTab(tab.id) } label: {
                                HStack(spacing: 9) {
                                    Image(systemName: tab.isPrivate ? "eye.slash" : "globe")
                                        .foregroundStyle(tab.isPrivate ? MacPalette.mint : MacPalette.muted)
                                    Text(tab.title).lineLimit(1)
                                    Spacer(minLength: 0)
                                }
                                .font(.system(size: 12, weight: tab.id == browser.selectedTabID ? .semibold : .regular))
                                .padding(.horizontal, 10).frame(height: 32)
                                .background(tab.id == browser.selectedTabID ? MacPalette.cyan.opacity(0.15) : .clear,
                                            in: RoundedRectangle(cornerRadius: 7))
                            }
                            .buttonStyle(.plain)
                            .help(tab.displayedURL.isEmpty ? "New tab" : tab.displayedURL)
                            Button { browser.closeTab(tab.id) } label: {
                                Image(systemName: "xmark").font(.system(size: 9, weight: .bold))
                                    .frame(width: 25, height: 26).contentShape(Rectangle())
                            }
                            .buttonStyle(.plain).foregroundStyle(MacPalette.muted)
                            .help("Close tab")
                        }
                    }
                    Button { browser.createTab() } label: {
                        Label("New Tab", systemImage: "plus").font(.system(size: 12))
                            .foregroundStyle(MacPalette.muted).padding(.horizontal, 10).frame(height: 30)
                    }
                    .buttonStyle(.plain)
                }

                VStack(alignment: .leading, spacing: 6) {
                    sectionHeader("BOOKMARKS")
                    if browser.bookmarks.isEmpty {
                        Text("Saved pages appear here.").font(.caption).foregroundStyle(MacPalette.muted).padding(.horizontal, 10)
                    } else {
                        ForEach(browser.bookmarks.prefix(8)) { page in
                            Button { browser.navigate(page.url) } label: { libraryRow(page, icon: "bookmark") }
                                .buttonStyle(.plain)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    sectionHeader("RECENT HISTORY")
                    if browser.history.isEmpty {
                        Text("Regular browsing appears here.").font(.caption).foregroundStyle(MacPalette.muted).padding(.horizontal, 10)
                    } else {
                        ForEach(browser.history.prefix(6)) { page in
                            Button { browser.navigate(page.url) } label: { libraryRow(page, icon: "clock") }
                                .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, 10).padding(.bottom, 18)
        }
        .frame(width: 245)
        .background(MacPalette.sidebar)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title).font(.system(size: 10, weight: .bold)).tracking(1).foregroundStyle(MacPalette.muted)
            .padding(.horizontal, 10).padding(.top, 4)
    }

    private func libraryRow(_ page: SavedPage, icon: String) -> some View {
        HStack(spacing: 9) {
            Image(systemName: icon).foregroundStyle(MacPalette.muted).frame(width: 14)
            VStack(alignment: .leading, spacing: 2) {
                Text(page.title).lineLimit(1).foregroundStyle(.white)
                Text(page.url).lineLimit(1).font(.system(size: 10)).foregroundStyle(MacPalette.muted)
            }
            Spacer(minLength: 0)
        }
        .font(.system(size: 11)).padding(.horizontal, 10).padding(.vertical, 5)
        .contentShape(Rectangle())
    }

    private var pageArea: some View {
        VStack(spacing: 0) {
            if let message = browser.lastError {
                HStack(spacing: 8) {
                    Image(systemName: "info.circle.fill")
                    Text(message).lineLimit(1)
                    Spacer()
                    Button { browser.lastError = nil } label: { Image(systemName: "xmark") }
                        .buttonStyle(.plain).help("Dismiss message")
                }
                .font(.caption).padding(.horizontal, 14).padding(.vertical, 8)
                .background(MacPalette.panel)
            }
            if let tab = browser.currentTab {
                if tab.displayedURL.isEmpty && !tab.isLoading {
                    homePage
                } else {
                    MacWebBrowserView(tab: tab).environment(browser)
                        .background(.white).frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            HStack {
                if let tab = browser.currentTab, tab.isLoading {
                    ProgressView(value: tab.progress).frame(maxWidth: 180)
                    Text("Loading").font(.caption).foregroundStyle(MacPalette.muted)
                } else {
                    Label("WebKit privacy protections active", systemImage: "shield.lefthalf.filled")
                        .font(.caption).foregroundStyle(MacPalette.muted)
                }
                Spacer()
                Text("\(browser.tabs.count) tab\(browser.tabs.count == 1 ? "" : "s")")
                    .font(.caption).foregroundStyle(MacPalette.muted)
            }
            .padding(.horizontal, 13).padding(.vertical, 7)
            .background(MacPalette.background)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var homePage: some View {
        VStack(alignment: .leading, spacing: 18) {
            Spacer()
            Image(systemName: "water.waves").font(.system(size: 43)).foregroundStyle(MacPalette.cyan)
            Text("Find your quiet corner.")
                .font(.system(size: 34, weight: .bold, design: .rounded))
            Text("Search with Startpage, or type an address above.")
                .font(.title3).foregroundStyle(MacPalette.muted)
            Button { browser.navigate("https://www.startpage.com/") } label: {
                Label("Search with Startpage", systemImage: "magnifyingglass")
                    .font(.headline).padding(.horizontal, 16).padding(.vertical, 11)
                    .background(MacPalette.panel, in: RoundedRectangle(cornerRadius: 9))
            }
            .buttonStyle(.plain)
            Button { browser.togglePrivateMode() } label: {
                Label("Open a private tab", systemImage: "eye.slash")
                    .font(.subheadline).foregroundStyle(MacPalette.mint)
            }
            .buttonStyle(.plain)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.leading, 70)
        .background(MacPalette.background)
    }

    private var ghostControlSidebar: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Label("GHOST CONTROL", systemImage: "shield.lefthalf.filled")
                    .font(.caption.weight(.bold)).tracking(0.7).foregroundStyle(MacPalette.mint)
                Spacer()
                Button { showingControls = false } label: { Image(systemName: "xmark") }
                    .buttonStyle(.plain).foregroundStyle(MacPalette.muted).help("Close controls")
            }
            controlCard(title: "Tracker blocking", detail: "Known advertising and analytics hosts are blocked by WebKit content rules.", icon: "hand.raised.fill")
            controlCard(title: "HTTPS upgrades", detail: "Top-level HTTP links are upgraded to HTTPS when possible.", icon: "lock.fill")
            controlCard(title: "Cookie controls", detail: "WebKit manages cookie storage and tracking prevention. iOS and macOS do not expose the desktop app's per-site cookie interception.", icon: "circle.grid.2x2.fill")
            Divider().overlay(.white.opacity(0.08))
            Button { browser.togglePrivateMode() } label: {
                Label(browser.currentTab?.isPrivate == true ? "Open a regular tab" : "Open a private tab",
                      systemImage: browser.currentTab?.isPrivate == true ? "safari" : "eye.slash")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.plain).foregroundStyle(MacPalette.cyan)
            Text("Private tabs use a temporary WebKit data store and do not save history. Network operators and websites may still observe activity.")
                .font(.caption).foregroundStyle(MacPalette.muted).fixedSize(horizontal: false, vertical: true)
            Spacer()
            Button(role: .destructive) { confirmsClear = true } label: {
                Label("Clear cookies, cache, history", systemImage: "trash")
            }
            .buttonStyle(.plain)
            Text("The desktop app's optional local Tor routing is not included in this native Mac build.")
                .font(.caption2).foregroundStyle(MacPalette.muted).fixedSize(horizontal: false, vertical: true)
        }
        .padding(16).frame(width: 290, alignment: .leading)
        .background(MacPalette.sidebar)
    }

    private func controlCard(title: String, detail: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Label(title, systemImage: icon).font(.subheadline.weight(.semibold))
            Text(detail).font(.caption).foregroundStyle(MacPalette.muted).fixedSize(horizontal: false, vertical: true)
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        .background(MacPalette.panel, in: RoundedRectangle(cornerRadius: 10))
    }
}
