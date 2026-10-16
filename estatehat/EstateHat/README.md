# EstateHat

EstateHat now ships its web app from a single Next.js route surface.

## Canonical Routes

- `/` landing
- `/signin` sign in and registration
- `/home` authenticated app
- `/about`, `/help`, `/faq`, `/invest`, `/press`, `/terms`, `/privacy`, `/accessibility`, `/dmca` public information pages

Compatibility redirects remain for older links, but the old static HTML entry points and Vite web build are retired.

## Commands

- `npm run dev`
- `npm run build`
- `npm run deploy:hosting`

## Product inventory and operations

- [Implemented feature inventory](docs/IMPLEMENTED_FEATURE_INVENTORY_2026-10-16.md) maps 200 source-backed user and operator capabilities by product area.
- [Modernization handoff](docs/MODERNIZATION_HANDOFF_2026-10-16.md) records this update, validation evidence, deployment scope, and known limits.
- [Operations guide](docs/OPERATIONS.md) covers builds, deployment, and desktop packaging.

## Output

- Web export: `out/`
- Capacitor webDir: `out`
- Electron packaged web assets: `out`
