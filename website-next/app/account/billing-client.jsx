"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { cylinderPageHref } from "../data";
import { firebaseAuth, firebaseDb } from "../firebase-client";

const messageFor = (error, fallback) => error?.message || fallback;

export default function BillingClient() {
  const [profile, setProfile] = useState(null);
  const [billing, setBilling] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(firebaseAuth, async (user) => {
        if (!user) {
          setProfile(null);
          return;
        }
        try {
          const snapshot = await getDoc(doc(firebaseDb, "profiles", user.uid));
          setProfile(snapshot.exists() ? snapshot.data() : null);
        } catch (error) {
          setNotice(messageFor(error, "Billing access could not be loaded."));
        }
      }),
    [],
  );

  useEffect(() => {
    if (!profile?.workspace_id) return undefined;
    return onSnapshot(
      doc(firebaseDb, "workspaces", profile.workspace_id, "billing", "current"),
      (snapshot) => setBilling(snapshot.exists() ? snapshot.data() : null),
      (error) =>
        setNotice(
          messageFor(error, "Subscription status could not be loaded."),
        ),
    );
  }, [profile?.workspace_id]);

  if (!profile) return null;
  const administrator = profile.role === "Administrator";
  const tier = billing?.tier
    ? `${billing.tier[0].toUpperCase()}${billing.tier.slice(1)}`
    : "No active plan";
  const status = billing?.status
    ? billing.status.replace(/_/g, " ")
    : "Pending entitlement";

  return (
    <section className="browser-billing">
      <div className="billing-heading">
        <div>
          <span>Shared subscription</span>
          <h2>Browser and desktop access stay in sync.</h2>
          <p>
            Your workspace plan is stored centrally. A change here is reflected
            in OverHead Desktop after its next sign-in or entitlement refresh.
          </p>
        </div>
        <strong className="billing-status">{status}</strong>
      </div>
      <div className="billing-summary">
        <div>
          <span>Current plan</span>
          <strong>{tier}</strong>
        </div>
        <div>
          <span>Access status</span>
          <strong>{status}</strong>
        </div>
        <div>
          <span>Processor</span>
          <strong>
            {billing?.billing_provider === "overhead_free_trial"
              ? "Free trial"
              : "Stripe"}
          </strong>
        </div>
      </div>
      {administrator ? (
        <div className="billing-actions">
          <div className="billing-action-copy">
            <strong>Subscription requests</strong>
            <p>
              Self-service checkout, plan changes, and refunds are not enabled
              on this website yet. This page remains a read-only view of the
              shared workspace entitlement.
            </p>
          </div>
          <p className="admin-hint">
            For a plan, trial, cancellation, receipt, or billing question, email
            support with the workspace email and plan name. Do not send payment
            details. Cylinder is a separate Windows Server and Windows IoT
            deployment and is not available through standard desktop checkout.
          </p>
          <a
            className="text-link"
            href="mailto:solidartentertainment@gmail.com?subject=OverHead%20Plan%20or%20Billing%20Request"
          >
            Contact support about a plan or billing request
          </a>
          <a className="text-link" href={cylinderPageHref}>
            Review Cylinder deployment requirements
          </a>
        </div>
      ) : (
        <p className="admin-hint">
          Your workspace administrator manages the plan. Your access updates
          automatically when the shared subscription changes.
        </p>
      )}
      {notice && <p className="notice">{notice}</p>}
    </section>
  );
}
