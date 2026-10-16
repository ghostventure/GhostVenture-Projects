import { useEffect, useRef } from "react";

export const INACTIVITY_LOGOUT_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS = [
  "click",
  "keydown",
  "mousemove",
  "pointerdown",
  "scroll",
  "touchstart",
  "wheel"
];

export function useInactivityLogout({ enabled, onTimeout, timeoutMs = INACTIVITY_LOGOUT_MS }) {
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    let timeoutId;
    let lastActivityAt = Date.now();

    const clearLogoutTimer = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };

    const triggerLogout = () => {
      clearLogoutTimer();
      Promise.resolve(onTimeoutRef.current?.()).catch((error) => {
        console.error("EstateHat inactivity logout failed:", error);
      });
    };

    const scheduleLogout = () => {
      clearLogoutTimer();
      const inactiveFor = Date.now() - lastActivityAt;
      const remaining = Math.max(timeoutMs - inactiveFor, 0);
      timeoutId = window.setTimeout(() => {
        if (Date.now() - lastActivityAt >= timeoutMs) {
          triggerLogout();
          return;
        }
        scheduleLogout();
      }, remaining);
    };

    const markActive = () => {
      lastActivityAt = Date.now();
      scheduleLogout();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markActive();
      }
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, markActive, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleLogout();

    return () => {
      clearLogoutTimer();
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, markActive);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, timeoutMs]);
}
