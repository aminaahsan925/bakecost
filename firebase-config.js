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
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Free-tier Gemini model used through Firebase AI Logic.
// gemini-2.0-flash is available on the Firebase AI Logic free tier.
// gemini-2.5-flash is also free-tier eligible and can be swapped in here.
export const MODEL_ID = "gemini-2.0-flash";

// True only when every placeholder above has been replaced.
export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0 && !value.startsWith("YOUR_")
);
