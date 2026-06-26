"use client";

import { useState } from "react";
import { storeClientSessionToken } from "../lib/client-session";
import { trackEvent } from "../lib/client-analytics";
import { postJson } from "../lib/client-api";
import { notifyAuthStateChange } from "../lib/auth-events";
import { serviceOptions } from "../lib/services";
import { FormHint, FormSectionCard, SupportNotice } from "./shared-ui";

function getWorkspacePath(user) {
  return "/dashboard";
}

async function waitForCookieSession() {
  for (let index = 0; index < 3; index += 1) {
    const response = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });
    if (response.ok) {
      return true;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 160));
  }

  return false;
}

export function AuthFormCard({ requiresAuth = false, idleReason = false }) {
  const [tab, setTab] = useState("signup");
  const [message, setMessage] = useState("");

  function continueToWorkspace(path) {
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    setMessage("");

    try {
      const formData = new FormData(event.currentTarget);
      const data = await postJson("/api/signup", Object.fromEntries(formData.entries()));
      if (data.sessionToken) {
        storeClientSessionToken(data.sessionToken);
      }
      notifyAuthStateChange("signed-in");
      trackEvent("signup_success", { service: formData.get("serviceInterest") });
      if (!(await waitForCookieSession())) {
        setMessage("Signed in, but the browser did not finish setting the secure session. Refresh and try again.");
        return;
      }
      continueToWorkspace(getWorkspacePath(data.user));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setMessage("");

    try {
      const formData = new FormData(event.currentTarget);
      const data = await postJson("/api/login", Object.fromEntries(formData.entries()));
      if (data.sessionToken) {
        storeClientSessionToken(data.sessionToken);
      }
      notifyAuthStateChange("signed-in");
      trackEvent("login_success");
      if (!(await waitForCookieSession())) {
        setMessage("Signed in, but the browser did not finish setting the secure session. Refresh and try again.");
        return;
      }
      continueToWorkspace(getWorkspacePath(data.user));
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="panel auth-card">
      <p className="label">Sign in</p>
      <div className="tabs">
        <button
          type="button"
          className={tab === "signup" ? "button" : "button button-secondary"}
          onClick={() => setTab("signup")}
        >
          Create account
        </button>
        <button
          type="button"
          className={tab === "login" ? "button" : "button button-secondary"}
          onClick={() => setTab("login")}
        >
          Sign in
        </button>
      </div>

      {idleReason ? (
        <p className="notice">You were signed out after no activity. Sign in again when you are ready to continue.</p>
      ) : requiresAuth ? (
        <p className="notice">Sign in or create an account to continue.</p>
      ) : null}
      <SupportNotice
        title={tab === "signup" ? "New client setup" : "Returning client access"}
        copy={
          tab === "signup"
            ? "Start with the basics. You can add billing, shipping, and project details later."
            : "Sign in with the email and password for your account."
        }
      />

      {tab === "signup" ? (
        <form className="form active" onSubmit={handleSignup}>
          <FormSectionCard title="Identity" copy="Tell the studio who the request belongs to.">
            <label>
              Full name
              <input name="fullName" type="text" required autoComplete="name" />
            </label>
            <label>
              Username
              <input name="username" type="text" autoComplete="username" />
            </label>
            <label>
              Email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Company
              <input name="company" type="text" autoComplete="organization" />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" autoComplete="tel" />
            </label>
            <label>
              Account type
              <select name="userType" defaultValue="Individual">
                <option>Individual</option>
                <option>Business</option>
                <option>Organization</option>
                <option>Creator</option>
                <option>Model</option>
              </select>
            </label>
          </FormSectionCard>
          <FormSectionCard title="Service interest" copy="Pick the service that best matches what you need first.">
            <label>
              Primary service interest
              <select name="serviceInterest" required defaultValue="">
                <option value="">Choose one</option>
                {serviceOptions.map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </select>
            </label>
            <label>
              Password
              <input name="password" type="password" minLength="8" required autoComplete="new-password" />
            </label>
            <label>
              Preferred contact
              <select name="preferredContactMethod" defaultValue="Email">
                <option>Email</option>
                <option>Phone</option>
                <option>Text</option>
                <option>Portal Message</option>
              </select>
            </label>
            <label>
              Website
              <input name="website" type="text" inputMode="url" />
            </label>
            <label>
              How did you find us?
              <input name="referralSource" type="text" />
            </label>
            <FormHint>You can add more details after account creation.</FormHint>
          </FormSectionCard>
          <button type="submit" className="button">
            Create account
          </button>
        </form>
      ) : (
        <form className="form active" onSubmit={handleLogin}>
          <FormSectionCard title="Account entry" copy="Use the same email and password tied to your account.">
            <label>
              Email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Password
              <input name="password" type="password" required autoComplete="current-password" />
            </label>
            <FormHint>Studio staff use the same sign-in page and can open Manager from the dashboard navigation.</FormHint>
          </FormSectionCard>
          <button type="submit" className="button">
            Sign in
          </button>
        </form>
      )}

      <p className={`message ${message ? "is-visible" : ""}`} aria-live="polite">
        {message}
      </p>
    </section>
  );
}
