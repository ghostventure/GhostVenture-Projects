# CLTCH release manifest

After a Firebase Hosting release is finalized, record its exact Hosting version and run:

```sh
cd cltch-ntwrk
node scripts/release-manifest.mjs --hosting-version HOSTING_VERSION_ID
```

The command checks the public homepage, sign-in page, FAQ, Gig Radar, and privacy page. It writes a timestamped JSON record under `docs/releases/` with the Firebase project/site, source branch and commit, Hosting version, check time, HTTP status for each URL, and an overall smoke result. A failed route is recorded and makes the command exit nonzero. Use the version ID reported by the completed Firebase Hosting release; the script cannot infer that ID from a deploy that has not yet happened.

To write elsewhere, pass `--output PATH`. Output files are created exclusively so an existing release record is never silently replaced. Run `npm run smoke:release-manifest` to verify commit/version capture, route evidence, and failure handling without contacting production.
