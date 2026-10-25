# Timmy Public Website

Static public website for Timmy's Linux download, user guide, advanced setup
examples, support, FAQ, and legal notices.

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

`site/downloads/Timmy-Installation-Manager_0.1.16_amd64.deb` is the current
public Linux installer. Keep `SHA256SUMS.txt` synchronized with this package
before deploying. Generate it from the download directory so the listed
basename resolves beside the checksum file:

```sh
cd site/downloads
sha256sum Timmy-Installation-Manager_0.1.16_amd64.deb > SHA256SUMS.txt
```

Do not deploy until the package and matching checksum are both present.
