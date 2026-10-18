# Dashboard customization

OverHead lets each desktop user choose which panels appear on the Team Dashboard. The preference is stored in that app's local browser storage, so it remains in place when OverHead is reopened on the same device.

## Change the visible panels

1. Open **Team Dashboard** from the left navigation.
2. Select **Customize dashboard**.
3. Check or clear panels to match the information you want on the page.
4. Select **Done customizing** to close the panel picker.

The available panels are workspace status cards, workspace profile, operating principles, current work queue, office readiness checklist, appointment/quote/invoice creation, operational records, and review badges. **Show all panels** restores the default dashboard. At least one panel must remain selected.

Panel visibility only changes the dashboard layout. It does not delete tasks, customer data, appointments, quotes, invoices, or compliance records. Hidden panels remain available in other workspace sections where applicable.

## Developer notes

The panel catalog and renderer are in `src/App.jsx` in `dashboardWidgets` and `OverviewSection`. The selected panel IDs are saved as a JSON array under `overhead.dashboard.widgets.v1` in `window.localStorage`. Unknown saved IDs are discarded when preferences load, which lets the catalog evolve without breaking older settings. The dashboard defaults to every known panel when no usable preference exists. Styling for the picker is in `src/App.css` under `.dashboard-widget-picker`.
