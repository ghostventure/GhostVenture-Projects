# Timmy Trader risk and trade-planning UX wave

Branch: `codex/timmy-ux-planning-20261025`
Base: `b4fb368704bb28e621fd1075a47f9e8d4077d383`

This wave adds a review-only Risk & Trade Planning Lab reachable from the
Order Plan panel. It works with the active plan queue, loaded candle history,
configuration, and the local paper ledger.

## Ten implemented capabilities

1. **Risk-budget waterfall:** compares the configured per-trade risk allowance
   multiplied by the current plan limit with active queue stop risk and a
   hypothetical selected-plan edit.
2. **Portfolio exposure map:** shows marked local paper exposure by symbol and
   configured asset class. Sector remains explicitly unavailable when sector
   metadata is absent; broker positions are not implied.
3. **Correlation clusters:** calculates Pearson correlation on aligned daily
   log returns from loaded bars and groups pairs at absolute correlation of at
   least 0.70. Sparse history is reported as unavailable.
4. **Order-plan comparison board:** lays out side, quantity, entry, notional,
   stop risk, and reward/risk for each currently generated plan.
5. **Plan-change review:** accepts local hypothetical quantity/entry/stop/target
   fields and displays a diff against the active plan. Changed values must be
   acknowledged in the review panel; no active plan is modified.
6. **Multi-scenario comparison:** compares 0.5×, 1.0×, and 1.5× quantities for
   the complete active plan list, with added notional, stop risk, target gain,
   and estimated marked exposure after.
7. **Stepwise pre-submit checklist:** presents plan selection, data freshness,
   change review, exact broker preview, account-check state, and current lane
   guards. It is informational and does not replace existing submission gates.
8. **Share/fraction sizing explorer:** applies configured equity/crypto quantity
   precision and configured maximum quantity/notional. It calls out unsupported
   buying-power and derivatives multiplier details.
9. **Stop/target chart:** charts the selected plan's entry, stop, target, dollar
   risk/reward, and ratio. Hypothetical edits change this chart only.
10. **Portfolio impact preview:** estimates additional notional and stop risk,
    marked paper exposure after, and the selected symbol's resulting share of
    the local total.

## Existing capabilities deepened

The GUI already had a single-position sizing preview and summary text for paper
portfolio exposure. This wave extends those into cross-plan scenario
comparison, a symbol/asset-class map, a risk waterfall, and a portfolio impact
view. The existing market chart's stop/target context is complemented by a
selected-plan payoff chart.

## Limits

- All proposed edits and scenarios are local review values; they do not alter
  strategy output, risk calculations, plan state, broker state, or execution.
- Portfolio impact uses only local paper positions with available loaded price
  marks. It excludes broker holdings and calls out incomplete marks.
- No sector classification is currently present in the local loaded position
  data, so the sector row reports unavailable rather than estimating a sector.
- Correlation uses at most 30 symbols and the latest common loaded daily
  sessions. It is descriptive context, not a guarantee of diversification.
- Derivative contract multipliers, margin, and broker buying-power rules are
  not represented in the sizing preview.
