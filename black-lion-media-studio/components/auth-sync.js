"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AUTH_CHANNEL_NAME, AUTH_EVENT_NAME, AUTH_STORAGE_KEY } from "../lib/auth-events";
import { clearClientSessionToken } from "../lib/client-session";

const protectedPaths = new Set(["/dashboard", "/profile", "/messages", "/booking-manager"]);
const managerOnlyPaths = new Set(["/booking-manager"]);
const portalPaths = new Set(["/portal"]);

function getPathMode(pathname) {
  if (managerOnlyPaths.has(pathname)) {
    return "manager";
  }

  if (protectedPaths.has(pathname)) {
    return "protected";
  }

  if (portalPaths.has(pathname)) {
    return "portal";
  }

  return "none";
}

export function AuthSync() {
  const pathname = usePathname();
  const router = useRouter();
  const lastKnownSessionRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const lastSyncAtRef = useRef(0);

  useEffect(() => {
    const pathMode = getPathMode(pathname);
    if (pathMode === "none") {
      return undefined;
    }

    let cancelled = false;
    const channel =
      typeof window !== "undefined" && typeof window.BroadcastChannel !== "undefined"
        ? new window.BroadcastChannel(AUTH_CHANNEL_NAME)
        : null;

    async function syncAuthState({ force = false } = {}) {
      const now = Date.now();
      if (!force && syncInFlightRef.current) {
        return;
      }

      if (!force && now - lastSyncAtRef.current < 1200) {
        return;
      }

      syncInFlightRef.current = true;
      lastSyncAtRef.current = now;

      try {
        const response = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });
        if (cancelled) {
          return;
        }

        const isAuthenticated = response.ok;
        const currentAuthState = isAuthenticated ? "authenticated" : "anonymous";
        const authStateChanged = lastKnownSessionRef.current !== null && lastKnownSessionRef.current !== currentAuthState;
        lastKnownSessionRef.current = currentAuthState;
        const data = isAuthenticated ? await response.json() : null;
        const workspacePath = "/dashboard";

        if (isAuthenticated) {
          if (pathMode === "portal") {
            router.replace(workspacePath);
            return;
          }

          if (pathMode === "manager" && !data?.user?.isBookingManager) {
            router.replace("/dashboard");
            return;
          }
        } else {
          clearClientSessionToken();
        }

        if (!isAuthenticated && (pathMode === "protected" || pathMode === "manager")) {
          router.replace("/portal?auth=required");
          return;
        }

        if (authStateChanged && pathMode === "manager" && !isAuthenticated) {
          router.replace("/dashboard");
        }
      } catch {
        // Ignore transient fetch failures here. Server page guards and
        // explicit 401 responses handle real auth redirects.
      } finally {
        syncInFlightRef.current = false;
      }
    }

    function handleCustomEvent() {
      syncAuthState({ force: true });
    }

    function handleStorageEvent(event) {
      if (event.key === AUTH_STORAGE_KEY) {
        syncAuthState({ force: true });
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        syncAuthState();
      }
    }

    function handleFocus() {
      syncAuthState();
    }

    syncAuthState({ force: true });

    window.addEventListener(AUTH_EVENT_NAME, handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (channel) {
      channel.onmessage = handleCustomEvent;
    }

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EVENT_NAME, handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      channel?.close();
    };
  }, [pathname, router]);

  return null;
}
