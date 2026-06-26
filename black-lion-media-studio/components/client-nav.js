"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "../lib/client-analytics";
import { authenticatedFetch, clearClientSessionToken } from "../lib/client-session";
import {
  AUTH_ACTIVITY_EVENT_NAME,
  AUTH_ACTIVITY_STORAGE_KEY,
  AUTH_IDLE_TIMEOUT_MS,
  AUTH_IDLE_WARNING_MS,
  notifyAuthActivity,
  notifyAuthStateChange
} from "../lib/auth-events";
import { ThemeToggle } from "./theme-toggle";

export function ClientNav({ userName, isBookingManager = false, workspace = "client" }) {
  const pathname = usePathname();
  const router = useRouter();
  const logoutTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const activityResetRef = useRef(null);
  const lastTimerScheduleRef = useRef(0);
  const lastActivityBroadcastRef = useRef(0);
  const loggingOutRef = useRef(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(AUTH_IDLE_WARNING_MS / 1000));

  const navItems =
    workspace === "manager"
      ? [
          { href: "/booking-manager", label: "Manager" },
          { href: "/dashboard", label: "Client" },
          { href: "/messages", label: "Messages" },
          { href: "/profile", label: "Profile" },
          { href: "/store", label: "Store" }
        ]
      : [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/messages", label: "Messages" },
          { href: "/profile", label: "Profile" },
          { href: "/store", label: "Store" },
          ...(isBookingManager ? [{ href: "/booking-manager", label: "Manager" }] : [])
        ];

  const handleLogout = useCallback(async (reason = "manual") => {
    if (loggingOutRef.current) {
      return;
    }

    loggingOutRef.current = true;
    await authenticatedFetch("/api/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    trackEvent("logout", { reason });
    clearClientSessionToken();
    notifyAuthStateChange(reason === "idle" ? "idle-signed-out" : "signed-out");
    router.replace(reason === "idle" ? "/portal?auth=required&reason=idle" : "/");
  }, [router]);

  useEffect(() => {
    function clearExistingTimer() {
      if (logoutTimerRef.current) {
        window.clearTimeout(logoutTimerRef.current);
      }

      if (warningTimerRef.current) {
        window.clearTimeout(warningTimerRef.current);
      }

      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
      }
    }

    function scheduleInactivityTimers({ broadcast = false, force = false } = {}) {
      if (loggingOutRef.current) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastTimerScheduleRef.current < 1000) {
        return;
      }

      lastTimerScheduleRef.current = now;

      clearExistingTimer();
      setIdleWarning(false);
      setSecondsRemaining(Math.ceil(AUTH_IDLE_WARNING_MS / 1000));

      if (broadcast && now - lastActivityBroadcastRef.current > 15000) {
        lastActivityBroadcastRef.current = now;
        notifyAuthActivity();
      }

      warningTimerRef.current = window.setTimeout(() => {
        const warningStartedAt = Date.now();
        setIdleWarning(true);
        setSecondsRemaining(Math.ceil(AUTH_IDLE_WARNING_MS / 1000));
        countdownTimerRef.current = window.setInterval(() => {
          const elapsed = Date.now() - warningStartedAt;
          const remaining = Math.max(0, Math.ceil((AUTH_IDLE_WARNING_MS - elapsed) / 1000));
          setSecondsRemaining(remaining);
        }, 1000);
      }, AUTH_IDLE_TIMEOUT_MS - AUTH_IDLE_WARNING_MS);

      logoutTimerRef.current = window.setTimeout(() => {
        handleLogout("idle");
      }, AUTH_IDLE_TIMEOUT_MS);
    }

    function resetInactivityTimer() {
      scheduleInactivityTimers({ broadcast: true });
    }

    activityResetRef.current = resetInactivityTimer;

    function handleActivityEvent() {
      scheduleInactivityTimers({ force: true });
    }

    function handleActivityStorage(event) {
      if (event.key === AUTH_ACTIVITY_STORAGE_KEY) {
        scheduleInactivityTimers({ force: true });
      }
    }

    const activityEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "touchmove", "pointerdown"];
    scheduleInactivityTimers({ force: true });
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });
    window.addEventListener(AUTH_ACTIVITY_EVENT_NAME, handleActivityEvent);
    window.addEventListener("storage", handleActivityStorage);

    return () => {
      clearExistingTimer();
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer);
      });
      window.removeEventListener(AUTH_ACTIVITY_EVENT_NAME, handleActivityEvent);
      window.removeEventListener("storage", handleActivityStorage);
      activityResetRef.current = null;
    };
  }, [handleLogout]);

  return (
    <>
      <nav className="topbar">
        <div>
          <p className="label">{workspace === "manager" ? "Manager workspace" : "Client workspace"}</p>
          <strong>{userName}</strong>
        </div>
        <div className="topbar-links">
          <ThemeToggle />
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={pathname === item.href ? "current-link" : ""}>
              {item.label}
            </Link>
          ))}
          <button type="button" className="button button-secondary" onClick={() => handleLogout("manual")}>
            Log out
          </button>
        </div>
      </nav>

      {idleWarning ? (
        <section className="session-warning" role="status" aria-live="polite">
          <div>
            <strong>Still working?</strong>
            <p>No activity detected. The session will sign out in {secondsRemaining} seconds.</p>
          </div>
          <div className="session-warning-actions">
            <button type="button" className="button" onClick={() => activityResetRef.current?.()}>
              Stay signed in
            </button>
            <button type="button" className="button button-secondary" onClick={() => handleLogout("manual")}>
              Log out now
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
