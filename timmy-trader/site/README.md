# Timmy Public Website

Static public website for Timmy's Linux download, support, FAQ, boilerplates,
and legal/risk pages.

Live Firebase Hosting site: <https://timmy-tradesonauto.web.app>. Hosting serves
the public website only; it does not install or update the native Linux app.

## Local Preview

```sh
python3 -m http.server 8787 --directory site
```

Open `http://127.0.0.1:8787`.

## Firebase Hosting

The local Firebase project ID is `timmy-tradesonauto`. The site serves the
`site/` directory and keeps Timmy runtime files outside the public root.

```sh
npx --yes firebase-tools deploy --only hosting --project timmy-tradesonauto
```

## Download Artifact

`site/downloads/timmy-trader_0.1.5_amd64.deb` is the public Linux download
package for release 0.1.5. Keep the checksum file in sync with that artifact
before deploying so it contains the basename and can be checked in the same
download directory:

```sh
cd site/downloads
sha256sum timmy-trader_0.1.5_amd64.deb > SHA256SUMS.txt
```

Do not deploy until the package and matching checksum are both present.
