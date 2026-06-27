import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";
import { AdSourceDiagnostics } from "../components/ad-source-diagnostics";
import { AnalyticsTracker } from "../components/analytics-tracker";
import { AuthSync } from "../components/auth-sync";
import { SiteFooter } from "../components/site-footer";
import { ThemeProvider } from "../components/theme-provider";

const brandDisplayFont = localFont({
  src: "./fonts/daggerdancertitle.ttf",
  variable: "--font-brand-display"
});

const themeBootstrapScript = `
(() => {
  const storageKey = "bls-theme";
  const validThemes = new Set(["light", "dark", "system"]);
  const themeColors = { light: "#f5f5ef", dark: "#0d1510" };
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
    default: "Black Lion Studios - Creative Production, Tech Support, and Merch",
    template: "%s | Black Lion Studios"
  },
  description:
    "Build a Service Estimation, book Black Lion Studios for photography, video, music, DJ services, membership sites, PC support, and keep requests in one client portal.",
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
    title: "Black Lion Studios - Creative Production, Tech Support, and Merch",
    description:
      "Build a Service Estimation and book photography, video, music, DJ services, membership sites, PC support, and merch requests through one Black Lion Studios portal.",
    images: [
      {
        url: "/ai/hero-editorial.png",
        width: 1200,
        height: 630,
        alt: "Black Lion Studios creative production and service portal"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Black Lion Studios - Creative Production, Tech Support, and Merch",
    description:
      "Build a Service Estimation and book photography, video, music, DJ services, membership sites, PC support, and merch requests through one portal.",
    images: ["/ai/hero-editorial.png"]
  }
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1510" }
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
          {children}
          <Toaster position="top-right" richColors closeButton />
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
