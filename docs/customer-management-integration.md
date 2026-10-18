# Customer management workspace integration

The isolated panel is `src/features/CustomerManagementWorkspace.jsx`. It is designed to mount inside the existing `activeSection === 'customers'` branch in `src/App.jsx`, after the current `<CustomersSection ... />` block:

```jsx
<CustomerManagementWorkspace
  backendState={backendState}
  secureView={secureView}
/>
```

Add `import CustomerManagementWorkspace from './features/CustomerManagementWorkspace'` with the other feature imports. No app navigation change is needed because the existing Customers entry is the natural mount point. The panel uses `window.overheadBackend` through `useFeatureRecords('customers')`, and reads loaded local customer, task, invoice, and staff-profile records from `backendState`.

The feedback inbox accepts validated JSON exported from the website `product_feedback` collection (up to 50 records per import); there is no automatic cloud sync. The panel has no customer email sender. Its follow-up action creates only an internal local task and checks the customer's channel preference first, blocking a “Do not contact” record. Ownership rules are saved and apply only after a staff member chooses the explicit action; existing owners are preserved unless the override checkbox is selected.

The panel does not send messages, automatically remind customers, or merge duplicate records. Contact interaction history and @mentions remain outside this assigned implementation.