# Timmy Daily Update - 2026-07-23

This note records the Timmy trading-desk updates completed on July 23, 2026.
It is source-safe documentation only; no broker credentials, account IDs, live
journals, runtime state, build output, or local profile files belong here.

## Summary

Timmy was upgraded from a crowded overview-oriented app into a model-driven
trading desk with dedicated workflow tabs, stronger live-account setup, broader
market scanning support, fractional order priority, watchlist automation,
runtime health hooks, and operator documentation.

The product principle is profit-seeking automation: Timmy's job is to find and
act on sensible money-making setups while keeping cash, broker, market-data,
risk, and audit controls visible. It should be practical about making money
without pretending any trade is guaranteed. The operating rule is simple:
make money without being reckless, clumsy, or wasteful.

## Trading And Execution

- Installed fractional equity trading priority so Timmy can size a fractional
  order when a whole-share order is too large for available cash or risk caps.
- Added actual-trading workflow documentation that separates paper, preview,
  manual live submit, and automatic live submit.
- Added execution workflows for order planning, broker preview, guarded live
  submit, rejected events, and local audit evidence.
- Moved execution controls into the `Execution` tab so live/paper actions live
  near the order queue and risk blockers.
- Added a power-cycle control and verified Timmy can be restarted from the app.

## Scanner, Universe, And Watchlists

- Added bundled US-listed ticker universe data to reduce cold-start discovery
  time.
- Added market-wide active watchlist rotation so Timmy can scan rotating
  batches across the known universe.
- Expanded generated watchlists for active, movement, trade-ready, and quiet
  removed symbols.
- Added Webull watchlist sync workflows so Timmy-managed watchlists can reflect
  the scanner output outside the local app when broker sync is enabled.
- Standardized the model around `Setup`, `Universe`, `Scanner`, `Strategy`,
  `Execution`, `Broker`, `Audit`, and `Health`.

## Setup And Broker Profile

- Added the native Webull setup surface for entering App Key, App Secret,
  account ID, region, endpoint, and live switches through the GUI instead of
  requiring casual users to edit env files.
- Added credential verification gating: the profile cannot be saved until the
  current values pass verification.
- Upgraded Setup into an Account Setup desk with account readiness tiles,
  masked account labels, buying-power status, `Verify Keys`, `Save Account`,
  `Account Check`, `Use Live`, and local profile/integrity status.
- Added setup boilerplates in `docs/boilerplates/` for paper, guarded live, and
  runtime reliability examples.
- Kept real credentials local and excluded from source and the public mirror.

## GUI And UX

- Reorganized the native GUI around Timmy's trading model instead of leaving
  most controls on Overview.
- Scoped overview-only widgets to Overview and moved detailed operational
  widgets into their owner tabs.
- Populated `Universe`, `Scanner`, `Strategy`, `Execution`, `Broker`, `Audit`,
  and `Health` with workflow-specific status and context.
- Installed sensible icons for obvious commands while keeping higher-context
  finance actions as text buttons.
- Added a restrained icon pass for scan, account check, preview, verify, save,
  examples, paper trade, live, stop, and power-cycle controls.
- Reduced redundant controls and standardized casual finance copy across the
  desk.
- Added a `Health` tab for readiness and guardrail status.
- Added Cash Account and Paper Account balance indicators on Overview, Setup,
  and Broker. Cash Account uses the broker buying-power snapshot; Paper Account
  is derived from Timmy's paper journal.
- Whispered the trading principle into the program as a quiet Health tab rule:
  make money, but never be reckless, clumsy, or wasteful.
- Split automation into paper and live lanes so Timmy can keep paper learning
  while the guarded live lane previews/submits through Webull when live checks
  pass.
- Added automation feedback events for above-expectation and below-expectation
  lane results so useful paper, live, blocked, rejected, and no-plan evidence
  feeds back into Timmy's local learning trail.
- Fixed the Cash Account indicator so Account Check fetches the selected
  Webull account balance endpoint instead of only reading the account list.
- Strengthened dual-lane automation by keeping the live lane on the same plan
  pass after paper journaling, classifying rejected live responses as
  below-expectation feedback, and deduping repeated feedback so the learning
  trail is useful instead of noisy.

## Reliability, Health, And Adaptability

