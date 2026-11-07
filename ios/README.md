# OverHead iOS prototype

This native SwiftUI app is a quick-action companion for the OverHead desktop product. It is intentionally limited to short mobile workflows:

- Review open, completed, and all workspace tasks; mark work complete with one tap.
- Add tasks with a type, optional customer, and due date.
- Search customers by name, email, or phone; create records and start an email or phone call.
- Request an approval and let workspace managers approve or decline it from mobile or web.
- Log quick customer updates and view the shared manager activity feed.

The app signs in with an existing OverHead team account and reads workspace tasks, customers, approvals, and activity from the same Firestore collections as the OverHead web dashboard. Changes stream live while the app is open. Mobile-created tasks, customers, approval requests, decisions, and quick updates use the existing workspace security rules.

Cylinder workspaces are identified by `deployment_mode: "cylinder"` on the shared workspace document. New Cylinder registrations set this marker, and an existing workspace is marked when its Administrator signs in through Cylinder. The iOS workspace header then identifies the organization as a Cylinder server workspace. Older Cylinder workspaces remain labeled as standard until that Cylinder sign-in refreshes the marker.

Open `OverHeadMobile.xcodeproj` in Xcode and run the `OverHeadMobile` scheme on an iPhone simulator. The bundle identifier matches the existing `OverHead iOS` Firebase app: `com.blacklion.overhead`.

The existing Electron desktop app keeps its task board in local desktop state; mobile shares the workspace-scoped Firestore task collection with the web dashboard. Cylinder customer records can sync into the shared workspace, but Cylinder's local task board does not. Connecting Cylinder tasks to that shared collection remains a separate integration step.
