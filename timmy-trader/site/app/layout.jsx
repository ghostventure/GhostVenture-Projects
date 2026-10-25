import Script from "next/script";

export const metadata = {
  metadataBase: new URL("https://timmy-tradesonauto.web.app"),
  title: "Timmy | Auto Trade Assistant",
  description:
    "Timmy is a Finance-Punk Linux Auto Trade Assistant for market discovery, risk-capped planning, paper practice, and guarded broker execution.",
  icons: {
    icon: "/assets/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/css/styles.css" />
        <meta name="theme-color" content="#090d0b" />
      </head>
      <body>
        {children}
        <Script src="/js/site.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
