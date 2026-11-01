# OverHead 0.3.25 — manager-led Desktop updates

This note records source changes for 0.3.25. It does not confirm that a signed installer has been built, published, or installed.

- Desktop checks the latest compatible GitHub release and notifies the user when a newer version is available.
- After user consent, Desktop starts its Install Manager companion and exits.
- The manager verifies GitHub release metadata, installer SHA-512 and size, and Authenticode publisher; backs up local data; removes the registered prior OverHead installation; installs into the same folder; verifies the installed version and publisher; and restores user data to its pre-update state if its integrity check detects a change.
- Same-version repair/reinstall is supported. Downgrades are blocked.
- Desktop installer packaging embeds the manager companion under the selected build trust policy. Cylinder packages remain separate.

The first manager-enabled installer must be installed once before the manager handoff is available to an existing Desktop installation. A signed release and matching GitHub `latest.yml` and installer assets are required before the update flow can run end to end.
