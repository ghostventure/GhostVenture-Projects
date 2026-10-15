import "../src/styles.css";

export const metadata = {
  metadataBase: new URL("https://foxhub-superapp.web.app"),
  title: "FoxHub - Private circles and trusted local help",
  description: "Join FoxHub for private circles, trusted local help, groups, events, and member-first community tools in one place.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "FoxHub",
    title: "FoxHub - A place for your people to stay close",
    description: "Early access is open for FoxHub: private circles, local help, trusted recommendations, plans, and member-first community tools.",
    images: [
      {
        url: "/foxhub-social-preview.png",
        width: 1200,
        height: 630,
        alt: "FoxHub early access social preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "FoxHub - A place for your people to stay close",
    description: "Join FoxHub early access for private circles, trusted local help, groups, events, and member-first community tools.",
    images: ["/foxhub-social-preview.png"]
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
