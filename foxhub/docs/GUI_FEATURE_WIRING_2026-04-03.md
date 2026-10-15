# FoxHub GUI Feature Wiring And Shell Reorganization

Date: 2026-04-03

## Summary

This note records the pass that connected the remaining backend-backed FoxHub features into the visible shell and reorganized them into clearer tab ownership.

The goal was not a visual redesign.

The goal was:

- expose the missing mechanics in the GUI
- keep the shell simple
- put each feature family in the tab where it belongs

## What moved where

### Chats

`Chats` now includes:

- `Read state`
- existing conversation, call session, and call history surfaces

This keeps message-state mechanics with the chat layer instead of hiding them inside backend-only persistence.

### Network

`Network` now includes:

- `Member records`
- existing contact trust, profile reputation, rating review, endorsements, jobs, media, and community surfaces

This keeps customer and member records with people, trust, and relationship systems instead of scattering them into operator-only panels.

### Services

`Services` now includes:

- `Access and alerts`
- `Operator access`
- `Conversation continuity`
- existing operator queue, notification center, document vault, operator actions, audit trail, device sessions, routes, manifests, runtime sessions, FAQ, and mini-program surfaces

This keeps account controls, operator records, and service-level continuity inside the same operational tab.

## Functional changes

### Newly surfaced in the GUI

The shell now visibly exposes:

- `threadReadState`
- `userRecords`
- `notificationSubscriptions`
- `operatorAccessRecords`

### New Services action

`Services` now includes a direct `Enable browser alerts` action tied to the browser notification registration path instead of leaving that control only in the profile modal.

## Implementation files

- `src/FoxHubShell.jsx`
- `src/App.jsx`

## Verification performed

Verified with:

1. `npm run build`
2. headless Chromium DOM check against local preview
3. `npm run deploy:hosting`

## Deployment state

This pass was deployed to:

- `https://foxhub-superapp.web.app`
