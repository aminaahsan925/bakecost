// BakeCost persistence and sign-in.
// Two modes:
// - Guest mode: state lives in localStorage on this browser only.
//   No account, no Firebase, works offline after first load.
// - Signed-in mode: the baker signs in with Google (Firebase Auth)
//   and state lives in Firestore under users/{uid}, so it follows
//   them across devices.
//
// The app never mixes the two stores. Signing in loads the cloud
// state (or starts empty in the cloud); signing out returns to the
// guest state left in localStorage. A "Copy guest data to my account"
// action lets a baker move their guest work into their account once.

import { isFirebaseConfigured } from "./firebase-config.js";
import { getFirebaseApp, FIREBASE_AUTH_URL, FIREBASE_FIRESTORE_URL } from "./firebase-app.js";
import { emptyState } from "./sample-data.js";

export var GUEST_KEY = "bakecost-v2-guest";
export var CLOUD_DOC_PATH = "users";

// ---------- guest (localStorage) ----------

export function loadGuestState() {
  try {
    var raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.invoices) || !Array.isArray(parsed.recipes)) {
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

export function saveGuestState(state) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearGuestState() {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch (e) {
    // localStorage unavailable, nothing to clear.
  }
}

// ---------- sign-in (Firebase Auth, Google) ----------

var authPromise = null;

function getAuth() {
  if (!isFirebaseConfigured) {
    return Promise.reject(new Error("Firebase is not configured, so sign-in is unavailable."));
  }
  if (!authPromise) {
    authPromise = Promise.all([getFirebaseApp(), import(FIREBASE_AUTH_URL)])
      .then(function (parts) {
        var app = parts[0];
        var authMod = parts[1];
        return { auth: authMod.getAuth(app), mod: authMod };
      });
  }
  return authPromise;
}

export async function signInWithGoogle() {
  var parts = await getAuth();
  var provider = new parts.mod.GoogleAuthProvider();
  var result = await parts.mod.signInWithPopup(parts.auth, provider);
  return result.user;
}

export async function signOutUser() {
  var parts = await getAuth();
  await parts.mod.signOut(parts.auth);
}

// Calls cb(user) whenever the signed-in user changes, and once on load
// with the current user (or null). Returns an unsubscribe function.
// In guest mode (no Firebase config) it calls back once with null.
export function onAuthChange(cb) {
  if (!isFirebaseConfigured) {
    setTimeout(function () { cb(null); }, 0);
    return function () {};
  }
  var unsub = null;
  getAuth()
    .then(function (parts) {
      unsub = parts.mod.onAuthStateChanged(parts.auth, cb);
    })
    .catch(function () {
      cb(null);
    });
  return function () {
    if (unsub) unsub();
  };
}

// ---------- cloud (Firestore) ----------

var dbPromise = null;

function getDb() {
  if (!isFirebaseConfigured) {
    return Promise.reject(new Error("Firebase is not configured, so cloud saving is unavailable."));
  }
  if (!dbPromise) {
    dbPromise = Promise.all([getFirebaseApp(), import(FIREBASE_FIRESTORE_URL)])
      .then(function (parts) {
        var app = parts[0];
        var fsMod = parts[1];
        return { db: fsMod.getFirestore(app), mod: fsMod };
      });
  }
  return dbPromise;
}

function userDocRef(parts, uid) {
  return parts.mod.doc(parts.db, CLOUD_DOC_PATH, uid);
}

// Load the signed-in baker's state. Returns null when they have no
// saved state yet (first sign-in).
export async function loadCloudState(user) {
  var parts = await getDb();
  var snap = await parts.mod.getDoc(userDocRef(parts, user.uid));
  if (!snap.exists()) return null;
  var data = snap.data();
  if (!data || !Array.isArray(data.invoices) || !Array.isArray(data.recipes)) {
    return null;
  }
  return {
    ingredients: data.ingredients || [],
    invoices: data.invoices || [],
    recipes: data.recipes || [],
    activity: data.activity || [],
    isSample: false
  };
}

export async function saveCloudState(user, state) {
  var parts = await getDb();
  await parts.mod.setDoc(userDocRef(parts, user.uid), {
    ingredients: state.ingredients,
    invoices: state.invoices,
    recipes: state.recipes,
    activity: state.activity,
    updatedAt: parts.mod.serverTimestamp()
  });
}

// A clean empty state for a first-time signed-in baker.
export function freshCloudState() {
  return emptyState();
}
