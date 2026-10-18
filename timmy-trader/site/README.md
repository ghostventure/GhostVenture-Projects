# Timmy Public Website

Static public website for Timmy's Linux download, support, FAQ, boilerplates,
and legal/risk pages.

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

`site/downloads/timmy-trader_0.1.1_amd64.deb` is the current public Linux
download package. `site/downloads/CHANGELOG.txt` lists the 0.1.1 changes.
Refresh `site/downloads/SHA256SUMS.txt` after replacing the package; checksums
are relative to the `site/downloads/` directory.
