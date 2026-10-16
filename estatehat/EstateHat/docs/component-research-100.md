# EstateHat Component Research

Date: 2026-04-13

Scope: 100 useful EstateHat components that are not currently installed as a component library and are not already represented by the main hand-built app components in `src/estatehat-platform-alpha.jsx`, `src/AuthScreen.jsx`, or `src/MarketingLanding.jsx`.

## Current Install Check

EstateHat is a Vite React/Firebase app. Installed runtime UI dependencies are currently limited to React, React DOM, Firebase, and Capacitor. There is no installed component-system dependency such as shadcn/ui, Radix UI, React Aria Components, Material UI, Mantine, Chakra, Ant Design, Recharts, Mapbox, Leaflet, or React Hook Form.

Already present or partially present in-app: marketing landing, auth screen, cards, badges, tabs, progress bar, skeleton, file upload zone, validation checklist, address verifier, property card, browse/detail/watchlist/profile/listing/transaction/admin/messages/legal/calculator/matching/help/FAQ views, command palette, assistant, and accordion section.

## Research Sources Used

- shadcn/ui component catalog and registry docs: https://ui.shadcn.com/docs/directory
- React Aria Components accessibility and interaction catalog: https://react-aria.adobe.com/
- Material UI component catalog: https://mui.com/material-ui/all-components/
- Radix UI primitives overview: https://www.radix-ui.com/primitives

These sources informed the component types, accessibility expectations, and install strategy. EstateHat should prefer local, owned React components first, then adopt headless primitives only where keyboard/focus behavior is complex.

## Recommended Missing Components

