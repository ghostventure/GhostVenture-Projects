"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseClients } from "../../../lib/firebase-client";

const EMPTY_PROFILE = {
  displayName: "",
  handle: "",
  city: "",
  favoriteSound: "",
  bio: "",
  socialHandle: "",
  preferredSize: "",
  styleFocus: "",
};
const EMPTY_PREFERENCES = { dropAlerts: false, restockAlerts: false, newsletterOptIn: false };

function toAddress(value = {}, index = 0) {
  return {
    label: typeof value.label === "string" ? value.label : `Address ${index + 1}`,
    recipient: typeof value.recipient === "string" ? value.recipient : "",
    line1: typeof value.line1 === "string" ? value.line1 : "",
    line2: typeof value.line2 === "string" ? value.line2 : "",
    city: typeof value.city === "string" ? value.city : "",
    region: typeof value.region === "string" ? value.region : "",
    postalCode: typeof value.postalCode === "string" ? value.postalCode : "",
    country: typeof value.country === "string" ? value.country : "US",
  };
}

function settingsFromProfile(value = {}) {
  const profile = Object.fromEntries(Object.keys(EMPTY_PROFILE).map((key) => [key, typeof value[key] === "string" ? value[key] : ""]));
  const preferences = Object.fromEntries(Object.keys(EMPTY_PREFERENCES).map((key) => [key, value[key] === true]));
  const addresses = Array.isArray(value.addresses) ? value.addresses.slice(0, 5).map(toAddress) : [];
  return { profile, preferences, addresses };
}

function timestampLabel(value) {
  if (!value || typeof value.toDate !== "function") return "Account date unavailable";
  return `Member since ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(value.toDate())}`;
}

function friendlyError(error) {
  if (error?.code === "functions/invalid-argument") return error.message || "Check the highlighted account details and try again.";
  if (error?.code === "functions/unauthenticated" || error?.code === "auth/requires-recent-login") return "For your security, sign in again and retry this change.";
  if (error?.code === "functions/permission-denied") return "This account change could not be authorized. Refresh and try again.";
  return "We couldn’t save that change. Check your connection and try again.";
}

