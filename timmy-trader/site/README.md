# Timmy Public Website

Next.js public website for Timmy's Linux download, user guide, advanced setup
examples, support, FAQ, and legal notices. It uses static export, so Firebase
Hosting serves generated files without a Next.js server or Functions runtime.

Live Firebase Hosting site: <https://timmy-tradesonauto.web.app>. Hosting serves
the public website only; it does not install or update the native Linux app.

## Local Development

Use Node.js `>=20.9` and npm.

```sh
cd site
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Static Export

Build the static site before deploying:

```sh
npm run build
```

Next.js writes the Firebase Hosting root to `site/out`. The app emits `.html`
files for the existing public routes. Files in `site/public/` are copied into
the export unchanged. Shared navigation and footer components live in
`site/app/SiteChrome.jsx`; the preserved page copy lives in
`site/content/pages/` and is rendered by the static route components.

## Firebase Hosting

From the Timmy repository root, deploy the built export. The local Firebase project ID is `timmy-tradesonauto`. Hosting serves the
`site/out/` export and keeps the Next.js source and Timmy runtime files outside
the public root.

```sh
npx --yes firebase-tools deploy --only hosting --project timmy-tradesonauto
```

## Download Artifact

`site/public/downloads/Timmy-Installation-Manager_0.1.16_amd64.deb` is the current
public Linux installer. Keep `SHA256SUMS.txt` synchronized with this package
before deploying. Generate it from the download directory so the listed
basename resolves beside the checksum file:

```sh
cd site/public/downloads
sha256sum Timmy-Installation-Manager_0.1.16_amd64.deb > SHA256SUMS.txt
```

Do not deploy until the package and matching checksum are both present. Run
`npm run build` from `site/` before Firebase Hosting deployment.
