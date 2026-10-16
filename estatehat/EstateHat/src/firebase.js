import { initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  projectId: "estatehat",
  appId: "1:1024417395762:web:684901c32d35c3c5d9b82b",
  storageBucket: "estatehat.firebasestorage.app",
  apiKey: "AIzaSyDbtBrkOANL4mtiMtgVEu8DLcXYgp8Mojc",
  authDomain: "estatehat.firebaseapp.com",
  messagingSenderId: "1024417395762",
  measurementId: "G-8RHY1LBQNZ",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

setPersistence(auth, browserLocalPersistence).catch(() => {
  // Keep the app usable even if persistence setup is blocked by the browser.
});

const runtimeEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const appCheckKey = runtimeEnv.VITE_APP_CHECK_SITE_KEY || process.env.NEXT_PUBLIC_APP_CHECK_SITE_KEY || "";

if (appCheckKey) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // App Check is additive hardening only; do not block boot.
  }
}
