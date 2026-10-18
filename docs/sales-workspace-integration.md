# Sales workspace integration note

The new panel is `src/features/SalesWorkspace.jsx`. It uses the existing encrypted `sales` and `customers` feature-record collections and accepts these props:

```jsx
<SalesWorkspace
  backendState={backendState}
  refreshBackend={refreshBackend}
  setOperationNotice={setOperationNotice}
/>
```

The panel is mounted as the `Sales Studio` navigation section in `src/App.jsx`. It is visible only to roles allowed to access the `sales` feature collection (`Owner`, `Front Desk`, `Bookkeeper`):

```jsx
{activeSection === 'sales-growth' && <SalesWorkspace backendState={backendState} refreshBackend={refreshBackend} setOperationNotice={setOperationNotice} />}
```

The component treats legacy `sales` records without a `kind` and new records with `kind: 'opportunity'` as opportunities. It tags supporting records (`sales_activity`, `territory_rule`, `lead_assignment_rule`, `lead_conversion`, `sales_settings`, and `sales_playbook`) so they can share the encrypted collection. Growth's sales metrics filter to legacy records or `kind: 'opportunity'` so supporting activity rows do not inflate pipeline totals.

The conversion action creates a customer only after the user submits a reviewed form. It first links a current customer with a matching business name or email when one exists. Rule application is also explicitly user-triggered. No external mail, calendar, or payment provider is called.
