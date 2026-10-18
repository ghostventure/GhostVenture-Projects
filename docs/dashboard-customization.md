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

## Activity report and CSV export

Open **Reports** in the left navigation and choose a record type (**Invoices**, **Quotes**, **Appointments**, or **Tasks**) and date range (**Last 30 days**, **Last 90 days**, or **All available records**). The report summary and CSV export use the matching records. For date filtering, OverHead uses the first available value in this order: created, updated, scheduled, then due date. Records without a parseable date are excluded from the 30- and 90-day ranges; the all-records option includes them.

Select **Export CSV** to save a spreadsheet-ready file on the device. Each exported row has these columns: **Record ID**, **Title**, **Status**, **Date**, and **Amount**. The CSV includes only the selected record type and date range; it does not include the report's summary cards or status counts. The report reads the current OverHead workspace, and export creates a local file. Store or share that file with the same care as the customer and business data it may contain.

## Reduced motion

Open **Settings** and find **Reduce motion** under Preferences. Turn it on to limit interface animation and scrolling effects. If you have not set an OverHead preference, the app follows the operating system's reduced-motion setting. Once you change the checkbox, that explicit choice takes precedence over the OS setting and is saved locally on the device. Turn it off to use the normal motion behavior even when the OS requests reduced motion.
