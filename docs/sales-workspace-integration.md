# Sales workspace integration note

The new panel is `src/features/SalesWorkspace.jsx`. It uses the existing encrypted `sales` and `customers` feature-record collections and accepts these props:

```jsx
<SalesWorkspace
  backendState={backendState}
  refreshBackend={refreshBackend}
  setOperationNotice={setOperationNotice}
/>
```

To give it a distinct navigation entry, import it beside `GrowthWorkspace` in `src/App.jsx`, add a `sales` entry immediately after `growth` in `navSections`, include `sales` in the team-section allowlist only for roles that can access the `sales` feature collection (`Owner`, `Front Desk`, `Bookkeeper`), and mount it beside the Growth conditional in `.workspace-content`:

```jsx
{activeSection === 'sales' && <SalesWorkspace backendState={backendState} refreshBackend={refreshBackend} setOperationNotice={setOperationNotice} />}
```

The component treats legacy `sales` records without a `kind` and new records with `kind: 'opportunity'` as opportunities. It tags supporting records (`sales_activity`, `territory_rule`, `lead_assignment_rule`, `lead_conversion`, `sales_settings`, and `sales_playbook`) so they can share the encrypted collection. The Growth pipeline and dashboard should filter to `!record.kind || record.kind === 'opportunity'`; the parallel Growth owner is applying that filter.

The conversion action creates a customer only after the user submits a reviewed form. It first links a current customer with a matching business name or email when one exists. Rule application is also explicitly user-triggered. No external mail, calendar, or payment provider is called.
