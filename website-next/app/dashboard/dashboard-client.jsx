"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "../firebase-client";
import { cylinderCrossoverUsers, desktopSeatPricing, downloadHref } from "../data";

const ALLOWED_INVITE_ROLES = ["Manager", "Staff"];
const ALLOWED_MEMBER_ROLES = ["Administrator", "Manager", "Staff"];
const ALLOWED_MEMBER_STATUSES = ["Active", "Suspended"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function displayError(error) {
  const code = String(error?.code || error?.message || "").toLowerCase();
  if (code.includes("permission-denied")) {
    return "Permission denied. Ensure your email is verified and your account has the required role.";
  }
  if (code.includes("network-request-failed") || code.includes("unavailable")) {
    return "Network connection unavailable. Changes will sync once reconnected.";
  }
  return error?.message || "The workspace action could not be completed.";
}

export default function DashboardClient() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [members, setMembers] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [myLicense, setMyLicense] = useState(null);
  const [billedSeatCount, setBilledSeatCount] = useState(null);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const seatCountLoaded = billedSeatCount !== null || membersLoaded;
  const activeSeatCount = Math.max(Number(billedSeatCount) || 0, members.filter((member) => member.status === "Active").length);
  const activeTier = ["silver", "gold", "black"].includes(String(myLicense?.tier || "").toLowerCase())
    ? String(myLicense.tier).toLowerCase()
    : null;
  const activePlan = activeTier ? activeTier.charAt(0).toUpperCase() + activeTier.slice(1) : null;
  const monthlySeatQuote = activePlan && activeSeatCount > 0 ? desktopSeatPricing(activePlan, activeSeatCount) : null;
  const annualCylinderQuote = activePlan && activeSeatCount > 0 ? desktopSeatPricing(activePlan, activeSeatCount, "annual") : null;
  const cylinderRecommended = monthlySeatQuote && annualCylinderQuote
    ? monthlySeatQuote.cylinderRecommended || annualCylinderQuote.cylinderRecommended
    : false;

  // Draft states
  const [draft, setDraft] = useState("");
  const [customerDraft, setCustomerDraft] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [approvalDraft, setApprovalDraft] = useState({
    title: "",
    details: "",
  });
  const [invite, setInvite] = useState({ email: "", name: "", role: "Staff" });
  const inviteRequestRef = useRef(null);
  const memberSeatRequestRef = useRef(new Map());

  // UX & Background Ops states
  const [taskFilter, setTaskFilter] = useState("all"); // 'all' | 'active' | 'done'
  const [notice, setNotice] = useState(null); // { text, type: 'info' | 'error' | 'success' }
  const [busyAction, setBusyAction] = useState(""); // identifier of in-flight operation
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [resendingEmail, setResendingEmail] = useState(false);
  const noticeTimerRef = useRef(null);

  // Auto-dismiss success/info notices after 5 seconds
  const showNotice = (text, type = "info") => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ text, type });
    if (type !== "error") {
      noticeTimerRef.current = setTimeout(() => {
        setNotice(null);
      }, 5000);
    }
  };

  const clearNotice = () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice(null);
  };

  // Background network connectivity tracking
  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const handleOnline = () => {
      setIsOnline(true);
      showNotice("Network connection restored. Syncing data...", "success");
    };
    const handleOffline = () => {
      setIsOnline(false);
      showNotice("You are offline. Workspace changes require a network connection.", "error");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // Authenticate user & load workspace profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        router.replace("/sign-in/");
        return;
      }
      try {
        const snapshot = await getDoc(doc(firebaseDb, "profiles", user.uid));
        if (!snapshot.exists()) {
          await signOut(firebaseAuth);
          router.replace("/sign-in/");
          return;
        }
        setProfile(snapshot.data());
      } catch (error) {
        showNotice(displayError(error), "error");
      }
    });
    return unsubscribe;
  }, [router]);

  // Realtime Listeners (Background synced)
  useEffect(() => {
    if (!profile?.workspace_id) return undefined;
    const unsub = onSnapshot(
      collection(firebaseDb, "workspaces", profile.workspace_id, "tasks"),
      (snapshot) => {
        setTasks(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => Number(Boolean(a.done)) - Number(Boolean(b.done))),
        );
        setLastSyncedAt(new Date());
      },
      (error) => showNotice(displayError(error), "error"),
    );
    return unsub;
  }, [profile?.workspace_id]);

  useEffect(() => {
    if (!profile?.workspace_id) return undefined;
    const unsub = onSnapshot(
      collection(firebaseDb, "workspaces", profile.workspace_id, "customers"),
      (snapshot) => {
        setCustomers(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
        );
        setLastSyncedAt(new Date());
      },
      (error) => showNotice(displayError(error), "error"),
    );
    return unsub;
  }, [profile?.workspace_id]);

  useEffect(() => {
    if (!profile?.workspace_id) return undefined;
    const unsub = onSnapshot(
      collection(firebaseDb, "workspaces", profile.workspace_id, "approvals"),
      (snapshot) => {
        setApprovals(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
        );
        setLastSyncedAt(new Date());
      },
      (error) => showNotice(displayError(error), "error"),
    );
    return unsub;
  }, [profile?.workspace_id]);

  useEffect(() => {
    if (!profile?.workspace_id || profile.role !== "Administrator") return undefined;
    // Note: Profiles listing requires verified email per firestore.rules
    if (!firebaseAuth.currentUser?.emailVerified) return undefined;

    const unsub = onSnapshot(
      query(
        collection(firebaseDb, "profiles"),
        where("workspace_id", "==", profile.workspace_id),
      ),
      (snapshot) => {
        setMembers(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
        );
        setMembersLoaded(true);
        setLastSyncedAt(new Date());
      },
      (error) => showNotice(displayError(error), "error"),
    );
    return unsub;
  }, [profile?.workspace_id, profile?.role]);

  useEffect(() => {
    if (!profile?.workspace_id) return undefined;
    return onSnapshot(
      doc(firebaseDb, "workspaces", profile.workspace_id, "billing", "current"),
      (snapshot) => {
        const seatCount = snapshot.data()?.seat_count;
        setBilledSeatCount(Number.isFinite(Number(seatCount)) && seatCount !== undefined && seatCount !== null ? Number(seatCount) : null);
        setLastSyncedAt(new Date());
      },
      (error) => showNotice(displayError(error), "error"),
    );
  }, [profile?.workspace_id]);

  useEffect(() => {
    const userId = firebaseAuth.currentUser?.uid;
    if (!profile?.workspace_id || !userId) return undefined;
    return onSnapshot(
      doc(firebaseDb, "workspaces", profile.workspace_id, "licenses", userId),
      (snapshot) => {
        setMyLicense(snapshot.exists() ? snapshot.data() : null);
        setLastSyncedAt(new Date());
      },
      (error) => showNotice(displayError(error), "error"),
    );
  }, [profile?.workspace_id]);

  useEffect(() => {
    if (!profile?.workspace_id || profile.role !== "Administrator") return undefined;
    const unsub = onSnapshot(
      collection(firebaseDb, "workspaces", profile.workspace_id, "licenses"),
      (snapshot) => {
        setLicenses(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
        );
        setLastSyncedAt(new Date());
      },
      (error) => showNotice(displayError(error), "error"),
    );
    return unsub;
  }, [profile?.workspace_id, profile?.role]);

  // Filtered tasks memo
  const openTasks = useMemo(
    () => tasks.filter((task) => !task.done).length,
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    if (taskFilter === "active") return tasks.filter((t) => !t.done);
    if (taskFilter === "done") return tasks.filter((t) => Boolean(t.done));
    return tasks;
  }, [tasks, taskFilter]);

  // Resend Email Verification (Security & Onboarding)
  async function handleResendVerification() {
    if (!firebaseAuth.currentUser || resendingEmail) return;
    try {
      setResendingEmail(true);
      await sendEmailVerification(firebaseAuth.currentUser);
      showNotice("Verification email sent! Check your inbox.", "success");
    } catch (error) {
      showNotice(displayError(error), "error");
    } finally {
      setResendingEmail(false);
    }
  }

  // Task Operations
  async function addTask() {
    const cleanTitle = draft.trim();
    if (!cleanTitle || !profile || busyAction) return;
    if (cleanTitle.length > 200) {
      return showNotice("Task title must be under 200 characters.", "error");
    }
    try {
      setBusyAction("addTask");
      await addDoc(
        collection(firebaseDb, "workspaces", profile.workspace_id, "tasks"),
        {
          workspace_id: profile.workspace_id,
          title: cleanTitle,
          done: false,
          created_by: firebaseAuth.currentUser.uid,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        },
      );
      setDraft("");
      showNotice("Priority task added to workspace.", "success");
    } catch (error) {
      showNotice(displayError(error), "error");
    } finally {
      setBusyAction("");
    }
  }

  async function toggleTask(task) {
    const actionKey = `toggle_${task.id}`;
    if (busyAction === actionKey || !profile) return;
    try {
      setBusyAction(actionKey);
      await updateDoc(
        doc(firebaseDb, "workspaces", profile.workspace_id, "tasks", task.id),
        { done: !task.done, updated_at: serverTimestamp() },
      );
    } catch (error) {
      showNotice(displayError(error), "error");
    } finally {
      setBusyAction("");
    }
  }

  // Customer Operations
  async function addCustomer() {
    if (!profile || busyAction) return;
    const cleanName = customerDraft.name.trim();
    const cleanEmail = customerDraft.email.trim().toLowerCase();
    const cleanPhone = customerDraft.phone.trim();

    if (!cleanName) {
      return showNotice("Please provide the customer's name.", "error");
    }
    if (cleanName.length > 100) {
      return showNotice("Customer name must be under 100 characters.", "error");
    }
    if (cleanEmail && (!EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > 100)) {
      return showNotice("Please enter a valid email address.", "error");
    }
    if (cleanPhone && cleanPhone.length > 30) {
      return showNotice("Phone number must be under 30 characters.", "error");
    }

    try {
      setBusyAction("addCustomer");
      await addDoc(
        collection(firebaseDb, "workspaces", profile.workspace_id, "customers"),
        {
          workspace_id: profile.workspace_id,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          status: "Active",
          created_by: firebaseAuth.currentUser.uid,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        },
      );
      setCustomerDraft({ name: "", email: "", phone: "" });
      showNotice("Customer record created successfully.", "success");
    } catch (error) {
      showNotice(displayError(error), "error");
    } finally {
      setBusyAction("");
    }
  }

  // Approval Operations
  async function requestApproval() {
    if (!profile || busyAction) return;
    const cleanTitle = approvalDraft.title.trim();
    const cleanDetails = approvalDraft.details.trim();

    if (!cleanTitle) {
      return showNotice("Please enter an approval title.", "error");
    }
    if (cleanTitle.length > 120) {
      return showNotice("Approval title must be under 120 characters.", "error");
    }
    if (cleanDetails.length > 1000) {
      return showNotice("Approval details must be under 1000 characters.", "error");
    }

    try {
      setBusyAction("requestApproval");
      await addDoc(
        collection(firebaseDb, "workspaces", profile.workspace_id, "approvals"),
        {
          workspace_id: profile.workspace_id,
          title: cleanTitle,
          details: cleanDetails,
          status: "Pending",
          created_by: firebaseAuth.currentUser.uid,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        },
      );
      setApprovalDraft({ title: "", details: "" });
      showNotice("Approval request submitted to managers.", "success");
    } catch (error) {
      showNotice(displayError(error), "error");
    } finally {
      setBusyAction("");
    }
  }

  async function decideApproval(approval, status) {
    if (!["Approved", "Declined"].includes(status)) return;
    const actionKey = `approval_${approval.id}`;
    if (busyAction === actionKey || !profile) return;

    try {
      setBusyAction(actionKey);
      await updateDoc(
        doc(
          firebaseDb,
          "workspaces",
          profile.workspace_id,
          "approvals",
          approval.id,
        ),
        {
          status,
          decided_by: firebaseAuth.currentUser.uid,
          decided_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        },
      );
      showNotice(`Approval marked ${status.toLowerCase()}.`, "success");
    } catch (error) {
      showNotice(displayError(error), "error");
    } finally {
      setBusyAction("");
    }
  }

  // Team Invite Operations
  async function createInvite() {
    if (!profile || busyAction) return;
    const cleanEmail = invite.email.trim().toLowerCase();
    const cleanName = invite.name.trim();

    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      return showNotice("Enter a valid email address for the invitee.", "error");
    }
    if (!ALLOWED_INVITE_ROLES.includes(invite.role)) {
      return showNotice("Select a valid workspace role.", "error");
    }
    if (cleanName.length > 80) {
      return showNotice("Name must be under 80 characters.", "error");
    }

    try {
      setBusyAction("createInvite");
      const requestId = inviteRequestRef.current || (inviteRequestRef.current = crypto.randomUUID());
      const idToken = await firebaseAuth.currentUser.getIdToken();
      const response = await fetch("https://us-central1-overhead-office.cloudfunctions.net/billingApi", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ action: "create_invite", requestId, email: cleanEmail, name: cleanName || cleanEmail, role: invite.role }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The invite and seat billing could not be updated.");
      inviteRequestRef.current = null;
      setInvite({ email: "", name: "", role: "Staff" });
      showNotice(
        `${result.alreadyInvited ? "That invite is already active." : "Invite created."} Share workspace ID (${profile.workspace_id}) with ${cleanEmail}. The seat will be included on the next subscription invoice.`,
        "success",
      );
    } catch (error) {
      showNotice(displayError(error), "error");
    } finally {
      setBusyAction("");
    }
  }

  // Team Member Management
  async function changeMember(member, key, value) {
    if (!["role", "status"].includes(key) || !profile) return;
    if (member.id === profile.uid) {
      return showNotice("You cannot modify your own administrative role or status.", "error");
    }
    if (key === "role" && !ALLOWED_MEMBER_ROLES.includes(value)) return;
    if (key === "status" && !ALLOWED_MEMBER_STATUSES.includes(value)) return;

    const actionKey = `member_${member.id}`;
    if (busyAction === actionKey) return;

    try {
      setBusyAction(actionKey);
      if (key === "status") {
        const requestId = memberSeatRequestRef.current.get(member.id) || crypto.randomUUID();
        memberSeatRequestRef.current.set(member.id, requestId);
        const idToken = await firebaseAuth.currentUser.getIdToken();
        const response = await fetch("https://us-central1-overhead-office.cloudfunctions.net/billingApi", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ action: "update_local_seat", requestId, uid: member.id, email: member.email, status: value.toLowerCase() }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "The member status and seat billing could not be updated.");
        memberSeatRequestRef.current.delete(member.id);
      } else {
        await updateDoc(doc(firebaseDb, "profiles", member.id), {
          [key]: value,
          updated_at: serverTimestamp(),
        });
      }
      showNotice(`${member.owner_name || member.email} updated.`, "success");
    } catch (error) {
      showNotice(displayError(error), "error");
    } finally {
      setBusyAction("");
    }
  }

  async function leaveWorkspace() {
    await signOut(firebaseAuth);
    router.push("/sign-in/");
  }

  if (!profile) {
    return (
      <section className="dashboard-loading">
        Checking secure workspace access...
      </section>
    );
  }

  const firstName = (profile.owner_name || "there").split(" ")[0];
  const canManage = profile.role === "Administrator";
  const canApprove = ["Administrator", "Manager"].includes(profile.role);
  const emailVerified = Boolean(firebaseAuth.currentUser?.emailVerified);

  return (
    <section className="dashboard-shell">
      {/* Sidebar Navigation */}
      <aside className="dashboard-sidebar">
        <Link className="dashboard-mark" href="/">
          <span>OH</span>OverHead
        </Link>
        <div className="workspace-chip">
          <span>{profile.role} workspace</span>
          <strong>{profile.business_name}</strong>
        </div>
        <nav className="dashboard-nav" aria-label="Workspace navigation">
          <Link className="selected" href="#overview">
            Overview
          </Link>
          <Link href="#tasks">Tasks</Link>
          <Link href="#customers">Customers</Link>
          <Link href="#approvals">Approvals</Link>
          <Link href="#access">Access</Link>
          <Link href="/support/">Support</Link>
        </nav>
        <div className="dashboard-sidebar-bottom">
          <Link href="/support/">Support</Link>
          <button type="button" onClick={leaveWorkspace}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div id="overview" className="dashboard-main">
        {/* Network Offline Banner */}
        {!isOnline && (
          <div
            className="notice dashboard-notice"
            style={{
              background: "rgba(235, 87, 87, 0.15)",
              color: "#c53030",
              marginBottom: 16,
            }}
          >
            <strong>Offline Mode:</strong> Network disconnected. Local changes will sync when connection returns.
          </div>
        )}

        {/* Email Verification Warning Banner */}
        {!emailVerified && (
          <div
            className="notice dashboard-notice"
            style={{
              background: "rgba(255, 179, 0, 0.15)",
              color: "#855d00",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <span>
              <strong>Verify Email:</strong> Your email is pending verification. Firestore rules require a verified email for administrative operations.
            </span>
            <button
              className="mini-button"
              type="button"
              disabled={resendingEmail}
              onClick={handleResendVerification}
              style={{ marginLeft: 12, whiteSpace: "nowrap" }}
            >
              {resendingEmail ? "Sending..." : "Resend Link"}
            </button>
          </div>
        )}

        {/* Notice/Feedback Toast */}
        {notice && (
          <div
            className="notice dashboard-notice"
            role="status"
            aria-live="polite"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              background:
                notice.type === "error"
                  ? "rgba(235, 87, 87, 0.15)"
                  : notice.type === "success"
                  ? "rgba(46, 204, 113, 0.15)"
                  : undefined,
              color:
                notice.type === "error"
                  ? "#c53030"
                  : notice.type === "success"
                  ? "#196f3d"
                  : undefined,
            }}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={clearNotice}
              style={{
                background: "transparent",
                border: 0,
                cursor: "pointer",
                fontWeight: 700,
                padding: "0 6px",
              }}
              aria-label="Dismiss notice"
            >
              ✕
            </button>
          </div>
        )}

        {/* Topline Welcome & Status */}
        <div className="dashboard-topline">
          <div>
            <p className="eyebrow">{profile.role} dashboard</p>
            <h1>Good to see you, {firstName}.</h1>
            <p>
              Shared workspace data is scoped to {profile.business_name}. Your
              role determines which changes you can make.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <Link className="primary" href={downloadHref}>
              Download desktop app
            </Link>
            {lastSyncedAt && (
              <span style={{ fontSize: 11, color: "var(--ink-muted, #718096)" }}>
                Last workspace update: {lastSyncedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="dashboard-metrics">
          <article>
            <span>Priority tasks</span>
            <strong>{openTasks}</strong>
            <p>Workspace work waiting for attention.</p>
          </article>
          <article>
            <span>Workspace role</span>
            <strong>{profile.role}</strong>
            <p>Access enforced by Firestore security rules.</p>
          </article>
          <article>
            <span>Team licenses</span>
            <strong>{canManage ? licenses.length : "Managed"}</strong>
            <p>
              {canManage
                ? "License records assigned by active entitlement."
                : "Your administrator manages workspace access."}
            </p>
          </article>
          <article>
            <span>Email status</span>
            <strong>{emailVerified ? "Verified" : "Pending"}</strong>
            <p>
              {emailVerified
                ? "Account identity authenticated."
                : "Check your inbox to verify."}
            </p>
          </article>
        </div>

        {/* Workspace Operations Grid */}
        <div className="dashboard-grid">
          {/* Priority Tasks Panel */}
          <section id="tasks" className="dashboard-panel tasks-panel">
            <div className="panel-heading">
              <div>
                <span>Shared work</span>
                <h2>Priority queue</h2>
              </div>
              <strong>{openTasks} open</strong>
            </div>

            {/* Task Filter Tabs */}
            <div style={{ display: "flex", gap: 8, margin: "8px 0 14px" }}>
              <button
                type="button"
                className="mini-button"
                style={{
                  background: taskFilter === "all" ? "var(--cyan, #00d2d3)" : "transparent",
                  color: taskFilter === "all" ? "var(--void, #111)" : "inherit",
                }}
                onClick={() => setTaskFilter("all")}
              >
                All ({tasks.length})
              </button>
              <button
                type="button"
                className="mini-button"
                style={{
                  background: taskFilter === "active" ? "var(--cyan, #00d2d3)" : "transparent",
                  color: taskFilter === "active" ? "var(--void, #111)" : "inherit",
                }}
                onClick={() => setTaskFilter("active")}
              >
                Active ({openTasks})
              </button>
              <button
                type="button"
                className="mini-button"
                style={{
                  background: taskFilter === "done" ? "var(--cyan, #00d2d3)" : "transparent",
                  color: taskFilter === "done" ? "var(--void, #111)" : "inherit",
                }}
                onClick={() => setTaskFilter("done")}
              >
                Done ({tasks.length - openTasks})
              </button>
            </div>

            {/* Task Input Form */}
            <div className="task-entry">
              <input
                value={draft}
                maxLength={200}
                disabled={busyAction === "addTask"}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addTask()}
                placeholder="Add the next action that matters (Enter to save)"
              />
              <button
                className="primary"
                type="button"
                disabled={busyAction === "addTask" || !draft.trim()}
                onClick={addTask}
              >
                {busyAction === "addTask" ? "Adding..." : "Add task"}
              </button>
            </div>

            {/* Task Items List */}
            <div className="task-list">
              {filteredTasks.map((task) => (
                <label
                  key={task.id}
                  className={task.done ? "task done" : "task"}
                  style={{ opacity: busyAction === `toggle_${task.id}` ? 0.6 : 1 }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(task.done)}
                    disabled={busyAction === `toggle_${task.id}`}
                    onChange={() => toggleTask(task)}
                  />
                  <span>{task.title}</span>
                </label>
              ))}
              {!filteredTasks.length && (
                <p className="empty-state">
                  {taskFilter === "done"
                    ? "No completed tasks yet."
                    : taskFilter === "active"
                    ? "All tasks are completed! Add a new one above."
                    : "Start with one concrete action for the team."}
                </p>
              )}
            </div>
          </section>

          {/* Access & Role Boundaries */}
          <section id="access" className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <span>Access</span>
                <h2>Role boundaries</h2>
              </div>
            </div>
            <div className="control-list">
              <div>
                <span>Administrator</span>
                <strong>Invites, roles, status, and workspace controls.</strong>
              </div>
              <div>
                <span>Manager</span>
                <strong>Shared work, approvals, and team execution.</strong>
              </div>
              <div>
                <span>Staff</span>
                <strong>Assigned workspace work without role administration.</strong>
              </div>
            </div>
            <Link className="secondary dark-secondary" href="/account/">
              My account and license
            </Link>
          </section>
        </div>

        {/* Secondary Operations Grid */}
        <div className="dashboard-grid web-workspace-grid">
          {/* Customer Records Panel */}
          <section id="customers" className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <span>Browser workspace</span>
                <h2>Customer records</h2>
              </div>
              <strong>{customers.length} saved</strong>
            </div>
            <div className="invite-form">
              <label>
                Name *
                <input
                  value={customerDraft.name}
                  maxLength={100}
                  disabled={busyAction === "addCustomer"}
                  onChange={(event) =>
                    setCustomerDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Customer name"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={customerDraft.email}
                  maxLength={100}
                  disabled={busyAction === "addCustomer"}
                  onChange={(event) =>
                    setCustomerDraft((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="customer@example.com"
                />
              </label>
              <label>
                Phone
                <input
                  value={customerDraft.phone}
                  maxLength={30}
                  disabled={busyAction === "addCustomer"}
                  onChange={(event) =>
                    setCustomerDraft((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="Phone (optional)"
                />
              </label>
              <button
                className="primary"
                type="button"
                disabled={busyAction === "addCustomer" || !customerDraft.name.trim()}
                onClick={addCustomer}
              >
                {busyAction === "addCustomer" ? "Saving..." : "Add customer"}
              </button>
            </div>
            <div className="task-list">
              {customers.slice(0, 8).map((customer) => (
                <article className="task" key={customer.id}>
                  <strong>{customer.name}</strong>
                  <span>
                    {customer.email || customer.phone || "No contact detail"}
                  </span>
                </article>
              ))}
              {!customers.length && (
                <p className="empty-state">
                  Add the first shared customer record from the browser.
                </p>
              )}
            </div>
          </section>

          {/* Approvals Queue Panel */}
          <section id="approvals" className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <span>Browser workspace</span>
                <h2>Approval queue</h2>
              </div>
              <strong>
                {approvals.filter((item) => item.status === "Pending").length}{" "}
                pending
              </strong>
            </div>
            <div className="task-entry">
              <input
                value={approvalDraft.title}
                maxLength={120}
                disabled={busyAction === "requestApproval"}
                onChange={(event) =>
                  setApprovalDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Approval needed (e.g. Budget request)"
              />
              <button
                className="primary"
                type="button"
                disabled={busyAction === "requestApproval" || !approvalDraft.title.trim()}
                onClick={requestApproval}
              >
                {busyAction === "requestApproval" ? "Requesting..." : "Request approval"}
              </button>
            </div>
            <label style={{ marginTop: 8 }}>
              Details (optional)
              <textarea
                value={approvalDraft.details}
                maxLength={1000}
                disabled={busyAction === "requestApproval"}
                onChange={(event) =>
                  setApprovalDraft((current) => ({
                    ...current,
                    details: event.target.value,
                  }))
                }
                placeholder="What needs review and who is involved?"
                rows={3}
              />
            </label>
            <div className="task-list">
              {approvals.slice(0, 8).map((approval) => (
                <article className="task" key={approval.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{approval.title}</strong>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background:
                          approval.status === "Approved"
                            ? "rgba(46, 204, 113, 0.15)"
                            : approval.status === "Declined"
                            ? "rgba(235, 87, 87, 0.15)"
                            : "rgba(255, 179, 0, 0.15)",
                        color:
                          approval.status === "Approved"
                            ? "#196f3d"
                            : approval.status === "Declined"
                            ? "#c53030"
                            : "#855d00",
                      }}
                    >
                      {approval.status}
                    </span>
                  </div>
                  {approval.details && <p style={{ margin: "4px 0 6px", fontSize: 13 }}>{approval.details}</p>}
                  {canApprove && approval.status === "Pending" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button
                        className="mini-button"
                        type="button"
                        disabled={busyAction === `approval_${approval.id}`}
                        onClick={() => decideApproval(approval, "Approved")}
                      >
                        {busyAction === `approval_${approval.id}` ? "Updating..." : "Approve"}
                      </button>
                      <button
                        className="mini-button"
                        type="button"
                        disabled={busyAction === `approval_${approval.id}`}
                        onClick={() => decideApproval(approval, "Declined")}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </article>
              ))}
              {!approvals.length && (
                <p className="empty-state">
                  Send the first approval request from the browser.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Administrator Controls */}
        {canManage && (
          <section className="dashboard-panel team-admin-panel" style={{ marginTop: 24 }}>
            <div className="panel-heading">
              <div>
                <span>Administrator controls</span>
                <h2>Invite and manage your team</h2>
              </div>
              <strong>{seatCountLoaded ? `${activeSeatCount} billable seats` : "Loading seat count..."}</strong>
            </div>
            <div className="invite-form">
              <label>
                Name
                <input
                  value={invite.name}
                  maxLength={80}
                  disabled={busyAction === "createInvite"}
                  onChange={(event) => {
                    inviteRequestRef.current = null;
                    setInvite((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }}
                  placeholder="Team member name"
                />
              </label>
              <label>
                Email *
                <input
                  type="email"
                  value={invite.email}
                  maxLength={100}
                  disabled={busyAction === "createInvite"}
                  onChange={(event) => {
                    inviteRequestRef.current = null;
                    setInvite((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }}
                  placeholder="person@business.com"
                />
              </label>
              <label>
                Role
                <select
                  value={invite.role}
                  disabled={busyAction === "createInvite"}
                  onChange={(event) => {
                    inviteRequestRef.current = null;
                    setInvite((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }}
                >
                  {ALLOWED_INVITE_ROLES.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
              <button
                className="primary"
                type="button"
                disabled={busyAction === "createInvite" || !invite.email.trim()}
                onClick={createInvite}
              >
                {busyAction === "createInvite" ? "Inviting..." : "Create invite"}
              </button>
            </div>
            <p className="admin-hint">
              Invitees create their own password at the shared sign-in page.
              Give them the workspace ID (<strong>{profile.workspace_id}</strong>) shown in the confirmation.
            </p>
            {activePlan && monthlySeatQuote && annualCylinderQuote ? (
              <>
                <p className="admin-hint">
                  Seat pricing guide: every Desktop plan includes 1 user. Each added seat is half the previous seat price, rounded down to a whole dollar, with a $14.99/month minimum; the next {activePlan} seat would be ${ (monthlySeatQuote.nextSeatCents / 100).toFixed(2) }. Total Desktop charges are capped at $499/month. The first paid month is free at checkout and does not stack with the existing 90-day Gold trial. Seat charges are included in checkout and adjusted on the next subscription invoice. Cylinder includes up to 50 users at its separate server price.
                </p>
                <p className="admin-hint" role="status">
                  {cylinderRecommended
                    ? `Cylinder may cost less for ${activeSeatCount} active ${activePlan} users. Current uncapped Desktop estimate: $${(monthlySeatQuote.uncappedCents / 100).toFixed(2)}/month, capped at $499/month. Compare Cylinder's $499/month or $4,990/year plan. Cylinder requires a supported Windows Server or Windows IoT host.`
                    : `${activeSeatCount} active ${activePlan} users. Compare Cylinder at ${cylinderCrossoverUsers(activePlan, "annual")} users on its annual price or ${cylinderCrossoverUsers(activePlan)} users month to month, based on the selected Desktop price and half-price additional seats.`}
                </p>
              </>
            ) : (
              <p className="admin-hint">Seat pricing estimates will appear when an active license and current seat count are available.</p>
            )}
            <div className="member-list">
              {members.map((member) => (
                <article key={member.id}>
                  <div>
                    <strong>{member.owner_name || member.email}</strong>
                    <p>{member.email}</p>
                  </div>
                  <select
                    value={member.role}
                    disabled={member.id === profile.uid || busyAction === `member_${member.id}`}
                    onChange={(event) =>
                      changeMember(member, "role", event.target.value)
                    }
                  >
                    <option>Administrator</option>
                    <option>Manager</option>
                    <option>Staff</option>
                  </select>
                  <select
                    value={member.status}
                    disabled={member.id === profile.uid || busyAction === `member_${member.id}`}
                    onChange={(event) =>
                      changeMember(member, "status", event.target.value)
                    }
                  >
                    <option>Active</option>
                    <option>Suspended</option>
                  </select>
                </article>
              ))}
            </div>
            <p className="admin-hint">
              Licenses are created and updated from the workspace entitlement.
              Each member sees only their own internal license record;
              administrators can review the register once an entitlement is
              active.
            </p>
          </section>
        )}

        {/* Guidance Panel */}
        {canApprove && (
          <section className="dashboard-panel guidance-panel" style={{ marginTop: 24 }}>
            <div>
              <span>Role-aware desktop access</span>
              <h2>Sign into OverHead Desktop with this same account.</h2>
              <p>
                The shared account registry identifies the workspace, role, and
                license. The desktop app keeps operational records local while
                resolving the same workspace-member license for access
                decisions.
              </p>
            </div>
            <Link className="primary" href={downloadHref}>
              Get Windows package
            </Link>
          </section>
        )}
      </div>
    </section>
  );
}
