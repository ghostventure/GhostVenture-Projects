# Firebase Hosting rollback runbook

This procedure rolls back the **Hosting site only** for Firebase project and site `cltch-ntwrk-social`. A Hosting rollback serves a prior Hosting version as a new release. It does not roll back Cloud Functions, Firestore, Realtime Database, Storage, or their rules. If the incident involves those services, use their separate recovery procedures.

## Select a known-good release

1. Pause new deployments and record the incident, the time, and the currently live Hosting version.
2. Open the [Firebase console](https://console.firebase.google.com/project/cltch-ntwrk-social/hosting) and select the `cltch-ntwrk-social` Hosting site.
3. In **Release history**, compare the live release with earlier successful releases. Prefer the most recent release that predates the incident. Use a passing release manifest under `docs/releases/` to confirm its source commit when one is available; if no manifest exists, record that gap rather than guessing the source.
4. Confirm that the candidate release is for this site and that its public routes were healthy. Do not use a version ID copied from another project or site.

Firebase's supported Hosting rollback action is in the console: in the release history, open the menu for the chosen earlier release and select **Roll back**. Confirm the selected release and complete the confirmation prompt. The rollback creates a new release that serves the selected version's content. It does not rewrite source files or change the site's Firebase project.

The Firebase CLI version checked for this runbook was 15.34.0. It exposes read-only commands such as `hosting:channel:list` and the mutating `hosting:clone`; it does not expose a `hosting:rollback` command. `hosting:clone` deploys to its target channel, so it is not a rollback substitute and is intentionally not part of this runbook. Use the console Roll back action for the live channel. See [Firebase's Hosting release management guide](https://firebase.google.com/docs/hosting/manage-hosting-resources) and [CLI reference](https://firebase.google.com/docs/cli).

## Inspect without changing Hosting

From `cltch-ntwrk/`, the CLI can list Hosting channels without deploying:

```sh
npx firebase-tools hosting:channel:list --site cltch-ntwrk-social --project cltch-ntwrk-social --json --non-interactive
```

The command's result depends on the signed-in account's permissions. In the verification environment for this runbook, Firebase CLI 15.34.0 returned HTTP 403, `The caller does not have permission`, for this read-only request. Channel and release inventory could not be verified from that account. A project member with Firebase Hosting Viewer access can inspect; Firebase Hosting Admin is required to change Hosting resources. Check the project's assigned roles if the console or CLI denies access. See [Firebase Hosting roles and permissions](https://firebase.google.com/docs/projects/iam/permissions#firebase-hosting-permissions).

The local inspection script is read-only and has a no-network default:

```sh
node scripts/smoke-hosting-rollback.mjs
node scripts/smoke-hosting-rollback.mjs --version VERSION_ID
```

It validates the configured project/site and prints the public routes it will smoke. An optional version ID is only an operator-supplied label; the script cannot verify that the version exists, belongs to the site, or is selected in the console.

## Verify after rollback

Once the Firebase console shows the rollback release as finalized, run the explicit live smoke:

```sh
node scripts/smoke-hosting-rollback.mjs --version VERSION_ID --live
```

The live mode sends only HTTP GET requests to public routes on `https://cltch-ntwrk-social.web.app`. It checks for successful HTML responses and Firebase's “Site Not Found” page. It does not authenticate, inspect private workflows, query Firebase release history, prove which Hosting version is live, or test Functions/database/rules behavior. Confirm the active release and version ID in the console, then separately verify the workflows implicated in the incident.

Record the rollback release ID, selected version ID, source commit if known, UTC completion time, smoke output, and any remaining service-specific issues in the release record. Resume deployments only after the incident owner reviews the result.

## Safety boundaries

- The script never invokes Firebase CLI, changes files, creates a preview channel, clones a version, or deploys.
- Do not run `firebase deploy` to roll back Hosting. That publishes the current local tree and may include unrelated changes.
- A Hosting rollback does not restore Firestore or Storage rules or Cloud Functions.
- If the candidate release's source or compatibility is unclear, stop and investigate before selecting it.
