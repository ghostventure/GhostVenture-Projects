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

`site/downloads/timmy-trader_0.1.4_amd64.deb` is the expected public Linux
download package for release 0.1.4. Copy in the final package before deploying,
then generate `SHA256SUMS.txt` from inside `site/downloads/` so it contains the
artifact basename and works when both downloaded files are in the same folder:

```sh
cd site/downloads
sha256sum timmy-trader_0.1.4_amd64.deb > SHA256SUMS.txt
```

Do not deploy until the package and matching checksum are both present.
