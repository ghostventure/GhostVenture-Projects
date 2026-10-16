# CLTCH Progress — 2026-10-16

## Current source state

- Current worktree is on `codex/cltch-map-list` at `b09b452e8fa128799e8cf774acc0edd656bbe46b` (`Add consent-aware Gig Radar map and list view`), based on `ab1c362` (`Improve gig radar alerts and search accessibility`).
- Relative to `origin/codex/cltch-modernization-20261016`, this branch is 1 commit ahead and 8 commits behind. The histories are divergent; the modernization tip's cumulative diff removes many unrelated features from this branch, so a wholesale merge is unsafe. The map/list feature also exists as a separate commit in that history, but it is not an ancestor of this branch.
- The current commit history includes stable gig paging and match feedback, host venue safety guidance, performer profile and distance guidance, and performer gig preparation checklists. The latest commit adds account-local new-match alerts and more accessible Gig Radar search controls.

## Map/list delivery

Commit `b09b452e8fa128799e8cf774acc0edd656bbe46b` adds six feature paths: `app/gig-radar-map.js`, `gig-radar.html`, `package.json`, `scripts/smoke-gig-radar-map-list.mjs`, `docs/FEATURE_AUDIT_200.md`, and `firebase.json`, plus this progress report. Together they add a map/list toggle, coordinate-based gig selection, explicit user-triggered OpenStreetMap loading with a location/network disclosure, and a source-level smoke script. The Hosting Content Security Policy now allows only `https://www.openstreetmap.org` in `frame-src` for the map embed. The feature audit marks item 065 complete.

`npm run smoke:gig-radar-map-list` passed locally. A live HTTP smoke check returned the Gig Radar page and map module with HTTP 200, confirmed list mode is the default, explicit map loading and the OpenStreetMap disclosure are present, and confirmed no eager iframe is emitted. A separate Hosting HEAD response confirmed the Content Security Policy permits the OpenStreetMap frame. No interactive browser or authenticated user-flow check was performed.

## Integration and deployment status

- Map/list source commit `5359fe3d7de3824a5aa02a6b939c78c13d151d08` was deployed to Firebase Hosting site `cltch-ntwrk-social` in project `cltch-ntwrk-social`. The pushed branch tip `b09b452e8fa128799e8cf774acc0edd656bbe46b` adds the progress report on top of that deployed source commit.
- Hosting deployment and public HTTP smoke checks passed. This was a Hosting-only deploy; no Functions, Firestore, or other backend deployment is implied. Authenticated user flows and interactive browser behavior remain unverified.
- Integrate the divergent branch history deliberately before treating it as the modernization branch's release candidate.

## Evidence reviewed

- `git status --short --branch`, `git log -6 --oneline`, and `git rev-list --left-right --count origin/codex/cltch-modernization-20261016...HEAD`.
- Commit `b09b452e8fa128799e8cf774acc0edd656bbe46b`, the map/list implementation and CSP change, and `docs/FEATURE_AUDIT_200.md`.
- `npm run smoke:gig-radar-map-list`; live page/module HTTP checks; Firebase Hosting deploy result for the map/list source commit.
- Existing deployment and modernization records: `docs/DEPLOY_CLTCH_NTWRK_SOCIAL_2026-06-21.md` and `docs/CLTCH_MODERNIZATION_2026-10-16.md`.
