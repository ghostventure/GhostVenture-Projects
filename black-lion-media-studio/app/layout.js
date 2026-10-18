import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";
import { AdSourceDiagnostics } from "../components/ad-source-diagnostics";
import { AnalyticsTracker } from "../components/analytics-tracker";
import { AuthSync } from "../components/auth-sync";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { ThemeProvider } from "../components/theme-provider";

const brandDisplayFont = localFont({
  src: "./fonts/daggerdancertitle.ttf",
  variable: "--font-brand-display"
});

const themeBootstrapScript = `
(() => {
  const storageKey = "bls-theme";
  const validThemes = new Set(["light", "dark", "system"]);
  const themeColors = { light: "#dffbff", dark: "#071b24" };
  const root = document.documentElement;
  const savedTheme = window.localStorage.getItem(storageKey) || "system";
  const themeChoice = validThemes.has(savedTheme) ? savedTheme : "system";
  const resolvedTheme =
    themeChoice === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : themeChoice;
  root.dataset.theme = resolvedTheme;
  root.dataset.themeChoice = themeChoice;
  root.style.colorScheme = resolvedTheme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", themeColors[resolvedTheme]);
})();
`;

export const metadata = {
  metadataBase: new URL("https://black-lion-media-studio.web.app"),
  title: {
    default: "Black Lion Studios - Multimedia, Tech Development, and Fashion",
    template: "%s | Black Lion Studios"
  },
  description:
    "Choose Black Lion Multimedia, Black Lion Tech Development, or Black Lion Fashion for production, software, web, merch, modeling, and client portal requests.",
  applicationName: "Black Lion Studios",
  alternates: {
    canonical: "/"
  },
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Black Lion Studios",
    title: "Black Lion Studios - Multimedia, Tech Development, and Fashion",
    description:
      "Choose Black Lion Multimedia, Black Lion Tech Development, or Black Lion Fashion for production, software, web, merch, modeling, and portal requests.",
    images: [
      {
        url: "/ai/hero-editorial.png",
        width: 1200,
        height: 630,
        alt: "Black Lion Studios branch directory and client portal"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Black Lion Studios - Multimedia, Tech Development, and Fashion",
    description:
      "Choose Black Lion Multimedia, Black Lion Tech Development, or Black Lion Fashion for production, software, web, merch, modeling, and portal requests.",
    images: ["/ai/hero-editorial.png"]
  }
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#dffbff" },
    { media: "(prefers-color-scheme: dark)", color: "#071b24" }
  ],
  colorScheme: "light dark"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={brandDisplayFont.variable}>
        <ThemeProvider>
          <AdSourceDiagnostics />
          <AnalyticsTracker />
          <AuthSync />
          <a className="skip-link" href="#main-content">Skip to main content</a>
          <SiteHeader />
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
          <Toaster position="top-right" richColors closeButton />
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
