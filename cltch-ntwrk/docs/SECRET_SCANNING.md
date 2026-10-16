# Local secret scanning and deployment guard

Run `npm run scan:secrets` before publishing source changes. `npm run deploy:hosting` runs the same scanner through `scripts/guard-deploy.mjs` and refuses to continue when it finds a possible credential or cannot complete the scan.

The scanner uses the local Git executable and Node.js only. It inspects both the working-tree contents and the staged Git index blob for tracked files, plus nonignored untracked files in the working tree. This catches staged content even when the working-tree copy has since changed. It checks high-confidence credential file names, private-key blocks, AWS access-key identifiers, GitHub tokens, Stripe secret/restricted keys, Slack tokens, Google service-account key JSON, and assignments to common secret variable names. It reports a path, line, and rule identifier; it never prints the matched text. Git or file-reading failures, including oversized candidate files, fail closed in the deploy guard.

The `.gitignore` rules exclude common environment and credential files from ordinary Git adds. They are a convenience, not a security boundary: forced staging can still include ignored files, and the scanner checks staged files. Check the staged paths before publishing.

## False positives and allowlist

Firebase browser configuration keys and Stripe `pk_` publishable keys are intentionally not treated as secrets by these patterns. They are designed for public client use; protect access through the provider's own restrictions and rules. A clean scan does not guarantee that all secrets are found. New credential formats, encoded values, binaries, ignored untracked files, or external artifact inputs may need additional checks.

The checked-in `scripts/secret-scan-allowlist.json` is empty. If a reviewed safe fixture must be suppressed, add one entry containing its exact repository-relative path, rule ID, SHA-256 of the complete file, and a short reason. A file edit invalidates the entry. Do not add directory, glob, or rule-wide suppressions. Review allowlist changes with the same care as source code; the file cannot make an exposed credential safe.

This guard covers the local CLTCH Hosting repository tree and its Git working files. It is not a GitHub credential-scanning service, does not call an external API, and does not certify unrelated release artifacts or deployment systems.
