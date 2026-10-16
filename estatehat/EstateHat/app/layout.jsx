export const metadata = {
  title: "EstateHat",
  description: "EstateHat is a modern home-deal workspace for listings, messages, forms, and closing steps.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/estatehat-icon.svg"
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4fff6"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600;6..72,700;6..72,800&family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-TWW3MG8S');`
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const storedTheme = localStorage.getItem('estatehat-theme'); const legacyDark = localStorage.getItem('estatehat-dark') === 'true'; const theme = storedTheme || (legacyDark ? 'dark' : 'light'); document.documentElement.dataset.estatehatTheme = theme; document.documentElement.classList.toggle('dark', theme !== 'light'); } catch {} })();`
          }}
        />
      </head>
      <body>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-TWW3MG8S"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
