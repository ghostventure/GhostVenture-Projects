# OverHead feature integration notes

This integration combines three additions:

- **Customizable dashboard:** choose which workspace panels appear; preferences persist locally, and **Show all panels** restores the default layout. Hiding a panel does not remove its records.
- **Activity report:** filter invoices, quotes, appointments, or tasks to the last 30 days, last 90 days, or all available records. Export matching rows to a local CSV with record ID, title, status, date, and amount.
- **Reduced motion preference:** set the option in Settings. Until explicitly changed, OverHead follows the operating system preference; an explicit app choice overrides it and persists locally.

See [`dashboard-customization.md`](dashboard-customization.md) for user steps, filtering behavior, exported fields, and local data handling.

Feature commits included in this integration: `74371c5` (dashboard panels), `179b6e2` (activity report and CSV), and `56b5902` (reduced motion).
