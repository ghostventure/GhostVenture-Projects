# Authentication workflow

This is the current sign-up, sign-in, and recovery flow for `overhead-office`. It applies to the website and the OverHead Desktop app.

## What users do

### Create a workspace

1. Open `https://overhead-office.web.app/sign-in/` and choose **Create workspace**.
2. Enter the administrator name, business name, valid email address, a password of at least 12 characters, and acknowledge the terms/privacy notice.
3. OverHead creates the Firebase account plus the matching `workspaces/{uid}` and `profiles/{uid}` records together.
4. Open the email-verification link, return to OverHead, and select **I verified my email**.

The new user is the workspace `Administrator`. A failed workspace-profile write removes the just-created Firebase account so the user is not stranded with an unusable sign-in.

### Join a workspace

1. The administrator creates an invite for the exact email address and gives the invitee the workspace ID.
2. The invitee chooses **Join workspace**, enters that ID, the invited email, and a new password of at least 12 characters.
3. OverHead validates the invitation, creates the profile with the invited role, consumes the invite, and sends an email-verification link.
4. The invitee verifies the email before opening workspace data.

An invalid or expired invite does not leave a usable Firebase account behind.

### Sign in and recover access

- Website users can choose **Keep me signed in on this private device**. Clear it on a shared device to end the browser session when the browser closes.
- The website and Desktop use the same email and password. Desktop checks Firebase's current email-verification state before opening a session.
- **Forgot your password?** sends a Firebase password-reset link. The acknowledgement is intentionally generic so the page does not reveal whether an email address is registered.
- If the verification link is delayed, use **Send a new link**. Check spam/junk and use the newest message.

## Access boundary

Firebase Authentication is the identity source. Firestore holds the workspace profile and role. Unverified users may only complete the minimum profile/invitation setup needed to verify their email; protected workspace data and actions require an authenticated, verified email address.

Roles remain `Administrator`, `Manager`, and `Staff`. The desktop maps the shared role to its local operating role only after successful verified sign-in.

## Operator checklist

Before treating authentication as ready after a configuration or release change:

1. In Firebase Console, confirm **Authentication > Sign-in method > Email/Password** is enabled for `overhead-office`.
2. Confirm the authorized domains include the Hosting domain used by the verification and password-reset links.
3. Review Firebase's password policy. The OverHead UI requires at least 12 characters; project policy may require additional character types.
4. Confirm the Firebase email templates have an accurate product name and support address.
5. Test these paths with disposable accounts: workspace creation, email verification, private-device and session-only sign-in, administrator invite, password reset, invalid invite, and disabled/suspended profile.
6. Recheck the website route and rules after deployment:

   ```powershell
   cd C:\Users\solid\Documents\Codex\OverHead\website-next
   npm run build

   cd ..
   npx firebase-tools deploy --config firebase.overhead.json --only hosting,firestore:rules --project overhead-office
   Invoke-WebRequest https://overhead-office.web.app/sign-in/ -UseBasicParsing
   ```

Do not put Firebase passwords, reset links, verification links, or user tokens in support tickets, source control, or chat.

## Current verification record

On 2026-08-23, the website build, Electron syntax/build checks, Firestore rule compilation, Hosting deployment, and the live `/sign-in/` route all succeeded. The Email/Password provider returned Firebase's normal invalid-credentials response to a non-account probe, which confirms that the provider was enabled at that time. A full mailbox click-through remains a manual acceptance test because it requires a real disposable inbox.
