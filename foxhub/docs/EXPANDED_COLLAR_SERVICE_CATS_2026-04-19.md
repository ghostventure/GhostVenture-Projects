# Expanded Collar Service Categories - 2026-04-19

## Summary

FoxHub now includes additional collar-color service directories beyond blue, white, and black.

Added:

- Yellow-collar: creative, media, design, production, content, style, and experience work.
- Green-collar: environmental, sustainability, clean energy, recycling, conservation, and resilience work.
- Pink-collar: care, service, education, hospitality, wellness, retail, admin, and household support.
- Brown-collar: civic field, public works, route, sanitation, grounds, institutional, inspection, and seasonal operations.
- Purple-collar: hybrid hands-on technical work across IT, automation, smart buildings, AV, logistics systems, data operations, and cyber-physical support.

Each added collar section includes:

- 10 plain-language categories
- 140 subcategories
- 40 lightweight workflow components
- user-side Services Catalog panel
- merchant-side Shops panel

## Totals

| Collar | Categories | Subcategories | Components |
| --- | ---: | ---: | ---: |
| Blue | 10 | 147 | 40 |
| White | 10 | 140 | 40 |
| Black | 10 | 140 | 40 |
| Yellow | 10 | 140 | 40 |
| Green | 10 | 140 | 40 |
| Pink | 10 | 140 | 40 |
| Brown | 10 | 140 | 40 |
| Purple | 10 | 140 | 40 |

## Files

- `src/data.js`
  - Added `yellowCollarServiceCategories`.
  - Added `greenCollarServiceCategories`.
  - Added `pinkCollarServiceCategories`.
  - Added `brownCollarServiceCategories`.
  - Added `purpleCollarServiceCategories`.
- `src/FoxHubShell.jsx`
  - Imported all added collar category arrays.
  - Added user-side active category state for each added collar section.
  - Added merchant-side active category state for each added collar section.
  - Added user Services Catalog panels for yellow, green, pink, brown, and purple collar categories.
  - Added merchant Shops panels for yellow, green, pink, brown, and purple collar categories.

## Verification

Ran:

- collar count check: pass
- `npm test`: pass
- `npm run build`: pass
- `npm run sync:android`: pass
- `npm run sync:ios`: pass
- `npx firebase-tools deploy --only hosting --project foxhub-superapp`: pass

Live Hosting smoke:

- `https://foxhub-superapp.web.app` references `assets/index-BHoi_U2D.js`.
- Live shell bundle contains:
  - `Yellow-collar cats and sub-cats`
  - `Green-collar cats and sub-cats`
  - `Pink-collar cats and sub-cats`
  - `Brown-collar cats and sub-cats`
  - `Purple-collar cats and sub-cats`
  - `Merchant purple-collar cats`
- Live index bundle contains representative category data:
  - `Design And Branding`
  - `Renewable Energy`
  - `Child And Family Care`
  - `Public Works`
  - `Field IT`
