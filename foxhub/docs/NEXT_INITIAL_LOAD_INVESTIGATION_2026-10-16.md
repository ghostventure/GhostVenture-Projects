# FoxHub Next.js Initial Load Investigation — October 16, 2026

## Live observations

- The live homepage, `/api/health`, and 10 sampled Next static assets returned HTTP 200.
- Repeated homepage time-to-first-byte (TTFB) samples ranged from 0.10 to 0.92 seconds. `/api/health` samples ranged from 0.18 to 0.71 seconds. Results varied across requests.
- The sampled initial JavaScript chunks totaled roughly 0.9 MB.

## Limits and follow-up candidate

- These checks did not measure full browser rendering, script execution, or hydration time.
- Cold starts were not isolated, so the samples do not establish a cold-start delay.
- The `nextApp` function has no configured minimum instance, and its first request initializes Next through `app.prepare()`. This is a concrete cold-start candidate to investigate, not a confirmed cause of the observed timings.
- No performance fix or configuration change was applied during this investigation.
