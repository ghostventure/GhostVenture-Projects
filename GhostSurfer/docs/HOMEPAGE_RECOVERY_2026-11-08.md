# Ghost Surfer Hosting Recovery and Deployment Record

Recorded: 2026-11-08  
Public site: <https://ghost-surfer-browser.web.app/>  
Firebase project/site: `ghost-surfer-browser`

## Current Hosting Release — 2026-11-09

- Source repository: `ghostventure/GhostVenture-Projects`
- Branch: `codex/ghost-surfer-site-linux-20261108`
- Source commit: `3ecc96b` — `Add Linux distro-aware installation manager`
- Firebase Hosting release time: `2026-11-09 18:34:53` (live channel)
- Deployment scope: Hosting only; 41 files
- Public site: <https://ghost-surfer-browser.web.app/>
- Linux manager archive: <https://ghost-surfer-browser.web.app/downloads/managers/linux/ghost-surfer-manager-linux-x86_64.tar.gz>
- Linux manager SHA-256: `adeb74aa8ac3a01ecf8bfa3dc3120d553dfe61fdab8a5f015179618c3595a3a2`

The Linux x86_64 manager route is enabled in the installer manifest. Live
verification confirmed the homepage and manifest returned HTTP 200, the
manager archive returned HTTP 200, and the downloaded archive matched the
manifest SHA-256. The Go manager's local plan identified Kali Linux with glibc
2.43 and selected Ghost Surfer 0.2.6. This verifies package publication and
catalog selection; it does not claim that a fresh app installation was run.

Windows and Mac manager routes remain unavailable until those manager
packages are built and uploaded. The Linux app itself remains the x86_64/glibc
release published on GitHub. Kali is the verified target; other glibc
distributions require explicit opt-in to the manager's compatibility warning.

## Previous Recovery Checkpoint — 2026-11-08

- Source repository: `ghostventure/GhostVenture-Projects`
- Branch: `codex/ghost-surfer-site-linux-20261108`
- Source commit: `15fa353` — `Add Linux and current Mac release to consolidated site`
- Firebase Hosting version: `1544c79c9da6d47c`
- Firebase Hosting release: `1794170199456000`
- Released: `2026-11-08T20:36:39.456Z`
- Deployed files: 40

The commit is the recovery source for the homepage copy and site navigation. The Hosting version is the fastest exact rollback target while Firebase retains it.

## What This Homepage Contains

- A compact Ghost Surfer homepage with the FAQ, Reading Room, downloads, legal hub, and support pages in shared navigation.
- The spooky Ghost Surfer wordmark across all visible brand mentions. The homepage loads `styles.css?v=20261108-wordmark` to avoid reusing an older cached stylesheet; HTML responses revalidate.
- Windows and Linux desktop releases at version 0.2.6, linked to the GitHub release.
- The complete native Mac app at version 0.2.3, presented as an available app rather than a preview. Its installer is hosted on Firebase.
- The signed Sparkle appcast and update files for Mac releases 0.2.1 through 0.2.3.

The Mac installer itself is unsigned and unnotarized, so the page retains the Gatekeeper approval guidance. Mac uses WebKit cookie handling and does not currently include the Windows/Linux per-site cookie controls or local Tor routing.

## Exact Firebase Rollback

From this project's directory, clone the last known-good Hosting version back to the live channel:

```bash
npx --yes firebase-tools@15.22.4 hosting:clone ghost-surfer-browser@1544c79c9da6d47c ghost-surfer-browser:live --project ghost-surfer-browser
```

Use the Firebase account with access to the `ghost-surfer-browser` project. Confirm the clone reports that it released the version, then run the live checks below. The command restores the complete Hosting version, including the HTML, CSS, Mac installer, appcast, update archives, and other files.

## Rebuild From Source

If making a new deployment from the branch instead of cloning the saved version:

1. Check out commit `3ecc96b` or a later reviewed commit on `codex/ghost-surfer-site-linux-20261108`.
2. Confirm `site/index.html` still contains the Linux 0.2.6 and Mac 0.2.3 download cards.
3. Restore `site/downloads/Ghost-Surfer-macOS-0.2.3.pkg` and the signed `site/appcast-macos.xml` plus every file referenced by that appcast. These release binaries are ignored by Git. Do not edit the signed appcast or signed update notes; regenerate signatures with the Mac release tools if their contents must change. Keep the tracked Linux manager archive and manifest checksum together.
4. Verify the Mac installer against `site/downloads/SHA256SUMS.txt` and verify that the Linux GitHub release URL returns HTTP 200.
5. Deploy Hosting only. On Linux, use:

   ```bash
   npx --yes firebase-tools@15.22.4 --account solidartentertainment@gmail.com deploy --only hosting --project ghost-surfer-browser
   ```

   On Windows, the documented `npm run deploy` also runs `scripts/prepare-release-assets.ps1` before Firebase Hosting deployment.

## Live Verification

After rollback or deployment, verify the homepage advertises all three platforms and the right current versions:

```bash
curl -fsS https://ghost-surfer-browser.web.app/ -o /tmp/ghost-surfer-home.html
grep -E 'GhostSurfer-Linux-x86_64-v0.2.6.tar.gz|Ghost-Surfer-macOS-0.2.3.pkg|Mac app · Version 0.2.3' /tmp/ghost-surfer-home.html
curl -ILs -o /dev/null -w 'Linux release HTTP %{http_code}\n' https://github.com/ghostventure/GhostVenture-Projects/releases/download/v0.2.6/GhostSurfer-Linux-x86_64-v0.2.6.tar.gz
```

The 2026-11-08 checkpoint verification returned HTTP 200 for the Linux GitHub release, Mac 0.2.3 installer, FAQ, Reading Room, legal, support, and security routes. Its deployed homepage, wordmark stylesheet, and signed Mac appcast matched the source hashes; the homepage returned `Cache-Control: no-cache`. For current Linux manager checks, see the 2026-11-09 release record above.

## Deployed File Fingerprints

SHA-256 values for the baseline source files:

| File | SHA-256 |
| --- | --- |
| `site/index.html` | `cd545e48ef3effff869d042c94c15b619aee3edbbd4587bdc2d1f6835536312a` |
| `site/styles.css` | `ea51272d334c5e70013d29d20a18ca038c5eae5af8cad3eda3970e68f3d81be3` |
| `site/appcast-macos.xml` | `f609a3e0e358fe4c2441a5913182bb8b776cba25a3f718cf046db8634c8e5d93` |