- Added runtime health helpers for process, source boundary, profile, broker,
  market data, watchlist, order queue, audit, and watchdog status.
- Added watchdog scaffolding in `scripts/timmy_watchdog.py`.
- Added broker reconciliation helpers, position modeling, market guard checks,
  diagnostics, settings profile support, and strategy preset support.
- Added documentation hooks for the requested 40-upgrade package so future
  work has an assigned module, owner surface, and verification contract.
- Added tamper-resistance workflow visibility through audit-chain and protected
  runtime-file status.

## Documentation Added Or Updated

- `docs/WORKFLOWS.md`: operational workflows, actual trading, tab ownership,
  live brokerage boundaries, watchlist sync, setup, and redundancy audit.
- `docs/OPERATOR_CHECKLIST.md`: daily setup, pre-market, market-open, auto/user,
  paper/live, and broker-preview checks.
- `docs/UPGRADE_MANIFEST.md`: 40 requested upgrade slots, owners, status, and
  verification contracts.
- `docs/IMPLEMENTATION_OUTLINE.md`: implementation guidance for trading-desk
  upgrades.
- `docs/boilerplates/README.md`: setup boilerplate overview.
- `docs/boilerplates/paper-desk.env.example`: paper-first starter settings.
- `docs/boilerplates/live-guarded.env.example`: guarded live starter settings.
- `docs/boilerplates/runtime-reliability.env.example`: watchdog and runtime
  reliability starter settings.
- `site/`: public Timmy website with Linux download, support, FAQ, contact,
  boilerplates, legal/risk/privacy pages, generated hero imagery, and Firebase
  hosting config for the Timmy-like project ID found under the signed-in
  `solidartentertainment@gmail.com` Firebase account.

## Verification Completed

- Local test suite: `115 passed`.
- Public mirror test suite: `115 passed`.
- Smoke test: passed.
- Python compile checks: passed.
- Desktop ELF rebuild: passed.
- Timmy desktop relaunch: one active Timmy process confirmed.
- Setup screenshot inspection: corrected layout rendered cleanly.
- Source-only mirror checks: runtime artifacts, caches, build output, local
  profiles, and credential files excluded.
- Secret scan before push: clean.
- Public site link and checksum checks: passed.
- Public site desktop/mobile screenshot checks: passed.

## GitHub Commits

The following Timmy mirror commits were created on July 23, 2026:

- `174ae23` - Update Timmy fractional trading controls
- `ad2ea1d` - Add Timmy market-wide active watchlist rotation
- `c4810c9` - Expand Timmy generated watchlists
- `0363eca` - Sync Timmy watchlists to Webull
- `6f51970` - Add Timmy operational workflows
- `101ed37` - Document actual trading workflow
- `fe23e1f` - Add Timmy power cycle control
- `f9c9d54` - Bundle US listed ticker universe
- `ac817be` - Reorganize Timmy GUI around trading model
- `03d8ac5` - Scope Timmy overview widgets to overview
- `4756267` - Populate Timmy model tabs
- `9ebedec` - Add Timmy Webull profile setup
- `757d228` - Add Timmy Webull setup tab
- `8726b31` - Verify Timmy Webull setup before save
- `5d0fbcf` - Harden Timmy runtime integrity
- `c52e543` - Upgrade Timmy workflow tabs
- `297ab17` - Move Timmy execution controls into Execution tab
- `1b6bc19` - Refine Timmy focused workflow tabs
- `94caf93` - Streamline Timmy workflow tabs
- `f694fb6` - Install Timmy trading desk upgrades
- `a2831c3` - Upgrade Timmy account setup desk
- Pending - Add Timmy public Linux download site

## Current Boundary

Timmy is structured for live brokerage operation, but real live trading still
depends on the local machine having verified broker credentials, a selected
account, current buying power, a fresh account check, market-data freshness,
valid risk limits, and live switches intentionally enabled. The repository and
public mirror intentionally do not contain those live credentials or runtime
state.

## Public Website Boundary

The public website intentionally serves only static site files, setup examples,
and the Linux `.deb` download package. It does not publish `.env`, profile,
broker token, account, journal, audit-key, crash-log, cache, build, or local
runtime files. The contact form opens the user's mail client and does not
collect broker credentials on the website.
