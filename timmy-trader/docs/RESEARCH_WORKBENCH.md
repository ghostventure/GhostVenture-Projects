# Research Workbench capability wave

Branch: `codex/timmy-ux-research-20261025` · Base: `b4fb368`

This local native-GUI wave adds ten research/data capabilities. Research views
are descriptive and read-only with respect to trading; none of these actions
submits, previews, or changes an order.

1. **Scan Coverage Explorer** — keeps the last 60 local scan records and opens
   per-symbol returned/missing details. Older saved data is not counted as a
   provider result when a refresh fails.
2. **Multi-symbol chart board** — plots 2–6 symbols on normalized local close
   series over a shared 20-bar window.
3. **Provider evidence comparison** — compares saved coverage runs by configured
   provider; it does not trigger provider requests. Runs may use different
   dates/universes and are not a controlled quality benchmark.
4. **CSV import preview** — maps seven required fields, validates the entire
   bounded file, shows row-level issues and sample values, then atomically
   merges by symbol/timestamp only after explicit confirmation. Offset timestamps
   normalize to UTC; timezone-naive values are interpreted as UTC.
5. **Market session planner** — shows a 35-day Eastern-time horizon. The
   exchange holiday schedule in source is maintained for 2026 only; other years
   are marked for verification.
6. **Data issue inbox** — combines safe structured provider failures, missing
   symbols, staleness, estimated gaps, duplicate timestamps, and invalid OHLC
   detail with a next step. Provider response bodies and raw URLs are omitted.
7. **Group/list comparison** — compares named personal groups, pins, and the
   active list using loaded local candle returns. Personal groups remain
   organizational and do not change trading scope.
8. **Redacted research snapshot** — exports an explicit field whitelist for
   current scan symbols and coverage issues. It excludes notes, settings,
   profile, broker, orders, account details, and credentials.
9. **Named scanner table layouts** — stores column order, visibility, and sort
   state under the private runtime home. It is distinct from the existing named
   filter presets.
10. **Unified symbol research drawer** — joins a local chart, quality summary,
    current scan context, and the existing private local symbol note.

## Data and scope limits

- Coverage history is local, bounded to 60 records, and describes the symbols
  supplied to the selected scan path. The app uses delayed daily candles, not a
  streaming quote feed.
- A provider failure leaves old cached data available for charts, but that old
  data is not marked as newly returned coverage.
- Staleness and gap estimates use candle intervals and do not fully model
  exchange holidays or each instrument's trading calendar.
- CSV import is limited to 20 MiB and 250,000 rows, and an invalid row blocks
  committing the entire file.
- Provider comparison and group performance can be misleading when their saved
  date windows or symbol sets differ; labels disclose that limitation.
- Research history and annotations remain in the local runtime home. The UX
  code is part of the local 0.1.8 package; no research data is synced or shared
  automatically, and the public download page has not been updated.

## Source map

- `trend_trader/research_workbench.py` — bounded coverage history, CSV preview
  and merge, local group/provider comparison, redacted snapshot schema.
- `trend_trader/market_data.py` — safe per-symbol fetch failure categories.
- `trend_trader/market_calendar.py` — date-range session planning.
- `trend_trader/scanner_presets.py` — named scanner presentation presets.
- `trend_trader/native_gui.py` — Research workspace and ten user-facing tools.
