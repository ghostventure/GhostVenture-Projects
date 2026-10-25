"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { postJson } from "../lib/client-api";

export function AccountRecoveryApp() {
  const [token, setToken] = useState("");
  const [completed, setCompleted] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const recoveryToken = fragment.get("token") || "";
    setToken(recoveryToken);
    if (recoveryToken) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  async function requestRecovery(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const form = event.currentTarget;
    try {
      const data = await postJson("/api/account/recovery/request", {
        email: new FormData(form).get("email")
      });
      setNotice(data.message || "If an account exists for that address, recovery instructions will be sent.");
      form.reset();
    } catch (error) {
      setNotice(error.message || "The request could not be submitted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function completeRecovery(event) {
    event.preventDefault();
    setNotice("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword") || "");
    if (newPassword !== String(data.get("confirmPassword") || "")) {
      setNotice("The new password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await postJson("/api/account/recovery/complete", { token, newPassword });
      setNotice(result.message || "Password updated. You can now sign in with your new password.");
      form.reset();
      setCompleted(true);
    } catch (error) {
      setNotice(error.message || "This recovery link may be invalid or expired. Request a new one.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="panel" aria-labelledby="account-recovery-title">
        <p className="label">Account access</p>
        <h1 id="account-recovery-title">{completed ? "Password updated" : token ? "Choose a new password" : "Reset your password"}</h1>
        {completed ? <p className="muted">Your password has been updated. Sign in with the new password to continue.</p> : token ? (
          <form className="form active" onSubmit={completeRecovery}>
            <label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
            <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
            <p className="muted">Use at least 12 characters. Recovery links expire and can only be used once.</p>
            <button className="button" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
          </form>
        ) : (
          <form className="form active" onSubmit={requestRecovery}>
            <p className="muted">Enter the email address on your account. If it matches, we’ll send recovery instructions.</p>
            <label>Email<input name="email" type="email" autoComplete="email" required /></label>
            <button className="button" type="submit" disabled={busy}>{busy ? "Sending…" : "Send recovery instructions"}</button>
          </form>
        )}
        <p className={`message ${notice ? "is-visible" : ""}`} role="status" aria-live="polite">{notice}</p>
        <p><Link href="/portal">Return to sign in</Link></p>
      </section>
    </main>
  );
}
