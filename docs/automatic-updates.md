# Automatic updates: desktop and Cylinder

Both editions check before opening the main workspace when due. A saved `lastAttemptAt` in each edition's `update-preferences.json` limits checks to once every 72 hours, including across app restarts. First launch with no recorded attempt checks immediately. Offline or failed attempts count toward the interval. Manual Check and re-enabling Auto-Check respect the same limit.

While the app remains open, a local timer checks eligibility once a minute; it makes no network requests until the 72 hours have elapsed. Startup waits are bounded, so an unavailable update service does not prevent opening the workspace. A check already in progress cannot be duplicated.

Automatic checking defaults on. An existing explicit Auto-Check off preference remains respected. Standard desktop and Cylinder retain separate data directories and update feeds. Downloads happen through the updater's automatic download mechanism and install on app exit; this setting does not silently force a restart.

Validation: `node --test scripts/update-schedule.test.cjs` checks persisted throttling, concurrency, failed requests, expiry, and preservation of a downloaded update. Changed packages must be installed before existing installations gain this behavior.

Local installers are in `release-updates-desktop-0.3.13` and `release-updates-cylinder-0.3.13`. Both packaging runs and isolated packaged startup checks passed. Cylinder's Server edition is simulated by its test harness. These builds have not been installed or published to the site.
