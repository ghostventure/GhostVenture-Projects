"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "../firebase-client";
import { downloadHref } from "../data";

const roles = ["Manager", "Staff"];

function displayError(error) {
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
  const [notice, setNotice] = useState("");

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
        setNotice(displayError(error));
      }
    });
    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (!profile?.workspace_id) return undefined;
    return onSnapshot(
      collection(firebaseDb, "workspaces", profile.workspace_id, "tasks"),
      (snapshot) =>
        setTasks(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => Number(Boolean(a.done)) - Number(Boolean(b.done))),
        ),
      (error) => setNotice(displayError(error)),
    );
  }, [profile?.workspace_id]);

  useEffect(() => {
    if (!profile?.workspace_id) return undefined;
    return onSnapshot(
      collection(firebaseDb, "workspaces", profile.workspace_id, "customers"),
      (snapshot) =>
        setCustomers(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
        ),
      (error) => setNotice(displayError(error)),
    );
  }, [profile?.workspace_id]);

  useEffect(() => {
    if (!profile?.workspace_id) return undefined;
    return onSnapshot(
      collection(firebaseDb, "workspaces", profile.workspace_id, "approvals"),
      (snapshot) =>
        setApprovals(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
        ),
      (error) => setNotice(displayError(error)),
    );
  }, [profile?.workspace_id]);

  useEffect(() => {
    if (!profile?.workspace_id || profile.role !== "Administrator")
      return undefined;
    return onSnapshot(
      query(
        collection(firebaseDb, "profiles"),
        where("workspace_id", "==", profile.workspace_id),
      ),
      (snapshot) =>
        setMembers(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
        ),
      (error) => setNotice(displayError(error)),
    );
  }, [profile?.workspace_id, profile?.role]);

  useEffect(() => {
    if (!profile?.workspace_id || profile.role !== "Administrator")
      return undefined;
    return onSnapshot(
      collection(firebaseDb, "workspaces", profile.workspace_id, "licenses"),
      (snapshot) =>
        setLicenses(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
        ),
      (error) => setNotice(displayError(error)),
    );
  }, [profile?.workspace_id, profile?.role]);

  const openTasks = useMemo(
    () => tasks.filter((task) => !task.done).length,
    [tasks],
  );

  async function addTask() {
    if (!draft.trim() || !profile) return;
    try {
      await addDoc(
        collection(firebaseDb, "workspaces", profile.workspace_id, "tasks"),
        {
          workspace_id: profile.workspace_id,
          title: draft.trim(),
          done: false,
          created_by: firebaseAuth.currentUser.uid,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        },
      );
      setDraft("");
      setNotice("Priority task added for this workspace.");
    } catch (error) {
      setNotice(displayError(error));
    }
  }

  async function toggleTask(task) {
    try {
      await updateDoc(
        doc(firebaseDb, "workspaces", profile.workspace_id, "tasks", task.id),
        { done: !task.done, updated_at: serverTimestamp() },
      );
    } catch (error) {
      setNotice(displayError(error));
    }
  }

  async function addCustomer() {
    if (!customerDraft.name.trim() || !profile)
      return setNotice("Add the customer's name before saving the record.");
    if (
      customerDraft.email.trim() &&
      !/^\S+@\S+\.\S+$/.test(customerDraft.email.trim())
    )
      return setNotice(
        "Enter a valid customer email address or leave it blank.",
      );
    try {
      await addDoc(
        collection(firebaseDb, "workspaces", profile.workspace_id, "customers"),
        {
          workspace_id: profile.workspace_id,
          name: customerDraft.name.trim(),
          email: customerDraft.email.trim().toLowerCase(),
          phone: customerDraft.phone.trim(),
          status: "Active",
          created_by: firebaseAuth.currentUser.uid,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        },
      );
      setCustomerDraft({ name: "", email: "", phone: "" });
      setNotice("Customer record added to the shared workspace.");
    } catch (error) {
      setNotice(displayError(error));
    }
  }

  async function requestApproval() {
    if (!approvalDraft.title.trim() || !profile)
      return setNotice("Add an approval title before sending the request.");
    try {
      await addDoc(
        collection(firebaseDb, "workspaces", profile.workspace_id, "approvals"),
        {
          workspace_id: profile.workspace_id,
          title: approvalDraft.title.trim(),
          details: approvalDraft.details.trim(),
          status: "Pending",
          created_by: firebaseAuth.currentUser.uid,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        },
      );
      setApprovalDraft({ title: "", details: "" });
      setNotice("Approval request sent to workspace managers.");
    } catch (error) {
      setNotice(displayError(error));
    }
  }

  async function decideApproval(approval, status) {
    try {
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
      setNotice(`Approval marked ${status.toLowerCase()}.`);
    } catch (error) {
      setNotice(displayError(error));
    }
  }

  async function createInvite() {
    const normalized = invite.email.trim().toLowerCase();
    if (!normalized.includes("@"))
      return setNotice(
        "Enter the invited manager or staff member's email address.",
      );
    try {
      await setDoc(
        doc(
          firebaseDb,
          "workspaces",
          profile.workspace_id,
          "invites",
          normalized,
        ),
        {
          email: normalized,
          name: invite.name.trim(),
          business_name: profile.business_name,
          role: invite.role,
          created_by: firebaseAuth.currentUser.uid,
          created_at: serverTimestamp(),
        },
      );
      setInvite({ email: "", name: "", role: "Staff" });
      setNotice(
        `Invite created. Share workspace ID ${profile.workspace_id} with ${normalized}.`,
      );
    } catch (error) {
      setNotice(displayError(error));
    }
  }

  async function changeMember(member, key, value) {
    try {
      await updateDoc(doc(firebaseDb, "profiles", member.id), {
        [key]: value,
        updated_at: serverTimestamp(),
      });
      setNotice(`${member.owner_name || member.email} updated.`);
    } catch (error) {
      setNotice(displayError(error));
    }
  }

  async function leaveWorkspace() {
    await signOut(firebaseAuth);
    router.push("/sign-in/");
  }

  if (!profile)
    return (
      <section className="dashboard-loading">
        Checking secure workspace access...
      </section>
    );
  const firstName = (profile.owner_name || "there").split(" ")[0];
  const canManage = profile.role === "Administrator";
  const canApprove = ["Administrator", "Manager"].includes(profile.role);

  return (
    <section className="dashboard-shell">
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
      <div id="overview" className="dashboard-main">
        <div className="dashboard-topline">
          <div>
            <p className="eyebrow">{profile.role} dashboard</p>
            <h1>Good to see you, {firstName}.</h1>
            <p>
              Shared workspace data is scoped to {profile.business_name}. Your
              role determines which changes you can make.
            </p>
          </div>
          <Link className="primary" href={downloadHref}>
            Download desktop app
          </Link>
        </div>
        <div className="dashboard-metrics">
          <article>
            <span>Priority tasks</span>
            <strong>{openTasks}</strong>
            <p>Workspace work waiting for attention.</p>
          </article>
          <article>
            <span>Workspace role</span>
            <strong>{profile.role}</strong>
            <p>Access is enforced by the shared registry.</p>
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
            <strong>
              {firebaseAuth.currentUser?.emailVerified ? "Verified" : "Review"}
            </strong>
            <p>
              {firebaseAuth.currentUser?.emailVerified
                ? "Verified account email."
                : "Confirm email from your inbox."}
            </p>
          </article>
        </div>
        <div className="dashboard-grid">
          <section id="tasks" className="dashboard-panel tasks-panel">
            <div className="panel-heading">
              <div>
                <span>Shared work</span>
                <h2>Priority queue</h2>
              </div>
              <strong>{openTasks} open</strong>
            </div>
            <div className="task-entry">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addTask()}
                placeholder="Add the next action that matters"
              />
              <button className="primary" type="button" onClick={addTask}>
                Add task
              </button>
            </div>
            <div className="task-list">
              {tasks.map((task) => (
                <label
                  key={task.id}
                  className={task.done ? "task done" : "task"}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(task.done)}
                    onChange={() => toggleTask(task)}
                  />
                  <span>{task.title}</span>
                </label>
              ))}
              {!tasks.length && (
                <p className="empty-state">
                  Start with one concrete action for the team.
                </p>
              )}
            </div>
          </section>
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
                <strong>
                  Assigned workspace work without role administration.
                </strong>
              </div>
            </div>
            <Link className="secondary dark-secondary" href="/account/">
              My account and license
            </Link>
          </section>
        </div>
        <div className="dashboard-grid web-workspace-grid">
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
                Name
                <input
                  value={customerDraft.name}
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
                  onChange={(event) =>
                    setCustomerDraft((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="Phone (optional)"
                />
              </label>
              <button className="primary" type="button" onClick={addCustomer}>
                Add customer
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
                onChange={(event) =>
                  setApprovalDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Approval needed"
              />
              <button
                className="primary"
                type="button"
                onClick={requestApproval}
              >
                Request approval
              </button>
            </div>
            <label>
              Details
              <textarea
                value={approvalDraft.details}
                onChange={(event) =>
                  setApprovalDraft((current) => ({
                    ...current,
                    details: event.target.value,
                  }))
                }
                placeholder="What needs review?"
              />
            </label>
            <div className="task-list">
              {approvals.slice(0, 8).map((approval) => (
                <article className="task" key={approval.id}>
                  <strong>{approval.title}</strong>
                  <span>{approval.status}</span>
                  {approval.details && <p>{approval.details}</p>}
                  {canApprove && approval.status === "Pending" && (
                    <div>
                      <button
                        className="mini-button"
                        type="button"
                        onClick={() => decideApproval(approval, "Approved")}
                      >
                        Approve
                      </button>
                      <button
                        className="mini-button"
                        type="button"
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
        {canManage && (
          <section className="dashboard-panel team-admin-panel">
            <div className="panel-heading">
              <div>
                <span>Administrator controls</span>
                <h2>Invite and manage your team</h2>
              </div>
              <strong>{members.length} members</strong>
            </div>
            <div className="invite-form">
              <label>
                Name
                <input
                  value={invite.name}
                  onChange={(event) =>
                    setInvite((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Team member name"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={invite.email}
                  onChange={(event) =>
                    setInvite((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="person@business.com"
                />
              </label>
              <label>
                Role
                <select
                  value={invite.role}
                  onChange={(event) =>
                    setInvite((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                >
                  {roles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
              <button className="primary" type="button" onClick={createInvite}>
                Create invite
              </button>
            </div>
            <p className="admin-hint">
              Invitees create their own password at the shared sign-in page.
              Give them the workspace ID shown in the confirmation.
            </p>
            <div className="member-list">
              {members.map((member) => (
                <article key={member.id}>
                  <div>
                    <strong>{member.owner_name || member.email}</strong>
                    <p>{member.email}</p>
                  </div>
                  <select
                    value={member.role}
                    disabled={member.id === profile.uid}
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
                    disabled={member.id === profile.uid}
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
        {canApprove && (
          <section className="dashboard-panel guidance-panel">
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
        {notice && <p className="notice dashboard-notice">{notice}</p>}
      </div>
    </section>
  );
}