| # | Component | Why EstateHat Needs It | Suggested Basis |
|---:|---|---|---|
| 1 | App Shell Layout | Stable desktop/mobile frame for navigation, alerts, and account state. | Local component |
| 2 | Responsive Sidebar | Role-aware navigation without repeating layout code across views. | shadcn Sidebar or local |
| 3 | Mobile Bottom Navigation | Easier buyer/seller workflows on Capacitor builds. | Local component |
| 4 | Top App Bar | Central place for search, notifications, profile, and quick actions. | Local component |
| 5 | Breadcrumb Trail | Clear path inside property, deal, legal, and admin pages. | shadcn Breadcrumb |
| 6 | Page Header | Consistent title, summary, action buttons, and status chips. | Local component |
| 7 | Action Toolbar | Reusable filter/sort/export/action strip for dense workflows. | React Aria Toolbar |
| 8 | Split Pane Layout | Side-by-side listing map, documents, and transaction review. | shadcn Resizable |
| 9 | Sticky Action Footer | Mobile-safe primary actions for offers, uploads, and checkout. | Local component |
| 10 | Empty State | Consistent no-results/no-documents/no-messages fallback. | shadcn Empty |
| 11 | Toast Notifications | Non-blocking success/error updates for saves, offers, uploads. | Sonner/shadcn |
| 12 | Alert Banner | Persistent compliance, payment, or verification warnings. | shadcn Alert |
| 13 | Confirm Dialog | Safer cancellation, deletion, void-sale, and admin actions. | Radix Alert Dialog |
| 14 | Drawer Panel | Mobile filters, deal details, and quick profile edits. | shadcn Drawer |
| 15 | Sheet Panel | Desktop side panels for messages, document preview, and audit trails. | shadcn Sheet |
| 16 | Modal Dialog | Reusable focused flows for invites, offers, notes, and approvals. | React Aria Modal/Dialog |
| 17 | Popover Menu | Inline property actions, role actions, and field hints. | Radix Popover |
| 18 | Tooltip | Explain legal, fee, and compliance terminology. | Radix Tooltip |
| 19 | Hover Card | Quick listing/user/deal previews from links. | shadcn Hover Card |
| 20 | Context Menu | Document/listing row actions on desktop. | Radix Context Menu |
| 21 | Dropdown Menu | Compact account, listing, and admin actions. | Radix Dropdown Menu |
| 22 | Command Search Results | Rich command palette rows with icons, metadata, shortcuts. | Existing Command upgrade |
| 23 | Keyboard Shortcut Badge | Visible shortcuts for power users and desktop builds. | shadcn Kbd |
| 24 | Notification Center | Persistent event inbox for offers, messages, tasks, and compliance. | Local component |
| 25 | Notification Preferences | Granular email/push/in-app settings per role. | Local component |
| 26 | Universal Search Box | One search over listings, deals, contacts, docs, and help. | React Aria SearchField |
| 27 | Search Suggestions | Predictive address, listing, saved-search, and help suggestions. | ComboBox/ListBox |
| 28 | Filter Builder | Saved filters for price, location, trust, deal status, and roles. | Local component |
| 29 | Sort Selector | Reusable sort control for listings, docs, messages, and admin tables. | React Aria Select |
| 30 | Active Filter Chips | Remove/edit applied search filters without re-opening filters. | shadcn Badge/Chip pattern |
| 31 | Saved Search Manager | Rename, apply, delete, and notify on saved searches. | Local component |
| 32 | Recent Search List | Fast return path for repeated buyer workflows. | Local component |
| 33 | Pagination Control | Admin, documents, messages, and audit table navigation. | shadcn Pagination |
| 34 | Data Table Shell | Sortable/selectable tables for admin, users, deals, and docs. | shadcn Data Table |
| 35 | Column Visibility Menu | Let admins tailor dense tables. | Table + Dropdown |
| 36 | Bulk Action Bar | Multi-select approvals, exports, archive, and assignment. | Local component |
| 37 | Virtualized List | Scalable messages, search results, notifications, and audit logs. | React Aria Virtualizer |
| 38 | Property Comparison Table | Compare price, fees, trust, taxes, and key facts across listings. | Local component |
| 39 | Property Media Carousel | Listing image/gallery navigation with thumbnails. | shadcn Carousel |
| 40 | Property Photo Lightbox | Full-screen photo review for buyers and inspectors. | Dialog + Carousel |
| 41 | Property Facts Grid | Reusable beds/baths/sqft/year/tax/HOA stat layout. | Local component |
| 42 | Property Price History | Timeline/table of listing price changes. | Local + chart library later |
| 43 | Property Value Estimate Card | Estimated range, assumptions, confidence, and comps link. | Local component |
| 44 | Comparable Sales Strip | Nearby sold comps summarized in listing detail. | Local component |
| 45 | Neighborhood Snapshot | Schools, commute, walkability, taxes, and risk summaries. | Local component |
| 46 | Map View Toggle | Switch list/grid/map modes without losing filters. | Local component |
| 47 | Map Pin Cluster | Map-friendly clustered property markers. | Mapbox/Leaflet later |
| 48 | Address Autocomplete | Better listing creation and search accuracy. | Places API wrapper |
| 49 | Location Permission Prompt | Mobile-friendly location opt-in for nearby listings. | Local component |
| 50 | Saved Listing Folder | Organize saved properties by trip, client, or deal intent. | Local component |
| 51 | Tour Scheduler | Book showings, inspections, and walkthroughs. | Calendar + form |
| 52 | Availability Calendar | Seller/agent showing windows and buyer preferred times. | React Aria Calendar |
| 53 | Date Range Picker | Escrow windows, occupancy, closing timelines, reports. | React Aria DateRangePicker |
| 54 | Time Slot Picker | Showing, call, signing, and inspection appointments. | React Aria TimeField |
| 55 | Offer Composer | Guided offer terms, contingencies, deposit, expiration. | Local component |
| 56 | Offer Summary Card | Plain-language offer review before send/sign. | Local component |
| 57 | Counteroffer Timeline | Threaded offer/counteroffer status history. | Local component |
| 58 | Contingency Checklist | Financing, inspection, appraisal, title, HOA, sale-of-home. | Local component |
| 59 | Earnest Money Tracker | Deposit amount, due date, escrow holder, receipt status. | Local component |
| 60 | Closing Cost Estimator | Buyer/seller closing cost assumptions and totals. | Calculator upgrade |
| 61 | Mortgage Payment Widget | Principal, interest, taxes, insurance, HOA, PMI. | Local component |
| 62 | Affordability Calculator | Income/debt/down-payment based buying range. | Local component |
| 63 | Net Proceeds Calculator | Seller-side proceeds after mortgage, fees, taxes, credits. | Local component |
| 64 | Rent vs Buy Calculator | Useful content and lead capture for buyers. | Local component |
| 65 | Fee Explainer Drawer | EstateHat fee, escrow, title, and service fee breakdown. | Drawer |
| 66 | Transaction Stepper | Visual deal flow from offer to close. | shadcn-style Stepper/local |
| 67 | Deal Milestone Timeline | Due dates, owners, status, overdue markers. | Local component |
| 68 | Task Board | Kanban-style transaction task ownership. | React Aria drag/drop |
| 69 | Task Detail Panel | Assignment, due date, documents, comments, status. | Sheet |
| 70 | Role Responsibility Matrix | Buyer/seller/agent/lender/attorney obligations per deal. | Local component |
| 71 | Collaborator Invite Modal | Add professionals to a deal with role-scoped permissions. | Dialog + form |
| 72 | Permission Matrix Editor | Admin/deal owner control over view/edit/sign/export access. | Table + switches |
| 73 | Document Vault | Central deal/user/listing document hub. | Local component |
| 74 | Document Category Tabs | Listing docs, disclosures, contracts, ID, payment, legal. | Tabs upgrade |
| 75 | Document Preview Pane | PDF/image preview next to metadata and actions. | Local component |
| 76 | Document Version History | Track uploads, replacements, approvals, and signatures. | Local component |
| 77 | Document Checklist | Required, optional, missing, expired, and approved docs. | Local component |
| 78 | Drag Drop Upload Queue | Multi-file progress, retry, and validation. | React Aria DropZone |
| 79 | File Type Validator | Prevent unsupported or risky document uploads. | Local component |
| 80 | E-Signature Status Card | Signers, timestamps, provider status, next action. | Local component |
| 81 | Signature Request Modal | Request signatures from deal participants. | Dialog |
| 82 | Disclosure Packet Builder | Bundle required seller disclosures by jurisdiction. | Local component |
| 83 | Compliance Checklist Panel | Role/jurisdiction-specific compliance requirements. | Existing checklist upgrade |
| 84 | Jurisdiction Rule Explorer | Explain local requirements behind compliance flags. | Accordion + search |
| 85 | License Verification Card | Agent/inspector/lender/attorney credential state. | Local component |
| 86 | Identity Verification Status | ID, selfie, SSN, address, entity, background checks. | Local component |
| 87 | Trust Score Breakdown | Explain what drives trusted profile/listing status. | Local component |
| 88 | Security Center Panel | Devices, sessions, MFA, recent events, recovery options. | Local component |
| 89 | MFA Setup Wizard | SMS/authenticator/recovery codes enrollment. | Dialog + steps |
| 90 | Billing Method Manager | Verified payment methods, billing address, default method. | Local component |
| 91 | Payout Account Manager | Seller/professional payout readiness and bank status. | Local component |
| 92 | Invoice List | Fees, subscriptions, service charges, receipts. | Data table |
| 93 | Receipt Detail Drawer | Itemized payment and tax details. | Drawer |
| 94 | Refund/Credit Tracker | Admin and user visibility into payment reversals. | Local component |
| 95 | Message Composer | Richer attachments, templates, deal context, and send states. | Local component |
| 96 | Conversation List | Searchable, unread-aware messaging inbox. | Virtualized list |
| 97 | Participant Presence | Online, typing, last seen, role badges. | Local component |
| 98 | Template Reply Picker | Reusable support, legal, and transaction replies. | Combobox |
| 99 | Help Article Viewer | Structured help content with related actions. | Local component |
| 100 | Feedback / Bug Report Modal | In-app issue reporting with route, user role, screenshot hook. | Dialog + form |

