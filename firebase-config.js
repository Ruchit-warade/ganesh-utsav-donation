/**
 * firebase-config.js
 * ------------------------------------------------------------
 * PASTE YOUR FIREBASE WEB CONFIG HERE.
 *
 * HOW TO GET IT:
 *   1. Go to https://console.firebase.google.com
 *   2. Create (or select) your project.
 *   3. Project Settings (gear icon) -> General -> Your apps.
 *   4. Click the Web icon (</>) to add a web app.
 *   5. Copy the `firebaseConfig` object into the block below.
 *   6. Replace the placeholder values below.
 *
 * SECURITY NOTE: These values are PUBLIC by design in a
 * browser-only app. Real security comes from Firestore Security
 * Rules (see firestore.rules) + Firebase Authentication, NOT from
 * hiding this config. See README -> "Security limitations".
 */

// Import the Firebase Modular SDK from the official CDN.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================================================
//  PASTE YOUR FIREBASE WEB CONFIG HERE
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBwJ9Tscfe8qjVkYZ0-y9shMw0wSCu5PAc",
  authDomain: "ganesh-utsav-iit-mandi.firebaseapp.com",
  projectId: "ganesh-utsav-iit-mandi",
  storageBucket: "ganesh-utsav-iit-mandi.firebasestorage.app",
  messagingSenderId: "874046021775",
  appId: "1:874046021775:web:744aac4d835f59ecfd50fa",
  measurementId: "G-ZGPSFYQBHE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth + Firestore instances (exported for other modules)
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
