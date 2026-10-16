# CLTCH Progress — 2026-10-16

## Current source state

- Current worktree is on `codex/cltch-map-list` at `ef399e1` (`Add consent-aware Gig Radar map and list view`), based on `ab1c362` (`Improve gig radar alerts and search accessibility`).
- Relative to `origin/codex/cltch-modernization-20261016`, this branch is 1 commit ahead and 7 commits behind. The histories are divergent; the modernization tip's cumulative diff removes many unrelated features from this branch, so a wholesale merge is unsafe. The map/list feature also exists as a separate commit in that history, but it is not an ancestor of this branch.
- The current commit history includes stable gig paging and match feedback, host venue safety guidance, performer profile and distance guidance, and performer gig preparation checklists. The latest commit adds account-local new-match alerts and more accessible Gig Radar search controls.

## Pending map/list change

Commit `ef399e1` adds six feature paths: `app/gig-radar-map.js`, `gig-radar.html`, `package.json`, `scripts/smoke-gig-radar-map-list.mjs`, `docs/FEATURE_AUDIT_200.md`, and `firebase.json`. Together they add a map/list toggle, coordinate-based gig selection, explicit user-triggered OpenStreetMap loading with a location/network disclosure, and a source-level smoke script. The Hosting Content Security Policy now allows only `https://www.openstreetmap.org` in `frame-src` for the map embed. The feature audit marks item 065 complete.

`npm run smoke:gig-radar-map-list` passed locally after the CSP update. This source smoke check does not verify the rendered page, map-provider availability, or a live deployment.

## Integration and deployment status

- The feature is committed locally; GitHub publication and Hosting deployment are separate pending steps. The branch remains divergent from the modernization comparison branch and has not been integrated into it.
- Repository deployment notes document earlier Firebase Hosting releases to `cltch-ntwrk-social`; they do not establish that the current branch tip or pending map/list changes are live.
- No current deployment result or authenticated/live behavioral verification is recorded here. Confirm Hosting deployment separately from Functions, Firestore, or other backend deployment; no backend deployment is implied.
- Before release, reconcile the branch, run the relevant smoke/build checks, then verify the deployed Hosting version and public routes. Record any backend prerequisites and authenticated checks independently.

## Evidence reviewed

- `git status --short --branch`, `git log -6 --oneline`, and `git rev-list --left-right --count origin/codex/cltch-modernization-20261016...HEAD`.
- Commit `ef399e1`, the map/list implementation and CSP change, and `docs/FEATURE_AUDIT_200.md`.
- `npm run smoke:gig-radar-map-list`.
- Existing deployment and modernization records: `docs/DEPLOY_CLTCH_NTWRK_SOCIAL_2026-06-21.md` and `docs/CLTCH_MODERNIZATION_2026-10-16.md`.