## Implementation Priority

1. Foundation first: App Shell Layout, Responsive Sidebar, Top App Bar, Toast Notifications, Confirm Dialog, Drawer/Sheet, Data Table Shell, and Universal Search Box.
2. Property growth: Property Media Carousel, Comparison Table, Address Autocomplete, Tour Scheduler, Offer Composer, and Mortgage/Closing calculators.
3. Transaction depth: Transaction Stepper, Deal Milestone Timeline, Task Board, Document Vault, Document Preview Pane, Signature Status, and Compliance Checklist Panel.
4. Trust and payments: Identity Verification Status, Trust Score Breakdown, Security Center, Billing Method Manager, Payout Account Manager, and Invoice List.
5. Support and operations: Notification Center, Permission Matrix Editor, Template Reply Picker, Help Article Viewer, and Feedback Modal.

## Install Recommendation

Do not install 100 external components at once. The current app is a compact custom React codebase, so the safer path is:

1. Extract existing primitives from `estatehat-platform-alpha.jsx` into a local component folder.
2. Add a small headless accessibility layer only for hard interactions: dialog, select/combobox, tooltip, menu, date picker, table, and drag/drop.
3. If adopting a catalog, use shadcn/ui incrementally because it copies component source into the project instead of hiding behavior behind a vendor dependency.
4. Use React Aria Components for advanced accessibility-heavy pieces such as date/time inputs, comboboxes, tables, virtualized collections, and drag/drop.
5. Avoid Material UI as a full-system install unless EstateHat intentionally wants a Material Design visual direction.
