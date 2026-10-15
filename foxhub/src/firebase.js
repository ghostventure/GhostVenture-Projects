import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { browserSessionPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { publicEnv } from "./public-env.js";

const firebaseConfig = {
  apiKey: publicEnv.FIREBASE_API_KEY,
  authDomain: publicEnv.FIREBASE_AUTH_DOMAIN,
  projectId: publicEnv.FIREBASE_PROJECT_ID,
  storageBucket: publicEnv.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: publicEnv.FIREBASE_MESSAGING_SENDER_ID,
  appId: publicEnv.FIREBASE_APP_ID
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
);

const appCheckSiteKey = publicEnv.RECAPTCHA_V3_SITE_KEY;
export const hasAppCheckConfig = Boolean(appCheckSiteKey);

export const firebaseApp = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const appCheck =
  firebaseApp && hasAppCheckConfig
    ? initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true
      })
    : null;

if (auth) {
  setPersistence(auth, browserSessionPersistence).catch(() => {
    // Keep default persistence if the browser blocks explicit configuration.
  });
}
