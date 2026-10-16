# CLTCH npm software inventory

Generate the local production dependency inventory with:

```sh
npm run sbom:generate
```

This reads only `package-lock.json` and writes `docs/sbom/npm-production.cdx.json` in CycloneDX 1.5 JSON format. It follows the lockfile’s root `dependencies` and reachable package `dependencies`, installed `optionalDependencies`, and resolvable `peerDependencies` (skipping missing optional peers); it excludes root development dependencies. Versions and package URLs come from the lockfile. The output is deterministic and has no generation timestamp. Run `npm run smoke:sbom` after changing the manifest, lockfile, generator, or generated inventory; the smoke checks reproducibility, lockfile versions, production roots, graph references, and license-field coverage.

## License metadata limitation

The lockfile currently contains no package license metadata for the production closure. The SBOM therefore marks each of those entries `NOASSERTION`; it does not infer license terms from package names or network lookups. Review upstream package license files and notices when adding or materially updating dependencies, and record verified license details through a deliberate SBOM generator change. The SBOM is an inventory aid, not legal advice or proof of license compliance.

## Advisory review

Run `npm audit` during dependency review and triage findings by affected locked package, severity, reachable code path, and available compatible fix. Record why a finding remains open when it cannot be fixed immediately. Prefer targeted updates and regenerate the lockfile and SBOM together. Do not run `npm audit fix --force` or automatically upgrade packages; force upgrades may cross major-version boundaries. This inventory workflow makes no network requests and does not update dependencies.

The inventory reflects the npm lockfile, not files downloaded at deploy time, operating-system-specific native selection, Firebase Functions dependencies, or non-npm tools. Missing license metadata is explicit, and this inventory alone does not prove that the lockfile or source is vulnerability-free.
