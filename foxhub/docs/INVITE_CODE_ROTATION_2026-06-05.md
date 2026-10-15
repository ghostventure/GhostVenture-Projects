# Invite Code Rotation - 2026-06-05

## Summary

FoxHub invite codes now rotate one-at-a-time per invite creator.

## Behavior

- When a member or staff user generates a new invite code, older active invite codes from that creator expire.
- Older sponsor-pending invite codes from that creator also expire.
- Redeemed, denied, and already expired invite records are left as historical records.
- The new invite remains active with the normal seven-day expiration window.
- Expired previous codes are marked with:
  - `status: "expired"`
  - `expiredAt`
  - `expirationReason: "Superseded by a newer invite code"`

## Enforcement

- Local/demo repository expires older invite records when `createInviteRecord` runs.
- Firebase repository expires older invite documents for the current authenticated creator in the same write batch that creates the new invite.
- The app store mirrors the expiration immediately so the visible invite list updates without waiting for a reload.

## Verification

Run:

- `npm test`
- `npm run smoke:public`
- `npm run build`

Regression coverage:

- Creating a second local invite expires the first.
- The second invite remains active.
- The expired first invite cannot be used for signup.