export default function AccountSettingsClient() {
  const [clients, setClients] = useState(null);
  const [user, setUser] = useState(null);
  const [profileRecord, setProfileRecord] = useState(null);
  const [draft, setDraft] = useState(null);
  const [savedDraft, setSavedDraft] = useState(null);
  const [authState, setAuthState] = useState("loading");
  const [pageState, setPageState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState("status");

  useEffect(() => {
    let active = true;
    let profileRequest = 0;
    let unsubscribe = () => {};
    try {
      const firebase = getFirebaseClients();
      setClients(firebase);
      unsubscribe = onAuthStateChanged(firebase.auth, async (currentUser) => {
        const requestId = ++profileRequest;
        if (!active) return;
        setUser(currentUser);
        setAuthState(currentUser ? "signed-in" : "signed-out");
        setProfileRecord(null);
        setDraft(null);
        setSavedDraft(null);
        setNotice("");
        if (!currentUser) {
          setPageState("idle");
          return;
        }
        setPageState("loading");
        try {
          const snapshot = await getDoc(doc(firebase.db, "users", currentUser.uid));
          if (!active || requestId !== profileRequest) return;
          const record = snapshot.exists() ? snapshot.data() : {};
          const settings = settingsFromProfile(record);
          setProfileRecord(record);
          setDraft(settings);
          setSavedDraft(settings);
          setPageState("ready");
        } catch {
          if (!active || requestId !== profileRequest) return;
          setPageState("error");
        }
      }, () => {
        if (!active) return;
        setAuthState("error");
        setPageState("error");
      });
    } catch {
      setAuthState("error");
      setPageState("error");
    }
    return () => { active = false; unsubscribe(); };
  }, []);

  const hasChanges = useMemo(() => draft && savedDraft && JSON.stringify(draft) !== JSON.stringify(savedDraft), [draft, savedDraft]);
  const updateProfile = useCallback((key, value) => {
    setDraft((current) => current ? { ...current, profile: { ...current.profile, [key]: value } } : current);
  }, []);
  const updatePreference = useCallback((key, value) => {
    setDraft((current) => current ? { ...current, preferences: { ...current.preferences, [key]: value } } : current);
  }, []);
  const updateAddress = useCallback((index, key, value) => {
    setDraft((current) => current ? {
      ...current,
      addresses: current.addresses.map((address, itemIndex) => itemIndex === index ? { ...address, [key]: value } : address),
    } : current);
  }, []);

  async function saveSettings(event) {
    event.preventDefault();
    if (!clients || !user || !draft || !hasChanges || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const save = httpsCallable(clients.functions, "updateCustomerAccountSettings");
      const response = await save(draft);
      const normalized = {
        profile: response.data?.profile || draft.profile,
        preferences: response.data?.preferences || draft.preferences,
        addresses: Array.isArray(response.data?.addresses) ? response.data.addresses.map(toAddress) : draft.addresses,
      };
      setDraft(normalized);
      setSavedDraft(normalized);
      setProfileRecord((current) => ({ ...(current || {}), ...normalized.profile, ...normalized.preferences, addresses: normalized.addresses }));
      setNotice("Your account settings are saved.");
      setNoticeKind("status");
    } catch (error) {
      setNotice(friendlyError(error));
      setNoticeKind("alert");
    } finally {
      setBusy(false);
    }
  }

  function discardChanges() {
    if (!savedDraft) return;
    setDraft(savedDraft);
    setNotice("Unsaved changes were discarded.");
    setNoticeKind("status");
  }

  async function sendPasswordReset() {
    if (!clients || !user?.email || busy) return;
    setBusy(true);
    setNotice("");
    try {
      await sendPasswordResetEmail(clients.auth, user.email);
      setNotice(`Password reset instructions were sent to ${user.email}.`);
      setNoticeKind("status");
    } catch {
      setNotice("We couldn’t send the reset email. Try again in a moment.");
      setNoticeKind("alert");
    } finally {
      setBusy(false);
    }
  }

  async function sendVerification() {
    if (!clients || !user || user.emailVerified || busy) return;
    setBusy(true);
    setNotice("");
    try {
      await sendEmailVerification(user);
      setNotice("A verification link was sent to your email address.");
      setNoticeKind("status");
    } catch {
      setNotice("We couldn’t send a verification email. Try again in a moment.");
      setNoticeKind("alert");
    } finally {
      setBusy(false);
    }
  }

  function downloadAccountData() {
    if (!user || !profileRecord) return;
    const exportData = {
      exportedAt: new Date().toISOString(),
      account: {
        uid: user.uid,
        email: user.email || null,
        emailVerified: user.emailVerified,
        displayName: profileRecord.displayName || "",
        handle: profileRecord.handle || "",
        city: profileRecord.city || "",
        favoriteSound: profileRecord.favoriteSound || "",
        bio: profileRecord.bio || "",
        socialHandle: profileRecord.socialHandle || "",
        preferredSize: profileRecord.preferredSize || "",
        styleFocus: profileRecord.styleFocus || "",
        dropAlerts: profileRecord.dropAlerts === true,
        restockAlerts: profileRecord.restockAlerts === true,
        newsletterOptIn: profileRecord.newsletterOptIn === true,
        savedPieces: Array.isArray(profileRecord.savedPieces) ? profileRecord.savedPieces : [],
        addresses: Array.isArray(profileRecord.addresses) ? profileRecord.addresses : [],
        referralCode: profileRecord.referralCode || null,
      },
      note: "Order history is available separately in your Plugz Dashboard.",
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `plugz-account-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Your account data file was downloaded to this device.");
    setNoticeKind("status");
  }

  async function handleSignOut() {
    if (!clients || busy) return;
    setBusy(true);
    try { await signOut(clients.auth); }
    catch { setNotice("We couldn’t sign you out. Please retry."); setNoticeKind("alert"); }
    finally { setBusy(false); }
  }

  function addAddress() {
    setDraft((current) => current && current.addresses.length < 5 ? {
      ...current,
      addresses: [...current.addresses, toAddress({ label: `Address ${current.addresses.length + 1}` }, current.addresses.length)],
    } : current);
  }

  function removeAddress(index) {
    setDraft((current) => current ? { ...current, addresses: current.addresses.filter((_, itemIndex) => itemIndex !== index) } : current);
  }

  const accountName = draft?.profile.displayName || user?.displayName || "Plugz member";

  return (
    <main className="dashboard-shell settings-shell">
      <header className="topbar">
        <a className="brand" href="https://plugz-untd-gear.web.app/" aria-label="Plugz home">PLUGZ<span>UNTD</span></a>
        <nav aria-label="Account navigation">
          <a href="/dashboard">Dashboard</a>
          <a className="current-link" href="/account/settings" aria-current="page">Settings</a>
          {user && <button className="quiet-button" type="button" onClick={handleSignOut} disabled={busy}>Sign out</button>}
        </nav>
      </header>

      <div className="settings-heading">
        <div>
          <p className="eyebrow">Account center</p>
          <h1>Account settings</h1>
          <p>Manage how Plugz recognizes you, what updates you receive, and which addresses you keep ready.</p>
        </div>
        <a className="outline-button" href="/dashboard">Back to dashboard</a>
      </div>

      {authState === "loading" ? (
        <section className="settings-card" aria-live="polite"><p className="subtle-status">Checking your account…</p><div className="loading-line" /></section>
      ) : authState === "error" ? (
        <section className="settings-card" role="alert"><h2>Account settings couldn’t start</h2><p>Refresh the page. If the issue continues, contact Plugz support.</p></section>
      ) : authState !== "signed-in" ? (
        <section className="settings-card">
          <h2>Sign in to manage your settings</h2>
          <p>Your account settings are private to your Plugz account.</p>
          <a className="primary-button" href="/dashboard">Go to sign in</a>
        </section>
      ) : pageState === "loading" ? (
        <section className="settings-card" aria-live="polite"><p className="subtle-status">Loading account settings…</p><div className="loading-line" /></section>
      ) : pageState === "error" ? (
        <section className="settings-card" role="alert"><h2>Settings aren’t available right now</h2><p>We couldn’t load your account record. Your sign-in is still active; refresh the page or contact support if this continues.</p></section>
      ) : (
        <>
          <section className="settings-identity" aria-label="Account identity">
            <div className="settings-avatar" aria-hidden="true">{accountName.trim().slice(0, 1).toUpperCase() || "P"}</div>
            <div className="identity-copy">
              <h2>{accountName}</h2>
              <p>{user.email || "No email address on this account"}</p>
              <p className="subtle-status">{timestampLabel(profileRecord?.createdAt)}</p>
            </div>
            <span className={`verification-pill ${user.emailVerified ? "is-verified" : "is-pending"}`}>
              {user.emailVerified ? "Email verified" : "Email not verified"}
            </span>
          </section>

          {notice && <p className={`notice settings-notice ${noticeKind === "alert" ? "notice-error" : ""}`} role={noticeKind} aria-live={noticeKind === "alert" ? "assertive" : "polite"}>{notice}</p>}

          <form className="settings-form" onSubmit={saveSettings}>
            <fieldset className="settings-fieldset" disabled={busy}>
            <section className="settings-card" aria-labelledby="profile-settings-title">
              <div className="settings-section-heading"><div><p className="eyebrow">Your profile</p><h2 id="profile-settings-title">Make it yours</h2></div><span className="section-hint">Shown in your account and preferences</span></div>
              <div className="settings-grid">
                <label className="settings-field">Display name<input maxLength={48} autoComplete="name" value={draft?.profile.displayName || ""} onChange={(event) => updateProfile("displayName", event.target.value)} placeholder="Your name" /></label>
                <label className="settings-field">Handle<input maxLength={28} autoComplete="nickname" value={draft?.profile.handle || ""} onChange={(event) => updateProfile("handle", event.target.value)} placeholder="plugzmember" /><span>3–28 letters, numbers, dots, dashes, or underscores.</span></label>
                <label className="settings-field">City<input maxLength={64} autoComplete="address-level2" value={draft?.profile.city || ""} onChange={(event) => updateProfile("city", event.target.value)} placeholder="City" /></label>
                <label className="settings-field">Favorite sound<input maxLength={64} value={draft?.profile.favoriteSound || ""} onChange={(event) => updateProfile("favoriteSound", event.target.value)} placeholder="Artist, genre, or mood" /></label>
                <label className="settings-field">Style focus<select value={draft?.profile.styleFocus || ""} onChange={(event) => updateProfile("styleFocus", event.target.value)}><option value="">Choose a style</option>{["Streetwear", "Music", "Skate", "Minimal", "Vintage", "Custom"].map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="settings-field">Preferred size<select value={draft?.profile.preferredSize || ""} onChange={(event) => updateProfile("preferredSize", event.target.value)}><option value="">Choose a size</option>{["XS", "S", "M", "L", "XL", "2XL", "3XL"].map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="settings-field">Social handle<input maxLength={48} value={draft?.profile.socialHandle || ""} onChange={(event) => updateProfile("socialHandle", event.target.value.replace(/^@/, ""))} placeholder="yourhandle" /></label>
                <label className="settings-field settings-field-wide">About you<textarea maxLength={240} rows={3} value={draft?.profile.bio || ""} onChange={(event) => updateProfile("bio", event.target.value)} placeholder="A short intro for your Plugz profile" /><span>{(draft?.profile.bio || "").length}/240 characters</span></label>
              </div>
            </section>

            <section className="settings-card" aria-labelledby="communication-title">
              <div className="settings-section-heading"><div><p className="eyebrow">Communication</p><h2 id="communication-title">Choose what reaches you</h2></div><span className="section-hint">Change these any time</span></div>
              <div className="preference-list">
                <label className="preference-row"><span><strong>New drops</strong><small>Hear when a new collection goes live.</small></span><input type="checkbox" checked={draft?.preferences.dropAlerts || false} onChange={(event) => updatePreference("dropAlerts", event.target.checked)} /></label>
                <label className="preference-row"><span><strong>Restocks</strong><small>Get a heads-up when saved pieces return.</small></span><input type="checkbox" checked={draft?.preferences.restockAlerts || false} onChange={(event) => updatePreference("restockAlerts", event.target.checked)} /></label>
                <label className="preference-row"><span><strong>Plugz newsletter</strong><small>Occasional news, stories, and community updates.</small></span><input type="checkbox" checked={draft?.preferences.newsletterOptIn || false} onChange={(event) => updatePreference("newsletterOptIn", event.target.checked)} /></label>
              </div>
            </section>

            <section className="settings-card" aria-labelledby="address-title">
              <div className="settings-section-heading"><div><p className="eyebrow">Delivery</p><h2 id="address-title">Saved addresses</h2><p className="section-description">Keep up to five addresses ready for checkout. These are stored on your account and aren’t sent to a carrier by this settings page.</p></div><span className="section-hint">{draft?.addresses.length || 0}/5</span></div>
              {draft?.addresses.length ? (
                <div className="address-list">
                  {draft.addresses.map((address, index) => (
                    <fieldset className="address-card" key={`address-${index}`}>
                      <legend>Address {index + 1}</legend>
                      <button className="remove-address" type="button" onClick={() => removeAddress(index)} aria-label={`Remove address ${index + 1}`}>Remove</button>
                      <div className="settings-grid">
                        <label className="settings-field">Label<input required maxLength={30} value={address.label} onChange={(event) => updateAddress(index, "label", event.target.value)} placeholder="Home, work…" /></label>
                        <label className="settings-field">Recipient<input required maxLength={80} autoComplete="name" value={address.recipient} onChange={(event) => updateAddress(index, "recipient", event.target.value)} /></label>
                        <label className="settings-field settings-field-wide">Street address<input required maxLength={100} autoComplete="address-line1" value={address.line1} onChange={(event) => updateAddress(index, "line1", event.target.value)} /></label>
                        <label className="settings-field settings-field-wide">Apartment, suite, or unit <span>(optional)</span><input maxLength={100} autoComplete="address-line2" value={address.line2} onChange={(event) => updateAddress(index, "line2", event.target.value)} /></label>
                        <label className="settings-field">City<input required maxLength={64} autoComplete="address-level2" value={address.city} onChange={(event) => updateAddress(index, "city", event.target.value)} /></label>
                        <label className="settings-field">State or region<input required maxLength={64} autoComplete="address-level1" value={address.region} onChange={(event) => updateAddress(index, "region", event.target.value)} /></label>
                        <label className="settings-field">Postal code<input required maxLength={20} autoComplete="postal-code" value={address.postalCode} onChange={(event) => updateAddress(index, "postalCode", event.target.value)} /></label>
                        <label className="settings-field">Country code<input required minLength={2} maxLength={2} autoComplete="country" value={address.country} onChange={(event) => updateAddress(index, "country", event.target.value.toUpperCase())} placeholder="US" /></label>
                      </div>
                    </fieldset>
                  ))}
                </div>
              ) : <p className="empty-addresses">No saved addresses yet. Add one when you’re ready; it won’t be used until you choose it at checkout.</p>}
              <button className="secondary-button" type="button" onClick={addAddress} disabled={(draft?.addresses.length || 0) >= 5}>Add address</button>
            </section>
            </fieldset>

            <div className="settings-savebar">
              <span>{hasChanges ? "You have unsaved changes." : "Your settings are up to date."}</span>
              <div><button className="secondary-button" type="button" onClick={discardChanges} disabled={!hasChanges || busy}>Discard</button><button className="primary-button" type="submit" disabled={!hasChanges || busy}>{busy ? "Saving…" : "Save settings"}</button></div>
            </div>
          </form>

          <section className="settings-card" aria-labelledby="security-title">
            <div className="settings-section-heading"><div><p className="eyebrow">Security</p><h2 id="security-title">Protect your sign-in</h2></div></div>
            <div className="security-actions">
              <div className="security-action"><div><strong>Email verification</strong><p>{user.emailVerified ? "Your email is verified." : "Verify your email to help protect account recovery."}</p></div>{!user.emailVerified && <button className="secondary-button" type="button" onClick={sendVerification} disabled={busy}>Send verification link</button>}</div>
              <div className="security-action"><div><strong>Password</strong><p>We’ll email a secure password reset link to your sign-in address.</p></div><button className="secondary-button" type="button" onClick={sendPasswordReset} disabled={busy || !user.email}>Send password reset</button></div>
            </div>
          </section>

          <section className="settings-card data-card" aria-labelledby="data-title">
            <div><p className="eyebrow">Your information</p><h2 id="data-title">Take a copy of your account data</h2><p>Download the profile, saved pieces, preferences, referral code, and addresses currently loaded for this account. Order history is available in your Dashboard.</p></div>
            <button className="secondary-button" type="button" onClick={downloadAccountData} disabled={!profileRecord}>Download account data</button>
          </section>
        </>
      )}

      <footer className="page-footer"><span>PLUGZ UNTD · ACCOUNT SETTINGS</span><a href="https://plugz-untd-gear.web.app/legal.html#privacy">Privacy</a></footer>
    </main>
  );
}
