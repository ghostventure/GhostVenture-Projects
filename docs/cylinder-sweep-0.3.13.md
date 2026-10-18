# Cylinder 0.3.13 maintenance

## Changes

- Identifies Cylinder on the sign-in screen, window title and system tray through a main-process deployment argument exposed by the sandboxed preload.
- Replaces standard desktop plan selection and checkout with a Cylinder deployment panel before and after sign-in. Shows current access, a valid evaluation end date, host, data location, usage, and a deployment-support link.
- Blocks standard desktop billing API requests in Cylinder, including checkout, Gold trials and cancellation. Hiding controls alone does not enforce this boundary.
- Exposes deployment identity in locked backend health responses.
- Limits the Windows registry edition probe to five seconds and 16 KB of output, failing closed when the check fails. Retains Server and standalone IoT matching.
- Rejects trial subscriptions with absent, invalid or expired dates. Paid subscriptions remain unaffected.
- Inherits the shared backend's request deadlines, paginated reads, session-aware sync, restore validation and sanitized support bundles, along with existing desktop UX fixes.

## Checks

```powershell
node --test scripts/cylinder-sweep.test.cjs scripts/backend-sweep.test.cjs scripts/stripe-connector.test.cjs
npm run lint
npm run build
npm run dist:cylinder -- --config.directories.output=release-cylinder-sweep-0.3.13
node scripts/smoke-cylinder-sweep.cjs
```

The combined regression suite passes 27 tests. Syntax checks pass for all four Electron entry/backend/preload files. Renderer build succeeds; lint reports existing warnings and no errors.

The package smoke harness uses the packaged Cylinder launcher and app code with an isolated temporary profile. Only the registry ProductName response is simulated as Windows Server 2022. It checks Cylinder branding, Plans navigation, absence of desktop checkout, support URL, isolated Cylinder data path, a single open window, and the Cylinder updater feed. This does not prove operation on real Server/IoT hardware or a second-process launch.

The production launcher retains its real edition check; no test bypass is shipped. The host edition check identifies a Windows product family, not runtime compatibility with every Server/IoT version.

The packaged smoke test passed, and the installer build completed successfully. Installer size: 103,960,218 bytes. SHA-256: `135884f15aced0b03bf1aa557ef79ad71447d688ac3002a4cea6d5a485cf15a3`. Windows reports its signature status as `NotSigned`.

## Artifacts and boundaries

Build output: `release-cylinder-sweep-0.3.13/`. Smoke evidence: `smoke-result.json` and `cylinder-plans.png` in that directory. The installer is `OverHead-Cylinder-Setup-0.3.13-win-x64.exe`.

This maintenance does not install over an existing workspace or publish new Hosting artifacts. Installer execution, real Server/IoT validation, commercial activation and trusted code signing remain unverified. Local evaluation records are not a centralized licensing system: reinstall/restore and multiple-host evaluation enforcement need a separate licensing design.
