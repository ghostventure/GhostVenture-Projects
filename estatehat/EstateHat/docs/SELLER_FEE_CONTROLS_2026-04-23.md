## Seller Fee Controls

Date: 2026-04-23

### Scope

Added seller-controlled fee lines to the listing workflow so sellers can declare their own fees by fixed amount or percentage without giving buyers edit control.

### Included changes

- Added `Seller-Carried Fees` controls to `List Property`
- Sellers can add multiple fee lines
- Each seller fee line supports:
  - label
  - `amount`
  - `percentage`
- Listing review now shows:
  - the updated fee breakdown
  - seller fee total
  - explicit seller fee schedule
- Buyer-side fee flow remains separate; these seller fee lines are seller-configured only

### Files changed

- `src/estatehat-platform-alpha.jsx`

### Verification

- `npm run build` passed
- `npm run deploy:hosting` passed

### Production

- `https://estatehat.web.app`
