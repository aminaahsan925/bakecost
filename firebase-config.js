// Firebase configuration for BakeCost.
// ---------------------------------------------------------------
// HOW TO WIRE UP FIREBASE (the parent does this step):
// 1. Create a Firebase project at https://console.firebase.google.com
// 2. In the project, enable Firebase AI Logic (Build, Firebase AI Logic).
//    This is what lets Gemini read invoice files and pasted text.
// 3. Enable Authentication (Build, Authentication, Sign-in method) and
//    turn on the Google provider, so bakers can sign in with Google.
// 4. Create a Firestore database (Build, Firestore Database) in
//    production mode, so signed-in bakers can save their data.
// 5. Register a Web app in Project settings and copy its config here,
//    replacing each placeholder value below.
// 6. Reload the app. The mode badge switches from "Guest demo" to
//    "AI ready", and the Sign in button starts working.
//
// Until this file holds a real config, the app runs in guest demo mode
// with a built-in local parser and localStorage, so the full flow
// stays testable end to end without a Firebase project.
//
// Do NOT commit real keys to a public repo without restricting them
// in the Google Cloud console (API restrictions for the key, and
// Firestore rules that only let a user read and write their own
// document under users/{uid}).
// ---------------------------------------------------------------

export const firebaseConfig = {
  apiKey: "AIzaSyCDQy5C1xPEhzDaaRfeElN2CUTRur2JfLc",
  authDomain: "bakecost-cf9a6.firebaseapp.com",
  projectId: "bakecost-cf9a6",
  storageBucket: "bakecost-cf9a6.firebasestorage.app",
  messagingSenderId: "43722410808",
  appId: "1:43722410808:web:52e91630ce6e03b3ab0fcd"
};

// Free-tier Gemini model used through Firebase AI Logic.
// gemini-2.0-flash was retired (Nov 2026); the API itself recommends
// gemini-3.8-flash, which is the current free-tier Flash model.
export const MODEL_ID = "gemini-3.8-flash";

// True only when every placeholder above has been replaced.
export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0 && !value.startsWith("YOUR_")
);
