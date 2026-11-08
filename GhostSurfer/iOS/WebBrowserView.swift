import SwiftUI
import WebKit

struct WebBrowserView: UIViewRepresentable {
    @Environment(BrowserStore.self) private var browser
    let tab: BrowserTab

    func makeCoordinator() -> Coordinator { Coordinator(browser: browser, tab: tab) }

    func makeUIView(context: Context) -> WKWebView {
        tab.webView.navigationDelegate = context.coordinator
        tab.webView.addObserver(context.coordinator, forKeyPath: #keyPath(WKWebView.estimatedProgress), options: .new, context: nil)
        if tab.webView.url == nil { tab.webView.load(URLRequest(url: BrowserStore.homeURL)) }
        return tab.webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.removeObserver(coordinator, forKeyPath: #keyPath(WKWebView.estimatedProgress))
        uiView.navigationDelegate = nil
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        let browser: BrowserStore
        let tab: BrowserTab

        init(browser: BrowserStore, tab: BrowserTab) {
            self.browser = browser
            self.tab = tab
        }

        override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey: Any]?, context: UnsafeMutableRawPointer?) {
            guard keyPath == #keyPath(WKWebView.estimatedProgress) else { return }
            Task { @MainActor in browser.update(tab) }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            browser.update(tab)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            browser.update(tab)
            browser.recordHistory(tab)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            browser.update(tab)
            browser.lastError = error.localizedDescription
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            browser.update(tab)
            if (error as NSError).code != NSURLErrorCancelled { browser.lastError = error.localizedDescription }
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url,
                  url.scheme?.lowercased() == "http",
                  navigationAction.targetFrame?.isMainFrame != false,
                  var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
                decisionHandler(.allow)
                return
            }
            components.scheme = "https"
            guard let upgraded = components.url else { decisionHandler(.allow); return }
            decisionHandler(.cancel)
            webView.load(URLRequest(url: upgraded))
        }
    }
}
