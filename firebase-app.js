// Shared Firebase app instance for BakeCost.
// Lazily initialised on first use, and only when firebase-config.js
// holds a real config. Dynamic imports keep the Firebase SDK out of
// the page entirely in guest demo mode, so the app loads fast and
// works with no network access to Google.

import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

export const FIREBASE_APP_URL = "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
export const FIREBASE_AI_URL = "https://www.gstatic.com/firebasejs/11.10.0/firebase-ai.js";
export const FIREBASE_AUTH_URL = "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
export const FIREBASE_FIRESTORE_URL = "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

let appPromise = null;

// Returns the Firebase app, initialising it once. Throws when Firebase
// is not configured, so callers must check isFirebaseConfigured first
// or catch the error and fall back to guest mode.
export function getFirebaseApp() {
  if (!isFirebaseConfigured) {
    return Promise.reject(new Error("Firebase is not configured yet."));
  }
  if (!appPromise) {
    appPromise = import(FIREBASE_APP_URL).then(function (mod) {
      try {
        return mod.initializeApp(firebaseConfig);
      } catch (e) {
        // Already initialised (for example by another module in the
        // same page): reuse the existing app.
        return mod.getApp();
      }
    });
  }
  return appPromise;
}
